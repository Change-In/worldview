/* NAV-156: lift the loading screen once Home is ready. For a signed-in account
   that means: the account check has finished and the saved lessons have been
   fetched once. Never longer than 3.2 seconds; never at all for someone who is
   signed out or new (they see Home or the welcome straight away). Reads the
   app's own state; changes nothing. Loaded at the end of index.html. */
(() => {
  'use strict';
  const el = document.getElementById('boot-splash');
  if (!el) return;
  const read = f => { try { return f(); } catch (e) { return undefined; } };
  const remembered = String(read(() => typeof rememberedAccountAtBoot !== 'undefined' ? rememberedAccountAtBoot : '') || '');
  const start = performance.now(), MIN = 300, CAP = 3200;
  let sawRefresh = false, verifiedAt = 0, timer = 0;
  function lift() { clearInterval(timer); el.classList.add('out'); setTimeout(() => el.remove(), 400); }
  function ready() {
    if (!remembered) return true;
    const status = String(read(() => identityRestoreStatus) || '');
    if (status === 'signed-out' || status === 'offline') return true;
    if (status !== 'verified' || !read(() => accountOwnershipResolved)) return false;
    if (!verifiedAt) verifiedAt = performance.now();
    const refreshing = !!read(() => homeLearnerRefreshOwner);
    if (refreshing) sawRefresh = true;
    // Saved lessons load right after the account check. If no fetch starts
    // (an account without lesson access), don't wait for one.
    if (!sawRefresh) return performance.now() - verifiedAt > 900;
    return !refreshing;
  }
  timer = setInterval(() => {
    const t = performance.now() - start;
    if (t > CAP || (t > MIN && ready())) lift();
  }, 60);
})();
