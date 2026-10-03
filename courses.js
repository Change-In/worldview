/* Courses preview (NAV-152, NAV-154, NAV-155, LES-296–300, BUS-078). Owner-only.
   A bottom tab bar (Home · Courses · Profile) and a Courses page:
   - My courses: Focus only, nothing open until you tap a course. Your own
     course, the courses you add from Explore, and the classes you join.
   - Explore: subjects you can browse (a library-style tree), search, sorting.
   - Find your school: join a class with a code; courses made by students.
   - An opened course is one metro line, every lesson titled in full.
   - The owner's course, The AI Race, in full; a quiz demo that keeps the
     learner's answer as a snapshot; a course that builds while you talk.
   Nothing is stored on the server. "Try this lesson for real" starts an
   ordinary voice lesson through Home's launcher (openHomeLearnerRun).
   Loaded at the end of index.html, after the app's own scripts. */
(() => {
  'use strict';
  const PROMPT = "You are helping me design a voice course for Worldview, an app where an AI tutor teaches through spoken conversation, one short sitting at a time. Interview me before you write anything.\n\nHow to interview me:\n- Ask one question at a time, in plain words, and wait for my answer.\n- Find out: who the course is for; what a learner should be able to explain at the end; my own angle and why I care; what people usually get wrong about this topic; the parts I'd teach and in what order; the sources I use (readings, links, and video clips with start and end times, the date they were filmed, and why I show them); which parts are facts and which are open questions; how I'd like each chapter's quiz to feel; and anything personal I'd add, such as my own story.\n- When something I say is vague, ask what I mean, with an example.\n- When you think you know enough, summarise the course in five lines and ask me if it's right.\n- Write the outline only when I say \"draft it\".\n\nWhen I say \"draft it\", write the outline in exactly this format, so I can paste it into Worldview. Use plain text, no tables.\n\n# Course: <title>\nFor: <who it's for>\nWhy it matters: <two or three sentences in my voice>\nLearners will be able to explain: <one sentence>\n\n## Chapter <n>: <title>\nGoal: <one sentence>\n\n### Sitting <n>: <what the learner can explain after this sitting>\nMode: <one of: Find out what they know | Teach the facts | Compare it to something familiar | Watch and discuss | Story | Explore the sides | Role-play | Estimate it | Case study | What if | Think it through | Reflect | Meet a person | Teach it back>\nKey points:\n- <point>\nCommon mistake to clear up: <optional>\nSources:\n- <type: reading | link | video clip | my recording> | <title> | <link or \"to add\"> | <for clips: start-end, e.g. 12:30-14:05> | <date filmed or published> | <my note: why it matters>\nBridge to the next sitting: <a question that leaves them curious, or \"none\">\n\n### Quiz\nKind: <Thought questions | Teach it back | Quick recall | Oral exam | Debate>\nKeep answers as a snapshot: <yes if the answers are opinions to remember and bring back later, not right or wrong>\nQuestions:\n- <question>\n\n(Repeat chapters as needed. A chapter can have any number of sittings.)\n\n## Optional side path: <title>\nFree: <yes or no>\n<sittings in the same format>\n\nRules for the outline:\n- One learning outcome per sitting, written as something the learner can explain.\n- Mark anything that changes quickly (numbers, rankings, dates) with \"(check often)\".\n- Don't invent quotes or numbers. If a fact needs a source I didn't give, write \"source to add\".\n";
  const LOCAL_FLAG = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && new URLSearchParams(location.search).has('courses');
  const store = {
    get(k, d) { try { const v = localStorage.getItem('wv-courses-' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('wv-courses-' + k, JSON.stringify(v)); } catch (e) {} },
    del(k) { try { localStorage.removeItem('wv-courses-' + k); } catch (e) {} },
  };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const BOOT = Date.now();

  /* ---------------- who may see it ----------------
     The real check is ownerToolsAvailable() (an admin row on the server). It
     resolves a moment after the app opens, so the bar used to appear late. If
     this same account was the owner last time on this device, show the bar
     straight away while the check runs; hide it again if the check says no. */
  const read = f => { try { return f(); } catch (e) { return undefined; } };
  const verifiedOwner = () => !!read(() => typeof ownerToolsAvailable === 'function' && ownerToolsAvailable());
  const accountId = () => String(read(() => typeof cloudAccount !== 'undefined' && cloudAccount ? cloudAccount.id : '') || '');
  const rememberedId = () => String(read(() => typeof rememberedAccountAtBoot !== 'undefined' ? rememberedAccountAtBoot : '') || '');
  const identity = () => String(read(() => typeof identityRestoreStatus !== 'undefined' ? identityRestoreStatus : '') || '');
  const ownershipResolved = () => !!read(() => typeof accountOwnershipResolved !== 'undefined' && accountOwnershipResolved);
  const entitlementKnown = () => !!read(() => typeof backendEntitlementRecord !== 'undefined' && backendEntitlementRecord);
  let ownerSeen = '';
  function allowed() {
    if (LOCAL_FLAG) return true;
    if (verifiedOwner()) { const id = accountId(); if (id) { store.set('owner', id); ownerSeen = id; } return true; }
    const cached = store.get('owner', '');
    const status = identity();
    if (cached && status === 'verified' && ownershipResolved() && entitlementKnown()) { store.del('owner'); return false; }
    const stillChecking = ['pending', 'checking', ''].includes(status) || (status === 'verified' && !(ownershipResolved() && entitlementKnown()));
    /* Returning to the app (switching windows, unlocking the phone) runs the
       account check again. Keep Courses open through it for an owner already
       confirmed since the app opened. */
    const same = !!cached && cached === (accountId() || rememberedId());
    if (same && ownerSeen === cached && (stillChecking || status === 'offline')) return true;
    return same && stillChecking && Date.now() - BOOT < 20000;
  }

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
          [doc('Statements and hearings', 'Sources to add · check often')], '',
          'What politicians and governments are saying about AI and how fast it is coming.'),
        L('How experts forecast', ['Teach the facts'],
          'Surveys of researchers, prediction markets and benchmarks: how people try to predict progress, and why forecasts keep moving.',
          [doc('Forecast surveys', 'Sources to add · check often')], '',
          'How experts forecast AI progress: surveys, prediction markets and benchmarks.'),
        L('What could slow it down', ['What if'],
          'Chips, power, money, laws, or a public backlash. Which one is most likely to slow the race?',
          [doc('Course notes', 'Scenarios')], 'So what is your forecast?',
          'What could slow down AI progress: chips, power, money, regulation and public backlash.'),
        L('Your own forecast', ['Think it through'],
          'The learner makes a forecast and defends it, using everything from the course.', [], '',
          'Make and defend your own forecast of how fast AI will change the world.'),
      ], quiz:{kind:'Debate', fact:'', qs:['Will AI do most of your future job? Defend your answer.'], snapshot:true}},
    ],
    side:{t:'Staying grounded', what:'Cristian\'s own story on video: how learning about AI shaped him, the questions he had to face, and what helped. Then a reflection. Free, optional, never graded, and labelled as his personal view.'},
  };
  const AI_DONE = 1; // in this sample the owner has finished lesson 1

  /* ---------------- Explore: a library of subjects ---------------- */
  const CATS = [
    {id:'tech', name:'Technology', icon:'◇', subs:['AI','Quantum','Computers & the internet','Energy','Space tech']},
    {id:'science', name:'Science', icon:'◎', subs:['Earth & space','Physics','Biology','Chemistry']},
    {id:'history', name:'History', icon:'▤', subs:['Ancient','Modern','Wars & empires','Ideas']},
    {id:'society', name:'Society & politics', icon:'⚖', subs:['Government','Law','Media','Philosophy']},
    {id:'money', name:'Economics & money', icon:'◔', subs:['How economies work','Personal finance','Business']},
    {id:'health', name:'Health & mind', icon:'♡', subs:['Body','Brain','Medicine']},
    {id:'arts', name:'Arts & culture', icon:'✎', subs:['Music','Film','Craft','Writing']},
    {id:'work', name:'Skills & work', icon:'⚒', subs:['Careers','Communication','Making things']},
    {id:'nature', name:'Nature & outdoors', icon:'⌂', subs:['Oceans','Animals','The outdoors']},
    {id:'food', name:'Food & drink', icon:'☕', subs:['Coffee & tea','Cooking','Wine & brewing']},
  ];
  const C = (id, title, by, cat, sub, learners, rating, added, price, chapters) => ({id, title, by, cat, sub, learners, rating, added, price, chapters});
  const CATALOG = [
    C('airace', 'The AI Race', 'Cristian P.', 'tech', 'AI', 1240, 4.8, '2026-09-30', 'First chapter free, then $12 once', AIRACE.chapters.map(c => c.lessons.map(l => l.t))),
    C('quantum', 'Quantum Computing, Gently', 'Ines M.', 'tech', 'Quantum', 860, 4.6, '2026-09-12', '$10 once', [['What a qubit is','Superposition without the hype','Entanglement'],['Why it is so hard to build','What it could break','Who is building one']]),
    C('internet', 'How the Internet Actually Works', 'Omar F.', 'tech', 'Computers & the internet', 2310, 4.7, '2026-08-20', 'Free', [['Packets','Addresses and names','Cables under the sea'],['Encryption','Who runs it']]),
    C('grid', 'The Power Grid', 'Leo B.', 'tech', 'Energy', 540, 4.5, '2026-09-27', '$6 once', [['From the plant to your plug','Why grids fail'],['Batteries','The grid AI needs']]),
    C('moon', 'How the Moon Moves the Sea', 'Maya R.', 'science', 'Earth & space', 380, 4.6, '2026-09-25', 'Free', [['Two tides a day','The Moon\'s uneven pull','The Sun joins in','Spring and neap tides']]),
    C('sky', 'Reading the Night Sky', 'Jun W.', 'science', 'Earth & space', 640, 4.5, '2026-07-30', 'Free', [['Finding north','Why stars twinkle','Planets that wander'],['Light from the past','Is anyone out there?']]),
    C('rome', 'Why Rome Fell', 'Clara D.', 'history', 'Ancient', 1530, 4.7, '2026-08-02', '$8 once', [['A republic becomes an empire','Money troubles'],['The frontier','Many falls, not one']]),
    C('bill', 'How a Bill Becomes Law', 'Grace T.', 'society', 'Government', 470, 4.3, '2026-09-18', 'Free', [['Who writes laws','Committees'],['Votes and vetoes','What lobbyists do']]),
    C('inflation', 'Inflation, Explained', 'Ben A.', 'money', 'How economies work', 980, 4.4, '2026-09-05', '$5 once', [['What inflation is','How it is measured'],['Who wins and loses','How it is fought']]),
    C('sleep', 'Sleep and the Brain', 'Dr. Hana S.', 'health', 'Brain', 1720, 4.8, '2026-09-22', '$9 once', [['Why we sleep','Dreams'],['What a bad night does','Sleeping better']]),
    C('film', 'How Movies Make You Feel', 'Rosa V.', 'arts', 'Film', 300, 4.6, '2026-09-29', 'Free', [['The cut','Music and silence'],['Faces','Endings']]),
    C('raise', 'Negotiating a Raise', 'Dana O.', 'work', 'Careers', 2050, 4.7, '2026-06-30', '$15 once, or paid by your company', [['Know your worth','The first number'],['Handling no','Getting it in writing']]),
    C('kayak', 'Arctic Skin Kayaks', 'Ana S.', 'nature', 'The outdoors', 120, 4.9, '2026-09-01', '$5 once', [['Skin on a frame','Built to fit one body','Rolling back up']]),
    C('coffee', 'Coffee, Bean to Cup', 'Theo K.', 'food', 'Coffee & tea', 910, 4.7, '2026-08-14', '$8 once', [['From cherry to bean','Washed or natural','Roasting'],['Grind and water','Espresso vs. filter','Tasting like a pro']]),
  ];
  const course = id => CATALOG.find(c => c.id === id);
  const lessonCount = c => c.chapters.reduce((n, ch) => n + ch.length, 0);

  /* ---------------- schools (samples) ---------------- */
  const SCHOOLS = [
    {id:'riverside', name:'Riverside Community College', where:'Sample school', classes:[
      {id:'econ102', code:'ECON 102', title:'Intro to Macroeconomics', teacher:'Prof. Lin', section:'Section A · Mon, Wed, Fri', chapters:[['Who counts as unemployed','Three kinds of unemployment','The phases of a cycle','What a recession is'],['What counts as spending','Why the curve slopes down','What shifts it']], due:'Next due Mon'},
      {id:'bio210', code:'BIO 210', title:'Cell Biology', teacher:'Dr. Okafor', section:'Section 2 · Tue, Thu', chapters:[['Membranes','Moving across membranes'],['Enzymes','Cellular respiration']], due:'Next due Thu'},
      {id:'hist152', code:'HIST 152', title:'US History since 1877', teacher:'Prof. Reyes', section:'Online', chapters:[['The Gilded Age','The Populists'],['The Progressive Era','World War I']], due:'Next due Wed'},
    ], student:[{id:'econ-study', title:'ECON 102 study course', by:'Made by students in Section A', lessons:12, for:'econ102'}]},
    {id:'northvalley', name:'North Valley University', where:'Sample school', classes:[
      {id:'cs101', code:'CS 101', title:'Thinking Like a Programmer', teacher:'Dr. Patel', section:'Lecture 1', chapters:[['What a program is','Loops'],['Functions','Bugs']], due:'Next due Fri'},
    ], student:[]},
    {id:'lakeshore', name:'Lakeshore State University', where:'Sample school', classes:[
      {id:'phil110', code:'PHIL 110', title:'Ethics and Technology', teacher:'Prof. Adler', section:'Seminar', chapters:[['What is a good life?','Who is responsible?'],['AI and work','Living with machines']], due:'Next due Tue'},
    ], student:[{id:'phil-ai', title:'AI ethics, the student cut', by:'Made by students in PHIL 110', lessons:6, for:'phil110'}]},
  ];
  const findClass = id => { for (const s of SCHOOLS) { const c = s.classes.find(x => x.id === id); if (c) return {school:s, cls:c}; } return null; };

  /* ---------------- state ---------------- */
  const S = {open:false, scr:'home', tab:store.get('tab', 'mine'), expanded:null, added:store.get('added', []), joined:store.get('joined', []),
    cat:null, sub:'All', sort:'popular', query:'', schoolId:null, schoolQuery:'', view:null, openCh:0, openLesson:'0:0',
    quiz:{step:0, answer:''}, make:{step:0, msgs:[], input:'', showAll:false}, sheet:null, back:'home'};
  const ICON = {
    home:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11.5 12 5l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5h-5v5H5a1 1 0 0 1-1-1z"/></svg>',
    courses:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7h18M3 12h18M3 17h18"/><circle cx="7" cy="7" r="1.9" fill="currentColor"/><circle cx="15" cy="12" r="1.9" fill="currentColor"/><circle cx="10" cy="17" r="1.9" fill="currentColor"/></svg>',
    profile:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5"/></svg>',
    search:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    chev:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>',
  };

  /* ---------------- DOM ---------------- */
  const bar = document.createElement('nav');
  bar.id = 'wv-tabbar'; bar.hidden = true; bar.setAttribute('aria-label', 'Main sections');
  bar.innerHTML = `<div class="wv-tabbar-in"><button type="button" data-tabbar="home">${ICON.home}<span>Home</span></button><button type="button" data-tabbar="courses">${ICON.courses}<span>Courses</span></button><button type="button" data-tabbar="profile">${ICON.profile}<span>Profile</span></button></div>`;
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
  const modeChips = m => m.map((x, i) => (i ? '<span class="cv-arrow" aria-hidden="true">→</span>' : '') + chip(x, /Reflect|Think|What if|Watch|Compare|Story|Case/.test(x) ? 'vi' : '')).join('');
  const fmt = n => n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '') + 'k' : String(n);
  function mini(items, done) {
    const n = items.length, x = i => `calc(5px + ${(i / Math.max(1, n - 1)) * 100}% - ${(i / Math.max(1, n - 1)) * 10}px)`;
    const k = Math.min(done, n - 1), fill = done ? `calc(${(k / Math.max(1, n - 1)) * 100}% - ${(k / Math.max(1, n - 1)) * 10}px + 5px)` : '0';
    return `<div class="cv-mini" aria-hidden="true"><span class="f" style="width:${fill}"></span>${items.map((q, i) => `<i class="${q ? 'q' : ''}${i < done ? ' d' : i === done ? ' n' : ''}" style="left:${x(i)}"></i>`).join('')}</div>`;
  }
  /* An opened course is one metro line: chapters side by side, each ending in
     its quiz, every stop titled in full. The line scrolls sideways and opens
     at the next stop; ‹ › jump a chapter at a time. */
  function route(chapters, opts) {
    let g = 0;
    const segs = chapters.map((ch, ci) => {
      const list = [...ch.titles.map((t, li) => ({t, attr:opts.attr(ci, li)})), {t:opts.quizName || 'Chapter quiz', q:true, attr:opts.quizAttr(ci)}];
      const stops = list.map(x => {
        const i = g++, st = i < opts.done ? ' done' : i === opts.done ? ' next' : '';
        return `<button type="button" class="cv-stop${x.q ? ' q' : ''}${st}" ${x.attr}><i aria-hidden="true"></i><span class="l">${esc(x.t)}</span>${i === opts.done ? '<span class="up">Up next</span>' : i < opts.done ? '<span class="up done">Done</span>' : ''}</button>`;
      }).join('');
      return `<div class="cv-rseg"><div class="cv-rseg-h"><span>${esc(ch.label || 'Chapter ' + (ci + 1))}</span>${ch.title ? `<b>${esc(ch.title)}</b>` : ''}</div><div class="cv-rstops">${stops}</div></div>`;
    }).join('');
    return `<div class="cv-route" data-start="${opts.done}">${segs}</div>`;
  }
  const aiChapters = () => AIRACE.chapters.map(c => ({title:c.t, titles:c.lessons.map(l => l.t)}));
  const aiNext = () => { let i = 0; for (const c of AIRACE.chapters) { for (const l of c.lessons) { if (i === AI_DONE) return l.t; i++; } if (i === AI_DONE) return 'the chapter quiz'; i++; } return ''; };
  const aiItems = () => { const out = []; AIRACE.chapters.forEach(c => { c.lessons.forEach(() => out.push(false)); out.push(true); }); return out; };

  /* ---------------- screens ---------------- */
  function scrHome() {
    const tabs = `<div class="cv-seg" role="tablist"><button type="button" role="tab" data-ctab="mine" class="${S.tab === 'mine' ? 'on' : ''}" aria-selected="${S.tab === 'mine'}">My courses</button><button type="button" role="tab" data-ctab="explore" class="${S.tab === 'explore' ? 'on' : ''}" aria-selected="${S.tab === 'explore'}">Explore</button></div>`;
    const head = `<div class="cv-head"><h1>Courses</h1><button type="button" class="cv-pill" data-go="make">+ Make a course</button></div><span class="cv-note"><i></i>Preview · only your account sees this</span>`;
    return head + tabs + (S.tab === 'mine' ? mine() : explore());
  }
  function courseRow(c) {
    const open = S.expanded === c.key;
    const head = `<span class="t"><b>${esc(c.title)}</b>${c.badge || ''}<span class="cv-chev${open ? ' up' : ''}">${ICON.chev}</span></span><span class="nx">${esc(c.sub)}</span>`;
    if (!open) return `<button type="button" class="cv-course" data-expand="${c.key}" aria-expanded="false">${head}${mini(c.items, c.done)}<span class="nx">${esc(c.next)}</span></button>`;
    return `<div class="cv-course open"><button type="button" class="cv-course-h" data-expand="${c.key}" aria-expanded="true">${head}</button>
      ${c.rows}
      <div class="cv-row" style="flex-wrap:wrap">${c.actions}<span class="sp"></span><span class="cv-chnav"><button type="button" data-rnav="-1" aria-label="Previous chapter">‹</button><button type="button" data-rnav="1" aria-label="Next chapter">›</button></span></div></div>`;
  }
  function mine() {
    const rows = [];
    rows.push(courseRow({key:'airace', title:'The AI Race', badge:chip('Yours', 'acc'), sub:'You made this · 3 chapters · 17 lessons', items:aiItems(), done:AI_DONE, next:'Next: ' + aiNext(),
      rows:route(aiChapters(), {done:AI_DONE, attr:(ci, li) => `data-open-lesson="${ci}:${li}"`, quizAttr:ci => `data-go="quiz" data-quizch="${ci}"`}),
      actions:'<button type="button" class="cv-pill" data-go="course">Open course</button><button type="button" class="cv-pill ghost" data-try="0:1">Continue for real</button>'}));
    S.added.filter(id => id !== 'airace' && course(id)).forEach(id => {
      const c = course(id), items = []; c.chapters.forEach(ch => { ch.forEach(() => items.push(false)); items.push(true); });
      rows.push(courseRow({key:id, title:c.title, sub:'by ' + c.by, items, done:0, next:'Next: ' + c.chapters[0][0],
        rows:route(c.chapters.map((t, i) => ({title:'', titles:t})), {done:0, attr:() => `data-viewcourse="${id}"`, quizAttr:() => `data-viewcourse="${id}"`}),
        actions:`<button type="button" class="cv-pill" data-viewcourse="${id}">Open course</button><button type="button" class="cv-pill ghost" data-remove="${id}">Remove</button>`}));
    });
    const classes = S.joined.map(findClass).filter(Boolean);
    const classRows = classes.map(({school, cls}) => {
      const items = []; cls.chapters.forEach(ch => { ch.forEach(() => items.push(false)); items.push(true); });
      return courseRow({key:'class-' + cls.id, title:`${cls.code} · ${cls.title}`, badge:chip('Class', 'ok'), sub:`${school.name} · ${cls.teacher}`, items, done:1, next:cls.due,
        rows:route(cls.chapters.map((t, i) => ({label:'Week ' + (i + 1), title:'', titles:t})), {done:1, quizName:'Friday quiz', attr:() => `data-viewclass="${cls.id}"`, quizAttr:() => `data-go="quiz"`}),
        actions:`<button type="button" class="cv-pill" data-viewclass="${cls.id}">Open class</button><button type="button" class="cv-pill ghost" data-leave="${cls.id}">Leave</button>`});
    }).join('');
    return `<div class="cv-lab">Your courses</div>${rows.join('')}
      <div class="cv-lab">Your classes</div>${classRows || ''}
      <button type="button" class="cv-find" data-go="school"><span class="cv-find-i">${ICON.search}</span><span><b>${classes.length ? 'Join another class' : 'Taking a class? Find your school'}</b><span>Join your class with the code your teacher gives you. Students may already have made courses for it.</span></span></button>
      <button type="button" class="cv-find" data-ctab="explore"><span class="cv-find-i">◇</span><span><b>Find something new</b><span>Browse courses by subject in Explore, and add the ones you want here.</span></span></button>`;
  }
  const sortFns = {popular:(a, b) => b.learners - a.learners, new:(a, b) => b.added.localeCompare(a.added), rated:(a, b) => b.rating - a.rating};
  function courseCard(c) {
    const isAdded = c.id === 'airace' || S.added.includes(c.id), cat = CATS.find(x => x.id === c.cat);
    return `<div class="cv-ex${c.id === 'airace' ? ' feature' : ''}"><button type="button" class="cv-ex-main" data-viewcourse="${c.id}"><span class="cv-crumb">${esc(cat.name)} › ${esc(c.sub)}</span><span class="t"><b>${esc(c.title)}</b></span>
        <span class="cv-muted">by ${esc(c.by)} · ${lessonCount(c)} lessons · ★ ${c.rating} · ${fmt(c.learners)} learners</span></button>
      <div class="cv-row">${chip(c.price, /^Free/.test(c.price) ? 'ok' : 'acc')}<span class="sp"></span>${c.id === 'airace' ? chip('Yours', 'acc') : `<button type="button" class="cv-pill ${isAdded ? 'soft' : 'ghost'} small" data-add="${c.id}">${isAdded ? '✓ Added' : '+ Add'}</button>`}</div></div>`;
  }
  function results(list) {
    const q = S.query.trim().toLowerCase();
    const out = list.filter(c => !q || [c.title, c.by, c.sub, CATS.find(x => x.id === c.cat).name, ...c.chapters.flat()].join(' ').toLowerCase().includes(q)).sort(sortFns[S.sort]);
    return out.length ? out.map(courseCard).join('') : `<div class="cv-empty">Nothing matches "${esc(S.query)}" yet. <button type="button" class="cv-linkbtn" data-go="make">Make that course</button></div>`;
  }
  const sortSeg = () => `<div class="cv-seg small" role="group" aria-label="Sort">${[['popular','Popular'],['new','New'],['rated','Top rated']].map(([k, l]) => `<button type="button" data-sort="${k}" class="${S.sort === k ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  const searchBox = () => `<label class="cv-search">${ICON.search}<input id="cv-q" type="search" placeholder="Search courses, subjects, makers" value="${esc(S.query)}" autocomplete="off"></label>`;
  function explore() {
    const counts = id => CATALOG.filter(c => c.cat === id).length;
    return `${searchBox()}
      <div id="cv-results-wrap"${S.query ? '' : ' hidden'}><div class="cv-row"><span class="cv-lab" style="margin:0">Results</span><span class="sp"></span>${sortSeg()}</div><div class="cv-list" id="cv-results">${S.query ? results(CATALOG) : ''}</div></div>
      <div id="cv-browse"${S.query ? ' hidden' : ''}>
        <div class="cv-lab">Browse by subject</div>
        <div class="cv-cats">${CATS.map(c => `<button type="button" class="cv-cat" data-cat="${c.id}"><span class="i" aria-hidden="true">${c.icon}</span><b>${esc(c.name)}</b><span>${esc(c.subs.slice(0, 3).join(' · '))}</span><em>${counts(c.id)} course${counts(c.id) === 1 ? '' : 's'}</em></button>`).join('')}</div>
        <div class="cv-row" style="margin-top:6px"><span class="cv-lab" style="margin:0">All courses</span><span class="sp"></span>${sortSeg()}</div>
        <div class="cv-list">${CATALOG.slice().sort(sortFns[S.sort]).map(courseCard).join('')}</div>
        <p class="cv-muted cv-center">Every course except The AI Race is a sample, to show how a full catalog would look.</p>
      </div>`;
  }
  function scrCategory() {
    const cat = CATS.find(c => c.id === S.cat) || CATS[0];
    const list = CATALOG.filter(c => c.cat === cat.id && (S.sub === 'All' || c.sub === S.sub));
    return `<div class="cv-head"><button type="button" class="cv-back" data-go="home" aria-label="Back">‹</button><h1 class="sm">${esc(cat.name)}</h1></div>
      <div class="cv-subs">${['All', ...cat.subs].map(s => `<button type="button" data-sub="${esc(s)}" class="${S.sub === s ? 'on' : ''}">${esc(s)}<em>${s === 'All' ? CATALOG.filter(c => c.cat === cat.id).length : CATALOG.filter(c => c.cat === cat.id && c.sub === s).length}</em></button>`).join('')}</div>
      <div class="cv-row"><span class="cv-muted">${list.length} course${list.length === 1 ? '' : 's'}${S.sub === 'All' ? '' : ' in ' + esc(S.sub)}</span><span class="sp"></span>${sortSeg()}</div>
      <div class="cv-list">${list.length ? list.slice().sort(sortFns[S.sort]).map(courseCard).join('') : `<div class="cv-empty">No courses in ${esc(S.sub)} yet. <button type="button" class="cv-linkbtn" data-go="make">Be the first to make one</button></div>`}</div>`;
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
              <div class="cv-row" style="flex-wrap:wrap"><button type="button" class="cv-pill" data-try="${key}">Try this lesson for real</button></div></div>` : ''}</div>`;
        }).join('') + `<div class="cv-quizcard"><span class="cv-row"><b>Chapter ${ci + 1} quiz</b><span class="sp"></span>${chip(c.quiz.kind, 'acc')}${c.quiz.snapshot ? chip('Snapshot', 'vi') : ''}</span>
          ${c.quiz.fact ? `<span class="fact">${esc(c.quiz.fact)}</span>` : ''}
          ${c.quiz.qs.map(q => `<q>${esc(q)}</q>`).join('')}
          <span class="cv-muted">${c.quiz.snapshot ? 'Answers are kept as the learner said them, never marked wrong, and brought back later. ' : ''}Opens when the chapter's lessons are done.</span>
          ${ci < 2 ? '<button type="button" class="cv-pill ghost" data-go="quiz" style="justify-self:start">Try the quiz demo</button>' : ''}</div>`;
      }
      return `<div class="cv-ch"><button type="button" class="cv-ch-h" data-ch="${ci}" aria-expanded="${open}"><span class="n">${ci + 1}</span><b>${esc(c.t)}</b><em>${open ? '▾' : '▸'}</em><span>${c.lessons.length} lessons · ${esc(c.sum)}</span></button>${body}</div>`;
    }).join('');
    return `<div class="cv-head"><button type="button" class="cv-back" data-go="${S.back}" aria-label="Back">‹</button><h1 class="sm">The AI Race</h1></div>
      <div class="cv-hero"><span class="cv-crumb">Technology › AI · by ${esc(AIRACE.by)}</span><h2>The AI Race</h2><p>${esc(AIRACE.pitch)}</p>
        <div class="cv-row" style="flex-wrap:wrap;gap:6px">${chip(AIRACE.chapters.length + ' chapters')}${chip(total + ' lessons')}${chip('About 20 min each')}${chip('Updated weekly', 'ok')}${chip('★ 4.8 · 1.2k learners')}</div>
        <div class="cv-price"><b>First chapter free. Then $12 once for the rest.</b><span>A demo price. Nothing is charged. Taught in your own tutor style.</span></div>
        <div class="cv-row" style="flex-wrap:wrap"><button type="button" class="cv-pill" data-try="0:0">Try lesson 1 for real</button><button type="button" class="cv-pill ghost" data-go="quiz">See the quiz demo</button></div></div>
      <div class="cv-lab">Chapters · tap a lesson to see what happens in it</div>${chs}
      <div class="cv-side">${chip('Free side path', 'acc')}<b>${esc(AIRACE.side.t)}</b><p class="cv-muted" style="margin:0;font-size:13.5px">${esc(AIRACE.side.what)}</p><div class="cv-row" style="flex-wrap:wrap"><button type="button" class="cv-pill ghost" data-toast="Plays Cristian's video, then a short reflection">Watch Cristian's story</button></div></div>
      <div class="cv-lab">What builds on this course</div>
      <p class="cv-muted" style="margin:0">Courses link into a network. Most can be taken in any order; a few need something first, and say so.</p>
      <div class="cv-net">
        <div class="cv-node root"><b>The AI Race</b><span>This course</span></div>
        <div class="cv-branches">
          <div class="cv-node mine"><span class="cv-need">Needs chapter 2 first</span><b>AI and consciousness</b><span>By you · your recorded talk, with your face on video</span></div>
          <div class="cv-node mine deep"><span class="cv-need">Best after AI and consciousness</span><b>The bigger questions first</b><span>By you · aliens may or may not exist, but you start from the existence of God; the rest is easier to process after the biggest question</span></div>
          <div class="cv-node"><span class="cv-need open">Any order</span><b>The AI Race, part two</b><span>Coming · picks up where this one ends</span></div>
          <div class="cv-node ghost"><span class="cv-need open">Any order</span><b>Other makers' takes</b><span>None yet. Anyone can make their own version; learners choose the best one.</span><button type="button" class="cv-pill ghost small" data-branch="1" style="justify-self:start">Make your version</button></div>
        </div>
      </div>
      <p class="cv-muted cv-center">Clips and readings marked "to add" are placeholders for your links.</p>`;
  }
  function scrSample() {
    const c = course(S.view); if (!c) return scrHome();
    const cat = CATS.find(x => x.id === c.cat), isAdded = S.added.includes(c.id);
    return `<div class="cv-head"><button type="button" class="cv-back" data-go="${S.back}" aria-label="Back">‹</button><h1 class="sm">${esc(c.title)}</h1></div>
      <div class="cv-hero"><span class="cv-crumb">${esc(cat.name)} › ${esc(c.sub)} · by ${esc(c.by)}</span><h2>${esc(c.title)}</h2>
        <div class="cv-row" style="flex-wrap:wrap;gap:6px">${chip(c.chapters.length + ' chapters')}${chip(lessonCount(c) + ' lessons')}${chip('★ ' + c.rating + ' · ' + fmt(c.learners) + ' learners')}</div>
        <div class="cv-price"><b>${esc(c.price)}</b><span>A sample course. Lesson details are filled in only for The AI Race.</span></div>
        <div class="cv-row"><button type="button" class="cv-pill${isAdded ? ' soft' : ''}" data-add="${c.id}">${isAdded ? '✓ In My courses' : '+ Add to My courses'}</button></div></div>
      ${c.chapters.map((ch, i) => `<div class="cv-card"><span class="cv-lab" style="margin:0">Chapter ${i + 1}</span>${ch.map((t, j) => `<div class="cv-sline"><span>${j + 1}</span>${esc(t)}</div>`).join('')}<div class="cv-sline q"><span>Q</span>Chapter quiz</div></div>`).join('')}`;
  }
  function scrClass() {
    const f = findClass(S.view); if (!f) return scrHome();
    const {school, cls} = f, joined = S.joined.includes(cls.id);
    const made = school.student.filter(x => x.for === cls.id);
    return `<div class="cv-head"><button type="button" class="cv-back" data-go="${S.back}" aria-label="Back">‹</button><h1 class="sm">${esc(cls.code)}</h1></div>
      <div class="cv-hero"><span class="cv-crumb">${esc(school.name)} · ${esc(cls.section)}</span><h2>${esc(cls.title)}</h2>
        <div class="cv-row" style="flex-wrap:wrap;gap:6px">${chip(cls.teacher)}${chip(cls.due, 'acc')}${chip('Quiz on Fridays')}</div>
        ${joined ? '' : `<button type="button" class="cv-pill" data-sheet="join:${cls.id}" style="justify-self:start">Join this class</button>`}</div>
      ${cls.chapters.map((ch, i) => `<div class="cv-card"><span class="cv-lab" style="margin:0">Week ${i + 1}</span>${ch.map((t, j) => `<div class="cv-sline"><span>${j + 1}</span>${esc(t)}</div>`).join('')}<div class="cv-sline q"><span>Q</span>Friday quiz · set by ${esc(cls.teacher)}</div></div>`).join('')}
      ${made.length ? `<div class="cv-lab">Made by students in this class</div>${made.map(m => `<div class="cv-card"><b class="cv-serif" style="font-size:17px">${esc(m.title)}</b><span class="cv-muted">${esc(m.by)} · ${m.lessons} lessons · free</span><button type="button" class="cv-pill ghost small" data-toast="Sample: a study course students built for this class" style="justify-self:start">Preview</button></div>`).join('')}` : ''}
      <p class="cv-muted cv-center">A sample class. In the real version, your teacher's chapters, dates and quiz rules come from the school.</p>`;
  }
  function scrSchool() {
    const q = S.schoolQuery.trim().toLowerCase();
    if (!S.schoolId) {
      const list = SCHOOLS.filter(s => !q || s.name.toLowerCase().includes(q));
      return `<div class="cv-head"><button type="button" class="cv-back" data-go="home" aria-label="Back">‹</button><h1 class="sm">Find your school</h1></div>
        <label class="cv-search">${ICON.search}<input id="cv-school-q" type="search" placeholder="School, college or company" value="${esc(S.schoolQuery)}" autocomplete="off"></label>
        <div class="cv-list" id="cv-school-list">${schoolList(list)}</div>
        <div class="cv-card"><h3>Have a class code?</h3><p class="cv-muted">Your teacher can give you a code that joins the class directly.</p><button type="button" class="cv-pill ghost small" data-sheet="join:econ102" style="justify-self:start">Enter a code</button></div>
        <p class="cv-muted cv-center">These schools are samples. Companies join the same way, for training courses.</p>`;
    }
    const s = SCHOOLS.find(x => x.id === S.schoolId);
    return `<div class="cv-head"><button type="button" class="cv-back" data-schoolback="1" aria-label="Back">‹</button><h1 class="sm">${esc(s.name)}</h1></div>
      <div class="cv-lab">Classes on Worldview</div>
      ${s.classes.map(c => `<div class="cv-ex"><button type="button" class="cv-ex-main" data-viewclass="${c.id}"><span class="cv-crumb">${esc(c.code)} · ${esc(c.section)}</span><span class="t"><b>${esc(c.title)}</b></span><span class="cv-muted">${esc(c.teacher)} · ${c.chapters.reduce((n, ch) => n + ch.length, 0)} lessons so far · quiz on Fridays</span></button>
        <div class="cv-row"><span class="sp"></span>${S.joined.includes(c.id) ? chip('✓ Joined', 'ok') : `<button type="button" class="cv-pill small" data-sheet="join:${c.id}">Join</button>`}</div></div>`).join('')}
      ${s.student.length ? `<div class="cv-lab">Made by students here</div>${s.student.map(m => `<div class="cv-card"><b class="cv-serif" style="font-size:17px">${esc(m.title)}</b><span class="cv-muted">${esc(m.by)} · ${m.lessons} lessons · free</span></div>`).join('')}` : ''}`;
  }
  const schoolList = list => list.length ? list.map(s => `<button type="button" class="cv-find" data-school="${s.id}"><span class="cv-find-i">▤</span><span><b>${esc(s.name)}</b><span>${s.classes.length} class${s.classes.length === 1 ? '' : 'es'} on Worldview · ${esc(s.where)}</span></span></button>`).join('')
    : '<div class="cv-empty">No school by that name yet. Ask your teacher to set up the class.</div>';
  function scrQuiz() {
    const q = S.quiz, ans = q.answer.trim() || 'I think they just want to build better AI than the others.';
    const steps = `<div class="cv-steps" aria-hidden="true">${[0,1,2,3].map(i => `<i class="${i <= q.step ? 'on' : ''}"></i>`).join('')}</div>`;
    const head = `<div class="cv-head"><button type="button" class="cv-back" data-go="course" aria-label="Back">‹</button><h1 class="sm">The AI Race · quiz demo</h1></div>${steps}`;
    if (q.step === 0) return head + `<div class="cv-stage"><span class="cv-lab cv-center">Chapter 1 quiz · thought questions</span>
      <div class="cv-fact"><b>Quick fact</b>Some of the money flowing into AI is among the largest private funding ever raised.</div>
      <p class="cv-tut">Why do you think so much money is going in? Does it seem like something you should know about?</p>
      <textarea class="cv-answer" id="cv-answer" placeholder="Say it out loud in the real version. Here, type it.">${esc(q.answer)}</textarea>
      <div class="cv-row" style="flex-wrap:wrap"><button type="button" class="cv-pill" data-qstep="1">Save my answer</button><button type="button" class="cv-pill ghost" data-qexample="1">Use an example answer</button></div></div>`;
    if (q.step === 1) return head + `<div class="cv-stage"><div class="cv-snap"><b>Snapshot saved</b><q>${esc(ans)}</q><span class="cv-muted">Kept exactly as you said it. Not marked right or wrong. It comes back later in the course.</span></div>
      <button type="button" class="cv-pill wide" data-qstep="2">Skip ahead two weeks</button></div>`;
    if (q.step === 2) return head + `<div class="cv-stage"><span class="cv-lab cv-center">Two weeks later · Chapter 2 quiz</span>
      <div class="cv-snap"><b>Your answer from chapter 1</b><q>${esc(ans)}</q></div>
      <p class="cv-tut">After this chapter on AGI, would you say it differently?</p>
      <div class="cv-check"><p style="margin:0">The next questions are about jobs and meaning, and they can feel heavy. You choose.</p><div class="cv-row" style="flex-wrap:wrap;gap:8px"><button type="button" class="cv-pill" data-qstep="3">Keep going</button><button type="button" class="cv-pill ghost" data-qpause="1">Pause</button></div></div>
      <button type="button" class="cv-link" data-sheet="support">Need support right now?</button></div>`;
    return head + `<div class="cv-stage"><span class="cv-lab cv-center">Chapter 2 quiz · question 2</span>
      <p class="cv-tut">Picture a computer that can do anything you ask. What is the first problem in the world you would hand it?</p>
      <p class="cv-muted cv-center">This is your "imagine" exercise from lesson 3, used as a quiz question. Your answer becomes the next snapshot.</p>
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
    if (S.sheet === 'support') {
      h = `<h3>Need support right now?</h3><p>If you are struggling or thinking about hurting yourself, you can call or text <b>988</b>, the Suicide &amp; Crisis Lifeline (US), any time. It is free and confidential.</p><p class="cv-muted">You can also pause this course. It will be here when you are ready.</p><button type="button" class="cv-pill wide" data-close="1">Close</button>`;
    } else if (S.sheet.startsWith('try:')) {
      const [ci, li] = S.sheet.slice(4).split(':').map(Number), l = AIRACE.chapters[ci].lessons[li];
      h = `${chip('Real lesson', 'acc')}<h3>${esc(l.t)}</h3><p>This starts an ordinary Worldview voice lesson on this lesson's topic, so you can feel what it would be like. The course parts (snapshots, the chapter quiz, your clips) aren't built yet.</p><p class="cv-muted" style="font-size:12.5px">Topic: ${esc(l.topic)}</p><button type="button" class="cv-pill wide" data-start="${ci}:${li}">Start the voice lesson</button><button type="button" class="cv-pill ghost wide" data-close="1">Not now</button>`;
    } else if (S.sheet.startsWith('join:')) {
      const f = findClass(S.sheet.slice(5));
      h = `<h3>Join ${f ? esc(f.cls.code + ' · ' + f.cls.title) : 'a class'}</h3><p class="cv-muted">Type the class code from your teacher. Any code works in this demo.</p>
        <input class="cv-codein" id="cv-code" placeholder="e.g. LIN-ECON-A" autocomplete="off" autocapitalize="characters"><button type="button" class="cv-pill wide" data-join="${f ? f.cls.id : 'econ102'}">Join the class</button><button type="button" class="cv-pill ghost wide" data-close="1">Cancel</button>`;
    }
    return `<div class="cv-ov" data-close="1"><div class="cv-sheet" role="dialog" aria-modal="true"><span class="grab"></span><button type="button" class="cv-x" data-close="1" aria-label="Close">✕</button>${h}</div></div>`;
  }
  function render() {
    const html = {course:scrCourse, quiz:scrQuiz, make:scrMake, cat:scrCategory, sample:scrSample, cls:scrClass, school:scrSchool}[S.scr]?.() ?? scrHome();
    view.innerHTML = `<div class="cv-wrap">${html}</div>${sheetHTML()}`;
    document.body.classList.toggle('cv-sheet-open', !!S.sheet);
    view.querySelectorAll('.cv-route[data-start]').forEach(el => { const stop = el.querySelectorAll('.cv-stop')[+el.dataset.start]; if (stop) el.scrollLeft = Math.max(0, stop.offsetLeft - stop.offsetWidth - 16); });
    syncBar();
  }
  function go(scr) { S.scr = scr; S.sheet = null; render(); view.scrollTop = 0; }

  /* ---------------- open / close and the bar ---------------- */
  function openCourses() { S.open = true; view.hidden = false; document.body.classList.add('cv-open'); render(); }
  function closeCourses() { document.body.classList.remove('cv-sheet-open'); S.open = false; S.sheet = null; view.hidden = true; document.body.classList.remove('cv-open'); syncBar(); }
  let forcedTab = '', forcedAt = 0;
  function syncBar() {
    let active = 'home';
    if (S.open) active = 'courses';
    else if (forcedTab && Date.now() - forcedAt < 800) active = forcedTab;
    else if (deckIsProfile()) active = 'profile';
    bar.querySelectorAll('button').forEach(b => { const on = b.dataset.tabbar === active; b.classList.toggle('on', on); if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  }
  /* Which Home page is on screen, read from where the pages actually sit. */
  function deckIsProfile() { const p = document.getElementById('profile-page'); if (!p) return false; const r = p.getBoundingClientRect(); return r.height > 0 && r.bottom > innerHeight * 0.5 && r.top < innerHeight * 0.5; }
  /* Jump straight to a Home page with no visible scroll. */
  function jumpDeck(target) {
    read(() => { if (typeof show === 'function') show('home'); });
    if (target === 'profile') read(() => { if (typeof renderProfile === 'function') renderProfile(true); });
    const el = document.getElementById(target === 'profile' ? 'profile-page' : 'carousel-page');
    if (el) { try { el.scrollIntoView({block:'start', behavior:'instant'}); } catch (e) { el.scrollIntoView(true); } }
    forcedTab = target; forcedAt = Date.now();
  }
  bar.addEventListener('click', e => {
    const b = e.target.closest('[data-tabbar]'); if (!b) return;
    const t = b.dataset.tabbar;
    if (t === 'courses') { if (S.open) { S.tab = 'mine'; S.expanded = null; go('home'); } else openCourses(); return; }
    jumpDeck(t);
    if (S.open) requestAnimationFrame(() => requestAnimationFrame(closeCourses)); else syncBar();
  });

  /* ---------------- events ---------------- */
  view.addEventListener('click', e => {
    const t = e.target.closest('[data-go],[data-ctab],[data-expand],[data-open-lesson],[data-ch],[data-lesson],[data-try],[data-start],[data-sheet],[data-close],[data-toast],[data-qstep],[data-qexample],[data-qpause],[data-msend],[data-mex],[data-mreset],[data-mall],[data-copyprompt],[data-cat],[data-sub],[data-sort],[data-add],[data-remove],[data-viewcourse],[data-viewclass],[data-school],[data-schoolback],[data-join],[data-leave],[data-branch],[data-rnav]');
    if (!t) return;
    if (t.dataset.close && t.classList.contains('cv-ov') && e.target !== t) return;
    const d = t.dataset;
    if (d.rnav) {
      const r = t.closest('.cv-course')?.querySelector('.cv-route'); if (!r) return;
      const x = r.scrollLeft, starts = [...r.querySelectorAll('.cv-rseg')].map(el => Math.max(0, el.offsetLeft - 16));
      const to = +d.rnav > 0 ? starts.find(v => v > x + 4) : starts.filter(v => v < x - 4).pop();
      r.scrollTo({left: to ?? (+d.rnav > 0 ? r.scrollWidth : 0), behavior:'smooth'});
      return;
    }
    if (d.go) { if (d.go === 'quiz') S.quiz.step = 0; if (d.go === 'course') S.back = S.scr === 'quiz' || S.scr === 'make' ? 'home' : S.scr; if (d.go === 'school' && S.scr === 'home') S.schoolId = null; return go(d.go); }
    if (d.ctab) { S.tab = d.ctab; store.set('tab', S.tab); S.scr = 'home'; S.sheet = null; render(); view.scrollTop = 0; return; }
    if (d.expand) { S.expanded = S.expanded === d.expand ? null : d.expand; return render(); }
    if (d.openLesson) { const [ci, li] = d.openLesson.split(':').map(Number); S.openCh = ci; S.openLesson = ci + ':' + li; S.back = 'home'; go('course'); setTimeout(() => view.querySelector('.cv-ls-h[aria-expanded="true"]')?.scrollIntoView({block:'center'}), 30); return; }
    if (d.ch !== undefined) { const c = +d.ch; S.openCh = S.openCh === c ? -1 : c; S.openLesson = c + ':0'; return render(); }
    if (d.lesson) { S.openLesson = S.openLesson === d.lesson ? '' : d.lesson; return render(); }
    if (d.try) { S.sheet = 'try:' + d.try; return render(); }
    if (d.start) { const [ci, li] = d.start.split(':').map(Number); return startReal(AIRACE.chapters[ci].lessons[li].topic); }
    if (d.sheet) { S.sheet = d.sheet; render(); if (d.sheet.startsWith('join:')) view.querySelector('#cv-code')?.focus(); return; }
    if (d.close) { S.sheet = null; return render(); }
    if (d.toast) { toast(d.toast); return; }
    if (d.cat) { S.cat = d.cat; S.sub = 'All'; return go('cat'); }
    if (d.sub) { S.sub = d.sub; return render(); }
    if (d.sort) { S.sort = d.sort; return render(); }
    if (d.add) { const id = d.add; if (S.added.includes(id)) { S.added = S.added.filter(x => x !== id); toast('Removed from My courses'); } else { S.added = [...S.added, id]; toast('Added to My courses'); } store.set('added', S.added); return render(); }
    if (d.remove) { S.added = S.added.filter(x => x !== d.remove); store.set('added', S.added); S.expanded = null; toast('Removed from My courses'); return render(); }
    if (d.viewcourse) { if (d.viewcourse === 'airace') { S.back = S.scr === 'home' ? 'home' : S.scr; return go('course'); } S.back = S.scr; S.view = d.viewcourse; return go('sample'); }
    if (d.viewclass) { S.back = S.scr; S.view = d.viewclass; return go('cls'); }
    if (d.school) { S.schoolId = d.school; return go('school'); }
    if (d.schoolback) { S.schoolId = null; return go('school'); }
    if (d.join) { if (!S.joined.includes(d.join)) S.joined = [...S.joined, d.join]; store.set('joined', S.joined); S.sheet = null; S.tab = 'mine'; store.set('tab', 'mine'); S.expanded = 'class-' + d.join; go('home'); toast('Joined. Your class is in My courses.'); return; }
    if (d.leave) { S.joined = S.joined.filter(x => x !== d.leave); store.set('joined', S.joined); S.expanded = null; toast('You left the class'); return render(); }
    if (d.branch) { S.make = {step:0, msgs:[], input:'', showAll:false}; go('make'); toast('In the real version, this starts from The AI Race\'s outline.'); return; }
    if (d.qexample) { S.quiz.answer = 'I think they just want to build better AI than the others.'; return render(); }
    if (d.qstep) { if (d.qstep === '1') { const v = view.querySelector('#cv-answer')?.value || ''; S.quiz.answer = v.trim() ? v : S.quiz.answer; } S.quiz.step = +d.qstep; render(); view.scrollTop = 0; return; }
    if (d.qpause) { toast('Paused. It will be here when you are ready.'); return; }
    if (d.mex) { const box = view.querySelector('#cv-make-in'); if (box) box.value = SCRIPT[S.make.step].ex; S.make.input = SCRIPT[S.make.step].ex; return; }
    if (d.msend) { const v = (view.querySelector('#cv-make-in')?.value || '').trim(); const m = S.make; m.msgs[m.step] = v || SCRIPT[m.step].ex; m.step++; m.input = ''; render(); view.scrollTop = 0; return; }
    if (d.mall) { S.make.showAll = !S.make.showAll; return render(); }
    if (d.mreset) { S.make = {step:0, msgs:[], input:'', showAll:false}; return render(); }
    if (d.copyprompt) { try { navigator.clipboard.writeText(PROMPT).then(() => toast('Prompt copied. Paste it into ChatGPT.'), () => toast('Copy did not work on this device.')); } catch (err) { toast('Copy did not work on this device.'); } }
  });
  view.addEventListener('input', e => {
    const id = e.target.id;
    if (id === 'cv-answer') S.quiz.answer = e.target.value;
    if (id === 'cv-make-in') S.make.input = e.target.value;
    if (id === 'cv-q') {
      S.query = e.target.value;
      const wrap = view.querySelector('#cv-results-wrap'), browse = view.querySelector('#cv-browse'), out = view.querySelector('#cv-results');
      if (wrap && browse && out) { const on = !!S.query.trim(); wrap.hidden = !on; browse.hidden = on; out.innerHTML = on ? results(CATALOG) : ''; }
    }
    if (id === 'cv-school-q') { S.schoolQuery = e.target.value; const q = S.schoolQuery.trim().toLowerCase(); const out = view.querySelector('#cv-school-list'); if (out) out.innerHTML = schoolList(SCHOOLS.filter(s => !q || s.name.toLowerCase().includes(q))); }
  });
  view.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'cv-code') view.querySelector('[data-join]')?.click(); });
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
    if (document.querySelector('#lesson-path-panel.open, #intro-demo.open, dialog[open]')) return true;
    return false;
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
  setInterval(tick, 500);
  document.addEventListener('scroll', () => { if (!S.open) syncBar(); }, {capture:true, passive:true});
})();
