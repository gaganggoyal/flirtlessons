/* Flirt Lessons — friend-zone self-check.
 *
 * The questions live in the page HTML (data-area / data-tip on each .q-item).
 * Scoring, result types and share text are pure functions (tests/quiz.test.js);
 * the UI at the bottom only runs in a browser on a page with #quiz.
 * Answers never leave the browser. Shares carry the result type only.
 */
var FLQuiz = (function () {
  'use strict';

  var ID = 'friend-zone-v1';
  var POINTS_PER_QUESTION = 2; // Rarely 0 · Sometimes 1 · Often 2

  // Ordered from clearest signals to most hidden. upTo = highest share of the
  // maximum points that still earns this type.
  var TYPES = [
    { id: 'open', name: 'The Open Book', upTo: 0.2,
      card: 'My interest comes through loud and clear.',
      blurb: 'Your interest and your confidence come through clearly. If there’s still no spark, it may simply not be a match, and that’s okay.' },
    { id: 'slow', name: 'The Slow Burn', upTo: 0.45,
      card: 'The interest is there. It just simmers quietly.',
      blurb: 'The interest is there, but a couple of habits keep it simmering in the background. One clear, specific invitation would turn up the heat.' },
    { id: 'secret', name: 'The Secret Admirer', upTo: 0.7,
      card: 'I like them. I’m just hiding it a little too well.',
      blurb: 'You like them, and you’re hiding it well. Maybe too well: people can’t respond to interest they can’t see. Start with the top habit below.' },
    { id: 'undercover', name: 'Deep Undercover', upTo: 1,
      card: 'My interest is so well hidden even I can’t find it.',
      blurb: 'Several habits are hiding both your interest and your confidence. Each one is easy to practice. Pick the top one below and focus on it this week.' }
  ];

  /** scores: one number (0..2) per question. */
  function result(scores) {
    if (!Array.isArray(scores) || !scores.length) throw new Error('need at least one answer');
    scores.forEach(function (s) {
      if (s !== 0 && s !== 1 && s !== 2) throw new Error('bad answer ' + s);
    });
    var total = scores.reduce(function (a, b) { return a + b; }, 0);
    var max = scores.length * POINTS_PER_QUESTION;
    var share = total / max;
    var type = TYPES.filter(function (t) { return share <= t.upTo + 1e-9; })[0];
    return {
      total: total,
      max: max,
      type: type,
      // How clearly interest shows: 100% = no hiding habits at all.
      signal: Math.round(100 * (1 - share))
    };
  }

  /** The habits that showed up, most frequent first (stable for ties). */
  function flags(scores, areas) {
    return scores
      .map(function (s, i) { return { s: s, i: i, area: areas[i].area, tip: areas[i].tip }; })
      .filter(function (x) { return x.s > 0; })
      .sort(function (a, b) { return b.s - a.s || a.i - b.i; });
  }

  function typeById(id) {
    return TYPES.filter(function (t) { return t.id === id; })[0] || null;
  }

  /** ?r=<type id> from a friend's share link -> type, or null. */
  function parseFriend(search) {
    var m = /[?&]r=([a-z]{1,12})(?:&|$)/.exec(search || '');
    return m ? typeById(m[1]) : null;
  }

  /** Share payload: the result type only, never the answers. */
  function shareText(type) {
    return 'I got “' + type.name + '” on the Flirt Lessons friend zone quiz. Which one are you?';
  }
  function shareUrl(type, base) {
    return (base || 'https://flirtlessons.com') + '/friend-zone-quiz/?r=' + type.id + '&utm_source=share&utm_medium=quiz';
  }

  return { ID: ID, TYPES: TYPES, result: result, flags: flags, typeById: typeById,
           parseFriend: parseFriend, shareText: shareText, shareUrl: shareUrl };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = FLQuiz;
} else if (typeof document !== 'undefined') {
  (function (Q) {
    'use strict';
    var form = document.getElementById('quiz');
    var box = document.getElementById('quizResult');
    if (!form || !box) return;
    var track = window.flTrack || function () {};
    var hint = document.getElementById('quizHint');
    var items = Array.prototype.slice.call(form.querySelectorAll('.q-item'));
    var areas = items.map(function (it) { return { area: it.getAttribute('data-area'), tip: it.getAttribute('data-tip') }; });
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var friend = Q.parseFriend(location.search);
    var started = false, completed = false, shared = false;

    function $(sel) { return box.querySelector(sel); }
    function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

    if (friend) {
      var banner = document.querySelector('[data-friend]');
      if (banner) { banner.textContent = 'A friend got “' + friend.name + '”. Which one are you?'; banner.hidden = false; }
      track('referred_visit', { scn: Q.ID });
    }

    form.addEventListener('change', function () {
      if (!started) { started = true; track('quiz_start', { scn: Q.ID, ref: friend ? 'friend' : '' }); }
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var scores = [], missing = 0;
      items.forEach(function (item) {
        var c = item.querySelector('input:checked');
        if (!c) missing++;
        scores.push(c ? parseInt(c.value, 10) : 0);
      });
      if (missing) { hint.textContent = 'Answer all ' + items.length + ' to see your result (' + missing + ' left).'; return; }
      hint.textContent = '';
      show(Q.result(scores), Q.flags(scores, areas));
    });

    form.addEventListener('reset', function () {
      box.hidden = true; hint.textContent = ''; completed = false; shared = false;
    });

    function show(r, flagged) {
      $('[data-type]').textContent = r.type.name;
      $('[data-blurb]').textContent = r.type.blurb;
      $('[data-signal]').textContent = r.signal + '%';
      $('[data-meter]').style.width = Math.max(4, r.signal) + '%';
      $('[data-meter-wrap]').setAttribute('aria-label', 'Interest signal ' + r.signal + ' percent');
      $('[data-points]').textContent = r.total + ' of ' + r.max + ' habit points';
      var cmp = $('[data-compare]');
      if (friend) {
        cmp.hidden = false;
        cmp.textContent = friend.id === r.type.id ? 'Same as your friend: you’re both “' + r.type.name + '”.'
          : 'Your friend got “' + friend.name + '”. Send them yours.';
      } else { cmp.hidden = true; }
      var list = $('[data-tips]');
      list.textContent = '';
      flagged.forEach(function (x) {
        var li = el('li');
        li.append(el('b', null, x.area + (x.s === 2 ? ' (often): ' : ' (sometimes): ')), document.createTextNode(x.tip));
        list.appendChild(li);
      });
      list.hidden = !flagged.length;
      box.hidden = false;
      var h = $('h2'); if (h) h.focus({ preventScroll: true });
      box.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
      if (!completed) {
        completed = true;
        track('quiz_complete', { scn: Q.ID, rt: r.type.id, ref: friend ? 'friend' : '' });
        if (friend) track('referred_completion', { scn: Q.ID });
      }
      wireShare(r);
    }

    function wireShare(r) {
      // quiz_share: at most once per completed attempt; quiz_share_click: every click.
      function shareClick(via) {
        if (!shared) { shared = true; track('quiz_share', { scn: Q.ID, via: via }); }
        track('quiz_share_click', { scn: Q.ID, via: via });
      }
      var url = Q.shareUrl(r.type, location.origin.indexOf('flirtlessons.com') > -1 ? location.origin : undefined);
      var text = Q.shareText(r.type);
      var status = $('[data-share-status]');
      var native = $('[data-share-native]');
      native.hidden = !navigator.share;
      native.onclick = function () {
        shareClick('native');
        navigator.share({ title: 'Friend zone quiz', text: text, url: url })
          .then(function () { track('quiz_share_complete', { scn: Q.ID, via: 'native' }); })
          .catch(function () {});
      };
      var wa = $('[data-share-wa]');
      wa.href = 'https://wa.me/?text=' + encodeURIComponent(text + ' ' + url);
      wa.onclick = function () { shareClick('whatsapp'); };
      var x = $('[data-share-x]');
      x.href = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(text) + '&url=' + encodeURIComponent(url);
      x.onclick = function () { shareClick('x'); };
      $('[data-copy]').onclick = function () {
        shareClick('copy');
        var done = function () { status.textContent = 'Link copied. Send it to a friend!'; };
        if (navigator.clipboard) navigator.clipboard.writeText(text + ' ' + url).then(done, function () { status.textContent = url; });
        else status.textContent = url;
      };
      $('[data-download]').onclick = function () {
        track('quiz_card_download', { scn: Q.ID });
        drawCard(r).then(function (blob) {
          var a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = 'flirt-lessons-' + r.type.id + '.png';
          document.body.appendChild(a); a.click(); a.remove();
          setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
        });
      };
    }

    /* 1080x1350 result card, drawn locally. Contains the result type only. */
    function drawCard(r) {
      var W = 1080, H = 1350, cv = document.createElement('canvas');
      cv.width = W; cv.height = H;
      var g = cv.getContext('2d');
      var fontsReady = document.fonts && document.fonts.load
        ? Promise.all(['700 46px Fraunces', 'italic 600 110px Fraunces', '600 34px Inter', '400 44px Inter'].map(function (f) { return document.fonts.load(f); })).catch(function () {})
        : Promise.resolve();
      return fontsReady.then(function () {
        g.fillStyle = '#fbf8f5'; g.fillRect(0, 0, W, H);
        g.fillStyle = '#c63d57'; roundRect(g, 80, 80, 88, 88, 22); g.fill();
        g.fillStyle = '#fff'; g.font = 'italic 700 48px Fraunces, Georgia, serif'; g.textAlign = 'center'; g.fillText('fl', 124, 140);
        g.textAlign = 'left'; g.fillStyle = '#2a2230'; g.font = '700 46px Fraunces, Georgia, serif'; g.fillText('Flirt Lessons', 196, 140);
        g.fillStyle = '#c63d57'; g.font = '600 34px Inter, sans-serif'; g.fillText('FRIEND ZONE QUIZ', 80, 320);
        g.fillStyle = '#675d63'; g.font = '400 48px Inter, sans-serif'; g.fillText('I got', 80, 410);
        var size = 128;
        do { g.font = 'italic 600 ' + size + 'px Fraunces, Georgia, serif'; size -= 4; } while (g.measureText(r.type.name).width > W - 160 && size > 60);
        g.fillStyle = '#c63d57'; g.fillText(r.type.name, 76, 550);
        g.fillStyle = '#2a2230'; g.font = '400 46px Inter, sans-serif';
        wrap(g, r.type.card, 80, 660, W - 160, 62);
        g.fillStyle = '#ffffff'; roundRect(g, 80, 830, W - 160, 230, 28); g.fill();
        g.strokeStyle = '#ebe2db'; g.lineWidth = 3; g.stroke();
        g.fillStyle = '#675d63'; g.font = '600 30px Inter, sans-serif'; g.fillText('INTEREST SIGNAL', 130, 910);
        g.textAlign = 'right'; g.fillStyle = '#1e1a1d'; g.font = '700 54px Fraunces, Georgia, serif'; g.fillText(r.signal + '%', W - 130, 915); g.textAlign = 'left';
        g.fillStyle = '#f4e9e4'; roundRect(g, 130, 960, W - 260, 36, 18); g.fill();
        g.fillStyle = '#c63d57'; roundRect(g, 130, 960, Math.max(36, (W - 260) * r.signal / 100), 36, 18); g.fill();
        g.fillStyle = '#2a2230'; g.font = '700 58px Fraunces, Georgia, serif'; g.fillText('Which one are you?', 80, 1200);
        g.fillStyle = '#c63d57'; g.font = '600 38px Inter, sans-serif'; g.fillText('flirtlessons.com/friend-zone-quiz', 80, 1265);
        return new Promise(function (res) { cv.toBlob(res, 'image/png'); });
      });
    }
    function wrap(g, text, x, y, maxW, lh) {
      var line = '';
      text.split(' ').forEach(function (word) {
        var test = line ? line + ' ' + word : word;
        if (g.measureText(test).width > maxW && line) { g.fillText(line, x, y); y += lh; line = word; } else { line = test; }
      });
      if (line) g.fillText(line, x, y);
    }
    function roundRect(g, x, y, w, h, rad) {
      g.beginPath(); g.moveTo(x + rad, y); g.arcTo(x + w, y, x + w, y + h, rad); g.arcTo(x + w, y + h, x, y + h, rad);
      g.arcTo(x, y + h, x, y, rad); g.arcTo(x, y, x + w, y, rad); g.closePath();
    }

    form.classList.add('ready');
  })(FLQuiz);
}
