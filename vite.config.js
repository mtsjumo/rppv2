import { defineConfig } from 'vite';

/**
 * Output sengaja dibuat IIFE (bukan ESM) agar `dist/index.html` tetap bisa
 * dibuka langsung lewat double-click (`file://`) tanpa server — sifat
 * "zero-config static site" project ini dijaga.
 *
 * Karena itu tag <script> hasil build harus berupa *classic script*:
 * `type="module"` membuat browser menolaknya di origin `file://` (CORS).
 * Plugin di bawah yang membersihkan tag tersebut.
 *
 * Mode dev (`npm run dev`) tetap memakai ES module native + HMR.
 */
function classicScriptTag() {
  return {
    name: 'rpp-classic-script-tag',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        return html.replace(
          /<script\s+([^>]*?)type="module"([^>]*?)><\/script>/g,
          (_match, before, after) => {
            const attrs = `${before} ${after}`.replace(/\s+/g, ' ').trim();
            // Buang crossorigin: tidak relevan (dan Campaigns error) untuk script lokal.
            const cleaned = attrs.replace(/\bcrossorigin(="[^"]*")?/g, '').replace(/\s+/g, ' ').trim();
            return `<script ${cleaned}></script>`;
          }
        );
      },
    },
  };
}

export default defineConfig({
  plugins: [classicScriptTag()],

  // Path relatif supaya aplikasi bisa di-host di sub-path GitHub Pages
  // (mis. https://user.github.io/rpp-generator/) maupun root domain.
  base: './',

  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2020',
    cssCodeSplit: false,
    assetsInlineLimit: 0,
    sourcemap: true,
    rollupOptions: {
      output: {
        format: 'iife',
        entryFileNames: 'assets/app.js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },

  server: {
    port: 5173,
    open: true,
  },
});
