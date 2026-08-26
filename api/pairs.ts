import { getAllLivePairs } from '../server/marketData';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const pairs = await getAllLivePairs();
    return res.status(200).json(pairs);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Error fetching pairs' });
  }
}
