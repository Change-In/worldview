/* Presentation-only transcript copying. Content comes from the owned conversation, never the rendered viewport. */
window.WorldviewConversationTools = (() => {
  'use strict';

  // VOI-144: spoken turns carry the clock time they were said.
  function serializeTurns(turns) {
    const list = (Array.isArray(turns) ? turns : [])
      .filter(turn => ['user', 'assistant'].includes(turn?.role) && typeof turn.content === 'string' && turn.content.trim());
    const clock = at => new Date(at).toLocaleTimeString([], { hour:'numeric', minute:'2-digit', second:'2-digit' });
    const body = list
      .map(turn => `${turn.role === 'user' ? 'You' : 'Worldview'}${Number.isFinite(turn.at) ? ' · ' + clock(turn.at) : ''}:\n${turn.content}`)
      .join('\n\n');
    const first = list.find(turn => Number.isFinite(turn.at));
    return first ? 'Conversation · ' + new Date(first.at).toLocaleDateString([], { weekday:'short', month:'short', day:'numeric', year:'numeric' }) + '\n\n' + body : body;
  }

  /* NAV-127: 'Copy my ideas' is the learner's own side only, one point per
     substantive turn. No model rewrites it, so it is exactly what they said. */
  function ideasText(turns, title = '') {
    const points = (Array.isArray(turns) ? turns : [])
      .filter(turn => turn?.role === 'user' && typeof turn.content === 'string')
      .map(turn => turn.content.replace(/\s+/g, ' ').trim())
      .filter(text => text.split(' ').length >= 4);
    if (!points.length) return '';
    return (title ? 'My ideas: ' + title : 'My ideas') + '\n\n' + points.map(point => '• ' + point).join('\n');
  }

  function mount({ button, status, getText, getIdeas = null, onThinking = null, getCard = null, onCard = null, getScope = () => '' }) {
    if (!button || typeof getText !== 'function') return null;
    let busy = false, dialog = null, field = null, dialogScope = '', noticeTimer = 0;
    const announce = text => { if (status) status.textContent = text; };
    const clearDialog = () => {
      if (field) field.value = '';
      if (dialog?.open) dialog.close();
      dialogScope = '';
    };
    const sync = () => { if (dialog?.open && getScope() !== dialogScope) clearDialog(); };

    function showSelectableCopy(text, scope) {
      if (getScope() !== scope) return;
      if (!dialog) {
        dialog = document.createElement('dialog');
        dialog.className = 'conversation-copy-dialog';
        dialog.setAttribute('aria-labelledby', 'conversation-copy-title');
        const title = document.createElement('h2');
        title.id = 'conversation-copy-title'; title.textContent = 'Copy transcript';
        const note = document.createElement('p');
        note.textContent = 'Automatic copying is unavailable. Select the text below and choose Copy.';
        field = document.createElement('textarea');
        field.readOnly = true;
        field.setAttribute('aria-label', 'Complete conversation transcript');
        const actions = document.createElement('div');
        const select = document.createElement('button');
        select.type = 'button'; select.textContent = 'Select all';
        select.onclick = () => { field.focus({ preventScroll:true }); field.select(); field.setSelectionRange(0, field.value.length); };
        const close = document.createElement('button');
        close.type = 'button'; close.textContent = 'Done'; close.onclick = clearDialog;
        actions.append(select, close); dialog.append(title, note, field, actions);
        dialog.addEventListener('close', () => { field.value = ''; dialogScope = ''; });
        document.body.append(dialog);
      }
      dialogScope = scope; field.value = text;
      if (!dialog.open) dialog.showModal();
      field.focus({ preventScroll:true }); field.select(); field.setSelectionRange(0, text.length);
    }

    async function copy(kind = 'transcript') {
      if (busy) return false;
      const scope = getScope();
      let text;
      try { text = kind === 'ideas' ? getIdeas() : getText(); }
      catch (_) { announce('Transcript is still loading. Try again shortly.'); return false; }
      if (typeof text !== 'string' || !text.trim()) { announce(kind === 'ideas' ? 'Nothing of yours to copy yet.' : 'No conversation to copy yet.'); return false; }
      busy = true; button.disabled = true; clearTimeout(noticeTimer);
      try {
        // Calling from the click, before an await, preserves Safari's user gesture.
        if (!navigator.clipboard?.writeText) throw Error('Clipboard unavailable');
        await navigator.clipboard.writeText(text);
        if (getScope() === scope) {
          announce(kind === 'ideas' ? 'Your ideas copied.' : 'Transcript copied.');
          noticeTimer = setTimeout(() => announce(''), 4000);
        }
        return true;
      } catch (_) {
        if (getScope() === scope) { announce('Select the transcript to copy it.'); showSelectableCopy(text, scope); }
        return false;
      } finally { busy = false; button.disabled = false; }
    }

    // With a second choice the button opens a two-item menu. Each item copies
    // inside its own tap, which is what Safari needs to allow the clipboard.
    let menu = null;
    const closeMenu = () => { if (menu && !menu.hidden) { menu.hidden = true; button.setAttribute('aria-expanded', 'false'); } };
    function openMenu() {
      if (!menu) {
        menu = document.createElement('div');
        menu.className = 'conversation-copy-menu'; menu.setAttribute('role', 'menu'); menu.hidden = true;
        /* LES-242: "Your thinking", an AI reading of the learner's ideas,
           replaces the plain copy of their own lines. */
        const items = [['transcript', 'Copy transcript', 'Every word, both sides, with times']];
        if (onThinking) items.push(['thinking', 'Your thinking', 'What your ideas add up to, read by AI']);
        else if (getIdeas) items.push(['ideas', 'Copy my ideas', 'Just what you said, as points']);
        for (const [kind, label, note] of items) {
          const item = document.createElement('button');
          item.type = 'button'; item.setAttribute('role', 'menuitem');
          const small = document.createElement('small'); small.textContent = note;
          item.append(label, small);
          item.addEventListener('click', () => { closeMenu(); if (kind === 'thinking') onThinking(); else void copy(kind); });
          menu.append(item);
        }
        // LES-236: once a lesson is complete its card is one tap away here too.
        const card = document.createElement('button');
        card.type = 'button'; card.setAttribute('role', 'menuitem'); card.dataset.lessonCard = 'true'; card.hidden = true;
        const cardNote = document.createElement('small'); cardNote.textContent = 'What you figured out, in your words';
        card.append('Lesson card', cardNote);
        card.addEventListener('click', () => { closeMenu(); onCard?.(); });
        menu.append(card);
        (button.closest('header') || button.parentElement).append(menu);
        document.addEventListener('click', event => { if (!menu.hidden && !menu.contains(event.target) && !button.contains(event.target)) closeMenu(); });
        document.addEventListener('keydown', event => { if (event.key === 'Escape' && !menu.hidden) { closeMenu(); button.focus(); } });
      }
      const cardItem = menu.querySelector('[data-lesson-card]');
      if (cardItem) cardItem.hidden = !(getCard && onCard && getCard());
      menu.hidden = false; button.setAttribute('aria-expanded', 'true');
      menu.querySelector('button')?.focus({ preventScroll:true });
    }
    const hasMenu = Boolean(getIdeas || onThinking);
    if (hasMenu) { button.setAttribute('aria-haspopup', 'menu'); button.setAttribute('aria-expanded', 'false'); }
    button.addEventListener('click', () => { if (!hasMenu) { void copy(); return; } if (menu && !menu.hidden) closeMenu(); else openMenu(); });
    window.addEventListener('pagehide', () => { clearDialog(); closeMenu(); });
    return { copy, sync:() => { sync(); }, clear:clearDialog, closeMenu };
  }

  return { mount, serializeTurns, ideasText };
})();
