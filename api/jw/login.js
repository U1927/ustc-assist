
import axios from 'axios';
import * as cheerio from 'cheerio';

// 1. 模拟浏览器的请求头
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const HEADERS = {
  'User-Agent': USER_AGENT,
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'zh-CN,zh;q=0.9',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1'
};

// 工具：解析 Set-Cookie
const getCookies = (response) => {
  const setCookie = response.headers['set-cookie'];
  if (!setCookie) return '';
  return setCookie.map(c => c.split(';')[0]).join('; ');
};

// 工具：处理 HTML 转义字符
const decodeEntities = (str) => {
  if (!str) return str;
  return str.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x2F;/g, "/");
};

/**
 * 核心逻辑：模拟浏览器跟随重定向
 */
const followRedirects = async (url, cookies) => {
  let currentUrl = url;
  let sessionCookies = cookies;
  let html = '';
  
  for (let i = 0; i < 15; i++) {
    try {
        const res = await axios.get(currentUrl, {
            headers: { ...HEADERS, 'Cookie': sessionCookies },
            maxRedirects: 0, 
            validateStatus: s => s < 500
        });

        const newCookies = getCookies(res);
        if (newCookies) sessionCookies += '; ' + newCookies;
        
        html = res.data;

        if (res.status === 302 || res.status === 301) {
            let nextLoc = res.headers['location'];
            if (!nextLoc.startsWith('http')) {
                const origin = new URL(currentUrl).origin;
                nextLoc = new URL(nextLoc, origin).href;
            }
            currentUrl = nextLoc;
            continue;
        }

        if (typeof html === 'string') {
             const meta = html.match(/<meta\s+http-equiv=["']refresh["']\s+content=["']\d+;\s*url=([^"']+)["']/i);
             if (meta) { currentUrl = decodeEntities(meta[1]); continue; }
             
             const js = html.match(/(?:location\.href|location\.replace)\s*[=(]\s*['"]([^'"]+)['"]/i);
             if (js) { currentUrl = decodeEntities(js[1]); continue; }
        }
        
        break;
    } catch (e) {
        if (e.response && (e.response.status === 302 || e.response.status === 301)) {
             const newCookies = getCookies(e.response);
             if (newCookies) sessionCookies += '; ' + newCookies;
             let nextLoc = e.response.headers['location'];
             if (!nextLoc.startsWith('http')) {
                const origin = new URL(currentUrl).origin;
                nextLoc = new URL(nextLoc, origin).href;
             }
             currentUrl = nextLoc;
             continue;
        }
        throw e;
    }
  }
  return { html, cookies: sessionCookies, currentUrl };
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { username, password, captchaCode, context, mode } = req.body;
  if (!username || !password) return res.status(400).json({ success: false, error: '请输入账号和密码' });

  // 1. CAS Login Entry
  const CAS_LOGIN_URL = 'https://passport.ustc.edu.cn/login?service=https%3A%2F%2Fjw.ustc.edu.cn%2Fucas-sso%2Flogin';

  try {
    let sessionCookies = '';
    let lt = '', execution = '';

    // --- STEP 1: Init CAS ---
    if (context) {
        sessionCookies = context.sessionCookies;
        lt = context.lt;
        execution = context.execution;
    } else {
        const init = await followRedirects(CAS_LOGIN_URL, '');
        sessionCookies = init.cookies;
        const $ = cheerio.load(init.html);
        lt = $('input[name="lt"]').val();
        execution = $('input[name="execution"]').val();

        if ($('#validateImg').length > 0 || init.html.includes('validateCode')) {
             return res.json({ 
                 success: false, 
                 requireCaptcha: true, 
                 message: "检测到安全验证，请输入验证码",
                 captchaImage: 'https://passport.ustc.edu.cn/validatecode.jsp?type=login' 
             });
        }
    }

    // --- STEP 2: Submit Login ---
    const params = new URLSearchParams();
    params.append('username', username);
    params.append('password', password);
    params.append('lt', lt);
    params.append('execution', execution);
    params.append('_eventId', 'submit');
    params.append('button', 'login');
    if (captchaCode) params.append('vcode', captchaCode);

    const loginRes = await axios.post(CAS_LOGIN_URL, params.toString(), {
        headers: { 
            ...HEADERS,
            'Content-Type': 'application/x-www-form-urlencoded',
            'Cookie': sessionCookies 
        },
        maxRedirects: 0,
        validateStatus: s => s < 500
    });
    
    const newCookies = getCookies(loginRes);
    if (newCookies) sessionCookies += '; ' + newCookies;

    if (loginRes.status === 200 && (loginRes.data.includes('id="msg"') || loginRes.data.includes('class="login"'))) {
         const $fail = cheerio.load(loginRes.data);
         const msg = $fail('#msg').text() || "登录失败，请检查账号密码";
         return res.status(401).json({ success: false, error: msg });
    }

    // ============================================================
    // CRITICAL CHANGE: Authentication Only Mode
    // If user just wants to verify identity (register), stop here!
    // ============================================================
    if (mode === 'auth') {
        console.log(`[API] Auth success for ${username}. Mode is 'auth', skipping data fetch.`);
        return res.json({ success: true, message: "身份验证通过" });
    }


    // --- STEP 3: JW (First Classroom) ---
    // Only proceed if mode is NOT 'auth' (default or 'fetch')
    
    // Follow redirect to jw.ustc.edu.cn to establish session
    const jwResult = await followRedirects(CAS_LOGIN_URL, sessionCookies); 
    const jwHtml = jwResult.html;
    sessionCookies = jwResult.cookies; // Keep the updated cookies (contains JSESSIONID for JW)

    // Extract JW Data (Regex)
    let jwData = null;
    const vmMatch = jwHtml.match(/var\s+studentTableVm\s*=\s*(\{.*?\});/s);
    if (vmMatch) {
        try {
            const vm = JSON.parse(vmMatch[1]);
            jwData = vm.activities || vm.lessons || [];
        } catch(e) {}
    }
    if (!jwData) {
        const actMatch = jwHtml.match(/var\s+activities\s*=\s*(\[.*?\]);/s) || 
                         jwHtml.match(/lessonList\s*:\s*(\[.*?\])/s);
        if (actMatch) {
            try { jwData = JSON.parse(actMatch[1]); } catch(e) {}
        }
    }

    // --- STEP 4: Young (Second Classroom) ---
    let youngData = [];
    try {
        console.log("Attempting to fetch Second Classroom data...");
        const youngService = 'http://young.ustc.edu.cn/uaa/cas/login';
        const youngCasUrl = `https://passport.ustc.edu.cn/login?service=${encodeURIComponent(youngService)}`;
        
        const youngLoginResult = await followRedirects(youngCasUrl, sessionCookies);
        const youngCookies = youngLoginResult.cookies; 

        const youngScheduleUrl = 'http://young.ustc.edu.cn/bg/activity/my-activity-list'; 
        const youngRes = await axios.get(youngScheduleUrl, {
            headers: { ...HEADERS, 'Cookie': youngCookies }
        });

        const $young = cheerio.load(youngRes.data);
        const rows = $young('table tbody tr');
        
        if (rows.length > 0) {
            rows.each((i, el) => {
                const cols = $young(el).find('td');
                if (cols.length >= 3) {
                    const name = $(cols[0]).text().trim(); 
                    const timeStr = $(cols[1]).text().trim() || $(cols[2]).text().trim(); 
                    const place = $(cols[2]).text().trim() || $(cols[3]).text().trim(); 

                    const timeMatch = timeStr.match(/(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})/g);
                    let start = '', end = '';
                    if (timeMatch && timeMatch.length >= 1) start = timeMatch[0];
                    if (timeMatch && timeMatch.length >= 2) end = timeMatch[1];

                    if (name && start) {
                        youngData.push({
                            name: name,
                            place: place,
                            startTime: start,
                            endTime: end || start, 
                            description: "From Second Classroom (Parsed)"
                        });
                    }
                }
            });
        } 
        if (youngData.length === 0 && typeof youngRes.data === 'object') {
             youngData = youngRes.data.rows || youngRes.data; 
        }

    } catch (e) {
        console.error("Second Classroom Fetch Failed:", e.message);
    }

    if (!jwData) jwData = [];

    return res.json({
        success: true,
        data: {
            firstClassroom: jwData,
            secondClassroom: youngData
        }
    });

  } catch (error) {
    console.error("Handler Error:", error);
    return res.status(500).json({ success: false, error: "服务器错误: " + error.message });
  }
}
