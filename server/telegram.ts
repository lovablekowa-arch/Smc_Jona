import { FVGInfo, SMCSignal } from '../src/types';

// Shared rate limiter state across all Telegram calls
let telegramRateLimitUntil = 0;

export function isTelegramRateLimited(): { isLimited: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  if (now < telegramRateLimitUntil) {
    return {
      isLimited: true,
      retryAfterSeconds: Math.ceil((telegramRateLimitUntil - now) / 1000),
    };
  }
  return { isLimited: false, retryAfterSeconds: 0 };
}

// Normalize Bot Token (strip 'bot' prefix if user pasted 'bot123456:ABC...')
export function sanitizeBotToken(token: string | undefined | null): string {
  if (!token) return '';
  let clean = token.toString().trim();
  // Remove wrapping quotes
  clean = clean.replace(/^["']|["']$/g, '');
  // If token starts with 'bot' followed by digits and a colon, strip 'bot'
  if (/^bot\d+:/i.test(clean)) {
    clean = clean.replace(/^bot/i, '');
  }
  return clean.replace(/\s+/g, '');
}

// Normalize Chat ID (trim, remove quotes, keep minus sign if present)
export function sanitizeChatId(chatId: string | number | undefined | null): string {
  if (chatId === undefined || chatId === null) return '';
  let clean = chatId.toString().trim();
  clean = clean.replace(/^["']|["']$/g, '');
  return clean.replace(/\s+/g, '');
}

// Helper to escape HTML characters strictly for Telegram Bot API
function escapeHtml(str: string | number | undefined | null): string {
  if (str === undefined || str === null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Strip HTML tags for 100% resilient plain text delivery
function stripHtmlTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');
}

// Translate Telegram API error messages into clear French action items
function translateTelegramError(errorDesc?: string): string {
  if (!errorDesc) return 'Erreur inconnue de l\'API Telegram';
  const lower = errorDesc.toLowerCase();
  if (lower.includes('too many requests')) {
    const match = errorDesc.match(/retry after (\d+)/i);
    const secs = match ? match[1] : '30';
    return `Limite de requêtes Telegram atteinte. Prochain envoi automatique dans ${secs} secondes.`;
  }
  if (lower.includes('unauthorized') || lower.includes('invalid token')) {
    return 'Token Bot invalide. Vérifiez le token copié depuis @BotFather.';
  }
  if (lower.includes('chat not found')) {
    return 'Chat ID introuvable. Avez-vous envoyé un message ou cliqué sur DÉMARRER (/start) sur votre Bot ?';
  }
  if (lower.includes('bot was blocked by the user')) {
    return 'Le bot a été bloqué dans Telegram. Débloquez-le et appuyez sur /start.';
  }
  if (lower.includes('bot is not a member of the channel') || lower.includes('not enough rights')) {
    return 'Le bot doit être ajouté en tant qu\'Administrateur dans votre canal ou groupe.';
  }
  return errorDesc;
}

export function formatTelegramSignalMessage(signal: SMCSignal): string {
  const isBuy = signal.direction === 'BUY';
  const dirText = isBuy ? '🟢 <b>ACHAT (LONG)</b>' : '🔴 <b>VENTE (SHORT)</b>';

  const gradeHeader =
    signal.confluenceGrade === 'SNIPER'
      ? `🎯 <b>SIGNAL SNIPER (95% - 100%)</b> — ${signal.conditionsMetCount}/5 Confluences ⭐️`
      : signal.confluenceGrade === 'MEDIUM'
      ? `⚡ <b>BON SETUP (75% - 90%)</b> — ${signal.conditionsMetCount}/5 Confluences`
      : `👁️ <b>À SURVEILLER (60% - 70%)</b> — ${signal.conditionsMetCount}/5 Confluences`;

  const categoryLabel =
    signal.category === 'CRYPTO'
      ? '🪙 Crypto'
      : signal.category === 'FOREX'
      ? '💱 Forex Institutionnel'
      : signal.category === 'COMMODITIES'
      ? '🥇 Matières Premières'
      : '⚡ Deriv Synthetics';

  const c1 = signal.confluences.condition1_HTFTrend;
  const c2 = signal.confluences.condition2_FVG_OB;
  const c3 = signal.confluences.condition3_Fibonacci;
  const c4 = signal.confluences.condition4_LiquiditySweep;
  const c5 = signal.confluences.condition5_RSI10;

  const fvgM30 = c2.fvgM30;
  const fvgM15 = c2.fvgM15;
  const fvgM30Text = fvgM30
    ? `• <b>FVG M30 (Structure) :</b> <code>${fvgM30.low > 500 ? fvgM30.low.toFixed(1) : fvgM30.low.toFixed(4)} — ${fvgM30.high > 500 ? fvgM30.high.toFixed(1) : fvgM30.high.toFixed(4)}</code> (${fvgM30.sizePercent}%, ${fvgM30.ageHours}h)`
    : '';

  const fvgM15Text = fvgM15
    ? `• <b>FVG M15 (Zone d'Entrée &amp; POC) :</b> <code>${fvgM15.low > 500 ? fvgM15.low.toFixed(1) : fvgM15.low.toFixed(4)} — ${fvgM15.high > 500 ? fvgM15.high.toFixed(1) : fvgM15.high.toFixed(4)}</code> (POC: <code>${fvgM15.pocPrice || 'N/A'}</code>) ⭐`
    : '';

  const macroFvgText = c2.macroFvgInformativeSummary
    ? `• <i>${escapeHtml(c2.macroFvgInformativeSummary)}</i>`
    : '';

  const ifvg = c2.inversionFVG;
  const ifvgText = ifvg
    ? `• <b>IFVG ${ifvg.timeframe} Inversé (${ifvg.role === 'INVERTED_SUPPORT' ? 'Support 🟢' : 'Résistance 🔴'}) :</b> ${ifvg.sizePercent}% (${ifvg.retested ? 'Retesté' : 'Actif'}) 🔄`
    : '';

  const fvgAncient = c2.ancientMitigatedFVG;
  const fvgAncientText = fvgAncient
    ? `• FVG ${fvgAncient.timeframe} Ancien (${fvgAncient.ageHours}h): DÉJÀ MITIGÉ (100% comblé) ⏳`
    : '';

  const retracementText = c3?.retracementConfirmation
    ? `\n   🔥 <i>${escapeHtml(c3.retracementConfirmation.candleDescription)}</i>`
    : '';

  const rsiText = c5?.rsiInfo
    ? `\n5️⃣ <b>Filtre RSI 10 (H1 &amp; M30):</b> ${c5.satisfied ? '✅ VALIDÉ' : '⚠️ FILTRÉ'}\n   <i>${escapeHtml(c5.rsiInfo.summary)}</i>`
    : '';

  const sweepText = c4?.sweep ? c4.sweep.description : 'Balayage en formation';
  const tp1Target = c4?.restingTargets?.[0] ? `${c4.restingTargets[0].label}` : 'TP1 Interne';
  const tp2Target = c4?.restingTargets?.[1] ? `${c4.restingTargets[1].label}` : 'TP2 Majeur';

  const pCurrent = signal.currentPrice > 500 ? signal.currentPrice.toFixed(2) : signal.currentPrice.toFixed(4);
  const pEntry = signal.entryPrice > 500 ? signal.entryPrice.toFixed(2) : signal.entryPrice.toFixed(4);
  const pSL = signal.stopLoss > 500 ? signal.stopLoss.toFixed(2) : signal.stopLoss.toFixed(4);
  const pTP1 = signal.tp1 > 500 ? signal.tp1.toFixed(2) : signal.tp1.toFixed(4);
  const pTP2 = signal.tp2 > 500 ? signal.tp2.toFixed(2) : signal.tp2.toFixed(4);

  // Obstacle & Roadmap text
  let roadmapText = '';
  if (signal.pathObstacleAnalysis) {
    if (signal.pathObstacleAnalysis.hasObstacle && signal.pathObstacleAnalysis.primaryObstacle) {
      const ob = signal.pathObstacleAnalysis.primaryObstacle;
      roadmapText = `\n⚠️ <b>OBSTACLE DÉTECTÉ SUR LE CHEMIN :</b>\n🛑 <b>${escapeHtml(ob.label)}</b> à <code>${ob.priceLevel}</code> (${ob.volumeAmount ? `Vol: ${ob.volumeAmount}` : ''})\n👉 <i>Sécurisation ou TP partiel conseillé à ce niveau avant ${ob.blocksTarget === 'BEFORE_TP1' ? 'TP1' : 'TP2'}.</i>\n`;
    } else {
      roadmapText = `\n🟢 <b>CHEMIN 100% OUVERT :</b>\n✨ <i>Voie libre vers TP1 &amp; TP2 (Aucun FVG opposé bloquant).</i>\n`;
    }
  }

  return `${gradeHeader}

📊 <b>Paire:</b> <code>${escapeHtml(signal.pair)}</code> (${categoryLabel})
🧭 <b>Direction:</b> ${dirText}
💰 <b>Prix Actuel:</b> <code>${pCurrent}</code>
━━━━━━━━━━━━━━━━━━━━
🎯 <b>PLAN D'EXÉCUTION SMC :</b>
🔹 <b>Entrée (Entry):</b> <code>${pEntry}</code>
🛑 <b>Stop Loss (SL):</b> <code>${pSL}</code>
🎯 <b>Cible 1 (TP1):</b> <code>${pTP1}</code> (<i>${escapeHtml(tp1Target)}</i>)
🎯 <b>Cible 2 (TP2):</b> <code>${pTP2}</code> (<i>${escapeHtml(tp2Target)}</i>)
⚖️ <b>Ratio R:R:</b> <code>1 : ${escapeHtml(signal.riskRewardRatio)}</code>${roadmapText}━━━━━━━━━━━━━━━━━━━━
🔍 <b>ANALYSE DES 5 CONFLUENCES :</b>
1️⃣ <b>Tendance HTF (1D / 4H / 30M):</b> ${c1.satisfied ? '✅ VALIDÉ' : '⚠️ PARTIEL'}
   <i>${escapeHtml(c1.summary)}</i>
2️⃣ <b>Suite FVG M30 &amp; M15 (Alignement Obligatoire) :</b> ${c2.satisfied ? '✅ VALIDÉ' : '⚠️ EN ATTENTE'}
${fvgM30Text ? `   ${fvgM30Text}\n` : ''}${fvgM15Text ? `   ${fvgM15Text}\n` : ''}${macroFvgText ? `   ${macroFvgText}\n` : ''}${ifvgText ? `   ${ifvgText}\n` : ''}${fvgAncientText ? `   ${fvgAncientText}` : ''}
3️⃣ <b>Fibonacci &amp; Bougie Confirmation:</b> ${c3.satisfied ? '✅ VALIDÉ' : '⚠️ NEUTRE'}
   <i>${escapeHtml(c3.summary)}</i>${retracementText}
4️⃣ <b>Balayage Liquidité Sweep 💧:</b> ${c4.satisfied ? '✅ VALIDÉ' : '⚠️ FORMATION'}
   <i>${escapeHtml(sweepText)}</i>${rsiText}
━━━━━━━━━━━━━━━━━━━━
⏰ <b>Déclenché à:</b> ${escapeHtml(signal.formattedTime)} (Scan 24/7 SMC Engine)`;
}

export function formatTelegramFVGTapInMessage(signal: SMCSignal, fvg: FVGInfo): string {
  const isBuy = signal.direction === 'BUY';
  const dirText = isBuy ? '🟢 <b>ACHAT (LONG)</b>' : '🔴 <b>VENTE (SHORT)</b>';
  const isTestingPOC = fvg.fvgRetracementState === 'TESTING_POC';

  const categoryLabel =
    signal.category === 'CRYPTO'
      ? '🪙 Crypto'
      : signal.category === 'FOREX'
      ? '💱 Forex'
      : signal.category === 'COMMODITIES'
      ? '🥇 Matières Premières'
      : '⚡ Deriv Synthetics';

  const fvgLowStr = fvg.low > 500 ? fvg.low.toFixed(2) : fvg.low.toFixed(4);
  const fvgHighStr = fvg.high > 500 ? fvg.high.toFixed(2) : fvg.high.toFixed(4);
  const currentPriceStr = signal.currentPrice > 500 ? signal.currentPrice.toFixed(2) : signal.currentPrice.toFixed(4);

  const pEntry = signal.entryPrice > 500 ? signal.entryPrice.toFixed(2) : signal.entryPrice.toFixed(4);
  const pSL = signal.stopLoss > 500 ? signal.stopLoss.toFixed(2) : signal.stopLoss.toFixed(4);
  const pTP1 = signal.tp1 > 500 ? signal.tp1.toFixed(2) : signal.tp1.toFixed(4);
  const pTP2 = signal.tp2 > 500 ? signal.tp2.toFixed(2) : signal.tp2.toFixed(4);

  return `🚨 <b>ALERTE RETRACEMENT FVG — ENTRÉE ACTIVÉE !</b> 🎯
━━━━━━━━━━━━━━━━━━━━
📊 <b>Paire:</b> <code>${escapeHtml(signal.pair)}</code> (${categoryLabel})
🧭 <b>Biais SMC:</b> ${dirText}
💰 <b>Prix Actuel:</b> <code>${currentPriceStr}</code>

📍 <b>STATUT DU RETRACEMENT :</b>
${isTestingPOC ? '🔥 <b>LE PRIX TESTE LE POC INTRA-FVG DIRECTEMENT !</b>' : '⚡ <b>Le prix a pénétré dans la zone du FVG !</b>'}
• <b>Zone FVG (${escapeHtml(fvg.timeframe)}):</b> <code>${fvgLowStr} — ${fvgHighStr}</code>
• <b>Comblement (Fill):</b> <code>${fvg.fvgFillPercentage ?? 50}%</code>
• <b>POC Volume Maximal:</b> <code>${escapeHtml(fvg.pocPrice ?? 'N/A')}</code> ${fvg.highProbability ? '⭐ (Haute Probabilité)' : ''}

━━━━━━━━━━━━━━━━━━━━
🎯 <b>PLAN D'EXÉCUTION SMC :</b>
🔹 <b>Zone d'Entrée (Entry):</b> <code>${pEntry}</code>
🛑 <b>Stop Loss (SL):</b> <code>${pSL}</code>
🎯 <b>Cible 1 (TP1):</b> <code>${pTP1}</code>
🎯 <b>Cible 2 (TP2):</b> <code>${pTP2}</code>
⚖️ <b>Ratio R:R:</b> <code>1 : ${escapeHtml(signal.riskRewardRatio)}</code>

💡 <i>Surveillez la réaction du carnet d'ordres ou les rejets en M1/M5 pour valider l'entrée au contact du POC.</i>
⏰ <b>Heure:</b> ${escapeHtml(signal.formattedTime)}`;
}

export async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  htmlText: string
): Promise<{ success: boolean; error?: string }> {
  const cleanToken = sanitizeBotToken(botToken);
  const cleanChatId = sanitizeChatId(chatId);

  if (!cleanToken || !cleanChatId) {
    return { success: false, error: 'Token Bot ou Chat ID manquant ou invalide.' };
  }

  // Check rate limit state before hitting Telegram
  const rateLimit = isTelegramRateLimited();
  if (rateLimit.isLimited) {
    console.warn(`[Telegram API] Blocked by active rate limiter. Retry after ${rateLimit.retryAfterSeconds}s.`);
    return {
      success: false,
      error: `Limite Telegram active (429). Prochain envoi possible dans ${rateLimit.retryAfterSeconds}s.`,
    };
  }

  const url = `https://api.telegram.org/bot${cleanToken}/sendMessage`;
  console.log(`[Telegram API] Attempting to send message to Chat ID "${cleanChatId}"...`);

  try {
    // 1ère tentative : Envoi en mode HTML formaté
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: cleanChatId,
        text: htmlText,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(10000),
    });

    const data = (await res.json()) as {
      ok: boolean;
      description?: string;
      error_code?: number;
      parameters?: { retry_after?: number };
    };

    if (data.ok) {
      console.log(`[Telegram API] Message successfully delivered to ${cleanChatId}`);
      return { success: true };
    }

    // Check if error is Rate Limit (429 / Too Many Requests)
    const isRateLimit =
      res.status === 429 ||
      data.error_code === 429 ||
      Boolean(data.description && /too many requests/i.test(data.description));

    if (isRateLimit) {
      let retrySecs = data.parameters?.retry_after;
      if (!retrySecs && data.description) {
        const match = data.description.match(/retry after (\d+)/i);
        if (match) retrySecs = parseInt(match[1], 10);
      }
      retrySecs = retrySecs && retrySecs > 0 ? retrySecs : 30;
      telegramRateLimitUntil = Date.now() + retrySecs * 1000 + 1500; // safety margin

      const translated = translateTelegramError(data.description);
      console.warn(`[Telegram API] Rate limit hit for ${cleanChatId}. Cooling down for ${retrySecs}s.`);
      return { success: false, error: translated };
    }

    // If it's a formatting error (parse_mode error), fallback to plain text once
    const isFormattingError =
      data.description &&
      /can't parse entities|unsupported start tag|bad formatting|character/i.test(data.description);

    if (isFormattingError) {
      console.warn(`[Telegram API] HTML formatting failed (${data.description}), retrying with Plain Text fallback...`);
      const plainText = stripHtmlTags(htmlText);
      const retryRes = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: cleanChatId,
          text: plainText,
          disable_web_page_preview: true,
        }),
        signal: AbortSignal.timeout(10000),
      });

      const retryData = (await retryRes.json()) as {
        ok: boolean;
        description?: string;
        error_code?: number;
        parameters?: { retry_after?: number };
      };

      if (retryData.ok) {
        console.log(`[Telegram API] Fallback plain text successfully delivered to ${cleanChatId}`);
        return { success: true };
      }

      if (retryData.error_code === 429 || (retryData.description && /too many requests/i.test(retryData.description))) {
        let retrySecs = retryData.parameters?.retry_after || 30;
        telegramRateLimitUntil = Date.now() + retrySecs * 1000 + 1500;
      }

      const translated = translateTelegramError(retryData.description || data.description);
      console.error(`[Telegram API] Error for Chat ID ${cleanChatId}:`, translated);
      return { success: false, error: translated };
    }

    const translated = translateTelegramError(data.description);
    console.error(`[Telegram API] Error for Chat ID ${cleanChatId}:`, translated);
    return { success: false, error: translated };
  } catch (err: any) {
    console.error(`[Telegram API] Network error contacting Telegram for ${cleanChatId}:`, err.message);
    return { success: false, error: `Erreur réseau Telegram : ${err.message}` };
  }
}

export async function sendTelegramTestAlert(
  botToken: string,
  chatId: string
): Promise<{ success: boolean; error?: string }> {
  const testMessage = `🤖 <b>TEST DE CONNEXION RÉUSSI !</b>
━━━━━━━━━━━━━━━━━━━━
✅ <b>Félicitations !</b> Votre Bot Telegram est parfaitement connecté au Scanner SMC 24/7.
📡 <b>Mode:</b> Alertes automatiques en direct &amp; Arrière-plan.
🎯 <b>Conditions:</b> 5/5 Confluences Sniper (1D/4H/30M + FVG/POC + Retracement + Sweep 💧 + RSI 10).

Vous recevrez désormais tous vos signaux institutionnels directement sur votre smartphone ! 📱`;

  return sendTelegramMessage(botToken, chatId, testMessage);
}
