/* Device appearance is independent of identity and account library storage. */
(() => {
  const key = 'worldview-appearance-v1';
  const system = matchMedia('(prefers-color-scheme: dark)');
  let selected = 'system';
  try { selected = localStorage.getItem(key) || JSON.parse(localStorage.getItem('worldview-v1') || '{}').theme || 'system'; } catch (_) {}
  const valid = value => ['light', 'dark', 'system'].includes(value);
  if (!valid(selected)) selected = 'system';
  function apply() {
    const dark = selected === 'dark' || (selected === 'system' && system.matches);
    document.documentElement.dataset.theme = selected;
    document.documentElement.dataset.appearance = dark ? 'dark' : 'light';
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
    const button = document.getElementById('theme-toggle');
    if (button) {
      button.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
      button.title = button.getAttribute('aria-label');
      button.setAttribute('aria-pressed', String(dark));
      button.querySelector('svg').innerHTML = dark
        ? '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5"/>'
        : '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>';
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    // The lesson page's header is the card colour; the strip behind the phone's
    // clock must match it, or a band of a different colour shows at the top.
    const card = document.documentElement.dataset.statusTone === 'card';
    if (meta) meta.content = dark ? (card ? '#332c25' : '#241f1a') : (card ? '#fffdf8' : '#f8f4ec');
  }
  function set(value) {
    if (!valid(value)) return;
    selected = value;
    try { localStorage.setItem(key, value); } catch (_) {}
    apply();
    window.dispatchEvent(new CustomEvent('worldview-appearance', {detail:value}));
  }
  window.WorldviewAppearance = { set, choice: () => selected };
  apply();
  document.addEventListener('DOMContentLoaded', () => {
    apply();
    document.getElementById('theme-toggle')?.addEventListener('click', () => set(document.documentElement.dataset.appearance === 'dark' ? 'light' : 'dark'));
    // A modal dialog makes the rest of the document inert, regardless of z-index.
    // Keep this same device control inside the active account dialog while signing in.
    const dialog = document.getElementById('account-dialog');
    if (dialog) {
      const sync = () => {
        const button = document.getElementById('theme-toggle');
        const parent = dialog.open ? dialog : document.body;
        if (button && button.parentElement !== parent) parent.append(button);
      };
      new MutationObserver(sync).observe(dialog, {attributes:true, attributeFilter:['open']});
      sync();
    }
  });
  system.addEventListener('change', apply);
  window.addEventListener('storage', event => {
    if (event.key !== key) return;
    selected = valid(event.newValue) ? event.newValue : 'system';
    apply();
    window.dispatchEvent(new CustomEvent('worldview-appearance', {detail:selected}));
  });
})();
