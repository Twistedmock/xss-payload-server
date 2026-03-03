# XSS Payload Server (CORS + JSON)

Serves the JSON payload with `Access-Control-Allow-Origin: *` so a HackerOne trigger (or any origin) can fetch it over HTTPS.

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

- **Payload URL:** your chosen base URL (e.g. `https://your-project.glitch.me/` or `https://xxxx.ngrok-free.app/`).
- The server responds with JSON and `Access-Control-Allow-Origin: *`, so the target page can fetch it and, if it injects the response into the DOM without sanitization, the XSS will trigger.

---

## Restricting CORS (optional)

To allow only a specific program/domain, change in `server.js`:

```js
res.setHeader('Access-Control-Allow-Origin', 'https://target-domain.com');
```

Use `*` only for testing; restrict in real reports if the program allows.
