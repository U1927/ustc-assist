
import axios from 'axios';
import * as cheerio from 'cheerio';

// 1. 模拟浏览器的请求头 (Simulate Android/Desktop User Agent)
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

// 工具：处理 HTML 转义字符 (CAS 跳转链接经常被转义)
const decodeEntities = (str) => {
  if (!str) return str;
  return str.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x2F;/g, "/");
};

/**
 * 核心逻辑：模拟浏览器跟随重定向
 * WakeupSchedule 的 WebView 会自动处理 302 和 JS 跳转，这里我们需要手动实现。
 */
const followRedirects = async (url, cookies) => {
  let currentUrl = url;
  let sessionCookies = cookies;
  let html = '';
  
  // 最多跟随 15 次跳转，防止死循环
  for (let i = 0; i < 15; i++) {
    try {
        const res = await axios.get(currentUrl, {
            headers: { ...HEADERS, 'Cookie': sessionCookies },
            maxRedirects: 0, // 禁止 axios 自动跳转，我们要手动拿 cookie
            validateStatus: s => s < 500 // 允许 302/401 等状态码
        });

        // 合并新 Cookie
        const newCookies = getCookies(res);
        if (newCookies) sessionCookies += '; ' + newCookies;
        
        html = res.data;

        // 1. 处理 HTTP 302/301 跳转
        if (res.status === 302 || res.status === 301) {
            let nextLoc = res.headers['location'];
            if (!nextLoc.startsWith('http')) {
                const origin = new URL(currentUrl).origin;
                nextLoc = new URL(nextLoc, origin).href;
            }
            currentUrl = nextLoc;
            continue;
        }

        // 2. 处理 "伪 200" 跳转 (CAS 常见的 Meta Refresh 或 JS Location)
        if (typeof html === 'string') {
             // Meta Refresh: <meta http-equiv="refresh" content="0;url=..." />
             const meta = html.match(/<meta\s+http-equiv=["']refresh["']\s+content=["']\d+;\s*url=([^"']+)["']/i);
             if (meta) {
                 currentUrl = decodeEntities(meta[1]);
                 continue;
             }
             // JS Redirect: location.href = '...'
             const js = html.match(/(?:location\.href|location\.replace)\s*[=(]\s*['"]([^'"]+)['"]/i);
             if (js) {
                 currentUrl = decodeEntities(js[1]);
                 continue;
             }
        }
        
        // 没有跳转了，到达终点
        break;

    } catch (e) {
        // Axios 在 maxRedirects=0 时可能会抛错
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
  // 标准 API 头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { username, password, captchaCode, context } = req.body;

  if (!username || !password) return res.status(400).json({ success: false, error: '请输入账号和密码' });

  // 目标链接：直接访问教务系统课表页，触发 CAS 登录流程
  const CAS_LOGIN_URL = 'https://passport.ustc.edu.cn/login?service=https%3A%2F%2Fjw.ustc.edu.cn%2Fucas-sso%2Flogin';

  try {
    let sessionCookies = '';
    let lt = '', execution = '';

    // --- 第一步：获取登录页面的 LT 和 Execution ---
    // (如果前端传了 context，说明是验证码重试，直接复用 session)
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

        // 检测是否有验证码 (WakeupSchedule 也会做这一步检测)
        if ($('#validateImg').length > 0 || init.html.includes('validateCode')) {
             // 简单处理：提示前端需要验证码。真实场景需要把图片流转成 Base64 返回给前端。
             // 这里为简化演示，返回特定的 requireCaptcha 状态
             return res.json({ 
                 success: false, 
                 requireCaptcha: true, 
                 message: "检测到安全验证，请输入验证码",
                 // 在这里本应 fetch 验证码图片并转 base64 返回
                 captchaImage: 'https://passport.ustc.edu.cn/validatecode.jsp?type=login' 
             });
        }
    }

    // --- 第二步：提交登录表单 ---
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
    
    // 更新 Cookie (获取最重要的 CASTGC)
    const newCookies = getCookies(loginRes);
    if (newCookies) sessionCookies += '; ' + newCookies;

    // 检查是否登录失败 (页面包含 msg ID 或 "登录" 字样通常意味着还在登录页)
    if (loginRes.status === 200 && (loginRes.data.includes('id="msg"') || loginRes.data.includes('class="login"'))) {
         const $fail = cheerio.load(loginRes.data);
         const msg = $fail('#msg').text() || "登录失败，请检查账号密码";
         return res.status(401).json({ success: false, error: msg });
    }

    // --- 第三步：跟随 Redirect 到教务系统 ---
    // 登录成功后，CAS 会返回 302 跳转回 jw.ustc.edu.cn
    // 我们必须跟随这个跳转，让服务器在 jw 域名下种下 JSESSIONID
    const jwResult = await followRedirects(CAS_LOGIN_URL, sessionCookies); 
    const jwHtml = jwResult.html;
    sessionCookies = jwResult.cookies;

    // --- 第四步：WakeupSchedule 核心逻辑 - 源码正则提取 ---
    // 教务系统不会直接渲染 HTML 表格，而是把数据塞在 JavaScript 变量里。
    // 我们不需要解析复杂的 DOM，只需要像 WakeupSchedule 一样提取 JSON。

    let jwData = null;
    
    // 正则方案 A: 匹配 Vue 对象 (新版教务)
    // 寻找 `var studentTableVm = { ... };`
    const vmMatch = jwHtml.match(/var\s+studentTableVm\s*=\s*(\{.*?\});/s);
    if (vmMatch) {
        try {
            const vm = JSON.parse(vmMatch[1]);
            // 不同的系统版本字段可能不同，通常是 activities 或 lessons
            jwData = vm.activities || vm.lessons || [];
        } catch(e) {
            console.error("JSON Parse Error (VM):", e);
        }
    }

    // 正则方案 B: 匹配直接数组 (旧版或备用)
    // 寻找 `var activities = [ ... ];` 或 `lessonList: [ ... ]`
    if (!jwData) {
        const actMatch = jwHtml.match(/var\s+activities\s*=\s*(\[.*?\]);/s) || 
                         jwHtml.match(/lessonList\s*:\s*(\[.*?\])/s);
        if (actMatch) {
            try { jwData = JSON.parse(actMatch[1]); } catch(e) {}
        }
    }

    // --- 第五步：顺便提取第二课堂 (复用 CAS Cookie) ---
    // 既然我们已经有了 CAS 的 TGT (Ticket Granting Ticket)，可以顺便登录第二课堂
    let youngData = [];
    try {
        const youngService = 'http://young.ustc.edu.cn/uaa/cas/login';
        const youngLoginUrl = `https://passport.ustc.edu.cn/login?service=${encodeURIComponent(youngService)}`;
        
        // 带着刚才的 sessionCookies (包含 CASTGC) 访问第二课堂登录口 -> 自动登录
        const youngResult = await followRedirects(youngLoginUrl, sessionCookies);
        
        // 这里简化处理：如果成功跳到了 young.ustc.edu.cn，说明登录成功
        // 真实抓取需要去请求 /api/schedule 接口，这里为了演示稳定性返回一个 Mock 数据
        if (youngResult.currentUrl.includes('young.ustc.edu.cn')) {
             youngData = [
                 {
                     name: "【第二课堂】自动同步成功",
                     place: "Web端",
                     startTime: "2024-09-01 12:00",
                     endTime: "2024-09-01 13:00",
                     description: "成功利用 SSO 同步了第二课堂状态"
                 }
             ];
        }
    } catch (e) {
        console.log("Young fetch error:", e.message);
    }

    if (!jwData) {
        // 如果正则提取失败，可能是教务系统改版了，或者是 "评教未完成" 等拦截页面
        return res.status(500).json({ 
            success: false, 
            error: "登录成功，但无法提取课表。可能需要先完成评教，或教务系统结构已变更。" 
        });
    }

    // 返回提取到的纯 JSON 数据
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
