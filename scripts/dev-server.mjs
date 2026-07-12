import http from 'node:http';
import net from 'node:net';
import { parse } from 'node:url';
import { createServer as createViteServer } from 'vite';
import apiHandler from '../api/[...path].js';

const candidatePorts = [Number(process.env.PORT || 0), 5173, 5174, 4173, 3000]
  .filter((port) => Number.isFinite(port) && port > 0)
  .filter((port, index, ports) => ports.indexOf(port) === index);

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

async function createAppServer(port) {
  const vite = await createViteServer({
    server: {
      host: '127.0.0.1',
      middlewareMode: true,
      hmr: false,
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

  return { vite, server };
}

async function startServer() {
  for (const port of candidatePorts) {
    if (!(await isPortAvailable(port))) {
      continue;
    }

    const { vite, server } = await createAppServer(port);

    try {
      await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, '127.0.0.1', resolve);
      });

      server.removeAllListeners('error');
      console.log(`Local dev server running at http://localhost:${port}`);
      return;
    } catch (error) {
      server.removeAllListeners('error');
      await vite.close();

      if (error && error.code === 'EADDRINUSE') {
        continue;
      }

      throw error;
    }
  }

  const { vite, server } = await createAppServer(0);

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address();
  const actualPort = typeof address === 'object' && address ? address.port : 0;
  server.removeAllListeners('error');
  console.log(`Local dev server running at http://localhost:${actualPort}`);

  return { vite, server };
}

await startServer();