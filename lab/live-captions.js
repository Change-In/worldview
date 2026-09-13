/* Live transcription was retired in v2.1.21. Keep old cached pages inert. */
(() => {
  window.WorldviewLiveCaptions?.stop?.();
  const stop = () => {
    for (const id of ['mock-live-words-panel', 'mock-live-words-toggle']) {
      document.getElementById(id)?.setAttribute('hidden', '');
    }
  };
  window.WorldviewLiveCaptions = Object.freeze({begin:stop, stop});
  stop();
})();
