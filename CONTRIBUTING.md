# Contributing to Zenolet

## Repository Structure

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
├── src/                         # 📖 Core Reader Engine (Components, Services & Styles)
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
├── CONTRIBUTING.md              # Contributor guide for engine developers
├── CURATING.md                  # Comprehensive step-by-step curation handbook
├── READER_ENGINE.md             # Reader engine architecture & pagination algorithm guide
├── eslint.config.js             # Modern ESLint 9+ flat configuration
├── index.html                   # Main HTML5 SPA shell
├── package.json                 # Dependencies & scripts
├── tsconfig.json                # TypeScript configuration
├── vite.config.ts               # Vite bundler config & curator plugin
├── vitest.config.ts             # Vitest test framework config
└── wrangler.jsonc               # Cloudflare Wrangler CLI configuration
```

---

## Curator Customization vs. Engine Development

- **Curators**: If your goal is to publish your own curated book collection, see the [Curator's Guide (CURATING.md)](./CURATING.md). You only need to edit files in `curator/`.
- **Engine Contributors**: If you are contributing bug fixes, performance optimizations, accessibility enhancements, or new features to the core reader engine, your code changes will primarily be in `src/`, `worker/`, and `public/`.

---

## Quick Start & Development Workflow

### 1. Install Dependencies

```bash
npm install
```

### 2. Run Single-Command Local Environment (UI + Worker Proxy)

Runs both the Vite frontend (`http://localhost:5173`) and local Cloudflare Worker proxy (`http://localhost:8787`) concurrently:

```bash
npm run dev:local
```

> **Note:** `npm run dev:local` dynamically routes proxy requests through `http://localhost:8787` for seamless offline/CORS testing.

### 3. Run Standard Frontend Dev Server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### 4. Run Unit Tests

```bash
npm test              # or: npx vitest run
```

### 5. Automated Pre-Commit Verification

Before submitting a Pull Request, ensure all automated verification checks pass cleanly:

```bash
npm test              # Zero failing unit tests
npm run lint          # Zero ESLint warnings or errors
npm run format:check  # 100% Prettier formatting compliance (run `npm run format` to auto-fix)
npm run build         # Clean TypeScript compilation and Vite production build
```
