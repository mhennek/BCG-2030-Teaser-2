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

  const GREEN_SHADES = [
    '#0C2B15', '#134d27', '#1a6e38', '#1f9a51', '#20BF61',
    '#3fcf78', '#6bd996', '#92e2b1'
  ];

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
    cloud.innerHTML = '';

    const answers = loadAnswers();
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
      meta.textContent = plural(answers.length, 'answer') + ' stored';
      return;
    }

    const max = entries.reduce(function (m, e) { return e.count > m ? e.count : m; }, 1);
    const min = entries.reduce(function (m, e) { return e.count < m ? e.count : m; }, max);

    /* Sort so most common words are placed first (visually centered-ish) */
    entries.sort(function (a, b) { return b.count - a.count; });

    const MIN_PX = 14;
    const MAX_PX = 64;

    entries.forEach(function (e) {
      const ratio = max === min ? 1 : (e.count - min) / (max - min);
      const size  = MIN_PX + ratio * (MAX_PX - MIN_PX);
      const color = GREEN_SHADES[Math.min(
        GREEN_SHADES.length - 1,
        Math.floor((1 - ratio) * GREEN_SHADES.length)
      )];

      const span = document.createElement('span');
      span.className = 'wc-word';
      span.textContent = e.word;
      span.style.fontSize = size.toFixed(1) + 'px';
      span.style.color = color;
      span.style.fontWeight = ratio > 0.6 ? '700' : (ratio > 0.3 ? '600' : '400');
      span.title = plural(e.count, 'mention');
      cloud.appendChild(span);
    });

    meta.textContent = plural(answers.length, 'answer') + ' · ' + plural(entries.length, 'unique word');
  }

  function applyRoute() {
    if (window.location.hash === '#wordcloud') {
      document.body.classList.add('wordcloud-mode');
      document.getElementById('wcView').classList.add('active');
      renderWordCloud();
    } else {
      document.body.classList.remove('wordcloud-mode');
      document.getElementById('wcView').classList.remove('active');
    }
  }

  window.addEventListener('hashchange', applyRoute);
  applyRoute();

})();
