(function () {
  // if you want to gate on localStorage again, you can re-enable this:
  // const STORAGE_KEY = "rm_tour_done_v8";
  // const params = new URLSearchParams(window.location.search);
  // const forceTour = params.get("tour") === "1";
  // if (!forceTour && localStorage.getItem(STORAGE_KEY) === "1") return;

  const steps = [
    {
      id: "country",
      title: "Step 1 · Select a country",
      text:
        "First, pick a country from this menu to load its baseline election results and settings.",
      selector: '.dropdown[data-dropdown="country"]'
    },
    {
      id: "controls",
      title: "Step 2 · Adjust the controls",
      text:
        "Change the threshold, formula and district magnitude to explore how different rules reshape parties’ seat shares.",
      selector: ".control-panel .control-card"
    },
    {
      id: "compare",
      title: "Step 3 · Optional compare mode",
      text:
        "Turn on Compare to keep the baseline visible, so you can contrast your new scenario against the original.",
      selector: ".compare-control"
    },
    {
      id: "apply",
      title: "Step 4 · Apply your scenario",
      text:
        "Click Apply when ready to update the map and metrics with your chosen settings.",
      selector: ".action.apply, #applyBtn, [data-action='apply']"
    }
  ];

  let current = 0;
  let overlay, backdrop, card, titleEl, textEl, stepEl, skipBtn, nextBtn;
  let highlightedEl = null;
  let toast = null;
  let toastTimer = null;
  let blockClickHandler = null;
  let initialScrollY = 0;

  function lockScroll () {}
  function unlockScroll () {}

  /* element wiring */
  function cacheElements () {
    overlay = document.querySelector(".rm-tour-overlay");
    if (!overlay) return false;

    backdrop = overlay.querySelector(".rm-tour-backdrop");
    card = overlay.querySelector(".rm-tour-card");
    titleEl = overlay.querySelector(".rm-tour-title");
    textEl = overlay.querySelector(".rm-tour-text");
    stepEl = overlay.querySelector(".rm-tour-step");
    skipBtn = overlay.querySelector("[data-tour-skip]");
    nextBtn = overlay.querySelector("[data-tour-next]");

    if (!card || !titleEl || !textEl || !stepEl || !skipBtn || !nextBtn) {
      return false;
    }

    // detach the card from overlay so it can float above everything
    if (!card.dataset.rmDetached) {
      card.dataset.rmDetached = "1";
      document.body.appendChild(card);
    }

    // create / grab toast
    toast = overlay.querySelector(".rm-tour-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.className = "rm-tour-toast";
      toast.innerHTML =
        '<span>Finish or skip the tour to interact with controls.</span>';
      overlay.appendChild(toast);
    }

    skipBtn.addEventListener("click", () => finishTour(true));
    nextBtn.addEventListener("click", advanceStep);

    overlay.addEventListener("click", (e) => {
      if (e.target === backdrop) finishTour(true);
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") finishTour(true);
    });

    window.addEventListener("resize", repositionCard, { passive: true });
    window.addEventListener(
      "scroll",
      () => {
        if (!isVisible()) return;
        repositionCard();
      },
      { passive: true, capture: true }
    );

    // global click blocker: allow tour UI, block everything else while visible
    blockClickHandler = function (e) {
      if (!isVisible() || !overlay) return;

      const clickedInsideOverlay = overlay.contains(e.target);
      const clickedInsideCard = card && card.contains(e.target);

      if (clickedInsideOverlay || clickedInsideCard) {
        // clicks on card / skip / next / backdrop behave as normal
        return;
      }

      e.preventDefault();
      e.stopPropagation();
      showToast();
    };
    document.addEventListener("click", blockClickHandler, true);

    return true;
  }

  function isVisible () {
    return !!overlay && !overlay.classList.contains("rm-tour-overlay--hidden");
  }

  function showOverlay () {
    if (!overlay) return;
    overlay.classList.remove("rm-tour-overlay--hidden");
    lockScroll();
  }

  function hideOverlaySoft () {
    if (!overlay) return;
    overlay.classList.add("rm-tour-overlay--hidden");
    clearHighlight();
    unlockScroll();
  }

  function clearHighlight () {
    if (highlightedEl) {
      highlightedEl.classList.remove("rm-tour-highlight");
      highlightedEl = null;
    }
    document
      .querySelectorAll(".rm-tour-highlight")
      .forEach((el) => el.classList.remove("rm-tour-highlight"));
  }

  function getTarget (selector) {
    if (!selector) return null;
    return document.querySelector(selector);
  }

  /* toast */
  function showToast () {
    if (!toast) return;
    toast.classList.add("rm-tour-toast--visible");
    if (toastTimer) {
      clearTimeout(toastTimer);
    }
    toastTimer = setTimeout(() => {
      toast.classList.remove("rm-tour-toast--visible");
    }, 1800);
  }

  /* scroll + highlight + card placement */
  function scrollToTarget (selector) {
    const el = getTarget(selector);
    if (!el) return;

    try {
      el.scrollIntoView({
        behavior: "auto",
        block: "center",
        inline: "nearest"
      });
    } catch {
      el.scrollIntoView();
    }

    // highlight + position on next frame so layout is settled
    requestAnimationFrame(() => {
      clearHighlight();
      el.classList.add("rm-tour-highlight");
      highlightedEl = el;
      repositionCard();
    });
  }

  function repositionCard () {
    if (!card || !isVisible()) return;

    const step = steps[current];
    if (!step) return;

    const target = getTarget(step.selector);
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const padding = 16;
    const gap = 20; // extra breathing room

    const cardRect = card.getBoundingClientRect();
    let cardW = cardRect.width || 360;
    let cardH = cardRect.height || 140;

    let top;
    let left;
    let position = "below"; // 'below' | 'above' | 'right' | 'left'

    if (target) {
      const r = target.getBoundingClientRect();

      const spaceBelow = viewportHeight - r.bottom - padding;
      const spaceAbove = r.top - padding;
      const spaceRight = viewportWidth - r.right - padding;
      const spaceLeft = r.left - padding;

      const prefersSide =
        r.width > cardW * 0.5 || step.id === "controls";

      if (
        prefersSide &&
        (spaceRight > cardW + gap || spaceLeft > cardW + gap)
      ) {
        position = spaceRight >= spaceLeft ? "right" : "left";
      } else {
        if (spaceBelow >= cardH + gap || spaceBelow >= spaceAbove) {
          position = "below";
        } else {
          position = "above";
        }
      }

      if (position === "right") {
        top = r.top + r.height / 2 - cardH / 2;
        left = r.right + gap;
      } else if (position === "left") {
        top = r.top + r.height / 2 - cardH / 2;
        left = r.left - cardW - gap;
      } else if (position === "above") {
        top = r.top - cardH - gap;
        left = r.left + r.width / 2 - cardW / 2;
      } else {
        top = r.bottom + gap;
        left = r.left + r.width / 2 - cardW / 2;
      }

      if (top < padding) top = padding;
      if (top + cardH > viewportHeight - padding) {
        top = viewportHeight - padding - cardH;
      }

      if (left < padding) left = padding;
      if (left + cardW > viewportWidth - padding) {
        left = viewportWidth - padding - cardW;
      }
    } else {
      top = viewportHeight - cardH - padding;
      left = (viewportWidth - cardW) / 2;
      position = "below";
    }

    card.style.top = `${top}px`;
    card.style.left = `${left}px`;
    card.style.transform = "translate3d(0, 0, 0)";

    card.classList.remove(
      "rm-tour-card--above",
      "rm-tour-card--below",
      "rm-tour-card--side-right",
      "rm-tour-card--side-left"
    );
    if (position === "right") {
      card.classList.add("rm-tour-card--side-right");
    } else if (position === "left") {
      card.classList.add("rm-tour-card--side-left");
    } else if (position === "above") {
      card.classList.add("rm-tour-card--above");
    } else {
      card.classList.add("rm-tour-card--below");
    }
  }

  /* step rendering */
  function renderStepImmediate (index) {
    const step = steps[index];
    if (!step || !titleEl || !textEl || !stepEl) return;

    current = index;

    const total = steps.length;
    stepEl.textContent = `Step ${index + 1} of ${total}`;
    titleEl.textContent = step.title;
    textEl.textContent = step.text;
    nextBtn.textContent = index === total - 1 ? "Finish" : "Next";

    scrollToTarget(step.selector);
  }

  function renderStep (index) {
    renderStepImmediate(index);
  }

  function animateToStep (index) {
    if (!card) {
      renderStepImmediate(index);
      return;
    }

    card.classList.add("rm-tour-card--exit");

    const exitDur = 180;
    window.setTimeout(() => {
      card.classList.remove("rm-tour-card--exit");

      renderStepImmediate(index);

      card.classList.add("rm-tour-card--enter");
      window.setTimeout(() => {
        card.classList.remove("rm-tour-card--enter");
      }, 220);
    }, exitDur);
  }

  function advanceStep () {
    const next = current + 1;
    if (next >= steps.length) {
      finishTour(true);
      return;
    }
    animateToStep(next);
  }

  /* teardown */
  function finishTour (persist) {
    hideOverlaySoft();

    if (blockClickHandler) {
      document.removeEventListener("click", blockClickHandler, true);
      blockClickHandler = null;
    }

    if (toastTimer) {
      clearTimeout(toastTimer);
      toastTimer = null;
    }

    // smooth scroll back to where the user started the tour
    try {
      window.scrollTo({
        top: initialScrollY,
        behavior: "smooth"
      });
    } catch {
      window.scrollTo(0, initialScrollY);
    }

    // remove overlay and card from DOM so nothing blocks clicks
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
      overlay = null;
    }
    if (card && card.parentNode) {
      card.parentNode.removeChild(card);
      card = null;
    }

    if (persist) {
      try {
        localStorage.setItem("rm_tour_done_v8", "1");
      } catch (_) {}
    }
  }

  /* entrypoint */
  function startTour () {
    if (!cacheElements()) return;
    initialScrollY = window.scrollY || window.pageYOffset || 0;
    current = 0;
    renderStep(current);
    showOverlay();
    window.setTimeout(repositionCard, 50);
  }

  window.RuleTour = {
    start: startTour,
    finish: () => finishTour(true)
  };

  window.setTimeout(startTour, 600);
})();
