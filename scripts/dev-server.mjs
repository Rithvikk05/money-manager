import http from 'node:http';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';
import apiHandler from '../api/[...path].js';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(currentDir, '..');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;

    const separatorIndex = trimmed.indexOf('=');
    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();

    if (!key || process.env[key] !== undefined) continue;

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

loadEnvFile(path.join(workspaceRoot, '.env.local'));
loadEnvFile(path.join(workspaceRoot, '.env'));

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
    const requestUrl = new URL(req.url || '/', 'http://localhost');
    const pathname = requestUrl.pathname || '/';

    if (pathname.startsWith('/api')) {
      const pathSegments = pathname.slice(4).split('/').filter(Boolean);

      req.query = {
        ...Object.fromEntries(requestUrl.searchParams.entries()),
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