# Zenolet (`zenolet` / `zenolet-reader`)

> **A serverless, privacy-first, horizontal page-flowing Progressive Web Application (PWA) for reading timeless public domain literature.**

Named in honor of **Zenodotus of Ephesus** (the first chief librarian of Alexandria who invented alphabetical cataloging) combined with the **`-let`** suffix (a small, self-contained micro-library applet), **Zenolet** turns any static web host into an independent micro-library node running 100% client-side with zero user accounts, zero tracking, zero server databases, and zero subscription fees.

---

## 🌟 Core Vision & Key Features

- **100% Serverless & Sovereign**: All state lives in the user's browser or URL hash (`#s=...`). Zero tracking, logins, or remote databases.
- **Top 1,000 Gutenberg Catalog**: Pre-indexed `public/catalog.json` featuring the 1,000 most popular Project Gutenberg titles with search and genre filtering.
- **Custom Site Identity (`public/zenolet.config.json`)**: Make any deployed instance "yours" simply by editing a JSON configuration file to set branding, curator profile, bio, themes, and custom books.
- **Tactile Horizontal Flow Layout**: Book text flows horizontally in single-column (mobile) or double-column (desktop) spreads like a physical book, using CSS Multi-column layout and scroll snapping.
- **Compressed State & QR Handoff**: Encodes reading progress, theme, and book ID into a compressed URL hash (`#s=...`) using `CompressionStream('deflate-raw')` + Base64URL. Render an instant QR code for mobile camera handoff (<300 characters).
- **Off-Grid PWA & Cache Storage**: Service Worker caches app shell and up to 10 books in browser `CacheStorage` for full offline reading.
- **Cloudflare Worker CORS Helper**: Included 15-line worker script (`worker/index.js`) for proxying Project Gutenberg assets across origins.

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
│   │   ├── config.ts            # Loader & validator for zenolet.config.json
│   │   ├── catalog.ts           # Catalog search & genre classification service
│   │   ├── state.ts             # CompressionStream URL hash encoder & decoder (#s=...)
│   │   ├── storage.ts           # CacheStorage wrapper & reading progress persistence
│   │   ├── api.ts               # Network fetch wrappers with timeout
│   │   └── corsProxy.ts         # CORS proxy URL formatter
│   ├── __tests__/
│   │   ├── storage.test.ts      # Vitest unit tests for scroll math & storage
│   │   └── gutenberg.test.ts    # Vitest unit tests for metadata extraction
│   ├── index.html               # Main HTML5 SPA shell
│   ├── main.ts                  # App entry point & router
│   └── style.css                # Global CSS system, multi-column rules & glassmorphic themes
├── worker/
│   └── index.js                 # Cloudflare Worker CORS proxy script
├── package.json                 # Dependencies & scripts
├── tsconfig.json                # TypeScript configuration
├── vite.config.ts               # Vite bundler config
└── vitest.config.ts             # Vitest test framework config
```

---

## ⚙️ Curator Customization (`zenolet.config.json`)

To personalize your Zenolet deployment, edit `public/zenolet.config.json`:

```json
{
  "siteTitle": "Alexandria Micro-Library",
  "curator": {
    "name": "Roger Allen",
    "avatar": "https://github.com/rogerallen.png",
    "bio": "A personal micro-library of timeless literature and early sci-fi classics.",
    "link": "https://github.com/rogerallen"
  },
  "defaultTheme": "sepia",
  "fontSize": 18,
  "layoutColumns": "auto",
  "proxyUrl": "https://corsproxy.io/?",
  "customBooks": []
}
```

---

## 🚀 Quick Start & Development

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Local Development Server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### 3. Run Unit Tests
```bash
npm test
```

### 4. Build Production Bundle
```bash
npm run build
```

### 5. Re-generate Top 1,000 Gutenberg Catalog
```bash
npm run generate-catalog
```

---

## 🌩️ CORS Proxy Worker Setup

To proxy Project Gutenberg assets across origins without relying on public CORS proxies, deploy `worker/index.js` to Cloudflare Workers:

```bash
npx wrangler deploy worker/index.js --name zenolet-cors-proxy
```

Then update `proxyUrl` in `public/zenolet.config.json` with your deployed Cloudflare Worker domain URL:
```json
"proxyUrl": "https://zenolet-cors-proxy.your-subdomain.workers.dev"
```

---

## 📜 License

MIT License. Open source and free for non-commercial and commercial use alike.
