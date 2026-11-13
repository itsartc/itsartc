/* Hayzel onboarding demo: shared logic.
   Works in the browser (window.HZ) and in Node (module.exports) for unit checks.
   Standalone demo: no Hayzel backend, no database. */
(function (root) {
  'use strict';

  var HZ = {};

  /* ---------- escaping ---------- */
  HZ.esc = function (v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };

  /* ---------- CSV ---------- */
  // RFC 4180 style: quoted fields, commas/newlines inside quotes, "" escapes, CRLF or LF.
  HZ.parseCSV = function (text) {
    text = String(text || '');
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    var rows = [], row = [], field = '', i = 0, n = text.length, inQ = false, c;
    while (i < n) {
      c = text[i];
      if (inQ) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
          inQ = false; i++; continue;
        }
        field += c; i++; continue;
      }
      if (c === '"') { inQ = true; i++; continue; }
      if (c === ',') { row.push(field); field = ''; i++; continue; }
      if (c === '\r') { i++; if (text[i] === '\n') i++; row.push(field); rows.push(row); row = []; field = ''; continue; }
      if (c === '\n') { i++; row.push(field); rows.push(row); row = []; field = ''; continue; }
      field += c; i++;
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    // drop fully empty rows
    return rows.filter(function (r) { return r.some(function (f) { return String(f).trim() !== ''; }); });
  };

  HZ.normHeader = function (h) {
    return String(h || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  };

  var FIELDS = {
    id: ['reference', 'ref', 'listing_id', 'listing_reference', 'id'],
    agent: ['agent_name', 'agent', 'listing_agent'],
    building: ['building', 'building_name', 'property_name', 'tower', 'project'],
    title: ['title', 'listing_title', 'headline'],
    community: ['community', 'area', 'location', 'district', 'neighbourhood'],
    unit: ['unit', 'unit_number', 'unit_no'],
    type: ['property_type', 'type'],
    beds: ['bedrooms', 'beds'],
    baths: ['bathrooms', 'baths'],
    size: ['size_sqft', 'size', 'area_sqft', 'sqft'],
    price: ['price_aed', 'price', 'rent', 'annual_rent'],
    period: ['price_period'],
    furnishing: ['furnishing'],
    cheques: ['cheques'],
    selfView: ['self_viewing']
  };
  var PHOTO_KEYS = [
    ['photo_1', 'photo_url_1', 'image_1', 'photo_url', 'image', 'photo'],
    ['photo_2', 'photo_url_2', 'image_2'],
    ['photo_3', 'photo_url_3', 'image_3']
  ];

  function pick(rec, keys) {
    for (var i = 0; i < keys.length; i++) {
      var v = rec[keys[i]];
      if (v != null && String(v).trim() !== '') return String(v).trim();
    }
    return '';
  }

  HZ.isHttp = function (v) { return /^https?:\/\/\S+$/i.test(String(v || '').trim()); };

  HZ.mapRows = function (rows) {
    if (!rows || rows.length < 1) return [];
    var headers = rows[0].map(HZ.normHeader);
    var hasSelf = headers.indexOf('self_viewing') !== -1;
    var out = [];
    for (var r = 1; r < rows.length; r++) {
      var rec = {};
      headers.forEach(function (h, i) { if (h && !(h in rec && rec[h] !== '')) rec[h] = rows[r][i] == null ? '' : rows[r][i]; });
      var L = {};
      Object.keys(FIELDS).forEach(function (k) { L[k] = pick(rec, FIELDS[k]); });
      if (!L.id) L.id = 'row-' + r;
      var priceRaw = L.price.replace(/\.\d{1,2}\s*$/, '');
      L.price = priceRaw.replace(/[^0-9]/g, '');
      L.price = L.price ? parseInt(L.price, 10) : null;
      var p = L.period.toLowerCase();
      L.period = /sale|buy/.test(p) ? 'sale' : /month/.test(p) ? 'month' : 'year';
      if (hasSelf) L.selfView = /^(yes|y|true|1)$/i.test(L.selfView);
      else L.selfView = true;
      var photos = [];
      PHOTO_KEYS.forEach(function (keys) {
        var v = pick(rec, keys);
        if (HZ.isHttp(v) && photos.indexOf(v) === -1) photos.push(v);
      });
      L.photos = photos;
      L.row = r;
      out.push(L);
    }
    return out;
  };

  HZ.parseListings = function (csvText) { return HZ.mapRows(HZ.parseCSV(csvText)); };

  /* ---------- formatting ---------- */
  HZ.fmtBeds = function (b) {
    var s = String(b == null ? '' : b).trim();
    if (s === '') return '';
    if (/studio/i.test(s)) return 'Studio';
    var n = parseFloat(s);
    if (isNaN(n)) return s;
    if (n === 0) return 'Studio';
    return n === 1 ? '1 bed' : n + ' beds';
  };
  HZ.fmtBaths = function (b) {
    var s = String(b == null ? '' : b).trim();
    if (!s) return '';
    var n = parseFloat(s);
    if (isNaN(n)) return s;
    return n === 1 ? '1 bath' : n + ' baths';
  };
  HZ.fmtNum = function (n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); };
  HZ.fmtPrice = function (L) {
    if (L.price == null || L.price === '') return '';
    var suffix = L.period === 'sale' ? '' : L.period === 'month' ? '/month' : '/year';
    return 'AED ' + HZ.fmtNum(L.price) + suffix;
  };
  HZ.fmtSize = function (s) {
    s = String(s || '').trim();
    if (!s) return '';
    var n = parseFloat(s.replace(/,/g, ''));
    return isNaN(n) ? s : HZ.fmtNum(Math.round(n)) + ' sq ft';
  };
  HZ.buildingName = function (L) { return L.building || L.title || 'Property'; };
  HZ.cardSub = function (L) { return [HZ.fmtBeds(L.beds), L.community].filter(Boolean).join(', '); };

  HZ.initials = function (name) {
    var parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    var s = parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '');
    return s.toUpperCase();
  };
  HZ.slug = function (s) {
    return String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'agent';
  };
  HZ.firstName = function (s) { return String(s || '').trim().split(/\s+/)[0] || ''; };

  HZ.agents = function (listings) {
    var map = {}, order = [];
    (listings || []).forEach(function (L) {
      if (!L.agent) return;
      var k = L.agent.toLowerCase();
      if (!map[k]) { map[k] = { name: L.agent, total: 0, self: 0 }; order.push(k); }
      map[k].total++;
      if (L.selfView) map[k].self++;
    });
    return order.map(function (k) { return map[k]; });
  };
  HZ.agentListings = function (listings, agent) {
    var a = String(agent || '').trim().toLowerCase();
    return (listings || []).filter(function (L) { return L.selfView && L.agent.trim().toLowerCase() === a; }).slice().reverse();
  };
  HZ.stats = function (listings) {
    return {
      listings: listings.length,
      agents: HZ.agents(listings).length,
      self: listings.filter(function (L) { return L.selfView; }).length,
      noPhotos: listings.filter(function (L) { return !L.photos.length; }).length
    };
  };

  /* ---------- sample data ---------- */
  HZ.SAMPLE_CSV = [
    'Reference,Agent Name,Building,Community,Unit,Property Type,Bedrooms,Bathrooms,Size (sqft),Price (AED),Price Period,Furnishing,Cheques,Self Viewing,Photo 1,Photo 2,Photo 3',
    'HZ-1001,Sara Khan,Marina Crest Tower,Dubai Marina,1408,Apartment,1,2,812,"135,000",yearly,Furnished,4,yes,{O}/img/living.jpg,{O}/img/bedroom.jpg,{O}/img/kitchen.jpg',
    'HZ-1002,Omar Haddad,Creekside Residences,Dubai Creek Harbour,2203,Apartment,2,2,1150,"185,000",yearly,Unfurnished,2,yes,{O}/img/bedroom.jpg,{O}/img/living.jpg,',
    'HZ-1003,Sara Khan,The Lofts East,Downtown Dubai,906,Apartment,studio,1,480,"8,500",monthly,Furnished,12,yes,{O}/img/kitchen.jpg,{O}/img/living.jpg,',
    'HZ-1004,Sara Khan,Bay Square 7,Business Bay,512,Apartment,1,1,760,"1,450,000",sale,Unfurnished,,yes,{O}/img/living.jpg,{O}/img/kitchen.jpg,{O}/img/bedroom.jpg'
  ].join('\n');
  HZ.sampleListings = function (origin) {
    var o = origin || (typeof location !== 'undefined' ? location.origin : '');
    return HZ.parseListings(HZ.SAMPLE_CSV.replace(/\{O\}/g, o));
  };

  /* ---------- base64url + config ---------- */
  function utf8ToB64(str) {
    var bytes = new TextEncoder().encode(str), bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }
  function b64ToUtf8(b64) {
    var bin = atob(b64), bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  }
  HZ.b64urlEncode = function (str) { return utf8ToB64(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
  HZ.b64urlDecode = function (s) {
    s = String(s || '').replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    return b64ToUtf8(s);
  };

  HZ.SHEET_RE = /^https:\/\/docs\.google\.com\/spreadsheets\/d\/e\/([A-Za-z0-9_-]+)\/pub\?(.*)$/;
  HZ.compressSource = function (src) {
    if (!src || src === 'sample') return 'sample';
    var m = HZ.SHEET_RE.exec(src);
    if (m) {
      var gid = (/(?:^|&)gid=(\d+)/.exec(m[2]) || [])[1] || '0';
      return 'g:' + m[1] + ':' + gid;
    }
    return 'u:' + src;
  };
  HZ.expandSource = function (s) {
    if (!s || s === 'sample') return 'sample';
    if (s.indexOf('g:') === 0) {
      var p = s.slice(2).split(':');
      return 'https://docs.google.com/spreadsheets/d/e/' + p[0] + '/pub?gid=' + (p[1] || '0') + '&single=true&output=csv';
    }
    if (s.indexOf('u:') === 0) return s.slice(2);
    return null;
  };

  HZ.encodeConfig = function (cfg) {
    var o = { v: 1, s: cfg.s, a: cfg.a, g: cfg.g, h: cfg.h };
    if (cfg.l) o.l = cfg.l;
    if (cfg.p) o.p = cfg.p;
    return HZ.b64urlEncode(JSON.stringify(o));
  };
  HZ.decodeConfig = function (str) {
    try {
      var o = JSON.parse(HZ.b64urlDecode(str));
      if (!o || o.v !== 1 || typeof o.a !== 'string' || !o.a.trim() || typeof o.s !== 'string') return null;
      if (!Array.isArray(o.h) || o.h.length !== 2) o.h = [10, 19];
      o.h = [Number(o.h[0]), Number(o.h[1])];
      if (!(o.h[0] >= 0 && o.h[1] <= 24 && o.h[1] > o.h[0])) o.h = [10, 19];
      if (o.l && !HZ.isHttp(o.l)) delete o.l;
      if (o.p && !HZ.isHttp(o.p)) delete o.p;
      o.g = typeof o.g === 'string' ? o.g : '';
      return o;
    } catch (e) { return null; }
  };
  HZ.buildLink = function (origin, cfg) {
    return origin + '/b/' + HZ.slug(cfg.a) + '?c=' + HZ.encodeConfig(cfg);
  };
  HZ.defaultMessage = function (link) {
    return "Prefer to view it on your own time? Book a self-guided viewing here: " + link;
  };

  /* ---------- listings loading ---------- */
  HZ.fetchSheet = function (url) {
    return fetch('/api/csv?url=' + encodeURIComponent(url)).then(function (r) {
      return r.text().then(function (t) {
        if (!r.ok) throw new Error(t || 'Could not load the sheet.');
        return HZ.parseListings(t);
      });
    }, function () { throw new Error('Could not reach the server. Check your connection and try again.'); });
  };
  HZ.loadSource = function (s) {
    var src = HZ.expandSource(s);
    if (src === 'sample') return Promise.resolve(HZ.sampleListings());
    if (!src) return Promise.reject(new Error('Unknown listings source.'));
    return HZ.fetchSheet(src);
  };

  /* ---------- hashing ---------- */
  HZ.fnv = function (str) {
    var h = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h >>> 0;
  };
  HZ.isBusy = function (agent, dateKey, time) {
    return HZ.fnv(String(agent).toLowerCase() + '|' + dateKey + '|' + time) % 100 < 35;
  };

  /* ---------- storage ---------- */
  HZ.store = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) {} }
  };

  /* ---------- clipboard ---------- */
  HZ.copy = function (text) {
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      var ok = false; try { ok = document.execCommand('copy'); } catch (e) {}
      document.body.removeChild(ta);
      return ok ? Promise.resolve() : Promise.reject(new Error('copy failed'));
    }
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text).catch(fallback);
    return fallback();
  };
  HZ.flash = function (btn, label) {
    var old = btn.getAttribute('data-label') || btn.textContent;
    btn.setAttribute('data-label', old);
    btn.textContent = label || 'Copied';
    btn.classList.add('is-done');
    clearTimeout(btn._t);
    btn._t = setTimeout(function () { btn.textContent = old; btn.classList.remove('is-done'); }, 1600);
  };

  /* ---------- shared rendering ---------- */
  // Image stack: initials underneath, images on top remove themselves if they fail.
  HZ.imgStack = function (cls, initials, urls) {
    var h = '<span class="' + cls + '"><span class="ini" aria-hidden="true">' + HZ.esc(initials) + '</span>';
    urls.slice().reverse().forEach(function (u) {
      if (HZ.isHttp(u) || /^\//.test(u)) h += '<img src="' + HZ.esc(u) + '" alt="" loading="lazy" onerror="this.remove()">';
    });
    return h + '</span>';
  };

  HZ.chevron = '<svg class="chev" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  HZ.cardHTML = function (L, tag) {
    tag = tag || 'button';
    var attrs = tag === 'button' ? ' type="button" data-id="' + HZ.esc(L.id) + '"' : ' aria-hidden="true"';
    return '<' + tag + ' class="pcard"' + attrs + '>' +
      HZ.imgStack('thumb', HZ.initials(HZ.buildingName(L)), L.photos.slice(0, 1)) +
      '<span class="pcard-body"><span class="pcard-title">' + HZ.esc(HZ.buildingName(L)) + '</span>' +
      '<span class="pcard-sub">' + HZ.esc(HZ.cardSub(L)) + '</span>' +
      '<span class="pcard-price">' + HZ.esc(HZ.fmtPrice(L)) + '</span></span>' + HZ.chevron + '</' + tag + '>';
  };

  HZ.profileHTML = function (o) {
    var list = o.listings || [];
    var cards = list.length
      ? list.map(function (L) { return HZ.cardHTML(L, o.preview ? 'div' : 'button'); }).join('')
      : '<p class="empty">No properties are open for self-viewing right now.</p>';
    return '<section class="profile">' +
      HZ.imgStack('avatar', HZ.initials(o.agent), [o.photo, o.logo].filter(Boolean)) +
      '<h1 class="p-name">' + HZ.esc(o.agent || 'Your name') + '</h1>' +
      (o.agency ? '<p class="p-agency">' + HZ.esc(o.agency) + '</p>' : '') +
      '<p class="p-intro">Pick the property you’d like to see. You’ll view it on your own, at a time that suits you.</p>' +
      '</section><div class="cards">' + cards + '</div>' +
      '<footer class="b-foot"><span>Self-viewing by <b class="wordmark">hayzel</b></span><small>Demo only</small></footer>';
  };

  HZ.shortLinkInText = function (msg) {
    return String(msg || '').replace(/https?:\/\/([^\s/]+)(\/b\/[^\s?]*)\S*/g, function (_, host, path) { return host + path + '…'; });
  };

  HZ.guideHTML = function (message) {
    var msg = HZ.esc(HZ.shortLinkInText(message));
    var bar = '<div class="mp-status"><span></span><span></span></div>';
    return '<ol class="guide">' +
      '<li><div class="mp" aria-hidden="true">' + bar +
        '<div class="mp-head"><span class="mp-back">‹</span>Business tools</div>' +
        '<div class="mp-crumb">Settings › Business tools</div>' +
        '<div class="mp-row"><i></i>Business profile</div>' +
        '<div class="mp-row"><i></i>Catalogue</div>' +
        '<div class="mp-row"><i></i>Away message</div>' +
        '<div class="mp-row is-hl"><i></i>Quick replies<span class="mp-tap"></span></div>' +
        '<div class="mp-row"><i></i>Labels</div>' +
      '</div><p><b>1.</b> Open <b>Settings</b>, then <b>Business tools</b>, then <b>Quick replies</b>.</p></li>' +
      '<li><div class="mp" aria-hidden="true">' + bar +
        '<div class="mp-head"><span class="mp-back">‹</span>Add quick reply</div>' +
        '<div class="mp-label">Message</div><div class="mp-field mp-msg">' + msg + '</div>' +
        '<div class="mp-label">Shortcut</div><div class="mp-field is-hl">/view</div>' +
        '<div class="mp-save">Save</div>' +
      '</div><p><b>2.</b> Tap <b>Add</b>, paste your message, set the shortcut to <b>/view</b>, then <b>Save</b>.</p></li>' +
      '<li><div class="mp" aria-hidden="true">' + bar +
        '<div class="mp-head"><span class="mp-ava"></span>Buyer</div>' +
        '<div class="mp-chat"><div class="bub in">Hi, is the 1 bed still available? Can I see it?</div>' +
        '<div class="mp-sugg is-hl"><b>/view</b> ' + msg + '</div></div>' +
        '<div class="mp-input"><span>/</span><i class="caret"></i></div>' +
      '</div><p><b>3.</b> In any chat, type <b>/</b> and pick <b>/view</b>. Your link is sent.</p></li>' +
      '</ol>';
  };

  // Decorative QR-like pattern seeded from a key (not a real code).
  HZ.qrLikeSVG = function (key, size) {
    var N = 25, cell = 4, s = HZ.fnv(String(key)) || 1, out = [];
    function rnd() { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }
    function inFinder(x, y) {
      return (x < 8 && y < 8) || (x >= N - 8 && y < 8) || (x < 8 && y >= N - 8);
    }
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) {
      if (inFinder(x, y)) continue;
      if (rnd() < 0.48) out.push('<rect x="' + x * cell + '" y="' + y * cell + '" width="' + cell + '" height="' + cell + '"/>');
    }
    var vb = N * cell;
    return '<svg class="qrlike" viewBox="-4 -4 ' + (vb + 8) + ' ' + (vb + 8) + '" width="' + (size || 120) + '" height="' + (size || 120) + '" role="img" aria-label="Visitor pass code (demo)">' +
      '<rect x="-4" y="-4" width="' + (vb + 8) + '" height="' + (vb + 8) + '" rx="6" fill="#fff"/><g fill="#15282C" color="#15282C">' +
            out.join('') +
      finderBox(0, 0) + finderBox(N - 7, 0) + finderBox(0, N - 7) + '</g></svg>';
    function finderBox(fx, fy) {
      var X = fx * cell, Y = fy * cell;
      return '<path d="M' + X + ' ' + Y + 'h28v28h-28z M' + (X + 4) + ' ' + (Y + 4) + 'v20h20v-20z" fill-rule="evenodd"/>' +
        '<rect x="' + (X + 8) + '" y="' + (Y + 8) + '" width="12" height="12"/>';
    }
  };

  /* ---------- dates ---------- */
  HZ.pad = function (n) { return (n < 10 ? '0' : '') + n; };
  HZ.dateKey = function (d) { return d.getFullYear() + '-' + HZ.pad(d.getMonth() + 1) + '-' + HZ.pad(d.getDate()); };
  HZ.fmtTime = function (t) { // "14:30" -> "2:30 pm"
    var p = t.split(':'), h = +p[0], m = p[1];
    return ((h % 12) || 12) + ':' + m + (h < 12 ? ' am' : ' pm');
  };
  HZ.DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  HZ.MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  HZ.fmtDateLong = function (key) {
    var p = key.split('-'), d = new Date(+p[0], +p[1] - 1, +p[2]);
    return HZ.DOW[d.getDay()] + ', ' + d.getDate() + ' ' + HZ.MON[d.getMonth()];
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = HZ;
  else root.HZ = HZ;
})(typeof window !== 'undefined' ? window : globalThis);
