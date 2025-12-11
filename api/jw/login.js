
import axios from 'axios';
import * as cheerio from 'cheerio';

// Helper to parse cookies from Set-Cookie header
const getCookies = (response) => {
  const setCookie = response.headers['set-cookie'];
  if (!setCookie) return '';
  // Axios returns array for set-cookie
  return setCookie.map(c => c.split(';')[0]).join('; ');
};

// Helper: Check for Captcha in HTML and fetch it if present
const handleCaptchaDetection = async (html, sessionCookies, baseUrl) => {
  if (typeof html !== 'string') return { found: false };

  const $ = cheerio.load(html);
  
  // 1. Detect Captcha Elements
  let captchaImg = $('#validateImg'); 
  let hasCaptcha = captchaImg.length > 0 || html.includes('validateCode') || html.includes('vcode');

  let imgSrc = '';

  if (hasCaptcha) {
    imgSrc = captchaImg.attr('src');
    
    // Fallback: Regex to find src if cheerio failed or dynamic
    if (!imgSrc) {
        const match = html.match(/src=["']([^"']*validateCode[^"']*)["']/i) || html.match(/src=["']([^"']*vcode[^"']*)["']/i);
        if (match) imgSrc = match[1];
    }

    if (imgSrc) {
      // Resolve relative URL
      if (!imgSrc.startsWith('http')) {
         const origin = new URL(baseUrl).origin;
         if (imgSrc.startsWith('/')) {
            imgSrc = origin + imgSrc;
         } else {
             imgSrc = origin + '/' + imgSrc;
         }
      }

      console.log('[API] Captcha detected. Fetching from:', imgSrc);
      
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
        console.error("[API] Failed to fetch captcha image:", e.message);
      }
    }
  }
  return { found: false };
};

// Helper: Detect and follow manual redirects (Meta Refresh, JS, SSO Loading Pages)
const followPageRedirects = async (initialHtml, initialUrl, cookies, headers) => {
    let html = typeof initialHtml === 'string' ? initialHtml : '';
    let currentUrl = initialUrl;
    let sessionCookies = cookies;
    let redirectCount = 0;
    const MAX_REDIRECTS = 10; 

    while (redirectCount < MAX_REDIRECTS) {
        let redirectUrl = null;

        if (typeof html !== 'string') {
             console.log('[API] HTML is not string, stopping redirect check.');
             break;
        }

        // 1. Check for specific USTC SSO / Loading Page markers
        if (html.includes('id="sso_redirect"') || html.includes('id=\'sso_redirect\'')) {
             console.log(`[API] USTC SSO Loading Page detected (${redirectCount})`);
             // Extract URL from script
             // Look for simple location assignment: location.href = "..."
             let match = html.match(/(?:location\.href|window\.location)\s*=\s*['"]([^'"]+)['"]/);
             if (!match) match = html.match(/location\.replace\(['"]([^'"]+)['"]\)/);
             
             if (match) {
                 redirectUrl = match[1];
             } else {
                 // Fallback: look for the service URL specifically (safer than generic https match)
                 // Matches https://jw.ustc.edu.cn/ucas-sso/login or similar service URLs
                 const serviceMatch = html.match(/['"](https?:\/\/[^'"]+(?:login|service|sso)[^'"]*)['"]/i);
                 if (serviceMatch) redirectUrl = serviceMatch[1];

                 // Desperate Fallback: Find ANY http link inside a script tag
                 if (!redirectUrl) {
                     const anyLinkMatch = html.match(/<script[^>]*>.*?['"](https?:\/\/[^'"]+)['"].*?<\/script>/s);
                     if (anyLinkMatch) {
                         // Filter out common libs
                         const candidate = anyLinkMatch[1];
                         if (!candidate.includes('jquery') && !candidate.includes('vue') && !candidate.includes('react')) {
                             redirectUrl = candidate;
                         }
                     }
                 }
             }
        }

        // 2. Meta Refresh
        if (!redirectUrl) {
            const metaMatch = html.match(/<meta\s+http-equiv=["']refresh["']\s+content=["']\d+;\s*url=([^"']+)["']/i);
            if (metaMatch) {
                redirectUrl = metaMatch[1];
                console.log(`[API] Meta Refresh detected.`);
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
            console.log(`[API] Following redirect (${redirectCount + 1}): ${redirectUrl}`);
            const res = await axios.get(redirectUrl, { 
                headers: { ...headers, 'Cookie': sessionCookies },
                validateStatus: status => status < 400,
                responseType: 'text' // CRITICAL: Prevent axios from parsing JSON, keep it string
            });
            
            const newCookies = getCookies(res);
            if (newCookies) sessionCookies += '; ' + newCookies;
            
            html = res.data; // Now guaranteed to be string (or empty)
            currentUrl = redirectUrl;
            redirectCount++;
        } catch (e) {
            console.error('[API] Redirect fetch failed:', e.message);
            break;
        }
    }

    return { html, currentUrl, sessionCookies };
};

export default async function handler(req, res) {
  // 1. Set CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method Not Allowed' });

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
    // --- STEP 1: PREPARE LOGIN CONTEXT ---
    
    if (context && context.sessionCookies && context.execution) {
        // A. Resume from previous attempt
        console.log('[API] Resuming session with provided context.');
        sessionCookies = context.sessionCookies;
        lt = context.lt || ''; 
        execution = context.execution;
        eventId = context.eventId || 'submit';
    } else {
        // B. New Session: Fetch Login Page
        console.log('[API] 1. Fetching CAS login page (New Session)...');
        let loginPage = await axios.get(CAS_LOGIN_URL, { 
            headers: BROWSER_HEADERS,
            responseType: 'text' // Force text to avoid object crash
        });
        
        sessionCookies = getCookies(loginPage);
        let html = loginPage.data;
        let currentUrl = CAS_LOGIN_URL;

        // --- HANDLE PAGE REDIRECTS (WAF/SPA/Meta Refresh) ---
        const redirectResult = await followPageRedirects(html, currentUrl, sessionCookies, BROWSER_HEADERS);
        html = redirectResult.html;
        currentUrl = redirectResult.currentUrl;
        sessionCookies = redirectResult.sessionCookies;

        const $ = cheerio.load(html);

        // 1. Extract Tokens (Standard Selectors)
        lt = $('input[name="lt"]').val() || $('input[id="lt"]').val();
        execution = $('input[name="execution"]').val() || $('input[id="execution"]').val();
        eventId = $('input[name="_eventId"]').val() || 'submit';

        // 2. Fallback: Robust Greedy Regex
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
            // Find inputs with name="execution"
            const inputRegex = /<input[^>]*name=["']execution["'][^>]*value=["']([^"']+)["']/i;
            const inputRegexRev = /<input[^>]*value=["']([^"']+)["'][^>]*name=["']execution["']/i;
            const inputMatch = html.match(inputRegex) || html.match(inputRegexRev);
            if (inputMatch) execution = inputMatch[1];
        }

        if (!execution) {
             // Look for JS variables often used in SPA logins
             const scriptMatch = html.match(/["']?execution["']?\s*[:=]\s*["']([^"']+)["']/i);
             if (scriptMatch) execution = scriptMatch[1];
        }

        if (!execution) {
             // Desperate regex for e1s1 style tokens
             const execMatch = html.match(/(e[0-9]+s[0-9]+)/); 
             if (execMatch) execution = execMatch[1];
        }
        
        // 3. Early Captcha Check
        const captchaCheck = await handleCaptchaDetection(html, sessionCookies, currentUrl);
        
        if (captchaCheck.found) {
            console.log('[API] Captcha required during initial load.');
            return res.json({
                success: false,
                requireCaptcha: true,
                captchaImage: captchaCheck.image,
                message: "Security check required. Please enter code.",
                context: { sessionCookies, lt: lt || '', execution: execution || '', eventId }
            });
        }

        // 4. Critical Token Validation
        if (!execution) {
             const title = $('title').text() || "No Title Found";
             const snippet = (html && typeof html === 'string') ? html.substring(0, 2000).replace(/</g, '&lt;') : "Invalid HTML Content";
             console.error(`[API] Parsing Failed. Title: ${title}`);
             
             return res.status(500).json({ 
                 success: false, 
                 error: `CAS Page Parsing Failed. The page might be blocked or changed.`,
                 debugHtml: `Page Title: ${title}\n\nHTML Snippet (Top 2k chars):\n${snippet}`
             });
        }
    }

    // --- STEP 2: SUBMIT CREDENTIALS ---

    console.log('[API] 2. Submitting credentials...');
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
      validateStatus: (status) => status >= 200 && status < 400,
      responseType: 'text' // Force text
    });

    const newCookies = getCookies(loginResponse);
    if (newCookies) sessionCookies += '; ' + newCookies;

    // --- STEP 3: HANDLE RESPONSE ---

    if (loginResponse.status === 200) {
        let html = loginResponse.data;
        
        // CHECK: Is this a success page masquerading as 200 (using JS Redirect)?
        // If it contains #sso_redirect, it's actually successful and proceeding to next step
        const redirectCheck = await followPageRedirects(html, CAS_LOGIN_URL, sessionCookies, BROWSER_HEADERS);
        
        if (redirectCheck.currentUrl !== CAS_LOGIN_URL) {
            console.log('[API] Login returned 200 but contained redirect (Success). Proceeding.');
            // Update state to point to where we landed (likely JW Middleware)
            html = redirectCheck.html;
            sessionCookies = redirectCheck.sessionCookies;
        } else {
            // It's a real 200 Failure (Error Page or Captcha Page)
            const $err = cheerio.load(html);
            let errMsg = $err('#msg').text() || $err('.errors').text() || 'Login failed.';

            // Check if verification error
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
        console.log('[API] 3. Login Successful (302). Redirecting to:', redirectUrl);

        const jwLoginResponse = await axios.get(redirectUrl, {
            headers: { 
                ...BROWSER_HEADERS,
                'Cookie': sessionCookies
            },
            maxRedirects: 0,
            validateStatus: (status) => status >= 200 && status < 400,
            responseType: 'text'
        });
        
        const jwCookies = getCookies(jwLoginResponse);
        if (jwCookies) sessionCookies += '; ' + jwCookies;
    }

    // --- STEP 4: FETCH COURSE DATA ---
    // Whether we came from 302 or 200-redirect, we assume we are logged in now.
    
    console.log('[API] 4. Fetching Course Data...');
    const tablePageResponse = await axios.get('https://jw.ustc.edu.cn/for-std/course-table', {
        headers: { 
            ...BROWSER_HEADERS,
            'Cookie': sessionCookies 
        },
        responseType: 'text' // Force text
    });
    
    // --- STEP 4.1: Handle JW Redirects (Loading screens, #sso_redirect, etc) ---
    // This is the critical part that was failing before
    let pageHtml = tablePageResponse.data;
    const jwRedirectResult = await followPageRedirects(pageHtml, 'https://jw.ustc.edu.cn/for-std/course-table', sessionCookies, BROWSER_HEADERS);
    pageHtml = jwRedirectResult.html;
    sessionCookies = jwRedirectResult.sessionCookies;

    // --- STEP 4.2: Parse Data ---
    // Strategy A: Find StudentID and call API
    const studentIdMatch = pageHtml.match(/studentId[:\s"']+(\d+)/);
    const bizTypeIdMatch = pageHtml.match(/bizTypeId[:\s"']+(\d+)/) || [null, '2'];

    if (studentIdMatch) {
        const stdId = studentIdMatch[1];
        const bizId = bizTypeIdMatch[1];
        const apiUrl = `https://jw.ustc.edu.cn/for-std/course-table/get-data?bizTypeId=${bizId}&studentId=${stdId}`;
        
        console.log(`[API] Found StudentID: ${stdId}. Fetching JSON...`);
        const dataResponse = await axios.get(apiUrl, { headers: { ...BROWSER_HEADERS, 'Cookie': sessionCookies } });
        return res.json({ success: true, data: dataResponse.data });
    } 
    
    // Strategy B: Find embedded JSON in script tags
    const activityMatch = pageHtml.match(/var\s+activities\s*=\s*(\[.*?\]);/s) || 
                            pageHtml.match(/activities\s*:\s*(\[.*?\])/s) ||
                            pageHtml.match(/lessonList\s*:\s*(\[.*?\])/s);

    if (activityMatch) {
            console.log('[API] Found course data in script variable.');
            return res.json({ success: true, data: JSON.parse(activityMatch[1]) });
    }

    // --- FAILURE DEBUGGING ---
    const $jw = cheerio.load(pageHtml);
    const title = $jw('title').text() || "No Title";
    const snippet = (pageHtml && typeof pageHtml === 'string') ? pageHtml.substring(0, 2000).replace(/</g, '&lt;') : "Invalid Content";
    
    console.error(`[API] JW Parsing Failed. Title: ${title}`);

    return res.status(500).json({ 
        success: false, 
        error: 'Login successful, but failed to extract schedule data from JW page.',
        debugHtml: `JW Page Title: ${title}\n\nSnippet:\n${snippet}`
    });

  } catch (error) {
    console.error('[API] Error:', error.message);
    return res.status(500).json({ success: false, error: `System Error: ${error.message}` });
  }
}
