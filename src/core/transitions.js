export function createSceneTransition(root, reducedMotion = false) {
  let generation = 0; let swapTimer = null; let revealTimer = null; let pendingResolve = null;

  function cancel() {
    generation += 1; clearTimeout(swapTimer); clearTimeout(revealTimer);
    pendingResolve?.(null); pendingResolve = null;
  }

  function swap(markup, { immediate = false, duration = 400 } = {}) {
    cancel(); const ticket = generation; const current = root.querySelector(":scope > section");
    return new Promise((resolve) => {
      pendingResolve = resolve;
      const mount = () => {
        if (ticket !== generation) return;
        const template = document.createElement("template"); template.innerHTML = markup.trim();
        const next = template.content.firstElementChild;
        if (!next) { pendingResolve = null; resolve(null); return; }
        if (current?.isConnected) current.replaceWith(next); else root.append(next);
        if (!reducedMotion && !immediate) {
          next.classList.add("scene-entering");
          requestAnimationFrame(() => requestAnimationFrame(() => next.classList.add("is-visible")));
          revealTimer = setTimeout(() => next.classList.remove("scene-entering", "is-visible"), 900);
        }
        pendingResolve = null; resolve(next);
      };
      if (current && !reducedMotion && !immediate) {
        current.classList.add("scene-leaving"); swapTimer = setTimeout(mount, duration);
      } else mount();
    });
  }

  return { swap, cancel };
}
