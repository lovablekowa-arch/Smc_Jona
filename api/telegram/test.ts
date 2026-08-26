import { sendTelegramTestAlert } from '../../server/telegram';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { botToken, chatId } = body || {};
    const result = await sendTelegramTestAlert(botToken, chatId);
    return res.status(200).json(result);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Error testing Telegram' });
  }
}
