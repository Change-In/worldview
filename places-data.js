/* Sample classes, teachers and demo lessons for Places (NAV-203). Everything here is made up.
   A lesson is "Title | what you do in it | minutes". A teacher's demo names an entry in `demos`.
   Dates are for the week of Nov 2, 2026; places.js moves them by whole weeks so today stays in week 11. */
window.WorldviewPlacesData = (() => {
  const ABOUT = {
    'Maya R. ’28': 'Math major. Tutors at the help center.',
    'Jordan K. ’27': 'Failed the first exam, then learned to explain it out loud.',
    'Priya S. ’28': 'Course grader. Has seen every wrong answer.',
    'Sofia L. ’27': 'Has run weekly study groups for two years.',
    'Liam T. ’27': 'Has solved every old exam since 2019.',
    'Tomás V. ’27': 'Computer engineering major. Builds things to understand them.',
    'Daniel O. ’28': 'Went from a C on the first exam to the top of the class by making it a game.',
    'Hana P. ’28': 'Architecture minor. Never without a sketchbook.',
    'Grace H. ’27': 'Spent last summer at the desk of the uncle in these lessons.',
    'Marcus T. ’27': 'Runs the investment club.',
    'Rina K. ’28': 'Ran the campus coffee cart for two years.',
    'Dev S. ’29': 'Debate team captain.',
    'Nadia F. ’28': 'Accounting major.',
  };
  const lesson = l => { const [t, what, min] = l.split('|').map(x => x.trim()); return {t, what: what || '', min: +min || 0}; };
  /* T(name, 'term taken|grade', how they teach, [rating, students, price, days since published], lesson weekdays, demo, sample review, lessons) */
  const T = (w, took, how, s, days, demo, quote, lessons) => ({id: w.split(' ')[0].toLowerCase(), w, about: ABOUT[w] || '', took, how, r: s[0], n: s[1], p: s[2], age: s[3], days, demo, quote, lessons: lessons.map(lesson)});

  const classes = [
    {code: 'MA 132', name: 'Calculus II', cat: 'science', hw: [5, 1], units: [
      ['Integration techniques', '2026-09-25', 'Exam 1', [
        T('Hana P. ’28', 'Spring 2026|A', 'Show your paper. It finds the line that went wrong.', [4.8, 260, 2, 120], [2, 4], '', '', ['Show me your u and dv', 'Integration by parts, twice in a row', 'Trig integrals on paper', 'The substitution you didn’t see', 'Partial fractions, one piece at a time', 'When an improper integral has an answer']),
        T('Daniel O. ’28', 'Fall 2025|A−', 'A puzzle game. Every level takes a hint away.', [4.6, 180, 1, 150], [1, 4], '', '', ['Level 1: undo the chain rule', 'Level 2: parts', 'Level 3: trig pieces', 'Level 4: break it into fractions', 'Boss level: pick the method yourself']),
        T('Jordan K. ’27', 'Spring 2025|A−', 'Say your whole plan out loud before you write.', [4.5, 205, 2, 210], [2, 5], '', '', ['Which method, and why?', 'Talk through integration by parts', 'Talk through trig substitution', 'Why can an infinite region have finite area?']),
        T('Liam T. ’27', 'Fall 2024|A', 'Old exams, harder every day, hints before answers.', [4.3, 150, 1, 300], [1, 3], '', '', ['By parts: old exam set', 'Trig integrals: old exam set', 'Partial fractions: old exam set', 'Timed practice for Exam 1']),
      ]],
      ['Applications of integrals', '2026-10-23', 'Exam 2', [
        T('Maya R. ’28', 'Fall 2025|A', 'Spin any curve in 3D and slice it, before formulas.', [4.9, 245, 2, 70], [1, 4], '', '', ['Area between two curves, by dragging', 'Spin a curve into a vase', 'Washers or shells? Watch both', 'Stretch a string along a curve', 'Work: lifting a leaky bucket']),
        T('Tomás V. ’27', 'Spring 2025|A', 'Measure real things, integrate, check with a cup.', [4.8, 230, 2, 80], [2, 4], '', '', ['How much does your water bottle hold?', 'Slice it into discs', 'Shells: roll up a sheet of paper', 'The length of a phone cable, by integral', 'How much work to empty a bathtub?']),
        T('Priya S. ’28', 'Fall 2025|A', 'Real wrong answers. You find what went wrong.', [4.7, 140, 1, 45], [3], '', '', ['The volume with the wrong radius', 'The area counted twice', 'The arc length missing a square root', 'The bucket that lost the wrong amount']),
        T('Sofia L. ’27', 'Fall 2024|A', 'Bring a real object. The group models it together.', [4.6, 88, 1, 60], [4], '', '', ['Bring something with a curve', 'Model a wine glass', 'Whose volume is closest?', 'Group review before Exam 2']),
      ]],
      ['Sequences and series', '2026-11-20', 'Exam 3', [
        T('Maya R. ’28', 'Fall 2025|A', 'Move a slider and watch it, before any formula.', [4.9, 212, 2, 40], [1, 4], 'sliders', 'I finally saw why 1/n² stops and 1/n doesn’t.', [
          'Watch a sequence settle | Drag n and watch 1/n close in on zero. Find where it stays within 0.01. | 12',
          'Drag the ratio of a geometric series | Slide r and watch the total stop growing, or take off the moment r reaches 1. | 15',
          'When adding forever explodes | Run 1/n and 1/n² side by side for a million terms. One stalls. One keeps creeping up. | 14',
          'The integral test, seen as area | Stack the terms as bars under a curve and compare the areas. | 16',
          'Race two series side by side | Put a mystery series under one you trust. If the bigger one stops, the smaller one has to. | 14',
          'Alternating series on a number line | Watch each term jump left, then right, by less each time, and see where it lands. | 12',
          'Build a power series, term by term | Add terms one at a time and watch the range where the curve matches grow. | 16',
          'Fit a curve with Taylor polynomials | Move the center and add terms until your polynomial hugs sin x. | 18',
        ]),
        T('Priya S. ’28', 'Fall 2025|A', 'Real wrong answers. You find what went wrong.', [4.8, 156, 1, 12], [3], 'mistake', 'Finding someone else’s mistake showed me the ones I was making.', [
          'The limit that isn’t | Four solutions say a sequence converges. One is wrong. Find it and say why. | 10',
          'Whose geometric sum is wrong? | Three people got three totals for the same series. Work out who slipped, and where. | 10',
          'The test that doesn’t apply | Someone uses the ratio test where it gives no answer, then concludes anyway. Catch it. | 12',
          'The Taylor series with a bad center | A series looks right but gets used far from its center. Find where it falls apart. | 12',
        ]),
        T('Jordan K. ’27', 'Spring 2025|A−', 'No screen. A tutor asks, and you explain out loud.', [4.7, 340, 2, 90], [2, 5], 'voice', 'I did this on my walk to class. Saying it out loud is what made it stick.', [
          'What does it mean to converge? | You define it in your own words. The tutor pokes at it until your definition holds. | 15',
          'Explain geometric series out loud | Say why 1/2 + 1/4 + 1/8 ends up at 1. You move on once you can say why. | 12',
          'Why the harmonic series diverges | The tutor walks you to the grouping trick with questions, and never tells you the answer. | 15',
          'Defend your choice of test | You get a series and pick a convergence test. Then you defend that pick against pushback. | 14',
          'Ratio test or root test? Argue it | Two series, two tests. You argue which is faster for each, and why. | 12',
          'Find the interval of convergence, aloud | Talk through one power series, including what happens at both endpoints. | 16',
          'Where does a Taylor series come from? | Starting from one point and its derivatives, you reason your way to the formula. | 18',
        ]),
        T('Tomás V. ’27', 'Spring 2025|A', 'How does your calculator know sin 37°? Rebuild it.', [4.7, 118, 2, 25], [2, 4], 'calc', 'First time series felt useful for anything.', [
          'A chip that only adds and multiplies | Try to get sin 37° using only + and ×. It looks impossible. That’s the problem for the unit. | 12',
          'Sums that settle | Add smaller and smaller pieces and count how many you need for four correct digits. | 12',
          'How many terms is enough? | You make a rule for when to stop, because more terms can’t change the digits you care about. | 15',
          'A formula with a dial | Treat x as a dial. See where a power series still works and where it falls apart. | 15',
          'Write sin x as a series | Build it from the derivatives of sine at zero, then check it against your calculator. | 18',
          'Ship your own sin button | Code it, or have your AI code it, from your series. It has to match to six digits. | 20',
        ]),
        T('Sofia L. ’27', 'Fall 2024|A', 'A study group. Record a minute, answer a classmate.', [4.6, 64, 1, 5], [4], 'group', 'Hearing how other people explain it is the whole point.', [
          'Convergence, in your own words | Record one minute on what converging means. Then reply to the classmate you disagree with most. | 10',
          'Which test would you pick, and why? | Everyone picks a test for the same series and records why. Then you vote on the best argument. | 12',
          'Group problem: the tricky series | Your group of four solves one hard series, each recording one step for the next person. | 20',
          'Group review before Exam 3 | Each person teaches one topic in two minutes. You leave with a recording of every topic. | 25',
        ]),
        T('Daniel O. ’28', 'Fall 2025|A−', 'A betting game. Stake points, then prove your call.', [4.5, 73, 1, 7], [1, 5], 'bet', 'I’d never have practiced this much if it wasn’t a game.', [
          'Place your first bets | Ten series, one minute each. Stake points on converge or diverge before you compute anything. | 10',
          'Bet against a classmate | You both see the same series. Whoever proves their call first takes the points. | 15',
          'The traps | Series that look like they converge and don’t, and the reverse. Most people lose points here. | 12',
          'Prove it or lose it | Now a bet only pays if you record the reason. A right answer with no proof pays nothing. | 15',
          'Final table before Exam 3 | The whole class plays one round. The top of the table picks next week’s traps. | 20',
        ]),
        T('Liam T. ’27', 'Fall 2024|A', 'Old exams, harder every day, hints before answers.', [4.4, 98, 1, 200], [1, 3], 'drill', 'Exam 3 felt like a repeat of the drills.', [
          'Limits of sequences | Ten old exam limits, easiest first. A wrong answer gets a hint, never the solution. | 15',
          'Geometric and telescoping sums | Spot which kind it is before you compute. Speed counts today. | 15',
          'The integral test | Six old exam series where the integral test is the way in, and one where it isn’t. | 15',
          'Comparison tests | Choose what to compare against. This is where most points go missing. | 15',
          'The ratio test | Factorials and powers, the problems this test was made for. | 15',
          'Power series | Old exam intervals of convergence. Both endpoints, every time. | 15',
          'Taylor series | Write the series for four functions from memory, then use them. | 15',
          'Timed practice for Exam 3 | A full old exam in 50 minutes. Then you see where your points went. | 50',
        ]),
      ]],
      ['Parametric and polar', '2026-12-09', 'Final', [
        T('Hana P. ’28', 'Spring 2026|A', 'Draw with equations: a spirograph, your initials.', [4.7, 24, 2, 10], [2, 4], '', '', ['Program a spirograph', 'Speed along a curve', 'Draw a flower in polar', 'The area of one petal']),
        T('Tomás V. ’27', 'Spring 2025|A', 'Trace real motion: a ball, a bike wheel, a coaster.', [4.6, 31, 2, 12], [1, 4], '', '', ['Track a ball you throw, on video', 'The path of a bike valve', 'Design a roller coaster', 'How long is your coaster?']),
        T('Liam T. ’27', 'Fall 2024|A', 'Old exams, harder every day, hints before answers.', [4.4, 18, 1, 30], [1, 3], '', '', ['Parametric derivatives: old exam set', 'Polar area: old exam set', 'Conics: old exam set', 'Timed practice for the final']),
      ]],
    ]},
    {code: 'FI 301', name: 'Financial Management', cat: 'money', hw: [3, 1], units: [
      ['Time value of money', '2026-10-01', 'Exam 1', [
        T('Rina K. ’28', 'Fall 2025|A', 'Put in your real student loan. See what it costs.', [4.8, 240, 2, 110], [1, 4], '', '', ['What $1,000 is worth in ten years', 'Your loan, month by month', 'What an extra $50 a month saves', 'Rent or buy? Run it', 'Saving at 22 or at 32']),
        T('Marcus T. ’27', 'Spring 2025|A', 'Real offers with traps: car loans, credit cards.', [4.7, 180, 1, 130], [2, 5], '', '', ['The 0% car deal', 'The credit card minimum', 'Buy now, pay later', 'The payday loan', 'Which offer would you sign?']),
        T('Nadia F. ’28', 'Fall 2025|A', 'Old exam problems, with a hint before every answer.', [4.4, 130, 1, 200], [1, 3], '', '', ['Present value: old exam set', 'Annuities: old exam set', 'Loan schedules: old exam set', 'Timed practice for Exam 1']),
      ]],
      ['Reading a company', '2026-11-12', 'Exam 2', [
        T('Grace H. ’27', 'Fall 2025|A', 'My uncle reads statements for a living. Then you try.', [4.9, 124, 2, 25], [1, 3], 'statement', 'It’s like sitting next to him at his desk.', [
          'How my uncle opens an annual report | He skips the glossy pages and goes straight to one. You find out which, and why. | 10',
          'Revenue: what’s really in it? | He pulls apart one revenue line. You guess what’s inside before he shows you. | 12',
          'Why profit isn’t cash | A company reports record profit and runs out of money. He shows how that happens. | 12',
          'Reading the cash flow statement | He reads one out loud, line by line. You follow along on a different company. | 15',
          'Debt: can they pay it? | He checks when each loan comes due against the cash on hand. You do the next one. | 12',
          'The footnotes people skip | Three surprises he found in footnotes. You hunt for the fourth. | 15',
          'The few ratios he actually uses | Out of dozens, he uses four. He explains why, and you run them yourself. | 12',
          'Compare two retailers | Same industry, opposite health. You say which you’d lend to before he does. | 18',
          'Your turn: read one alone | You read a company on your own and record your take. He replies to the best ones. | 25',
        ]),
        T('Rina K. ’28', 'Fall 2025|A', 'Run a simulated shop. Your statements update live.', [4.8, 88, 2, 11], [1, 4], 'cashsim', 'I made a profit and went broke in the same month. Now I get it.', [
          'Open your shop | Buy stock, set a price, sell for a week. Watch your income statement fill in. | 15',
          'Sell on credit | Let customers pay later. Profit stays up and your cash disappears. Why? | 12',
          'Take out a loan | Borrow to grow. See it on the balance sheet, then watch the interest hit your profit. | 15',
          'Buy an oven | A big purchase barely touches this month’s profit, then shows up for years. | 15',
          'Read a classmate’s shop | You only get their statements. Work out what they did and whether they’ll survive. | 15',
          'Survive a bad month | Sales halve. You choose what to cut, and your statements show if it worked. | 20',
        ]),
        T('Marcus T. ’27', 'Spring 2025|A', 'Catch what the CEO avoids saying on earnings calls.', [4.7, 96, 2, 18], [2, 4], 'earnings', 'I can’t listen to a CEO the same way now.', [
          'Your first earnings call | Ten minutes of a call. Write down every question that didn’t get answered. | 15',
          'What “adjusted” hides | Compare the adjusted number to the reported one and find what they took out. | 12',
          'Match the call to the statements | What they said about cash, next to what the statement says. Do they match? | 15',
          'The analyst who pushes back | One analyst asks twice. Work out what the question was really about. | 12',
          'Predict the next quarter | From the call alone, predict one number. Next lesson you check it. | 15',
          'Run your own call | You play the CEO. An AI analyst asks the hard questions about your numbers. | 20',
        ]),
        T('Dev S. ’29', 'Spring 2026|A−', 'A group picks a company and argues about it.', [4.5, 52, 1, 15], [2], 'debate', 'Somebody always catches what you missed.', [
          'Pick your company | Your group votes on one company everyone has used. Everyone records why. | 10',
          'Argue: is the revenue real? | Half the group argues yes, half no, one minute each. Then you switch sides. | 15',
          'Argue: too much debt? | Each person finds one number and records what it means. Reply to the weakest case. | 15',
          'Argue: where is the cash going? | Follow the cash flow statement and record where you think the money really goes. | 15',
          'Group verdict: would you buy it? | A final vote with your reasons on record. You check it again at the end of term. | 20',
        ]),
        T('Nadia F. ’28', 'Fall 2025|A', 'Old exam problems, with a hint before every answer.', [4.4, 87, 1, 150], [1, 4], 'drillfin', 'Exactly what Exam 2 looked like.', [
          'Building an income statement | Turn a messy list of numbers into a clean statement. | 15',
          'Indirect cash flow | Start from net income and adjust. This is where most exam points go. | 15',
          'Common-size statements | Turn every line into a percentage and spot what changed. | 12',
          'Liquidity ratios | Current and quick ratios, and the trap each one hides. | 12',
          'Leverage ratios | Debt to equity and interest coverage, on three made-up companies. | 12',
          'Return on equity | Split it into its three parts and see which one is doing the work. | 15',
          'Timed practice for Exam 2 | A full old exam, timed. Then you see where your points went. | 50',
        ]),
      ]],
      ['Valuation', '2026-12-10', 'Final', [
        T('Grace H. ’27', 'Fall 2025|A', 'Why my uncle passed on a stock everyone loved.', [4.9, 21, 2, 8], [1, 3], '', '', ['The stock everyone loved', 'What he thought it was worth', 'What happened next', 'Your call: buy or pass']),
        T('Rina K. ’28', 'Fall 2025|A', 'Change an assumption and watch the value move.', [4.8, 28, 2, 12], [1, 4], '', '', ['Why a dollar later is worth less', 'Build a simple valuation', 'Which assumption matters most?', 'Risk: what rate should you use?', 'Debt or shares?']),
        T('Marcus T. ’27', 'Spring 2025|A', 'Value a company you use, then pitch it to the class.', [4.7, 34, 2, 16], [2, 4], '', '', ['Pick a company you use', 'Forecast its cash', 'Discount it back', 'How wrong could you be?', 'Pitch it and take questions']),
      ]],
    ]},
  ];

  const FINE = 'That line is fine. Keep looking.';
  const demos = {
    sliders: {k: 'sliders', title: 'Drag the ratio of a geometric series'},
    voice: {k: 'chat', title: 'Explain geometric series out loud', orb: true, btn: 'Hold to talk', note: 'Sample conversation. No sound in this demo.', turns: [
      ['Add 1/2 + 1/4 + 1/8 and keep going forever. Why doesn’t it blow up?', 'Because the pieces keep getting smaller.'],
      ['So do the pieces of 1 + 1/2 + 1/3 + 1/4, and that one never stops growing. So what’s different?', 'These shrink faster. Each step covers half of what’s left.'],
      ['Good. Half of what’s left of what? Tell me what the whole thing is closing in on.'],
    ]},
    mistake: {k: 'pick', title: 'Whose geometric sum is wrong?', q: 'Someone added 3 + 3/2 + 3/4 + … and got 2. Tap the line that’s wrong.', opts: [
      {t: 'First term: a = 3', fb: FINE},
      {t: 'Each term is half the last: r = 1/2', fb: FINE},
      {t: 'Sum = a / (1 + r)', ok: true, fb: 'Yes. It’s a / (1 − r), so the sum is 6. The first term alone is already 3, so 2 was never possible.'},
      {t: '3 / 1.5 = 2', fb: 'The arithmetic is right. The problem is earlier.'},
    ]},
    group: {k: 'group', title: 'Convergence, in your own words', q: 'In one minute: why can adding forever give a finite total?', clips: [['Ana', '0:52'], ['Ben', '1:00']], btn: 'Record your minute', after: 'Now reply to one classmate. Sample: nothing was recorded.'},
    drill: {k: 'drill', title: 'The ratio test', q: 'Does the series of 3ⁿ / n! converge?', pace: 'About 6 minutes on the old exam', hints: ['Factorials and powers together usually point to one test. Which one?', 'Use the ratio test: divide term n + 1 by term n.', 'The ratio simplifies to 3 / (n + 1). What does that approach?'], answer: 'It approaches 0, which is less than 1, so the series converges. Starting at n = 1, it adds up to e³ − 1.'},
    calc: {k: 'calc', title: 'Write sin x as a series'},
    bet: {k: 'bet', title: 'Place your first bets', rounds: [
      {s: '1 + 1/4 + 1/9 + 1/16 + …', conv: true, why: 'Squares grow fast enough. It settles near 1.645.'},
      {s: '1 + 1/2 + 1/3 + 1/4 + …', conv: false, why: 'The pieces shrink, but the total never stops growing. This one fools almost everyone.'},
      {s: '1/2 + 2/3 + 3/4 + 4/5 + …', conv: false, why: 'The pieces head toward 1, not 0. Adding nearly 1 forever can’t settle.'},
      {s: '1 − 1/2 + 1/3 − 1/4 + …', conv: true, why: 'It jumps back and forth by less each time. It settles near 0.693.'},
      {s: '1/2 + 1/4 + 1/8 + 1/16 + …', conv: true, why: 'Each step covers half of what’s left. It settles at 1.'},
    ]},
    statement: {k: 'steps', title: 'How my uncle opens an annual report', q: 'What I read first, in order.', note: 'Grace’s uncle, recorded. A made-up company.', end: 'Now you read one on your own.', steps: [
      ['Cash from operations $420M. Net income $610M.', 'Profit looks great, but less cash came in. I always ask why first.'],
      ['Debt due this year $900M. Cash on hand $300M.', 'Can they pay it? This is the second thing I look at.'],
      ['Footnote 4: revenue is now counted earlier.', 'Did the rules change, or did the business? People skip the footnotes. Don’t.'],
    ]},
    earnings: {k: 'pick', title: 'Your first earnings call', q: 'An analyst asks: “Why did cash from operations fall 40%?” Tap the sentence where the CEO changes the subject.', opts: [
      {t: '“Thanks for the question.”', fb: 'Just manners. Keep listening.'},
      {t: '“Revenue grew 12%, our best quarter in three years.”', ok: true, fb: 'That’s it. The question was about cash, and the answer is about revenue. Now go check the cash flow statement yourself.'},
      {t: '“We remain focused on long-term value.”', fb: 'Empty, yes. But the switch already happened one sentence earlier.'},
    ]},
    cashsim: {k: 'cashsim', title: 'Sell on credit'},
    debate: {k: 'group', title: 'Group verdict: would you buy it?', q: 'One minute: would you buy this company? Use one number from its statements.', clips: [['Chris', '0:58'], ['Lena', '0:44']], btn: 'Record your take', after: 'Your group votes once everyone has recorded. Sample: nothing was recorded.'},
    drillfin: {k: 'drill', title: 'Indirect cash flow', q: 'Net income is $50. Depreciation is $10. Customers owe you $15 more than last year. What is cash from operations?', pace: 'About 4 minutes on the old exam', hints: ['Start from net income and undo what wasn’t cash.', 'Depreciation was subtracted, but no cash left. Add it back.', 'Customers owing more means sales you haven’t collected. Subtract it.'], answer: '50 + 10 − 15 = $45.'},
  };
  /* The unit that holds today. The sample term moves with the calendar (places.js), so this never changes. */
  const currentUnit = c => c.units.findIndex(u => u[1] >= '2026-11-02');
  return {classes, demos, currentUnit};
})();
