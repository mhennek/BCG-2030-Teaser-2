(function () {
  'use strict';

  const STORAGE_KEY = 'th_answers';

  const input          = document.getElementById('guessInput');
  const submitBtn      = document.getElementById('submitBtn');
  const feedback       = document.getElementById('feedback');
  const overlay        = document.getElementById('overlay');
  const vid            = document.getElementById('vid');
  const skipBtn        = document.getElementById('skipBtn');
  const eventOverlay   = document.getElementById('eventOverlay');
  const closeEventBtn  = document.getElementById('closeEventBtn');
  const wcView         = document.getElementById('wcView');

  const WC_HASH         = '#wordcloud';
  const GET_ANSWERS_URL = 'https://bcg-townhall-submit-hqeafmg9eccjanen.westeurope-01.azurewebsites.net/api/GetAnswers';

  /* ── Storage helpers ── */
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

  function saveAnswer(text) {
    const list = loadAnswers();
    list.push({ answer: text, timestamp: Date.now() });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (e) {
      /* storage full or disabled — ignore silently */
    }
  }

  /* ── Submit flow ── */
  let submitted = false;

  function submitGuess() {
    const value = input.value.trim();
    if (!value) {
      feedback.textContent = 'Please type a guess before submitting.';
      input.focus();
      return;
    }
    feedback.textContent = '';
    saveAnswer(value);

    fetch("https://bcg-townhall-submit-hqeafmg9eccjanen.westeurope-01.azurewebsites.net/api/SubmitAnswer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answer: value })
    }).catch(function() {
      // Silent fail — don't interrupt the user experience if this fails
    });

    submitted = true;
    overlay.classList.add('active');
    vid.play().catch(function () { vid.controls = true; });
  }

  submitBtn.addEventListener('click', submitGuess);
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') submitGuess();
  });

  function showEventDetails() {
    overlay.classList.remove('active');
    vid.pause();
    eventOverlay.classList.add('active');
    closeEventBtn.focus();
  }
  vid.addEventListener('ended', showEventDetails, { once: true });
  vid.addEventListener('error', function () {
    if (submitted) showEventDetails();
  });
  skipBtn.addEventListener('click', showEventDetails);

  function closeEventDetails() {
    eventOverlay.classList.remove('active');
    submitBtn.focus();
  }
  closeEventBtn.addEventListener('click', closeEventDetails);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && eventOverlay.classList.contains('active')) {
      closeEventDetails();
    }
  });

  /* ── Word cloud view (#wordcloud) ── */
  const STOPWORDS = {
    'the':1,'a':1,'an':1,'and':1,'or':1,'of':1,'to':1,'in':1,'on':1,'at':1,
    'is':1,'it':1,'its':1,'be':1,'are':1,'was':1,'were':1,'for':1,'with':1,
    'as':1,'by':1,'that':1,'this':1,'these':1,'those':1,'i':1,'we':1,'our':1,
    'you':1,'your':1,'they':1,'their':1,'but':1,'so':1,'if':1
  };

  /* ── BCG palette (most frequent → least frequent). Indices 7–8 are reserved
     for single-occurrence words only. ── */
  const PALETTE = [
    '#1a5c38', // 0 — most frequent (darkest)
    '#2e8b57',
    '#20BF61',
    '#127E83',
    '#1aabB3',
    '#4dd0d8',
    '#5cd68a',
    '#a8e8c0',
    '#a8ecf0'  // 8 — least frequent (lightest), count===1 only
  ];

  function colorForEntry(entry, ratio) {
    let index = Math.round((1 - ratio) * (PALETTE.length - 1));
    if (entry.count > 1) {
      index = Math.min(index, PALETTE.length - 3); // cap at index 6
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

    /* Most-common first so largest words anchor the center of the spiral */
    entries.sort(function (a, b) { return b.count - a.count; });

    /* Spiral coordinates are relative to the cloud container (the card's
       interior), not the viewport, so words stay inside the card. */
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

    /* Reserve top space for the CSS-sized title + subtitle + divider; recentre
       the spiral inside the remaining usable area. Title clamp caps at 48px,
       subtitle at 25px, plus top offset + padding + buffer ≈ 140. */
    const TOP_RESERVE    = 140;
    const BOTTOM_RESERVE = 60;
    const SIDE_RESERVE   = 16;
    const GAP            = 6;

    const cx = W / 2;
    const cy = (TOP_RESERVE + (H - BOTTOM_RESERVE)) / 2;

    /* Spiral parameters — spread across the full usable area instead of
       packing tightly at the centre */
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
        /* Largest word always anchors the centre */
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
      /* If still not placed, the spiral ran off-screen — skip silently */
    });

    /* Build DOM with staggered transition-delay (most frequent reveals first) */
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

    /* Force layout so the initial (pre-transition) state is committed,
       then add .in to trigger the staggered fade/scale */
    void cloud.offsetHeight;
    requestAnimationFrame(function () {
      cloud.querySelectorAll('.wc-word').forEach(function (el) {
        el.classList.add('in');
      });
    });

    meta.textContent = answers.length + ' BCGers have submitted a guess';
  }

  /* Re-layout the spiral on viewport changes while the cloud is visible */
  let wcResizeTimer = null;
  window.addEventListener('resize', function () {
    if (!wcView.classList.contains('active')) return;
    clearTimeout(wcResizeTimer);
    wcResizeTimer = setTimeout(renderWordCloud, 200);
  });

  function applyRoute() {
    if (window.location.hash === WC_HASH) {
      document.body.classList.add('wordcloud-mode');
      wcView.classList.add('active');
      renderWordCloud();
    } else {
      document.body.classList.remove('wordcloud-mode');
      wcView.classList.remove('active');
    }
  }

  window.addEventListener('hashchange', applyRoute);
  applyRoute();

})();
