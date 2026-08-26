import { executeScan } from '../server/scanner';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const isManual = req.method === 'POST';
    const result = await executeScan(isManual);
    return res.status(200).json(result);
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err.message || 'Error executing scan',
      signals: [],
      alertsDispatched: 0,
      timestamp: Date.now(),
    });
  }
}
