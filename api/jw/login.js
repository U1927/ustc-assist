
import axios from 'axios';
import * as cheerio from 'cheerio';

// Helper to parse cookies from Set-Cookie header
const getCookies = (response) => {
  const setCookie = response.headers['set-cookie'];
  if (!setCookie) return '';
  return setCookie.map(c => c.split(';')[0]).join('; ');
};

export default async function handler(req, res) {
  // 1. Set CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  // 2. Handle Preflight Options Request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 3. Validation
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'Missing credentials' });
  }

  // --- CRAWLER LOGIC ---

  const CAS_LOGIN_URL = 'https://passport.ustc.edu.cn/login?service=https%3A%2F%2Fjw.ustc.edu.cn%2Fucas-sso%2Flogin';
  let sessionCookies = '';

  try {
    // A. GET Login Page to fetch tokens (LT, execution)
    console.log('[API] 1. Fetching CAS login page...');
    const loginPage = await axios.get(CAS_LOGIN_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    sessionCookies = getCookies(loginPage);
    
    const $ = cheerio.load(loginPage.data);
    const html = loginPage.data;
    
    // --- ROBUST TOKEN EXTRACTION STRATEGY ---
    let lt = '';
    let execution = '';

    // Strategy 1: Standard Selectors
    lt = $('input[name="lt"]').val() || $('input[id="lt"]').val();
    execution = $('input[name="execution"]').val() || $('input[id="execution"]').val();

    // Strategy 2: Regex for reversed attributes (value before name) or messy HTML
    // Example: <input value="LT-xxxx" name="lt">
    if (!lt) {
        const ltValueMatch = html.match(/value=["'](LT-[^"']+)["']/);
        if (ltValueMatch) {
            lt = ltValueMatch[1];
            console.log('[API] Found LT using Regex Strategy 2 (Value Match)');
        }
    }

    // Strategy 3: Brute Force "LT-" search in text
    // USTC tickets usually start with "LT-". We look for it inside quotes.
    if (!lt) {
        const bruteMatch = html.match(/["'](LT-[a-zA-Z0-9\-\.]+)["']/);
        if (bruteMatch) {
            lt = bruteMatch[1];
            console.log('[API] Found LT using Regex Strategy 3 (Brute Force)');
        }
    }

    // Similar strategies for Execution
    if (!execution) {
         // Try finding name="execution" value="..."
         const execMatch = html.match(/name=["']execution["'][^>]*value=["'](.*?)["']/);
         if (execMatch) execution = execMatch[1];
    }
    if (!execution) {
         // Try finding generic e1s1 pattern inside quotes
         const bruteExec = html.match(/["'](e[0-9]s[0-9]+)["']/);
         if (bruteExec) {
             execution = bruteExec[1];
             console.log('[API] Found execution using Brute Force');
         }
    }

    let eventId = $('input[name="_eventId"]').val() || 'submit';

    // Validation
    if (!lt && !execution) {
      const pageTitle = $('title').text() || 'No Title';
      // Clean up body text for log
      const bodyPreview = $('body').text().substring(0, 100).replace(/\s+/g, ' ');
      console.error(`[API] Parsing Failed. Title: ${pageTitle}`);
      
      return res.status(500).json({ 
        success: false, 
        error: `登录页面解析失败。请检查是否需要验证码。\n页面标题: "${pageTitle}"` 
      });
    }

    // B. POST Credentials
    console.log('[API] 2. Submitting credentials...');
    const params = new URLSearchParams();
    params.append('username', username);
    params.append('password', password);
    
    if (lt) params.append('lt', lt);
    if (execution) params.append('execution', execution);
    
    params.append('_eventId', eventId);
    params.append('button', '');
    params.append('warn', 'true');

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

    // Check for explicit login errors in page content
    if (loginResponse.status === 200 && loginResponse.data.includes('id="loginForm"')) {
        const $err = cheerio.load(loginResponse.data);
        // Try to find the error message div
        let errMsg = $err('#msg').text() || $err('.errors').text();
        if (!errMsg && loginResponse.data.includes('验证码')) {
            errMsg = '系统检测到异常，需要输入验证码。请使用"手动导入"功能。';
        }
        return res.status(401).json({ success: false, error: errMsg || '账号或密码错误 (Invalid Credentials)' });
    }

    if (loginResponse.status !== 302) {
       return res.status(500).json({ success: false, error: `CAS 登录未重定向 (Status: ${loginResponse.status})。可能是因为需要验证码，请尝试手动导入。` });
    }

    const redirectUrl = loginResponse.headers['location'];
    console.log('[API] 3. Following redirect to:', redirectUrl);

    // C. Follow Redirect to JW System
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

    // D. Fetch the actual Schedule Data
    console.log('[API] 4. Accessing Course Table Page...');
    const tablePageResponse = await axios.get('https://jw.ustc.edu.cn/for-std/course-table', {
        headers: { 'Cookie': sessionCookies }
    });
    
    const pageHtml = tablePageResponse.data;
    const studentIdMatch = pageHtml.match(/studentId[:\s"']+(\d+)/);
    const bizTypeIdMatch = pageHtml.match(/bizTypeId[:\s"']+(\d+)/) || [null, '2'];
    
    let apiUrl = '';
    if (studentIdMatch) {
       const stdId = studentIdMatch[1];
       const bizId = bizTypeIdMatch[1];
       apiUrl = `https://jw.ustc.edu.cn/for-std/course-table/get-data?bizTypeId=${bizId}&studentId=${stdId}`;
    } else {
       // Fallback: Check for embedded JSON
       const activityMatch = pageHtml.match(/var\s+activities\s*=\s*(\[.*?\]);/s);
       if (activityMatch) {
           console.log('[API] Found embedded data in HTML.');
           try {
             const json = JSON.parse(activityMatch[1]);
             return res.json({ success: true, data: json });
           } catch(e) {}
       }
       return res.status(500).json({ success: false, error: '无法从教务页面提取数据接口。请尝试手动导入。' });
    }

    console.log('[API] 5. Fetching JSON from:', apiUrl);
    const dataResponse = await axios.get(apiUrl, {
        headers: { 'Cookie': sessionCookies }
    });

    return res.json({ success: true, data: dataResponse.data });

  } catch (error) {
    console.error('[API] Error:', error.message);
    return res.status(500).json({ success: false, error: `网络或解析错误: ${error.message}` });
  }
}
