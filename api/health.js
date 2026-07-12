import { handleOptions } from './_lib/http.js';

export default function handler(req, res) {
  if (handleOptions(req, res)) return;

  res.json({ status: 'OK', message: 'Money Manager API is running on Vercel with MongoDB' });
}
