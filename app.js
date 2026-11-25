/* Mood Player — plays your saved Instagram reels by mood, best ones first.
   All data stays in this phone's localStorage. */
(() => {
  'use strict';

  const STORE_KEY = 'moodplayer.v1';
  const RECENT_MS = 2 * 60 * 60 * 1000;           // don't repeat a reel within 2 hours
  const RATE_POINTS = { fire: 3, ok: 1, skip: -2 };
  const POST_RE = /https?:\/\/(?:www\.|m\.)?instagram\.com\/(?:[A-Za-z0-9_.]+\/)?(reels?|p|tv)\/([A-Za-z0-9_-]{5,})/gi;

  // ---------- state ----------
  const blank = () => ({ moods: [], reels: {}, current: null, settings: { autoNext: true } });
  let state = load();

  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(STORE_KEY));
      if (s && Array.isArray(s.moods) && s.reels) {
        s.settings = Object.assign({ autoNext: true }, s.settings);
        return s;
      }
    } catch (e) { /* fall through */ }
    return blank();
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
    catch (e) { toast('Phone storage for Mood Player is full. Remove a mood you don’t use.'); }
  }

  // ---------- helpers ----------
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const slug = (s) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'mood';
  const isAndroid = /Android/i.test(navigator.userAgent);

  function toast(msg) {
    const t = $('toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(() => (t.hidden = true), 2600);
  }

  function guessEmoji(name) {
    const n = name.toLowerCase();
    if (/song|music|lofi|beat|work|study/.test(n)) return '🎧';
    if (/confi|motiv|power|strong|self/.test(n)) return '💪';
    if (/feel|heart|love|sad|emotion/.test(n)) return '💭';
    if (/laugh|fun|funny|meme/.test(n)) return '😂';
    return '✨';
  }

  function extractPosts(text) {
    const out = [];
    const seen = new Set();
    let m;
    POST_RE.lastIndex = 0;
    while ((m = POST_RE.exec(text))) {
      const type = m[1].toLowerCase().startsWith('reel') ? 'reel' : m[1].toLowerCase();
      const id = m[2];
      if (!seen.has(id)) { seen.add(id); out.push({ type, id }); }
    }
    return out;
  }

  function getMood(id) { return state.moods.find((m) => m.id === id); }
  function moodReels(id) { return Object.values(state.reels).filter((r) => r.mood === id); }

  function ensureMood(name) {
    const clean = name.trim() || 'Saved';
    let m = state.moods.find((x) => x.name.toLowerCase() === clean.toLowerCase());
    if (!m) {
      let id = slug(clean), i = 2;
      while (getMood(id)) id = slug(clean) + '-' + i++;
      m = { id, name: clean, emoji: guessEmoji(clean) };
      state.moods.push(m);
    }
    return m;
  }

  let addSeq = 0;
  function addReel(moodId, post) {
    const key = moodId + '|' + post.id;
    const existing = state.reels[key];
    if (existing) {
      if (post.caption && !existing.caption) existing.caption = post.caption;
      return false;
    }
    state.reels[key] = { key, mood: moodId, id: post.id, type: post.type, score: 0, plays: 0,
      lastPlayed: 0, note: '', caption: post.caption || '', added: Date.now() + (addSeq++) / 1000 };
    return true;
  }

  const reelUrl = (r) => `https://www.instagram.com/${r.type}/${r.id}/`;

  // ---------- picking the next reel ----------
  function pickNext(moodId, bestOnly) {
    const all = moodReels(moodId);
    if (!all.length) return null;
    const now = Date.now();
    const curKey = state.current && state.current.key;
    let pool = all.filter((r) => r.key !== curKey && now - (r.lastPlayed || 0) > RECENT_MS);
    if (!pool.length) pool = all.filter((r) => r.key !== curKey);
    if (!pool.length) pool = all;

    const byBest = (a, b) => b.score - a.score || a.plays - b.plays || Math.random() - 0.5;
    const liked = pool.filter((r) => r.score > 0).sort(byBest);

    if (bestOnly && liked.length) return liked[0];

    const unrated = pool.filter((r) => r.plays === 0);
    // 70%: one of your proven reels (weighted by score). 30%: try a reel you haven't rated yet.
    if (liked.length && (!unrated.length || Math.random() < 0.7)) {
      const top = liked.slice(0, 10);
      const total = top.reduce((s, r) => s + r.score, 0);
      let x = Math.random() * total;
      for (const r of top) { x -= r.score; if (x <= 0) return r; }
      return top[0];
    }
    if (unrated.length) return unrated[Math.floor(Math.random() * unrated.length)];
    const rest = pool.slice().sort(byBest).slice(0, 5);
    return rest[Math.floor(Math.random() * rest.length)];
  }

  function openInInstagram(r) {
    r.lastPlayed = Date.now();
    state.current.opened = true;
    save();
    const web = reelUrl(r);
    if (isAndroid) {
      // Opens straight in the Instagram app; falls back to the browser if the app isn't installed.
      location.href = `intent://www.instagram.com/${r.type}/${r.id}/#Intent;scheme=https;package=com.instagram.android;S.browser_fallback_url=${encodeURIComponent(web)};end`;
    } else {
      window.open(web, '_blank', 'noopener');
    }
  }

  // ---------- routing ----------
  const screens = ['home', 'player', 'wall', 'add', 'settings'];
  function go(hash) { location.hash = hash; }

  function route() {
    const [name, a, b] = (location.hash.slice(1) || 'home').split('/');
    const screen = screens.includes(name) ? name : 'home';
    screens.forEach((s) => ($(s).hidden = s !== screen));
    $('backBtn').hidden = screen === 'home';
    $('settingsBtn').hidden = screen === 'settings';
    window.scrollTo(0, 0);
    if (screen === 'home') renderHome();
    if (screen === 'player') renderPlayer(decodeURIComponent(a || ''), b === 'best');
    if (screen === 'wall') renderWall(decodeURIComponent(a || ''));
    if (screen === 'add') renderAdd();
    if (screen === 'settings') renderSettings();
  }

  // ---------- HOME ----------
  function renderHome() {
    $('title').textContent = 'Mood Player';
    const list = $('moodList');
    const has = state.moods.length > 0;
    $('emptyState').hidden = has;
    $('homeHint').hidden = !has;
    list.innerHTML = state.moods.map((m) => {
      const rs = moodReels(m.id);
      const liked = rs.filter((r) => r.score > 0).length;
      return `
        <div>
          <button class="mood" data-mood="${esc(m.id)}">
            <span class="emoji">${esc(m.emoji)}</span>
            <span class="grow"><span class="name">${esc(m.name)}</span><br>
              <span class="count">${rs.length} reel${rs.length === 1 ? '' : 's'}${liked ? ` · ${liked} 🔥` : ''}</span></span>
            <span>▶</span>
          </button>
          ${liked ? `<div class="mood-actions" style="margin-top:8px">
            <button class="chip" data-best="${esc(m.id)}">⭐ Only my best</button>
            <button class="chip" data-wall="${esc(m.id)}">📜 Saved lines</button></div>` : ''}
        </div>`;
    }).join('');
  }

  // ---------- PLAYER ----------
  let playerBest = false;
  function renderPlayer(moodId, best) {
    const m = getMood(moodId);
    if (!m) return go('home');
    playerBest = best;
    $('title').textContent = (best ? '⭐ ' : '') + m.name;
    $('playerEmoji').textContent = m.emoji;

    let r = state.current && state.current.mood === moodId && state.reels[state.current.key];
    if (!r) {
      r = pickNext(moodId, best);
      if (!r) { toast('No reels in this mood yet'); return go('home'); }
      state.current = { mood: moodId, key: r.key, opened: false };
      save();
    }
    showReel(r);
  }

  function showReel(r) {
    const all = moodReels(r.mood);
    const idx = all.sort((a, b) => a.added - b.added).findIndex((x) => x.key === r.key) + 1;
    $('reelPos').textContent = `Reel ${idx} of ${all.length}`;
    $('reelScore').textContent = r.plays === 0 ? 'new' : r.score > 0 ? `🔥 ${r.score}` : `score ${r.score}`;
    $('noteInput').value = r.note || '';
    $('reelCaption').textContent = r.caption || '';
    $('reelCaption').hidden = !r.caption;
    $('watchBtn').textContent = state.current.opened ? '▶ Watch again' : '▶ Watch in Instagram';
  }

  function currentReel() { return state.current && state.reels[state.current.key]; }

  function rate(kind) {
    const r = currentReel();
    if (!r) return;
    r.score += RATE_POINTS[kind];
    r.plays += 1;
    if (!r.lastPlayed) r.lastPlayed = Date.now();
    const moodId = r.mood;
    const next = pickNext(moodId, playerBest);
    state.current = next ? { mood: moodId, key: next.key, opened: false } : null;
    save();
    toast(kind === 'fire' ? '🔥 Saved as a favourite' : kind === 'ok' ? '👍 Noted' : '⏭ Shown less often');
    if (!next) return go('home');
    if (state.settings.autoNext) openInInstagram(next);
    showReel(next);
  }

  // ---------- WALL ----------
  function renderWall(moodId) {
    const m = getMood(moodId);
    if (!m) return go('home');
    $('title').textContent = '📜 ' + m.name;
    const notes = moodReels(moodId).filter((r) => r.note).sort((a, b) => b.score - a.score);
    $('wallList').innerHTML = notes.length
      ? notes.map((r) => `<div class="quote">${esc(r.note)}<span class="src">
          <a href="${esc(reelUrl(r))}" style="color:inherit">open reel</a> · ${r.score > 0 ? '🔥 ' + r.score : 'unrated'}</span></div>`).join('')
      : '<p class="small">No saved lines yet. While watching, tap “✍ Save a line from this reel”.</p>';
  }

  // ---------- ADD ----------
  let pendingAdd = '';
  function renderAdd() {
    $('title').textContent = 'Add a reel';
    $('addUrl').value = pendingAdd;
    $('addMsg').textContent = '';
    $('addMoods').innerHTML = state.moods.map((m) =>
      `<button class="chip" data-addto="${esc(m.id)}">${esc(m.emoji)} ${esc(m.name)}</button>`).join('') +
      '<button class="chip" data-addto="__new">＋ New mood</button>';
  }

  function doAdd(moodId) {
    const posts = extractPosts($('addUrl').value);
    if (!posts.length) { $('addMsg').textContent = 'That doesn’t look like an Instagram reel link.'; return; }
    let m = getMood(moodId);
    if (moodId === '__new') {
      const name = prompt('Name for the new mood:');
      if (!name) return;
      m = ensureMood(name);
    }
    const added = posts.filter((p) => addReel(m.id, p)).length;
    save();
    pendingAdd = '';
    toast(added ? `Added to ${m.name}` : `Already in ${m.name}`);
    go('home');
  }

  // ---------- SETTINGS ----------
  function renderSettings() {
    $('title').textContent = 'Settings';
    $('autoNext').checked = !!state.settings.autoNext;
    $('moodAdmin').innerHTML = state.moods.length ? state.moods.map((m, i) => `
      <div class="mood-row">
        <input class="emoji-in" data-emoji="${esc(m.id)}" value="${esc(m.emoji)}" maxlength="4" aria-label="Emoji">
        <input class="name-in" data-name="${esc(m.id)}" value="${esc(m.name)}" aria-label="Mood name">
        <span class="n">${moodReels(m.id).length}</span>
        <button class="secondary" data-up="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Move up">↑</button>
        <button class="secondary" data-del="${esc(m.id)}" aria-label="Delete">🗑</button>
      </div>`).join('') : '<p class="small">No moods yet. Import from Instagram or add one below.</p>';
  }

  // Instagram stores text as UTF-8 bytes written out as single characters ("Indiað®ð³").
  // This turns it back into normal text and emoji.
  function fixText(s) {
    if (typeof s !== 'string' || !/[\u0080-ÿ]/.test(s)) return s;
    for (let i = 0; i < s.length; i++) if (s.charCodeAt(i) > 255) return s;
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(s, (c) => c.charCodeAt(0)));
    } catch (e) { return s; }
  }

  // Finds saved items shaped like { dict: [ {label:"URL", href}, {label:"Caption", value}, ... ] }.
  function findItems(node, out = []) {
    if (Array.isArray(node)) { node.forEach((n) => findItems(n, out)); return out; }
    if (!node || typeof node !== 'object') return out;
    if (Array.isArray(node.dict)) {
      const urlField = node.dict.find((x) => x && /^url$/i.test(x.label || '') && (x.href || x.value));
      if (urlField) {
        const cap = node.dict.find((x) => x && /caption/i.test(x.label || '') && typeof x.value === 'string');
        out.push({ url: urlField.href || urlField.value, caption: cap ? fixText(cap.value).trim().slice(0, 220) : '' });
        return out;
      }
    }
    Object.values(node).forEach((v) => findItems(v, out));
    return out;
  }

  function labelName(e) {
    if (!e || !Array.isArray(e.label_values)) return null;
    const lv = e.label_values.find((x) => x && /^(name|collection name)$/i.test(x.label || '') && typeof x.value === 'string' && !x.href);
    return lv ? fixText(lv.value).trim() : null;
  }

  // Reads an Instagram export file and returns [{ name, posts }] per collection (nothing saved yet).
  // Handles the current layout (each collection holds its items) and the older flat layout
  // (a "Collection" header row followed by its items).
  function parseExport(text) {
    let json = null;
    try { json = JSON.parse(text); } catch (e) { /* maybe HTML */ }
    const found = new Map(); // name -> Map(id -> post)
    const add = (name, post) => {
      const k = (name || 'Saved').trim() || 'Saved';
      if (!found.has(k)) found.set(k, new Map());
      const m = found.get(k);
      if (!m.has(post.id)) m.set(post.id, post);
    };

    if (json) {
      const entries = firstArray(json) || [];
      let current = null;
      for (const e of entries) {
        const name = labelName(e);
        const items = findItems(e);
        if (items.length) {
          const target = name || current;
          for (const it of items) for (const p of extractPosts(it.url)) add(target, { ...p, caption: it.caption });
          if (name) current = name;
          continue;
        }
        const posts = extractPosts(JSON.stringify(e));
        const header = headerName(e, posts.length);
        if (header) current = header;
        posts.forEach((p) => add(current, p));
      }
      if (!found.size) extractPosts(text).forEach((p) => add('Saved', p));
    } else {
      extractPosts(text).forEach((p) => add('Imported', p));
    }
    return [...found].map(([name, m]) => ({ name, posts: [...m.values()] }))
      .sort((a, b) => b.posts.length - a.posts.length);
  }

  function applyImport(groups, names) {
    let newReels = 0;
    const summary = [];
    for (const g of groups) {
      if (names && !names.includes(g.name)) continue;
      const m = ensureMood(g.name);
      newReels += g.posts.filter((p) => addReel(m.id, p)).length;
      summary.push(`${m.emoji} ${m.name}: ${g.posts.length}`);
    }
    save();
    return { newReels, summary };
  }

  function importInstagram(text) { return applyImport(parseExport(text)); }

  function firstArray(o) {
    if (Array.isArray(o)) return o;
    if (o && typeof o === 'object') {
      for (const v of Object.values(o)) if (Array.isArray(v) && v.length) return v;
      for (const v of Object.values(o)) { const a = firstArray(v); if (a) return a; }
    }
    return null;
  }

  function headerName(e, postCount) {
    if (!e || typeof e !== 'object') return null;
    const smd = e.string_map_data || {};
    const nameObj = smd.Name || smd['Collection name'] || smd.name;
    const isHeaderTitle = typeof e.title === 'string' && /collection/i.test(e.title);
    if (nameObj && typeof nameObj.value === 'string' && !nameObj.href && (isHeaderTitle || postCount === 0)) {
      return fixText(nameObj.value).trim();
    }
    if (Array.isArray(e.label_values)) {
      const lv = e.label_values.find((x) => x && /^(name|collection name|collection)$/i.test(x.label || '') && typeof x.value === 'string' && !x.href);
      if (lv && (isHeaderTitle || postCount === 0 || /collection/i.test(lv.label))) return fixText(lv.value).trim();
    }
    if (isHeaderTitle && postCount === 0 && typeof e.value === 'string') return e.value;
    return null;
  }

  function download(name, data) {
    const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  // ---------- events ----------
  document.addEventListener('click', (ev) => {
    const t = ev.target.closest('button, [data-go]');
    if (!t) return;
    const d = t.dataset;
    if (d.go) return go(d.go);
    if (d.mood) {
      if (!(state.current && state.current.mood === d.mood)) state.current = null;
      return go('player/' + encodeURIComponent(d.mood));
    }
    if (d.best) { state.current = null; return go('player/' + encodeURIComponent(d.best) + '/best'); }
    if (d.wall) return go('wall/' + encodeURIComponent(d.wall));
    if (d.rate) return rate(d.rate);
    if (d.addto) return doAdd(d.addto);
    if (d.up) {
      const i = +d.up; const ms = state.moods;
      [ms[i - 1], ms[i]] = [ms[i], ms[i - 1]]; save(); return renderSettings();
    }
    if (d.del) {
      const m = getMood(d.del);
      const n = moodReels(d.del).length;
      if (!confirm(`Delete “${m.name}” and its ${n} reels (with their ratings)? This can't be undone.`)) return;
      state.moods = state.moods.filter((x) => x.id !== d.del);
      for (const k of Object.keys(state.reels)) if (state.reels[k].mood === d.del) delete state.reels[k];
      if (state.current && state.current.mood === d.del) state.current = null;
      save(); return renderSettings();
    }
  });

  $('backBtn').onclick = () => (history.length > 1 ? history.back() : go('home'));
  $('settingsBtn').onclick = () => go('settings');
  $('watchBtn').onclick = () => { const r = currentReel(); if (r) { openInInstagram(r); showReel(r); } };
  $('saveNoteBtn').onclick = () => {
    const r = currentReel(); if (!r) return;
    r.note = $('noteInput').value.trim(); save(); toast(r.note ? 'Line saved' : 'Line removed');
  };
  $('wallBtn').onclick = () => { const r = currentReel(); if (r) go('wall/' + encodeURIComponent(r.mood)); };
  $('removeReelBtn').onclick = () => {
    const r = currentReel(); if (!r) return;
    if (!confirm('Remove this reel from Mood Player? (It stays saved in Instagram.)')) return;
    delete state.reels[r.key];
    const next = pickNext(r.mood, playerBest);
    state.current = next ? { mood: r.mood, key: next.key, opened: false } : null;
    save();
    if (next) showReel(next); else go('home');
  };

  document.addEventListener('input', (ev) => {
    const t = ev.target;
    if (t.dataset.emoji) { const m = getMood(t.dataset.emoji); m.emoji = t.value || '✨'; save(); }
    if (t.dataset.name) { const m = getMood(t.dataset.name); if (t.value.trim()) { m.name = t.value.trim(); save(); } }
  });

  $('autoNext').onchange = (e) => { state.settings.autoNext = e.target.checked; save(); };

  $('addMoodBtn').onclick = () => {
    const name = $('newMoodName').value.trim(); if (!name) return;
    ensureMood(name); save(); $('newMoodName').value = ''; renderSettings();
  };

  // Accepts either Instagram's downloaded .zip (finds saved_collections.json inside it) or the .json itself.
  async function readImportFile(f) {
    const head = new Uint8Array(await f.slice(0, 4).arrayBuffer());
    const isZip = head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04;
    if (isZip) {
      const files = await readZip(await f.arrayBuffer());
      const hit = files.find((z) => /(^|\/)saved_collections\.json$/i.test(z.name));
      if (!hit) {
        throw new Error(files.some((z) => /saved_collections\.html$/i.test(z.name))
          ? 'This download is in HTML format. Request it again in Instagram with Format: JSON.'
          : 'This zip has no saved_collections.json. When requesting the download, tick “Saved”.');
      }
      return hit.read();
    }
    if (/saved_(posts|music)\.json$/i.test(f.name)) {
      throw new Error(`${f.name} doesn't contain your collections. Pick saved_collections.json, or just pick the whole Instagram .zip.`);
    }
    return f.text();
  }

  // Minimal zip reader (stored + deflate), using the browser's built-in decompression.
  async function readZip(buf) {
    const dv = new DataView(buf);
    let eocd = -1;
    for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 65557); i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('That zip file looks damaged. Try downloading it from Instagram again.');
    const count = dv.getUint16(eocd + 10, true);
    let p = dv.getUint32(eocd + 16, true);
    const dec = new TextDecoder();
    const out = [];
    for (let n = 0; n < count && dv.getUint32(p, true) === 0x02014b50; n++) {
      const method = dv.getUint16(p + 10, true);
      const size = dv.getUint32(p + 20, true);
      const nameLen = dv.getUint16(p + 28, true);
      const extraLen = dv.getUint16(p + 30, true);
      const commentLen = dv.getUint16(p + 32, true);
      const local = dv.getUint32(p + 42, true);
      const name = dec.decode(new Uint8Array(buf, p + 46, nameLen));
      p += 46 + nameLen + extraLen + commentLen;
      const read = async () => {
        const start = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true);
        const data = new Blob([new Uint8Array(buf, start, size)]);
        if (method === 0) return data.text();
        if (method === 8) return new Response(data.stream().pipeThrough(new DecompressionStream('deflate-raw'))).text();
        throw new Error('This zip uses a format Mood Player can’t open. Extract it and pick saved_collections.json.');
      };
      out.push({ name, read });
    }
    return out;
  }

  // Step 1: read the file and show which collections were found, so the user picks which become moods.
  let pendingGroups = null;
  $('importFile').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    $('importMsg').textContent = 'Reading your file…';
    e.target.value = '';
    let text;
    try {
      text = await readImportFile(f);
    } catch (err) {
      $('importMsg').innerHTML = `⚠ ${esc(err.message)}`;
      return;
    }
    text = text.replace(/^﻿/, '');
    let isJson = true;
    try { JSON.parse(text); } catch (err) { isJson = false; }
    if (!isJson) {
      $('importMsg').innerHTML = `⚠ <b>${esc(f.name)}</b> is not the JSON file, so collections can't be separated.<br>
        Pick <b>saved_collections.json</b> (inside <i>your_instagram_activity → saved</i>). If you only have .html files,
        your Instagram download was made in HTML format: request it again with <b>Format: JSON</b>.`;
      return;
    }
    pendingGroups = parseExport(text);
    if (!pendingGroups.length) {
      $('importMsg').innerHTML = 'No reel links found in that file. Make sure it is <b>saved_collections.json</b>.';
      return;
    }
    const known = new Set(state.moods.map((m) => m.name.toLowerCase()));
    const preselect = (n) => known.has(n.toLowerCase()) || /confi|song|feel/i.test(n);
    $('importMsg').innerHTML = `
      <p>Found <b>${pendingGroups.length}</b> collections. Tick the ones you want as mood buttons:</p>
      <div class="pick-list">${pendingGroups.map((g, i) => `
        <label class="pick"><input type="checkbox" data-pick="${i}" ${preselect(g.name) ? 'checked' : ''}>
          <span>${esc(guessEmoji(g.name))} ${esc(g.name)}</span><span class="n">${g.posts.length}</span></label>`).join('')}
      </div>
      <button class="primary" id="doImportBtn" style="width:100%;margin-top:10px">Import ticked collections</button>`;
    $('doImportBtn').onclick = () => {
      const names = [...document.querySelectorAll('[data-pick]:checked')].map((c) => pendingGroups[+c.dataset.pick].name);
      if (!names.length) { toast('Tick at least one collection'); return; }
      const { newReels, summary } = applyImport(pendingGroups, names);
      pendingGroups = null;
      $('importMsg').innerHTML = `✅ Imported: ${summary.map(esc).join(' · ')}<br>${newReels} new reels added.`;
      renderSettings();
      toast(`${newReels} reels added`);
    };
  };

  $('exportBtn').onclick = () => {
    download(`mood-player-backup-${new Date().toISOString().slice(0, 10)}.json`, state);
    $('backupMsg').textContent = 'Backup saved to your Downloads.';
  };
  $('restoreFile').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const s = JSON.parse(await f.text());
      if (!Array.isArray(s.moods) || !s.reels) throw new Error('bad');
      if (!confirm('Replace everything on this phone with this backup?')) return;
      state = Object.assign(blank(), s); save(); toast('Backup restored'); renderSettings();
    } catch (err) { $('backupMsg').textContent = 'That file isn’t a Mood Player backup.'; }
    e.target.value = '';
  };

  // ---------- shared from Instagram (Android share menu) ----------
  (function handleShare() {
    const p = new URLSearchParams(location.search);
    const shared = [p.get('url'), p.get('text'), p.get('title')].filter(Boolean).join(' ');
    if (!shared) return;
    history.replaceState(null, '', location.pathname + '#add');
    const posts = extractPosts(shared);
    pendingAdd = posts.length ? reelUrl(posts[0]) : shared;
  })();

  window.addEventListener('hashchange', route);
  route();

  // Check for a new version each time the app opens; reload once when it has been installed.
  if ('serviceWorker' in navigator) {
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' })
      .then((reg) => reg.update()).catch(() => {});
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hadController && !reloaded) { reloaded = true; location.reload(); }
    });
  }

  // test hook (harmless in production)
  window.__moodPlayer = { importInstagram, parseExport, pickNext, get state() { return state; } };
})();
