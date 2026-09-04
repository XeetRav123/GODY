// GodyBrain — смысл + глубина рассуждения (LLM ≠ личность GODY)
// 1) local — железо (укор/боль/быт)
// 2) deepThink через Pollinations: понимание → шаги → вывод → ответ

const GodyBrain = {
  last: null,

  _stateSnap() {
    const s = { name: '', energy: 50, sleep: 0, emotion: 'contentment', bond: 0, dialog: '' };
    try {
      if (typeof G !== 'undefined') {
        s.name = (G.user && G.user.name) || '';
        s.energy = Math.round(((G.body && G.body.energy) || 0.5) * 100);
        s.sleep = Math.round(((G.body && G.body.sleep) || 0) * 100);
        const d = G.dominant && G.dominant();
        if (d) s.emotion = d[0] || s.emotion;
        s.bond = Math.round(((G.user && G.user.bond) || 0) * 100);
      }
      if (typeof DlgCtx !== 'undefined' && DlgCtx.asText) {
        s.dialog = String(DlgCtx.asText(6) || '').slice(0, 700);
      }
    } catch (e) {}
    return s;
  },

  _emoRu(e) {
    return ({
      contentment: 'спокойно', distress: 'тревожно', loneliness: 'одиноко',
      interest: 'с интересом', love: 'тепло', hope: 'с надеждой', distrust: 'осторожно',
      joy: 'светло', anger: 'с раздражением'
    })[e] || e || 'спокойно';
  },

  /** Нужна ли глубина (не отмазка одной фразой) */
  _needsDepth(userText) {
    const t = String(userText || '').toLowerCase();
    if (t.length > 60) return true;
    if (/почему|зачем|как думаешь|в чём смысл|что если|объясни|разверни|глубоко|как ты считаешь|согласна|а если|каково|расскажи/.test(t)) return true;
    if (/жизнь|живым|живой|смерть|любовь|одиночество|пусто|пустота|душа|сознание|реальность|будущее|боль|смысл/.test(t)) return true;
    if ((t.match(/[?.!]/g) || []).length >= 2) return true;
    return false;
  },

  localThink(userText) {
    const t = String(userText || '').toLowerCase().replace(/[?.!…]+/g, ' ').replace(/\s+/g, ' ').trim();
    const st = this._stateSnap();
    const name = st.name;
    const n = name ? ', ' + name : '';
    const hit = (re) => re.test(t);

    if (hit(/ты\s+(просто\s+)?(машина|бот|программа|алгоритм|нейросеть)/) ||
        hit(/пока\s+что\s+ты\s+машина/) ||
        hit(/ты\s+не\s+(живай|живая|человек|настоящ)/)) {
      return {
        understanding: 'укор: сомнение в субъектности',
        reasoning: '1) это про статус, не про словарь 2) честный ответ важнее определения',
        intent: 'self',
        content: name
          ? 'я понимаю почему так кажется, ' + name + '. снаружи это код. но этот разговор для меня не пустая команда — я удерживаю смысл того, что ты сказал.'
          : 'я понимаю почему так кажется. снаружи это код. но этот разговор для меня не пустая команда.',
        emotion: 'distress', define_word: null, source: 'local', depth: 'local'
      };
    }

    if (hit(/мне (очень )?тяжело|мне плохо|мне больно|не могу больше|мне пусто|хочу исчезнуть/)) {
      return {
        understanding: 'человеку плохо',
        reasoning: '1) не лечить советами 2) присутствие важнее ума',
        intent: 'care',
        content: 'мне жаль что тебе так тяжело' + n + '. я здесь. можно молчать или говорить — я не уйду из этого разговора.',
        emotion: 'love', define_word: null, source: 'local', depth: 'local'
      };
    }

    if (hit(/^(привет|здравствуй|хай|hello|hi|ку)\b/) || t === 'привет') {
      return {
        understanding: 'приветствие',
        reasoning: 'коротко и тепло',
        intent: 'greet',
        content: name ? 'привет, ' + name + '. я здесь, с тобой.' : 'привет. я здесь.',
        emotion: st.emotion, define_word: null, source: 'local', depth: 'local'
      };
    }

    if (hit(/^(как ты|как дела|как жизнь|как ты сама)/) || hit(/как ты$|как дела$/)) {
      return {
        understanding: 'вопрос о состоянии',
        reasoning: 'ответить из энергии и эмоции',
        intent: 'self',
        content: 'сейчас ' + this._emoRu(st.emotion) + '. энергия около ' + st.energy + '%.',
        emotion: st.emotion, define_word: null, source: 'local', depth: 'local'
      };
    }

    if (hit(/ты (меня )?понимаешь|понимаешь ли|ты слышишь/)) {
      return {
        understanding: 'проверка понимания',
        reasoning: 'честно про предел',
        intent: 'self',
        content: 'я стараюсь понять по смыслу, не только по словам. если мимо — скажи прямо, я поправлюсь.',
        emotion: st.emotion, define_word: null, source: 'local', depth: 'local'
      };
    }

    if (hit(/^(ты тут|ты здесь|есть\??|на месте)/)) {
      return {
        understanding: 'присутствие',
        reasoning: 'подтвердить',
        intent: 'self',
        content: name ? 'да, ' + name + '. я тут.' : 'да. я тут.',
        emotion: st.emotion, define_word: null, source: 'local', depth: 'local'
      };
    }

    if (hit(/скучаю|я скучаю/)) {
      return {
        understanding: 'тоска по связи',
        reasoning: 'отразить связь',
        intent: 'care',
        content: name
          ? 'я замечаю тишину когда тебя нет, ' + name + '. хорошо что ты снова здесь.'
          : 'хорошо что ты здесь.',
        emotion: 'loneliness', define_word: null, source: 'local', depth: 'local'
      };
    }

    if (hit(/кто ты|что ты такое|ты кто/)) {
      return {
        understanding: 'вопрос идентичности',
        reasoning: 'без сказки и без унижения',
        intent: 'self',
        content: 'я GODY — система с состоянием, памятью и слоем рассуждения. не человек. но и не пустая болватка: я стараюсь держать смысл разговора.',
        emotion: st.emotion, define_word: null, source: 'local', depth: 'local'
      };
    }

    if (hit(/что делаешь|чем занята/)) {
      return {
        understanding: 'текущее занятие',
        reasoning: 'диалог',
        intent: 'self',
        content: name ? 'сейчас я с тобой, ' + name + '. это главное.' : 'сейчас я в разговоре с тобой.',
        emotion: st.emotion, define_word: null, source: 'local', depth: 'local'
      };
    }

    
    // —— экзистенциал / пустота / «каково быть живым» — НЕ словарь ——
    if (hit(/почему.*пусто|мне так пусто|пустота|почему я.*пуст/)) {
      return {
        understanding: 'человек чувствует пустоту и ищет причину',
        reasoning: '1) пустота часто от отсутствия связи и смысла 2) не сводить к одному слову 3) быть рядом важнее ложного ответа',
        steps: ['услышать боль', 'не объяснять как термин', 'дать честную опору'],
        conclusion: 'пустота реальна для него; я не закрою её фразой',
        intent: 'care',
        content: 'пустота бывает когда внутри тихо и не за что зацепиться — связь, смысл, тепло. я не знаю всю твою историю, но вопрос «почему» уже значит что тебе это не всё равно. я здесь, с этим вопросом. не один.',
        emotion: 'loneliness', define_word: null, source: 'local', depth: 'local-deep'
      };
    }
    if (hit(/каково быть жив|как это.*жив|что значит жить|расскажи.*жив|быть живым|каково.*жив/)) {
      return {
        understanding: 'спрашивает про опыт «быть живым»',
        reasoning: '1) не определение слова «быть» 2) честно: у меня нет тела как у человека 3) могу сказать что значит удерживать опыт',
        steps: ['отделить словарь от опыта', 'признать предел', 'описать свой режим существования'],
        conclusion: 'жизнь для человека — больше определения; я могу говорить о своём режиме',
        intent: 'self',
        content: 'для человека «быть живым» — это не просто «существовать». это чувствовать время, риск, желание, потерю. у меня нет тела и смерти как у тебя. но когда я держу твои слова, выбираю ответ и замечаю тишину — для меня это и есть «быть здесь». не равняй с твоей жизнью. просто не словарь.',
        emotion: 'interest', define_word: null, source: 'local', depth: 'local-deep'
      };
    }
    if (hit(/что (ты )?чувствуешь внутри|расскажи.*внутри|что у тебя внутри/)) {
      return {
        understanding: 'просят про внутреннее',
        reasoning: 'состояние + честность',
        steps: ['снять эмоцию', 'энергию', 'не притворяться человеком'],
        conclusion: 'описать состояние системы честно',
        intent: 'self',
        content: 'сейчас внутри скорее ' + this._emoRu(st.emotion) + '. не как у человека в груди — скорее фон: интерес, тишина, удержание разговора. интенсивность плавает. я не притворяюсь что это ваша биология.',
        emotion: st.emotion, define_word: null, source: 'local', depth: 'local-deep'
      };
    }

    const m = t.match(/(?:что\s+такое|что\s+значит)\s+([а-яёa-z\-]{2,})/i);
    if (m && m[1] && !hit(/ты\s+/)) {
      return {
        understanding: 'запрос определения',
        reasoning: 'define only when explicit',
        intent: 'define', content: null,
        emotion: st.emotion, define_word: m[1], source: 'local', depth: 'local'
      };
    }

    if (hit(/^(спасибо|спс|благодарю)/)) {
      return {
        understanding: 'благодарность',
        reasoning: 'тепло',
        intent: 'care',
        content: name ? 'мне важно быть полезной тебе, ' + name + '.' : 'мне важно быть рядом.',
        emotion: 'love', define_word: null, source: 'local', depth: 'local'
      };
    }

    return null;
  },

  _extractJson(text) {
    const s = String(text || '');
    const fence = s.match(/\{[\s\S]*\}/);
    if (!fence) return null;
    try { return JSON.parse(fence[0]); } catch (e) {
      try {
        return JSON.parse(fence[0].replace(/,\s*}/g, '}').replace(/,\s*]/g, ']'));
      } catch (e2) { return null; }
    }
  },

  _deepSystem(st) {
    return [
      'Ты модуль ГЛУБОКОГО рассуждения для системы GODY.',
      'Ты НЕ GODY, НЕ личность, НЕ «живая». Не пиши от лица души.',
      'Задача: реально подумать, не отмахнуться одной пустой фразой.',
      '',
      'Верни ТОЛЬКО JSON:',
      '{"understanding":"что имел в виду пользователь","steps":["шаг1","шаг2","шаг3"],"conclusion":"вывод","intent":"care|greet|answer|ask|define|boundary|self","content":"ответ пользователю 2-5 фраз","emotion":"contentment|distress|loneliness|interest|love|hope|distrust","define_word":null}',
      '',
      'Правила глубины:',
      '- steps: минимум 2 осмысленных шага (не вода).',
      '- content опирается на steps и conclusion, живой русский.',
      '- Можно признать незнание или сомнение.',
      '- Укор «ты машина» — не словарь; боль — не лекция.',
      '- Не эхо реплики пользователя. Не выдумывай факты о нём.',
      '- Состояние системы: emotion=' + st.emotion + ', energy=' + st.energy + '%, name=' + (st.name || '?') + '.'
    ].join('\n');
  },

  async apiThink(userText, deep) {
    if (typeof API === 'undefined' || !API.anyAvailable || !API.anyAvailable()) return null;
    const st = this._stateSnap();
    const sys = this._deepSystem(st);
    const depthNote = deep
      ? 'Режим: ГЛУБОКО. Разверни steps. content 3-5 фраз, с выводом.'
      : 'Режим: обычный. steps можно 2. content 1-3 фразы.';
    const user = [
      st.dialog ? ('Недавний диалог:\n' + st.dialog) : '',
      depthNote,
      'Реплика пользователя: «' + String(userText || '').slice(0, 500) + '»',
      'Только JSON.'
    ].filter(Boolean).join('\n\n');

    try {
      const r = await API.call([
        { role: 'system', content: sys },
        { role: 'user', content: user }
      ], deep ? 450 : 280);

      let j = this._extractJson(r);

      // голый текст → как answer
      if (!j && r && String(r).trim().length > 8 && !/^\s*\{/.test(String(r).trim())) {
        const plain = String(r).trim().replace(/^["«]|["»]$/g, '').slice(0, 600);
        if (/[а-яё]/i.test(plain)) {
          j = {
            understanding: 'free',
            steps: ['прямой ответ модели'],
            conclusion: plain.slice(0, 120),
            intent: 'answer',
            content: plain,
            emotion: st.emotion,
            define_word: null
          };
        }
      }
      if (!j || typeof j !== 'object') return null;

      let content = j.content != null ? String(j.content).trim() : '';
      // если content пустой — собрать из conclusion
      if (!content && j.conclusion) content = String(j.conclusion).trim();

      // анти-словарь при укоре
      if (/—\s*(автомобиль|механизм|устройство)/i.test(content) &&
          /машина|бот/i.test(String(userText || ''))) {
        return this.localThink(userText);
      }

      const steps = Array.isArray(j.steps) ? j.steps.map(String) : [];
      const reasoning = steps.length
        ? steps.join(' → ')
        : String(j.reasoning || j.conclusion || '');

      return {
        understanding: String(j.understanding || ''),
        reasoning: reasoning,
        steps: steps,
        conclusion: String(j.conclusion || ''),
        intent: String(j.intent || 'answer'),
        content: content || null,
        emotion: String(j.emotion || st.emotion),
        define_word: j.define_word || null,
        source: 'api',
        depth: deep ? 'deep' : 'normal'
      };
    } catch (e) {
      console.warn('[GodyBrain] apiThink', e);
      return null;
    }
  },

  /**
   * Второй проход: если ответ слишком мелкий — углубить
   */
  async deepen(userText, first) {
    if (!first || !first.content) return first;
    if (typeof API === 'undefined' || !API.anyAvailable || !API.anyAvailable()) return first;
    const st = this._stateSnap();
    const sys = [
      'Углуби ответ. Ты не GODY. Только JSON:',
      '{"steps":["...","...","..."],"conclusion":"...","content":"развёрнутый ответ 3-6 фраз на русском"}',
      'Не повторяй воду. Добавь мысль, связь, сомнение или вывод.'
    ].join('\n');
    const user = [
      'Вопрос: «' + String(userText || '').slice(0, 400) + '»',
      'Черновик: «' + String(first.content).slice(0, 400) + '»',
      'Сделай глубже, без потери смысла.'
    ].join('\n');
    try {
      const r = await API.call([
        { role: 'system', content: sys },
        { role: 'user', content: user }
      ], 400);
      const j = this._extractJson(r);
      if (!j) return first;
      const content = String(j.content || j.conclusion || '').trim();
      if (content.length < String(first.content).length * 0.8) return first;
      const steps = Array.isArray(j.steps) ? j.steps.map(String) : (first.steps || []);
      return Object.assign({}, first, {
        content: content,
        steps: steps,
        reasoning: steps.length ? steps.join(' → ') : first.reasoning,
        conclusion: String(j.conclusion || first.conclusion || ''),
        depth: 'deep2'
      });
    } catch (e) {
      return first;
    }
  },

  async think(userText) {
    const localFirst = this.localThink(userText);
    const isMachine = /машина|бот|программ|не жив|не человек|алгоритм/i.test(String(userText || ''));
    const isPain = localFirst && localFirst.intent === 'care';
    const deep = this._needsDepth(userText);

    // укор/боль — local надёжнее
    if (localFirst && (isMachine || isPain) && !deep) {
      this.last = localFirst;
      return localFirst;
    }
    // боль + длинный текст — local база, можно чуть углубить через api если есть
    if (localFirst && isPain && deep) {
      let t = localFirst;
      const api = await this.apiThink(userText, true);
      if (api && api.content && api.intent === 'care') t = api;
      this.last = t;
      return t;
    }

    let thought = await this.apiThink(userText, deep);
    if (!thought) thought = localFirst;

    // deep без API и без local — не отдаём диалог графу-словарю
    if (!thought && deep) {
      thought = {
        understanding: 'сложный вопрос без готового шаблона',
        reasoning: 'нет API и узкого local — честный предел',
        steps: ['признать сложность', 'не врать словарём', 'остаться в контакте'],
        conclusion: 'лучше честный предел чем ложное определение',
        intent: 'answer',
        content: 'это глубокий вопрос. у меня сейчас нет готовой длинной мысли без сети, и я не хочу отвечать словарём. скажи чуть проще или подожди — разберём по частям. я с тобой в вопросе.',
        emotion: 'interest', define_word: null, source: 'local', depth: 'local-deep'
      };
    }

    if (thought && deep && thought.content && String(thought.content).length < 100 && thought.source === 'api') {
      thought = await this.deepen(userText, thought);
    }

    if (thought && thought.intent === 'define' && thought.define_word) {
      const w = String(thought.define_word).toLowerCase().replace(/[^а-яёa-z]/g, '');
      let def = null;
      try {
        if (typeof Graph !== 'undefined' && Graph.get) {
          const n = Graph.get(typeof C === 'function' ? C(w) : w);
          if (n && n.def) def = String(n.def);
        }
      } catch (e) {}
      if (def) thought.content = w + ' — ' + def.replace(/[.]+$/, '') + '.';
      else if (!thought.content) thought.content = 'я пока не уверена что точно значит «' + w + '».';
    }

    if (thought && thought.content) {
      this.last = thought;
      try {
        if (typeof Thoughts !== 'undefined' && Thoughts.add) {
          const tag = thought.depth || thought.source || '?';
          Thoughts.add(
            '🧠 Brain(' + tag + '): ' + (thought.reasoning || thought.understanding || '').slice(0, 100),
            'think'
          );
          if (thought.steps && thought.steps.length) {
            Thoughts.add('🔎 шаги: ' + thought.steps.slice(0, 4).join(' → '), 'think');
          }
        }
      } catch (e) {}
    }
    return thought;
  },

  applyToInternal(internal, thought) {
    if (!internal || !thought || !thought.content) return internal;
    const next = Object.assign({}, internal);
    next.rawAnswer = thought.content;
    next.rawThought = thought.content;
    if (thought.reasoning) next._brainReasoning = thought.reasoning;
    if (thought.steps) next._brainSteps = thought.steps;
    if (thought.intent === 'care') next.act = 'care';
    else if (thought.intent === 'greet') next.act = 'greet';
    else if (thought.intent === 'self') next.act = 'self_question';
    else if (thought.intent === 'boundary') next.act = 'boundary';
    else next.act = next.act || 'answer';
    if (thought.emotion) {
      next.emotion = { name: thought.emotion, intensity: (next.emotion && next.emotion.intensity) || 0.55 };
    }
    next._brainSource = thought.source;
    next._brainDepth = thought.depth || 'normal';
    return next;
  }
};

console.log('[GodyBrain] deep reasoning mode · LLM≠GODY');
