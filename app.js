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

    // TODO: Replace with BCG production Azure Function URL
    // TODO: Update environment variable in Azure portal (STORAGE_CONNECTION_STRING on the Function App)
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

})();
