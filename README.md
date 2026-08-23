# Zenolet (`zenolet` / `zenolet-reader`)

> **A serverless, privacy-first, horizontal page-flowing Progressive Web Application (PWA) for reading timeless public domain literature.**

Named in honor of **Zenodotus of Ephesus** (the first chief librarian of Alexandria who invented alphabetical cataloging) combined with the **`-let`** suffix (a small, self-contained micro-library applet), **Zenolet** turns any static web host into an independent micro-library node running 100% client-side with zero user accounts, zero tracking, zero server databases, and zero subscription fees.

This repository serves as both the **open-source Zenolet reader engine** and a live curated instance: **"The Most Popular 1,000 Gutenberg E-Books"** curated by **Roger Allen**.

---

## 📚 Create Your Own Curated Library!

Want to publish your own sovereign micro-library (e.g. philosophy classics, sci-fi anthologies, poetry, or curated educational reading lists)?

👉 **Read the full step-by-step [Curator's Guide (CURATING.md)](./CURATING.md).**

All customizations live exclusively in the **`curator/`** directory. The core reader engine in `src/` remains untouched, allowing you to pull upstream updates easily.

---

## 🌟 Core Vision & Key Features

- **100% Serverless & Sovereign**: All state lives in the user's browser or URL hash (`#s=...`). Zero tracking, logins, or remote databases.
- **Dedicated Curator Directory (`curator/`)**: Cleanly separate your library configuration (`curator/config.json`), catalog (`curator/catalog.json`), and custom scripts from the core reader engine.
- **Top 1,000 Gutenberg Catalog**: Pre-indexed `curator/catalog.json` featuring the 1,000 most popular Project Gutenberg titles with search and genre filtering.
- **Dedicated Cloudflare Worker CORS Proxy**: Custom serverless proxy (`worker/index.js`) with origin security, OPTIONS preflight handling, streaming byte logging, and strict hard-fail enforcement.
- **Single-Command Local Environment (`npm run dev:local`)**: Concurrently runs local Wrangler Worker proxy and Vite UI with zero need to modify production configuration files.
- **Tactile Horizontal Flow Layout**: Book text flows horizontally in single-column (mobile) or double-column (desktop) spreads like a physical book, using CSS Multi-column layout and scroll snapping.
- **Compressed State & QR Handoff**: Encodes reading progress, theme, and book ID into a compressed URL hash (`#s=...`) using `CompressionStream('deflate-raw')` + Base64URL. Render an instant QR code for mobile camera handoff (<300 characters).
- **Off-Grid PWA & Cache Storage**: Service Worker caches app shell and offline books for offline reading.

---

## 📁 Repository Structure

```
zenolet/
├── curator/                     # 🎯 THE ONLY DIRECTORY A CURATOR EDITS
│   ├── config.json              # Curator & site identity configuration
│   ├── config.example.json      # Template configuration for new curators
│   ├── catalog.json             # Pre-generated index of top ~1,000 Gutenberg classics
│   ├── assets/                  # (Optional) Custom logos, icons, or artwork
│   ├── scripts/                 # (Optional) Custom catalog generation scripts
│   │   └── generate-catalog.ts  # Script to fetch top 1,000 books from Gutendex
│   └── README.md                # In-folder quick reference guide
├── .github/
│   └── workflows/
│       └── deploy.yml           # GitHub Pages automated deployment pipeline (Node 24)
├── .vscode/
│   ├── extensions.json          # Recommended VS Code extensions (ESLint, Prettier)
│   └── settings.json            # VS Code workspace format-on-save settings
├── public/
│   ├── icon.svg                 # Default app icon
│   ├── manifest.json            # PWA Web Manifest
│   └── sw.js                    # Service worker for offline caching
├── src/                         # 🔒 ZENOLET ENGINE CORE (DO NOT EDIT)
│   ├── components/
│   │   ├── Bookshelf.ts         # 8-slot bookshelf, curator header, slot persistence
│   │   ├── DiscoverModal.ts     # Instant local catalog search & add-to-shelf drawer
│   │   ├── DiscoverModal.test.ts # Unit tests for local catalog search
│   │   ├── QRModal.ts           # QR code overlay for desktop-to-phone handoff
│   │   ├── ReaderEngine.ts      # CSS multi-column engine, page math, swiping, typography
│   │   ├── ReaderEngine.test.ts # Unit tests for page layout and scroll restoration
│   │   ├── SettingsModal.ts     # Reading themes (Paper, Sepia, Charcoal, Night) & font sizing
│   │   └── Timeline.ts          # TOC scanner, chapter dots, reading timeline footer
│   ├── services/
│   │   ├── catalog.ts           # Catalog search & genre classification service
│   │   ├── config.ts            # Loader & validator for curator/config.json
│   │   ├── config.test.ts       # Unit tests for config loading & schema
│   │   ├── corsProxy.ts         # Cloudflare Worker CORS proxy client for EPUB binary fetching
│   │   ├── corsProxy.test.ts    # Unit tests for proxy security, preflights, & candidate URLs
│   │   ├── epub.ts              # In-memory EPUB3 unpacker, OPF parser, image inliner & stitcher
│   │   ├── epub.test.ts         # Unit tests for EPUB unpacking, TOC, & XHTML bookmark anchors
│   │   ├── state.ts             # CompressionStream URL hash encoder & decoder (#s=...)
│   │   ├── storage.ts           # 8-slot persistence, progress math, CacheStorage purging
│   │   └── storage.test.ts      # Unit tests for 8-slot storage & offline cache
│   ├── main.ts                  # App entry point, DOM cache, event orchestration
│   └── style.css                # Global design system, multi-column rules & themes
├── worker/
│   └── index.js                 # Cloudflare Worker CORS proxy script (origin restriction & byte logging)
├── .gitignore
├── .prettierignore
├── .prettierrc
├── AGENTS.md                    # Invariants, versioning rules, & development guidelines
├── CURATING.md                  # Comprehensive step-by-step curation handbook
├── eslint.config.js             # Modern ESLint 9+ flat configuration
├── index.html                   # Main HTML5 SPA shell
├── package.json                 # Dependencies & scripts
├── tsconfig.json                # TypeScript configuration
├── vite.config.ts               # Vite bundler config & curator plugin
├── vitest.config.ts             # Vitest test framework config
└── wrangler.jsonc               # Cloudflare Wrangler CLI configuration
```

---

## ⚙️ Curator Customization (`curator/config.json`)

To personalize your Zenolet deployment, edit `curator/config.json`:

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
  "worker": {
    "proxyUrl": "https://zenolet-cors-proxy.rallen-e12.workers.dev",
    "allowedOrigins": ["https://rogerallen.github.io"]
  }
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

> **Note:** `npm run dev:local` dynamically routes traffic through `http://localhost:8787` without modifying `curator/config.json`.

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

## 📜 License

MIT License. Open source and free for non-commercial and commercial use alike.
