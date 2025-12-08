(function () {
  const MAP_SRC = 'assets/eu-map.svg';

  const NAME_TO_ID = {
    Austria:'AT', Belgium:'BE', Bulgaria:'BG', Croatia:'HR', Cyprus:'CY',
    'Czechia':'CZ', Denmark:'DK', Estonia:'EE', Finland:'FI',
    France:'FR', Germany:'DE', Greece:'GR', Hungary:'HU', Ireland:'IE', Italy:'IT',
    Latvia:'LV', Lithuania:'LT', Luxembourg:'LU', Malta:'MT', Netherlands:'NL',
    Poland:'PL', Portugal:'PT', Romania:'RO', Slovakia:'SK', Slovenia:'SI',
    Spain:'ES', Sweden:'SE', 'United Kingdom':'GB'
  };

  const $  = (s,r=document)=>r.querySelector(s);
  const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));
  const mount = $('.map');
  if (!mount) return;

  let svg, defaultVB, curVB, stagedId=null, lastAppliedId=null;

  // --- tiny easing for viewBox animations
  const ease = t => (t<.5) ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2;

  function fitBoxToAspect(bbox, vbAspect) {
    let {x,y,width:w,height:h} = bbox;
    const bAspect = w/h;
    if (bAspect > vbAspect) { const th = w / vbAspect; const p=(th-h)/2; y-=p; h=th; }
    else { const tw = h * vbAspect; const p=(tw-w)/2; x-=p; w=tw; }
    return { x, y, w, h };
  }

  function animateViewBox(from, to, ms=600){
    const t0 = performance.now();
    const step = (now)=>{
      const p = Math.min(1,(now-t0)/ms), k = ease(p);
      const x = from.x + (to.x-from.x)*k;
      const y = from.y + (to.y-from.y)*k;
      const w = from.w + (to.w-from.w)*k;
      const h = from.h + (to.h-from.h)*k;
      svg.setAttribute('viewBox', `${x} ${y} ${w} ${h}`);
      curVB = {x,y,w,h};
      if(p<1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function resetMap(){
    if(!svg||!defaultVB) return;
    $$('.eu-country', svg).forEach(n=>n.classList.remove('is-selected','is-dimmed'));
    animateViewBox(curVB||defaultVB, defaultVB, 450);
    lastAppliedId = null;
  }

  function highlightCountry(id){
    if(!svg) return;
    const target = svg.getElementById(id);
    if(!target) return;

    // keep z-order and stroke so borders stay continuous
    const all = $$('.eu-country', svg);
    all.forEach(n => n.classList.remove('is-selected','is-dimmed'));
    all.forEach(n => n.classList.add('is-dimmed'));
    target.classList.remove('is-dimmed');
    target.classList.add('is-selected');

    // zoom to the country with small padding
    const vb = svg.viewBox.baseVal;
    const vbAspect = vb.width / vb.height;
    const b = target.getBBox();
    const pad = Math.max(vb.width, vb.height) * 0.04;
    const padded = { x:b.x-pad, y:b.y-pad, width:b.width+pad*2, height:b.height+pad*2 };
    const fit = fitBoxToAspect(
      {x:padded.x,y:padded.y,width:padded.width,height:padded.height},
      vbAspect
    );

    const from = curVB || { x: vb.x, y: vb.y, w: vb.width, h: vb.height };
    const to   = { x: fit.x, y: fit.y, w: fit.w, h: fit.h };
    animateViewBox(from, to, 650);
    lastAppliedId = id;
  }

  // read the currently chosen country
  function readStagedId(){
    const label = $('.dropdown[data-dropdown="country"] .dropdown-label')?.textContent?.trim();
    stagedId = NAME_TO_ID[label] || null;
  }

  function applyFromUI(){
    readStagedId();
    if(!stagedId){ resetMap(); return; }
    if(stagedId !== lastAppliedId) highlightCountry(stagedId);
  }

  function injectStyles(){
    const s = document.createElement('style');
    s.textContent = `
      svg#eu-map .eu-country, svg#eu-map .eu-country *{
        fill:#E9EDF7;
        stroke:#9BAAD8;
        stroke-width:.8;
        vector-effect:non-scaling-stroke;     /* keeps stroke steady while zooming */
        paint-order:stroke fill;               /* draw border on top of fill */
        transition:fill .25s ease;
        shape-rendering:geometricPrecision;
      }
      svg#eu-map .eu-country:hover, svg#eu-map .eu-country:hover *{ fill:#E6EBFA; }
      svg#eu-map .is-dimmed:not(.is-selected), svg#eu-map .is-dimmed:not(.is-selected) *{ fill:#F1F4FB; }
      svg#eu-map .is-selected, svg#eu-map .is-selected *{
        fill:#8C99FF;          /* soft highlight */
        stroke:#9BAAD8;        /* same border as neighbors -> no visible gap */
        filter:none;           /* no halo */
      }
    `;
    document.head.appendChild(s);
  }

  function postProcessSVG(){
    injectStyles();
    svg.setAttribute('id','eu-map');

    if(!svg.viewBox || svg.viewBox.baseVal.width===0){
      const bb = svg.getBBox();
      svg.setAttribute('viewBox', `${bb.x} ${bb.y} ${bb.width} ${bb.height}`);
    }
    const vb = svg.viewBox.baseVal;
    defaultVB = curVB = {x:vb.x,y:vb.y,w:vb.width,h:vb.height};

    // // tag any element with ISO2 id as a country (works for <g> & <path>)
    // $$('[id]', svg).forEach(el => { if (/^[A-Z]{2}$/.test(el.id)) el.classList.add('eu-country'); });

    // build a reverse map (ISO -> display name)
    const ID_TO_NAME = Object.fromEntries(
      Object.entries(NAME_TO_ID).map(([name, iso]) => [iso, name])
    );

    function nameFromId(id) {
      return ID_TO_NAME[id] || id;
    }

    // tag elements as countries and wire up click handlers
    // Only ISO codes present in NAME_TO_ID are considered allowed EU members.
    const ALLOWED_ISO = new Set(
      Object.values(NAME_TO_ID).filter(code => code && code !== 'GB')
    );

    $$('[id]', svg).forEach(el => {
      if (/^[A-Z]{2}$/.test(el.id)) {
        el.classList.add('eu-country');

        // mark cursor based on whether this ISO is one of the allowed EU codes
        const iso = el.id;
        const allowed = ALLOWED_ISO.has(iso);
        try { el.style.cursor = allowed ? 'pointer' : 'not-allowed'; } catch (e) {}

        el.addEventListener('click', (ev) => {
          ev.stopPropagation();

          // reject non-EU selections with a user-facing error
          if (!allowed) {
            if (typeof window.showErrorToast === 'function') {
              window.showErrorToast('Country not available — please select an EU member.');
            } else {
              console.warn('[eu-map] non-EU country clicked:', iso);
            }
            // small visual hint (optional; harmless if CSS doesn't have this class)
            try {
              el.classList.add('is-invalid');
              setTimeout(() => el.classList.remove('is-invalid'), 700);
            } catch (_) {}
            return;
          }

          // allowed: stage and sync UI
          const id = iso;
          stagedId = id;

          const countryName = nameFromId(id);
          const labelEl = document.querySelector('.dropdown[data-dropdown="country"] .dropdown-label');
          if (labelEl) labelEl.textContent = countryName;

          // also mark the matching item in the dropdown list
          if (typeof setDropdownSelectionByName === 'function') {
            setDropdownSelectionByName(countryName);
          }

          // close dropdown UI if open (best-effort)
          const toggle = document.querySelector('.dropdown[data-dropdown="country"] .dropdown-toggle');
          if (toggle) toggle.setAttribute('aria-expanded', 'false');

          // highlight & zoom the clicked country immediately
          highlightCountry(id);

          // if you want clicks to also apply the selection (press "Apply"), uncomment:
          // applyFromUI();
        });
      }
    });
  }

  // keep the dropdown in sync when a country is clicked on the map
  function setDropdownSelectionByName(name) {
    const dd = document.querySelector('.dropdown[data-dropdown="country"]');
    if (!dd) return;
    const toggle = dd.querySelector('.dropdown-toggle');
    const list = dd.querySelector('.dropdown-list');
    // set visible label
    if (toggle) {
      const lbl = toggle.querySelector('.dropdown-label');
      if (lbl) lbl.textContent = name;
    }
    // mark the matching item as selected (if present)
    if (list) {
      Array.from(list.children).forEach(it => it.removeAttribute('aria-selected'));
      const match = Array.from(list.children).find(it => (it.textContent || '').trim() === name);
      if (match) match.setAttribute('aria-selected', 'true');
    }
    // ensure dropdown is closed
    if (toggle) toggle.setAttribute('aria-expanded', 'false');
  }

  // listen for dropdown selection events and highlight on the map
  const countryDropdownEl = document.querySelector('.dropdown[data-dropdown="country"]');
  if (countryDropdownEl) {
    countryDropdownEl.addEventListener('dropdown-change', (ev) => {
      const name = ev?.detail?.value;
      if (!name) { resetMap(); return; }
      const id = NAME_TO_ID[name] || null;
      if (!id) { resetMap(); return; }
      stagedId = id;
      // immediate visual sync
      highlightCountry(id);
    });
  }

  // only apply when the page's Apply button is pressed
  function wireApply(){
    const btn = document.querySelector('[data-action="apply"], .apply, button.apply');
    // if(btn) btn.addEventListener('click', ()=>setTimeout(applyFromUI,0));
      btn.addEventListener('click', ()=> {
        applyFromUI();
      });
  }

  async function init(){
    if (location.protocol === 'file:') {
      console.warn('[eu-map] To load the SVG, run a local server (fetch is blocked for file://).');
    }
    try{
      const res = await fetch(MAP_SRC, { cache:'no-store' });
      const text = await res.text();
      mount.innerHTML = text;
      svg = $('svg', mount);
      if(!svg) throw new Error('SVG not found');
      postProcessSVG();
      wireApply();
      readStagedId();
    }catch(e){
      console.warn('[eu-map] load error:', e);
      mount.innerHTML = '<div style="padding:20px;color:#7181a8">Map unavailable. Open the project via a local server so the SVG can be fetched.</div>';
      wireApply();
    }
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
