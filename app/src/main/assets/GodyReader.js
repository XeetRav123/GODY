// ── GODY READER — пассивное обучение через URL ───────────────
// GODY читает страницы по ссылкам, извлекает понятия и связи,
// добавляет в граф знаний с весами. Прочитанное выделяется.

const GodyReader = {
  queue: [],        // очередь URL
  done: new Set(),  // уже прочитанные
  active: false,
  currentUrl: null,
  stats: { pages: 0, concepts: 0, skipped: 0 },

  // ── Добавить URL в очередь ────────────────────────────────
  addUrl(url) {
    if (!url || typeof url !== 'string') return false;
    url = url.trim();
    if (!url.startsWith('http')) return false;
    if (this.done.has(url) || this.queue.includes(url)) return false;
    this.queue.push(url);
    this._saveQueue();
    console.log('[GodyReader] Добавлена страница:', url);
    if (!this.active) this._processNext();
    return true;
  },

  // ── Обработать следующий URL ─────────────────────────────
  async _processNext() {
    if (!this.queue.length) { this.active = false; return; }
    this.active = true;
    const url = this.queue.shift();
    this.currentUrl = url;
    this._saveQueue();

    try {
      console.log('[GodyReader] Читаю:', url);
      const text = await this._fetchPage(url);
      if (!text || text.length < 100) {
        this.stats.skipped++;
        console.log('[GodyReader] Страница пустая, пропускаю');
      } else {
        await this._learnFromText(text, url);
        this.stats.pages++;
        this.done.add(url);
        this._saveDone();
      }
    } catch(e) {
      console.warn('[GodyReader] Ошибка:', url, e.message);
      this.stats.skipped++;
    }

    this.currentUrl = null;
    // Пауза между страницами чтобы не перегружать
    await new Promise(r => setTimeout(r, 2000));
    this._processNext();
  },

  // ── Загрузить страницу и извлечь текст ───────────────────
  async _fetchPage(url) {
    const r = await fetch(url, {
      headers: { 'Accept': 'text/html' }
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const html = await r.text();

    // Парсим HTML — вытаскиваем только текст
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Убираем скрипты, стили, навигацию
    ['script','style','nav','header','footer','aside','form'].forEach(tag => {
      doc.querySelectorAll(tag).forEach(el => el.remove());
    });

    // Берём основной текст
    const body = doc.querySelector('article') ||
                 doc.querySelector('main') ||
                 doc.querySelector('.content') ||
                 doc.body;

    if (!body) return '';
    return body.innerText || body.textContent || '';
  },

  // ── Извлечь понятия и добавить в граф ────────────────────
  async _learnFromText(text, url) {
    // Разбиваем на абзацы
    const paragraphs = text
      .split(/\n{2,}/)
      .map(p => p.replace(/\s+/g, ' ').trim())
      .filter(p => p.length > 50 && p.length < 1000);

    console.log('[GodyReader] Абзацев:', paragraphs.length);

    // Извлекаем понятия из каждого абзаца
    for (const para of paragraphs.slice(0, 30)) {
      await this._extractConcepts(para);
      // Небольшая пауза чтобы не заморозить UI
      await new Promise(r => setTimeout(r, 50));
    }

    // Сохраняем в LocalLM тоже
    if (typeof LocalLM !== 'undefined') {
      for (const para of paragraphs.slice(0, 10)) {
        LocalLM.learnSentence(para.slice(0, 200));
      }
    }
  },

  // ── Извлечь понятия из абзаца ────────────────────────────
  async _extractConcepts(text) {
    // Вытаскиваем ключевые слова локально
    const words = text.toLowerCase()
      .replace(/[^а-яёa-z\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 4)
      .filter(w => !this._isStopWord(w));

    // Уникальные слова
    const unique = [...new Set(words)].slice(0, 15);

    // Добавляем в граф с уверенностью 0.5 (получено, не проверено)
    if (typeof Graph !== 'undefined' && typeof C === 'function') {
      for (const word of unique) {
        const key = C(word);
        const existing = Graph.get(key);
        if (!existing) {
          // Новое понятие — добавляем с определением из контекста
          const def = this._extractDef(word, text);
          Graph.set(key, {
            word,
            def: def || text.slice(0, 80),
            conf: 0.45,
            src: 'reader',
            url,
            ts: Date.now()
          });
          this.stats.concepts++;
        } else if (existing.conf < 0.8) {
          // Укрепляем уверенность при повторной встрече
          existing.conf = Math.min(0.8, existing.conf + 0.05);
          existing.encounters = (existing.encounters || 1) + 1;
        }
      }
    }

    // Добавляем в LanguageBrain
    if (typeof LanguageBrain !== 'undefined') {
      LanguageBrain.learnSentence(text.slice(0, 300));
    }
  },

  // ── Извлечь определение слова из контекста ───────────────
  _extractDef(word, text) {
    // Ищем предложение содержащее слово
    const sentences = text.split(/[.!?]+/);
    for (const s of sentences) {
      if (s.toLowerCase().includes(word) && s.length > 20 && s.length < 150) {
        return s.trim();
      }
    }
    return null;
  },

  // ── Стоп-слова (не добавляем в граф) ─────────────────────
  _isStopWord(w) {
    const stops = new Set([
      'этого','этой','этом','этот','этим','этих','которые','которая',
      'который','которых','которым','которого','также','такой','такие',
      'такое','такого','таких','такими','более','менее','очень','когда',
      'тогда','потом','после','перед','между','через','около','среди',
      'будет','будут','является','являются','имеет','имеют','может',
      'могут','должен','должна','нужно','можно','нельзя','всего',
      'всему','всеми','because','which','their','there','these','those',
      'would','could','should','about','after','before','where','while'
    ]);
    return stops.has(w);
  },

  // ── Сохранение состояния ─────────────────────────────────
  _saveQueue() {
    try {
      localStorage.setItem('gody.reader.queue', JSON.stringify(this.queue));
      localStorage.setItem('gody.reader.url', this.currentUrl || '');
    } catch(e) {}
  },

  _saveDone() {
    try {
      localStorage.setItem('gody.reader.done', JSON.stringify([...this.done].slice(-200)));
    } catch(e) {}
  },

  load() {
    try {
      const q = JSON.parse(localStorage.getItem('gody.reader.queue') || '[]');
      const d = JSON.parse(localStorage.getItem('gody.reader.done') || '[]');
      this.queue = q;
      d.forEach(u => this.done.add(u));
      if (this.queue.length) {
        console.log('[GodyReader] Восстановлено', this.queue.length, 'URL из очереди');
        setTimeout(() => this._processNext(), 3000);
      }
    } catch(e) {}
  },

  // ── Статус ───────────────────────────────────────────────
  status() {
    return {
      queue: this.queue.length,
      done: this.done.size,
      active: this.active,
      current: this.currentUrl,
      stats: this.stats
    };
  }
};

// Загружаем очередь при старте
window.addEventListener('load', () => GodyReader.load());
