import { getSettings, updateSettings } from '../server/scanner';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const updated = updateSettings(body);
      return res.status(200).json(updated);
    }
    return res.status(200).json(getSettings());
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Error handling settings' });
  }
}
