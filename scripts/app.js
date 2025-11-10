// scripts/app.js — DROP-IN REPLACEMENT

document.addEventListener('DOMContentLoaded', () => {
  // ------------------- sliders + radios + reset (unchanged) -------------------
  const sliders = Array.from(document.querySelectorAll('.slider-row input[type="range"], .range input[type="range"]'));
  const radios = Array.from(document.querySelectorAll('input[type="radio"]'));

  const resetBtn = document.querySelector(
    '.toolbar .action.reset, .toolbar .reset, .toolbar button.reset, .toolbar .btn.reset, [data-action="reset"]'
  );
  if (!resetBtn) {
    console.warn('Reset button not found. Add data-action="reset" to the reset button or adjust selector.');
  }

  const initialSliderValue = new WeakMap();
  sliders.forEach(input => {
    const valueEl = input.parentElement.querySelector('.value');
    if (valueEl) valueEl.setAttribute('aria-live', 'polite');
    const update = () => { if (valueEl) valueEl.textContent = `${input.value}%`; };
    update();
    input.addEventListener('input', update);
    input.addEventListener('change', update);
    initialSliderValue.set(input, input.value);
  });

  const radioGroupDefault = new Map();
  radios.forEach(r => {
    const name = r.name || ('__unnamed_' + Math.random());
    if (!radioGroupDefault.has(name)) radioGroupDefault.set(name, null);
    if (r.checked && radioGroupDefault.get(name) === null) radioGroupDefault.set(name, r);
    if (radioGroupDefault.get(name) === null) radioGroupDefault.set(name, radios.find(x => x.name === name));
  });

  if (resetBtn) {
    resetBtn.addEventListener('click', (ev) => {
      ev.preventDefault();
      radioGroupDefault.forEach((defaultRadio, name) => {
        if (!defaultRadio) return;
        const group = document.querySelectorAll(`input[type="radio"][name="${name}"]`);
        group.forEach(r => { r.checked = (r === defaultRadio); });
      });
      sliders.forEach(input => {
        const val = initialSliderValue.get(input);
        if (val === undefined) return;
        input.value = val;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
      resetBtn.blur();
    });
  }

  // ------------------- Dropdown manager -------------------
  const Dropdowns = (() => {
    const OPEN_CLS = 'open';

    function closeAll(except = null) {
      document.querySelectorAll(`.dropdown.${OPEN_CLS}`).forEach(d => {
        if (except && d === except) return;
        d.classList.remove(OPEN_CLS);
        const t = d.querySelector('.dropdown-toggle');
        if (t) t.setAttribute('aria-expanded', 'false');
      });
    }

    function setToggleLabel(toggle, text) {
      const labelEl = toggle.querySelector('.dropdown-label');
      if (labelEl) {
        labelEl.textContent = text;
      } else {
        toggle.textContent = `${text} ▾`;
      }
    }

    function wire(rootEl, items = [], { enableSearch = false } = {}) {
      const toggle = rootEl.querySelector('.dropdown-toggle');
      const menu   = rootEl.querySelector('.dropdown-menu');
      const list   = rootEl.querySelector('.dropdown-list');
      const search = rootEl.querySelector('.dropdown-search');
      const slider = rootEl.querySelector('.dropdown-scroll-slider');

      // Populate list
      if (list && items.length) {
        list.innerHTML = '';
        items.forEach(name => {
          const it = document.createElement('div');
          it.className = 'item';
          it.setAttribute('role', 'option');
          it.tabIndex = 0;
          it.textContent = name;
          it.dataset.value = name;
          list.appendChild(it);
        });
      }

      const open = () => {
        closeAll(rootEl); // close others first
        rootEl.classList.add(OPEN_CLS);
        toggle.setAttribute('aria-expanded', 'true');
        if (menu) menu.focus({ preventScroll: true });

        // sync optional scroll slider
        if (slider && list) {
          const maxScroll = Math.max(0, list.scrollHeight - list.clientHeight);
          slider.min = 0;
          slider.max = maxScroll;
          slider.value = list.scrollTop || 0;
        }
      };

      const close = () => {
        rootEl.classList.remove(OPEN_CLS);
        toggle.setAttribute('aria-expanded', 'false');
      };

      // Prevent outside-close when interacting *inside* the dropdown
      if (menu) menu.addEventListener('click', (e) => e.stopPropagation());
      if (list) list.addEventListener('click', (e) => e.stopPropagation());
      if (search) {
        search.addEventListener('click', (e) => e.stopPropagation());
        search.addEventListener('keydown', (e) => e.stopPropagation());
      }

      // Toggle click
      toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const willOpen = !rootEl.classList.contains(OPEN_CLS);
        closeAll();
        if (willOpen) open(); else close();
      });

      // Keyboard open from toggle
      toggle.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle.click(); }
        if (e.key === 'ArrowDown') { e.preventDefault(); if (!rootEl.classList.contains(OPEN_CLS)) open(); (list?.firstElementChild || toggle).focus(); }
      });

      // List interactions
      if (list) {
        // Select item -> set label + close all
        list.addEventListener('click', (ev) => {
          const it = ev.target.closest('.item');
          if (!it) return;
          setToggleLabel(toggle, it.dataset.value);
          list.querySelectorAll('.item[aria-selected="true"]').forEach(x => x.setAttribute('aria-selected', 'false'));
          it.setAttribute('aria-selected', 'true');
          // close on selection
          closeAll();
        });

        // Keyboard nav in list
        list.addEventListener('keydown', (ev) => {
          const active = document.activeElement;
          if (ev.key === 'ArrowDown') { ev.preventDefault(); (active.nextElementSibling || active).focus(); }
          if (ev.key === 'ArrowUp')   { ev.preventDefault(); (active.previousElementSibling || active).focus(); }
          if (ev.key === 'Enter')     { ev.preventDefault(); active.click(); }
          if (ev.key === 'Escape')    { closeAll(); toggle.focus(); }
        });

        // Sync optional slider <-> scroll
        if (slider){
          slider.addEventListener('input', () => { list.scrollTop = Number(slider.value); });
          list.addEventListener('scroll', () => { slider.value = list.scrollTop; });
        }
      }

      // Search filter (does NOT close the menu)
      if (enableSearch && search && list) {
        search.addEventListener('input', () => {
          const q = search.value.trim().toLowerCase();
          Array.from(list.children).forEach(it => {
            const show = !q || it.textContent.toLowerCase().includes(q);
            it.style.display = show ? '' : 'none';
          });
          if (slider) {
            const maxScroll = Math.max(0, list.scrollHeight - list.clientHeight);
            slider.max = maxScroll;
            slider.value = list.scrollTop || 0;
          }
        });
      }

      return { open, close };
    }

    return { wire, closeAll };
  })();

  // ------------------- Attach dropdowns -------------------
  const euCountries = [
    "Austria","Belgium","Bulgaria","Croatia","Cyprus","Czechia (Czech Republic)",
    "Denmark","Estonia","Finland","France","Germany","Greece","Hungary","Ireland",
    "Italy","Latvia","Lithuania","Luxembourg","Malta","Netherlands","Poland",
    "Portugal","Romania","Slovakia","Slovenia","Spain","Sweden"
  ].sort((a,b)=> a.localeCompare(b));

  const scenarios = ["Baseline","High turnout","Low turnout","Fragmented parties"].sort();

  const countryDropdown  = document.querySelector('.select-control.pill .dropdown[data-dropdown="country"]');
  const scenarioDropdown = document.querySelector('.select-control.pill .dropdown[data-dropdown="scenario"]');

  if (countryDropdown)  Dropdowns.wire(countryDropdown,  euCountries, { enableSearch: true });
  if (scenarioDropdown) Dropdowns.wire(scenarioDropdown, scenarios,   { enableSearch: false });

  // ------------------- Global close rules -------------------
  // Close only when clicking OUTSIDE any dropdown
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.dropdown')) Dropdowns.closeAll();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') Dropdowns.closeAll(); });
});
