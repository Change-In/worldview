/* Courses preview (NAV-152, NAV-154, LES-296–298, BUS-078). Owner-only.
   Adds a bottom tab bar (Home · Courses · Profile) and a Courses page with
   sample courses: the owner's own "The AI Race", a quiz that keeps the
   learner's answer as a snapshot, guides, and a course that builds itself
   while you talk. It stores nothing on the server. "Try this lesson" starts an
   ordinary voice lesson through Home's existing launcher (openHomeLearnerRun).
   Loaded at the end of index.html, after the app's own scripts. */
(() => {
  'use strict';
  const PROMPT = "You are helping me design a voice course for Worldview, an app where an AI tutor teaches through spoken conversation, one short sitting at a time. Interview me before you write anything.\n\nHow to interview me:\n- Ask one question at a time, in plain words, and wait for my answer.\n- Find out: who the course is for; what a learner should be able to explain at the end; my own angle and why I care; what people usually get wrong about this topic; the parts I'd teach and in what order; the sources I use (readings, links, and video clips with start and end times, the date they were filmed, and why I show them); which parts are facts and which are open questions; how I'd like each chapter's quiz to feel; and anything personal I'd add, such as my own story.\n- When something I say is vague, ask what I mean, with an example.\n- When you think you know enough, summarise the course in five lines and ask me if it's right.\n- Write the outline only when I say \"draft it\".\n\nWhen I say \"draft it\", write the outline in exactly this format, so I can paste it into Worldview. Use plain text, no tables.\n\n# Course: <title>\nFor: <who it's for>\nWhy it matters: <two or three sentences in my voice>\nLearners will be able to explain: <one sentence>\n\n## Chapter <n>: <title>\nGoal: <one sentence>\n\n### Sitting <n>: <what the learner can explain after this sitting>\nMode: <one of: Find out what they know | Teach the facts | Compare it to something familiar | Watch and discuss | Story | Explore the sides | Role-play | Estimate it | Case study | What if | Think it through | Reflect | Meet a person | Teach it back>\nKey points:\n- <point>\nCommon mistake to clear up: <optional>\nSources:\n- <type: reading | link | video clip | my recording> | <title> | <link or \"to add\"> | <for clips: start-end, e.g. 12:30-14:05> | <date filmed or published> | <my note: why it matters>\nBridge to the next sitting: <a question that leaves them curious, or \"none\">\n\n### Quiz\nKind: <Thought questions | Teach it back | Quick recall | Oral exam | Debate>\nKeep answers as a snapshot: <yes if the answers are opinions to remember and bring back later, not right or wrong>\nQuestions:\n- <question>\n\n(Repeat chapters as needed. A chapter can have any number of sittings.)\n\n## Optional side path: <title>\nFree: <yes or no>\n<sittings in the same format>\n\nRules for the outline:\n- One learning outcome per sitting, written as something the learner can explain.\n- Mark anything that changes quickly (numbers, rankings, dates) with \"(check often)\".\n- Don't invent quotes or numbers. If a fact needs a source I didn't give, write \"source to add\".\n";
  const LOCAL_FLAG = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && new URLSearchParams(location.search).has('courses');
  const store = {
    get(k, d) { try { const v = localStorage.getItem('wv-courses-' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('wv-courses-' + k, JSON.stringify(v)); } catch (e) {} },
  };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const allowed = () => { if (LOCAL_FLAG) return true; try { return typeof ownerToolsAvailable === 'function' && ownerToolsAvailable(); } catch (e) { return false; } };

  /* ---------------- the owner's course ---------------- */
  const clip = (title, meta, rule) => ({k:'clip', title, meta, rule});
  const doc = (title, meta) => ({k:'doc', title, meta});
  const L = (t, mode, what, src, bridge, topic) => ({t, mode, what, src: src || [], bridge: bridge || '', topic});
  const AIRACE = {
    id:'airace', title:'The AI Race', by:'Cristian P.', pitch:'Who is racing to build AI, why so much money is pouring in, and how fast it is coming.',
    chapters:[
      {t:'Who\'s in the race', sum:'The labs, the chips, the supply chain, the power and the data centers behind AI, and why it is happening now.', lessons:[
        L('Why now? What set off the race', ['Story','Teach the facts'],
          'Starts from what you have already heard. Then the story: in 2017 a Google paper introduced the transformer; models trained on more data and more computing kept getting better; and ChatGPT\'s launch in November 2022 put it in front of everyone and started the race.',
          [doc('"Attention Is All You Need" (2017)', 'The paper behind today\'s models · check often'), doc('ChatGPT launch announcement', 'November 2022')],
          'So who is racing now, and where did they come from?',
          'The AI race, lesson 1: why is it happening now? What set off the race between AI companies: the transformer (2017), bigger models trained on more data and computing, and ChatGPT\'s launch in November 2022.'),
        L('The frontier labs, and where they came from', ['Story','Teach the facts'],
          'Who builds the most capable models: OpenAI, Google DeepMind, Anthropic, Meta, xAI, and labs in China such as DeepSeek. A thread that surprises people: many of them came out of the same few places. Anthropic\'s founders left OpenAI, and Elon Musk co-founded OpenAI before starting xAI.',
          [doc('Company histories', 'Founders and dates · check often')],
          'They all need the same thing to train their models. What is it?',
          'The AI race, lesson 2: the frontier AI labs (OpenAI, Google DeepMind, Anthropic, Meta, xAI, DeepSeek), what they build, and how many of them came out of the same few places.'),
        L('Chips: what they actually do', ['Compare it','Teach the facts'],
          'Why AI runs on chips that do thousands of small calculations at once. A comparison: a regular processor is a few expert chefs; an AI chip is thousands of line cooks. NVIDIA leads, but AMD, Google\'s TPUs, Amazon\'s Trainium and custom chips are all in the race.',
          [doc('Chip explainer', 'GPUs, TPUs and custom chips · check often')],
          'Who actually makes these chips?',
          'The AI race, lesson 3: what AI chips actually do and why AI needs them (GPUs, TPUs, custom chips), NVIDIA and its competitors.'),
        L('The supply chain: a global story', ['Story','Explore the sides'],
          'NVIDIA designs chips but does not make them. Most of the most advanced chips are made by TSMC in Taiwan, with machines that only ASML in the Netherlands builds, and memory from Korea and the US. That is why AI is a global and political issue: export rules, Taiwan, and countries racing to build their own.',
          [doc('Chip supply chain map', 'Countries and companies · check often')],
          'Making the chips is one thing. What does it take to run them?',
          'The AI race, lesson 4: the AI chip supply chain (NVIDIA, TSMC in Taiwan, ASML in the Netherlands, memory makers) and why it makes AI a global and political issue.'),
        L('Power: the grid can\'t keep up', ['Teach the facts','What if'],
          'Training and running models takes enormous amounts of electricity. Grids need upgrades, and companies are signing deals for nuclear, gas and solar power. What if there simply isn\'t enough power where they want to build?',
          [doc('Grid and energy report', 'Figures to add · check often')],
          'All that power goes somewhere. Where?',
          'The AI race, lesson 5: how much electricity AI needs, why power grids need upgrades, and how AI companies are trying to get enough energy.'),
        L('Data centers: water, heat and neighbors', ['Compare it','Explore the sides'],
          'What a data center is and who is building the biggest ones (Microsoft, Google, Amazon, Meta, and OpenAI with partners). Cooling with water, heat and pollution, explained with comparisons people can feel, like a data center\'s water next to a town\'s. Then what nearby communities gain and lose.',
          [doc('Water and energy comparisons', 'Town-sized comparisons · figures to add'), clip('Local news report on a new data center', 'Link to add · date filmed to add', 'Plays after the learner guesses how much water one uses')],
          '',
          'The AI race, lesson 6: AI data centers, who is building them, and their water use, heat and pollution compared to things people know.'),
      ], quiz:{kind:'Thought questions', fact:'Some of the money flowing into AI is among the largest private funding ever raised. The course keeper adds a comparison people can picture.', qs:['Why do you think so much money is going in?','Does this seem like something you should know about?'], snapshot:true}},
      {t:'Why the money: AGI', sum:'What they are actually racing toward, what it could do, and where hope comes from.', lessons:[
        L('What is AGI? A hazy word', ['Teach the facts','Explore the sides'],
          'AGI means different things to different people. OpenAI\'s charter calls it "highly autonomous systems that outperform humans at most economically valuable work." Other leaders use the word in public without defining it, and many follow OpenAI\'s framing.',
          [doc('OpenAI Charter', 'Definition of AGI'), clip('Lab leaders on what AGI means', 'Links to add · dates filmed to add', 'Plays after the learner gives their own definition')],
          'If that is the goal, what happens if they get there, or don\'t?',
          'The AI race, chapter 2, lesson 1: what AGI means, why it is a hazy term, and how different companies define it.'),
        L('What happens if they succeed, or don\'t', ['What if'],
          'So much money is riding on it. If it works, what changes first? If it doesn\'t, what happens to all that investment, and to us?',
          [doc('Course notes', 'Scenarios')],
          'Let\'s imagine it works.',
          'The AI race: what happens if the AI companies succeed in building AGI, and what happens if they don\'t, given how much money is invested.'),
        L('Imagine a computer that can do anything', ['Think it through'],
          'Set aside today\'s worries for a moment. What are the biggest problems you see in the world? Picture a computer that can do anything you ask. How would you use it on them? Each learner builds their own version of hope.',
          [doc('Your own prompts', 'From Cristian\'s presentation')],
          'Some of this is already happening. Where?',
          'Imagine a computer that can do anything you ask: what are the biggest problems in the world, and how could AI help solve them? An optimistic thought exercise about AI.'),
        L('Science and medicine', ['Story','Case study'],
          'Real examples, such as AI predicting the shapes of proteins: that work won part of the 2024 Nobel Prize in Chemistry. What else could open up for medicine and science?',
          [doc('2024 Nobel Prize in Chemistry', 'Protein structure prediction')],
          'Now the hard side.',
          'How AI is helping science and medicine, including protein structure prediction and the 2024 Nobel Prize in Chemistry.'),
        L('Jobs and money: the hard side', ['Explore the sides'],
          'Wealth inequality and work. Andrew Yang\'s case for a universal basic income is a realistic, data-driven and worried view. The other side: new jobs and new kinds of work. The learner weighs both.',
          [clip('Andrew Yang on AI, jobs and a basic income', 'Link to add · date filmed to add', 'Plays if the learner says AI will simply create new jobs')],
          '',
          'How AI could affect jobs and wealth inequality, including Andrew Yang\'s argument for a universal basic income and the counterarguments.'),
        L('Where hope comes from', ['Reflect'],
          'Bring the imagined future and the hard side together. What would you want to be true, and what part could you play? Never graded.',
          [doc('Your own recording', 'Cristian on how he stays hopeful')],
          'How soon do you think all this comes?',
          'Where hope comes from when thinking about AI and the future: a reflective conversation.'),
      ], quiz:{kind:'Thought questions', fact:'Brings back the learner\'s chapter 1 answer, word for word.', qs:['Last chapter you said why the money is there. Would you say it differently now?','What is one problem you would want AI to solve first?'], snapshot:true}},
      {t:'How fast is it coming', sum:'What lab leaders and politicians say, how experts forecast, and your own forecast.', lessons:[
        L('What lab leaders say, and when they said it', ['Watch and discuss'],
          'Short interview clips of lab leaders talking about timelines, each with the date it was filmed and what had just happened at the time. Then compare them.',
          [clip('Dario Amodei interview', 'Link to add · start and end to add · date filmed to add', 'Plays first, after the learner guesses a year'), clip('Demis Hassabis interview', 'Link to add · start and end to add · date filmed to add', 'Plays second, to compare')],
          'What are politicians saying?',
          'The AI race: how fast is AI progressing, and what do AI lab leaders like Dario Amodei and Demis Hassabis say about timelines?'),
        L('What politicians are saying', ['Explore the sides'],
          'How governments and politicians talk about AI: speeches, laws and hearings. Who is worried, who is excited, and about what.',
          [doc('Statements and hearings', 'Sources to add · check often')],
          '',
          'What politicians and governments are saying about AI and how fast it is coming.'),
        L('How experts forecast', ['Teach the facts'],
          'Surveys of researchers, prediction markets and benchmarks: how people try to predict progress, and why forecasts keep moving.',
          [doc('Forecast surveys', 'Sources to add · check often')],
          '',
          'How experts forecast AI progress: surveys, prediction markets and benchmarks.'),
        L('What could slow it down', ['What if'],
          'Chips, power, money, laws, or a public backlash. Which one is most likely to slow the race?',
          [doc('Course notes', 'Scenarios')],
          'So what is your forecast?',
          'What could slow down AI progress: chips, power, money, regulation and public backlash.'),
        L('Your own forecast', ['Think it through'],
          'The learner makes a forecast and defends it, using everything from the course.',
          [],
          '',
          'Make and defend your own forecast of how fast AI will change the world.'),
      ], quiz:{kind:'Debate', fact:'', qs:['Will AI do most of your future job? Defend your answer.'], snapshot:true}},
    ],
    side:{t:'Staying grounded', what:'Cristian\'s own story on video: how learning about AI shaped him, the questions he had to face, and what helped. Then a reflection, and a person to talk to if you want one. Free, optional, never graded, and labelled as his personal view.'},
  };
  const OTHERS = [
    {id:'coffee', title:'Coffee, Bean to Cup', by:'Theo K.', lessons:['From cherry to bean','Washed or natural','Roasting','Q','Grind and water','Espresso vs. filter','Tasting like a pro','Q'], done:2},
    {id:'moon', title:'How the Moon Moves the Sea', by:'Maya R.', lessons:['Two tides a day','The Moon\'s uneven pull','The Sun joins in','Spring and neap tides','Q'], done:4},
    {id:'econ', title:'ECON 102 · Intro to Macroeconomics', by:'School · Prof. Lin', school:true, lessons:['Who counts as unemployed','Three kinds of unemployment','The phases of a cycle','What a recession is','Q','What counts as spending','Why the curve slopes down','Q'], done:3},
  ];
  const GUIDES = [
    {i:'EV', n:'Elena V.', d:'Former physics professor. Talks about AI, meaning and work.', on:true},
    {i:'ST', n:'Sam T.', d:'Career coach. What AI means for your job.', on:true},
    {i:'RK', n:'Rafael K.', d:'Ethics lecturer. Hard questions, honestly.', on:false},
  ];
  const aiFlat = () => { const out = []; AIRACE.chapters.forEach((c, ci) => { c.lessons.forEach((l, li) => out.push({c:ci, l:li, t:l.t, q:false})); out.push({c:ci, t:'Quiz', q:true}); }); return out; };
  const AI_DONE = 1; // the owner has finished lesson 1 in this sample

  /* ---------------- state ---------------- */
  const S = {open:false, scr:'home', tab:store.get('tab', 'mine'), view:store.get('view', 'focus'), focus:'airace', openCh:0, openLesson:'0:0',
    quiz:{step:0, answer:''}, make:{step:0, msgs:[], built:0, input:''}, sheet:null};
  const ICON = {
    home:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11.5 12 5l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5h-5v5H5a1 1 0 0 1-1-1z"/></svg>',
    courses:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7h18M3 12h18M3 17h18"/><circle cx="7" cy="7" r="1.9" fill="currentColor"/><circle cx="15" cy="12" r="1.9" fill="currentColor"/><circle cx="10" cy="17" r="1.9" fill="currentColor"/></svg>',
    profile:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5"/></svg>',
  };

  /* ---------------- DOM ---------------- */
  const bar = document.createElement('nav');
  bar.id = 'wv-tabbar'; bar.hidden = true; bar.setAttribute('aria-label', 'Main sections');
  bar.innerHTML = `<button type="button" data-tabbar="home">${ICON.home}Home</button><button type="button" data-tabbar="courses">${ICON.courses}Courses</button><button type="button" data-tabbar="profile">${ICON.profile}Profile</button>`;
  const view = document.createElement('section');
  view.id = 'courses-view'; view.className = 'cv'; view.hidden = true; view.setAttribute('aria-label', 'Courses');
  document.body.append(view, bar);

  /* ---------------- helpers ---------------- */
  let toastTimer = 0;
  function toast(msg) {
    view.querySelectorAll('.cv-toast').forEach(t => t.remove());
    const t = document.createElement('div'); t.className = 'cv-toast'; t.setAttribute('role', 'status'); t.textContent = msg;
    view.appendChild(t); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.remove(), 2800);
  }
  const chip = (txt, cls) => `<span class="cv-chip${cls ? ' ' + cls : ''}">${esc(txt)}</span>`;
  const modeChips = m => m.map((x, i) => (i ? '<span class="cv-muted" aria-hidden="true">→</span>' : '') + chip(x, /Reflect|Think|What if|Watch|Compare|Story|Case/.test(x) ? 'vi' : '')).join('');
  function mini(items, done) {
    const n = items.length, x = i => `calc(5px + ${(i / Math.max(1, n - 1)) * 100}% - ${(i / Math.max(1, n - 1)) * 10}px)`;
    const fill = done ? `calc(${(Math.min(done, n - 1) / Math.max(1, n - 1)) * 100}% - ${(Math.min(done, n - 1) / Math.max(1, n - 1)) * 10}px + 5px)` : '0';
    return `<div class="cv-mini" aria-hidden="true"><span class="f" style="width:${fill}"></span>${items.map((q, i) => `<i class="${q ? 'q' : ''}${i < done ? ' d' : i === done ? ' n' : ''}" style="left:${x(i)}"></i>`).join('')}</div>`;
  }

  /* ---------------- screens ---------------- */
  function scrHome() {
    const tabs = `<div class="cv-seg" role="tablist"><button type="button" role="tab" data-ctab="mine" class="${S.tab === 'mine' ? 'on' : ''}" aria-selected="${S.tab === 'mine'}">My courses</button><button type="button" role="tab" data-ctab="explore" class="${S.tab === 'explore' ? 'on' : ''}" aria-selected="${S.tab === 'explore'}">Explore</button></div>`;
    const head = `<div class="cv-head"><h1>Courses</h1><button type="button" class="cv-pill" data-go="make">+ Make a course</button></div><span class="cv-note"><i></i>Preview · only your account sees this</span>`;
    return head + tabs + (S.tab === 'mine' ? mine() : explore());
  }
  function mine() {
    const sw = `<div class="cv-row"><span class="cv-muted">${S.view === 'focus' ? 'One course open, the rest out of the way.' : 'Every course as a line of stops.'}</span><span class="sp"></span><div class="cv-seg small" role="group" aria-label="View"><button type="button" data-view="focus" class="${S.view === 'focus' ? 'on' : ''}">Focus</button><button type="button" data-view="metro" class="${S.view === 'metro' ? 'on' : ''}">Metro</button></div></div>`;
    const flat = aiFlat();
    const courses = [{id:'airace', title:AIRACE.title, by:'You made this · ' + AIRACE.by, items:flat.map(x => x.q), labels:flat.map(x => x.q ? 'Quiz' : x.t), done:AI_DONE, next:`Next: ${flat[AI_DONE].t}`, own:true},
      ...OTHERS.map(o => ({id:o.id, title:o.title, by:o.by, items:o.lessons.map(t => t === 'Q'), labels:o.lessons.map(t => t === 'Q' ? 'Quiz' : t), done:o.done, next:`Next: ${o.lessons[o.done] === 'Q' ? 'the quiz, when you\'re ready' : o.lessons[o.done]}`, school:o.school}))];
    if (S.view === 'metro') return sw + courses.map(c => {
      const gap = 70, W = 28 * 2 + (c.items.length - 1) * gap;
      return `<div class="cv-card"><div class="cv-row"><b class="cv-serif" style="font-size:17px;flex:1">${esc(c.title)}</b>${c.school ? chip('School', 'ok') : c.own ? chip('Yours', 'acc') : ''}</div>
        <div class="cv-metro" data-scrollto="${Math.max(0, 28 + (c.done - 1) * gap - 30)}"><div class="cv-metro-in" style="width:${W}px"><span class="f" style="width:${Math.max(0, c.done * gap)}px"></span>${c.items.map((q, i) => `<button type="button" class="cv-st${q ? ' q' : ''}${i < c.done ? ' done' : i === c.done ? ' next' : ''}" style="left:${28 + i * gap}px" ${c.id === 'airace' ? `data-jump="${i}"` : `data-toast="Sample course. Open The AI Race for the full version."`} aria-label="${esc(c.labels[i])}"><span class="d"></span><span class="l">${esc(c.labels[i])}</span></button>`).join('')}</div></div>
        <span class="cv-muted">${esc(c.next)}</span></div>`;
    }).join('');
    return sw + courses.map(c => {
      if (S.focus !== c.id) return `<button type="button" class="cv-course" data-focus="${c.id}"><span class="t"><b>${esc(c.title)}</b>${c.school ? chip('School', 'ok') : c.own ? chip('Yours', 'acc') : ''}</span>${mini(c.items, c.done)}<span class="nx">${esc(c.next)}</span></button>`;
      const cards = c.id === 'airace'
        ? flat.map((x, i) => x.q ? `<button type="button" class="cv-lcard quiz${i < c.done ? ' done' : i === c.done ? ' next' : ''}" data-go="quiz"><span class="k">Ch ${x.c + 1}</span><span class="tt">Quiz</span><span class="s">When you're ready</span></button>`
          : `<button type="button" class="cv-lcard${i < c.done ? ' done' : i === c.done ? ' next' : ''}" data-jump="${i}"><span class="k">Ch ${x.c + 1} · Lesson ${x.l + 1}</span><span class="tt">${esc(x.t)}</span><span class="s">${i < c.done ? '✓ Done' : i === c.done ? 'Up next' : ''}</span></button>`).join('')
        : c.labels.map((t, i) => `<button type="button" class="cv-lcard${c.items[i] ? ' quiz' : ''}${i < c.done ? ' done' : i === c.done ? ' next' : ''}" data-toast="Sample course. Open The AI Race for the full version."><span class="k">${c.items[i] ? 'Quiz' : 'Lesson ' + (i + 1)}</span><span class="tt">${esc(t)}</span><span class="s">${i < c.done ? '✓ Done' : i === c.done ? 'Up next' : ''}</span></button>`).join('');
      return `<div class="cv-course open"><span class="t"><b>${esc(c.title)}</b>${c.school ? chip('School', 'ok') : c.own ? chip('Yours', 'acc') : ''}</span><span class="nx">${esc(c.by)}</span>
        <div class="cv-hs" data-scrollto-card="${c.done}"><div class="cv-track">${cards}</div></div>
        <div class="cv-row">${c.id === 'airace' ? '<button type="button" class="cv-pill" data-go="course">Open course</button><button type="button" class="cv-pill ghost" data-try="0:1">Continue for real</button>' : `<span class="cv-muted">${esc(c.next)}</span>`}</div></div>`;
    }).join('');
  }
  function explore() {
    return `<div class="cv-lab">Start here · a series</div>
      <div class="cv-card"><div class="cv-series"><span>Intro to AI</span><i>›</i><span class="on">The AI Race</span><i>›</i><span>AI and your work · soon</span></div><span class="cv-muted">Courses can lead into each other, like a first-year sequence.</span></div>
      <div class="cv-lab">People you can talk to</div>
      <div class="cv-hs">${GUIDES.map(g => `<button type="button" class="cv-guide" data-sheet="guide:${g.i}"><span class="cv-av${g.on ? ' on' : ''}">${g.i}</span><b>${esc(g.n)}</b><span>${esc(g.d)}</span><span>${g.on ? 'Available now' : 'Away'}</span></button>`).join('')}</div>
      <div class="cv-lab">Courses</div>
      <button type="button" class="cv-ex feature" data-go="course"><span class="t"><b>The AI Race</b>${chip('★ 4.8')}</span><span class="cv-muted">by Cristian P. · 3 chapters · 17 lessons · updated weekly</span><span>${chip('First chapter free, then $12 once', 'acc')}</span></button>
      <button type="button" class="cv-ex" data-toast="Sample course"><span class="t"><b>How the Moon Moves the Sea</b>${chip('★ 4.6')}</span><span class="cv-muted">by Maya R. · 5 lessons</span><span>${chip('Free', 'ok')}</span></button>
      <button type="button" class="cv-ex" data-toast="Sample course"><span class="t"><b>Coffee, Bean to Cup</b>${chip('★ 4.7')}</span><span class="cv-muted">by Theo K. · 8 lessons</span><span>${chip('$8 once', 'acc')}</span></button>
      <button type="button" class="cv-ex" data-toast="Sample course"><span class="t"><b>Negotiating a Raise</b>${chip('★ 4.7')}</span><span class="cv-muted">by Dana O. · 10 lessons</span><span>${chip('$15 once, or paid by your company', 'acc')}</span></button>`;
  }
  function scrCourse() {
    const total = AIRACE.chapters.reduce((n, c) => n + c.lessons.length, 0);
    const chs = AIRACE.chapters.map((c, ci) => {
      const open = S.openCh === ci;
      let body = '';
      if (open) {
        body = c.lessons.map((l, li) => {
          const key = ci + ':' + li, lo = S.openLesson === key;
          return `<div class="cv-ls"><button type="button" class="cv-ls-h" data-lesson="${key}" aria-expanded="${lo}"><span class="i">${li + 1}</span><b>${esc(l.t)}</b><em>${lo ? '−' : '+'}</em><span class="m">${modeChips(l.mode)}</span></button>
            ${lo ? `<div class="cv-ls-b"><p>${esc(l.what)}</p>
              ${l.src.map(s => `<div class="cv-src"><span class="th${s.k === 'doc' ? ' doc' : ''}">${s.k === 'clip' ? '▶' : '❐'}</span><span><b>${esc(s.title)}</b><span>${esc(s.meta)}</span>${s.rule ? `<span class="rule">Plays when: ${esc(s.rule.replace(/^Plays /, ''))}</span>` : ''}</span></div>`).join('')}
              ${l.bridge ? `<div class="cv-bridge">Bridge: "${esc(l.bridge)}"</div>` : ''}
              <button type="button" class="cv-pill" data-try="${key}" style="justify-self:start">Try this lesson for real</button></div>` : ''}</div>`;
        }).join('') + `<div class="cv-quizcard"><span class="cv-row"><b>Chapter ${ci + 1} quiz</b><span class="sp"></span>${chip(c.quiz.kind, 'acc')}${c.quiz.snapshot ? chip('Snapshot', 'vi') : ''}</span>
          ${c.quiz.fact ? `<span class="fact">${esc(c.quiz.fact)}</span>` : ''}
          ${c.quiz.qs.map(q => `<q>${esc(q)}</q>`).join('')}
          <span class="cv-muted">${c.quiz.snapshot ? 'Answers are kept as the learner said them, never marked wrong, and brought back later.' : ''} Opens when the chapter's lessons are done.</span>
          ${ci < 2 ? '<button type="button" class="cv-pill ghost" data-go="quiz" style="justify-self:start">Try the quiz demo</button>' : ''}</div>`;
      }
      return `<div class="cv-ch"><button type="button" class="cv-ch-h" data-ch="${ci}" aria-expanded="${open}"><span class="n">${ci + 1}</span><b>${esc(c.t)}</b><em>${open ? '▾' : '▸'}</em><span>${c.lessons.length} lessons · ${esc(c.sum)}</span></button>${body}</div>`;
    }).join('');
    return `<div class="cv-head"><button type="button" class="cv-back" data-go="home" aria-label="Back">‹</button><h1 class="sm">The AI Race</h1></div>
      <div class="cv-hero"><span class="cv-lab" style="margin:0">Course · by ${esc(AIRACE.by)}</span><h2>The AI Race</h2><p>${esc(AIRACE.pitch)}</p>
        <div class="cv-row" style="flex-wrap:wrap;gap:6px">${chip(AIRACE.chapters.length + ' chapters')}${chip(total + ' lessons')}${chip('About 20 min each')}${chip('Updated weekly', 'ok')}${chip('Runs on Gemini Live')}</div>
        <div class="cv-price"><b>First chapter free. Then $12 once for the rest.</b><span>A demo price. Nothing is charged. Taught in your own tutor style.</span></div>
        <div class="cv-row" style="flex-wrap:wrap"><button type="button" class="cv-pill" data-try="0:0">Try lesson 1 for real</button><button type="button" class="cv-pill ghost" data-go="quiz">See the quiz demo</button></div></div>
      <div class="cv-lab">Chapters · tap a lesson to see what happens in it</div>${chs}
      <div class="cv-side">${chip('Free side path', 'acc')}<b>${esc(AIRACE.side.t)}</b><p class="cv-muted" style="margin:0;font-size:13.5px">${esc(AIRACE.side.what)}</p><div class="cv-row"><button type="button" class="cv-pill ghost" data-toast="Plays Cristian's video, then a short reflection">Watch Cristian's story</button><button type="button" class="cv-pill soft" data-sheet="guide:EV">Talk to a person</button></div></div>
      <p class="cv-muted" style="text-align:center">Clips and readings marked "to add" are placeholders for your links.</p>`;
  }
  function scrQuiz() {
    const q = S.quiz, ans = q.answer.trim() || 'I think they just want to build better AI than the others.';
    const steps = `<div class="cv-steps" aria-hidden="true">${[0,1,2,3].map(i => `<i class="${i <= q.step ? 'on' : ''}"></i>`).join('')}</div>`;
    const head = `<div class="cv-head"><button type="button" class="cv-back" data-go="course" aria-label="Back">‹</button><h1 class="sm">The AI Race · quiz demo</h1></div>${steps}`;
    if (q.step === 0) return head + `<div class="cv-stage"><span class="cv-lab" style="text-align:center">Chapter 1 quiz · thought questions</span>
      <div class="cv-fact"><b>Quick fact</b>Some of the money flowing into AI is among the largest private funding ever raised.</div>
      <p class="cv-tut">Why do you think so much money is going in? Does it seem like something you should know about?</p>
      <textarea class="cv-answer" id="cv-answer" placeholder="Say it out loud in the real version. Here, type it.">${esc(q.answer)}</textarea>
      <div class="cv-row" style="flex-wrap:wrap"><button type="button" class="cv-pill" data-qstep="1">Save my answer</button><button type="button" class="cv-pill ghost" data-qexample="1">Use an example answer</button></div></div>`;
    if (q.step === 1) return head + `<div class="cv-stage"><div class="cv-snap"><b>Snapshot saved</b><q>${esc(ans)}</q><span class="cv-muted">Kept exactly as you said it. Not marked right or wrong. It comes back later in the course.</span></div>
      <button type="button" class="cv-pill wide" data-qstep="2">Skip ahead two weeks</button></div>`;
    if (q.step === 2) return head + `<div class="cv-stage"><span class="cv-lab" style="text-align:center">Two weeks later · Chapter 2 quiz</span>
      <div class="cv-snap"><b>Your answer from chapter 1</b><q>${esc(ans)}</q></div>
      <p class="cv-tut">After this chapter on AGI, would you say it differently?</p>
      <div class="cv-check"><p style="margin:0">The next questions are about jobs and meaning, and they can feel heavy. You choose.</p><div class="cv-row" style="flex-wrap:wrap;gap:8px"><button type="button" class="cv-pill" data-qstep="3">Keep going</button><button type="button" class="cv-pill ghost" data-qpause="1">Pause</button><button type="button" class="cv-pill soft" data-sheet="guide:EV">Talk to a person</button></div></div>
      <button type="button" class="cv-link" data-sheet="support">Need support right now?</button></div>`;
    return head + `<div class="cv-stage"><span class="cv-lab" style="text-align:center">Chapter 2 quiz · question 2</span>
      <p class="cv-tut">Picture a computer that can do anything you ask. What is the first problem in the world you would hand it?</p>
      <p class="cv-muted" style="text-align:center">This is your "imagine" exercise from lesson 3, used as a quiz question. Your answer becomes the next snapshot.</p>
      <button type="button" class="cv-pill wide" data-go="course">End the demo</button><button type="button" class="cv-link" data-sheet="support">Need support right now?</button></div>`;
  }
  const SCRIPT = [
    {ai:'What is the course about? Say it the way you would pitch it to a friend.', ex:'The AI race: who\'s in it, why so much money is going in, and how fast it\'s coming.',
      build:[['h','The AI Race'], ['i','For anyone hearing about AI in the news']]},
    {ai:'Who is it for, and what do they usually get wrong at the start?', ex:'Anyone hearing about AI in the news. They think it\'s just chatbots, not a global race over chips, power and money.',
      build:[['i','Clears up: "AI is just chatbots"']]},
    {ai:'Walk me through your order. What comes first, and how do you get from one part to the next?', ex:'First who\'s involved: the labs, chips, the supply chain, power and data centers. Then I ask why the funding is so big, which leads to AGI. Then timelines.',
      build:[['c','1 · Who\'s in the race'], ['i','Why now? · The frontier labs · Chips · The supply chain · Power · Data centers'], ['c','2 · Why the money: AGI'], ['i','What is AGI? · If they succeed · Imagine · Science · Jobs · Hope'], ['c','3 · How fast is it coming'], ['i','Lab leaders · Politicians · Forecasts · What slows it · Your forecast']]},
    {ai:'What do you show? Any clips? For each one I will want when it was filmed and why you show it.', ex:'Short interview clips of Dario Amodei and Demis Hassabis on timelines, and Andrew Yang on jobs and inequality. I explain when each was filmed.',
      build:[['i','▶ Dario Amodei interview · chapter 3 · link to add'], ['i','▶ Demis Hassabis interview · chapter 3 · link to add'], ['i','▶ Andrew Yang on jobs · chapter 2 · link to add']]},
    {ai:'How should each chapter\'s quiz feel?', ex:'Thought-provoking. Why so much money? What would you fix with a computer that can do anything? Keep their answers and bring them back later.',
      build:[['i','Quizzes: thought questions, answers kept as snapshots'], ['i','Free side path: your own story, on video']]},
  ];
  function scrMake() {
    const m = S.make, done = m.step >= SCRIPT.length;
    const all = [];
    SCRIPT.slice(0, Math.min(m.step + 1, SCRIPT.length)).forEach((s, i) => { all.push(`<div class="cv-bub ai">${esc(s.ai)}</div>`); if (m.msgs[i]) all.push(`<div class="cv-bub me">${esc(m.msgs[i])}</div>`); });
    if (done) all.push('<div class="cv-bub ai">Here is your course: 3 chapters, 17 lessons, 3 quizzes and a free side path. Anything without a source is marked "source to add". Open it to edit any lesson.</div>');
    const shown = m.showAll ? all : all.slice(-1);
    const built = [];
    SCRIPT.slice(0, m.step).forEach((s, si) => s.build.forEach(([k, t]) => built.push(k === 'h' ? `<div class="chh" style="font-size:22px">${esc(t)}</div>` : k === 'c' ? `<div class="chh">${esc(t)}</div>` : `<div class="it${si === m.step - 1 ? ' new' : ''}">${esc(t)}</div>`)));
    return `<div class="cv-head"><button type="button" class="cv-back" data-go="home" aria-label="Back">‹</button><h1 class="sm">Make a course</h1></div>
      <span class="cv-note"><i></i>Coming as a paid feature: talk, and your course builds itself</span>
      <div class="cv-lab">Your course, building as you talk · ${Math.min(m.step, SCRIPT.length)} of ${SCRIPT.length}</div>
      <div class="cv-card cv-built">${built.length ? built.join('') : '<div class="empty">Answer the first question below and your course starts to appear here.</div>'}</div>
      <div class="cv-card"><div class="cv-chat">${shown.join('')}</div>
        ${all.length > 1 ? `<button type="button" class="cv-link" data-mall="1">${m.showAll ? 'Show only the latest' : 'See the whole conversation'}</button>` : ''}
        ${done ? '<button type="button" class="cv-pill wide" data-go="course">Open the course</button>' : `<div class="cv-compose"><textarea id="cv-make-in" placeholder="Answer by voice in the real version. Here, type it, or use your example.">${esc(m.input)}</textarea><div class="cv-row" style="flex-wrap:wrap"><button type="button" class="cv-pill" data-msend="1">Send</button><button type="button" class="cv-pill ghost" data-mex="1">Use my example answer</button></div></div>`}</div>
      <div class="cv-card"><h3>Prefer another AI?</h3><p class="cv-muted">Copy a prompt for ChatGPT or any assistant. It interviews you the same way, then writes the outline in Worldview's format.</p><button type="button" class="cv-pill ghost" data-copyprompt="1" style="justify-self:start">Copy the prompt</button></div>
      ${m.step ? '<button type="button" class="cv-link" data-mreset="1">Start over</button>' : ''}`;
  }
  function sheetHTML() {
    if (!S.sheet) return '';
    let h = '';
    if (S.sheet.startsWith('guide')) {
      const g = GUIDES.find(x => x.i === S.sheet.split(':')[1]) || GUIDES[0];
      h = `<span class="cv-av${g.on ? ' on' : ''}">${g.i}</span><h3>${esc(g.n)}</h3><p class="cv-muted">${esc(g.d)}</p><p>${g.on ? 'Available now for a 20-minute voice call. They have seen this lesson\'s questions; the talk is a conversation, not a quiz.' : 'Away right now. You can ask for a time.'}</p>${chip('Free on The AI Race side path', 'acc')}<p class="cv-muted" style="font-size:12.5px">Guides are real people, not therapists. If you are in crisis, use "Need support right now?".</p><button type="button" class="cv-pill wide" data-toast="Demo: the real version sends ${esc(g.n.split(' ')[0])} a request.">${g.on ? 'Talk now' : 'Ask for a time'}</button>`;
    } else if (S.sheet === 'support') {
      h = `<h3>Need support right now?</h3><p>If you are struggling or thinking about hurting yourself, you can call or text <b>988</b>, the Suicide &amp; Crisis Lifeline (US), any time. It is free and confidential.</p><p class="cv-muted">You can also pause this course. It will be here when you are ready.</p><button type="button" class="cv-pill wide" data-close="1">Close</button>`;
    } else if (S.sheet.startsWith('try:')) {
      const [ci, li] = S.sheet.slice(4).split(':').map(Number), l = AIRACE.chapters[ci].lessons[li];
      h = `${chip('Real lesson', 'acc')}<h3>${esc(l.t)}</h3><p>This starts an ordinary Worldview voice lesson on this lesson's topic, so you can feel what it would be like. The course parts (snapshots, the chapter quiz, your clips) aren't built yet.</p><p class="cv-muted" style="font-size:12.5px">Topic: ${esc(l.topic)}</p><button type="button" class="cv-pill wide" data-start="${ci}:${li}">Start the voice lesson</button><button type="button" class="cv-pill ghost wide" data-close="1">Not now</button>`;
    }
    return `<div class="cv-ov" data-close="1"><div class="cv-sheet" role="dialog" aria-modal="true"><span class="grab"></span>${h}</div></div>`;
  }
  function render() {
    const html = S.scr === 'course' ? scrCourse() : S.scr === 'quiz' ? scrQuiz() : S.scr === 'make' ? scrMake() : scrHome();
    view.innerHTML = `<div class="cv-wrap">${html}</div>${sheetHTML()}`;
    view.querySelectorAll('[data-scrollto]').forEach(el => { el.scrollLeft = +el.dataset.scrollto || 0; });
    view.querySelectorAll('[data-scrollto-card]').forEach(el => { const i = +el.dataset.scrolltoCard; const card = el.querySelectorAll('.cv-lcard')[i]; if (card) el.scrollLeft = Math.max(0, card.offsetLeft - 40); });
    syncBar();
  }
  function go(scr) { S.scr = scr; S.sheet = null; render(); view.scrollTop = 0; }

  /* ---------------- open / close ---------------- */
  function openCourses() { S.open = true; view.hidden = false; document.body.classList.add('cv-open'); render(); view.focus?.(); }
  function closeCourses() { S.open = false; S.sheet = null; view.hidden = true; document.body.classList.remove('cv-open'); syncBar(); }
  function deckButton(id) { return document.getElementById(id); }
  function syncBar() {
    let active = 'home';
    if (S.open) active = 'courses';
    else if (deckButton('rail-profile')?.classList.contains('active')) active = 'profile';
    bar.querySelectorAll('button').forEach(b => { const on = b.dataset.tabbar === active; b.classList.toggle('on', on); if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  }
  bar.addEventListener('click', e => {
    const b = e.target.closest('[data-tabbar]'); if (!b) return;
    const t = b.dataset.tabbar;
    if (t === 'courses') { if (S.open && S.scr !== 'home') go('home'); else openCourses(); return; }
    closeCourses();
    deckButton(t === 'profile' ? 'rail-profile' : 'rail-explore')?.click();
    setTimeout(syncBar, 60);
  });

  /* ---------------- events ---------------- */
  view.addEventListener('click', e => {
    const t = e.target.closest('[data-go],[data-ctab],[data-view],[data-focus],[data-jump],[data-ch],[data-lesson],[data-try],[data-start],[data-sheet],[data-close],[data-toast],[data-qstep],[data-qexample],[data-qpause],[data-msend],[data-mex],[data-mreset],[data-mall],[data-copyprompt]');
    if (!t) return;
    if (t.dataset.close && t.classList.contains('cv-ov') && e.target !== t) return;
    const d = t.dataset;
    if (d.go) { if (d.go === 'quiz') S.quiz.step = 0; return go(d.go); }
    if (d.ctab) { S.tab = d.ctab; store.set('tab', S.tab); return render(); }
    if (d.view) { S.view = d.view; store.set('view', S.view); return render(); }
    if (d.focus) { S.focus = d.focus; return render(); }
    if (d.jump !== undefined) { const x = aiFlat()[+d.jump]; if (x.q) { S.quiz.step = 0; return go('quiz'); } S.openCh = x.c; S.openLesson = x.c + ':' + x.l; go('course'); setTimeout(() => view.querySelector('.cv-ls-h[aria-expanded="true"]')?.scrollIntoView({block:'center'}), 30); return; }
    if (d.ch !== undefined) { const c = +d.ch; S.openCh = S.openCh === c ? -1 : c; S.openLesson = c + ':0'; return render(); }
    if (d.lesson) { S.openLesson = S.openLesson === d.lesson ? '' : d.lesson; return render(); }
    if (d.try) { S.sheet = 'try:' + d.try; return render(); }
    if (d.start) { const [ci, li] = d.start.split(':').map(Number); return startReal(AIRACE.chapters[ci].lessons[li].topic); }
    if (d.sheet) { S.sheet = d.sheet; return render(); }
    if (d.close) { S.sheet = null; return render(); }
    if (d.toast) { toast(d.toast); return; }
    if (d.qexample) { S.quiz.answer = 'I think they just want to build better AI than the others.'; return render(); }
    if (d.qstep) { if (d.qstep === '1') { const v = view.querySelector('#cv-answer')?.value || ''; S.quiz.answer = v.trim() ? v : S.quiz.answer; } S.quiz.step = +d.qstep; render(); view.scrollTop = 0; return; }
    if (d.qpause) { toast('Paused. It will be here when you are ready.'); return; }
    if (d.mex) { const box = view.querySelector('#cv-make-in'); if (box) box.value = SCRIPT[S.make.step].ex; S.make.input = SCRIPT[S.make.step].ex; return; }
    if (d.msend) { const v = (view.querySelector('#cv-make-in')?.value || '').trim(); const m = S.make; m.msgs[m.step] = v || SCRIPT[m.step].ex; m.step++; m.input = ''; render(); view.scrollTop = 0; return; }
    if (d.mall) { S.make.showAll = !S.make.showAll; return render(); }
    if (d.mreset) { S.make = {step:0, msgs:[], built:0, input:''}; return render(); }
    if (d.copyprompt) { try { navigator.clipboard.writeText(PROMPT).then(() => toast('Prompt copied. Paste it into ChatGPT.'), () => toast('Copy did not work on this device.')); } catch (err) { toast('Copy did not work on this device.'); } }
  });
  view.addEventListener('input', e => { if (e.target.id === 'cv-answer') S.quiz.answer = e.target.value; if (e.target.id === 'cv-make-in') S.make.input = e.target.value; });
  document.addEventListener('keydown', e => { if (e.key !== 'Escape' || !S.open) return; if (S.sheet) { S.sheet = null; render(); } else if (S.scr !== 'home') go('home'); });

  async function startReal(topic) {
    if (typeof openHomeLearnerRun !== 'function') { toast('Lessons can only start from the app.'); return; }
    S.sheet = null; render();
    toast('Opening the voice lesson…');
    let ok = false;
    try { ok = await openHomeLearnerRun({topic, entryMode:'voice'}); } catch (err) { ok = false; }
    if (!ok) toast('The lesson did not start. Check that you are signed in, then try again.');
  }

  /* ---------------- visibility ---------------- */
  function blocked() {
    const shown = id => { const el = document.getElementById(id); if (!el) return false; const cs = getComputedStyle(el); return cs.display !== 'none' && cs.visibility !== 'hidden'; };
    if (['settings','direction','mic-primer','lesson-intake','lesson-entry-mode'].some(shown)) return true;
    if (['version-sheet','models-sheet'].some(id => document.getElementById(id)?.getAttribute('aria-hidden') === 'false')) return true;
    return !!document.querySelector('dialog[open]');
  }
  function tick() {
    const ok = allowed();
    const home = document.getElementById('view-home')?.classList.contains('active');
    if (!ok && S.open) closeCourses();
    const show = ok && (home || S.open) && !blocked();
    if (bar.hidden === show) bar.hidden = !show;
    document.body.classList.toggle('wv-tabs', ok && !!home);
    if (show) syncBar();
  }
  tick();
  setInterval(tick, 1200);
  document.addEventListener('scroll', () => { if (!S.open) syncBar(); }, {capture:true, passive:true});
})();
