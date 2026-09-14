/* Home model preferences; no credentials or learner content. */
window.WorldviewModels = (() => {
const catalog = {
  "anthropic": {
    "label": "Anthropic",
    "models": [
      {
        "id": "claude-opus-5",
        "label": "Opus 5"
      },
      {
        "id": "claude-opus-4-8",
        "label": "Opus 4.8"
      },
      {
        "id": "claude-sonnet-5",
        "label": "Sonnet 5"
      },
      {
        "id": "claude-sonnet-4-6",
        "label": "Sonnet 4.6"
      },
      {
        "id": "claude-haiku-4-5",
        "label": "Haiku 4.5"
      },
      {
        "id": "claude-fable-5",
        "label": "Fable 5"
      }
    ]
  },
  "google": {
    "label": "Google",
    "models": [
      {
        "id": "gemini-3.1-pro-preview",
        "label": "3.1 Pro"
      },
      {
        "id": "gemini-3.8-flash",
        "label": "3.8 Flash"
      },
      {
        "id": "gemini-3.7-flash",
        "label": "3.7 Flash"
      },
      {
        "id": "gemini-3.6-flash",
        "label": "3.6 Flash"
      },
      {
        "id": "gemini-3.5-flash",
        "label": "3.5 Flash"
      },
      {
        "id": "gemini-3.5-flash-lite",
        "label": "3.5 Flash-Lite"
      },
      {
        "id": "gemini-2.5-pro",
        "label": "2.5 Pro"
      },
      {
        "id": "gemini-2.5-flash",
        "label": "2.5 Flash"
      }
    ]
  },
  "openai": {
    "label": "OpenAI",
    "models": [
      {
        "id": "gpt-5.6-luna",
        "label": "GPT 5.6 Luna"
      },
      {
        "id": "gpt-5.6-terra",
        "label": "GPT 5.6 Terra"
      },
      {
        "id": "gpt-4.1",
        "label": "GPT-4.1"
      },
      {
        "id": "gpt-4.1-mini",
        "label": "GPT-4.1 mini"
      }
    ]
  },
  "xai": {
    "label": "xAI",
    "models": [
      {
        "id": "grok-4-5",
        "label": "Grok 4.5"
      },
      {
        "id": "grok-4-3",
        "label": "Grok 4.3"
      },
      {
        "id": "grok-4-1-fast",
        "label": "Grok 4.1 Fast"
      },
      {
        "id": "grok-3-mini",
        "label": "Grok 3 mini"
      }
    ]
  }
};
const defaults = {
  "clarification": {
    "provider": "google",
    "model": "gemini-3.8-flash",
    "outputTokens": 1800,
    "research": false,
    "effort": "low"
  },
  "map": {
    "provider": "google",
    "model": "gemini-3.8-flash",
    "outputTokens": 16000,
    "research": true,
    "effort": "low"
  },
  "extraction": {
    "provider": "google",
    "model": "gemini-3.8-flash",
    "outputTokens": 1200,
    "research": false,
    "effort": "low"
  },
  "lesson": {
    "provider": "google",
    "model": "gemini-3.8-flash",
    "outputTokens": 900,
    "research": false,
    "effort": "low"
  },
  "brain": {
    "provider": "google",
    "model": "gemini-3.8-flash",
    "outputTokens": 420,
    "research": false,
    "effort": "low"
  },
  "quiz": {
    "provider": "google",
    "model": "gemini-3.8-flash",
    "outputTokens": 900,
    "research": false,
    "effort": "low"
  }
};
catalog.openai.models.push({id:'gpt-6-astra',label:'GPT-6 Astra'},{id:'gpt-5.6-sol',label:'GPT-5.6 Sol'});
catalog.xai.models.push({id:'grok-4.6',label:'Grok 4.6'});
const key = 'worldview-home-models-v1';
const legacyKey = 'worldview-lab-mock-run-config-gemini38-v2';
const voiceKey = 'wv-lab-voice-routes';
const liveKey = 'worldview-live-lesson-stages-v1';
const liveStages = ['clarification','extraction','lesson','quiz'];
function liveEnabled(stage,storage=localStorage) { return liveStages.includes(stage) && read(storage,liveKey)[stage] === true; }
const labels = {clarification:'Getting started',map:'Lesson planning',extraction:'Your starting knowledge',lesson:'Tutor',brain:'Understanding checks',quiz:'Final review'};
const links = {anthropic:'https://platform.claude.com/docs/en/about-claude/pricing',google:'https://ai.google.dev/gemini-api/docs/pricing',openai:'https://developers.openai.com/api/docs/pricing',xai:'https://docs.x.ai/developers/models',deepgram:'https://deepgram.com/pricing'};
// Standard uncached short-context USD rates checked against official pages 2026-09-10.
const rates = {'claude-opus-5':[5,25],'claude-opus-4-8':[5,25],'claude-sonnet-5':[2,10],'claude-sonnet-4-6':[3,15],'claude-haiku-4-5':[1,5],'claude-fable-5':[10,50],'gemini-3.8-flash':[.75,3.75],'gemini-3.7-flash':[.75,3.75],'gpt-5.6-luna':[.2,1.2],'gpt-5.6-terra':[2,12],'gpt-6-astra':[10,50],'gpt-5.6-sol':[4,20],'grok-4.6':[2,6]};
const speech = {deepgram:{label:'Deepgram',models:['arcas','andromeda','apollo','athena'].map(name=>({id:`aura-2-${name}-en`,label:`Aura-2 · ${name[0].toUpperCase()+name.slice(1)}`}))},device:{label:'This device',models:[{id:'device',label:'Built-in voice'}]}};
const transcription = {deepgram:{label:'Deepgram',models:[{id:'deepgram-nova-3',label:'Nova-3'}]},openai:{label:'OpenAI',models:[{id:'openai-gpt-4o-transcribe',label:'GPT-4o Transcribe'}]},xai:{label:'xAI',models:[{id:'xai-stt',label:'Speech-to-Text'}]}};
const valid = (provider,model) => Object.hasOwn(catalog,provider) && !/^gpt-(live|realtime)/i.test(String(model||'')) && /^[a-z0-9][a-z0-9._:-]{2,63}$/i.test(String(model||''));
function read(storage,k) { try {const value=JSON.parse(storage.getItem(k)||'{}');return value && typeof value==='object' && !Array.isArray(value)?value:{};}catch{return {};}}
function apply(config,storage=localStorage) {
 const saved=read(storage,key), result={};
 for(const stage of Object.keys(defaults)) {
  result[stage]={...(config[stage]||defaults[stage])};
  const choice=saved[stage];
  if(choice && valid(choice.provider,choice.model)) Object.assign(result[stage],{provider:choice.provider,model:choice.model});
 }
 return result;
}
function initial(storage,admin) {
 const legacy=admin?read(storage,legacyKey):{}, config={};
 for(const stage of Object.keys(defaults)) {
  const choice=legacy[stage];
  config[stage]={...defaults[stage]};
  if(choice && valid(choice.provider,choice.model)) Object.assign(config[stage],{provider:choice.provider,model:choice.model});
 }
 return apply(config,storage);
}

function render(host,{admin=false,onVoice=()=>{},storage=localStorage}={}) {
 host.replaceChildren();
 const config=initial(storage,admin);
 const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text)n.textContent=text;return n;};
 host.append(el('p','models-note','Tap a feature for quick choices. Tap a company or model to change it. Settings apply when you open a lesson.'));
 const status=el('p','models-status');status.setAttribute('role','status');
 const persist=(k,value)=>{try{storage.setItem(k,JSON.stringify(value));status.textContent='Saved on this device.';return true;}catch{status.textContent='Could not save. Your previous setting is still in use.';return false;}};
 const details=el('details','models-more');details.append(el('summary','','Planning, checks & standard voice'));
 function row(parent,id,title,choices,selected,save,recommended,custom=false) {
  const canLive=admin&&liveStages.includes(id);
  let useLive=canLive&&liveEnabled(id,storage);
  const section=el('section','model-setting');section.dataset.feature=id;
  const heading=el('button','model-feature',title+' ⌄');heading.type='button';heading.setAttribute('aria-expanded','false');heading.setAttribute('aria-controls','model-presets-'+id);
  const badge=el('span','model-badge');
  const top=el('div','model-setting-top');top.append(heading,badge);
  const presets=el('div','model-presets');presets.id='model-presets-'+id;presets.hidden=true;
  const reset=el('button','','Recommended');reset.type='button';presets.append(reset);
  const company=document.createElement('select'),model=document.createElement('select');
  company.id='model-provider-'+id;model.id='model-choice-'+id;
  company.setAttribute('aria-label',title+' company');model.setAttribute('aria-label',title+' model');
  const controls=el('div','model-setting-controls');controls.append(company,model);
  const price=el('p','model-rate'),liveNote=el('p','model-live-note');
  const advanced=el('details','model-price-details');advanced.append(el('summary','','Price details'));
  const explanation=el('p');advanced.append(explanation);
  const customLine=el('form','model-custom');customLine.hidden=true;
  const input=document.createElement('input');input.setAttribute('aria-label',title+' exact model ID');input.placeholder='Exact model ID';input.maxLength=64;input.required=true;
  const button=el('button','','Use model');button.type='submit';customLine.append(input,button);
  function liveChoice(value){const saved=read(storage,liveKey);saved[id]=value;if(!persist(liveKey,saved))return false;useLive=value;return true;}
  function closePresets(){presets.hidden=true;heading.setAttribute('aria-expanded','false');heading.focus();}
  heading.onclick=()=>{const open=presets.hidden;host.querySelectorAll('.model-presets').forEach(p=>p.hidden=true);host.querySelectorAll('.model-feature').forEach(b=>b.setAttribute('aria-expanded','false'));presets.hidden=!open;heading.setAttribute('aria-expanded',String(open));};
  reset.onclick=()=>{commit({...recommended},true);closePresets();};
  if(canLive){const live=el('button','','GPT Live · natural voice');live.type='button';live.onclick=()=>{liveChoice(true);fill();closePresets();};presets.append(live);}
  function fill(){
   company.replaceChildren();for(const [value,p] of Object.entries(choices))company.add(new Option(p.label,value));
   const provider=useLive?'openai':selected.provider;company.value=provider;
   model.replaceChildren();for(const m of choices[provider].models)model.add(new Option(m.label,m.id));
   if(canLive&&provider==='openai')model.add(new Option('GPT Live 1 · voice','gpt-live-1'));
   if(!useLive&&!choices[provider].models.some(m=>m.id===selected.model))model.add(new Option(selected.model,selected.model));
   if(custom)model.add(new Option('Other model…','__custom__'));
   model.value=useLive?'gpt-live-1':selected.model;customLine.hidden=true;
   badge.textContent=useLive?'Live voice':selected.model===recommended.model&&selected.provider===recommended.provider?'Recommended':'Custom';
   badge.classList.toggle('is-live',useLive);
   const rate=rates[selected.model];
   price.textContent=useLive?'$0.05 / minute + understanding checks':selected.model==='device'?'No cloud voice charge':rate?'$'+rate[0]+' in · $'+rate[1]+' out / 1M tokens':selected.model.startsWith('aura-2-')?'$0.030 / 1,000 characters':'See provider pricing';
   liveNote.hidden=!useLive;liveNote.textContent='Live generates the teaching replies. Your selected Brain model checks understanding in the background. Choose GPT Live beside Text / Voice in the researched lesson, then Start. Selecting it here does not start billing.';
   explanation.replaceChildren();explanation.append(useLive?'Voice costs about $1.50 for 30 minutes or $3 for an hour. Connected silence counts. Startup may cost $0.0125, credited to a running session. Understanding checks and earlier lesson research cost extra. Owner testing: up to ten starts per day. ':rate?'Standard uncached USD API rates. These are token prices, not a fixed lesson quote. Caching, research and long context can change the total. ':'A current per-lesson estimate is unavailable for this model. ');
   const a=el('a','','Official pricing');a.href=useLive?'https://developers.openai.com/api/docs/models/gpt-live-1':links[selected.provider]||'';a.target='_blank';a.rel='noopener noreferrer';if(a.href&&selected.provider!=='device')explanation.append(a);
  }
  function commit(next,resetLive=false){if(!save(next)){fill();return;}selected=next;if(canLive&&(useLive||resetLive))liveChoice(false);fill();}
  company.onchange=()=>commit({provider:company.value,model:choices[company.value].models[0].id});
  model.onchange=()=>{if(model.value==='gpt-live-1'){liveChoice(true);fill();}else if(model.value==='__custom__'){customLine.hidden=false;input.value='';input.focus();}else commit({provider:company.value,model:model.value});};
  customLine.onsubmit=event=>{event.preventDefault();const value=input.value.trim();if(!valid(company.value,value)||/^gpt-(live|realtime)/i.test(value)){input.setCustomValidity('Choose GPT Live from the menu for live voice, or enter a supported text model ID.');input.reportValidity();return;}commit({provider:company.value,model:value});};input.oninput=()=>input.setCustomValidity('');
  section.append(top,presets,controls,customLine,price,liveNote,advanced);parent.append(section);fill();
 }
 for(const stage of ['lesson','clarification','extraction','quiz','map','brain']) row(['map','brain'].includes(stage)?details:host,stage,labels[stage],catalog,config[stage],choice=>{const saved=read(storage,key);saved[stage]=choice;return persist(key,saved);},defaults[stage],true);
 const voices=read(storage,voiceKey);
 for(const [kind,title,choices,fallback] of [['stt','Transcription',transcription,'deepgram-nova-3'],['tts','Spoken replies',speech,'aura-2-arcas-en']]) {
  const value=Object.values(choices).some(p=>p.models.some(m=>m.id===voices[kind]))?voices[kind]:fallback;
  const provider=Object.keys(choices).find(p=>choices[p].models.some(m=>m.id===value));
  row(details,kind,title,choices,{provider,model:value},choice=>{const saved=read(storage,voiceKey);saved[kind]=choice.model;if(!persist(voiceKey,saved))return false;onVoice(kind,choice.model);return true;},{provider:'deepgram',model:fallback});
 }
 host.append(details,el('p','models-note','Text-model rates checked Sep 10; GPT Live Sep 13, 2026. Live voice is currently available for owner testing. Other model IDs need support for the selected task.'),status);
}
return {catalog,defaults,key,liveKey,liveStages,liveEnabled,valid,apply,initial,render};
})();
