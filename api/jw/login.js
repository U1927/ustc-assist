
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

// Helper to decode HTML entities like &amp; to &
const decodeEntities = (str) => {
  if (!str) return str;
  return str.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
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

        // 0. Check for specific markers indicating a loading/redirect page
        const isSsoPage = html.includes('id="sso_redirect"') || 
                          html.includes('id=\'sso_redirect\'') || 
                          html.includes('正在跳转') ||
                          html.includes('loading');

        // 1. Meta Refresh (High Priority standard)
        if (!redirectUrl) {
             const metaMatch = html.match(/<meta\s+http-equiv=["']refresh["']\s+content=["']\d+;\s*url=([^"']+)["']/i);
             if (metaMatch) redirectUrl = metaMatch[1];
        }

        // 2. Standard JS assignments
        if (!redirectUrl) {
            const jsAssignment = html.match(/(?:window\.|self\.|top\.)?location(?:\.href)?\s*=\s*["']([^"']+)["']/);
            const jsAssignmentTemplate = html.match(/(?:window\.|self\.|top\.)?location(?:\.href)?\s*=\s*`([^`]+)`/); // ES6 Backticks
            const jsCall = html.match(/(?:window\.|self\.|top\.)?location\.(?:replace|assign)\s*\(\s*["']([^"']+)["']\s*\)/);
            const jsCallTemplate = html.match(/(?:window\.|self\.|top\.)?location\.(?:replace|assign)\s*\(\s*`([^`]+)`\s*\)/);
            
            if (jsAssignment) redirectUrl = jsAssignment[1];
            else if (jsAssignmentTemplate) redirectUrl = jsAssignmentTemplate[1];
            else if (jsCall) redirectUrl = jsCall[1];
            else if (jsCallTemplate) redirectUrl = jsCallTemplate[1];
        }

        // 3. Nuclear Option for SSO Pages (Aggressive String Search)
        // If we are on an SSO page but regex failed, scan for ANY string that looks like a URL.
        if (!redirectUrl && isSsoPage) {
             console.log(`[API] SSO/Loading Page detected (${redirectCount}). Engaging Nuclear URL Extraction.`);
             
             // Strategy A: Find ALL quoted strings (single, double, or backticks)
             const urlPattern = /(['"`])([^\1]+?)\1/g;
             const candidates = [];
             let match;

             while ((match = urlPattern.exec(html)) !== null) {
                 const val = match[2];
                 // Filter: must look somewhat like a URL (contains / or ? or starts with http or is 'login')
                 if (val.length > 2 && (val.includes('/') || val.includes('?') || val.startsWith('http') || val === 'login')) {
                    if (isValidCandidate(val)) candidates.push(val);
                 }
             }

             // Strategy B: Find raw unquoted http/https strings
             const rawHttpPattern = /(https?:\/\/[a-zA-Z0-9\-\._~:\/?#\[\]@!$&'()*+,;=]+)/g;
             while ((match = rawHttpPattern.exec(html)) !== null) {
                 const url = match[1];
                 const cleanUrl = url.split(/["';\s]/)[0]; 
                 if (isValidCandidate(cleanUrl)) candidates.push(cleanUrl);
             }

             // Selection Logic
             // Priority 1: URLs containing keywords
             const best = candidates.find(u => u.includes('login') || u.includes('service') || u.includes('passport') || u.includes('oauth') || u.includes('sso') || u.includes('auth'));
             
             if (best) {
                 redirectUrl = best;
             } else if (candidates.length > 0) {
                 // Priority 2: First viable candidate
                 const viable = candidates.find(u => u.length > 3);
                 if (viable) redirectUrl = viable;
             }
        }

        if (!redirectUrl) break; // No redirect found

        // Decode HTML entities (important for &amp; in URLs)
        redirectUrl = decodeEntities(redirectUrl);

        // Resolve Relative URL
        if (!redirectUrl.startsWith('http')) {
            const origin = new URL(currentUrl).origin;
            if (redirectUrl.startsWith('/')) {
                // Absolute path relative to domain
                redirectUrl = origin + redirectUrl;
            } else {
                // Relative path
                const path = currentUrl.substring(0, currentUrl.lastIndexOf('/') + 1);
                redirectUrl = path + redirectUrl;
            }
        }

        // Prevent infinite loops if redirecting to self
        if (redirectUrl === currentUrl) {
             console.log('[API] Redirect loop detected (Self). Stopping.');
             break;
        }

        try {
            console.log(`[API] Following redirect (${redirectCount + 1}): ${redirectUrl}`);
            const res = await axios.get(redirectUrl, { 
                headers: { ...headers, 'Cookie': sessionCookies },
                validateStatus: status => status < 400,
                responseType: 'text' // CRITICAL: Prevent axios from parsing JSON, keep it string
            });
            
            const newCookies = getCookies(res);
            if (newCookies) sessionCookies += '; ' + newCookies;
            
            html = res.data; 
            currentUrl = redirectUrl;
            redirectCount++;
        } catch (e) {
            console.error('[API] Redirect fetch failed:', e.message);
            break;
        }
    }

    return { html, currentUrl, sessionCookies };
};

// Internal Helper for candidate filtering
function isValidCandidate(url) {
    return !url.match(/\.(css|png|jpg|jpeg|gif|ico|svg|js|woff2?|ttf|eot)$/i) &&
           !url.includes('jquery') &&
           !url.includes('axios') &&
           !url.includes('vue') &&
           !url.includes('react') &&
           !url.includes('node_modules') &&
           !url.includes('w3.org') &&
           !url.startsWith('javascript:') &&
           url.trim().length > 1;
}

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
            responseType: 'text' 
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
             const isSsoPage = html.includes('id="sso_redirect"') || html.includes('loading');
             const errorType = isSsoPage ? "Stuck on SSO Loading Page" : "Parsing Failed";
             const snippet = (html && typeof html === 'string') ? html.substring(0, 2000).replace(/</g, '&lt;') : "Invalid HTML Content";
             
             console.error(`[API] ${errorType}. Title: ${title}`);
             
             return res.status(500).json({ 
                 success: false, 
                 error: `CAS Page Parsing Failed. System returned "${title}".`,
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
      responseType: 'text'
    });

    const newCookies = getCookies(loginResponse);
    if (newCookies) sessionCookies += '; ' + newCookies;

    // --- STEP 3: HANDLE RESPONSE ---

    if (loginResponse.status === 200) {
        let html = loginResponse.data;
        
        // Check if it's actually a redirect disguised as 200
        const redirectCheck = await followPageRedirects(html, CAS_LOGIN_URL, sessionCookies, BROWSER_HEADERS);
        
        if (redirectCheck.currentUrl !== CAS_LOGIN_URL) {
            console.log('[API] Login returned 200 but contained redirect (Success). Proceeding.');
            html = redirectCheck.html;
            sessionCookies = redirectCheck.sessionCookies;
        } else {
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
    
    console.log('[API] 4. Fetching Course Data...');
    const tablePageResponse = await axios.get('https://jw.ustc.edu.cn/for-std/course-table', {
        headers: { 
            ...BROWSER_HEADERS,
            'Cookie': sessionCookies 
        },
        responseType: 'text'
    });
    
    let pageHtml = tablePageResponse.data;
    const jwRedirectResult = await followPageRedirects(pageHtml, 'https://jw.ustc.edu.cn/for-std/course-table', sessionCookies, BROWSER_HEADERS);
    pageHtml = jwRedirectResult.html;
    sessionCookies = jwRedirectResult.sessionCookies;

    // --- STEP 4.2: Parse Data ---
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
    
    const activityMatch = pageHtml.match(/var\s+activities\s*=\s*(\[.*?\]);/s) || 
                            pageHtml.match(/activities\s*:\s*(\[.*?\])/s) ||
                            pageHtml.match(/lessonList\s*:\s*(\[.*?\])/s);

    if (activityMatch) {
            console.log('[API] Found course data in script variable.');
            return res.json({ success: true, data: JSON.parse(activityMatch[1]) });
    }

    const $jw = cheerio.load(pageHtml);
    const title = $jw('title').text() || "No Title";
    const snippet = (pageHtml && typeof pageHtml === 'string') ? pageHtml.substring(0, 2000).replace(/</g, '&lt;') : "Invalid Content";
    
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
