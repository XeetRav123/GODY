// LAMINI VOICE — offline MOUTH of GODY (stage D)
// Brain already decided WHAT to say (rawAnswer / rawThought).
// Here only rewrite into one short natural Russian phrase.
// NOT identity. NOT "You are GODY".
// Flat assets/ (stage E): this file, transformers.min.js, config.json,
// tokenizer*.json, special_tokens_map.json,
// encoder_model_quantized.onnx, decoder_model_merged_quantized.onnx

const LaMiniVoice = {
  pipeline: null,
  loading: false,
  ready: false,
  error: null,
  MODEL_PATH: './',

  async load() {
    if (this.ready || this.loading) return;
    this.loading = true;
    this.error = null;
    console.log('[LaMiniVoice] D: load from', this.MODEL_PATH);
    try {
      if (!window.transformers) throw new Error('transformers not loaded');
      const tf = window.transformers;
      try {
        const env = tf.env || window.env;
        if (env) {
          if ('allowLocalModels' in env) env.allowLocalModels = true;
          if ('allowRemoteModels' in env) env.allowRemoteModels = false;
          if ('localModelPath' in env) env.localModelPath = this.MODEL_PATH;
          if (env.backends && env.backends.onnx && env.backends.onnx.wasm) {
            env.backends.onnx.wasm.numThreads = 1;
          }
        }
      } catch (e) { console.warn('[LaMiniVoice] env', e); }

      const pipelineFn = tf.pipeline || (tf.default && tf.default.pipeline);
      if (typeof pipelineFn !== 'function') throw new Error('pipeline() missing');

      this.pipeline = await pipelineFn('text2text-generation', this.MODEL_PATH, {
        quantized: true,
        local_files_only: true,
        session_options: { executionProviders: ['cpu'] },
      });
      this.ready = true;
      this.loading = false;
      console.log('[LaMiniVoice] OK mouth ready');
    } catch (e) {
      this.error = String(e && e.message ? e.message : e);
      this.loading = false;
      this.ready = false;
      console.error('[LaMiniVoice] fail (app continues):', e);
    }
  },

  buildPrompt(internal) {
    const content = String(internal && (internal.rawAnswer || internal.rawThought) || '').trim();
    const emotion = (internal && internal.emotion && internal.emotion.name) || '';
    const act = (internal && internal.act) || '';
    let prompt =
      'Перепиши текст в одну короткую естественную фразу на русском.\n' +
      'Не добавляй фактов. Не представляйся. Не пиши что ты ИИ или GODY.\n';
    if (emotion) prompt += 'Тон: ' + emotion + '.\n';
    if (act) prompt += 'Намерение: ' + act + '.\n';
    prompt += '\nТекст:\n' + (content ? content.slice(0, 280) : '…') + '\n\nФраза:';
    return prompt;
  },

  async speak(internal, maxNewTokens) {
    maxNewTokens = maxNewTokens || 64;
    if (!this.ready || !this.pipeline) return null;
    const content = String(internal && (internal.rawAnswer || internal.rawThought) || '').trim();
    if (!content || content.length < 2) return null;

    if (
      content.length <= 90 &&
      /[а-яё]/i.test(content) &&
      content.indexOf(' — ') === -1 &&
      content.split(/\s+/).length <= 16
    ) {
      return content.replace(/^["«]+|["»]+$/g, '').trim();
    }

    const prompt = this.buildPrompt(internal);
    try {
      const result = await this.pipeline(prompt, {
        max_new_tokens: maxNewTokens,
        do_sample: true,
        temperature: 0.65,
        top_p: 0.9,
        repetition_penalty: 1.3,
      });
      let text = (result && result[0] && result[0].generated_text) ? result[0].generated_text.trim() : '';
      const marker = 'Фраза:';
      const idx = text.lastIndexOf(marker);
      if (idx !== -1) text = text.slice(idx + marker.length).trim();
      text = text.replace(/^Перепиши[\s\S]*?Фраза:\s*/i, '').replace(/^["«]+|["»]+$/g, '').trim();
      if (!text || text.length < 2) return null;
      if (!/[а-яё]/i.test(text)) return null;
      if (/я\s+(gody|годи|живое\s+ии)/i.test(text)) return content.slice(0, 200);
      return text.slice(0, 240);
    } catch (e) {
      console.error('[LaMiniVoice] gen', e);
      return null;
    }
  },

  status() {
    if (this.ready) return '🟢 LaMini рот готов';
    if (this.loading) return '🟡 LaMini загружается...';
    if (this.error) return '🔴 LaMini: ' + String(this.error).slice(0, 100);
    return '⚪ LaMini выключен';
  },
};

(function _patchVoiceLaMini() {
  if (typeof Voice === 'undefined') {
    window._laminiPatchPending = true;
    return;
  }
  const _orig = Voice.speak.bind(Voice);
  Voice._origBeforeLaMini = _orig;
  Voice.speak = async function (internal, userText) {
    if (typeof API !== 'undefined' && API.anyAvailable && API.anyAvailable()) {
      return _orig(internal, userText);
    }
    if (LaMiniVoice.ready) {
      const r = await LaMiniVoice.speak(internal);
      if (r) {
        if (typeof SpeechMemory !== 'undefined' && internal && internal.rawThought) {
          try { SpeechMemory.learn(internal.rawThought, r, internal.emotion && internal.emotion.name); } catch (e) {}
        }
        return r;
      }
    }
    return _orig(internal, userText);
  };
  console.log('[LaMiniVoice] patch Voice stage D');
})();
