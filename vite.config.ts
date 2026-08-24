import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';

function curatorPlugin(): Plugin {
  return {
    name: 'zenolet-curator-plugin',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url) return next();
        const cleanUrl = req.url.split('?')[0];
        if (cleanUrl.startsWith('/curator/') || cleanUrl === '/curator') {
          const relativePath = cleanUrl.replace(/^\//, '');
          const filePath = path.resolve(__dirname, relativePath);
          if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            const ext = path.extname(filePath).toLowerCase();
            const mimeTypes: Record<string, string> = {
              '.json': 'application/json; charset=utf-8',
              '.svg': 'image/svg+xml',
              '.png': 'image/png',
              '.jpg': 'image/jpeg',
              '.jpeg': 'image/jpeg',
              '.md': 'text/markdown; charset=utf-8',
              '.txt': 'text/plain; charset=utf-8'
            };
            res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
            res.setHeader('Cache-Control', 'no-cache');
            const stream = fs.createReadStream(filePath);
            stream.pipe(res);
            return;
          }
        }
        next();
      });
    },
    closeBundle() {
      const curatorSrc = path.resolve(__dirname, 'curator');
      const curatorDest = path.resolve(__dirname, 'dist/curator');
      if (fs.existsSync(curatorSrc)) {
        fs.mkdirSync(curatorDest, { recursive: true });
        fs.cpSync(curatorSrc, curatorDest, {
          recursive: true,
          filter: (src) => !src.includes('scripts')
        });
      }
    }
  };
}

const pkg = JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url), 'utf-8'));

function htmlVersionPlugin(): Plugin {
  return {
    name: 'zenolet-html-version-plugin',
    transformIndexHtml(html) {
      return html.replace(/%APP_VERSION%/g, pkg.version);
    }
  };
}

export default defineConfig({
  base: './',
  root: '.',
  publicDir: 'public',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version)
  },
  plugins: [curatorPlugin(), htmlVersionPlugin()],
  server: {
    port: 5173,
    strictPort: false,
    hmr: {
      protocol: 'ws',
      host: 'localhost',
      port: 5173
    }
  },
  build: {
    outDir: 'dist',
    target: 'esnext'
  }
});
