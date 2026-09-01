// ── MT5 VOICE — голос GODY через mT5-small офлайн ──────────
// Подключи в HTML ДО основного скрипта GODY:
//   <script src="transformers.min.js"></script>
//   <script src="mt5_voice.js"></script>
//
// Модель лежит локально:
//   model onnx/encoder_model_int8.onnx
//   model onnx/decoder_model_merged_int8.onnx
//
// Путь MODEL_PATH — относительно HTML файла.

const MT5Voice = {
  pipeline: null,
  loading: false,
  ready: false,
  error: null,

  // Путь к папке с моделью (относительно index.html)
  MODEL_PATH: './model onnx/',

  // Загрузка модели — вызывается один раз при старте
  async load() {
    if (this.ready || this.loading) return;
    this.loading = true;
    console.log('[MT5Voice] Загрузка модели...');
    try {
      // transformers.js ищет файлы по MODEL_PATH + config.json/tokenizer.json/onnx/
      this.pipeline = await window.transformers.pipeline(
        'text2text-generation',
        this.MODEL_PATH,
        {
          // Используем int8 квантизацию — самая лёгкая
          quantized: true,
          // Не грузить из сети — только локально
          local_files_only: true,
          // ONNX сессия — CPU, без GPU
          session_options: { executionProviders: ['cpu'] },
        }
      );
      this.ready = true;
      this.loading = false;
      console.log('[MT5Voice] ✓ Модель загружена');
    } catch (e) {
      this.error = String(e);
      this.loading = false;
      console.error('[MT5Voice] Ошибка загрузки:', e);
    }
  },

  // Построить prefix prompt из internal состояния GODY
  buildPrompt(internal) {
    const act    = internal?.act    || 'react';
    const emotion= internal?.emotion?.name || 'contentment';
    const thought= String(internal?.rawThought || internal?.rawAnswer || '')
                    .replace(/^«|»$/g, '').trim().slice(0, 80);
    const topic  = internal?.dialogTopic || '';
    const gap    = internal?.gaps?.[0] || '';
    const conf   = Math.round((internal?.understanding || 50));

    // Формат: "gody [act, emotion, thought] -> говорит:"
    // mT5 обучен продолжать такие паттерны на русском
    let prompt = `gody [${act}, ${emotion}`;
    if (thought) prompt += `, ${thought}`;
    if (topic)   prompt += `, тема: ${topic}`;
    if (gap)     prompt += `, не знает: ${gap}`;
    prompt += `] говорит:`;

    return prompt;
  },

  // Основной вызов — возвращает строку речи или null
  async speak(internal, maxNewTokens = 60) {
    if (!this.ready) {
      console.warn('[MT5Voice] Модель не готова');
      return null;
    }

    const prompt = this.buildPrompt(internal);
    console.log('[MT5Voice] Промпт:', prompt);

    try {
      const result = await this.pipeline(prompt, {
        max_new_tokens: maxNewTokens,
        // Немного случайности для живости речи
        do_sample: true,
        temperature: 0.85,
        top_p: 0.92,
        repetition_penalty: 1.3,
        // Останавливаемся на точке/переносе
        // (не генерируем лишнего)
        early_stopping: true,
      });

      const text = result?.[0]?.generated_text?.trim();
      if (!text || text.length < 2) return null;

      console.log('[MT5Voice] ✓ Речь:', text);
      return text;
    } catch (e) {
      console.error('[MT5Voice] Ошибка генерации:', e);
      return null;
    }
  },

  // Статус для UI
  status() {
    if (this.ready)   return '🟢 mT5 готов';
    if (this.loading) return '🟡 mT5 загружается...';
    if (this.error)   return `🔴 mT5 ошибка: ${this.error.slice(0, 60)}`;
    return '⚪ mT5 не загружен';
  }
};

// ── Интеграция в Voice GODY ─────────────────────────────────
// Вставляет MT5Voice в цепочку перед _offlineSynth.
// Если mT5 вернул null — fallback на старый офлайн синтез.
(function _patchVoice() {
  const _origSpeak = typeof Voice !== 'undefined' && Voice.speak
    ? Voice.speak.bind(Voice)
    : null;

  if (!_origSpeak) {
    // Voice ещё не определён — патч применим позже
    window._mt5PatchPending = true;
    return;
  }

  Voice._mt5OrigSpeak = _origSpeak;
  Voice.speak = async function(internal, userText) {
    // Если онлайн и есть LLM — не трогаем, LLM сам справится
    if (typeof API !== 'undefined' && API.anyAvailable?.()) {
      return _origSpeak(internal, userText);
    }

    // Офлайн: пробуем mT5
    if (MT5Voice.ready) {
      const mt5Result = await MT5Voice.speak(internal);
      if (mt5Result) {
        // Сохраняем в SpeechMemory чтобы GODY запомнила
        if (typeof SpeechMemory !== 'undefined' && internal?.rawThought) {
          SpeechMemory.learn(internal.rawThought, mt5Result, internal?.emotion?.name);
        }
        return mt5Result;
      }
    }

    // Fallback — старый офлайн синтез
    return _origSpeak(internal, userText);
  };

  console.log('[MT5Voice] ✓ Voice.speak патч применён');
})();
