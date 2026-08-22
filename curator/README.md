# Curator Directory

Welcome to the **Curator Configuration** directory. This is the **only directory** you need to edit to customize and run your own independent Zenolet library.

---

## 📁 What Lives in This Folder

- **`config.json`**:
  The primary configuration for your library. Sets your library title, blurb, curator byline, website links, default reader settings (theme, font size), and your Cloudflare Worker CORS proxy endpoint.
  _(See `config.example.json` for a reference template)._

- **`catalog.json`**:
  Your library's book catalog. Each entry contains the book's Project Gutenberg ID, title, author, subjects/genres, download count, EPUB URL, and cover image URL. You can build, generate, or edit this file however you see fit.

- **`scripts/`**:
  Any helper scripts you use to generate, fetch, or filter your catalog (e.g. `scripts/generate-catalog.ts`).

- **`assets/`**:
  Optional directory for custom library branding, logos, or cover placeholder artwork.

---

## 🚀 Quick Curation Checklist

1. **Configure Your Library**: Edit `config.json` with your library's title, curator bio, and deployed Cloudflare proxy URL.
2. **Set Your Catalog**: Add or generate your books in `catalog.json`.
3. **Deploy**: Push to GitHub or your static web host. Your custom library is live immediately!

For a full step-by-step walkthrough, see [CURATING.md](../CURATING.md) in the repository root.
