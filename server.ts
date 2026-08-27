import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { getAllLivePairs } from './server/marketData';
import {
  executeScan,
  getHistory,
  getLatestSignals,
  getSettings,
  muteTradePair,
  startBackgroundScanner,
  updateSettings,
} from './server/scanner';
import { analyzePairSMC } from './server/smcEngine';
import { formatTelegramSignalMessage, sendTelegramMessage, sendTelegramTestAlert } from './server/telegram';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Start background 24/7 SMC Scanner
  startBackgroundScanner();

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      engine: 'SMC 5-Confluences & Liquidity Scanner',
      timestamp: Date.now(),
    });
  });

  // Get live pairs
  app.get('/api/pairs', async (req, res) => {
    try {
      const pairs = await getAllLivePairs();
      res.json(pairs);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get current SMC signals
  app.get('/api/signals', async (req, res) => {
    try {
      let signals = getLatestSignals();
      if (!signals || signals.length === 0) {
        const scanRes = await executeScan(false);
        signals = scanRes.signals;
      }
      res.json(signals || []);
    } catch (err: any) {
      console.warn('[API /api/signals] fallback handling:', err.message);
      res.json(getLatestSignals() || []);
    }
  });

  // Trigger manual on-demand scan
  app.post('/api/scan', async (req, res) => {
    try {
      const result = await executeScan(true);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get current settings
  app.get('/api/settings', (req, res) => {
    try {
      const settings = getSettings();
      res.json(settings);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Update settings
  app.post('/api/settings', (req, res) => {
    try {
      const updated = updateSettings(req.body);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Test Telegram credentials
  app.post('/api/telegram/test', async (req, res) => {
    try {
      const { botToken, chatId } = req.body;
      const result = await sendTelegramTestAlert(botToken, chatId);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Send a specific signal to Telegram manually
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

  // Mark trade taken (mute pair for 6h)
  app.post('/api/take-trade', (req, res) => {
    try {
      const { pairSymbol, hours } = req.body;
      const result = muteTradePair(pairSymbol, hours || 6);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get alert history
  app.get('/api/history', (req, res) => {
    try {
      const history = getHistory();
      res.json(history);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Vite middleware setup
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SMC SERVER] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
