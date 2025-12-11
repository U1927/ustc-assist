
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
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
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

// Real login implementation
app.post('/api/jw/login', async (req, res) => {
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
    if (context && context.sessionCookies && context.execution) {
        console.log('[Proxy] Resuming session with provided context.');
        sessionCookies = context.sessionCookies;
        lt = context.lt || '';
        execution = context.execution;
        eventId = context.eventId || 'submit';
    } else {
        console.log('[Proxy] 1. Fetching CAS login page...');
        const loginPage = await axios.get(CAS_LOGIN_URL, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        sessionCookies = getCookies(loginPage);
        const html = loginPage.data;
        const $ = cheerio.load(html);

        lt = $('input[name="lt"]').val() || $('input[id="lt"]').val();
        execution = $('input[name="execution"]').val() || $('input[id="execution"]').val();
        eventId = $('input[name="_eventId"]').val() || 'submit';

        // 2. Fallback: Robust Greedy Regex for Tokens
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
             const execMatch = html.match(/(e[0-9]+s[0-9]+)/); 
             if (execMatch) execution = execMatch[1];
        }

        const captchaCheck = await handleCaptchaDetection(html, sessionCookies, CAS_LOGIN_URL);
        
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
             const snippet = html.substring(0, 1000).replace(/</g, '&lt;');
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
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': sessionCookies,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      maxRedirects: 0, 
      validateStatus: (status) => status >= 200 && status < 400
    });

    const newCookies = getCookies(loginResponse);
    if (newCookies) sessionCookies += '; ' + newCookies;

    if (loginResponse.status === 200) {
        const html = loginResponse.data;
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

    if (loginResponse.status === 302) {
        const redirectUrl = loginResponse.headers['location'];
        console.log('[Proxy] 3. Login Successful. Redirecting to:', redirectUrl);

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

        console.log('[Proxy] 4. Fetching Course Data...');
        const tablePageResponse = await axios.get('https://jw.ustc.edu.cn/for-std/course-table', {
            headers: { 'Cookie': sessionCookies }
        });

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
        
        const activityMatch = pageHtml.match(/var\s+activities\s*=\s*(\[.*?\]);/s);
        if (activityMatch) {
            return res.json({ success: true, data: JSON.parse(activityMatch[1]) });
        }

        return res.status(500).json({ success: false, error: 'Login successful, but failed to extract schedule data from JW page.' });
    }

    return res.status(500).json({ success: false, error: `Unexpected Status: ${loginResponse.status}` });

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
