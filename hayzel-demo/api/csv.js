// Google Sheets "Publish to web" CSV proxy. Fetches server-side to avoid CORS.
// Only https://docs.google.com/spreadsheets/... links are allowed.
module.exports = async function handler(req, res) {
  function send(status, text) {
    res.statusCode = status;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', status === 200 ? 'public, s-maxage=30, stale-while-revalidate=30' : 'no-store');
    res.end(text);
  }

  var raw = '';
  try { raw = new URL(req.url, 'http://localhost').searchParams.get('url') || ''; } catch (e) { raw = ''; }
  raw = raw.trim();
  if (!raw) return send(400, 'Paste your Google Sheets "Publish to web" CSV link first.');

  var u;
  try { u = new URL(raw); } catch (e) { return send(400, "That doesn't look like a link. Copy the full link from Google Sheets."); }
  if (u.protocol !== 'https:' || u.hostname !== 'docs.google.com' || u.pathname.indexOf('/spreadsheets/') !== 0 || u.username || u.password || u.port) {
    return send(400, 'Only Google Sheets links are allowed (https://docs.google.com/spreadsheets/...).');
  }

  var r, text;
  try {
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, 9000);
    r = await fetch(u.toString(), { redirect: 'follow', signal: ctrl.signal, headers: { 'Accept': 'text/csv,text/plain;q=0.9,*/*;q=0.1' } });
    text = await r.text();
    clearTimeout(timer);
  } catch (e) {
    return send(502, "Google Sheets didn't respond. Try again in a moment.");
  }
  if (r.status === 400 || r.status === 404) {
    return send(400, "Google couldn't find that sheet. Check that it's published to the web and the link is complete.");
  }
  if (!r.ok) return send(502, 'Google Sheets returned an error (' + r.status + '). Try again in a moment.');
  var type = (r.headers.get('content-type') || '').toLowerCase();
  if (type.indexOf('text/html') !== -1 || /^\s*<(!doctype|html)/i.test(text)) {
    return send(400, 'That link opens a web page, not a CSV file. In Google Sheets choose File, Share, Publish to web, pick your tab and "Comma-separated values (.csv)", then copy that link.');
  }
  if (text.length > 5 * 1024 * 1024) return send(400, 'That sheet is too large for this demo (over 5 MB).');
  return send(200, text);
};
