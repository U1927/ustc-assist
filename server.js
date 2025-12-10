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

// Real login implementation
app.post('/api/jw/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'Missing credentials' });
  }

  const CAS_LOGIN_URL = 'https://passport.ustc.edu.cn/login?service=https%3A%2F%2Fjw.ustc.edu.cn%2Fucas-sso%2Flogin';
  // const JW_DATA_URL = 'https://jw.ustc.edu.cn/for-std/course-table'; 

  let sessionCookies = '';

  try {
    // 1. GET Login Page to fetch tokens (LT, execution)
    console.log('[Proxy] 1. Fetching CAS login page...');
    const loginPage = await axios.get(CAS_LOGIN_URL);
    sessionCookies = getCookies(loginPage);
    
    const $ = cheerio.load(loginPage.data);
    const lt = $('input[name="lt"]').val();
    const execution = $('input[name="execution"]').val();
    const eventId = $('input[name="_eventId"]').val() || 'submit';

    if (!lt) {
      return res.status(500).json({ success: false, error: 'Failed to parse Login Ticket (LT). CAS might have changed.' });
    }

    // 2. POST Credentials
    console.log('[Proxy] 2. Submitting credentials...');
    const params = new URLSearchParams();
    params.append('username', username);
    params.append('password', password);
    params.append('lt', lt);
    params.append('execution', execution);
    params.append('_eventId', eventId);
    params.append('button', '');

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

    if (loginResponse.status === 200 && loginResponse.data.includes('id="loginForm"')) {
        const $err = cheerio.load(loginResponse.data);
        const errMsg = $err('#msg').text() || 'Invalid credentials or Captcha required.';
        return res.status(401).json({ success: false, error: errMsg });
    }

    if (loginResponse.status !== 302) {
       return res.status(500).json({ success: false, error: 'CAS did not redirect. Login flow unexpected.' });
    }

    const redirectUrl = loginResponse.headers['location'];
    console.log('[Proxy] 3. Following redirect to:', redirectUrl);

    // 3. Follow Redirect to JW System
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

    // 4. Fetch the actual Schedule Data
    console.log('[Proxy] 4. Accessing Course Table Page...');
    const tablePageResponse = await axios.get('https://jw.ustc.edu.cn/for-std/course-table', {
        headers: { 'Cookie': sessionCookies }
    });
    
    const html = tablePageResponse.data;
    const studentIdMatch = html.match(/studentId[:\s"']+(\d+)/);
    const bizTypeIdMatch = html.match(/bizTypeId[:\s"']+(\d+)/) || [null, '2'];
    
    let apiUrl = '';
    if (studentIdMatch) {
       const stdId = studentIdMatch[1];
       const bizId = bizTypeIdMatch[1];
       apiUrl = `https://jw.ustc.edu.cn/for-std/course-table/get-data?bizTypeId=${bizId}&studentId=${stdId}`;
    } else {
       const activityMatch = html.match(/var\s+activities\s*=\s*(\[.*?\]);/s);
       if (activityMatch) {
           console.log('[Proxy] Found embedded data in HTML.');
           try {
             const json = JSON.parse(activityMatch[1]);
             return res.json({ success: true, data: json });
           } catch(e) {}
       }
       return res.status(500).json({ success: false, error: 'Could not extract Course Data API URL from JW page.' });
    }

    console.log('[Proxy] 5. Fetching JSON from:', apiUrl);
    const dataResponse = await axios.get(apiUrl, {
        headers: { 'Cookie': sessionCookies }
    });

    return res.json({ success: true, data: dataResponse.data });

  } catch (error) {
    console.error('[Proxy] Error:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
});


// Handle SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
