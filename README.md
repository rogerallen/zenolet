# Zenolet (`zenolet` / `zenolet-reader`)

> **A serverless, privacy-first, horizontal page-flowing Progressive Web Application (PWA) for reading timeless public domain literature.**

Named in honor of **Zenodotus of Ephesus** (the first chief librarian of Alexandria who invented alphabetical cataloging) combined with the **`-let`** suffix (a small, self-contained micro-library applet), **Zenolet** turns any static web host into an independent micro-library node running 100% client-side with zero user accounts, zero tracking, zero server databases, and zero subscription fees.

---

## 🌟 Core Vision & Key Features

- **100% Serverless & Sovereign**: All state lives in the user's browser or URL hash (`#s=...`). Zero tracking, logins, or remote databases.
- **Top 1,000 Gutenberg Catalog**: Pre-indexed `public/catalog.json` featuring the 1,000 most popular Project Gutenberg titles with search and genre filtering.
- **Custom Site Identity (`public/zenolet.config.json`)**: Personalize any instance by editing a JSON configuration file to set branding, curator profile, bio, themes, and custom books.
- **Dedicated Cloudflare Worker CORS Proxy**: Custom serverless proxy (`worker/index.js`) with origin security, OPTIONS preflight handling, streaming byte logging, and strict hard-fail enforcement (no third-party proxy fallbacks).
- **Single-Command Local Environment (`npm run dev:local`)**: Concurrently runs local Wrangler Worker proxy and Vite UI with zero need to modify production configuration files.
- **Tactile Horizontal Flow Layout**: Book text flows horizontally in single-column (mobile) or double-column (desktop) spreads like a physical book, using CSS Multi-column layout and scroll snapping.
- **Compressed State & QR Handoff**: Encodes reading progress, theme, and book ID into a compressed URL hash (`#s=...`) using `CompressionStream('deflate-raw')` + Base64URL. Render an instant QR code for mobile camera handoff (<300 characters).
- **Off-Grid PWA & Cache Storage**: Service Worker caches app shell and offline books for offline reading.

---

## 📁 Repository Structure

```
zenolet/
├── public/
│   ├── zenolet.config.json      # Curator & site identity configuration
│   ├── catalog.json             # Pre-generated index of top 1,000 Gutenberg titles
│   ├── icon.svg                 # App icon
│   ├── manifest.json            # PWA Web Manifest
│   └── sw.js                    # Service worker for offline caching
├── scripts/
│   └── generate-catalog.ts      # Script to fetch & build top 1,000 books catalog from Gutendex
├── src/
│   ├── components/
│   │   ├── Bookshelf.ts         # Library card grid, curator header, genre pills, search bar
│   │   ├── ReaderEngine.ts      # CSS multi-column engine, page math, swiping, typography
│   │   ├── Timeline.ts          # TOC scanner, chapter dots, reading timeline footer
│   │   ├── DiscoverModal.ts     # Project Gutenberg search drawer & catalog importer
│   │   ├── QRModal.ts           # QR code overlay for desktop-to-phone handoff
│   │   └── SettingsModal.ts     # Reading themes (Paper, Sepia, Charcoal, Night) & font sizing
│   ├── services/
│   │   ├── config.ts            # Loader & validator for zenolet.config.json (supports VITE_PROXY_URL override)
│   │   ├── catalog.ts           # Catalog search & genre classification service
│   │   ├── state.ts             # CompressionStream URL hash encoder & decoder (#s=...)
│   │   ├── storage.ts           # CacheStorage wrapper & reading progress persistence
│   │   ├── api.ts               # Network fetch wrappers with timeout
   │   └── corsProxy.ts         # Cloudflare Worker CORS proxy client & hard-fail error handling
│   ├── __tests__/
│   │   ├── storage.test.ts      # Vitest unit tests for scroll math & storage
│   │   ├── gutenberg.test.ts    # Vitest unit tests for metadata extraction
│   │   └── corsProxy.test.ts    # Vitest unit tests for proxy security, preflights, & hard fail
│   ├── index.html               # Main HTML5 SPA shell
│   ├── main.ts                  # App entry point & router
│   └── style.css                # Global CSS system, multi-column rules & glassmorphic themes
├── worker/
│   └── index.js                 # Cloudflare Worker CORS proxy script (origin restriction & byte logging)
├── .github/
│   └── workflows/
│       └── deploy.yml           # GitHub Pages automated deployment pipeline (Node 24)
├── wrangler.jsonc               # Cloudflare Wrangler CLI configuration
├── package.json                 # Dependencies & scripts
├── tsconfig.json                # TypeScript configuration
├── vite.config.ts               # Vite bundler config & HMR setup
└── vitest.config.ts             # Vitest test framework config
```

---

## ⚙️ Curator Customization (`zenolet.config.json`)

To personalize your Zenolet deployment, edit `public/zenolet.config.json`:

```json
{
  "title": "The Most Popular 1,000 Gutenberg E-Books",
  "blurb": "A curated collection of the most popular 1,000 e-books from Project Gutenberg, presented in a horizontal reading interface.  Load books into any of 8 slots for offline reading.",
  "repoUrl": "https://github.com/rogerallen/zenolet",
  "curator": {
    "name": "Roger Allen",
    "linkUrl": "https://rogerallen.github.io"
  },
  "settings": {
    "defaultTheme": "sepia",
    "fontSize": 18,
    "layoutColumns": "auto"
  },
  "proxyUrl": "https://zenolet-cors-proxy.rallen-e12.workers.dev"
}
```

---

## 🚀 Quick Start & Development

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Single-Command Local Environment (UI + Worker Proxy)
Run both the Vite frontend (`http://localhost:5173`) and local Cloudflare Worker proxy (`http://localhost:8787`) simultaneously:
```bash
npm run dev:local
```
> **Note:** `npm run dev:local` dynamically routes traffic through `http://localhost:8787` without modifying `public/zenolet.config.json`.

### 3. Run Standard Frontend Dev Server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### 4. Run Unit Tests
```bash
npm test
```

### 5. Build Production Bundle
```bash
npm run build
```

---

## 🌩️ Cloudflare CORS Proxy Worker

Zenolet relies strictly on a dedicated Cloudflare Worker proxy (`worker/index.js`) to fetch Gutenberg book texts and illustrations without third-party public proxies.

### Key Worker Security & Logging Features
* **Origin Protection:** Restricts requests to `https://rogerallen.github.io`, Tailscale domains (`*.ts.net`), and local dev hosts (`localhost`, `127.0.0.1`). Unauthorized origins are rejected with `403 Forbidden`.
* **CORS Preflight (`OPTIONS`):** Returns `204 No Content` with cached CORS headers (`Access-Control-Allow-Origin`, `Access-Control-Allow-Methods: GET, HEAD, OPTIONS`, `Access-Control-Max-Age: 86400`).
* **Streaming Byte Logs:** Uses a `TransformStream` byte counter to log total bytes transferred when a book download completes.
* **Strict Hard Fail Policy:** If the proxy is unconfigured or returns an error, Zenolet hard-fails immediately without falling back to public proxies.

### Deploying the Worker to Cloudflare
```bash
# 1. Authenticate with Cloudflare
npx wrangler login

# 2. Deploy Worker
npx wrangler deploy

# 3. Stream live logs (Optional)
npx wrangler tail
```

---

## 📜 License

MIT License. Open source and free for non-commercial and commercial use alike.
