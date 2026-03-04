# XSS Payload Server (CORS + JSON + PostMessage PoC)

Two exploits for bug bounty testing:

1. **JSON payload (CORS)** — Root `/` (or `/payload.json`) returns JSON with `Access-Control-Allow-Origin: *` for fetch/CORS injection (e.g. headline/feed that reflects the response into the DOM).
2. **Fox Business PostMessage PoC** — `/foxbusiness-postmessage-poc.html` serves an HTML page that opens foxbusiness.com and triggers the auth broker postMessage XSS (origin validation bypass + unsanitized avatar in `navbar.legacy`).

---

## Option 1: ngrok (local → public HTTPS)

1. **Start the server:**
   ```bash
   cd xss-payload-server && node server.js
   ```

2. **Expose with ngrok:**
   ```bash
   ngrok http 3000
   ```
   Use the `https://xxxx.ngrok-free.app` URL. Your payload is at the root, e.g.:
   `https://xxxx.ngrok-free.app/`

**Note:** Free ngrok URLs change each time you restart. For a stable URL, use a paid plan or Option 2.

---

## Option 2: Free online hosting (always-on, stable URL)

### Glitch (recommended)

1. Go to [glitch.com](https://glitch.com) → New project → Import from GitHub, or paste the code.
2. Replace `server.js` with this project’s `server.js`, and add `package.json` with `"start": "node server.js"`.
3. Glitch gives you `https://your-project.glitch.me` (HTTPS + CORS work).
4. Payload URL: `https://your-project.glitch.me/`

### Replit

1. New Repl → Node.js.
2. Paste `server.js` as `index.js` (or keep name and set run command to `node server.js`).
3. Run → Replit gives you a URL like `https://xxx.replit.app`.
4. Payload URL: `https://xxx.replit.app/`

### Vercel (serverless)

From project root:

```bash
npm i -g vercel
vercel
```

Use the generated `https://xxx.vercel.app` as the payload URL (root path).

---

## HackerOne trigger usage

- **JSON (fetch) payload URL:** base URL of the server (e.g. `https://xxx.vercel.app/` or `https://xxxx.ngrok-free.app/`). The server responds with JSON and `Access-Control-Allow-Origin: *`; if the target fetches and reflects it into the DOM without sanitization, the XSS runs.
- **Fox PostMessage PoC:** open `https://xxx.vercel.app/foxbusiness-postmessage-poc.html` (or your deployed base + `/foxbusiness-postmessage-poc.html`), allow popups, click "Launch XSS". The PoC opens foxbusiness.com and floods postMessage to trigger the avatar XSS.

---

## Restricting CORS (optional)

To allow only a specific program/domain, change in `server.js`:

```js
res.setHeader('Access-Control-Allow-Origin', 'https://target-domain.com');
```

Use `*` only for testing; restrict in real reports if the program allows.
