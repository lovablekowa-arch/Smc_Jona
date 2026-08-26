import { getSettings } from '../../server/scanner';
import { formatTelegramSignalMessage, sendTelegramMessage } from '../../server/telegram';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { signal, botToken, chatId } = body || {};
    const token = botToken || getSettings().botToken;
    const chat = chatId || getSettings().chatId;

    if (!token || !chat) {
      return res.status(400).json({ success: false, error: 'Token Bot ou Chat ID manquant' });
    }

    const msg = formatTelegramSignalMessage(signal);
    const result = await sendTelegramMessage(token, chat, msg);
    return res.status(200).json(result);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Error sending signal to Telegram' });
  }
}
