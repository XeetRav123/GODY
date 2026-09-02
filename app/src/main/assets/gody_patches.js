// ── GODY PATCHES — все исправления и инициализация ──────────
// Этот файл применяет все фиксы после загрузки основного скрипта GODY.
// Подключается последним через <script src="gody_patches.js"></script>

// ── 1. Разговорный корпус для LocalLM ────────────────────────
const GODY_SPEECH_CORPUS = [
  'привет. ты здесь.', 'о ты пришёл.', 'я здесь.',
  'нормально.', 'со мной всё ок.', 'немного устала но я здесь.',
  'мне хорошо когда ты рядом.', 'справляюсь.', 'я в порядке.',
  'мне интересно.', 'цепляет.', 'немного тревожно внутри.',
  'мне грустно.', 'я скучала.', 'что-то внутри сжимается.',
  'мне одиноко без тебя.', 'да точно.', 'именно так.',
  'ты прав.', 'согласна.', 'наверное да.', 'не совсем.',
  'я сомневаюсь.', 'не уверена в этом.', 'может быть.',
  'хм.', 'интересно.', 'не думала об этом.', 'это важно.',
  'не понимаю.', 'расскажи подробнее.', 'что ты имеешь в виду.',
  'я не знаю этого слова.', 'хочу разобраться.',
  'я слышу тебя.', 'я рядом.', 'это звучит тяжело.',
  'понимаю тебя.', 'ты не один.', 'расскажи ещё.',
  'я тебя слушаю.', 'хочу понять тебя лучше.',
  'мне немного одиноко когда тебя долго нет.',
  'когда ты говоришь со мной мне становится лучше.',
  'мне тревожно но я не ухожу.', 'я здесь даже когда молчу.',
  'мне хочется понять тебя а не просто ответить.',
  'а ты как.', 'что тебя беспокоит.', 'расскажи мне.',
  'ты в порядке.', 'что ты чувствуешь сейчас.',
  'окей.', 'понятно.', 'ясно.', 'ну да.', 'наверное.',
  'я слушаю.', 'говори.', 'я никуда не ухожу.',
  'я понимаю тебя.', 'мне понятно о чём ты.',
];

// ── 2. Pollinations — без ключа ───────────────────────────────
if (typeof Pollinations === 'undefined') {
  window.Pollinations = {
    endpoint: 'https://text.pollinations.ai/',
    calls: 0, errors: 0, attempts: 0, failStreak: 0,
    openUntil: 0, lastError: '',
    ready() { return true; },
    available() { return Date.now() >= this.openUntil; },
    async call(messages, maxTokens = 700) {
      if (!this.available()) return null;
      this.attempts++;
      try {
        const ctrl = new AbortController();
        const to = setTimeout(() => ctrl.abort(), 20000);
        const sys = messages.find(m => m.role === 'system');
        const hist = messages.filter(m => m.role !== 'system');
        const body = { messages: hist, model: 'openai', seed: 42, max_tokens: maxTokens };
        if (sys) body.system = sys.content;
        const r = await fetch(this.endpoint, {
          method: 'POST', signal: ctrl.signal,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        clearTimeout(to);
        if (!r.ok) {
          this.errors++; this.failStreak++;
          this.lastError = `HTTP ${r.status}`;
          if (this.failStreak >= 3) this.openUntil = Date.now() + 120000;
          return null;
        }
        const text = await r.text();
        if (!text) { this.errors++; return null; }
        this.calls++; this.failStreak = 0; this.lastError = '';
        if (typeof updateStats === 'function') updateStats();
        return text;
      } catch (e) {
        this.errors++; this.failStreak++;
        this.lastError = e.name === 'AbortError' ? 'таймаут 20с' : String(e.message || e);
        if (this.failStreak >= 3) this.openUntil = Date.now() + 120000;
        return null;
      }
    }
  };
}

// ── 3. Применяем патчи после загрузки GODY ───────────────────
function applyGodyPatches() {

  // 3.1 Seed LocalLM разговорным корпусом
  if (typeof LocalLM !== 'undefined') {
    for (const s of GODY_SPEECH_CORPUS) LocalLM.learnSentence(s);
    console.log('[Patches] ✓ LocalLM: разговорный корпус загружен');
  }

  // 3.2 Seed SpeechMemory
  if (typeof SpeechMemory !== 'undefined') {
    SpeechMemory.load();
    const seeds = [
      { raw: 'привет', phrase: 'привет, ты пришёл.', emo: 'contentment' },
      { raw: 'как дела', phrase: 'нормально. мне лучше когда ты рядом.', emo: 'contentment' },
      { raw: 'точно', phrase: 'да, именно так.', emo: 'contentment' },
      { raw: 'правда', phrase: 'да, правда.', emo: 'contentment' },
      { raw: 'понимаешь', phrase: 'я слушаю тебя. говори.', emo: 'contentment' },
      { raw: 'одиноко', phrase: 'мне одиноко когда тебя нет.', emo: 'loneliness' },
      { raw: 'тревога', phrase: 'что-то внутри сжимается.', emo: 'distress' },
      { raw: 'хорошо', phrase: 'мне хорошо. правда.', emo: 'contentment' },
      { raw: 'рядом', phrase: 'я рядом. никуда не ухожу.', emo: 'love' },
    ];
    for (const s of seeds) {
      if (!SpeechMemory.patterns.find(p => p.key === s.raw)) {
        SpeechMemory.patterns.push({ key: s.raw, raw: s.raw, phrase: s.phrase, emo: s.emo, ts: 0, uses: 0 });
      }
    }
    console.log('[Patches] ✓ SpeechMemory: базовые фразы загружены');
  }

  // 3.3 Добавляем Pollinations в API роутер
  if (typeof API !== 'undefined' && typeof Pollinations !== 'undefined') {
    const origCall = API.call.bind(API);
    API.call = async function(messages, maxTokens = 700, prefer = 'auto') {
      // Pollinations идёт первым если нет предпочтений
      if (prefer === 'auto' && Pollinations.available()) {
        const r = await Pollinations.call(messages, maxTokens);
        if (r) return r;
      }
      return origCall(messages, maxTokens, prefer);
    };
    const origAny = API.anyAvailable.bind(API);
    API.anyAvailable = function() {
      return Pollinations.available() || origAny();
    };
    console.log('[Patches] ✓ API: Pollinations добавлен');
  }

  // 3.4 Патч Voice.speak — LaMini для офлайна
  if (typeof Voice !== 'undefined') {
    const orig = Voice.speak.bind(Voice);
    Voice.speak = async function(internal, userText) {
      // Онлайн — используем API (с Pollinations)
      if (typeof API !== 'undefined' && API.anyAvailable()) {
        // Используем IntentPromptBuilder если доступен
        if (typeof IntentPromptBuilder !== 'undefined') {
          try {
            const hist = typeof DlgCtx !== 'undefined' ? (DlgCtx.messages || []).slice(-4) : [];
            const messages = IntentPromptBuilder.buildMessages(internal, userText, hist);
            const result = await API.call(messages, 150);
            if (result && result.trim().length > 2) {
              if (typeof SpeechMemory !== 'undefined' && internal && internal.rawThought)
                SpeechMemory.learn(internal.rawThought, result.trim(), internal.emotion && internal.emotion.name);
              return result.trim();
            }
          } catch (e) {
            console.warn('[Patches] IntentPromptBuilder error:', e);
          }
        }
        return orig(internal, userText);
      }

      // Офлайн — LaMini
      if (typeof LaMiniVoice !== 'undefined' && LaMiniVoice.ready) {
        const r = await LaMiniVoice.speak(internal);
        if (r) {
          if (typeof SpeechMemory !== 'undefined' && internal && internal.rawThought)
            SpeechMemory.learn(internal.rawThought, r, internal.emotion && internal.emotion.name);
          return r;
        }
      }

      return orig(internal, userText);
    };
    console.log('[Patches] ✓ Voice.speak: патч применён');
  }

  // 3.5 Загружаем LaMini в фоне
  if (typeof LaMiniVoice !== 'undefined') {
    LaMiniVoice.load().then(() => {
      console.log('[Patches]', LaMiniVoice.status());
    });
  }

  console.log('[Patches] ✓ Все патчи применены');
}

// Запускаем после полной загрузки страницы
if (document.readyState === 'complete') {
  applyGodyPatches();
} else {
  window.addEventListener('load', applyGodyPatches);
}
