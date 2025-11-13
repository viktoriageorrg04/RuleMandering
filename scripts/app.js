document.addEventListener('DOMContentLoaded', () => {
  // ---------- sliders / radios / reset ----------
  const sliders = Array.from(document.querySelectorAll('.slider-row input[type="range"], .range input[type="range"]'));
  const radios  = Array.from(document.querySelectorAll('input[type="radio"]'));

  const resetBtn = document.querySelector('.toolbar .reset, [data-action="reset"], .control-panel .reset, button.reset');
  let   applyBtn = document.querySelector('.toolbar .apply, [data-action="apply"], .control-panel .apply, button.apply')
           || Array.from(document.querySelectorAll('button, .btn')).find(b => (b.textContent||'').trim().toLowerCase()==='apply');

  // View Results pill (FAB)
  const viewFab = document.querySelector('.fab-to-results');

  (function injectFabStyles(){
    const css = `
      .fab-to-results{
        position: fixed;
        left: 50%;
        bottom: max(22px, env(safe-area-inset-bottom, 0px) + 12px);
        transform: translateX(-50%) translateY(0);
        z-index: 1400;
        display: inline-flex;
        align-items: center;
        gap: .45rem;
        white-space: nowrap;
        padding: .55rem 1.05rem;
        border-radius: 28px;
        background: var(--blue-900, #3b5bd8);
        color: #fff;
        box-shadow: 0 8px 24px rgba(46,61,88,0.12);
        cursor: pointer;
        transition: transform .18s ease, opacity .22s ease, visibility .22s ease;
        will-change: transform, opacity;
      }
      .fab-to-results.is-hidden{
        opacity: 0;
        visibility: hidden;
        pointer-events: none;
        transform: translateX(-50%) translateY(8px);
      }
      .fab-to-results.is-bounce{
        animation: fab-bounce .9s ease-in-out 1;
      }
      @keyframes fab-bounce{
        0%,100%{ transform: translateX(-50%) translateY(0); }
        35%   { transform: translateX(-50%) translateY(-8px); }
        70%   { transform: translateX(-50%) translateY(-4px); }
      }
      /* Slightly higher on very wide layouts so it doesn't overlap content shadow */
      @media (min-width:1400px){
        .fab-to-results{ bottom: 40px; }
      }
    `;
    const s=document.createElement('style'); s.textContent=css; document.head.appendChild(s);
  })();

  // hide FAB until the first real Apply
  viewFab?.classList.add('is-hidden');

  const initialSliderValue = new WeakMap();
  sliders.forEach(input => {
    const valueEl = input.parentElement.querySelector('.value');
    const upd = () => { if (valueEl) valueEl.textContent = `${input.value}%`; };
    upd(); input.addEventListener('input', upd); input.addEventListener('change', upd);
    initialSliderValue.set(input, input.value);
  });

  const radioGroupDefault = new Map();
  radios.forEach(r => {
    const name = r.name || ('__g'+Math.random());
    if (!radioGroupDefault.has(name)) radioGroupDefault.set(name, null);
    if (r.checked && radioGroupDefault.get(name) === null) radioGroupDefault.set(name, r);
    if (radioGroupDefault.get(name) === null) radioGroupDefault.set(name, radios.find(x => x.name === name));
  });

  resetBtn?.addEventListener('click', () => {
    // hard refresh keeps everything in a clean base state
    window.location.reload();
  });

  // ---------- dropdowns ----------
  const Dropdowns = (() => {
    const instances = new Map();

    function closeAll(except = null) {
      instances.forEach((inst, el) => {
        if (except && el === except) return;
        inst.close();
      });
    }

    function setLabel(toggle, text) {
      const l = toggle.querySelector('.dropdown-label');
      if (l) l.textContent = text; else toggle.textContent = `${text} ▾`;
    }

    // helpers to animate a menu element
    function expandMenu(el) {
      if (!el) return;
      el.style.display = '';
      const full = el.scrollHeight + 'px';
      el.style.height = '0px';
      el.style.opacity = '0';
      requestAnimationFrame(() => {
        el.style.transition = 'height .28s cubic-bezier(.2,.9,.2,1), opacity .18s ease';
        el.style.height = full;
        el.style.opacity = '1';
      });
      const onEnd = (e) => {
        if (e.propertyName === 'height') {
          el.removeEventListener('transitionend', onEnd);
          el.style.height = 'auto';
          el.style.transition = '';
        }
      };
      el.addEventListener('transitionend', onEnd);
    }

    function collapseMenu(el, cb) {
      if (!el) { if (cb) cb(); return; }
      // from auto -> explicit px so transition works
      el.style.height = el.scrollHeight + 'px';
      el.style.opacity = '1';
      requestAnimationFrame(() => {
        el.style.transition = 'height .22s cubic-bezier(.2,.9,.2,1), opacity .14s ease';
        el.style.height = '0px';
        el.style.opacity = '0';
      });
      const onEnd = (e) => {
        if (e.propertyName === 'height') {
          el.removeEventListener('transitionend', onEnd);
          el.style.display = 'none';
          el.style.transition = '';
          if (typeof cb === 'function') cb();
        }
      };
      el.addEventListener('transitionend', onEnd);
    }

    function wire(rootEl, items = [], { enableSearch = false } = {}) {
      const t = rootEl.querySelector('.dropdown-toggle');
      const m = rootEl.querySelector('.dropdown-menu');
      const list = rootEl.querySelector('.dropdown-list');
      const search = rootEl.querySelector('.dropdown-search');

      if (list && items.length) {
        list.innerHTML = '';
        items.forEach(name => {
          const it = document.createElement('div');
          it.className = 'item';
          it.tabIndex = 0;
          it.dataset.value = name;
          it.textContent = name;
          list.appendChild(it);
        });
      }

      const open = () => {
        closeAll(rootEl);
        rootEl.setAttribute('data-opening', '1');
        window.__dropdownOpening = true;
        setTimeout(() => {
          rootEl.removeAttribute('data-opening');
          window.__dropdownOpening = false;
        }, 180);
        rootEl.classList.add('open');
        t.setAttribute('aria-expanded', 'true');
        if (m) {
          expandMenu(m);
          // try { m.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
        }
      };

      const close = () => {
        // animate then remove "open" class when done
        if (m) {
          collapseMenu(m, () => {
            rootEl.classList.remove('open');
            t.setAttribute('aria-expanded', 'false');
          });
        } else {
          rootEl.classList.remove('open');
          t.setAttribute('aria-expanded', 'false');
        }
      };

      // register instance so closeAll can call close()
      instances.set(rootEl, { close });

      t.addEventListener('click', e => {
        e.stopPropagation();
        const willOpen = !rootEl.classList.contains('open');
        if (willOpen) open(); else close();
      });

      m?.addEventListener('click', e => e.stopPropagation());

      list?.addEventListener('click', ev => {
        const it = ev.target.closest('.item'); if (!it) return;
        setLabel(t, it.dataset.value);
        list.querySelectorAll('.item[aria-selected="true"]').forEach(x => x.setAttribute('aria-selected', 'false'));
        it.setAttribute('aria-selected', 'true');
        // close dropdown smoothly
        close();
        // blur focused element
        try { if (document.activeElement && typeof document.activeElement.blur === 'function') document.activeElement.blur(); } catch (e) {}
        requestAnimationFrame(() => closeAll());
        rootEl.dispatchEvent(new CustomEvent('dropdown-change', { detail: { value: it.dataset.value } }));
      });

      list?.addEventListener('keydown', ev => {
        const a = document.activeElement;
        if (ev.key === 'ArrowDown') { ev.preventDefault(); (a.nextElementSibling || a).focus(); }
        if (ev.key === 'ArrowUp') { ev.preventDefault(); (a.previousElementSibling || a).focus(); }
        if (ev.key === 'Enter') { ev.preventDefault(); a.click(); }
        if (ev.key === 'Escape') { closeAll(); t.focus(); }
      });

      if (enableSearch && search && list) {
        search.addEventListener('input', () => {
          const q = search.value.trim().toLowerCase();
          Array.from(list.children).forEach(it => it.style.display = (!q || it.textContent.toLowerCase().includes(q)) ? '' : 'none');
        });
      }

      if (m) {
        if (!rootEl.classList.contains('open')) {
          m.style.display = 'none';
          m.style.height = '0px';
          m.style.opacity = '0';
        } else {
          m.style.display = '';
          m.style.height = 'auto';
          m.style.opacity = '1';
        }
      }

      return { close };
    }

    return { wire, closeAll };
  })();

  // attach dropdowns
  const euCountries = [
    "Austria","Belgium","Bulgaria","Croatia","Cyprus","Czechia",
    "Denmark","Estonia","Finland","France","Germany","Greece","Hungary","Ireland",
    "Italy","Latvia","Lithuania","Luxembourg","Malta","Netherlands","Poland",
    "Portugal","Romania","Slovakia","Slovenia","Spain","Sweden"
  ].sort((a,b)=>a.localeCompare(b));
  // const scenarios = ["Baseline","High turnout","Low turnout","Fragmented parties"].sort();

  const countryDD  = document.querySelector('.select-control.pill .dropdown[data-dropdown="country"]');
  // const scenarioDD = document.querySelector('.select-control.pill .dropdown[data-dropdown="scenario"]');
  countryDD && Dropdowns.wire(countryDD,  euCountries, { enableSearch:true  });
  // scenarioDD && Dropdowns.wire(scenarioDD, scenarios,   { enableSearch:false });

  // ---------- legend render (only on Apply) ----------
  const sliderEls = Array.from(document.querySelectorAll('.control-card .slider-row input'));
  const thresholdSlider = sliderEls[0] || null;
  const dmSlider        = sliderEls[1] || null;

  const getTxt = (sel, def='') => document.querySelector(sel)?.textContent?.trim() || def;
  const currentCountry  = () => getTxt('.dropdown[data-dropdown="country"] .dropdown-label', 'Country');
  // const currentScenario = () => getTxt('.dropdown[data-dropdown="scenario"] .dropdown-label', '');
  function currentFormula(){
    const c = document.querySelector('label.formula input[type="radio"]:checked');
    const l = c?.closest('label.formula')?.querySelector('.text')?.textContent?.trim();
    return l || 'Formula';
  }
  function currentDmMode(){
    const m = document.querySelector('input[name="dm-mode"]:checked');
    const lbl = m ? document.querySelector(`label[for="${m.id}"]`) : null;
    return lbl ? lbl.textContent.trim() : '';
  }
  const dmMagnitudeValue = () => Math.max(1, Math.round(Number(dmSlider?.value||0)) + 2);

  function readState(){
    const thr = thresholdSlider ? Number(thresholdSlider.value) : 0;
    return {
      country:  currentCountry(),
      // scenario: currentScenario(),
      threshold: thr,
      formula:  currentFormula(),
      dmMode:   currentDmMode(),
      dmMag:    dmMagnitudeValue()
    };
  }
  function renderLegend(s){
    const meta = document.querySelector('.map-meta');
    const intro = document.querySelector('.legend-intro');
    if (meta){
      const parts = [
        s.country,
        `<span class="meta-accent">Threshold ${s.threshold}%</span>`,
        s.formula,
        `District magnitude ${s.dmMag}${s.dmMode?` (${s.dmMode})`:''}`
      ];
      // if (s.scenario && s.scenario !== 'Scenario') parts.splice(1,0,s.scenario);
      meta.innerHTML = parts.join(' → ');
      meta.style.fontSize = '0.95rem';
    }
    if (intro){
      intro.textContent = `Seats shifted once the threshold rose to ${s.threshold}%. Districts with smaller magnitudes (≈ ${s.dmMag}) are more volatile.`;
    }
  }

  const jumpToResults = () => document.querySelector('#results')?.scrollIntoView({behavior:'smooth', block:'start'});

  function showFabAttention(){
    if (!viewFab) return;
    viewFab.classList.remove('is-hidden');
    viewFab.classList.remove('is-bounce'); void viewFab.offsetWidth;
    viewFab.classList.add('is-bounce');
  }

  // scroll helper: jump a bit further past the top of #results
  function scrollToResults(offset = 140, delay = 80){
    const el = document.querySelector('#results');
    if (!el) return;
    setTimeout(() => {
      const top = el.getBoundingClientRect().top + window.scrollY + offset;
      window.scrollTo({ top, behavior: 'smooth' });
    }, delay);
  }

  // FAB click: hide FAB and scroll further down to results
  viewFab?.addEventListener('click', (e) => {
    e.preventDefault();
    // hide FAB immediately
    viewFab.classList.add('is-hidden');
    try { viewFab.blur(); } catch (err) {}
    // scroll a bit further down for an extra reveal (tune offset/delay as needed)
    scrollToResults(140, 100);
  });
  function applyChanges({scroll=false, userTriggered=false}={}){
    const s = readState();
    renderLegend(s);

    // if (userTriggered) showFabAttention();
    if (userTriggered) setTimeout(showFabAttention, 260);
    if (applyBtn) applyBtn.blur();
    if (scroll && window.innerWidth < 1600) setTimeout(jumpToResults, 80);
  }

  // Apply button: render + reveal FAB with bounce
  // applyBtn?.addEventListener('click', (e)=>{ e.preventDefault(); applyChanges({scroll:true, userTriggered:true}); });
  applyBtn?.addEventListener('click', (e)=>{ e.preventDefault(); applyChanges({scroll:false, userTriggered:true}); });

  // close dropdowns when clicking outside / Esc
  // document.addEventListener('click', (e)=>{ if (!e.target.closest('.dropdown')) Dropdowns.closeAll(); });
  document.addEventListener('click', (e) => {
    if (window.__dropdownOpening) return;
    if (!e.target.closest('.dropdown')) Dropdowns.closeAll();
  });
  document.addEventListener('keydown', (e)=>{ if (e.key==='Escape') Dropdowns.closeAll(); });

  // initial legend render without revealing the FAB
  applyChanges({scroll:false, userTriggered:false});

  // ---------- methods accordion ----------
  const methodsCard = document.querySelector('.methods-card');
  if (methodsCard) {
    const toggle = methodsCard.querySelector('.collapse-toggle');
    const body = methodsCard.querySelector('.methods-body');

    // helper: animate open/close using explicit heights
    function expand(el){
      el.style.display = '';
      const full = el.scrollHeight + 'px';
      el.style.height = '0px';
      el.style.opacity = '0';
      // kick off transition on next frame
      requestAnimationFrame(() => {
        el.style.transition = 'height .34s cubic-bezier(.2,.9,.2,1), opacity .18s ease';
        el.style.height = full;
        el.style.opacity = '1';
      });
      function done(e){
        if (e.propertyName === 'height') {
          el.style.height = 'auto';
          el.removeEventListener('transitionend', done);
        }
      }
      el.addEventListener('transitionend', done);
    }

    function collapse(el){
      // from auto -> explicit px so transition works
      el.style.height = el.scrollHeight + 'px';
      // force a frame then set to 0
      requestAnimationFrame(() => {
        el.style.transition = 'height .28s cubic-bezier(.2,.9,.2,1), opacity .14s ease';
        el.style.height = '0px';
        el.style.opacity = '0';
      });
      function done(e){
        if (e.propertyName === 'height') {
          el.style.display = 'none';
          el.removeEventListener('transitionend', done);
        }
      }
      el.addEventListener('transitionend', done);
    }

    if (body) {
      if (methodsCard.classList.contains('is-collapsed')) {
        body.style.display = 'none';
        body.style.height = '0px';
        body.style.opacity = '0';
      } else {
        body.style.height = 'auto';
        body.style.opacity = '1';
      }
    }

    toggle?.addEventListener('click', (e) => {
      e.preventDefault();
      const expanded = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!expanded));
      methodsCard.classList.toggle('is-collapsed');

      if (!body) return;
      if (methodsCard.classList.contains('is-collapsed')) {
        collapse(body);
      } else {
        expand(body);
      }
    });
  }

  // Onboarding tutorial logic
  // (function setupOnboarding() {
  //   const tour = document.querySelector('#rm-tour');
  //   if (!tour) return;

  //   const storageKey = 'rm_tour_dismissed_v1';
  //   if (localStorage.getItem(storageKey) === '1') {
  //     tour.classList.add('is-hidden');
  //     return;
  //   }

  //   const skipButtons = tour.querySelectorAll('[data-tour-skip]');
  //   const nextButton  = tour.querySelector('[data-tour-next]');

  //   function closeTour(permanent) {
  //     tour.classList.add('is-hidden');
  //     if (permanent) localStorage.setItem(storageKey, '1');
  //   }

  //   skipButtons.forEach(btn =>
  //     btn.addEventListener('click', () => closeTour(true))
  //   );

  //   if (nextButton) {
  //     nextButton.addEventListener('click', () => {
  //       closeTour(true);
  //       // scroll to the controls so the explanation makes sense
  //       document
  //         .querySelector('.control-panel')
  //         ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  //     });
  //   }

  //   // show after a short delay so it does not clash with layout load
  //   setTimeout(() => {
  //     tour.classList.remove('is-hidden');
  //   }, 700);
  // })();
});
