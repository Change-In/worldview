/* Presentation-only transcript copying. Content comes from the owned conversation, never the rendered viewport. */
window.WorldviewConversationTools = (() => {
  'use strict';

  function serializeTurns(turns) {
    return (Array.isArray(turns) ? turns : [])
      .filter(turn => ['user', 'assistant'].includes(turn?.role) && typeof turn.content === 'string' && turn.content.trim())
      .map(turn => `${turn.role === 'user' ? 'You' : 'Worldview'}:\n${turn.content}`)
      .join('\n\n');
  }

  function mount({ button, status, getText, getScope = () => '' }) {
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

    async function copy() {
      if (busy) return false;
      const scope = getScope();
      let text;
      try { text = getText(); }
      catch (_) { announce('Transcript is still loading. Try again shortly.'); return false; }
      if (typeof text !== 'string' || !text.trim()) { announce('No conversation to copy yet.'); return false; }
      busy = true; button.disabled = true; clearTimeout(noticeTimer);
      try {
        // Calling from the click, before an await, preserves Safari's user gesture.
        if (!navigator.clipboard?.writeText) throw Error('Clipboard unavailable');
        await navigator.clipboard.writeText(text);
        if (getScope() === scope) {
          announce('Transcript copied.');
          noticeTimer = setTimeout(() => announce(''), 4000);
        }
        return true;
      } catch (_) {
        if (getScope() === scope) { announce('Select the transcript to copy it.'); showSelectableCopy(text, scope); }
        return false;
      } finally { busy = false; button.disabled = false; }
    }

    button.addEventListener('click', () => { void copy(); });
    window.addEventListener('pagehide', clearDialog);
    return { copy, sync, clear:clearDialog };
  }

  return { mount, serializeTurns };
})();
