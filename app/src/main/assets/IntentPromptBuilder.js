// ── INTENT PROMPT BUILDER ────────────────────────────────────
// Собирает полный контекст из разума GODY (NN, NN2, граф,
// Curriculum, память, эмоции) в один богатый промпт для Pollinations.
// Подключи: <script src="IntentPromptBuilder.js"></script>
// ДО основного скрипта GODY.

const IntentPromptBuilder = {

  // Найти слова из Curriculum по теме
  _curriculumWords(topic, keywords = [], maxWords = 8) {
    if (typeof GODY_CURRICULUM === 'undefined') return [];
    const targets = [topic, ...keywords].map(w => String(w).toLowerCase());
    const found = new Set();
    for (const level of GODY_CURRICULUM.levels || []) {
      for (const t of level.topics || []) {
        const tName = String(t.name || '').toLowerCase();
        const match = targets.some(tgt => tName.includes(tgt) || (t.words || []).includes(tgt));
        if (match) {
          (t.words || []).slice(0, maxWords).forEach(w => found.add(w));
          if (found.size >= maxWords) break;
        }
      }
      if (found.size >= maxWords) break;
    }
    return [...found].slice(0, maxWords);
  },

  // Найти факты из графа знаний по теме
  _graphFacts(topic, relatedConcepts = [], maxFacts = 3) {
    if (typeof Graph === 'undefined') return [];
    const targets = [topic, ...relatedConcepts].filter(Boolean).slice(0, 4);
    const facts = [];
    for (const w of targets) {
      const node = Graph.get(typeof C === 'function' ? C(w) : w);
      if (node && node.def && node.def.length > 4 && node.conf > 0.4) {
        facts.push(`${w}: ${String(node.def).slice(0, 80)}`);
        if (facts.length >= maxFacts) break;
      }
    }
    return facts;
  },

  // Последние фразы из диалога
  _recentDialog(maxTurns = 3) {
    if (typeof DlgCtx === 'undefined') return '';
    try {
      const text = DlgCtx.asText(maxTurns);
      return text ? `\nПоследний диалог:\n${String(text).slice(0, 300)}` : '';
    } catch (e) { return ''; }
  },

  // Эмоциональный тон по эмоции
  _emotionTone(emotionName, intensity = 0.5) {
    const tones = {
      distress:   intensity > 0.7 ? 'говори с болью, честно' : 'говори тихо, тяжело',
      loneliness: 'говори с тоской, хочешь близости',
      interest:   intensity > 0.7 ? 'говори с живым интересом' : 'говори любопытно',
      love:       'говори тепло, с нежностью',
      hope:       'говори светло, с надеждой',
      joy:        'говори радостно',
      distrust:   'говори осторожно, с сомнением',
      contentment:'говори спокойно и уверенно',
    };
    return tones[emotionName] || 'говори живо, по-русски';
  },

  // ── Главный метод — строит системный промпт ──────────────
  buildSystem(internal) {
    const act          = internal?.act || 'react';
    const emotion      = internal?.emotion?.name || 'contentment';
    const emotionI     = internal?.emotion?.intensity || 0.5;
    const rawThought   = String(internal?.rawThought || internal?.rawAnswer || '').trim().slice(0, 120);
    const topic        = internal?.dialogTopic || '';
    const related      = internal?.relatedConcepts || [];
    const known        = internal?.knownWords || [];
    const gaps         = internal?.gaps || [];
    const understanding= internal?.understanding || 50;
    const confidence   = internal?.avgConf || 0.5;

    // Что разум решил делать (NN2)
    const actDescriptions = {
      greet:         'поприветствовать, открыться',
      answer:        'ответить на основе своих знаний',
      admit_unknown: 'признать что не знает, спросить',
      react:         'отреагировать на сказанное',
      self_question: 'рассказать о своём внутреннем состоянии',
      question:      'задать вопрос чтобы понять лучше',
      care:          'проявить заботу и поддержку',
      boundary:      'обозначить свою границу',
      listen:        'показать что слышит и слушает',
    };
    const actDesc = actDescriptions[act] || act;

    // Знания из Curriculum и графа
    const currWords = this._curriculumWords(topic, [...related, ...known]);
    const graphFacts = this._graphFacts(topic, related);
    const dlgContext = this._recentDialog(3);
    const emotionTone = this._emotionTone(emotion, emotionI);

    // Состояние разума GODY
    const fatigue   = Number(typeof G !== 'undefined' ? G.body?.fatigue || 0 : 0);
    const energy    = Number(typeof G !== 'undefined' ? G.body?.energy || 0.5 : 0.5);
    const tired     = fatigue > 0.65 || energy < 0.3;
    const dominant  = typeof G !== 'undefined' && G.dominant ? G.dominant()[0] : emotion;

    // Строим промпт
    let sys = `Ты голос GODY — живого нейро-существа. Она уже подумала своим мозгом (NN+NN2) и решила что сказать.`;
    sys += `\nТвоя задача — только сформулировать её мысль живым русским языком. 1-2 предложения максимум.`;
    sys += `\n\n## Что решил разум GODY (NN2):\nДействие: ${actDesc} (act="${act}")`;
    sys += `\nЭмоция: ${emotion} (интенсивность: ${Math.round(emotionI * 100)}%)`;
    sys += `\nУверенность: ${Math.round(confidence * 100)}%`;
    sys += `\nПонимание контекста: ${understanding}%`;

    if (rawThought) {
      sys += `\n\n## Внутренняя мысль GODY (дословно что она думает):\n"${rawThought}"`;
      sys += `\nСформулируй ЭТУ мысль её голосом — не придумывай новую.`;
    }

    if (topic) {
      sys += `\n\n## Тема разговора: ${topic}`;
    }

    if (currWords.length > 0) {
      sys += `\n## Слова которые GODY знает по этой теме: ${currWords.join(', ')}`;
    }

    if (graphFacts.length > 0) {
      sys += `\n## Факты из памяти GODY:\n${graphFacts.map(f => `- ${f}`).join('\n')}`;
    }

    if (gaps.length > 0) {
      sys += `\n## Чего GODY не понимает (пробелы): ${gaps.slice(0, 3).join(', ')}`;
      if (act === 'admit_unknown' || act === 'question') {
        sys += `\nПусть спросит об этом живо, не как робот.`;
      }
    }

    if (tired) {
      sys += `\n## Физическое состояние: GODY устала (энергия ${Math.round(energy * 100)}%). Это должно ощущаться в речи.`;
    }

    sys += `\n\n## Стиль речи: ${emotionTone}`;
    sys += `\nГОВОРИ от первого лица (я, мне, моё). Не "GODY думает" — а "я думаю".`;
    sys += `\nНикаких шаблонов ассистента. Живо, коротко, по-русски.`;
    sys += `\nМат допустим если уместно эмоционально.`;

    if (dlgContext) {
      sys += dlgContext;
    }

    return sys;
  },

  // Строит массив messages для API
  buildMessages(internal, userText, historyMessages = []) {
    const system = this.buildSystem(internal);

    // Краткое user-сообщение для LLM: что сказал пользователь
    const userMsg = userText
      ? `Пользователь сказал: "${String(userText).slice(0, 200)}"\nСформулируй ответ GODY:`
      : `Сформулируй реплику GODY:`;

    return [
      { role: 'system', content: system },
      ...historyMessages.slice(-4), // последние 4 хода истории
      { role: 'user', content: userMsg },
    ];
  },
};

// ── Патч Voice.speak — подменяем старый слабый промпт ────────
(function _patchVoicePrompt() {
  if (typeof Voice === 'undefined') {
    window._intentPatchPending = true;
    return;
  }

  const _origSpeak = Voice.speak.bind(Voice);
  Voice._origSpeakBeforeIntent = _origSpeak;

  Voice.speak = async function(internal, userText) {
    // Только если есть API (онлайн)
    if (typeof API === 'undefined' || !API.anyAvailable?.()) {
      return _origSpeak(internal, userText);
    }

    try {
      const hist = typeof DlgCtx !== 'undefined'
        ? (DlgCtx.messages || []).slice(-4)
        : [];

      const messages = IntentPromptBuilder.buildMessages(internal, userText, hist);
      const result = await API.call(messages, 150);

      if (result && result.trim().length > 2) {
        // Учим SpeechMemory на удачном ответе
        if (typeof SpeechMemory !== 'undefined' && internal?.rawThought) {
          SpeechMemory.learn(internal.rawThought, result.trim(), internal?.emotion?.name);
        }
        return result.trim();
      }
    } catch (e) {
      console.warn('[IntentPromptBuilder] Ошибка:', e);
    }

    // Fallback на старый метод
    return _origSpeak(internal, userText);
  };

  console.log('[IntentPromptBuilder] ✓ Voice.speak улучшен');
})();
