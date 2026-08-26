import { executeScan, getLatestSignals } from '../server/scanner';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    let signals = getLatestSignals();
    if (!signals || signals.length === 0) {
      const scanRes = await executeScan(false);
      signals = scanRes.signals;
    }
    return res.status(200).json(signals || []);
  } catch (err: any) {
    // If scanner had an exception, fallback to instant scan without alert dispatch
    try {
      const scanRes = await executeScan(false);
      return res.status(200).json(scanRes.signals || []);
    } catch {
      return res.status(200).json([]);
    }
  }
}
