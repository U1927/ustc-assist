
import axios from 'axios';
import * as cheerio from 'cheerio';

// Helper to parse cookies from Set-Cookie header
const getCookies = (response) => {
  const setCookie = response.headers['set-cookie'];
  if (!setCookie) return '';
  return setCookie.map(c => c.split(';')[0]).join('; ');
};

// Helper: Check for Captcha in HTML and fetch it if present
const handleCaptchaDetection = async (html, sessionCookies, baseUrl) => {
  const $ = cheerio.load(html);
  // Common selectors for CAS Captcha
  // USTC CAS usually uses id="validateImg" or src containing "validateCode"
  const captchaImg = $('#validateImg'); 
  const hasCaptcha = captchaImg.length > 0 || html.includes('validateCode');

  if (hasCaptcha) {
    let imgSrc = captchaImg.attr('src');
    if (!imgSrc && html.includes('validateCode')) {
        // Fallback regex to find src
        const match = html.match(/src="([^"]*validateCode[^"]*)"/);
        if (match) imgSrc = match[1];
    }

    if (imgSrc) {
      // Resolve relative URL
      if (!imgSrc.startsWith('http')) {
         // baseUrl is like https://passport.ustc.edu.cn/login...
         // we need the origin https://passport.ustc.edu.cn
         const origin = new URL(baseUrl).origin;
         if (imgSrc.startsWith('/')) {
            imgSrc = origin + imgSrc;
         } else {
             // very rough handling for relative without /
             imgSrc = origin + '/' + imgSrc;
         }
      }

      console.log('[API] Captcha detected. Fetching from:', imgSrc);
      
      try {
        const imgRes = await axios.get(imgSrc, {
            responseType: 'arraybuffer',
            headers: { 
                'Cookie': sessionCookies,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
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
  
  let sessionCookies = '';
  let lt = '';
  let execution = '';
  let eventId = 'submit';

  try {
    // --- STEP 1: PREPARE LOGIN CONTEXT ---
    
    if (context && context.sessionCookies && context.lt && context.execution) {
        // A. Resume from previous attempt (User submitted captcha)
        console.log('[API] Resuming session with provided context.');
        sessionCookies = context.sessionCookies;
        lt = context.lt;
        execution = context.execution;
        eventId = context.eventId || 'submit';
    } else {
        // B. New Session: Fetch Login Page
        console.log('[API] 1. Fetching CAS login page (New Session)...');
        const loginPage = await axios.get(CAS_LOGIN_URL, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        sessionCookies = getCookies(loginPage);
        const html = loginPage.data;
        const $ = cheerio.load(html);

        // Extract Tokens
        lt = $('input[name="lt"]').val() || $('input[id="lt"]').val();
        execution = $('input[name="execution"]').val() || $('input[id="execution"]').val();
        eventId = $('input[name="_eventId"]').val() || 'submit';

        // Fallbacks for Token Extraction
        if (!lt) {
            const ltMatch = html.match(/value=["'](LT-[^"']+)["']/) || html.match(/["'](LT-[a-zA-Z0-9\-\.]+)["']/);
            if (ltMatch) lt = ltMatch[1];
        }
        if (!execution) {
             const execMatch = html.match(/name=["']execution["'][^>]*value=["'](.*?)["']/) || html.match(/["'](e[0-9]s[0-9]+)["']/);
             if (execMatch) execution = execMatch[1];
        }

        if (!lt && !execution) {
             return res.status(500).json({ success: false, error: 'CAS Page Parsing Failed. System might have changed.' });
        }

        // Check for Initial Captcha (Rare, but possible)
        const captchaCheck = await handleCaptchaDetection(html, sessionCookies, CAS_LOGIN_URL);
        if (captchaCheck.found) {
            return res.json({
                success: false,
                requireCaptcha: true,
                captchaImage: captchaCheck.image,
                message: "Please enter the verification code.",
                context: { sessionCookies, lt, execution, eventId }
            });
        }
    }

    // --- STEP 2: SUBMIT CREDENTIALS ---

    console.log('[API] 2. Submitting credentials...');
    const params = new URLSearchParams();
    params.append('username', username);
    params.append('password', password);
    params.append('lt', lt);
    params.append('execution', execution);
    params.append('_eventId', eventId);
    params.append('button', ''); // Sometimes required
    
    // Add Captcha if provided
    if (captchaCode) {
        params.append('vcode', captchaCode);
    }

    const loginResponse = await axios.post(CAS_LOGIN_URL, params.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': sessionCookies,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      maxRedirects: 0, 
      validateStatus: (status) => status >= 200 && status < 400
    });

    const newCookies = getCookies(loginResponse);
    if (newCookies) sessionCookies += '; ' + newCookies;

    // --- STEP 3: HANDLE RESPONSE (Success or Failure/Captcha) ---

    // Scenario A: Login Failed (200 OK means we are still on login page)
    if (loginResponse.status === 200) {
        const html = loginResponse.data;
        const $err = cheerio.load(html);
        let errMsg = $err('#msg').text() || $err('.errors').text() || 'Login failed.';

        // Check if failure is due to Captcha (or if Captcha is now required)
        const captchaCheck = await handleCaptchaDetection(html, sessionCookies, CAS_LOGIN_URL);
        
        if (captchaCheck.found) {
            return res.json({
                success: false,
                requireCaptcha: true,
                captchaImage: captchaCheck.image,
                message: errMsg.includes('验证码') ? errMsg : "Verification code required.",
                // Important: Update context tokens if they changed on the failure page
                context: { 
                    sessionCookies, 
                    lt: $err('input[name="lt"]').val() || lt, // Usually tokens rotate
                    execution: $err('input[name="execution"]').val() || execution, 
                    eventId 
                }
            });
        }

        return res.status(401).json({ success: false, error: errMsg });
    }

    // Scenario B: Success Redirect (302)
    if (loginResponse.status === 302) {
        const redirectUrl = loginResponse.headers['location'];
        console.log('[API] 3. Login Successful. Redirecting to:', redirectUrl);

        // Follow Redirect to JW
        const jwLoginResponse = await axios.get(redirectUrl, {
            headers: { 
                'Cookie': sessionCookies,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            maxRedirects: 0,
            validateStatus: (status) => status >= 200 && status < 400
        });
        
        const jwCookies = getCookies(jwLoginResponse);
        if (jwCookies) sessionCookies += '; ' + jwCookies;

        // Fetch Data
        console.log('[API] 4. Fetching Course Data...');
        const tablePageResponse = await axios.get('https://jw.ustc.edu.cn/for-std/course-table', {
            headers: { 'Cookie': sessionCookies }
        });

        // Parse IDs to find API URL
        const pageHtml = tablePageResponse.data;
        const studentIdMatch = pageHtml.match(/studentId[:\s"']+(\d+)/);
        const bizTypeIdMatch = pageHtml.match(/bizTypeId[:\s"']+(\d+)/) || [null, '2'];

        if (studentIdMatch) {
            const stdId = studentIdMatch[1];
            const bizId = bizTypeIdMatch[1];
            const apiUrl = `https://jw.ustc.edu.cn/for-std/course-table/get-data?bizTypeId=${bizId}&studentId=${stdId}`;
            
            const dataResponse = await axios.get(apiUrl, { headers: { 'Cookie': sessionCookies } });
            return res.json({ success: true, data: dataResponse.data });
        } 
        
        // Embedded JSON Fallback
        const activityMatch = pageHtml.match(/var\s+activities\s*=\s*(\[.*?\]);/s);
        if (activityMatch) {
            return res.json({ success: true, data: JSON.parse(activityMatch[1]) });
        }

        return res.status(500).json({ success: false, error: 'Failed to extract data URL from JW page.' });
    }

    return res.status(500).json({ success: false, error: `Unexpected Status: ${loginResponse.status}` });

  } catch (error) {
    console.error('[API] Error:', error.message);
    return res.status(500).json({ success: false, error: `System Error: ${error.message}` });
  }
}
