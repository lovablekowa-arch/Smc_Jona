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
  unmuteTradePair,
  updateSettings,
} from './server/scanner';
import { formatTelegramSignalMessage, sanitizeBotToken, sanitizeChatId, sendTelegramMessage, sendTelegramTestAlert } from './server/telegram';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Start background 24/7 SMC Scanner
  startBackgroundScanner();

  // Health check & bot status
  app.get('/api/health', (req, res) => {
    const s = getSettings();
    res.json({
      status: 'ok',
      engine: 'SMC 5-Confluences & Liquidity Scanner 24/7',
      telegramConfigured: Boolean(s.botToken && s.chatId),
      telegramEnabled: s.enabled !== false,
      timestamp: Date.now(),
    });
  });

  // Cron Trigger Endpoint (Accessible via GET or POST for any cron-job service / curl / uptime monitor)
  const handleCronOrScan = async (req: express.Request, res: express.Response) => {
    try {
      const customToken = req.body?.botToken || (req.query?.botToken as string);
      const customChatId = req.body?.chatId || (req.query?.chatId as string);
      const force = req.body?.force === true || req.query?.force === 'true';

      const result = await executeScan(true, customToken, customChatId);
      res.json({
        success: true,
        message: `Scan exécuté avec succès. ${result.signals.length} signaux analysés, ${result.alertsDispatched} alerte(s) Telegram expédiée(s).`,
        ...result,
      });
    } catch (err: any) {
      console.error('[API /api/cron or /api/scan error]:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  };

  app.get('/api/cron', handleCronOrScan);
  app.post('/api/cron', handleCronOrScan);
  app.get('/api/scan', handleCronOrScan);
  app.post('/api/scan', handleCronOrScan);

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
      const botToken = sanitizeBotToken(req.body.botToken || getSettings().botToken);
      const chatId = sanitizeChatId(req.body.chatId || getSettings().chatId);

      if (!botToken || !chatId) {
        return res.status(400).json({
          success: false,
          error: 'Veuillez saisir votre Token Bot et Chat ID pour tester la connexion.',
        });
      }

      const result = await sendTelegramTestAlert(botToken, chatId);
      if (result.success) {
        // Update valid credentials automatically in settings
        updateSettings({ botToken, chatId, enabled: true });
      }
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Send a specific signal to Telegram manually
  app.post('/api/telegram/send-signal', async (req, res) => {
    try {
      const { signal, botToken: bodyToken, chatId: bodyChat } = req.body;
      const token = sanitizeBotToken(bodyToken || getSettings().botToken);
      const chat = sanitizeChatId(bodyChat || getSettings().chatId);

      if (!token || !chat) {
        return res.status(400).json({
          success: false,
          error: 'Token Bot ou Chat ID manquant. Veuillez configurer vos identifiants dans les Paramètres.',
        });
      }

      if (!signal) {
        return res.status(400).json({ success: false, error: 'Données du signal manquantes.' });
      }

      const msg = formatTelegramSignalMessage(signal);
      const result = await sendTelegramMessage(token, chat, msg);
      res.json(result);
    } catch (err: any) {
      console.error('[API /api/telegram/send-signal error]:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Mark trade taken (mute pair for 6h)
  app.post('/api/take-trade', (req, res) => {
    try {
      const { pairSymbol, hours, signal } = req.body;
      const result = muteTradePair(pairSymbol, hours || 6, signal);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Unmute trade pair
  app.post('/api/unmute-pair', (req, res) => {
    try {
      const { pairSymbol } = req.body;
      const result = unmuteTradePair(pairSymbol);
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
