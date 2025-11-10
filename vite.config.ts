import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { formatDisplayName, listTemplates, readTemplateContent } from './netlify/functions/utils/templates';

const devFunctionsProxy = (): Plugin => ({
  name: 'dev-netlify-functions-proxy',
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      if (!req.url || req.method !== 'GET') {
        next();
        return;
      }

      const requestUrl = new URL(req.url, 'http://localhost');

      if (requestUrl.pathname === '/.netlify/functions/list-templates') {
        try {
          const templates = await listTemplates();
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ templates }));
        } catch (error) {
          console.error('Dev proxy failed to list templates', error);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ message: 'Unable to list templates' }));
        }
        return;
      }

      if (requestUrl.pathname === '/.netlify/functions/get-template') {
        const slug = requestUrl.searchParams.get('slug');

        if (!slug) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ message: 'Missing template slug' }));
          return;
        }

        try {
          const { content, config } = await readTemplateContent(slug);
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              slug,
              displayName: formatDisplayName(slug),
              content,
              config,
            }),
          );
        } catch (error) {
          if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
            res.statusCode = 404;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ message: 'Template not found' }));
            return;
          }

          console.error('Dev proxy failed to load template', error);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ message: 'Unable to load template' }));
        }
        return;
      }

      next();
    });
  },
});

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), devFunctionsProxy()],
});
