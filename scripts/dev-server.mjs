import http from 'node:http';
import net from 'node:net';
import { parse } from 'node:url';
import { createServer as createViteServer } from 'vite';
import apiHandler from '../api/[...path].js';

const candidatePorts = [Number(process.env.PORT || 0), 5173, 4173, 3000].filter((port) => Number.isFinite(port) && port > 0);

async function isPortAvailable(port) {
  return await new Promise((resolve) => {
    const tester = net.createServer();

    tester.once('error', () => resolve(false));
    tester.once('listening', () => {
      tester.close(() => resolve(true));
    });

    tester.listen(port, '127.0.0.1');
  });
}

async function pickPort() {
  for (const port of candidatePorts) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }

  return 0;
}

const port = await pickPort();

const vite = await createViteServer({
  server: {
    host: '127.0.0.1',
    middlewareMode: true,
    hmr: {
      host: '127.0.0.1',
      port,
    },
  },
});

const server = http.createServer(async (req, res) => {
  const parsedUrl = parse(req.url || '/', true);
  const pathname = parsedUrl.pathname || '/';

  if (pathname.startsWith('/api')) {
    const pathSegments = pathname.slice(4).split('/').filter(Boolean);

    req.query = {
      ...parsedUrl.query,
      path: pathSegments,
    };

    if (typeof res.status !== 'function') {
      res.status = function status(code) {
        res.statusCode = code;
        return res;
      };
    }

    if (typeof res.json !== 'function') {
      res.json = function json(payload) {
        if (!res.headersSent) {
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
        }
        res.end(JSON.stringify(payload));
        return res;
      };
    }

    if (typeof res.send !== 'function') {
      res.send = function send(payload) {
        if (Buffer.isBuffer(payload) || typeof payload === 'string') {
          res.end(payload);
        } else {
          res.end(String(payload));
        }
        return res;
      };
    }

    await apiHandler(req, res);
    return;
  }

  vite.middlewares(req, res, async (err) => {
    if (err) {
      vite.ssrFixStacktrace(err);
      res.statusCode = 500;
      res.end(err.stack || err.message);
    }
  });
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Local dev server running at http://localhost:${port}`);
});