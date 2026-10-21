# Curator Directory

Welcome to the **Curator Configuration** directory. This is the **only directory** you need to edit to customize and run your own independent Zenolet library.

---

## 📁 What Lives in This Folder

- **`config.json`**:
  The primary configuration for your library. Sets your library title, blurb, curator byline, website links, default reader settings (theme, font size), and your Cloudflare Worker CORS proxy endpoint.
  _(See `config.example.json` for a reference template)._

- **`catalog.json`**:
  Your library's active, curated book catalog. Each entry contains the book's Project Gutenberg ID, title, author, subjects/genres, download count, EPUB URL, and cover image URL.

- **`catalog.raw.json`**:
  The full candidate book pool fetched from Project Gutenberg / Gutendex prior to deduplication and filtering.

- **`curation.json`**:
  The curation decision file tracking duplicate clusters, scoring heuristics, selected editions, and curator manual overrides (`manualOverride`).

- **`CURATION_REPORT.md`**:
  Auto-generated report summarizing all duplicate clusters, selected vs rejected editions, illustration counts, and excluded non-English or audiobook items.

- **`scripts/`**:
  Helper scripts to generate and curate your catalog:
  - `generate-catalog.ts`: Fetches top English text EPUBs from Gutendex and triggers curation.
  - `curate.ts`: Evaluates duplicate clusters, applies curator overrides, filters audiobooks and non-English media, and regenerates `catalog.json` and `CURATION_REPORT.md`.

---

## 🎯 Catalog Curation Workflow

1. **Generate or Refresh Catalog**:

   ```bash
   npm run generate-catalog
   ```

   Fetches top English EPUB books and automatically runs curation.

2. **Review Curation Decisions**:
   Inspect `curator/CURATION_REPORT.md` or `curator/curation.json`.
   - The curation engine automatically scores competing editions, prioritizing **illustrated editions** (e.g. Sidney Paget's Sherlock Holmes `#48320`, Hugh Thomson's Sense & Sensibility `#21839`), Project Gutenberg **improved edition notices**, and complete texts.
   - Non-English titles, audiobooks, and volume fragments are filtered out automatically.

3. **Override Any Selection**:
   If you prefer a different edition in a cluster, open `curator/curation.json`, set `"manualOverride": "<id>"` for that cluster, and run:
   ```bash
   npm run curate
   ```
   The engine will apply your override, regenerate `catalog.json`, and update `CURATION_REPORT.md`.

- **`assets/`**:
  Optional directory for custom library branding, logos, or cover placeholder artwork.

---

## 🚀 Quick Curation Checklist

1. **Configure Your Library**: Edit `config.json` with your library's title, curator bio, and deployed Cloudflare proxy URL.
2. **Set Your Catalog**: Add or generate your books in `catalog.json`.
3. **Deploy**: Push to GitHub or your static web host. Your custom library is live immediately!

For a full step-by-step walkthrough, see [docs/curating.md](../docs/curating.md).
