/* Presentation only: the caller still verifies identity and access before launch. */
(() => {
  let pending = null;
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
    cancel() { pending?.dialog.querySelector(".entry-close").click(); }
  };
})();
