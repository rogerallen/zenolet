# Zenolet Development Rules & Versioning Guidelines

## 📦 Versioning Standard (Semantic Versioning)

Zenolet follows strict Semantic Versioning formatted as `MAJOR.MINOR.BUGFIX` (e.g., `0.1.0`).

### 1. Pre-1.0 Versioning Rules

- **MAJOR**: Must equal `0` prior to official 1.0 release (e.g. `0.X.Y`).
- **MINOR**: Starts at `1` (`0.1.0`) and increments when new features are added and a release/deployment is made (e.g. `0.1.0` -> `0.2.0` -> `0.3.0`).
- **BUGFIX**: Stays `0` during pre-1.0 development, or increments for patch hotfixes.

### 2. Post-1.0 Versioning Rules

- **MAJOR**: Increments when breaking changes are introduced.
- **MINOR**: Increments when backwards-compatible features are added.
- **BUGFIX**: Increments for backwards-compatible bug fixes and patches.

### 3. Version Update Workflow

Whenever a feature, deploy, or version bump occurs:

1. Update `"version"` in `package.json`.
2. Update the version indicator in `index.html` (`Zenolet vMAJOR.MINOR.BUGFIX`).
3. Update version references in `README.md`.
4. Ask for explicit user confirmation before running `git push`.

---

## 🛡️ Git & Safety Workflow Rules

1. **Commit & Push Confirmation**:
   - **NEVER** run `git push` without asking for explicit user confirmation first.
   - **ALWAYS** summarize the exact staged files and proposed commit message before making git commits or pushing.

2. **Automated Pre-Commit Verification**:
   - Always run `npx vitest run`, `npm run lint`, `npm run format:check`, and `npm run build` to verify clean compilation, zero failing tests, and formatting compliance before proposing a commit or release.

3. **Development Commands**:
   - Use `npm run dev:local` for single-command local testing (runs local Cloudflare Worker proxy on port 8787 and Vite UI on port 5173 concurrently).

---

## 🔒 Security & Privacy Invariants

1. **Proxy Target Domain Whitelisting (`SEC-002`)**:
   - The Cloudflare Worker proxy (`worker/index.js`) must strictly restrict target URLs to Project Gutenberg domains (`gutenberg.org` and `*.gutenberg.org`) over HTTP/HTTPS.
   - Never allow the worker to proxy arbitrary hostnames or act as an open SSRF relay.

2. **EPUB DOM Sanitization (`SEC-001`)**:
   - All parsed EPUB XHTML content must undergo strict client-side DOM sanitization before being inserted into the reader view:
     - Disallowed elements to remove: `<script>`, `<style>`, `<iframe>`, `<object>`, `<embed>`, `<applet>`, `<form>`, `<input>`, `<textarea>`, `<button>`, `<meta>`, `<base>`.
     - Attribute sanitization: Strip all inline event handlers (`on*` attributes like `onload`, `onerror`, `onclick`).
     - Link sanitization: Disallow script URLs (`javascript:`, `vbscript:`, `data:text/html`).

3. **Zero External Media Leaks (`PRI-001`)**:
   - Only images packed inside the EPUB archive (inlined as local base64 Data URLs) may be rendered.
   - Any external `<img>` or unresolvable asset URL must have its `src` stripped to prevent unproxied network requests, third-party tracking, or user IP leaks.

---

## 📖 Reader & Layout Invariants

1. **Layout Resize & Progress Synchronization (`COR-001`)**:
   - When recalculating page spreads on window resize, font size adjustment, or column layout toggles, DOM scroll position restoration (`restoreBookProgressByFraction`) MUST execute _before_ updating page indicators and saving progress.
   - Never update pagination indicators or fire debounced progress saves while the viewport is in an intermediate or un-restored scroll position.

2. **Cross-Platform State Handoff (`state.ts`)**:
   - Reading state URLs (`#s=...`) use compressed base64url payloads with deflate-raw compression, with fallback for uncompressed base64 payloads (`#s=u_...`).
   - Stream processing in `state.ts` must maintain universal compatibility across browser and Node/worker environments.

---

## ⚡ Service Worker & Caching Invariants

1. **Development Cache Preservation (`COR-002`)**:
   - The development cleanup script in `index.html` must preserve `zenolet-books-v1` when unregistering service workers on localhost/127.0.0.1 so offline book persistence is not destroyed on page reload during development.

2. **Subresource Offline Fallback (`PWA-001`)**:
   - The Service Worker (`public/sw.js`) must ONLY return the SPA navigation fallback (`index.html`) for navigation requests (`request.mode === 'navigate'`).
   - Failed static subresources (JS, CSS, fonts, images) offline must return a 404 response and never return `index.html` to avoid MIME type errors and syntax crashes.

---

## ♿ Accessibility (a11y) Invariants

1. **Keyboard Operability (`ACC-001`)**:
   - All custom interactive elements (bookshelf slot cards, empty slot triggers, timeline jump dots, drawer triggers) must have `tabindex="0"`, `role="button"`, descriptive `aria-label` attributes, and `keydown` handlers for both `Enter` and `Space`.

2. **Modal & Drawer Semantics**:
   - All overlays and drawer panels (Settings, About, QR Modal, Discover panel) must have `role="dialog"`, `aria-modal="true"`, and `aria-labelledby` referencing their respective title element. All close buttons must have explicit `aria-label` attributes.

---

## 📚 8-Slot Bookshelf Invariants

1. **Fixed 8 Slots**:
   - The bookshelf consists of exactly 8 discrete slots (`0..7`), stored as `(BookMetadata | null)[]`.
   - Never convert the shelf into an unindexed dynamic list or shift elements on deletion.

2. **Slot Position Stability**:
   - **Persistence**: A book assigned to Slot `i` must always remain in Slot `i`.
   - **Reading**: Opening, reading, or returning from a book must NEVER reorder or shift slot positions.
   - **Deletion**: Deleting a book in Slot `i` only sets Slot `i` to `null` (empty slot) and NEVER collapses or shifts remaining slots.
   - **Addition**: Clicking empty Slot `i` and picking a book must place that book directly into Slot `i`.

3. **Zero Starter Books**:
   - An empty shelf must remain completely empty (all 8 slots `null`) with "+ Add Book" on each slot.
   - Never auto-seed starter or default books when the shelf is empty or cleared.

4. **Reading Progress & Removal Invariants**:
   - **Active Shelf Books**: While a book remains on the bookshelf, opening or revisiting it must always restore its saved reading position so the reader picks up right where they left off. Layout adjustments while reading (window resize, font changes, column toggles) must also preserve the active reading position.
   - **Book Removal**: Removing a book from a slot (or deleting it from the shelf) completely clears all saved progress, in-memory viewport state, and purges all cached content (both HTML and cached images) from local storage and Cache API. If that book is added to the shelf again in the future, reading MUST start back at the very first page (progress = 0).

5. **Proxy & Offline Asset Invariants**:
   - **Strict Proxying**: All external EPUB book archives MUST always be requested through the configured Cloudflare CORS proxy. Never attempt unproxied direct fetches to external book hosts.
   - **Complete Offline Caching**: When an EPUB book is downloaded into one of the 8 shelf slots, the parsed document tree (with all chapter XHTML and inlined base64 illustration data) is stored locally in Cache API so the entire book is 100% readable and visual without network connectivity.

6. **Curated Offline-Only Catalog Search**:
   - **No Online Repository Lookups**: Book search operates strictly across the curated local catalog (`catalog.json`, containing the top ~1,000 classics). Never query external catalog APIs (such as Gutendex or external search endpoints).
   - **Instant & Private**: Search must execute 100% locally in-memory with zero network latency, zero debounce delay, and zero external tracking.

---

## 🍴 Forkable Architecture Invariants

1. **Config Externalization**:
   - All site branding, curator metadata (`name`, `linkUrl`), site `title`, `blurb`, `repoUrl`, default reader settings, and `proxyUrl` MUST remain fully externalized in `public/zenolet.config.json`.
   - Never hardcode personal URLs or site names into core application logic or components.

2. **Self-Contained Static Deployment**:
   - The app is designed to be forked by anyone to create their own independent, curated static library.
   - The frontend must remain 100% static (deployable to GitHub Pages, Cloudflare Pages, Netlify, or any static file host) with no database or server requirements.
   - The only external dependency for a forker is their own free Cloudflare Worker CORS proxy (`worker/index.js`), which must remain simple and self-contained.
