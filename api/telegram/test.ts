import { sendTelegramTestAlert } from '../../server/telegram';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const rawToken = body.botToken || '';
    const rawChat = body.chatId || '';
    const cleanToken = rawToken.toString().replace(/\s+/g, '');
    const cleanChat = rawChat.toString().replace(/\s+/g, '');

    if (!cleanToken || !cleanChat) {
      return res.status(400).json({ success: false, error: 'Token Bot ou Chat ID manquant' });
    }

    const result = await sendTelegramTestAlert(cleanToken, cleanChat);
    return res.status(200).json(result);
  } catch (err: any) {
    return res.status(200).json({ success: false, error: err.message || 'Erreur d\'envoi Telegram' });
  }
}
