# Zenolet (`zenolet` / `zenolet-reader`)

> **A serverless, privacy-first, horizontal page-flowing Progressive Web Application (PWA) for reading timeless public domain literature.**

Named in honor of **Zenodotus of Ephesus** (the first chief librarian of Alexandria who invented alphabetical cataloging) combined with the **`-let`** suffix (a small, self-contained micro-library applet), **Zenolet** turns any static web host into an independent micro-library node running 100% client-side with zero user accounts, zero tracking, zero server databases, and zero subscription fees.

This repository serves as both the **open-source Zenolet reader engine** and a live curated instance: **"The Most Popular 1,000 Gutenberg E-Books"** curated by **Roger Allen**.

---

## Core Vision & Key Features

- **100% Serverless & Sovereign**: All state lives in the user's browser or URL hash (`#s=...`). Zero tracking, logins, or remote databases.
- **Dedicated Curator Directory (`curator/`)**: Cleanly separate your library configuration (`curator/config.json`), catalog (`curator/catalog.json`), and custom scripts from the core reader engine.
- **Top 1,000 Gutenberg Catalog**: Pre-indexed `curator/catalog.json` featuring the 1,000 most popular Project Gutenberg titles with search and genre filtering.
- **Dedicated Cloudflare Worker CORS Proxy**: Custom serverless proxy (`worker/index.js`) with origin security, OPTIONS preflight handling, streaming byte logging, and strict hard-fail enforcement.
- **Single-Command Local Environment (`npm run dev:local`)**: Concurrently runs local Wrangler Worker proxy and Vite UI with zero need to modify production configuration files.
- **Tactile Horizontal Flow Layout**: Book text flows horizontally in single-column (mobile) or double-column (desktop) spreads like a physical book, using CSS Multi-column layout and scroll snapping.
- **Compressed State & QR Handoff**: Encodes reading progress, theme, and book ID into a compressed URL hash (`#s=...`) using `CompressionStream('deflate-raw')` + Base64URL. Render an instant QR code for mobile camera handoff (<300 characters).
- **Off-Grid PWA & Cache Storage**: Service Worker caches app shell and offline books for offline reading.

---

## Create Your Own Curated Library!

Want to publish your own sovereign micro-library (e.g. philosophy classics, sci-fi anthologies, poetry, or curated educational reading lists)?

Read the full step-by-step [Curator's Guide (CURATING.md)](./CURATING.md).

All customizations live exclusively in the **`curator/`** directory. The core reader engine in `src/` remains untouched, allowing you to pull upstream updates easily.

---

## Contributing

If you are a developer looking to contribute bug fixes or new features, please see the [Contributor's Guide (CONTRIBUTING.md)](./CONTRIBUTING.md).

---

## License

MIT License. Open source and free for non-commercial and commercial use alike.
