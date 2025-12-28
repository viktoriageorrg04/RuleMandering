(function () {
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
      // selector: '.dropdown[data-dropdown="country"]'
      selector: '.dropdown-toggle'
    },
    {
      id: "controls",
      title: "Step 2 · Adjust the controls",
      text:
        "Change the threshold, formula and district magnitude to explore how different rules reshape parties’ seat shares.",
      selector: ".control-panel .control-card"
    },
    {
      id: "methods",
      title: "Step 3 · Understand the methods",
      text:
        "Review the mathematical formulas used to calculate seat bonuses, wasted votes, and disproportionality metrics.",
      selector: ".methods-card"
    },
    {
      id: "apply",
      title: "Step 3 · Apply your scenario",
      text:
        "Click Apply when ready to update the map and metrics with your chosen settings.",
      // selector: ".action.apply, #applyBtn, [data-action='apply']"
      selector: ".action.apply, #applyBtn, [data-action='apply']"
    }
  ];

  let current = 0;
  let overlay, backdrop, card, titleEl, textEl, stepEl, skipBtn, nextBtn;
  let highlightedEl = null;
  let toast = null;
  let toastTimer = null;
  let blockClickHandler = null;
  let blockPointerHandler = null;
  let blockKeyHandler = null;
  let scrollBlockHandler = null;
  let keyBlockHandler = null;
  let initialScrollY = 0;
  let methodsCardWasCollapsed = false;

  // function lockScroll () {}
  // function unlockScroll () {}

  function lockScroll () {
    scrollBlockHandler = function(e) {
      e.preventDefault();
      e.stopPropagation();
    };
    
    keyBlockHandler = function(e) {
      if ([32, 33, 34, 35, 36, 37, 38, 39, 40].indexOf(e.keyCode) > -1) {
        e.preventDefault();
      }
    };
    
    window.addEventListener('wheel', scrollBlockHandler, { passive: false });
    window.addEventListener('touchmove', scrollBlockHandler, { passive: false });
    window.addEventListener('keydown', keyBlockHandler, false);
 }
 
 function unlockScroll () {
    if (scrollBlockHandler) {
      window.removeEventListener('wheel', scrollBlockHandler);
      window.removeEventListener('touchmove', scrollBlockHandler);
    }
    if (keyBlockHandler) {
      window.removeEventListener('keydown', keyBlockHandler);
    }
 }

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

    function shouldBlockControls(e) {
      if (!isVisible()) return false;
      const step = steps[current];
      if (!step || step.id !== "controls") return false;
      const clickedInsideOverlay = overlay.contains(e.target);
      const clickedInsideCard = card && card.contains(e.target);
      if (clickedInsideOverlay || clickedInsideCard) return false;
      return !!(e.target.closest && e.target.closest(".control-panel"));
    }

    blockPointerHandler = function (e) {
      if (!shouldBlockControls(e)) return;
      e.preventDefault();
      e.stopPropagation();
      showToast();
    };
    blockKeyHandler = function (e) {
      if (!isVisible()) return;
      const step = steps[current];
      if (!step || step.id !== "controls") return;
      const active = document.activeElement;
      if (active && active.closest && active.closest(".control-panel")) {
        e.preventDefault();
        e.stopPropagation();
        showToast();
      }
    };

    document.addEventListener("pointerdown", blockPointerHandler, true);
    document.addEventListener("mousedown", blockPointerHandler, true);
    document.addEventListener("touchstart", blockPointerHandler, true);
    document.addEventListener("keydown", blockKeyHandler, true);

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

  /* expand methods card if we're on that step */
  function handleMethodsCard(stepId) {
    const methodsCard = document.querySelector('.methods-card');
    if (!methodsCard) return;
 
    if (stepId === 'methods') {
      methodsCardWasCollapsed = methodsCard.classList.contains('is-collapsed');
      
      if (methodsCardWasCollapsed) {
        const toggle = methodsCard.querySelector('.collapse-toggle');
        const body = methodsCard.querySelector('.methods-body');
        
        methodsCard.classList.remove('is-collapsed');
        toggle?.setAttribute('aria-expanded', 'true');
        
        if (body) {
          body.style.display = '';
          const full = body.scrollHeight + 'px';
          body.style.height = '0px';
          body.style.opacity = '0';
          
          requestAnimationFrame(() => {
            body.style.transition = 'height .34s cubic-bezier(.2,.9,.2,1), opacity .18s ease';
            body.style.height = full;
            body.style.opacity = '1';
          });
          
          function done(e) {
            if (e.propertyName === 'height') {
              body.style.height = 'auto';
              body.removeEventListener('transitionend', done);
            }
          }
          body.addEventListener('transitionend', done);
        }
      }
    }
  }

  /* scroll + highlight + card placement */
  function scrollToTarget (selector) {
    const el = getTarget(selector);
    if (!el) return;

    try {
      el.scrollIntoView({
        behavior: "auto",
        block: "center",
        // block: selector === '.methods-card' ? "start" : "center",
        inline: "nearest"
      });   

      // add top margin for methods card to center it better
      if (selector === '.methods-card') {
        // window.scrollBy(0, 300);
        const rect = el.getBoundingClientRect();
        const offset = (window.innerHeight * 0.85) - (rect.height / 2) - rect.top;
        window.scrollBy(0, offset);
      }
    } catch {
      el.scrollIntoView();
    }

    // highlight + position on next frame so layout is settled
    // const delay = selector === '.methods-card' ? 450 : 100;
    // setTimeout(() => {
    //   requestAnimationFrame(() => {
    //     clearHighlight();
    //     el.classList.add("rm-tour-highlight");
    //     highlightedEl = el;
    //     repositionCard();
    //   });
    // }, delay);
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
        // r.width > cardW * 0.5 || step.id === "controls";
        r.width > cardW * 0.5 || step.id === "controls" || step.id === "methods";

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
    if (step.id === "controls") {
      const active = document.activeElement;
      if (active && active.closest && active.closest(".control-panel")) {
        try { active.blur(); } catch (e) {}
      }
    }

    const total = steps.length;
    stepEl.textContent = `Step ${index + 1} of ${total}`;
    titleEl.textContent = step.title;
    textEl.textContent = step.text;
    nextBtn.textContent = index === total - 1 ? "Finish" : "Next";

    handleMethodsCard(step.id);
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

    // restore methods card to original state if needed
    if (methodsCardWasCollapsed) {
      const methodsCard = document.querySelector('.methods-card');
      if (methodsCard) {
        const toggle = methodsCard.querySelector('.collapse-toggle');
        const body = methodsCard.querySelector('.methods-body');
        
        methodsCard.classList.add('is-collapsed');
        toggle?.setAttribute('aria-expanded', 'false');
        
        if (body) {
          body.style.height = body.scrollHeight + 'px';
          requestAnimationFrame(() => {
            body.style.transition = 'height .28s cubic-bezier(.2,.9,.2,1), opacity .14s ease';
            body.style.height = '0px';
            body.style.opacity = '0';
          });
          
          function done(e) {
            if (e.propertyName === 'height') {
              body.style.display = 'none';
              body.removeEventListener('transitionend', done);
            }
          }
          body.addEventListener('transitionend', done);
        }
      }
    }

    if (blockClickHandler) {
      document.removeEventListener("click", blockClickHandler, true);
      blockClickHandler = null;
    }
    if (blockPointerHandler) {
      document.removeEventListener("pointerdown", blockPointerHandler, true);
      document.removeEventListener("mousedown", blockPointerHandler, true);
      document.removeEventListener("touchstart", blockPointerHandler, true);
      blockPointerHandler = null;
    }
    if (blockKeyHandler) {
      document.removeEventListener("keydown", blockKeyHandler, true);
      blockKeyHandler = null;
    }

    if (toastTimer) {
      clearTimeout(toastTimer);
      toastTimer = null;
    }

    // // smooth scroll back to where the user started the tour
    // try {
    //   window.scrollTo({
    //     top: initialScrollY,
    //     behavior: "smooth"
    //   });
    // } catch {
    //   window.scrollTo(0, initialScrollY);
    // }

    // smooth scroll back to the top when the tour finishes
    try {
      window.scrollTo({
        top: 0,
        behavior: "smooth"
      });
    } catch {
      window.scrollTo(0, 0);
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
