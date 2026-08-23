# 📖 Curator's Guide: Creating Your Own Curated Library

**Zenolet** is designed from the ground up as a **sovereign, forkable micro-library**. You can fork this repository to publish your own standalone, curated literary collection (e.g., 50 philosophy classics, a sci-fi anthology, poetry collections, or an educational reading list) hosted completely free on **GitHub Pages**, **Cloudflare Pages**, **Netlify**, or any static host. (Note that only Github Pages has been tested).

**You only ever need to edit the `curator/` directory.** The core reader engine in `src/` remains untouched.

---

## 🛠️ Step-by-Step Curation Guide

### Step 1: Fork & Clone the Repository

1. Click **Fork** at the top right of this GitHub repository to create your own copy.
2. Clone your fork locally:
   ```bash
   git clone https://github.com/<your-username>/zenolet.git
   cd zenolet
   npm install
   ```

At this point, you should be able to test it on your dev machine via

```bash
npm run dev:local
```

---

### Step 2: Configure Your Library (`curator/config.json`)

Edit `curator/config.json` with your library's identity:

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
  "worker": {
    "proxyUrl": "https://zenolet-cors-proxy.<your-subdomain>.workers.dev",
    "allowedOrigins": ["https://<your-username>.github.io"]
  }
}
```

#### Configuration Options:

- **`title`**: The name of your curated library (displayed in the bookshelf header, page title, and About modal).
- **`blurb`**: A brief description of your collection.
- **`repoUrl`**: The link to your GitHub repository (rendered in the footer).
- **`curator.name`**: Your name or organization name.
- **`curator.linkUrl`**: Your personal website, blog, or profile URL.
- **`settings`**: Default reader preferences (`defaultTheme`: `paper` | `sepia` | `charcoal` | `night`, `fontSize`: `14..28`, `layoutColumns`: `auto` | `1` | `2`).
- **`worker.proxyUrl`**: The URL of your deployed Cloudflare Worker CORS proxy (filled in after Step 3).
- **`worker.allowedOrigins`**: Array of authorized website domains (e.g. `["https://<your-username>.github.io"]`) allowed to use your proxy. Localhost is always enabled for testing.

> **Important:** Make sure to set `worker.allowedOrigins` to your site's domain before deploying the worker in Step 3. Cloudflare Wrangler bundles `curator/config.json` into the worker during deployment.

---

### Step 3: Deploy Your Free Cloudflare Worker Proxy

Using Zenolet to download book archives and images requires a Cross-Origin Resource Sharing (CORS) proxy for in-browser downloading. Zenolet includes a minimal, zero-cost Cloudflare Worker proxy (`worker/index.js`). You will need to deploy this before testing on your live `github.io` site.

1. Log in to Cloudflare (you will need a free account) and deploy the worker proxy:
   ```bash
   npx wrangler login
   npx wrangler deploy
   ```
2. Note your deployed Worker URL (e.g. `https://zenolet-cors-proxy.<your-subdomain>.workers.dev`).
3. Paste this URL into `worker.proxyUrl` in `curator/config.json`.

---

### Step 4: Define Your Catalog (`curator/catalog.json`)

`curator/catalog.json` contains the list of books available in your library's "Add Book" drawer. You have full freedom to build this catalog however you see fit:

#### Catalog JSON Format:

```json
[
  {
    "id": "1342",
    "title": "Pride and Prejudice",
    "author": "Jane Austen",
    "subjects": ["Courtship -- Fiction", "Sisters -- Fiction"],
    "downloads": 55000,
    "epubUrl": "https://www.gutenberg.org/ebooks/1342.epub3.images",
    "coverUrl": "https://www.gutenberg.org/cache/epub/1342/pg1342.cover.medium.jpg"
  }
]
```

#### Ways to Create Your Catalog:

- **Option A: Edit manually or copy from Project Gutenberg**: Add JSON objects for your favorite books with their Gutenberg IDs and EPUB download URLs.
- **Option B: Use the included catalog script**: Run `npm run generate-catalog` (which executes `curator/scripts/generate-catalog.ts`) or customize it to scrape books by subject/author.

---

### Step 5: Test Locally & Deploy

1. Test your library locally with a single command:

   ```bash
   npm run dev:local
   ```

   This starts both the local proxy and Vite dev server at `http://localhost:5173`.

2. Deploy your library:
   - **GitHub Pages (Automatic)**:
     1. In your GitHub repo, go to **Settings > Pages > Build and deployment**.
     2. Under **Source**, select **GitHub Actions**.
     3. Push your changes to `main`. The included `.github/workflows/deploy.yml` will automatically build and publish your site!
   - **Cloudflare Pages / Netlify / Vercel**:
     - Build command: `npm run build`
     - Output directory: `dist`

---

## 🔒 What NOT to Edit

To keep your library easily updatable with upstream Zenolet features and improvements:

- **Do not edit `src/`**: All reader mechanics, pagination math, offline storage, EPUB decoders, and themes live here.
- **Do not edit `worker/`**: The Cloudflare proxy is already fully generic.
- **Do not edit `public/`**: Contains core PWA shell assets (`sw.js`, `manifest.json`).

All your customizations live exclusively in `curator/`.
