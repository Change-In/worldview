/* Lesson card "•••" menu and the folder arc (NAV-132).
   The ••• button on every lesson card offers Rename, Organize into folders,
   Archive and Delete. Organizing opens a full-screen arc: the lessons sit in a swipeable
   strip at the bottom, the folders hang in an arc above, and tapping a folder
   files (or unfiles) the centred lesson. With more than seven folders the arc
   turns like a dial so every name stays readable.
   Saved lessons (learner runs) keep their folders beside the run list on this
   device, the same way Archive does; older lessons keep them on the lesson. */
(function () {
  const RUN_FOLDERS_PREFIX = "worldview-learner-run-folders-v1:";
  const MAX_SPREAD = 7, STEP = 27, SPAN = 80, LIMIT = 95;

  function runFolderMap() {
    if (!cloudAccount?.id) return {};
    try {
      const value = JSON.parse(localStorage.getItem(RUN_FOLDERS_PREFIX + cloudAccount.id) || "{}");
      return value && typeof value === "object" && !Array.isArray(value) ? value : {};
    } catch (_) { return {}; }
  }
  function runFolderIds(runId) { const ids = runFolderMap()[runId]; return Array.isArray(ids) ? ids : []; }
  function setRunFolder(runId, categoryId, include) {
    if (!cloudAccount?.id) return false;
    const map = runFolderMap(), ids = new Set(Array.isArray(map[runId]) ? map[runId] : []);
    if (include) ids.add(categoryId); else ids.delete(categoryId);
    if (ids.size) map[runId] = [...ids]; else delete map[runId];
    try { localStorage.setItem(RUN_FOLDERS_PREFIX + cloudAccount.id, JSON.stringify(map)); return true; }
    catch (_) { return false; }
  }
  /* Renames of saved lessons, kept on this device beside the run list. */
  const RUN_TITLES_PREFIX = "worldview-learner-run-titles-v1:";
  function runTitles() {
    if (!cloudAccount?.id) return {};
    try { const value = JSON.parse(localStorage.getItem(RUN_TITLES_PREFIX + cloudAccount.id) || "{}"); return value && typeof value === "object" && !Array.isArray(value) ? value : {}; }
    catch (_) { return {}; }
  }
  function renameItem(item, title) {
    if (item.kind === "lesson") {
      if (!guardAccountMutation("rename this lesson")) return false;
      const lesson = getLesson(item.id); if (!lesson) return false;
      lesson.title = title; lesson.updatedAt = Date.now();
      return save() !== false;
    }
    if (!cloudAccount?.id) return false;
    const map = runTitles(); map[item.id] = title;
    try { localStorage.setItem(RUN_TITLES_PREFIX + cloudAccount.id, JSON.stringify(map)); return true; }
    catch (_) { return false; }
  }
  function runCountInFolder(categoryId) {
    const map = runFolderMap();
    return homeLearnerRuns().filter(run => (map[run.runId] || []).includes(categoryId)).length;
  }

  function items() {
    const runs = homeLearnerRuns().map(run => ({ kind:"run", id:run.runId, title:run.title || "Lesson", run }));
    const lessons = state.lessons.filter(lesson => !isSourceLesson(lesson) && !lessonIsArchived(lesson))
      .map(lesson => ({ kind:"lesson", id:lesson.id, title:lesson.title || lesson.topic || "Lesson" }));
    return [...runs, ...lessons];
  }
  function folderIds(item) {
    return item.kind === "run" ? runFolderIds(item.id) : (getLesson(item.id)?.customCategoryIds || []);
  }
  function toggleFolder(item, categoryId) {
    const include = !folderIds(item).includes(categoryId);
    if (item.kind === "run") {
      if (!setRunFolder(item.id, categoryId, include)) { toast("This device could not save that change. Try again.", 4000); return; }
    } else if (setLessonCategoryMembership(getLesson(item.id), categoryId, include) === false) return;
    return include;
  }

  function el(tag, cls, text) { const node = document.createElement(tag); if (cls) node.className = cls; if (text != null) node.textContent = text; return node; }

  /* ---------- ••• menu ---------- */
  let menu = null;
  function closeMenu() { if (!menu) return; menu.remove(); menu = null; setActiveViewInert(false); }
  function openMenu(item) {
    closeMenu();
    menu = el("div", "lf-menu-backdrop");
    const sheet = el("div", "lf-menu");
    sheet.setAttribute("role", "dialog"); sheet.setAttribute("aria-modal", "true"); sheet.setAttribute("aria-label", "Lesson options");
    sheet.append(el("div", "lf-menu-title", item.title));
    const action = (label, fn, cls) => { const b = el("button", "lf-menu-row" + (cls ? " " + cls : ""), label); b.type = "button"; b.onclick = fn; sheet.append(b); return b; };
    action("Rename", () => {
      sheet.innerHTML = "";
      const form = el("form", "lf-rename");
      const input = el("input"); input.value = item.title; input.maxLength = 120; input.setAttribute("aria-label", "Lesson title");
      const saveBtn = el("button", "lf-menu-row", "Save"); saveBtn.type = "submit";
      const cancel = el("button", "lf-menu-row quiet", "Cancel"); cancel.type = "button"; cancel.onclick = closeMenu;
      form.append(el("div", "lf-menu-title", "Rename lesson"), input, saveBtn, cancel);
      form.onsubmit = event => {
        event.preventDefault();
        const title = input.value.replace(/\s+/g, " ").trim();
        if (!title || title === item.title) { closeMenu(); return; }
        if (!renameItem(item, title)) { toast("This device could not save that change. Try again.", 4000); return; }
        closeMenu(); renderHome(); toast("Renamed.");
      };
      sheet.append(form); input.focus(); input.select();
    });
    action("Organize into folders", () => { closeMenu(); openArc(item); });
    action("Archive", () => {
      closeMenu();
      if (item.kind === "run") archiveHomeLearnerRun(item.run); else setLessonArchived(item.id, true);
    });
    /* Older lessons have no deletion record that survives cloud sync, so they
       can only be archived; deleting them here would bring them back later. */
    if (item.kind === "run") action("Delete", () => {
      if (!confirm(`Delete “${item.title}”? It leaves your lessons for good.`)) return;
      closeMenu();
      if (!setHomeLearnerRunRemoval(item.id, "deleted")) { toast("This device could not save that change. Try again.", 4000); return; }
      renderHome(); toast("Lesson deleted.");
    }, "danger");
    action("Cancel", closeMenu, "quiet");
    menu.append(sheet);
    menu.addEventListener("click", event => { if (event.target === menu) closeMenu(); });
    document.body.append(menu);
    setActiveViewInert(true);
    sheet.querySelector("button").focus();
  }

  /* ---------- folder arc ---------- */
  let arc = null;
  function closeArc() {
    if (!arc) return;
    arc.root.remove(); window.removeEventListener("resize", arc.layout); arc = null;
    setActiveViewInert(false); renderHome();
  }
  function openArc(startItem) {
    closeArc();
    const list = items();
    let index = Math.max(0, list.findIndex(item => item.kind === startItem.kind && item.id === startItem.id));
    const root = el("div", "lf-arc");
    root.setAttribute("role", "dialog"); root.setAttribute("aria-modal", "true"); root.setAttribute("aria-label", "Organize lessons into folders");
    const head = el("div", "lf-arc-head");
    const addBtn = el("button", "lf-arc-new", "+ New folder"); addBtn.type = "button";
    const done = el("button", "lf-arc-done", "Done"); done.type = "button"; done.onclick = closeArc;
    head.append(addBtn, done);
    const form = el("form", "lf-arc-form"); form.hidden = true;
    const input = el("input"); input.maxLength = 36; input.placeholder = "Name a folder"; input.setAttribute("aria-label", "New folder name");
    const create = el("button", "", "Add"); create.type = "submit";
    form.append(input, create);
    const stage = el("div", "lf-arc-stage");
    const ring = el("div", "lf-arc-ring");
    const empty = el("p", "lf-arc-empty", "No folders yet. Make one with + New folder.");
    const strip = el("div", "lf-arc-strip");
    const caption = el("p", "lf-arc-caption");
    stage.append(ring, empty, strip);
    root.append(head, form, stage, caption);
    document.body.append(root);
    setActiveViewInert(true);

    const state_ = { rot:0, chips:[] };
    const current = () => list[index];

    function paintCards() {
      strip.innerHTML = "";
      list.forEach((item, i) => {
        const card = el("button", "lf-arc-card");
        card.type = "button";
        card.append(el("span", "serif", item.title));
        card.onclick = () => scrollToIndex(i, true);
        strip.append(card);
      });
    }
    function scrollToIndex(i, smooth) {
      const card = strip.children[i]; if (!card) return;
      strip.scrollTo({ left: card.offsetLeft - (strip.clientWidth - card.offsetWidth) / 2, behavior: smooth ? "smooth" : "auto" });
    }
    function onScroll() {
      const mid = strip.scrollLeft + strip.clientWidth / 2;
      let best = 0, bestDistance = Infinity;
      [...strip.children].forEach((card, i) => {
        const distance = Math.abs(card.offsetLeft + card.offsetWidth / 2 - mid);
        const t = Math.min(1, distance / card.offsetWidth);
        card.style.transform = `scale(${1 - .25 * t})`;
        card.style.opacity = String(1 - .55 * t);
        if (distance < bestDistance) { bestDistance = distance; best = i; }
      });
      if (best !== index) { index = best; paintChips(); }
    }
    function paintChips() {
      const item = current(), ids = item ? folderIds(item) : [];
      state_.chips.forEach(chip => {
        const on = ids.includes(chip.dataset.id);
        chip.classList.toggle("in", on);
        chip.setAttribute("aria-pressed", String(on));
      });
      const names = categoriesForSection("explore").filter(c => ids.includes(c.id)).map(c => c.name);
      caption.textContent = !item ? "No lessons to organize yet." : names.length ? "In " + names.join(", ") : "Tap a folder to file this lesson. Swipe for other lessons.";
    }
    function buildChips() {
      ring.innerHTML = ""; state_.chips = [];
      const folders = categoriesForSection("explore");
      empty.hidden = !!folders.length;
      folders.forEach(folder => {
        const chip = el("button", "lf-arc-chip", folder.name);
        chip.type = "button"; chip.dataset.id = folder.id;
        chip.onclick = () => {
          if (ring._dragged || !current()) return;
          const added = toggleFolder(current(), folder.id);
          if (added === undefined) return;
          paintChips();
          chip.classList.remove("pop"); void chip.offsetWidth; chip.classList.add("pop");
          if (navigator.vibrate) try { navigator.vibrate(12); } catch (_) {}
        };
        ring.append(chip); state_.chips.push(chip);
      });
      state_.rot = Math.min(state_.rot, maxRot());
      layout(); paintChips();
    }
    const maxRot = () => Math.max(0, (state_.chips.length - 1) * STEP - 2 * SPAN);
    function angleOf(i) {
      const n = state_.chips.length;
      if (n <= MAX_SPREAD) return n < 2 ? 0 : (i - (n - 1) / 2) * Math.min(40, 2 * SPAN / (n - 1));
      return i * STEP - SPAN - state_.rot;
    }
    function layout() {
      const w = stage.clientWidth, stripTop = strip.offsetTop, cardH = strip.firstElementChild?.offsetHeight || 160;
      const cx = w / 2, cy = stripTop + cardH * .45;
      /* An oval, not a circle: phones are tall, so the arc uses the height. */
      const rx = Math.max(110, Math.min(w / 2 - 58, 320)), ry = Math.max(rx, Math.min(cy - 60, rx * 2.6));
      state_.chips.forEach((chip, i) => {
        const a = angleOf(i), rad = a * Math.PI / 180;
        const x = cx + rx * Math.sin(rad), y = cy - ry * Math.cos(rad);
        const fade = Math.max(0, Math.min(1, (LIMIT - Math.abs(a)) / (LIMIT - SPAN)));
        chip.style.transform = `translate(${x}px,${y}px) translate(-50%,-50%)`;
        chip.style.opacity = String(fade);
        chip.style.pointerEvents = fade > .3 ? "" : "none";
        chip.tabIndex = fade > .3 ? 0 : -1;
      });
    }

    /* Turning the dial: a sideways drag anywhere outside the lesson strip. */
    let drag = null;
    stage.addEventListener("pointerdown", event => {
      ring._dragged = false;
      if (event.target.closest(".lf-arc-strip")) return;
      if (state_.chips.length <= MAX_SPREAD) return;
      drag = { x:event.clientX, rot:state_.rot, id:event.pointerId };
    });
    window.addEventListener("pointermove", onMove);
    function onMove(event) {
      if (!drag || event.pointerId !== drag.id || !arc) return;
      const dx = event.clientX - drag.x;
      if (Math.abs(dx) > 8) ring._dragged = true;
      const r = Math.max(110, Math.min(stage.clientWidth / 2 - 58, 320));
      state_.rot = Math.max(0, Math.min(maxRot(), drag.rot - dx / r * 180 / Math.PI));
      layout();
    }
    const endDrag = () => { drag = null; setTimeout(() => { ring._dragged = false; }, 0); };
    window.addEventListener("pointerup", endDrag); window.addEventListener("pointercancel", endDrag);
    stage.addEventListener("wheel", event => {
      if (state_.chips.length <= MAX_SPREAD || event.target.closest(".lf-arc-strip")) return;
      event.preventDefault();
      state_.rot = Math.max(0, Math.min(maxRot(), state_.rot + (event.deltaX || event.deltaY) * .15));
      layout();
    }, { passive:false });

    addBtn.onclick = () => { form.hidden = !form.hidden; if (!form.hidden) input.focus(); };
    form.onsubmit = async event => {
      event.preventDefault();
      const name = input.value.replace(/\s+/g, " ").trim();
      if (!name) return;
      if (!await ensureStableIdentityForMutation("create a folder")) return;
      if (categoriesForSection("explore").some(c => c.name.toLocaleLowerCase() === name.toLocaleLowerCase())) { toast("That folder already exists."); return; }
      state.customCategories.push({ id:uid(), name, section:"explore", createdAt:Date.now() });
      save();
      input.value = ""; form.hidden = true;
      state_.rot = maxRot() + STEP; buildChips(); // show the new folder at the end of the dial
    };
    root.addEventListener("keydown", event => { if (event.key === "Escape") closeArc(); });

    let raf = 0;
    strip.addEventListener("scroll", () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(onScroll); }, { passive:true });
    const relayout = () => { layout(); onScroll(); };
    arc = { root, layout: relayout };
    window.addEventListener("resize", relayout);
    const cleanup = new MutationObserver(() => { if (!root.isConnected) { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", endDrag); window.removeEventListener("pointercancel", endDrag); cleanup.disconnect(); } });
    cleanup.observe(document.body, { childList:true });

    paintCards(); buildChips();
    const start = index;
    const settle = () => { index = start; scrollToIndex(start, false); relayout(); paintChips(); };
    settle(); done.focus();
    requestAnimationFrame(settle); // again once fonts and sizes have settled
  }

  window.WorldviewLessonMenu = { open: openMenu, openArc, runFolderIds, runCountInFolder, runTitles };
})();
