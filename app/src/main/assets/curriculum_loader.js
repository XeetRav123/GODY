// ── CURRICULUM LOADER ────────────────────────────────────────
// Загружает Curriculum.json в глобальную переменную GODY_CURRICULUM
// чтобы IntentPromptBuilder мог находить знания по теме.

window.GODY_CURRICULUM = null;

(async function _loadCurriculum() {
  try {
    const r = await fetch('./Curriculum.json');
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    window.GODY_CURRICULUM = await r.json();
    console.log('[Curriculum] ✓ Загружен:', GODY_CURRICULUM.levels?.length, 'уровней');

    // Применяем отложенный патч IntentPromptBuilder если Voice уже готов
    if (window._intentPatchPending && typeof Voice !== 'undefined') {
      window._intentPatchPending = false;
      // IntentPromptBuilder уже загружен — просто вызываем патч снова
      const orig = Voice.speak.bind(Voice);
      Voice._origSpeakBeforeIntent = orig;
      Voice.speak = async function(internal, userText) {
        if (typeof API === 'undefined' || !API.anyAvailable?.()) return orig(internal, userText);
        try {
          const hist = typeof DlgCtx !== 'undefined' ? (DlgCtx.messages || []).slice(-4) : [];
          const messages = IntentPromptBuilder.buildMessages(internal, userText, hist);
          const result = await API.call(messages, 150);
          if (result && result.trim().length > 2) {
            if (typeof SpeechMemory !== 'undefined' && internal?.rawThought)
              SpeechMemory.learn(internal.rawThought, result.trim(), internal?.emotion?.name);
            return result.trim();
          }
        } catch (e) { console.warn('[IntentPromptBuilder] Ошибка:', e); }
        return orig(internal, userText);
      };
      console.log('[IntentPromptBuilder] ✓ Отложенный патч применён');
    }
  } catch (e) {
    console.warn('[Curriculum] Не загружен:', e.message);
  }
})();
