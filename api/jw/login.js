
const express = require('express');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');
const bodyParser = require('body-parser');

const app = express();
const port = process.env.PORT || 3000;

// Enable CORS manually to prevent 405/Cors issues if proxy fails
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'dist')));

// --- USTC JW CRAWLER PROXY ---

// Helper to parse cookies from Set-Cookie header
const getCookies = (response) => {
  const setCookie = response.headers['set-cookie'];
  if (!setCookie) return '';
  return setCookie.map(c => c.split(';')[0]).join('; ');
};

const handleCaptchaDetection = async (html, sessionCookies, baseUrl) => {
  const $ = cheerio.load(html);
  let captchaImg = $('#validateImg'); 
  let hasCaptcha = captchaImg.length > 0 || html.includes('validateCode') || html.includes('vcode');

  let imgSrc = '';

  if (hasCaptcha) {
    imgSrc = captchaImg.attr('src');
    if (!imgSrc) {
        const match = html.match(/src=["']([^"']*validateCode[^"']*)["']/i) || html.match(/src=["']([^"']*vcode[^"']*)["']/i);
        if (match) imgSrc = match[1];
    }

    if (imgSrc) {
      if (!imgSrc.startsWith('http')) {
         const origin = new URL(baseUrl).origin;
         if (imgSrc.startsWith('/')) {
            imgSrc = origin + imgSrc;
         } else {
             imgSrc = origin + '/' + imgSrc;
         }
      }

      try {
        const imgRes = await axios.get(imgSrc, {
            responseType: 'arraybuffer',
            headers: { 
                'Cookie': sessionCookies,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                'Referer': baseUrl
            }
        });
        const base64 = Buffer.from(imgRes.data, 'binary').toString('base64');
        return {
            found: true,
            image: `data:image/jpeg;base64,${base64}`
        };
      } catch (e) {
        console.error("[Proxy] Failed to fetch captcha image:", e.message);
      }
    }
  }
  return { found: false };
};

// Helper: Detect and follow manual redirects (Meta Refresh, JS, SSO Loading Pages)
const followPageRedirects = async (initialHtml, initialUrl, cookies, headers) => {
    let html = initialHtml;
    let currentUrl = initialUrl;
    let sessionCookies = cookies;
    let redirectCount = 0;
    const MAX_REDIRECTS = 10; // Increased to handle complex SSO chains

    while (redirectCount < MAX_REDIRECTS) {
        let redirectUrl = null;

        // 1. Check for specific USTC SSO / Loading Page markers
        // The page usually has <div id="sso_redirect"> and a script at the bottom
        if (html.includes('id="sso_redirect"') || html.includes('id=\'sso_redirect\'')) {
             console.log(`[Proxy] USTC SSO Loading Page detected (${redirectCount})`);
             // Extract URL from script
             // Look for simple location assignment: location.href = "..."
             let match = html.match(/(?:location\.href|window\.location)\s*=\s*['"]([^'"]+)['"]/);
             if (!match) match = html.match(/location\.replace\(['"]([^'"]+)['"]\)/);
             
             if (match) {
                 redirectUrl = match[1];
             } else {
                 // Fallback: look for the service URL inside the script text (often decoded or just plain string)
                 // e.g. https://jw.ustc.edu.cn/ucas-sso/login
                 const urlInScript = html.match(/['"](https?:\/\/[^'"]+)['"]/);
                 if (urlInScript) redirectUrl = urlInScript[1];
             }
        }

        // 2. Meta Refresh
        if (!redirectUrl) {
            const metaMatch = html.match(/<meta\s+http-equiv=["']refresh["']\s+content=["']\d+;\s*url=([^"']+)["']/i);
            if (metaMatch) {
                redirectUrl = metaMatch[1];
                console.log(`[Proxy] Meta Refresh detected.`);
            }
        }

        // 3. General JS Redirects
        if (!redirectUrl) {
            const jsAssignment = html.match(/(?:window\.|self\.|top\.)?location(?:\.href)?\s*=\s*["']([^"']+)["']/);
            const jsCall = html.match(/(?:window\.|self\.|top\.)?location\.(?:replace|assign)\s*\(\s*["']([^"']+)["']\s*\)/);
            const jsNavigate = html.match(/window\.navigate\s*\(\s*["']([^"']+)["']\s*\)/);

            if (jsAssignment) {
                redirectUrl = jsAssignment[1];
            } else if (jsCall) {
                redirectUrl = jsCall[1];
            } else if (jsNavigate) {
                redirectUrl = jsNavigate[1];
            }
        }

        if (!redirectUrl) break; // No redirect found

        // Resolve Relative URL
        if (!redirectUrl.startsWith('http')) {
            const origin = new URL(currentUrl).origin;
            if (redirectUrl.startsWith('/')) {
                redirectUrl = origin + redirectUrl;
            } else {
                const path = currentUrl.substring(0, currentUrl.lastIndexOf('/') + 1);
                redirectUrl = path + redirectUrl;
            }
        }

        // Prevent infinite loops if redirecting to self
        if (redirectUrl === currentUrl) break;

        try {
            console.log(`[Proxy] Following redirect (${redirectCount + 1}): ${redirectUrl}`);
            const res = await axios.get(redirectUrl, { 
                headers: { ...headers, 'Cookie': sessionCookies },
                validateStatus: status => status < 400 
            });
            
            const newCookies = getCookies(res);
            if (newCookies) sessionCookies += '; ' + newCookies;
            
            html = res.data;
            currentUrl = redirectUrl;
            redirectCount++;
        } catch (e) {
            console.error('[Proxy] Redirect fetch failed:', e.message);
            break;
        }
    }

    return { html, currentUrl, sessionCookies };
};

// Real login implementation
app.post('/api/jw/login', async (req, res) => {
  const { username, password, captchaCode, context } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'Missing credentials' });
  }

  const CAS_LOGIN_URL = 'https://passport.ustc.edu.cn/login?service=https%3A%2F%2Fjw.ustc.edu.cn%2Fucas-sso%2Flogin';
  
  const BROWSER_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'Connection': 'keep-alive',
    'Cache-Control': 'max-age=0',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1'
  };

  let sessionCookies = '';
  let lt = '';
  let execution = '';
  let eventId = 'submit';

  try {
    if (context && context.sessionCookies && context.execution) {
        sessionCookies = context.sessionCookies;
        lt = context.lt || '';
        execution = context.execution;
        eventId = context.eventId || 'submit';
    } else {
        console.log('[Proxy] 1. Fetching CAS login page...');
        let loginPage = await axios.get(CAS_LOGIN_URL, { headers: BROWSER_HEADERS });
        
        sessionCookies = getCookies(loginPage);
        let html = loginPage.data;
        let currentUrl = CAS_LOGIN_URL;

        const redirectResult = await followPageRedirects(html, currentUrl, sessionCookies, BROWSER_HEADERS);
        html = redirectResult.html;
        currentUrl = redirectResult.currentUrl;
        sessionCookies = redirectResult.sessionCookies;

        const $ = cheerio.load(html);

        lt = $('input[name="lt"]').val() || $('input[id="lt"]').val();
        execution = $('input[name="execution"]').val() || $('input[id="execution"]').val();
        eventId = $('input[name="_eventId"]').val() || 'submit';

        // Robust Greedy Regex for Tokens
        if (!lt) {
            const ltInputMatch = html.match(/<input[^>]*name=["']lt["'][^>]*value=["']([^"']+)["']/i) || 
                                 html.match(/<input[^>]*value=["']([^"']+)["'][^>]*name=["']lt["']/i);
            if (ltInputMatch) {
                lt = ltInputMatch[1] || ltInputMatch[2];
            } else {
                const ltFormatMatch = html.match(/(LT-[a-zA-Z0-9\-\._]+)/); 
                if (ltFormatMatch) lt = ltFormatMatch[1];
            }
        }

        if (!execution) {
            const inputRegex = /<input[^>]*name=["']execution["'][^>]*value=["']([^"']+)["']/i;
            const inputRegexRev = /<input[^>]*value=["']([^"']+)["'][^>]*name=["']execution["']/i;
            const inputMatch = html.match(inputRegex) || html.match(inputRegexRev);
            if (inputMatch) execution = inputMatch[1];
        }

        if (!execution) {
             const scriptMatch = html.match(/["']?execution["']?\s*[:=]\s*["']([^"']+)["']/i);
             if (scriptMatch) execution = scriptMatch[1];
        }

        if (!execution) {
             const execMatch = html.match(/(e[0-9]+s[0-9]+)/); 
             if (execMatch) execution = execMatch[1];
        }

        const captchaCheck = await handleCaptchaDetection(html, sessionCookies, currentUrl);
        
        if (captchaCheck.found) {
            console.log('[Proxy] Captcha required during initial load.');
            return res.json({
                success: false,
                requireCaptcha: true,
                captchaImage: captchaCheck.image,
                message: "Security check required. Please enter code.",
                context: { sessionCookies, lt: lt || '', execution: execution || '', eventId }
            });
        }

        if (!execution) {
             const title = $('title').text() || "No Title";
             const snippet = html.substring(0, 2000).replace(/</g, '&lt;');
             console.error(`[Proxy] Parsing Failed. Title: ${title}`);
             return res.status(500).json({ 
                 success: false, 
                 error: `CAS Page Parsing Failed. System might have changed.`,
                 debugHtml: `Page Title: ${title}\n\nSnippet:\n${snippet}`
             });
        }
    }

    console.log('[Proxy] 2. Submitting credentials...');
    const params = new URLSearchParams();
    params.append('username', username);
    params.append('password', password);
    if (lt) params.append('lt', lt);
    params.append('execution', execution);
    params.append('_eventId', eventId);
    if (!params.has('button')) params.append('button', 'login'); 
    
    if (captchaCode) {
        params.append('vcode', captchaCode);
    }

    const loginResponse = await axios.post(CAS_LOGIN_URL, params.toString(), {
      headers: {
        ...BROWSER_HEADERS,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': sessionCookies,
        'Origin': 'https://passport.ustc.edu.cn',
        'Referer': CAS_LOGIN_URL
      },
      maxRedirects: 0, 
      validateStatus: (status) => status >= 200 && status < 400
    });

    const newCookies = getCookies(loginResponse);
    if (newCookies) sessionCookies += '; ' + newCookies;

    // --- HANDLE RESPONSE ---

    if (loginResponse.status === 200) {
        let html = loginResponse.data;
        
        // CHECK: Is this a success page masquerading as 200 (using JS Redirect)?
        const redirectCheck = await followPageRedirects(html, CAS_LOGIN_URL, sessionCookies, BROWSER_HEADERS);
        
        if (redirectCheck.currentUrl !== CAS_LOGIN_URL) {
            console.log('[Proxy] Login returned 200 but contained redirect (Success). Proceeding.');
            html = redirectCheck.html;
            sessionCookies = redirectCheck.sessionCookies;
            // Proceed to Step 4 logic
        } else {
            // Real Failure
            const $err = cheerio.load(html);
            let errMsg = $err('#msg').text() || $err('.errors').text() || 'Login failed.';

            const captchaCheck = await handleCaptchaDetection(html, sessionCookies, CAS_LOGIN_URL);
            
            if (captchaCheck.found) {
                const newLt = $err('input[name="lt"]').val() || lt;
                const newExec = $err('input[name="execution"]').val() || execution;
                let finalExec = newExec;
                if (!finalExec || finalExec === execution) {
                     const execMatch = html.match(/(e[0-9]+s[0-9]+)/);
                     if (execMatch) finalExec = execMatch[1];
                }

                return res.json({
                    success: false,
                    requireCaptcha: true,
                    captchaImage: captchaCheck.image,
                    message: errMsg.includes('验证') ? errMsg : "Verification code required.",
                    context: { 
                        sessionCookies, 
                        lt: newLt, 
                        execution: finalExec || execution, 
                        eventId 
                    }
                });
            }
            return res.status(401).json({ success: false, error: errMsg });
        }
    }

    if (loginResponse.status === 302) {
        const redirectUrl = loginResponse.headers['location'];
        console.log('[Proxy] 3. Login Successful. Redirecting to:', redirectUrl);

        const jwLoginResponse = await axios.get(redirectUrl, {
            headers: { 
                ...BROWSER_HEADERS,
                'Cookie': sessionCookies
            },
            maxRedirects: 0,
            validateStatus: (status) => status >= 200 && status < 400
        });
        
        const jwCookies = getCookies(jwLoginResponse);
        if (jwCookies) sessionCookies += '; ' + jwCookies;
    }

    // --- STEP 4: FETCH COURSE DATA ---
    
    console.log('[Proxy] 4. Fetching Course Data...');
    const tablePageResponse = await axios.get('https://jw.ustc.edu.cn/for-std/course-table', {
        headers: { 
            ...BROWSER_HEADERS,
            'Cookie': sessionCookies 
        }
    });

    let pageHtml = tablePageResponse.data;
    const jwRedirectResult = await followPageRedirects(pageHtml, 'https://jw.ustc.edu.cn/for-std/course-table', sessionCookies, BROWSER_HEADERS);
    pageHtml = jwRedirectResult.html;
    sessionCookies = jwRedirectResult.sessionCookies;

    const studentIdMatch = pageHtml.match(/studentId[:\s"']+(\d+)/);
    const bizTypeIdMatch = pageHtml.match(/bizTypeId[:\s"']+(\d+)/) || [null, '2'];

    if (studentIdMatch) {
        const stdId = studentIdMatch[1];
        const bizId = bizTypeIdMatch[1];
        const apiUrl = `https://jw.ustc.edu.cn/for-std/course-table/get-data?bizTypeId=${bizId}&studentId=${stdId}`;
        
        console.log(`[Proxy] Found StudentID: ${stdId}. Fetching JSON...`);
        const dataResponse = await axios.get(apiUrl, { headers: { ...BROWSER_HEADERS, 'Cookie': sessionCookies } });
        return res.json({ success: true, data: dataResponse.data });
    } 
    
    const activityMatch = pageHtml.match(/var\s+activities\s*=\s*(\[.*?\]);/s) || 
                          pageHtml.match(/activities\s*:\s*(\[.*?\])/s) ||
                          pageHtml.match(/lessonList\s*:\s*(\[.*?\])/s);
    if (activityMatch) {
        return res.json({ success: true, data: JSON.parse(activityMatch[1]) });
    }

    const $jw = cheerio.load(pageHtml);
    const title = $jw('title').text() || "No Title";
    const snippet = pageHtml.substring(0, 2000).replace(/</g, '&lt;');

    return res.status(500).json({ 
        success: false, 
        error: 'Login successful, but failed to extract schedule data from JW page.',
        debugHtml: `JW Page Title: ${title}\n\nSnippet:\n${snippet}`
    });

  } catch (error) {
    console.error('[Proxy] Error:', error.message);
    return res.status(500).json({ success: false, error: `System Error: ${error.message}` });
  }
});


// Handle SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
