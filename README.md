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

## 🍴 Forking & Creating Your Own Curated Library

Zenolet is intentionally designed as a **forkable, sovereign micro-library**. You can fork this repository to publish your own standalone, curated literary collection (e.g. 1,000 philosophy classics, science fiction anthologies, poetry collections, or educational reading lists) hosted entirely for free on GitHub Pages, Cloudflare Pages, Netlify, or any static host.

### Step-by-Step Guide to Deploy Your Own Node

#### 1. Fork & Clone the Repository

Click **Fork** at the top of the GitHub repository, then clone your fork locally:

```bash
git clone https://github.com/<your-username>/zenolet.git
cd zenolet
npm install
```

#### 2. Deploy Your Cloudflare Worker CORS Proxy

Project Gutenberg books and images require a CORS proxy for browser-based reading. Zenolet includes a minimal, zero-cost Cloudflare Worker proxy (`worker/index.js`).

1. Edit `worker/index.js` to add your site domain to `ALLOWED_ORIGINS`:
   ```javascript
   const ALLOWED_ORIGINS = ['https://<your-username>.github.io', 'http://localhost:5173', 'http://127.0.0.1:5173'];
   ```
2. Log in to Cloudflare and deploy:
   ```bash
   npx wrangler login
   npx wrangler deploy
   ```
3. Copy your deployed Worker URL (e.g., `https://zenolet-cors-proxy.<your-subdomain>.workers.dev`).

#### 3. Customize Your Site Configuration (`public/zenolet.config.json`)

Update `public/zenolet.config.json` with your library title, blurb, curator details, repository link, and your deployed Cloudflare Worker URL:

```json
{
  "title": "My Curated Classics Library",
  "blurb": "A hand-picked collection of timeless public domain literature ready for instant offline reading.",
  "repoUrl": "https://github.com/<your-username>/zenolet",
  "curator": {
    "name": "Your Name",
    "linkUrl": "https://<your-username>.github.io"
  },
  "settings": {
    "defaultTheme": "sepia",
    "fontSize": 18,
    "layoutColumns": "auto"
  },
  "proxyUrl": "https://zenolet-cors-proxy.<your-subdomain>.workers.dev"
}
```

#### 4. (Optional) Customize the Catalog (`public/catalog.json`)

By default, `public/catalog.json` contains the top 1,000 Project Gutenberg titles. You can:

- Keep the existing 1,000-book catalog as-is.
- Or generate a customized catalog using `scripts/generate-catalog.ts` or your own JSON structure containing `{ "id", "title", "author", "subjects", "downloads", "htmlUrl" }`.

#### 5. Deploy Your Static Site

- **GitHub Pages (Automated):** If hosted on GitHub, navigate to **Settings > Pages > Build and deployment**, select **GitHub Actions** as the source, and push to `main`. The included workflow (`.github/workflows/deploy.yml`) will automatically build and publish your site.
- **Cloudflare Pages / Netlify / Vercel:** Build command is `npm run build` and the output directory is `dist`.

---

## 📜 License

MIT License. Open source and free for non-commercial and commercial use alike.
