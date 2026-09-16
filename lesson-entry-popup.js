/* Entry preparation only: the caller still verifies identity and access before launch. */
(() => {
  let pending = null, microphonePending = null;
  const setAudioSession = type => { try { if (navigator.audioSession) navigator.audioSession.type = type; } catch {} };
  window.WorldviewLessonEntry = {
    choose({ title = "Your lesson", saved = false } = {}) {
      if (pending) return pending.promise;
      const previousFocus = document.activeElement;
      const dialog = document.createElement("dialog");
      dialog.id = "home-lesson-entry";
      dialog.setAttribute("aria-labelledby", "home-entry-title");
      dialog.setAttribute("aria-describedby", "home-entry-hint");
      dialog.innerHTML = `<button class="entry-close" type="button" aria-label="Close">×</button>
        <p class="entry-topic"></p><h2 id="home-entry-title">How would you like<br>to learn?</h2>
        <p id="home-entry-hint" class="entry-hint">You can switch during your lesson.</p>
        <div class="entry-options" role="group" aria-label="Lesson mode">
          <button class="entry-mode" data-mode="text" type="button" aria-pressed="false"><strong>Text</strong><span>Read and type</span></button>
          <div role="group" aria-label="Voice options"><button class="entry-mode" data-mode="voice" type="button" aria-pressed="false"><strong>Voice</strong><span>Listen and talk</span></button>
          <button class="entry-mode entry-car" data-mode="car" type="button" aria-pressed="false">Car · larger voice controls</button></div>
        </div><button class="entry-continue" type="button" disabled></button>`;
      dialog.querySelector(".entry-topic").textContent = title;
      const next = dialog.querySelector(".entry-continue");
      next.textContent = saved ? "Continue lesson" : "Start lesson";
      let resolve, mode = "";
      const promise = new Promise(done => { resolve = done; });
      const finish = choice => {
        if (pending?.dialog !== dialog) return;
        pending = null;
        dialog.close(); dialog.remove();
        previousFocus?.focus?.({ preventScroll:true });
        resolve(choice);
      };
      pending = { promise, dialog };
      dialog.querySelector(".entry-close").onclick = () => finish("");
      dialog.addEventListener("cancel", event => { event.preventDefault(); finish(""); });
      dialog.addEventListener("click", event => {
        if (event.target !== dialog) return;
        const box = dialog.getBoundingClientRect();
        if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) finish("");
      });
      for (const button of dialog.querySelectorAll("[data-mode]")) button.onclick = () => {
        mode = button.dataset.mode;
        for (const option of dialog.querySelectorAll("[data-mode]")) option.setAttribute("aria-pressed", String(option === button));
        next.disabled = false;
      };
      next.onclick = () => { if (mode) finish(mode); };
      document.body.append(dialog); dialog.showModal();
      return promise;
    },
    prepareMicrophone() {
      if (microphonePending) return microphonePending.promise;
      const previousFocus = document.activeElement;
      previousFocus?.blur?.();
      const dialog = document.createElement("dialog");
      dialog.id = "home-microphone-entry";
      dialog.setAttribute("aria-labelledby", "microphone-entry-title");
      dialog.setAttribute("aria-describedby", "microphone-entry-hint");
      dialog.innerHTML = `<button class="entry-close" type="button" aria-label="Close">×</button>
        <h2 id="microphone-entry-title">Ready to talk?</h2>
        <p id="microphone-entry-hint" class="entry-hint">Allow microphone access before entering Voice. If your phone asks, choose Allow. Then you can say what you want to learn.</p>
        <p class="entry-permission-status" role="status" aria-live="polite"></p>
        <button class="entry-continue" type="button">Allow microphone</button>
        <button class="entry-cancel" type="button">Not now</button>`;
      const allow = dialog.querySelector(".entry-continue"), status = dialog.querySelector(".entry-permission-status");
      let resolve, busy = false;
      const promise = new Promise(done => { resolve = done; });
      const current = { promise, dialog };
      const finish = allowed => {
        if (microphonePending !== current) return;
        microphonePending = null;
        if (!allowed) setAudioSession("auto");
        dialog.close(); dialog.remove();
        if (!allowed) previousFocus?.focus?.({ preventScroll:true });
        resolve(allowed);
      };
      microphonePending = current;
      dialog.querySelector(".entry-close").onclick = () => finish(false);
      dialog.querySelector(".entry-cancel").onclick = () => finish(false);
      dialog.addEventListener("cancel", event => { event.preventDefault(); finish(false); });
      allow.onclick = async () => {
        if (busy || microphonePending !== current) return;
        if (!navigator.mediaDevices?.getUserMedia) {
          status.textContent = "Microphone access is unavailable in this browser. Close this window and choose Text.";
          return;
        }
        busy = true; allow.disabled = true;
        status.textContent = "Waiting for microphone permission. Take your time; your lesson has not started.";
        try {
          setAudioSession("play-and-record");
          let stream;
          try { stream = await navigator.mediaDevices.getUserMedia({audio:true}); }
          catch (error) {
            if (!/AudioSession category/i.test(error.message || "") || microphonePending !== current) throw error;
            setAudioSession("auto"); setAudioSession("play-and-record");
            stream = await navigator.mediaDevices.getUserMedia({audio:true});
          }
          // Navigation cannot transfer a MediaStream. Release even a late grant
          // after cancellation; the lesson acquires its own granted microphone.
          stream.getTracks().forEach(track => track.stop());
          if (microphonePending === current) { setAudioSession("auto"); finish(true); }
        } catch (error) {
          if (microphonePending !== current) return;
          setAudioSession("auto");
          busy = false; allow.disabled = false; allow.textContent = "Try microphone again";
          status.textContent = error.name === "NotAllowedError"
            ? "Microphone access was not allowed. Allow it in this site's browser settings, then try again, or close and choose Text."
            : "The microphone could not open. Check its access and try again, or close and choose Text.";
        }
      };
      document.body.append(dialog); dialog.showModal();
      return promise;
    },
    cancel() { pending?.dialog.querySelector(".entry-close").click(); microphonePending?.dialog.querySelector(".entry-close").click(); }
  };
})();
