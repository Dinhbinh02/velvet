import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import https from 'node:https';
import http from 'node:http';

function corsProxyPlugin(): Plugin {
  return {
    name: 'cors-proxy-plugin',
    configureServer(server) {
      server.middlewares.use('/api/proxy', (req, res) => {
        try {
          const parsedUrl = new URL(req.url || '', 'http://localhost:3000');
          const target = parsedUrl.searchParams.get('url');
          if (!target) {
            res.statusCode = 400;
            res.end('Missing url parameter');
            return;
          }

          const fetchTarget = (targetUrl: string, redirectsRemaining = 5) => {
            const client = targetUrl.startsWith('https') ? https : http;
            const clientReq = client.get(
              targetUrl,
              {
                headers: {
                  'User-Agent':
                    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                  Accept: '*/*',
                  Referer: 'https://www.gutenberg.org/',
                },
              },
              (clientRes) => {
                if (
                  [301, 302, 303, 307, 308].includes(clientRes.statusCode || 0) &&
                  clientRes.headers.location &&
                  redirectsRemaining > 0
                ) {
                  const nextUrl = new URL(clientRes.headers.location, targetUrl).href;
                  fetchTarget(nextUrl, redirectsRemaining - 1);
                  return;
                }

                res.setHeader('Access-Control-Allow-Origin', '*');
                res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
                res.setHeader(
                  'Content-Type',
                  clientRes.headers['content-type'] || 'application/epub+zip'
                );
                res.statusCode = clientRes.statusCode || 200;
                clientRes.pipe(res);
              }
            );

            clientReq.on('error', (err) => {
              res.statusCode = 502;
              res.end('Proxy error: ' + err.message);
            });
          };

          fetchTarget(target);
        } catch (e: any) {
          res.statusCode = 500;
          res.end('Server error: ' + e.message);
        }
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss() as any, corsProxyPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './'),
      '@/src': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    port: 3000,
    open: true,
  },
  build: {
    target: 'esnext',
    outDir: 'dist',
  },
});
