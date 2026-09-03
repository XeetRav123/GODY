// ── LAMINI VOICE — офлайн рот GODY (LaMini-Flan-T5) ──
// Мозг (GODY) уже решил ЧТО сказать → сюда только оформление речи.
// Всё лежит плоско в assets/ (без папки lamini/):
//   config.json, tokenizer.json, tokenizer_config.json,
//   special_tokens_map.json, encoder/decoder onnx, этот файл.
//
// Подключение в HTML ПОСЛЕ transformers.min.js:
//   <script src="LaMiniVoice.js"></script>

const LaMiniVoice = {
  pipeline: null,
  loading: false,
  ready: false,
  error: null,
  // Плоский assets/ — без вложенных папок на GitHub
  MODEL_PATH: './',

  async load() {
    if (this.ready || this.loading) return;
    this.loading = true;
    console.log('[LaMiniVoice] Загрузка из', this.MODEL_PATH);
    try {
      if (!window.transformers || !window.transformers.pipeline) {
        throw new Error('transformers.js не загружен');
      }
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
    } catch (e) {
      this.error = String(e);
      this.loading = false;
      console.error('[LaMiniVoice] Ошибка:', e);
    }
  },

  /**
   * Рот, не личность.
   * GODY уже положила смысл в rawAnswer / rawThought —
   * модель только переписывает в короткую живую фразу.
   */
  buildPrompt(internal) {
    const content = String(
      internal?.rawAnswer || internal?.rawThought || ''
    ).trim();

    const emotion = internal?.emotion?.name || '';
    const act = internal?.act || '';
    const topic = internal?.dialogTopic || '';

    // НЕ "You are GODY" — только оформление готового содержания
    let prompt =
      'Ниже готовое содержание ответа системы GODY.\n' +
      'Перепиши только в одну короткую естественную фразу на русском.\n' +
      'Не добавляй новых фактов. Не меняй смысл. Не представляйся.\n';

    if (emotion) prompt += `Тон: ${emotion}.\n`;
    if (act) prompt += `Намерение: ${act}.\n`;
    if (topic) prompt += `Тема: ${topic}.\n`;

    prompt +=
      '\nСодержание:\n' +
      (content
        ? content.slice(0, 280)
        : '(пусто — скажи коротко, что пока нечего сказать)') +
      '\n\nФраза:';

    return prompt;
  },

  async speak(internal, maxNewTokens = 80) {
    if (!this.ready) return null;

    const content = String(
      internal?.rawAnswer || internal?.rawThought || ''
    ).trim();

    // Пустое содержание — не просим модель «быть GODY», пусть сработает fallback
    if (!content) {
      console.warn('[LaMiniVoice] Нет rawAnswer/rawThought — пропуск');
      return null;
    }

    const prompt = this.buildPrompt(internal);
    console.log('[LaMiniVoice] Промпт:', prompt);

    try {
      const result = await this.pipeline(prompt, {
        max_new_tokens: maxNewTokens,
        do_sample: true,
        temperature: 0.7,
        top_p: 0.9,
        repetition_penalty: 1.25,
      });

      let text = result?.[0]?.generated_text?.trim() || '';
      // Иногда модели возвращают промпт+ответ — отрезаем хвост после маркера
      const marker = 'Фраза:';
      const idx = text.lastIndexOf(marker);
      if (idx !== -1) text = text.slice(idx + marker.length).trim();

      if (!text || text.length < 2) return null;

      const hasRussian = /[а-яё]/i.test(text);
      if (!hasRussian) {
        console.warn('[LaMiniVoice] Ответ не на русском, пропускаем');
        return null;
      }

      // Убираем кавычки-обёртки если модель их добавила
      text = text.replace(/^["«]+|["»]+$/g, '').trim();

      console.log('[LaMiniVoice] ✓ Речь:', text);
      return text;
    } catch (e) {
      console.error('[LaMiniVoice] Ошибка генерации:', e);
      return null;
    }
  },

  status() {
    if (this.ready) return '🟢 LaMini готов';
    if (this.loading) return '🟡 LaMini загружается...';
    if (this.error) return `🔴 LaMini ошибка: ${this.error.slice(0, 80)}`;
    return '⚪ LaMini не загружен';
  },
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

  Voice.speak = async function (internal, userText) {
    // Онлайн — API как раньше (IntentPromptBuilder уже «голос», не личность)
    if (typeof API !== 'undefined' && API.anyAvailable?.()) {
      return _orig(internal, userText);
    }

    // Офлайн — LaMini только оформляет уже решённое содержание
    if (LaMiniVoice.ready) {
      const r = await LaMiniVoice.speak(internal);
      if (r) {
        if (typeof SpeechMemory !== 'undefined' && internal?.rawThought) {
          SpeechMemory.learn(
            internal.rawThought,
            r,
            internal?.emotion?.name
          );
        }
        return r;
      }
    }

    // Fallback
    return _orig(internal, userText);
  };

  console.log('[LaMiniVoice] ✓ Voice.speak патч применён (рот, не личность)');
})();
