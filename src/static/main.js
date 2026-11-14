(function () {
  /* Old single-page anchors (before lessons got their own pages) -> new URLs */
  var moved = {
    '#flirting-basics': '/what-is-flirting/',
    '#start-a-conversation': '/how-to-start-a-conversation/',
    '#body-language': '/body-language-signs-of-interest/',
    '#life-worth-joining': '/how-to-be-more-attractive/',
    '#storytelling': '/how-to-tell-a-story-on-a-date/',
    '#self-check': '/friend-zone-quiz/',
    '#texting': '/how-to-text-someone-you-like/',
    '#habits': '/attractive-habits/',
    '#date-games': '/fun-date-games/'
  };
  if (location.pathname === '/' && moved[location.hash]) { location.replace(moved[location.hash]); return; }

  /* ---------- Funnel events (see docs/measurement.md) ----------
     First-party and cookieless: a beacon to /e with an event name and a few
     coarse fields (path, scenario id, score bucket, source). Never free text,
     replies or identifiers. Disabled unless <meta name="fl-analytics" content="on">. */
  var analyticsMeta = document.querySelector('meta[name="fl-analytics"]');
  var analyticsOn = !!(analyticsMeta && analyticsMeta.content === 'on' && navigator.sendBeacon);
  var ONCE = { landing_view: 1, challenge_start: 1, referred_visit: 1, referred_completion: 1 };
  var fired = {};
  var src = (function () {
    var m = /[?&]utm_source=([a-z0-9_-]{1,32})/i.exec(location.search);
    if (m) return m[1].toLowerCase();
    try { return document.referrer ? new URL(document.referrer).hostname.replace(/^www\./, '').slice(0, 64) : 'direct'; }
    catch (e) { return 'direct'; }
  })();
  window.flTrack = function (name, props) {
    if (!analyticsOn || !/^[a-z_]{3,40}$/.test(name)) return;
    if (ONCE[name]) { if (fired[name]) return; fired[name] = 1; }
    var q = 'n=' + name + '&p=' + encodeURIComponent(location.pathname) + '&src=' + encodeURIComponent(src);
    for (var k in (props || {})) {
      var v = props[k];
      if (v !== '' && v != null && /^[a-z]{1,8}$/.test(k)) q += '&' + k + '=' + encodeURIComponent(String(v).slice(0, 40));
    }
    try { navigator.sendBeacon('/e?' + q); } catch (e) {}
  };
  window.flTrack('landing_view');

  var root = document.documentElement;
  function save(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function load(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }

  /* ---------- Theme (preference kept only in this browser) ---------- */
  var savedTheme = load('fl-theme');
  if (savedTheme) root.setAttribute('data-theme', savedTheme);
  var themeBtn = document.getElementById('themeBtn');
  if (themeBtn) themeBtn.addEventListener('click', function () {
    var cur = root.getAttribute('data-theme') ||
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    var next = cur === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    save('fl-theme', next);
  });

  /* ---------- Mobile menu ---------- */
  var menuBtn = document.getElementById('menuBtn');
  var links = document.getElementById('navLinks');
  if (menuBtn && links) {
    menuBtn.addEventListener('click', function () {
      var open = links.classList.toggle('open');
      menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    links.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') { links.classList.remove('open'); menuBtn.setAttribute('aria-expanded', 'false'); }
    });
  }

  /* ---------- Self-check (questions live in the HTML) ---------- */
  var form = document.getElementById('quiz');
  var result = document.getElementById('quizResult');
  var hint = document.getElementById('quizHint');
  if (form && result) {
    var items = Array.prototype.slice.call(form.querySelectorAll('.q-item'));

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var scores = [], missing = 0;
      items.forEach(function (item) {
        var c = item.querySelector('input:checked');
        if (!c) missing++;
        scores.push(c ? parseInt(c.value, 10) : 0);
      });
      if (missing) { hint.textContent = 'Answer all ' + items.length + ' to see your results (' + missing + ' left).'; return; }
      hint.textContent = '';

      var total = scores.reduce(function (a, b) { return a + b; }, 0);
      var max = items.length * 2;
      var title, text;
      if (total <= 3) { title = 'You’re in good shape'; text = 'Your habits show interest and confidence. If there’s no spark, it may simply not be a match, and that’s okay.'; }
      else if (total <= 8) { title = 'A few habits to tune'; text = 'Nothing dramatic, but a couple of patterns may be hiding your interest or your confidence. Start with these:'; }
      else { title = 'Time for a reset'; text = 'Several habits are working against you. Each one is easy to practice. Pick one and focus on it this week:'; }

      var flagged = items
        .map(function (item, i) { return { area: item.getAttribute('data-area'), tip: item.getAttribute('data-tip'), s: scores[i] }; })
        .filter(function (x) { return x.s > 0; })
        .sort(function (a, b) { return b.s - a.s; });

      result.textContent = '';
      var eyebrow = document.createElement('p'); eyebrow.className = 'eyebrow'; eyebrow.textContent = 'Your result · ' + total + ' / ' + max;
      var h = document.createElement('h3'); h.textContent = title;
      var meter = document.createElement('div'); meter.className = 'meter'; meter.setAttribute('role', 'img'); meter.setAttribute('aria-label', 'Score ' + total + ' of ' + max);
      var fill = document.createElement('div'); fill.style.width = Math.max(4, (total / max) * 100) + '%'; meter.appendChild(fill);
      var p = document.createElement('p'); p.textContent = text;
      result.append(eyebrow, h, meter, p);
      if (flagged.length) {
        var ul = document.createElement('ul'); ul.className = 'tip-list';
        flagged.forEach(function (x) {
          var li = document.createElement('li');
          var b = document.createElement('b'); b.textContent = x.area + (x.s === 2 ? ' (often): ' : ' (sometimes): ');
          li.append(b, document.createTextNode(x.tip));
          ul.appendChild(li);
        });
        result.appendChild(ul);
      }
      result.hidden = false;
      result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
    form.addEventListener('reset', function () { result.hidden = true; hint.textContent = ''; });
  }

  /* ---------- Footer year ---------- */
  var y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();
})();
