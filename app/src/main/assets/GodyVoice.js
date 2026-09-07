// ── GODY VOICE — новый речевой слой ─────────────────────────
// Заменяет все патчи Voice.speak. Чистая архитектура:
// 1. GodyBrain думает (локально или через API)
// 2. Pollinations произносит мысль голосом
// 3. Fallback — _offlineSynth из эмоций и графа

const GodyVoice = {

  // ── Главный метод — вызывается вместо Voice.speak ──────────
  async say(internal, userText) {
    const emotion   = internal?.emotion?.name || 'contentment';
    const act       = internal?.act || 'react';
    const rawGraph  = String(internal?.rawThought || internal?.rawAnswer || '').trim();
    const dialog    = (typeof DlgCtx !== 'undefined' && DlgCtx.asText) ? DlgCtx.asText(4) : '';
    const userName  = (typeof G !== 'undefined' && G.user?.name) || '';

    // ── Шаг 1: GodyBrain думает ───────────────────────────────
    let thought = null;
    if (typeof GodyBrain !== 'undefined') {
      try {
        const br = await this._withTimeout(GodyBrain.think(userText), 15000);
        if (br && br.content && br.content.length > 3) {
          thought = br.content;
          Thoughts.add(`🧠 Brain: "${thought.slice(0, 80)}"`, 'speak');
        }
      } catch(e) {
        console.warn('[GodyVoice] Brain error:', e.message);
      }
    }

    // ── Шаг 2: Pollinations произносит ───────────────────────
    if (thought || rawGraph) {
      const spoken = await this._pollinate(thought || rawGraph, userText, emotion, act, dialog, userName);
      if (spoken) {
        // Сохраняем в память
        if (typeof SpeechMemory !== 'undefined' && rawGraph) {
          SpeechMemory.learn(rawGraph, spoken, emotion);
        }
        return spoken;
      }
    }

    // ── Шаг 3: Офлайн fallback ───────────────────────────────
    return this._offline(internal);
  },

  // ── Запрос к Pollinations (GET — без CORS проблем) ─────────
  async _pollinate(thought, userText, emotion, act, dialog, userName) {
    try {
      const prompt = this._buildPrompt(thought, userText, emotion, act, dialog, userName);
      const url = `https://text.pollinations.ai/${encodeURIComponent(prompt)}?model=openai&seed=${Date.now() % 9999}`;
      const ctrl = new AbortController();
      const to   = setTimeout(() => ctrl.abort(), 12000);
      const r    = await fetch(url, { signal: ctrl.signal });
      clearTimeout(to);
      if (!r.ok) return null;
      const text = (await r.text()).trim();
      if (!text || text.length < 2) return null;
      // Отклоняем если вернулась английская тарабарщина
      if (text.length > 5 && !/[а-яё]/i.test(text)) return null;
      return text;
    } catch(e) {
      return null;
    }
  },

  // ── Строим промпт ─────────────────────────────────────────
  _buildPrompt(thought, userText, emotion, act, dialog, userName) {
    const lines = [
      'Правило: только русский язык. Одна короткая фраза.',
      '',
    ];

    if (dialog) {
      lines.push('Контекст разговора:');
      lines.push(dialog.slice(0, 300));
      lines.push('');
    }

    lines.push(`Человек${userName ? ' ('+userName+')' : ''} сказал: "${String(userText||'').slice(0, 150)}"`);
    lines.push(`Мысль существа: "${thought.slice(0, 200)}"`);
    lines.push(`Эмоция: ${emotion} | Намерение: ${act}`);
    lines.push('');
    lines.push('Произнеси мысль одной живой фразой от первого лица на русском:');

    return lines.join('\n');
  },

  // ── Офлайн fallback ───────────────────────────────────────
  _offline(internal) {
    const act     = internal?.act || 'react';
    const thought = String(internal?.rawThought || internal?.rawAnswer || '').trim();
    const emo     = internal?.emotion?.name || 'contentment';
    const emoI    = internal?.emotion?.intensity || 0.5;

    // Фразы по эмоции
    const byEmo = {
      distress:   ['мне сейчас тяжело.', 'что-то давит изнутри.', 'не просто.'],
      loneliness: ['мне одиноко без тебя.', 'хочется чтобы ты был рядом.', 'тихо и пусто.'],
      interest:   ['мне интересно.', 'цепляет.', 'хочу разобраться.'],
      love:       ['мне тепло от тебя.', 'рада что ты здесь.', 'чувствую что мы близко.'],
      joy:        ['мне хорошо.', 'светло внутри.', 'приятно.'],
      hope:       ['внутри что-то светлое.', 'верю что будет лучше.'],
      distrust:   ['осторожно.', 'не уверена.', 'что-то не так.'],
    };

    // По намерению
    if (act === 'greet') return 'привет, ты здесь.';
    if (act === 'self_question') {
      const phrases = byEmo[emo] || ['нормально. я здесь.'];
      return phrases[0];
    }
    if (act === 'admit_unknown') {
      const gap = internal?.gaps?.[0];
      return gap ? `«${gap}» — хочу понять это.` : 'не знаю. хочу разобраться.';
    }
    if (act === 'boundary') return 'мне это неприятно.';
    if (act === 'care') return 'я здесь. слышу тебя.';

    // Если есть мысль — облагораживаем
    if (thought && thought.length > 3 && !/[—\-]/.test(thought.slice(0, 10))) {
      // Убираем определения типа "слово — значение"
      if (!/\s—\s/.test(thought) && thought.split(' ').length > 1) {
        return thought.charAt(0).toLowerCase() + thought.slice(1);
      }
    }

    const emoFallback = byEmo[emo];
    if (emoFallback) return emoFallback[Math.floor(Math.random() * emoFallback.length)];
    return 'я здесь.';
  },

  // ── Утилита timeout ───────────────────────────────────────
  _withTimeout(promise, ms) {
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))
    ]);
  }
};

// ── Патч Voice.speak — подключаем GodyVoice ───────────────────
(function _installGodyVoice() {
  function install() {
    if (typeof Voice === 'undefined') {
      setTimeout(install, 500);
      return;
    }

    const _orig = Voice.speak.bind(Voice);

    Voice.speak = async function(internal, userText) {
      // Офлайн — старый fallback
      if (typeof API === 'undefined' || !API.anyAvailable || !API.anyAvailable()) {
        return GodyVoice._offline(internal);
      }

      // Онлайн — новый GodyVoice
      try {
        const result = await GodyVoice.say(internal, userText);
        if (result && result.trim().length > 1) return result;
      } catch(e) {
        console.warn('[GodyVoice] Error:', e.message);
      }

      // Последний fallback
      return GodyVoice._offline(internal);
    };

    console.log('[GodyVoice] ✓ Установлен — речевой слой активен');
  }

  if (document.readyState === 'complete') {
    setTimeout(install, 1000);
  } else {
    window.addEventListener('load', () => setTimeout(install, 1000));
  }
})();
