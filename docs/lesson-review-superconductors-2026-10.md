# Lesson review: "Room-temperature superconductors" (Oct 5–8, 2026)

Study `b64a4672-c885-4b74-9b11-607bd7807f07` · engine `cards-v1` · Gemini Live (`gemini-3.8-live`) for the lesson; `gpt-live-1` ran Clarification and Extraction.
The saved transcript is in Supabase `worldview_live_studies.fragments` (708 fragments). Move-on decisions are in `worldview_lesson_events`. Card designs are in `worldview_lesson_cards`.

This document is a handoff: each fix names the file and function to change, says what "done" means, and lists the tests to write. Fixes are grouped by issue and ordered by priority.

**Two repositories are involved:**
- **Frontend (this repo, `change-in/worldview`):** `lab/gemini-live.js`, `lab/live-conversation.js`, tests in `tests/`.
- **Backend (`worldview-backend`, deployed as the Supabase function `live-trial`):** `functions/live-trial/gemini-policy.mjs`, `cards-flow.mjs`, `teach-anything.mjs`, `phase-policy.mjs`, `cards.mjs`, `journey.ts`. The backend repo is not in this session. Whoever fixes the backend items needs that repo.

---

## 0. Summary

| # | Problem | Severity | Where |
|---|---|---|---|
| 1 | Talking for about a minute triggers the "quiet minute" pause; on resume the tutor answers half a thought and gets cut off | **Must never happen** | frontend + backend setup |
| 2 | In the car the mic stops registering speech until pause/play | **Must never happen** | frontend + backend setup |
| 3 | Reopening the lesson doesn't re-orient you or acknowledge the gap | High | frontend instructions + backend |
| 4 | No foundations for a beginner; "quick" made a broad topic too thin; the topic was silently changed from semiconductors to superconductors | High | backend lesson design + clarification |
| 5 | The lesson moved on (and into the teach-back) while you were still asking questions or had said "I don't want to move on" | High | backend `cards-flow.mjs` |
| 6 | Dishonest completion ("You can now explain…") repeated about 5 times; flattery ("fascinating", "Exactly" ×6) | Medium | backend prompts + frontend |
| 7 | Clarification looped ("Shall we start?" ×4), misheard "quick", ignored "I'm leaving now" | Medium | backend clarification prompt / gpt-live path |
| 8 | Smaller items: duplicate tutor lines, loose numbers, card redesign after completion | Low | mixed |

---

## 1. Talking for over a minute triggers an auto-pause, and resuming cuts the tutor off (MUST FIX)

### What the data shows (Oct 8)
- 09:26:46.3: the tutor's last caption ("…Are you ready to move on to transportation?").
- 09:26:46 → 09:27:54: **no fragment of any kind for 68 seconds**, although you were talking the whole time.
- 09:27:54.4: the tutor says "I'm sorry, I didn't catch that. Could you please say it again?"
- 09:27:55.5: **your whole minute of speech arrives as one single fragment** (seq 393, a long paragraph).
- 09:28:20.7: your next utterance arrives, and the tutor's reply starts 37 ms later. The reply was already generated, and the caption only arrived when the turn closed.

Learner speech is therefore **not** captioned while you speak. Gemini delivers the input transcription for a long utterance only when the turn ends. The app treats captions as proof that someone is talking.

### Three most likely reasons (ranked)

**R1. The "quiet minute" timer only counts captions, not your voice.**
`lab/live-conversation.js` `idleCheck()` pauses when `performance.now() - s.lastActivityAt >= IDLE_PAUSE_MS (60000)`. `lastActivityAt` is only moved by `append()` when a caption arrives (and by start, resume and mute taps). The mic level is measured continuously (`onInputLevel`), but it never updates `lastActivityAt`. Because Gemini sends your caption only at the end of your turn, 60 seconds of continuous talking looks like 60 seconds of silence, and the timer pauses you mid-sentence. The 60 seconds count from the tutor's last caption, so "thinking 15 s, then talking 45 s" also triggers it. Noise captions (`isNoiseCaption`) don't refresh it either.

**R2. The pause itself ends your turn, and "just start talking" can't un-pause you.**
`idlePause()` → `gemini.mute(true,{hold:true})` sends `realtimeInput.audioStreamEnd: true` (`lab/gemini-live.js` `mute()`). That tells Gemini your audio ended, so the server closes your turn mid-sentence and prepares an answer to the half-thought. While paused, `inputLevel()` should resume you when you speak. But it measures the "room" floor during **the first second of the pause, which is while you are still talking**, then requires 3× that level (`threshold=max(.02, median(first 10 levels)*3)`). Your own voice set the bar, so speaking can't clear it and you have to tap. On tap, `softResume()` sends the held 1.5 s of audio. Gemini then answers the truncated turn, you keep talking, `START_OF_ACTIVITY_INTERRUPTS` cuts the tutor off, and the rest of your thought becomes a new turn. That matches what you described.

**R3. Turn-ending is too eager for someone thinking out loud, and the app makes the tutor talk into your pauses.**
- Backend `gemini-policy.mjs` sets `realtimeInputConfig.automaticActivityDetection = { endOfSpeechSensitivity: 'END_SENSITIVITY_LOW', silenceDurationMs: 1200 }`. Any 1.2-second pause ("I… I forgot my word") ends your turn and the tutor starts answering.
- Frontend `watchUnheard()` (gemini-live.js) sends a **completed** turn, `APP NOTE: the learner just spoke but no words came through… ask them to say that again`, when the mic heard voice, no caption arrived, and there was 3 s of quiet. Because captions only arrive at turn end, a 3-second thinking pause in a long answer looks like "unheard speech", so the tutor says "I didn't catch that" over you. This line appears at 20:54:48 (Oct 5), 09:27:54 and 09:36:20 (Oct 8).
- `prompt()` (phase openings, warm-ups) waits only 0.8 s after your voice (`promptWait`), so openings can also start during your pauses.

### Fix plan (do all of it; each step closes one hole)

**F1.1 Treat your voice as activity (frontend, `lab/live-conversation.js`).**
- Add an adaptive voice detector fed by `onInputLevel`. Keep a rolling noise floor: the 10th percentile of levels over the last 30 s, sampled only while the tutor is not playing. Count voice when `level > max(floor*2.5, floor+0.015)` for ≥ 200 ms.
- On voice, set `s.lastVoiceAt = s.lastActivityAt = performance.now()`.
- `idleCheck()`: pause only if **no voice AND no caption AND no tutor audio** for `IDLE_PAUSE_MS`. Raise `IDLE_PAUSE_MS` to 90 s. Never pause within 15 s of `lastVoiceAt`.
- Put the decision in a pure function `shouldIdlePause({now,lastVoiceAt,lastCaptionAt,lastTutorAudioAt,speaking,checking})` so it can be unit-tested.

**F1.2 A pause must never end a turn that is in progress (frontend, `lab/gemini-live.js` `mute()`).**
- Only send `audioStreamEnd` when the local detector has heard no voice for ≥ 5 s. After F1.1 the idle pause can't fire sooner than that anyway; this guard is defence in depth.
- Make the held buffer 3 s instead of 1.5 s (`held.length>30`).

**F1.3 Auto-resume measures the room before the pause, not during it (frontend, `inputLevel()`).**
- Use the rolling floor from F1.1 captured **at the moment of pausing**, instead of `levelFloor` from the first second after.
- Resume when `level > max(floor*2.5, floor+0.015)` for 250 ms.

**F1.4 Let people think (backend `gemini-policy.mjs`).**
- `silenceDurationMs: 1200 → 2200`, and add `prefixPaddingMs: 300`. Keep `END_SENSITIVITY_LOW`.
- Test 2000–2500 ms by ear. Shorter makes the tutor jump in; longer makes replies feel slow.
- Phase 2 option, if F1.1–F1.6 are not enough: turn off automatic activity detection (`automaticActivityDetection.disabled: true`) and send `realtimeInput.activityStart` / `activityEnd` from the client detector. The app then decides when your turn ends (for example 2.5 s of silence, or longer after a "um"). The setup is locked server-side through `fieldMask`, so this change lives in the backend.

**F1.5 The app never makes the tutor talk while you might still be mid-thought (frontend, `gemini-live.js`).**
- `promptWait()`: require ≥ 2.5 s since the last voice (currently 0.8 s).
- `watchUnheard()`: do not send a spoken prompt. Fire only if the server has also been silent (no `serverContent` of any kind) for ≥ 6 s after your voice stopped. Show an on-screen hint ("Didn't get that, try again") and play a short chime instead of making the tutor speak. The spoken version is what interrupts you.

**F1.6 Record what happened (frontend → `worldview_lesson_events`, counts and times only, no speech).**
- Record these events: `idle_pause {sinceVoiceMs, sinceCaptionMs}`, `soft_resume {by:'voice'|'tap'}`, `unheard_hint`, `barge_in`.
- After shipping, you can query whether any `idle_pause` fired with `sinceVoiceMs < 15000`. The target is zero.

### "Done" means (acceptance tests, `tests/voice-idle.test.mjs`, same `node:test` + `vm` style as `tests/live-phase-opening.test.mjs`)
1. A simulated 120 s of continuous voice (level 0.08) with **no captions** never triggers `shouldIdlePause`.
2. 45 s of thinking silence followed by 60 s of voice never triggers a pause.
3. 90 s of true silence (floor 0.01) does pause.
4. A car-noise floor of 0.05 with speech at 0.09 resumes from a pause within 300 ms; floor 0.05 with no speech does not resume.
5. `mute(true,{hold:true})` does not send `audioStreamEnd` when voice was heard within the last 5 s.
6. Manual check on a phone: talk continuously for 2 minutes, pausing 2 s between sentences. No pause fires, no "didn't catch that", and the tutor answers once after you stop.

---

## 2. The mic stops registering speech in the car (MUST FIX)

### What the data shows (Oct 7, 6:16–6:18 PM)
- 18:16:21.9: the tutor asks "What happens when you try to push past that limit?"
- 18:16:22 → 18:17:28: **66 seconds with zero learner fragments**, on a connection that was still alive. The same connection id, `4fdfcbaa`, heard "Hello." at 18:17:28.
- 18:17:38: "Can you hear me? I was trying to talk for like a minute there. I was just paused."
- 18:19:19: a new connection (`bf4b17b8`) appears, so the connection dropped and reconnected shortly afterwards.

Unlike Issue 1, the minute of speech **never** arrived, even later. The server never treated it as speech, or never received it.

### Three most likely reasons (ranked)

**R1. Same caption-based pause as Issue 1, made worse by car noise.**
Nothing was captioned for 60 s, so the app soft-paused and stopped sending audio. "Just start talking" then needs your voice to beat 3× the level measured in the first second of the pause. With road noise plus the browser's automatic gain control (`autoGainControl:true` in `acquireMic()`), speech and road noise come out at similar levels, so "hello, hello" never clears the bar and you have to tap. You literally said "I was just paused."

**R2. Gemini's turn detection misses speech in road noise, and the app's safety net is disabled in exactly that case.**
Gemini's automatic VAD (default start sensitivity) has to decide that speech started. After the browser's noise suppression and gain control, car speech can fail to trigger it, so there is no turn, no caption and no reply. The app has a safety net, `watchUnheard()` ("the mic hears voice but no words arrive"), but it uses a fixed `VOICE_LEVEL=.02` and needs **3 s below that level** before it fires. Continuous road noise sits above 0.02, so the net never fires in a car. "Sometimes it would hear me" fits a detector that sits on the edge.

**R3. The mic or the network silently stalls, and nothing watches the input side.**
- iOS interrupts web audio for navigation voice prompts, notifications, and CarPlay or USB route changes. That can mute the mic track or suspend the `AudioContext`.
- A cellular handoff while driving can leave the WebSocket half-open: it reports OPEN while nothing reaches Google. The app would only notice after about 1 MB of buffered audio, roughly 20+ seconds.
- The code watches **output** (`watchSound` leads to "Tap to hear the tutor"). It never watches **input**: there is no listener for the track's `mute` event, no check that capture frames keep arriving, and no check that the server still answers audio.
- The reconnect at 18:19:19 shows the link did fail around then. This ranks third only because the 18:16 minute happened on a connection that still worked.

### Fix plan ("foolproof" means: it detects the failure by itself within seconds, recovers by itself, and tells you out loud)

**F2.1 Fix Issue 1 first.** F1.1 and F1.3 remove R1 entirely: the app no longer pauses while you talk, and auto-resume uses a floor measured before the pause.

**F2.2 Turn detection that works in noise (backend `gemini-policy.mjs`).** Add `startOfSpeechSensitivity: 'START_SENSITIVITY_HIGH'`. Then test whether turning off browser `noiseSuppression` while keeping `echoCancellation` helps Gemini hear car speech. Do an A/B drive test with both, and keep whichever produces fewer `unheard` events (F2.5). Long term, the Phase 2 client-controlled turns from F1.4 remove the dependency on Google's detector.

**F2.3 Make the "spoke but no words came" net work in noise (frontend `watchUnheard`).** Use the adaptive floor from F1.1 instead of the fixed 0.02. Define "a voice burst ended" relative to that floor. If the server sent nothing (no `inputTranscription`, no `serverContent`) within 5 s after the burst ended, go to F2.4.

**F2.4 A new input-health watchdog (`lab/voice-health.js`, loaded by `lab/index.html`).** It runs every second during a voice session and checks:
- (a) mic track `readyState==='live'` and not `muted` (add `mute`/`unmute` listeners next to the existing `ended` listener in `begin()`);
- (b) a capture frame arrived from the worklet in the last 1 s, and the last 2 s are not all zeros;
- (c) `AudioContext.state==='running'`;
- (d) server liveness: after a voice burst, any server message within 5 s.

The recovery ladder, each step automatic and logged:
1. `audio.resume()`.
2. Re-acquire the mic with `getUserMedia` and swap the `MediaStreamSource` on the same context. Add a `replaceMic(stream)` control to gemini-live.js.
3. Close the socket and reopen it with the **session resumption handle** (`open(true)`). Then resend the last ≤ 8 s of audio from a ring buffer, kept from the moment the unanswered burst started, so what you said isn't lost.
4. If all of that fails within 15 s, run the normal `stop()` → `begin()` with the saved conversation, without waiting for a tap.

**F2.5 Tell the learner without needing eyes.**
- When the watchdog trips, play a distinct short cue through `WorldviewLessonCues` (a "lost you" cue, different from the pause chime). After recovery, have the tutor say one sentence: "I lost you for a few seconds. Say that last part again?" Send it as a `prompt()` once the connection is back, so it is the one spoken message allowed.
- On screen, show a persistent "Hearing you" light that turns on only when the **server** confirms speech (an input caption or a turn start), plus a single large "Fix voice" button that runs the recovery ladder.

**F2.6 Telemetry.** Record `capture_stall`, `track_muted`, `context_suspended`, `server_silent_after_voice`, `recovered {step}` and `recovery_failed` in `worldview_lesson_events`. Counts and times only.

### "Done" means
1. Unit tests for the watchdog's decisions, with fake clock, levels and server events: each failure mode is detected within 6 s and climbs the ladder in order.
2. Unit test: an adaptive floor of 0.05 with speech at 0.09 counts as a voice burst; steady 0.05 noise does not.
3. Drive test, 20 minutes with phone navigation voice prompts on, windows up and then down. Every utterance is answered, or followed within 6 s by the "lost you" cue and automatic recovery. You never have to touch the phone.
4. After a week, `server_silent_after_voice` events are rare, and each one is followed by `recovered` rather than `recovery_failed`.

---

## 3. Reopening the lesson doesn't re-orient you or acknowledge the gap

### Evidence
- Oct 7, 08:41 (about 36 h after starting): one recall question ("You rightly noted…"). There was no "here's where we are", no card position, and no acknowledgment of the gap.
- Oct 7, 08:45 and 18:13–18:14: three reconnects, and each re-asked the same open question word for word ("Where might this… reach its limits?" ×3).
- Oct 8, 09:25: "I left the lesson and just came back to this question. I'm kind of lost." The tutor re-asked the question instead of re-orienting you.

### Likely reasons
1. **The instructions are minimal by design** (`lab/live-conversation.js`). `RESUME_INSTRUCTION` says "no greeting… repeat that one question in one short sentence". `CARDS_WARMUP_INSTRUCTION` asks one twist question. Neither says where you are in the lesson or what's left.
2. **The tutor is never told how long you were away.** `warmupDue()` is a yes/no 2-hour check on `study.updatedAt`, and any saved fragment (even a noise caption) resets it. Every reconnect within a sitting uses `RESUME`, which re-asks the last question, and this happened 3× in a row.
3. **There is no structured "where we are" summary.** The tutor has only the conversation history, and `contextWindowCompression` trims it to about 12k tokens (backend `GEMINI_CONTEXT_WINDOW`). After a long lesson the setup of the open question may have been trimmed away, so it gets re-asked without context.

### Fix plan
- **F3.1 Build a re-entry brief (backend `journey.ts`, returned by `journey_prepare`).** It contains:
  - `awayMs` (now minus the last learner fragment time);
  - `position` ("Card 2 of 3 · Power grids");
  - the card goal in plain words;
  - covered cards with one line each, plus any recorded gaps;
  - the open question and its one-sentence setup;
  - what you said last.
- **F3.2 Scale the opening to the gap (frontend `begin()`, replacing `RESUME_INSTRUCTION`/`warmupDue`):**
  - < 2 min (a reconnect): say nothing extra and listen. If an open question exists, re-ask it at most once per sitting; track `askedAgainSeq`.
  - 2 min – 2 h: one sentence on where we are, then re-ask the question **with its setup**.
  - more than 2 h: "Welcome back" is allowed here (this replaces the VOI-153 "no greeting" rule for long gaps). Then a 2–3 sentence recap of the lesson so far, which card we're on and what's left, a one-question warm-up, and the card.
  - more than 1 day: the same, plus "Want a quick refresher of the last part first?"
- **F3.3 Show the same brief on screen when the lesson reopens:** "You're on card 2 of 3: Power grids. Last time: …".
- **F3.4 "I'm lost" is a signal.** If the learner says "lost / confused / don't remember / what were we" (extend the `OPEN` regex in `cards-flow.mjs`), the tutor re-explains the current card's scene and idea plainly before asking anything.
- **Tests:** a pure `reentryInstruction({awayMs,position,openQuestion})` returns the right tier. A reconnect within 2 min never re-asks a question already re-asked in this sitting.

---

## 4. The lesson design didn't fit a beginner or a broad topic

### Evidence
- **The topic was silently changed.** You said "room temperature **semi**conductors". The clarification tutor said "semiconductors" six times. The lesson goal says "zero electrical resistance", which describes **super**conductors. Nobody told you, so you were confused on Oct 7 ("Super or I guess conductors in general. Those are used in transistors?") and on Oct 8 ("Why is a conductor important in general? I don't think we touched that").
- **Beginner signals were ignored.**
  - In Extraction you said "I don't even know", but the lesson stayed at three application cards: computing, grids, transport.
  - The first card's `foundation` question was "What happens to a computer when it works hard?". There was no "what is a conductor, resistance or superconductor, and why do today's need extreme cold".
  - Every card is challenge-first (Predict it / Trace it / Design it). For someone with no basis that means "I didn't know how to answer most of the questions."
- **"Quick" was too small for a broad topic.** `lessonBrief.depth='quick'` gave 3 cards, a 6-turn budget per card (`QUICK_CARD_BUDGET`) and no chapter recaps. You said multi-day is fine, but the clarification never explained what "quick" would cost on a topic this broad.
- **"What didn't we touch on?"** at the end got a list, not an offer to extend the lesson.

### Fix plan
- **F4.1 Check the term during Clarification (backend clarification prompt `clarification-conversation-v28`, plus the lesson planner).**
  - If the topic looks like a near-miss for a better-known term (semiconductor/superconductor, fission/fusion, and so on), ask once: "Did you mean superconductors, materials with zero electrical resistance? Semiconductors are what chips are made of."
  - If the planner changes the topic anyway, the first lesson line must say so plainly.
  - Store `topicCorrection` in `lessonBrief`.
- **F4.2 Add a foundations chapter when the learner is new.**
  - Extraction produces `baseline: 'none'|'some'|'solid'`. "I don't know" or a wrong basic answer means `none`.
  - With `none`, the planner (backend `cards.mjs`/`journey.ts`) inserts a **Foundations** chapter first. For this topic that would cover how current flows; conductors vs insulators vs semiconductors; resistance → heat; what a superconductor is; why today's need extreme cold; and where room-temperature claims stand (LK-99).
  - Foundations cards are **explain-first**: 2–3 plain sentences with an everyday example, then one easy check question. Add a card move like "Explain, then check" to the move list in `cards.mjs`.
- **F4.3 Make every card teachable for novices.** Add `explainFirst` (2 plain sentences) to the card schema. The tutor uses it before the challenge when `baseline==='none'`, or the moment the learner says they don't know.
- **F4.4 Lesson size scales with topic breadth.**
  - The planner rates breadth (`narrow|medium|broad`). Size = depth × breadth. For example, quick+broad gives 2 short chapters (about 5–6 cards) over about 2 sittings, not 3 cards.
  - The clarification depth question describes the options concretely: "Quick: about 15 minutes, 3 short challenges. Full: 2–3 chapters you can spread over a few days." For broad topics it recommends Full.
  - "No preference" defaults to Full for broad topics.
- **F4.5 Extend instead of ending.** At completion, if outcomes were skipped or the learner asks what's left, offer "Want me to add a chapter on X next time?". This should create a follow-on chapter on the same study, using the existing chapter machinery.
- **F4.6 Every new term gets a one-line "what it is"** (SMES, maglev guideway, critical current). Add this to `phase-policy.mjs` CONVERSATION STYLE: "Never use a technical term the learner hasn't heard without a one-line plain definition."

---

## 5. The lesson moved on while you were still asking or had said "not yet"

### Evidence (`worldview_lesson_events`)
- **Oct 7, 08:43:41, computing → grids, "reached_click".** This came 30 s after "I guess I'm confused… conductors in general?". The answer accepted as mastery was the fragment "manufacturing the superconductors so small that they don't work for some".
- **Oct 8, 09:26:52, grids → transport by `coach_move` (an automatic rail).** At that moment you were asking "What's the scale?". The tutor said "Are you ready to move on to transportation?" over your question.
- **Oct 8, 09:33:31.** You said **"I don't want to move on just yet."**
- **09:34:08, transport → teach-back, `asked_to_move_on`, accepted.** The tutor called the tool 8 s **before** you answered its "Shall we move on?" with "Sure." at 09:34:16.
- **09:35:59, teach-back → complete after 5 turns**, including "I guess I'm still not sure". Only one of the three outcomes was taught back.

### Reasons (backend `cards-flow.mjs` `decideNextCard`)
1. **`findQuote` matches words, not meaning.** "move on" in "I don't want to move on just yet" counts as a request to move on. Nothing checks for negation.
2. **`asked_to_move_on` skips the `openQuestion` check** (`if(!asked&&openQuestion(row))`), so open questions don't block it.
3. **The `coach` and budget rails move on without checking `openQuestion`** or whether the learner is mid-speech.
4. **The teach-back accepts `taught_back` after 2 turns on one big question.** It ignores uncertainty ("not sure") and doesn't touch each outcome.

### Fix plan
- **F5.1** For `asked_to_move_on`, the quote must be an affirmative reply in the **latest learner turn after the tutor's offer**, with no negation in that turn (`/\b(?:don'?t|do not|not yet|wait|hold on|no)\b/`). Otherwise refuse with "They have not agreed yet. Wait for their answer."
- **F5.2** Apply `openQuestion(row)` to every path, rails included. A rail move is postponed (not dropped) until the question is answered. Add "lost", "scale?" and "what do you mean" style confusion to `OPEN`.
- **F5.3** Rails never fire within 10 s of the last learner fragment, or while the client reports voice. Pass `learnerSpeaking` from the client in `journey_next` / `journey_check`.
- **F5.4** Entering the teach-back needs explicit consent: an on-screen "Ready to teach it back?" with **Yes / Not yet**, and a spoken "yes". The tool can't skip it.
- **F5.5** The teach-back covers each outcome, with 1–2 naive questions each. `taught_back` is refused while the learner's latest turn shows uncertainty ("not sure", "I don't know", "I guess"). In that case the tutor asks which part feels shaky and offers to re-teach it.
- **F5.6** `reached_click` needs a quote of ≥ 6 words that states the idea, and is refused if the learner said they were confused in the last 2 turns.
- **Tests (backend):** extend the `cards-flow` tests:
  - "I don't want to move on just yet" with `asked_to_move_on` → refused.
  - A rail move while the last learner turn is a question → postponed.
  - `taught_back` after "I'm still not sure" → refused.

---

## 6. Honesty and tone

### Evidence
- "You can now explain how removing heat loss changes processor design, how lossless transmission impacts energy grids…" was said about 5 times (09:36:00, 09:36:20, 09:39:19, 09:40:56, 09:42:28). Two of the three outcomes were recorded as **gaps**: grids moved by the rail, transport by "asked to move on". You said: "I don't know how true that is."
- "I truly appreciate your honest feedback… I'll use your notes to improve our approach going forward." The tutor can't do that, and you called it out.
- "That is a fascinating frontier." "Exactly" appeared on 6 weak or partial answers. These rules already exist in `phase-policy.mjs` CONVERSATION STYLE ("no hype ('fascinating')… no run of 'Exactly'"), but the clarification ran on `gpt-live-1` and Gemini ignored them.
- Loose facts: "billions of dollars per mile" (overstated; real maglev costs are hundreds of millions per mile), "six percent" (the card says about 5%), and "energy stored indefinitely without decay" (SMES still needs cooling and has conversion losses).

### Fix plan
- **F6.1 The completion summary is built from data, not by the model.** The backend `toolResult()` complete branch returns `{shown:[{outcome, learnerQuote}], gaps:[{outcome, why}], next:[…]}`. Change the instruction from "Read back the questions they can now answer" to: "Say what they showed in their own words (quote briefly), name each gap plainly as not covered yet, offer to pick those up next time. Never say 'you can now explain' for a gap." Apply the same wording to `teach-anything.mjs` line 27/42 and `phase-policy.mjs` complete.
- **F6.2 Say it once.** After `complete`, stop the 25 s `check()` timer and APP_HANDOFF notes in `live-conversation.js`. Send one final note: "The wrap-up has been given. From now on, only answer the learner's questions; do not repeat the summary."
- **F6.3 Make "I'll pass this on" true.** Add a second tool, `save_feedback({note})`, that stores the learner's product feedback (a `journey_flag` with a `note`). The tutor calls it when the learner gives feedback about Worldview, then says "I've saved that for the people building Worldview." Never say "I'll improve".
- **F6.4 Enforce tone where it's actually ignored.** Put the anti-flattery lines in the **Gemini transport note** (`GEMINI_CARDS_TRANSPORT_NOTE`, which is always kept) and in the gpt-live clarification instructions, not only in phase policy. Add one more line: "Do not say 'Exactly' unless the answer is fully correct; for a partial answer say what's right and what's missing."
- **F6.5 Numbers only from the card's facts.** Add to the style rules: "Use numbers only from packet facts; otherwise say 'roughly' and stay qualitative."

---

## 7. The Clarification and Extraction conversation

### Evidence
- The first reply offered a menu, which the prompt forbids.
- "Shall we start?" ×4. You had to say "You say shall we start one more time."
- "Good person to look into and learn about." was a mishearing, and the tutor turned it into "I will prepare a quick lesson". The prompt says never to infer a preference.
- "I'm leaving now." got "We can pick this up…", followed by more questions on the next turn.

### Fix plan
- **F7.1** Clarification moves to Gemini like the rest of the lesson, or the same style rules are applied to `gpt-live-1`. One voice model per lesson is also cheaper to reason about.
- **F7.2** Treat a reply that doesn't answer the question asked as a mishearing: re-ask, don't infer. Add to the clarification prompt: "If the learner's reply does not answer your question, ask again in different words; never fill in a preference they didn't state."
- **F7.3** Never ask "Shall we start?" twice in a row. The second time, answer what they asked instead.
- **F7.4** Recognise "I'm leaving / gotta go / talk later" in the frontend (`append()` on learner fragments): save, say one closing line, and soft-stop voice (`stop(…,{pause:true})`). Don't ask anything more.

---

## 8. Smaller items

- **8.1 Duplicate tutor lines** ("Where might this… reach its limits?" ×3, "I'm ready when you are."). These come from several app prompts (resume, phase opening, APP NOTE) firing close together. Allow at most one app-initiated spoken prompt per 20 s, and drop any prompt whose text was already spoken in the last 2 minutes (`gemini-live.js` `prompt()`).
- **8.2 Card redesign after completion.** `worldview_lesson_cards` row `1e9eeb9f…` was re-claimed and redesigned on Gemini 3.1 Pro (attempts = 8) at 09:37–09:39, after the lesson completed at 09:35:59. Verify in `journey.ts` (around the cards claim, line ~180) and skip design for complete studies. This costs money for nothing.
- **8.3 Earlier answer from this conversation, corrected.** The transcript **is** stored server-side, in `worldview_live_studies.fragments`.

---

## Suggested order of work (for a cheaper model)

1. **Frontend PR A, Issue 1 (F1.1, F1.2, F1.3, F1.5, F1.6), with tests.** This also fixes most of Issue 2.
2. **Backend PR B, settings** (F1.4 `silenceDurationMs`/`prefixPaddingMs`, F2.2 `startOfSpeechSensitivity`). Small and quick to verify by ear.
3. **Frontend PR C, the input watchdog** (F2.3–F2.6), with tests and a drive test.
4. **Backend PR D, move-on rules** (all of Issue 5), with tests.
5. **Backend + frontend PR E, re-entry brief** (Issue 3).
6. **Backend PR F, honesty, tone and completion** (Issue 6, plus 8.1 and 8.2).
7. **Backend PR G, lesson design** (Issue 4, plus Issue 7). This is the largest piece and should be planned with the owner before building.

### Conventions to keep
- Match the existing compact one-line JS style. Put a ticket-style comment above each change explaining **why** (for example `/* VOI-160: … */`), as the surrounding code does.
- Tests use `node:test` + `node:vm` against the shipped file (see `tests/live-phase-opening.test.mjs`). Run them with `node --test tests/`.
- Bump the `?v=` cache-busting query on any changed `lab/*.js` in `lab/index.html`.
- Never send speech or text in telemetry: counts, times and fixed reason words only.

### Prompt to hand to Sonnet (one PR at a time)
> Read `docs/lesson-review-superconductors-2026-10.md`. Implement PR A only (Issue 1: F1.1, F1.2, F1.3, F1.5, F1.6) in `lab/live-conversation.js` and `lab/gemini-live.js`. Extract the idle and floor decisions into pure functions and add `tests/voice-idle.test.mjs` covering acceptance tests 1–5 of Issue 1. Keep the existing code style and comment conventions, bump the `?v=` for changed files in `lab/index.html`, run `node --test tests/`, and stop for review before any other PR.
