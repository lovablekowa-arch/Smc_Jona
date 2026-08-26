import { FVGInfo, SMCSignal } from '../src/types';

// Helper to escape HTML characters for Telegram Bot API
function escapeHtml(str: string | number | undefined | null): string {
  if (str === undefined || str === null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Strip HTML tags for fallback delivery
function stripHtmlTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');
}

export function formatTelegramSignalMessage(signal: SMCSignal): string {
  const isBuy = signal.direction === 'BUY';
  const dirText = isBuy ? '🟢 <b>ACHAT (LONG)</b>' : '🔴 <b>VENTE (SHORT)</b>';
  
  const gradeHeader = signal.confluenceGrade === 'SNIPER'
    ? '🎯 <b>SIGNAL SNIPER (95% - 100%)</b> — 4/4 Confluences'
    : signal.confluenceGrade === 'MEDIUM'
    ? '⚡ <b>BON SETUP (75% - 90%)</b> — 3/4 Confluences'
    : '👁️ <b>À SURVEILLER (60% - 70%)</b> — 2/4 Confluences';

  const categoryLabel = signal.category === 'CRYPTO'
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

  const fvgRecent = c2.recentUnmitigatedFVG;
  const fvgRecentText = fvgRecent
    ? `• FVG ${fvgRecent.timeframe} Récent (${fvgRecent.ageHours}h): NON MITIGÉ (Taille: ${fvgRecent.sizePercent}% | POC: ${fvgRecent.pocPrice || 'N/A'}${fvgRecent.stdevRatio ? ` | σ: ${fvgRecent.stdevRatio}` : ''}) ${fvgRecent.highProbability ? '⭐ [Haute Probabilité]' : '✅'}`
    : '• FVG Récent: Non détecté';

  const ifvg = c2.inversionFVG;
  const ifvgText = ifvg
    ? `• IFVG ${ifvg.timeframe} Inversé (${ifvg.role === 'INVERTED_SUPPORT' ? 'Support 🟢' : 'Résistance 🔴'}): ${ifvg.sizePercent}% (${ifvg.retested ? 'Retesté' : 'Actif'}) 🔄`
    : '• IFVG: Non actif';

  const fvgAncient = c2.ancientMitigatedFVG;
  const fvgAncientText = fvgAncient
    ? `• FVG ${fvgAncient.timeframe} Ancien (${fvgAncient.ageHours}h): DÉJÀ MITIGÉ (100% comblé - ${fvgAncient.sizePercent}%) ⏳`
    : '• FVG Ancien: Aucun résiduel';

  const sweepText = c4.sweep ? c4.sweep.description : 'Balayage en formation';
  const tp1Target = c4.restingTargets[0] ? `${c4.restingTargets[0].label}` : 'TP1 Interne';
  const tp2Target = c4.restingTargets[1] ? `${c4.restingTargets[1].label}` : 'TP2 Majeur';

  const pCurrent = signal.currentPrice > 500 ? signal.currentPrice.toFixed(2) : signal.currentPrice.toFixed(4);
  const pEntry = signal.entryPrice > 500 ? signal.entryPrice.toFixed(2) : signal.entryPrice.toFixed(4);
  const pSL = signal.stopLoss > 500 ? signal.stopLoss.toFixed(2) : signal.stopLoss.toFixed(4);
  const pTP1 = signal.tp1 > 500 ? signal.tp1.toFixed(2) : signal.tp1.toFixed(4);
  const pTP2 = signal.tp2 > 500 ? signal.tp2.toFixed(2) : signal.tp2.toFixed(4);

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
⚖️ <b>Ratio R:R:</b> <code>1 : ${escapeHtml(signal.riskRewardRatio)}</code>
━━━━━━━━━━━━━━━━━━━━
🔍 <b>ANALYSE DES 4 CONFLUENCES :</b>
1️⃣ <b>Tendance HTF:</b> ${c1.satisfied ? '✅ VALIDÉ' : '⚠️ PARTIEL'}
   <i>${escapeHtml(c1.summary)}</i>
2️⃣ <b>FVG &amp; IFVG Inversé:</b> ${c2.satisfied ? '✅ VALIDÉ' : '⚠️ EN ATTENTE'}
   <i>${escapeHtml(fvgRecentText)}</i>
   <i>${escapeHtml(ifvgText)}</i>
   <i>${escapeHtml(fvgAncientText)}</i>
3️⃣ <b>Fibonacci Discount/Premium:</b> ${c3.satisfied ? '✅ VALIDÉ' : '⚠️ NEUTRE'}
   <i>${escapeHtml(c3.summary)}</i>
4️⃣ <b>Balayage Liquidité Sweep 💧:</b> ${c4.satisfied ? '✅ VALIDÉ' : '⚠️ FORMATION'}
   <i>${escapeHtml(sweepText)}</i>
━━━━━━━━━━━━━━━━━━━━
⏰ <b>Déclenché à:</b> ${escapeHtml(signal.formattedTime)} (Scan 24/7 SMC Engine)`;
}

export function formatTelegramFVGTapInMessage(signal: SMCSignal, fvg: FVGInfo): string {
  const isBuy = signal.direction === 'BUY';
  const dirText = isBuy ? '🟢 <b>ACHAT (LONG)</b>' : '🔴 <b>VENTE (SHORT)</b>';
  const isTestingPOC = fvg.fvgRetracementState === 'TESTING_POC';

  const categoryLabel = signal.category === 'CRYPTO'
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
  if (!botToken || !chatId) {
    return { success: false, error: 'Token Bot ou Chat ID manquant' };
  }

  const cleanToken = botToken.toString().replace(/\s+/g, '');
  const cleanChatId = chatId.toString().replace(/\s+/g, '');
  const url = `https://api.telegram.org/bot${cleanToken}/sendMessage`;

  try {
    // 1ère tentative : Envoi en mode HTML formatté
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: cleanChatId,
        text: htmlText,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(9000),
    });

    const data = (await res.json()) as { ok: boolean; description?: string };
    if (data.ok) {
      return { success: true };
    }

    console.warn('[Telegram API] Failed with HTML parse_mode:', data.description);

    // 2ème tentative (Fallback de sécurité garanti) : Envoi en texte brut sans formatage pour ne JAMAIS perdre l'alerte
    const plainText = stripHtmlTags(htmlText);
    const retryRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: cleanChatId,
        text: plainText,
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(9000),
    });

    const retryData = (await retryRes.json()) as { ok: boolean; description?: string };
    if (retryData.ok) {
      return { success: true };
    }

    return { success: false, error: retryData.description || data.description || 'Erreur API Telegram' };
  } catch (err: any) {
    return { success: false, error: err.message || 'Impossible de contacter Telegram' };
  }
}

export async function sendTelegramTestAlert(botToken: string, chatId: string): Promise<{ success: boolean; error?: string }> {
  const testMessage = `🤖 <b>TEST CONNEXION BOT TELEGRAM — SMC &amp; LIQUIDITY</b>
━━━━━━━━━━━━━━━━━━━━
✅ <b>Félicitations !</b> Votre Bot Telegram est parfaitement configuré.
📡 <b>Mode:</b> Scan automatique 24/7 en arrière-plan.
💧 <b>Signaux:</b> Confluences SMC, FVG Récent/Ancien, POC Volume &amp; Balayage Liquidité.

Vous recevrez désormais vos alertes directement sur votre Telegram sans aucune interruption !`;
  return sendTelegramMessage(botToken, chatId, testMessage);
}
