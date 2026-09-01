// ── LAMINI VOICE — офлайн голос GODY через LaMini-Flan-T5-248M ──
// Подключи в HTML ПОСЛЕ transformers.min.js:
//   <script src="LaMiniVoice.js"></script>
//
// Модель лежит в: assets/lamini/

const LaMiniVoice = {
  pipeline: null,
  loading: false,
  ready: false,
  error: null,
  MODEL_PATH: './lamini/',

  async load() {
    if (this.ready || this.loading) return;
    this.loading = true;
    console.log('[LaMiniVoice] Загрузка...');
    try {
      this.pipeline = await window.transformers.pipeline(
        'text2text-generation',
        this.MODEL_PATH,
        {
          quantized: true,
          local_files_only: true,
          session_options: { executionProviders: ['cpu'] },
        }
      );
      this.ready = true;
      this.loading = false;
      console.log('[LaMiniVoice] ✓ Готов');
    } catch(e) {
      this.error = String(e);
      this.loading = false;
      console.error('[LaMiniVoice] Ошибка:', e);
    }
  },

  // Строим промпт для LaMini из внутреннего состояния GODY
  buildPrompt(internal) {
    const act     = internal?.act || 'react';
    const emotion = internal?.emotion?.name || 'contentment';
    const thought = String(internal?.rawThought || internal?.rawAnswer || '').trim().slice(0, 100);
    const topic   = internal?.dialogTopic || '';
    const gap     = internal?.gaps?.[0] || '';

    // LaMini обучена на инструкциях — даём чёткую задачу
    let prompt = `You are GODY, a living AI creature. Speak in Russian. `;
    prompt += `Your emotion: ${emotion}. Your intention: ${act}. `;
    if (thought) prompt += `Your inner thought: "${thought}". `;
    if (topic)   prompt += `Topic: ${topic}. `;
    if (gap)     prompt += `You don't understand: ${gap}. `;
    prompt += `Say one short phrase in Russian as GODY:`;

    return prompt;
  },

  async speak(internal, maxNewTokens = 80) {
    if (!this.ready) return null;

    const prompt = this.buildPrompt(internal);
    console.log('[LaMiniVoice] Промпт:', prompt);

    try {
      const result = await this.pipeline(prompt, {
        max_new_tokens: maxNewTokens,
        do_sample: true,
        temperature: 0.85,
        top_p: 0.92,
        repetition_penalty: 1.3,
      });

      const text = result?.[0]?.generated_text?.trim();
      if (!text || text.length < 2) return null;

      // Убираем английские артефакты если LaMini ответила по-английски
      const hasRussian = /[а-яё]/i.test(text);
      if (!hasRussian) {
        console.warn('[LaMiniVoice] Ответ не на русском, пропускаем');
        return null;
      }

      console.log('[LaMiniVoice] ✓ Речь:', text);
      return text;
    } catch(e) {
      console.error('[LaMiniVoice] Ошибка генерации:', e);
      return null;
    }
  },

  status() {
    if (this.ready)   return '🟢 LaMini готов';
    if (this.loading) return '🟡 LaMini загружается...';
    if (this.error)   return `🔴 LaMini ошибка: ${this.error.slice(0,60)}`;
    return '⚪ LaMini не загружен';
  }
};

// ── Патч Voice.speak ─────────────────────────────────────────
// Цепочка: Онлайн LLM → LaMini офлайн → _offlineSynth fallback
(function _patchVoiceLaMini() {
  if (typeof Voice === 'undefined') {
    window._laminiPatchPending = true;
    return;
  }

  const _orig = Voice.speak.bind(Voice);
  Voice._origBeforeLaMini = _orig;

  Voice.speak = async function(internal, userText) {
    // Онлайн — используем API как раньше
    if (typeof API !== 'undefined' && API.anyAvailable?.()) {
      return _orig(internal, userText);
    }

    // Офлайн — пробуем LaMini
    if (LaMiniVoice.ready) {
      const r = await LaMiniVoice.speak(internal);
      if (r) {
        if (typeof SpeechMemory !== 'undefined' && internal?.rawThought)
          SpeechMemory.learn(internal.rawThought, r, internal?.emotion?.name);
        return r;
      }
    }

    // Fallback — mT5 или _offlineSynth
    return _orig(internal, userText);
  };

  console.log('[LaMiniVoice] ✓ Voice.speak патч применён');
})();
