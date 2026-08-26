import express from 'express';
import { getAllLivePairs } from '../server/marketData';
import {
  executeScan,
  getHistory,
  getLatestSignals,
  getSettings,
  muteTradePair,
  updateSettings,
} from '../server/scanner';
import { formatTelegramSignalMessage, sendTelegramMessage, sendTelegramTestAlert } from '../server/telegram';

const app = express();
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    engine: 'SMC 4-Confluences & Liquidity Scanner (Vercel Serverless Ready)',
    timestamp: Date.now(),
  });
});

app.get('/api/pairs', async (req, res) => {
  try {
    const pairs = await getAllLivePairs();
    res.json(pairs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/signals', async (req, res) => {
  try {
    let signals = getLatestSignals();
    if (!signals || signals.length === 0) {
      const scanRes = await executeScan(false);
      signals = scanRes.signals;
    }
    res.json(signals || []);
  } catch (err: any) {
    res.json(getLatestSignals() || []);
  }
});

app.post('/api/scan', async (req, res) => {
  try {
    const result = await executeScan(true);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/settings', (req, res) => {
  try {
    res.json(getSettings());
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/settings', (req, res) => {
  try {
    const updated = updateSettings(req.body);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/telegram/test', async (req, res) => {
  try {
    const { botToken, chatId } = req.body;
    const result = await sendTelegramTestAlert(botToken, chatId);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/telegram/send-signal', async (req, res) => {
  try {
    const { signal, botToken, chatId } = req.body;
    const token = botToken || getSettings().botToken;
    const chat = chatId || getSettings().chatId;

    if (!token || !chat) {
      return res.status(400).json({ success: false, error: 'Token Bot ou Chat ID manquant' });
    }

    const msg = formatTelegramSignalMessage(signal);
    const result = await sendTelegramMessage(token, chat, msg);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/take-trade', (req, res) => {
  try {
    const { pairSymbol, hours } = req.body;
    const result = muteTradePair(pairSymbol, hours || 6);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/history', (req, res) => {
  try {
    res.json(getHistory());
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default app;
