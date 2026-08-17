# Zenolet Development Rules & Versioning Guidelines

## 📦 Versioning Standard (Semantic Versioning)

Zenolet follows strict Semantic Versioning formatted as `MAJOR.MINOR.BUGFIX` (e.g., `0.1.0`).

### 1. Pre-1.0 Versioning Rules
* **MAJOR**: Must equal `0` prior to official 1.0 release (e.g. `0.X.Y`).
* **MINOR**: Starts at `1` (`0.1.0`) and increments when new features are added and a release/deployment is made (e.g. `0.1.0` -> `0.2.0` -> `0.3.0`).
* **BUGFIX**: Stays `0` during pre-1.0 development, or increments for patch hotfixes.

### 2. Post-1.0 Versioning Rules
* **MAJOR**: Increments when breaking changes are introduced.
* **MINOR**: Increments when backwards-compatible features are added.
* **BUGFIX**: Increments for backwards-compatible bug fixes and patches.

### 3. Version Update Workflow
Whenever a feature, deploy, or version bump occurs:
1. Update `"version"` in `package.json`.
2. Update the version indicator in `index.html` (`Zenolet vMAJOR.MINOR.BUGFIX`).
3. Update version references in `README.md`.
4. Ask for explicit user confirmation before running `git push`.

---

## 🛡️ Git & Safety Workflow Rules

1. **Commit & Push Confirmation**:
   * **NEVER** run `git push` without asking for explicit user confirmation first.
   * **ALWAYS** summarize the exact staged files and proposed commit message before making git commits or pushing.

2. **Automated Pre-Commit Verification**:
   * Always run `npx vitest run` and `npm run build` to verify clean compilation and zero failing tests before proposing a commit or release.

3. **Development Commands**:
   * Use `npm run dev:local` for single-command local testing (runs local Cloudflare Worker proxy on port 8787 and Vite UI on port 5173 concurrently).

---

## 📚 8-Slot Bookshelf Invariants

1. **Fixed 8 Slots**:
   * The bookshelf consists of exactly 8 discrete slots (`0..7`), stored as `(BookMetadata | null)[]`.
   * Never convert the shelf into an unindexed dynamic list or shift elements on deletion.

2. **Slot Position Stability**:
   * **Persistence**: A book assigned to Slot `i` must always remain in Slot `i`.
   * **Reading**: Opening, reading, or returning from a book must NEVER reorder or shift slot positions.
   * **Deletion**: Deleting a book in Slot `i` only sets Slot `i` to `null` (empty slot) and NEVER collapses or shifts remaining slots.
   * **Addition**: Clicking empty Slot `i` and picking a book must place that book directly into Slot `i`.

3. **Zero Starter Books**:
   * An empty shelf must remain completely empty (all 8 slots `null`) with "+ Add Book" on each slot.
   * Never auto-seed starter or default books when the shelf is empty or cleared.

4. **Reading Progress & Removal Invariants**:
   * **Active Shelf Books**: While a book remains on the bookshelf, opening or revisiting it must always restore its saved reading position so the reader picks up right where they left off. Layout adjustments while reading (window resize, font changes, column toggles) must also preserve the active reading position.
   * **Book Removal**: Removing a book from a slot (or deleting it from the shelf) completely clears all saved progress, in-memory viewport state, and purges all cached content (both HTML and cached images) from local storage and Cache API. If that book is added to the shelf again in the future, reading MUST start back at the very first page (progress = 0).

5. **Proxy & Offline Asset Invariants**:
   * **Strict Proxying**: All external book assets (both HTML content and inline images) MUST always be requested through the configured Cloudflare CORS proxy. Never attempt unproxied direct fetches to external book hosts.
   * **Complete Offline Caching**: When a book is stored on the shelf for offline reading, both the HTML text and all inline illustrations/images must be stored locally in cache (with images inlined/cached) so the entire book is 100% readable and visual without network connectivity.

6. **Curated Offline-Only Catalog Search**:
   * **No Online Repository Lookups**: Book search operates strictly across the curated local catalog (`catalog.json`, containing the top ~1,000 classics). Never query external catalog APIs (such as Gutendex or external search endpoints).
   * **Instant & Private**: Search must execute 100% locally in-memory with zero network latency, zero debounce delay, and zero external tracking.
