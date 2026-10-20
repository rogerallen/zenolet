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

1. Update `"version"` in `package.json` (the single source of truth; automatically injected into `index.html` via `%APP_VERSION%` in Vite).
2. Update version references in `README.md` (if applicable).
3. Ask for explicit user confirmation before running `git push`.

---

## 🛡️ Git & Safety Workflow Rules

1. **Commit & Push Confirmation**:
   - **NEVER** run `git push` without asking for explicit user confirmation first.
   - **ALWAYS** summarize the exact staged files and proposed commit message before making git commits or pushing.

2. **Automated Pre-Commit Verification**:
   - Always run `npm run verify` (which runs `npm run audit`, `npm test`, `npm run lint`, `npm run format:check`, and `npm run build`) to verify zero production vulnerabilities, clean compilation, zero failing tests, and formatting compliance before proposing a commit or release.

3. **Development Commands**:
   - Use `npm run dev:local` for single-command local testing (runs local Cloudflare Worker proxy on port 8787 and Vite UI on port 5173 concurrently).

---

## 🔒 Security & Privacy Invariants

1. **Proxy Target Domain Whitelisting**:
   - The Cloudflare Worker proxy (`worker/index.js`) must strictly restrict target URLs to Project Gutenberg domains (`gutenberg.org` and `*.gutenberg.org`) over HTTP/HTTPS.
   - Never allow the worker to proxy arbitrary hostnames or act as an open SSRF relay.

2. **EPUB DOM Sanitization**:
   - All parsed EPUB XHTML content must undergo strict client-side DOM sanitization before being inserted into the reader view:
     - Disallowed elements to remove: `<script>`, `<style>`, `<iframe>`, `<object>`, `<embed>`, `<applet>`, `<form>`, `<input>`, `<textarea>`, `<button>`, `<meta>`, `<base>`, `<audio>`, `<video>`, `<source>`, `<track>`.
     - Attribute sanitization: Strip all inline event handlers (`on*` attributes like `onload`, `onerror`, `onclick`).
     - Inline style sanitization: Strip any `url(...)`, `@import`, or `expression(...)` declarations inside `style` attributes to eliminate external media leaks.
     - Link sanitization: Disallow script URLs (`javascript:`, `vbscript:`, `data:text/html`).
     - **Chapter Fallback Sanitization**: Document stitching must serialize only the sanitized DOM tree (`body.innerHTML` or `documentElement.innerHTML`). Never fall back to unparsed/raw `chapterRawText` when a chapter lacks a standard `<body>` tag, as this would bypass sanitization.

3. **Zero External Media Leaks**:
   - Only images packed inside the EPUB archive (inlined as local base64 Data URLs) may be rendered.
   - Any external `<img>`, SVG `<image>`, or unresolvable asset URL must have its source attribute stripped to prevent unproxied network requests, third-party tracking, or user IP leaks.
   - Strip all `srcset`, `background`, and `poster` attributes pointing to remote URLs, as well as external SVG `<use>` elements (`href` or `xlink:href` pointing to non-hash URLs).

4. **Protocol Whitelisting for External Links**:
   - All user-facing or config-driven links (e.g. curator `linkUrl`, external links inside book content) must validate and enforce safe HTTP/HTTPS protocols (`http:`, `https:`) before rendering clickable anchors. Disallow `javascript:` or other pseudo-protocols.

---

## 📖 Reader & Layout Invariants

1. **Layout Resize & Progress Synchronization**:
   - When recalculating page spreads on window resize, font size adjustment, or column layout toggles, DOM scroll position restoration (`restoreBookProgressByFraction`) MUST execute _before_ updating page indicators and saving progress.
   - Never update pagination indicators or fire debounced progress saves while the viewport is in an intermediate or un-restored scroll position.
   - Initial layout calculations during book opening must suppress progress saves (`skipSaveProgress = true`) to prevent race-condition writes of progress = 0 before the saved reading position is restored.

2. **Asynchronous Image Decoding Before Spread Calculation**:
   - When opening or rendering illustrated EPUBs, all inlined base64 `<img>` elements must be fully decoded (via `Promise.all(images.map(img => img.decode()))`) before measuring `readerContent.scrollWidth` and finalizing `totalPagesSpreads`, preventing undercounted page spreads and cut-off trailing chapters.

3. **Scroll Performance & Marker Caching**:
   - Horizontal scroll listeners must never trigger synchronous layout recalculations (e.g. `getBoundingClientRect()`, `querySelectorAll()`) per scroll frame. Chapter markers (`ChapterMarker[]`) must be computed once during layout changes and cached for fast in-memory lookups during scrolling.

4. **Immediate Reading Progress Flush**:
   - Debounced reading progress writes must be flushed immediately via `flushBookProgress()` upon leaving the reader, switching books, or when page visibility changes (`visibilitychange` / `beforeunload`).

5. **Structured EPUB Table of Contents Integration**:
   - When present, structured EPUB Table of Contents navigation (`nav.xhtml` or `toc.ncx`) must be parsed into `EpubChapter[]` and persisted with offline book details.
   - **TOC vs. Page List Separation**: EPUB Table of Contents parsing must strictly target chapter navigation (`nav[epub:type="toc"]`, `nav[role="doc-toc"]`, `nav#toc`) and explicitly exclude print page lists (`nav[epub:type="page-list"]`, `pageTarget`), landmark navigation, and illustration catalogs (`nav[epub:type="loi"]`). Timeline dots, popup chapter menus, and active chapter indicators must never display print page numbers (_"Page 1"_, _"p. 12"_) as chapters.
   - **Nested Relative Path Resolution**: When navigation documents (`nav.xhtml` or `toc.ncx`) reside in a subfolder (e.g. `EPUB/navigation/nav.xhtml`), all relative chapter paths must be resolved against the navigation document directory (`resolveZipPath(navDir, ...)`).
   - Timeline markers and active chapter indicators must prioritize structured TOC chapters before falling back to DOM heading discovery.

6. **Cross-Platform State Handoff (`state.ts`)**:
   - Reading state URLs (`#s=...`) use compressed base64url payloads with deflate-raw compression via synchronous `fflate` (`deflateSync`/`inflateSync`), with fallback for uncompressed base64 payloads (`#s=u_...`).

7. **Keyboard & Desktop Interaction**:
   - Keyboard navigation must support `ArrowRight` / `Space` for forward page turns, and `ArrowLeft` / `Shift + Space` for backward page turns.
   - Touch devices (iPad, iPhone, Android) utilize native hardware-accelerated CSS scroll snapping for touch swipe page turns, while desktop environments provide standard text cursor selection without grab/drag viewport panning.

8. **Universal Chapter Virtualization & Upfront Spread Calibration (ADR-0002)**:
   - For multi-chapter books, the reader mounts only the active spine item into `DOM.readerContent` to bound peak DOM memory on mobile devices.
   - All spine chapter spread counts must be pre-measured once offscreen (`premeasureAllChapterSpreads`) upon book load and layout changes, ensuring whole-book page counts (`Pages X–Y of Z`) remain rock-solid and never shift when reading trailing chapters.
   - TOC navigation entries must map to their parent spine items and anchors (`anchorId`), preserving granular jumping even when multiple chapters share a single spine file.

---

## ⚡ Service Worker & Caching Invariants

1. **Production & Dev Cache Preservation**:
   - The Service Worker (`public/sw.js`) activate listener and the development script in `index.html` MUST explicitly preserve `zenolet-books-v2` in `PROTECTED_CACHES` when deleting stale application caches. Never unconditionally wipe all non-app caches upon activation, as this destroys offline user books.

2. **Subresource Offline Fallback**:
   - The Service Worker (`public/sw.js`) must ONLY return the SPA navigation fallback (`index.html`) for navigation requests (`request.mode === 'navigate'`).
   - Failed static subresources (JS, CSS, fonts, images) offline must return a 404 response and never return `index.html` to avoid MIME type errors and syntax crashes.

---

## 💾 Storage & Reliability Invariants

1. **Safe Storage Exception Handling**:
   - All `localStorage.setItem` invocations (theme, font size, layout columns, reading progress) must be wrapped in `try/catch` blocks to gracefully handle `QuotaExceededError` or restricted storage environments (such as private browsing).

2. **Null-Safe String & HTML Escaping**:
   - All text formatting and HTML escaping utilities (`escapeHtml`) must be null-safe and tolerate `undefined` or `null` inputs without throwing exceptions.

---

## ♿ Accessibility (a11y) Invariants

1. **Keyboard Operability**:
   - All custom interactive elements (bookshelf slot cards, empty slot triggers, timeline jump dots, drawer triggers) must have `tabindex="0"`, `role="button"`, descriptive `aria-label` attributes, and `keydown` handlers for both `Enter` and `Space`.

2. **Modal & Drawer Semantics and Focus Management**:
   - All overlays, drawer panels, and popup menus (Settings, About, QR Modal, Discover panel, Chapter popup) must have `role="dialog"`, `aria-modal="true"`, and appropriate `aria-labelledby` or `aria-label` attributes. All close buttons must have explicit `aria-label` attributes.
   - When opening modals or drawers, focus must be placed immediately into the primary input or dialog control (e.g. search input in Discover drawer, close button in About dialog, or selectable URL in QR modal).
   - **Focus Trapping**: While any modal or drawer is open (`aboutModal`, `qrModal`, `discoverPanel`, `settingsPanel`), keyboard focus (`Tab` and `Shift + Tab`) must be strictly trapped within the active dialog's interactive controls, and `Escape` must close the dialog.

---

## 📚 Dynamic Bookshelf Invariants (ADR-0003)

1. **Dynamic Capacity & Single Append Trigger**:
   - The Bookshelf is a dynamic collection of offline books (`BookMetadata[]`), unbounded by arbitrary numeric limits and constrained only by browser storage capacity.
   - When empty, the Bookshelf displays exactly one card: the "+ Add Book" trigger.
   - When books are present, the Bookshelf renders all active book cards followed by exactly one trailing "+ Add Book" trigger.

2. **Compaction on Deletion & Order Stability**:
   - Deleting a book purges its cached offline data and reading progress, removes it from the bookshelf collection, and compacts remaining books forward so no empty gaps exist.
   - Reading, opening, or returning from a book must NEVER reorder or shift book positions.
   - External URL Handoff (`#s=...`) or QR code handoff appends imported books cleanly to the end of the shelf if not already present, without overwriting existing books.

3. **Zero Starter Books**:
   - A fresh library starts with an empty bookshelf displaying only the single "+ Add Book" trigger.
   - Never auto-seed starter or default books when the shelf is empty or cleared.

4. **Explicit Deletion Confirmation**:
   - Clicking the "X" button on a book card must prompt the user with an accessible in-app confirmation modal before purging cached book assets and reading progress.

5. **No "Slot N" Vocabulary**:
   - All user-facing references to discrete numbered slots ("Slot 1", "Slot 2", etc.) are eliminated from UI cards, tooltips, and accessibility attributes.

6. **Proxy & Offline Asset Invariants**:
   - **Strict Proxying**: All external EPUB book archives MUST always be requested through the configured Cloudflare CORS proxy. Never attempt unproxied direct fetches to external book hosts.
   - **Complete Offline Caching**: When an EPUB book is downloaded into the bookshelf, the parsed document tree (with all chapter XHTML and inlined base64 illustration data) is stored locally in Cache API so the entire book is 100% readable and visual without network connectivity.

7. **Curated Offline-Only Catalog Search**:
   - **No Online Repository Lookups**: Book search operates strictly across the curated local catalog (`catalog.json`, containing the top ~1,000 classics). Never query external catalog APIs (such as Gutendex or external search endpoints).
   - **Instant & Private**: Search must execute 100% locally in-memory with zero network latency, zero debounce delay, and zero external tracking.

---

## 🍴 Forkable Architecture Invariants

1. **Config Externalization**:
   - Never hardcode personal URLs or site names into core application logic or components.

2. **Self-Contained Static Deployment**:
   - The app is designed to be forked by anyone to create their own independent, curated static library.
   - The frontend must remain 100% static (deployable to GitHub Pages, Cloudflare Pages, Netlify, or any static file host) with no database or server requirements.
   - The only external dependency for a forker is their own free Cloudflare Worker CORS proxy (`worker/index.js`), which supports wildcards and environment configuration for all major static hosting domains.
