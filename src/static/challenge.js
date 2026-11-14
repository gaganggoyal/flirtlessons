/* Flirt Lessons — The 3-Message Challenge.
 *
 * One fictional scenario, three rounds, four pre-written replies per round.
 * No AI and no backend: scoring is a transparent, hand-written rubric, and
 * nothing the player picks leaves the browser. Shares carry the score only.
 *
 * The data and scoring are pure functions (unit-tested in tests/challenge.test.js);
 * the UI at the bottom only runs in a browser on a page with #challenge.
 */
var FLChallenge = (function () {
  'use strict';

  var SCENARIO = {
    id: 'chai-momo-v1',
    name: 'Sam',
    profile: 'Will judge you by your chai order. Looking for someone to explore food stalls with.',
    rounds: [
      {
        prompt: 'You matched with Sam. Send the first message.',
        them: null,
        options: [
          { text: 'hey', points: 3, tags: ['lowEffort'],
            reply: 'hey 🙂',
            why: 'Gives Sam nothing to work with.' },
          { text: 'Hi Sam! How are you? What do you do? Where are you from?', points: 15, tags: ['interview'],
            reply: 'Haha, that’s a lot of questions at once! I’m good, I work in design.',
            why: 'Three questions in a row feels like a form, not a conversation.' },
          { text: 'Okay, before this goes any further: what’s your chai order? Choose wisely.', points: 33, tags: ['playful', 'callback'],
            reply: 'Masala, extra ginger, no sugar. Is that a pass or a fail?',
            why: 'Playful, easy to answer, and it picks up something from Sam’s profile.' },
          { text: 'You’re honestly the most beautiful person on this app.', points: 8, tags: ['tooMuch'],
            reply: 'Oh… thanks 😅',
            why: 'A big compliment before any real conversation feels generic and a bit intense.' }
        ]
      },
      {
        prompt: 'Sam changes the subject. Your reply?',
        them: 'Also, I just tried a chocolate momo at the night market. Life-changing or a crime?',
        options: [
          { text: 'lol', points: 3, tags: ['lowEffort'],
            reply: '…okay then 😄',
            why: 'A one-word reply lets the conversation fizzle.' },
          { text: 'Which night market? How often do you go? Who were you with?', points: 15, tags: ['interview'],
            reply: 'Haha, the one near the station. With friends!',
            why: 'Curious, but another round of rapid-fire questions.' },
          { text: 'I don’t really like momos. Last week I had the best pizza of my life at this place…', points: 10, tags: ['selfFocus'],
            reply: 'Ah, fair enough.',
            why: 'It skips Sam’s question and turns the focus to you.' },
          { text: 'Crime. Definitely a crime. But I need a full review: score out of 10, and be honest.', points: 33, tags: ['playful', 'question'],
            reply: 'A solid 7. Would eat again, would not tell my grandmother.',
            why: 'Takes a playful side, then asks a fun follow-up.' }
        ]
      },
      {
        prompt: 'Sam sounds busy. What do you send?',
        them: 'Honestly this week is chaos, deadlines everywhere 😩',
        options: [
          { text: 'Come on, just one drink. You can make time for me.', points: 0, tags: ['pressure'],
            reply: 'Hmm, I did just say I’m busy.',
            why: 'Pushing after someone says they’re busy reads as pressure, not confidence.' },
          { text: 'No pressure at all, good luck with the deadlines! Once they’re done, want to settle the momo debate in person? Next Saturday, my favourite stall?', points: 34, tags: ['respect', 'plan', 'callback'],
            reply: 'Deal. Saturday it is. I’m holding you to that stall.',
            why: 'Respects that Sam is busy, calls back the joke and suggests a clear plan.' },
          { text: 'Okay.', points: 6, tags: ['lowEffort'],
            reply: '😅',
            why: 'Ends the conversation without a next step.' },
          { text: 'We could maybe meet sometime? Whenever. Or not. Whatever works.', points: 15, tags: ['vague'],
            reply: 'Sure, maybe!',
            why: 'Kind, but so vague it’s hard to say yes to.' }
        ]
      }
    ]
  };

  var STRENGTHS = [ // priority order
    ['playful', 'Playful energy'],
    ['callback', 'Great listener'],
    ['question', 'Good questions'],
    ['plan', 'Clear plans'],
    ['respect', 'Respects boundaries']
  ];
  var WEAKNESSES = [ // priority order: the most important habit to fix comes first
    ['pressure', 'Pushes after a “busy”', 'When someone says they’re busy, give space and offer a later, specific plan.', '/body-language-signs-of-interest/', 'Body language & consent'],
    ['tooMuch', 'Too much, too soon', 'Let interest show through playfulness first; save big compliments for later.', '/what-is-flirting/', 'What flirting really is'],
    ['interview', 'Interview energy', 'Swap rapid-fire questions for one playful question, then react to the answer.', '/how-to-start-a-conversation/', 'How to start a conversation'],
    ['selfFocus', 'Talks about self', 'Ask a follow-up before sharing your own story.', '/attractive-habits/', 'Eight habits of great company'],
    ['vague', 'Vague plans', 'Suggest a day, time and place. It’s much easier to say yes to.', '/how-to-text-someone-you-like/', 'Texting lab'],
    ['lowEffort', 'Low effort', 'Give them something to reply to: a playful question or a callback.', '/how-to-text-someone-you-like/', 'Texting lab']
  ];
  var TIERS = [
    [85, 'Effortless charm', 'Playful, curious and respectful. Sam is already looking forward to Saturday.'],
    [60, 'Good vibes, small leaks', 'There’s real spark here, with one habit holding you back.'],
    [35, 'Polite but forgettable', 'Nothing wrong, but nothing memorable yet. Small tweaks make a big difference.'],
    [0, 'Time for a reset', 'Everyone starts somewhere. The tip below is the fastest win.']
  ];

  /** picks: array of option indexes, one per round. */
  function score(picks) {
    if (!Array.isArray(picks) || picks.length !== SCENARIO.rounds.length) throw new Error('need one pick per round');
    return picks.reduce(function (sum, p, r) {
      var opt = SCENARIO.rounds[r].options[p];
      if (!opt) throw new Error('bad pick ' + p + ' in round ' + r);
      return sum + opt.points;
    }, 0);
  }

  function summarize(picks) {
    var total = score(picks);
    var tags = {};
    picks.forEach(function (p, r) {
      SCENARIO.rounds[r].options[p].tags.forEach(function (t) { tags[t] = (tags[t] || 0) + 1; });
    });
    function best(list) {
      var top = null;
      list.forEach(function (row) { if (tags[row[0]] && (!top || tags[row[0]] > tags[top[0]])) top = row; });
      return top;
    }
    // Strength: the most frequent positive habit. Weakness: the most important
    // negative habit present (priority order), so pressure is never out-voted.
    var s = best(STRENGTHS);
    var w = WEAKNESSES.filter(function (row) { return tags[row[0]]; })[0] || null;
    var tier = TIERS.filter(function (t) { return total >= t[0]; })[0];
    return {
      score: total,
      title: tier[1],
      blurb: tier[2],
      strength: s ? s[1] : 'Showing up. The rest is practice.',
      weakness: w ? w[1] : 'None in this chat',
      tip: w ? w[2] : 'You nailed it. Challenge a friend and see if they can match you.',
      tipHref: w ? w[3] : null,
      tipLabel: w ? w[4] : null,
      breakdown: picks.map(function (p, r) {
        var o = SCENARIO.rounds[r].options[p];
        var max = Math.max.apply(null, SCENARIO.rounds[r].options.map(function (x) { return x.points; }));
        return { round: r + 1, text: o.text, points: o.points, max: max, why: o.why };
      })
    };
  }

  /** ?beat=NN from a friend's share link -> integer 0..100, or null. */
  function parseBeat(search) {
    var m = /[?&]beat=(\d{1,3})(?:&|$)/.exec(search || '');
    if (!m) return null;
    var n = parseInt(m[1], 10);
    return n >= 0 && n <= 100 ? n : null;
  }

  /** Share payload: score only, never the conversation. */
  function shareText(total) {
    return 'I scored ' + total + '/100 on the Flirt Lessons 3-message challenge. Can you beat me?';
  }
  function shareUrl(total, base) {
    return (base || 'https://flirtlessons.com') + '/rizz-test/?beat=' + total + '&utm_source=share&utm_medium=challenge';
  }

  function scoreBucket(total) {
    var lo = Math.min(90, Math.floor(total / 10) * 10);
    return lo + '-' + (lo === 90 ? 100 : lo + 9);
  }

  return { SCENARIO: SCENARIO, score: score, summarize: summarize, parseBeat: parseBeat,
           shareText: shareText, shareUrl: shareUrl, scoreBucket: scoreBucket };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = FLChallenge;
} else if (typeof document !== 'undefined') {
  (function (C) {
    'use strict';
    var root = document.getElementById('challenge');
    if (!root) return;
    var track = window.flTrack || function () {};
    var S = C.SCENARIO;
    var beat = C.parseBeat(location.search);
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var picks = [], started = false, completed = false, shared = false;

    var intro = root.querySelector('[data-intro]');
    var chat = root.querySelector('[data-chat]');
    var log = root.querySelector('[data-log]');
    var choices = root.querySelector('[data-choices]');
    var promptEl = root.querySelector('[data-prompt]');
    var progress = root.querySelector('[data-progress]');
    var result = root.querySelector('[data-result]');

    function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
    function bubble(who, text) {
      var b = el('div', 'bubble ' + (who === 'you' ? 'you' : 'them'), text);
      log.appendChild(b);
      b.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
      return b;
    }
    function later(fn, ms) { return reduced ? fn() : setTimeout(fn, ms); }

    if (beat !== null) {
      var banner = root.querySelector('[data-beat]');
      banner.textContent = 'A friend scored ' + beat + '/100. Can you beat them?';
      banner.hidden = false;
      track('referred_visit', { scn: S.id });
    }

    function start() {
      if (!started) { started = true; track('challenge_start', { scn: S.id, ref: beat !== null ? 'beat' : '' }); }
      picks = []; completed = false; shared = false;
      intro.hidden = true; result.hidden = true; chat.hidden = false;
      log.textContent = '';
      showRound(0);
    }

    function showRound(r) {
      var round = S.rounds[r];
      progress.textContent = 'Message ' + (r + 1) + ' of ' + S.rounds.length;
      promptEl.textContent = round.prompt;
      choices.textContent = '';
      var go = function () {
        round.options.forEach(function (opt, i) {
          var btn = el('button', 'choice', opt.text);
          btn.type = 'button';
          btn.addEventListener('click', function () { choose(r, i); });
          choices.appendChild(btn);
        });
        var first = choices.querySelector('button'); if (first && r > 0) first.focus({ preventScroll: true });
      };
      if (round.them) { later(function () { bubble('them', round.them); go(); }, 450); } else { go(); }
    }

    function choose(r, i) {
      picks[r] = i;
      choices.textContent = '';
      var opt = S.rounds[r].options[i];
      bubble('you', opt.text);
      later(function () {
        bubble('them', opt.reply);
        if (r + 1 < S.rounds.length) later(function () { showRound(r + 1); }, 500);
        else later(finish, 650);
      }, 600);
    }

    function finish() {
      var s = C.summarize(picks);
      chat.hidden = true;
      result.hidden = false;
      result.querySelector('[data-score]').textContent = s.score;
      result.querySelector('[data-title]').textContent = s.title;
      result.querySelector('[data-blurb]').textContent = s.blurb;
      result.querySelector('[data-strength]').textContent = s.strength;
      result.querySelector('[data-weakness]').textContent = s.weakness;
      var tip = result.querySelector('[data-tip]');
      tip.textContent = s.tip + ' ';
      if (s.tipHref) { var a = el('a', null, 'Read: ' + s.tipLabel + ' →'); a.href = s.tipHref; tip.appendChild(a); }
      var cmp = result.querySelector('[data-compare]');
      if (beat !== null) {
        cmp.hidden = false;
        cmp.textContent = s.score > beat ? 'You beat your friend by ' + (s.score - beat) + ' points. 🎉'
          : s.score === beat ? 'Dead heat with your friend. Rematch?'
          : 'Your friend wins this round, by ' + (beat - s.score) + ' points.';
      } else { cmp.hidden = true; }
      var list = result.querySelector('[data-breakdown]');
      list.textContent = '';
      s.breakdown.forEach(function (b) {
        var li = el('li');
        li.appendChild(el('span', 'bd-pts', b.points + '/' + b.max));
        var body = el('div');
        body.appendChild(el('p', 'bd-text', '“' + b.text + '”'));
        body.appendChild(el('p', 'bd-why', b.why));
        li.appendChild(body);
        list.appendChild(li);
      });
      result.querySelector('h2').focus({ preventScroll: true });
      result.scrollIntoView({ block: 'start', behavior: reduced ? 'auto' : 'smooth' });
      if (!completed) {
        completed = true;
        track('challenge_complete', { scn: S.id, sb: C.scoreBucket(s.score), ref: beat !== null ? 'beat' : '' });
        if (beat !== null) track('referred_completion', { scn: S.id });
      }
      wireShare(s);
    }

    function wireShare(s) {
      // result_share: at most once per completed attempt (the funnel metric).
      // result_share_click: every click, with the channel (diagnostics only).
      function shareClick(via) {
        if (!shared) { shared = true; track('result_share', { scn: S.id, via: via }); }
        track('result_share_click', { scn: S.id, via: via });
      }
      var url = C.shareUrl(s.score, location.origin.indexOf('flirtlessons.com') > -1 ? location.origin : undefined);
      var text = C.shareText(s.score);
      var status = result.querySelector('[data-share-status]');
      var native = result.querySelector('[data-share-native]');
      native.hidden = !navigator.share;
      native.onclick = function () {
        shareClick('native');
        navigator.share({ title: 'The 3-Message Challenge', text: text, url: url })
          .then(function () { track('result_share_complete', { scn: S.id, via: 'native' }); })
          .catch(function () {});
      };
      result.querySelector('[data-share-wa]').href = 'https://wa.me/?text=' + encodeURIComponent(text + ' ' + url);
      result.querySelector('[data-share-wa]').onclick = function () { shareClick('whatsapp'); };
      result.querySelector('[data-share-x]').href = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(text) + '&url=' + encodeURIComponent(url);
      result.querySelector('[data-share-x]').onclick = function () { shareClick('x'); };
      result.querySelector('[data-copy]').onclick = function () {
        shareClick('copy');
        var done = function () { status.textContent = 'Link copied. Send it to a friend!'; };
        if (navigator.clipboard) navigator.clipboard.writeText(text + ' ' + url).then(done, function () { status.textContent = url; });
        else status.textContent = url;
      };
      result.querySelector('[data-download]').onclick = function () {
        track('result_card_download', { scn: S.id });
        drawCard(s).then(function (blob) {
          var a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = 'flirt-lessons-challenge-' + s.score + '.png';
          document.body.appendChild(a); a.click(); a.remove();
          setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
        });
      };
    }

    /* 1080x1350 result card, drawn locally. Contains the score and labels only. */
    function drawCard(s) {
      var W = 1080, H = 1350, cv = document.createElement('canvas');
      cv.width = W; cv.height = H;
      var g = cv.getContext('2d');
      var fontsReady = document.fonts && document.fonts.load
        ? Promise.all(['700 120px Fraunces', 'italic 600 64px Fraunces', '600 40px Inter', '400 36px Inter'].map(function (f) { return document.fonts.load(f); })).catch(function () {})
        : Promise.resolve();
      return fontsReady.then(function () {
        g.fillStyle = '#fbf8f5'; g.fillRect(0, 0, W, H);
        g.fillStyle = '#c63d57'; roundRect(g, 80, 80, 88, 88, 22); g.fill();
        g.fillStyle = '#fff'; g.font = 'italic 700 48px Fraunces, Georgia, serif'; g.textAlign = 'center'; g.fillText('fl', 124, 140);
        g.textAlign = 'left'; g.fillStyle = '#2a2230'; g.font = '700 46px Fraunces, Georgia, serif'; g.fillText('Flirt Lessons', 196, 140);
        g.fillStyle = '#c63d57'; g.font = '600 34px Inter, sans-serif'; g.fillText('THE 3-MESSAGE CHALLENGE', 80, 300);
        g.fillStyle = '#2a2230'; g.font = '700 300px Fraunces, Georgia, serif'; g.fillText(String(s.score), 70, 590);
        var w = g.measureText(String(s.score)).width;
        g.fillStyle = '#675d63'; g.font = '600 90px Fraunces, Georgia, serif'; g.fillText('/100', 90 + w, 590);
        g.fillStyle = '#c63d57'; g.font = 'italic 600 76px Fraunces, Georgia, serif'; g.fillText(s.title, 80, 720);
        g.fillStyle = '#ffffff'; roundRect(g, 80, 790, W - 160, 300, 28); g.fill();
        g.strokeStyle = '#ebe2db'; g.lineWidth = 3; g.stroke();
        g.fillStyle = '#675d63'; g.font = '600 30px Inter, sans-serif'; g.fillText('STRENGTH', 130, 870); g.fillText('WATCH OUT FOR', 130, 1000);
        g.fillStyle = '#1e1a1d'; g.font = '600 46px Inter, sans-serif'; g.fillText(s.strength, 130, 930); g.fillText(s.weakness, 130, 1060);
        g.fillStyle = '#2a2230'; g.font = '700 58px Fraunces, Georgia, serif'; g.fillText('Can you beat me?', 80, 1200);
        g.fillStyle = '#c63d57'; g.font = '600 38px Inter, sans-serif'; g.fillText('flirtlessons.com/rizz-test', 80, 1265);
        return new Promise(function (res) { cv.toBlob(res, 'image/png'); });
      });
    }
    function roundRect(g, x, y, w, h, r) {
      g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
      g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
    }

    root.querySelector('[data-start]').addEventListener('click', start);
    root.querySelector('[data-again]').addEventListener('click', start);
    root.classList.add('ready');
  })(FLChallenge);
}
