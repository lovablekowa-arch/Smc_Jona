import { muteTradePair } from '../server/scanner';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { pairSymbol, hours } = body || {};
    const result = muteTradePair(pairSymbol, hours || 6);
    return res.status(200).json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Error processing take trade' });
  }
}
