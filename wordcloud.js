(function () {
  'use strict';

  const STORAGE_KEY     = 'th_answers';
  // TODO: Replace with BCG production Azure Function URL
  // TODO: Update environment variable in Azure portal (STORAGE_CONNECTION_STRING on the Function App)
  const GET_ANSWERS_URL = 'https://bcg-townhall-submit-hqeafmg9eccjanen.westeurope-01.azurewebsites.net/api/GetAnswers';

  /* ── localStorage fallback if the Azure fetch fails ── */
  function loadAnswers() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  const STOPWORDS = {
    'the':1,'a':1,'an':1,'and':1,'or':1,'of':1,'to':1,'in':1,'on':1,'at':1,
    'is':1,'it':1,'its':1,'be':1,'are':1,'was':1,'were':1,'for':1,'with':1,
    'as':1,'by':1,'that':1,'this':1,'these':1,'those':1,'i':1,'we':1,'our':1,
    'you':1,'your':1,'they':1,'their':1,'but':1,'so':1,'if':1
  };

  /* ── BCG palette (most frequent → least frequent). Indices 7–8 are reserved
     for single-occurrence words only. ── */
  const PALETTE = [
    '#1a5c38',
    '#2e8b57',
    '#20BF61',
    '#127E83',
    '#1aabB3',
    '#4dd0d8',
    '#5cd68a',
    '#a8e8c0',
    '#a8ecf0'
  ];

  function colorForEntry(entry, ratio) {
    let index = Math.round((1 - ratio) * (PALETTE.length - 1));
    if (entry.count > 1) {
      index = Math.min(index, PALETTE.length - 3);
    }
    return PALETTE[index];
  }

  function tokenize(s) {
    return s
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
      .split(/\s+/)
      .filter(function (w) { return w && w.length > 1 && !STOPWORDS[w]; });
  }

  function plural(n, word) {
    return n + ' ' + word + (n === 1 ? '' : 's');
  }

  function renderWordCloud() {
    const cloud = document.getElementById('wcCloud');
    const meta  = document.getElementById('wcMeta');
    cloud.innerHTML = '<p class="wc-empty">Loading answers…</p>';
    meta.textContent = '';

    fetch(GET_ANSWERS_URL)
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (data) {
        renderCloudFromAnswers(Array.isArray(data) ? data : []);
      })
      .catch(function () {
        /* Silent fallback to localStorage */
        renderCloudFromAnswers(loadAnswers());
      });
  }

  function renderCloudFromAnswers(answers) {
    const cloud = document.getElementById('wcCloud');
    const meta  = document.getElementById('wcMeta');
    cloud.innerHTML = '';

    if (answers.length === 0) {
      cloud.innerHTML = '<p class="wc-empty">No guesses yet.</p>';
      meta.textContent = '';
      return;
    }

    const counts = Object.create(null);
    answers.forEach(function (a) {
      tokenize(a.answer || '').forEach(function (w) {
        counts[w] = (counts[w] || 0) + 1;
      });
    });

    const entries = Object.keys(counts).map(function (w) {
      return { word: w, count: counts[w] };
    });

    if (entries.length === 0) {
      cloud.innerHTML = '<p class="wc-empty">No meaningful words found yet.</p>';
      meta.textContent = answers.length + ' BCGers have submitted a guess';
      return;
    }

    const max = entries.reduce(function (m, e) { return e.count > m ? e.count : m; }, 1);
    const min = entries.reduce(function (m, e) { return e.count < m ? e.count : m; }, max);

    /* Most-common first so largest words anchor the centre of the spiral */
    entries.sort(function (a, b) { return b.count - a.count; });

    /* Coordinates are relative to the cloud container (card interior) */
    const cloudRect = cloud.getBoundingClientRect();
    const W = cloudRect.width;
    const H = cloudRect.height;
    const vmin = Math.min(W, H);

    const MIN_PX = Math.max(14, Math.min(36, vmin * 0.020));
    const MAX_PX = Math.max(40, Math.min(180, vmin * 0.110));

    entries.forEach(function (e) {
      const ratio = max === min ? 1 : (e.count - min) / (max - min);
      e.ratio = ratio;
      e.fontSize = MIN_PX + ratio * (MAX_PX - MIN_PX);
      e.fontWeight = ratio > 0.6 ? 700 : (ratio > 0.3 ? 600 : 400);
      e.color = colorForEntry(e, ratio);
    });

    /* Spiral placement with collision detection */
    const measureCanvas = document.createElement('canvas');
    const mctx = measureCanvas.getContext('2d');

    /* Reserve top for header + divider; recentre the spiral in the usable area */
    const TOP_RESERVE    = 140;
    const BOTTOM_RESERVE = 60;
    const SIDE_RESERVE   = 16;
    const GAP            = 6;

    const cx = W / 2;
    const cy = (TOP_RESERVE + (H - BOTTOM_RESERVE)) / 2;

    const SPIRAL_ANGLE_STEP  = 0.15;
    const SPIRAL_RADIUS_STEP = Math.max(1.4, vmin * 0.0035);
    const T_MAX              = 3000;

    const placed = [];
    const positions = [];

    function fits(box) {
      if (box.x - box.w / 2 < SIDE_RESERVE) return false;
      if (box.x + box.w / 2 > W - SIDE_RESERVE) return false;
      if (box.y - box.h / 2 < TOP_RESERVE) return false;
      if (box.y + box.h / 2 > H - BOTTOM_RESERVE) return false;
      for (let i = 0; i < placed.length; i++) {
        const p = placed[i];
        const dx = Math.abs(box.x - p.x);
        const dy = Math.abs(box.y - p.y);
        if (dx * 2 < box.w + p.w + GAP && dy * 2 < box.h + p.h + GAP) return false;
      }
      return true;
    }

    entries.forEach(function (e, i) {
      mctx.font = e.fontWeight + ' ' + e.fontSize + 'px Georgia, serif';
      const w = mctx.measureText(e.word).width;
      const h = e.fontSize * 1.05;

      if (i === 0) {
        placed.push({ x: cx, y: cy, w: w, h: h });
        positions.push({ entry: e, x: cx, y: cy });
        return;
      }

      let t = 1;
      let placedOk = false;
      while (t < T_MAX && !placedOk) {
        const angle = t * SPIRAL_ANGLE_STEP;
        const radius = t * SPIRAL_RADIUS_STEP;
        const x = cx + Math.cos(angle) * radius;
        const y = cy + Math.sin(angle) * radius;
        const box = { x: x, y: y, w: w, h: h };
        if (fits(box)) {
          placed.push(box);
          positions.push({ entry: e, x: x, y: y });
          placedOk = true;
        }
        t++;
      }
    });

    /* Staggered fade/scale entrance */
    const N = positions.length;
    const totalDuration = 2500;
    const step = N > 0 ? Math.max(30, Math.min(120, totalDuration / N)) : 0;

    positions.forEach(function (p, i) {
      const span = document.createElement('span');
      span.className = 'wc-word';
      span.textContent = p.entry.word;
      span.style.left = p.x + 'px';
      span.style.top = p.y + 'px';
      span.style.fontSize = p.entry.fontSize.toFixed(1) + 'px';
      span.style.fontWeight = p.entry.fontWeight;
      span.style.color = p.entry.color;
      span.style.transitionDelay = (i * step) + 'ms';
      span.title = plural(p.entry.count, 'mention');
      cloud.appendChild(span);
    });

    void cloud.offsetHeight;
    requestAnimationFrame(function () {
      cloud.querySelectorAll('.wc-word').forEach(function (el) {
        el.classList.add('in');
      });
    });

    meta.textContent = answers.length + ' BCGers have submitted a guess';
  }

  /* Re-layout the spiral on viewport changes */
  let wcResizeTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(wcResizeTimer);
    wcResizeTimer = setTimeout(renderWordCloud, 200);
  });

  renderWordCloud();

})();
