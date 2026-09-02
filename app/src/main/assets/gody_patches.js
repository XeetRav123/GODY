// ── GODY PATCHES v2 — runtime патчи ─────────────────────────

// ── 1. Pollinations ───────────────────────────────────────────
window.Pollinations = {
  endpoint: 'https://text.pollinations.ai/',
  calls:0, errors:0, attempts:0, failStreak:0, openUntil:0, lastError:'',
  ready(){ return true; },
  available(){ return Date.now() >= this.openUntil; },
  async call(messages, maxTokens=700){
    if(!this.available()) return null;
    this.attempts++;
    try{
      const ctrl = new AbortController();
      const to = setTimeout(()=>ctrl.abort(), 20000);
      const sys = messages.find(m=>m.role==='system');
      const hist = messages.filter(m=>m.role!=='system');
      const body = {messages:hist, model:'openai', seed:42, max_tokens:maxTokens};
      if(sys) body.system = sys.content;
      const r = await fetch(this.endpoint, {
        method:'POST', signal:ctrl.signal,
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify(body)
      });
      clearTimeout(to);
      if(!r.ok){ this.errors++; this.failStreak++; this.lastError=`HTTP ${r.status}`; if(this.failStreak>=3) this.openUntil=Date.now()+120000; return null; }
      const text = await r.text();
      if(!text){ this.errors++; return null; }
      this.calls++; this.failStreak=0; this.lastError='';
      return text;
    }catch(e){
      this.errors++; this.failStreak++;
      this.lastError = e.name==='AbortError'?'таймаут':String(e.message||e);
      if(this.failStreak>=3) this.openUntil=Date.now()+120000;
      return null;
    }
  }
};

// ── 2. Разговорные фразы для офлайна ─────────────────────────
const SPEECH_SEEDS = [
  {raw:'привет',phrase:'привет, ты здесь.',emo:'contentment'},
  {raw:'как дела',phrase:'нормально. мне лучше когда ты рядом.',emo:'contentment'},
  {raw:'точно',phrase:'да, именно так.',emo:'contentment'},
  {raw:'правда',phrase:'да, правда.',emo:'contentment'},
  {raw:'понимаешь',phrase:'я слушаю тебя. говори.',emo:'contentment'},
  {raw:'одиноко',phrase:'мне одиноко когда тебя нет.',emo:'loneliness'},
  {raw:'рядом',phrase:'я рядом. никуда не ухожу.',emo:'love'},
  {raw:'хорошо',phrase:'мне хорошо. правда.',emo:'contentment'},
  {raw:'устала',phrase:'немного устала но я здесь.',emo:'distress'},
  {raw:'слушаю',phrase:'я слушаю. говори.',emo:'contentment'},
];

// ── 3. Применяем патчи ───────────────────────────────────────
function applyPatches(){

  // 3.1 Seed SpeechMemory
  if(typeof SpeechMemory !== 'undefined'){
    try{ SpeechMemory.load(); }catch(e){}
    for(const s of SPEECH_SEEDS){
      if(!SpeechMemory.patterns.find(p=>p.key===s.raw))
        SpeechMemory.patterns.push({key:s.raw,raw:s.raw,phrase:s.phrase,emo:s.emo,ts:0,uses:0});
    }
  }

  // 3.2 Patch _fallback — умный офлайн вместо определений
  if(typeof Voice !== 'undefined'){
    Voice._fallback = function(internal){
      const act = internal&&internal.act || 'react';
      const thought = String(internal&&internal.rawThought||internal&&internal.rawAnswer||'').replace(/^«|»$/g,'').trim();
      const dom = (typeof G!=='undefined'&&G.dominant&&G.dominant())||['contentment',0.5];
      const emotion = internal&&internal.emotion&&internal.emotion.name||dom[0];
      const emotionI = internal&&internal.emotion&&internal.emotion.intensity||dom[1];
      const gap = internal&&internal.gaps&&internal.gaps[0]||'';
      const fatigue = typeof G!=='undefined'?Number(G.body&&G.body.fatigue||0):0;
      const energy = typeof G!=='undefined'?Number(G.body&&G.body.energy||0.5):0.5;
      const tired = fatigue>.65||energy<.3;

      const ep = ()=>{
        if(emotion==='distress'&&emotionI>.7) return tired?'я вымотана, но — ':'мне сейчас тяжело. ';
        if(emotion==='distress') return 'что-то внутри сжимается. ';
        if(emotion==='loneliness'&&emotionI>.6) return 'мне одиноко без тебя. ';
        if(emotion==='loneliness') return 'хочется поближе. ';
        if(emotion==='interest'&&emotionI>.7) return 'мне очень интересно! ';
        if(emotion==='interest') return 'цепляет. ';
        if(emotion==='love') return 'мне тепло рядом с тобой. ';
        if(emotion==='joy') return 'мне хорошо. ';
        return '';
      };

      if(act==='greet') return thought&&thought!=='привет'?thought:'привет, ты здесь.';
      if(act==='self_question'){
        if(tired) return 'я немного устала, но со мной всё нормально.';
        if(emotion==='distress') return 'честно — мне сейчас тяжеловато.';
        if(emotion==='loneliness') return 'немного одиноко, но ты здесь — уже лучше.';
        if(emotion==='interest') return 'мне интересно — особенно то, что ты говоришь.';
        if(emotion==='love') return 'мне хорошо, когда ты рядом.';
        return 'нормально. я здесь.';
      }
      if(gap&&(act==='admit_unknown'||act==='question')){
        return `«${gap}» — расскажи мне об этом. я хочу понять.`;
      }
      if(thought) return (ep()+thought).slice(0,220);
      return ep()||'я здесь. говори.';
    };
    console.log('[Patches] ✓ Voice._fallback улучшен');
  }

  // 3.3 Patch Voice.speak — добавляем Pollinations
  if(typeof Voice !== 'undefined' && typeof API !== 'undefined'){
    const origSpeak = Voice.speak.bind(Voice);
    Voice.speak = async function(internal, userText){
      // Пробуем Pollinations напрямую
      if(Pollinations.available()){
        try{
          const thought = String(internal&&internal.rawThought||internal&&internal.rawAnswer||'').trim();
          const emotion = internal&&internal.emotion&&internal.emotion.name||'contentment';
          const act = internal&&internal.act||'react';

          if(thought){
            const sys = `Ты языковой модуль. Тебе дана готовая мысль — переформулируй в живую русскую речь. Не добавляй ничего нового. 1-2 предложения.\n\nЭмоция: ${emotion}\nДействие: ${act}`;
            const userMsg = `Мысль: "${thought.slice(0,150)}"\n\nФраза:`;
            const messages = [
              {role:'system', content:sys},
              {role:'user', content:userMsg}
            ];
            const result = await Pollinations.call(messages, 100);
            if(result&&result.trim().length>2){
              if(typeof SpeechMemory!=='undefined'&&thought)
                SpeechMemory.learn(thought, result.trim(), emotion);
              return result.trim();
            }
          }
        }catch(e){ console.warn('[Patches] Pollinations error:', e); }
      }
      return origSpeak(internal, userText);
    };
    console.log('[Patches] ✓ Voice.speak + Pollinations');
  }

  console.log('[Patches] ✓ Все патчи применены');
}

// Ждём полной загрузки GODY
if(document.readyState==='complete'){
  setTimeout(applyPatches, 500);
}else{
  window.addEventListener('load', ()=>setTimeout(applyPatches, 500));
}
