/* The Daily Record: the home page's draft in the sandbox. The page's own script (an ES module; no other server is asked
   for anything, and nothing about the reader leaves the device).

   What it does, in order:
   1. Sizes the paper. In "box" fit, #paper-live is the paper's fixed live area (1200 x 1100 CSS px wide, 390 x 607
      narrow), scaled to the column with transform: scale(var(--fit)) and its type fitted inside (--ts). In "flow" fit
      (large text, another face, high contrast, generous spacing, or a width in between) it is ordinary text.
   2. Draws the room: the film when the stage can play it (stage.js, the stage role's, mounted with a time limit), else
      the still picture for the reader's hour, with today's paper, the question card and the "since" slip printed on it,
      the lamp's light as a layer, and places a pointer can touch. With no picture at all, the page stands on its own.
   3. Keeps the clock: countdowns, local times, "Today" and "This edition".
   4. The three ways to read (kept in tca.way.v1), the hour (with a look at another hour), the plate (over the film one
      slim line that opens, kept off the paper), the bar (glass over the picture, solid after), the companion's place at
      the table's edge (the site's own dock, moved, never redrawn).
   5. Starts the hooks (hooks.js) and leaves window.tcaEdition (for tests and the scene roles).

   How the film is mounted (the film's engine is the stage role's; notes in home_scene/notes/edition.md):
     mount({stage, live, card, slip, overlay: the plate, spots: {companion, object?}, media, base, time, layout, slot,
            top: the bar's height (the lean keeps the paper's top under it), length: {lean, hand}, dust, ui,
            describe:false, onReady, onProgress}) returns {setTime, setLamp, skip, has, destroy, progress, ...} and fires
     stage:time, stage:lamp and stage:error on the stage. slot() says where the paper lands on the page (in the pinned
     view's own pixels). The film runs only where the paper is the fixed box and the screen's shape matches the
     pictures'; if it is not ready in time, errs, or the reader's settings or the screen change, it is taken down and
     the still is drawn. */

const D = document, H = D.documentElement, ED = D.getElementById("ed");
const BOOT = (() => { try { return JSON.parse(D.getElementById("ed-boot").textContent); } catch (e) { return {}; } })();
const LIVE = D.getElementById("paper-live"), SLOT = D.getElementById("paper-slot"), STAGE = D.getElementById("ed-stage");
const CARD = D.getElementById("ed-card"), SLIP = D.getElementById("ed-slip"), POP = D.getElementById("ed-pop");
const SAY = D.getElementById("ed-live-say"), UI = D.getElementById("ed-ui"), SCENE = D.getElementById("ed-scene");
const QS = new URLSearchParams(location.search);
const LOCAL = /^(127\.0\.0\.1|localhost|\[::1\])$/.test(location.hostname);
const test = k => (LOCAL ? QS.get(k) : null);
const ROOT = BOOT.root || "../../", BASE = BOOT.mediaBase || "media/", MEDIA = BOOT.media || null;
const BOX = {wide: [1200, 1100], narrow: [390, 607]};
const HOURS = ["morning", "afternoon", "dusk", "night"];
const HOUR_WORDS = {morning: "Morning", afternoon: "Afternoon", dusk: "Dusk", night: "Night"};
const GREET = {morning: "Good morning.", afternoon: "Good afternoon.", dusk: "Good evening.", night: "Good evening."};
const MON = ["Jan.", "Feb.", "March", "April", "May", "June", "July", "Aug.", "Sept.", "Oct.", "Nov.", "Dec."];
const DOW = ["Sun.", "Mon.", "Tue.", "Wed.", "Thu.", "Fri.", "Sat."];
const PRINT = test("print");

/* ---------- small helpers ---------- */
const mq = s => { try { return matchMedia(s).matches; } catch (e) { return false; } };
const store = {get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }};
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
const link = h => { h = String(h || ""); return !h || /^(?:[a-z]+:|#|\/)/i.test(h) ? h : ROOT + h; };
function now() { const t = test("now"), v = t ? Date.parse(t) : NaN; return isNaN(v) ? Date.now() : v; }
function ymdLocal(t) { const d = new Date(t == null ? now() : t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function dayNum(ymd) { const [y, m, d] = String(ymd).slice(0, 10).split("-").map(Number); return Date.UTC(y, m - 1, d) / 864e5; }
function shortDay(ymd) { const [y, m, d] = String(ymd).slice(0, 10).split("-").map(Number); return `${DOW[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}, ${MON[m - 1]} ${d}`; }
function say(words) { if (!SAY) return; SAY.textContent = ""; setTimeout(() => { SAY.textContent = words; }, 60); }
const bus = new EventTarget();
const on = (name, fn) => bus.addEventListener(name, e => fn(e.detail));
const emit = (name, detail) => bus.dispatchEvent(new CustomEvent(name, {detail}));

/* the reader's settings, as the shell writes them on <html> */
function settings() {
  const d = H.dataset;
  return {scale: +(d.scale || 100), face: d.face || "standard", contrast: d.contrast || "standard", space: d.space || "standard",
          motion: d.motion || "full", calm: d.calm || "off", lean: d.lean || "off", companion: d.companion || "on"};
}
function quiet() {
  const a = settings(); let sd = false;
  try { sd = !!(navigator.connection && navigator.connection.saveData); } catch (e) {}
  return a.motion === "reduced" || a.calm === "on" || a.lean === "on" || sd || mq("(prefers-reduced-motion: reduce)");
}
/* the still picture instead of the film: Motion off, Calm, reduced motion, Save-Data (a lean device still plays the film, lighter) */
function stillWanted() {
  const a = settings(); let sd = false;
  try { sd = !!(navigator.connection && navigator.connection.saveData); } catch (e) {}
  return a.motion === "reduced" || a.calm === "on" || sd || mq("(prefers-reduced-motion: reduce)");
}
function bigText() { const a = settings(); return a.scale >= 130 || a.face !== "standard" || a.contrast === "high" || a.space === "generous"; }

/* the shell's own module, for its panels (the same module the page already loaded, so nothing runs twice) */
let SHELL = null;
const shellReady = (async () => {
  const tag = D.querySelector('script[type="module"][src*="shell/shell."]');
  if (!tag) return null;
  try { SHELL = await import(tag.src); } catch (e) { SHELL = null; }
  return SHELL;
})();
function togglePanel(id, from) {
  if (SHELL && SHELL.togglePanel) { SHELL.togglePanel(id, from, true); return true; }
  return false;
}

/* ---------- 1. the paper's size ---------- */
let G = {w: 0, h: 0, orient: "landscape", layout: "wide", fit: "box"}, fitOverride = null;
const gutter = w => Math.min(40, Math.max(16, w * .034));
function decide() {
  const w = H.clientWidth || innerWidth, h = innerHeight || 800;
  const orient = w >= h ? "landscape" : "portrait";
  let layout = w >= 1000 ? "wide" : w <= 540 ? "narrow" : (w >= 760 ? "wide" : "narrow");
  let fit = (w >= 1000 || w <= 540) && !bigText() ? "box" : "flow";
  const f = test("layout");
  if (f === "wide" || f === "narrow") { layout = f; fit = "box"; }
  return {w, h, orient, layout, fit};
}
function autofit(el, bw, bh) {
  const keep = el.style.height;
  el.style.height = "auto";
  const fits = ts => { el.style.setProperty("--ts", ts.toFixed(3)); return el.offsetHeight <= bh + .5; };
  let lo = .72, hi = 1.12, best = .72;
  if (fits(1)) { best = 1; lo = 1; } else hi = 1;
  for (let i = 0; i < 7; i++) { const mid = (lo + hi) / 2; if (fits(mid)) { best = mid; lo = mid; } else hi = mid; }
  el.style.setProperty("--ts", best.toFixed(3));
  el.style.height = keep;
  return best;
}
function geometry() {
  if (PRINT) return;
  G = decide();
  ED.dataset.orient = G.orient; ED.dataset.layout = G.layout; ED.dataset.fit = G.fit;
  LIVE.dataset.layout = G.layout;
  const box = G.fit === "box";
  LIVE.classList.toggle("is-box", box);
  if (box) {
    const [bw, bh] = BOX[G.layout], g = G.layout === "wide" ? gutter(G.w) : 12;
    const room = Math.min(G.w - 2 * g, G.layout === "wide" ? 1320 : bw * 1.25);
    const s = fitOverride || room / bw;
    ED.style.setProperty("--fit", s.toFixed(5));
    ED.style.setProperty("--slot-w", (bw * s).toFixed(2) + "px");
    ED.style.setProperty("--slot-h", (bh * s).toFixed(2) + "px");
    ED.style.setProperty("--rest-w", (G.layout === "wide" ? bw * s : 1240).toFixed(2) + "px");
    autofit(LIVE, bw, bh);
  } else {
    for (const k of ["--fit", "--slot-w", "--slot-h", "--rest-w"]) ED.style.removeProperty(k);
    LIVE.style.removeProperty("--ts");
  }
  const bar = D.querySelector(".tca-top"), main = D.getElementById("main");
  const pull = (bar ? bar.offsetHeight : 62) + (main ? parseFloat(getComputedStyle(main).paddingTop) || 0 : 0);
  ED.style.setProperty("--ed-bar", pull + "px");
  // anything above the picture at the top of the page (the draft's notice): the film's way past it sits that much higher
  const hero = D.getElementById("ed-hero");
  if (hero) ED.style.setProperty("--ed-above", Math.max(0, Math.round(hero.getBoundingClientRect().top + scrollY)) + "px");
  // and the phone's tab bar along the bottom: the way past the film sits above it
  const tabs = D.querySelector(".tca-tabs"), tcs = tabs && getComputedStyle(tabs);
  ED.style.setProperty("--ed-below", (tcs && tcs.display !== "none" && tcs.position === "fixed" ? tabs.offsetHeight : 0) + "px");
  emit("geometry", G);
}
function slotRect() {
  const r = SLOT.getBoundingClientRect(), [bw, bh] = BOX[G.layout];
  const s = G.fit === "box" ? r.width / bw : 1;
  return {x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height, fit: s, layout: G.layout, box: G.fit === "box" ? [bw, bh] : null};
}

/* ---------- 3. the clock ---------- */
function cdWords(iso, kind, t) {
  if (kind === "day") {
    const n = dayNum(iso) - dayNum(ymdLocal(t));
    return n === 0 ? ["today", false] : n === 1 ? ["tomorrow", false] : n > 1 ? [`in ${n} days`, false] : ["the day has passed", true];
  }
  const ms = Date.parse(iso) - t;
  if (!(ms > 0)) return ["the time has passed", true];
  const m = Math.floor(ms / 6e4), h = Math.floor(m / 60), d = Math.floor(h / 24);
  if (m < 1) return ["in under a minute", false];
  if (h < 1) return [`in ${m} min`, false];
  if (h < 24) return [`in ${h} h${m % 60 ? ` ${m % 60} min` : ""}`, false];
  if (d < 2) return [`in 1 day${h % 24 ? `, ${h % 24} h` : ""}`, false];
  return [`in ${d} days`, false];
}
function clockWords(d) {
  const h24 = d.getHours(), m = d.getMinutes(), ap = h24 < 12 ? "a.m." : "p.m.";
  if (!m && h24 === 12) return "noon";
  if (!m && h24 === 0) return "midnight";
  const h = h24 % 12 || 12;
  return m ? `${h}:${String(m).padStart(2, "0")} ${ap}` : `${h} ${ap}`;
}
function localTime(iso) {
  const m = /([+-])(\d\d):(\d\d)$/.exec(iso || ""), d = new Date(iso);
  if (!m || isNaN(d)) return "";
  const off = (m[1] === "-" ? -1 : 1) * (+m[2] * 60 + +m[3]);
  if (-d.getTimezoneOffset() === off) return "";
  const other = ymdLocal(d.getTime()) !== String(iso).slice(0, 10);
  return `${other ? DOW[d.getDay()] + " " : ""}${clockWords(d)} your time`;
}
function tick() {
  const t = now(), today = ymdLocal(t);
  for (const el of D.querySelectorAll("[data-cd]")) {
    const [w, past] = cdWords(el.dataset.cd, el.dataset.cdk, t);
    if (el.textContent !== w) el.textContent = w;
    el.toggleAttribute("data-past", past);
  }
  for (const el of D.querySelectorAll("[data-day]")) {
    const n = dayNum(el.dataset.day) - dayNum(today), r = el.querySelector("[data-rel]");
    if (r) r.textContent = n === 0 ? "Today" : n === 1 ? "Tomorrow" : "";
  }
  for (const el of D.querySelectorAll("[data-lt]")) { const w = localTime(el.getAttribute("datetime")); if (el.textContent !== w) el.textContent = w; }
  const k = today === BOOT.date ? "Today’s edition" : "This edition";
  for (const el of D.querySelectorAll("[data-edition-k]")) if (el.textContent !== k) el.textContent = k;
}

/* ---------- the panel (the two ways still being built; the whole list since a last visit) ---------- */
const canPop = !!(POP && typeof POP.showPopover === "function");
let popFrom = null, popOpen = false;
if (POP) {
  if (canPop) POP.hidden = false;
  else { POP.removeAttribute("popover"); POP.classList.add("is-fallback"); POP.hidden = true; }
  POP.addEventListener("toggle", e => { if (e.newState === "closed") afterClose(); });
  POP.addEventListener("click", e => { if (e.target.closest("[data-pop-close]")) closePop(); });
  D.addEventListener("keydown", e => { if (e.key === "Escape" && popOpen && !canPop) closePop(); });
}
function afterClose() {
  popOpen = false;
  if (popFrom && D.contains(popFrom)) { try { popFrom.focus({preventScroll: true}); } catch (e) {} }
  popFrom = null;
}
function openPop(title, body, from, acts) {
  if (!POP) return;
  const h = D.getElementById("ed-pop-h"), b = D.getElementById("ed-pop-body"), a = POP.querySelector(".pop-acts");
  h.textContent = title;
  b.innerHTML = body;
  a.innerHTML = (acts || []).map((x, i) => x.href ? `<a href="${esc(x.href)}"${x.go ? ' class="go"' : ""}>${esc(x.label)}</a>`
    : `<button type="button" class="pop-x${x.go ? " go" : ""}" data-pop-act="${i}">${esc(x.label)}</button>`).join("") +
    '<button type="button" class="pop-x" data-pop-close>Close</button>';
  a.querySelectorAll("[data-pop-act]").forEach(btn => btn.addEventListener("click", () => { const x = acts[+btn.dataset.popAct]; closePop(); x.act && x.act(); }));
  popFrom = from || D.activeElement;
  if (canPop) { try { POP.showPopover(); } catch (e) {} } else POP.hidden = false;
  popOpen = true;
  requestAnimationFrame(() => { try { h.focus({preventScroll: true}); } catch (e) {} });
}
function closePop() {
  if (!POP || !popOpen) return;
  if (canPop) { try { POP.hidePopover(); } catch (e) { afterClose(); } } else { POP.hidden = true; afterClose(); }
}

/* ---------- 4a. the three ways to read ---------- */
const WAYKEY = "tca.way.v1";
const SHELVES = `<svg viewBox="0 0 320 180" aria-hidden="true" focusable="false"><g fill="none" stroke="#5E4A2E" stroke-width="2"><rect x="30" y="18" width="260" height="120" rx="2" fill="#E9DDC3"/><path d="M30 58h260M30 98h260"/></g>
<g>${Array.from({length: 33}, (_, i) => { const row = Math.floor(i / 11), x = 36 + (i % 11) * 23 + (row % 2) * 4, hgt = 26 + ((i * 7) % 9), c = ["#7A5418", "#2F6B5E", "#A8762E", "#5E4A2E", "#3E5A50", "#8C6B3E"][(i * 5) % 6]; return `<rect x="${x}" y="${58 + row * 40 - hgt - 2}" width="17" height="${hgt}" rx="1.5" fill="${c}" opacity=".88"/>`; }).join("")}</g>
<g stroke="#5E4A2E" stroke-width="2"><rect x="96" y="112" width="128" height="58" rx="3" fill="#C9A66B"/>${[0, 1, 2].map(r => [0, 1, 2, 3].map(c => `<rect x="${102 + c * 30}" y="${117 + r * 17}" width="26" height="13" rx="1.5" fill="#D8BD86"/><circle cx="${115 + c * 30}" cy="${123.5 + r * 17}" r="2" fill="#A8762E" stroke="none"/>`).join("")).join("")}</g></svg>`;
const DOORS = `<svg viewBox="0 0 320 180" aria-hidden="true" focusable="false"><rect x="70" y="14" width="180" height="124" fill="#E7D7B2" stroke="#5E4A2E" stroke-width="2"/>
<rect x="100" y="30" width="120" height="108" fill="#F4ECD9"/><path d="M100 104h120" stroke="#C9B48C" stroke-width="2"/><circle cx="182" cy="74" r="20" fill="#7FA392"/><rect x="179" y="90" width="6" height="16" fill="#6B5233"/>
<path d="M100 30 L74 22 L74 146 L100 138Z" fill="#8C6B3E" stroke="#5E4A2E" stroke-width="2"/><path d="M220 30 L246 22 L246 146 L220 138Z" fill="#8C6B3E" stroke="#5E4A2E" stroke-width="2"/>
<circle cx="94" cy="86" r="2.6" fill="#A8762E"/><circle cx="226" cy="86" r="2.6" fill="#A8762E"/>
<g fill="#D9C9A6" stroke="#5E4A2E" stroke-width="1.5"><rect x="52" y="138" width="216" height="12"/><rect x="40" y="150" width="240" height="12"/><rect x="28" y="162" width="264" height="12"/></g></svg>`;
const WAYS = {
  "daily-record": {name: "The Daily Record"},
  "reading-room": {name: "The Reading Room", place: "the stacks", art: SHELVES,
    alt: "The reading room's stacks: two floors of shelves, a gallery, and a big oak card catalog in front.",
    text: "Turn from the table to the stacks. Shelves of books rise two floors, and in front stands a big oak card catalog. Its drawers hold the whole record: bills, votes, members and money.",
    links: [["Every bill", "us/#bills"], ["The vote map", "us/#map"], ["Members of Congress", "us/#members"], ["Money", "us/#money"]]},
  "where-you-stand": {name: "Where You Stand", place: "the front steps", art: DOORS,
    alt: "The reading room's front doors, open onto a town square in daylight.",
    text: "Turn to the front doors. They open onto a town square. You start from your own place: your members, your ballot and your state.",
    links: [["Your members of Congress", "us/#members"], ["Your ballot", "ballot/"], ["Every level of government", "rooms.html"]]}
};
function wayLine(w) {
  const el = D.querySelector("[data-way-line]"); if (!el) return;
  if (w === "daily-record" || !WAYS[w]) {
    // the chosen way's own plain line: shown only where the ways are a row of names (phones), and not read twice
    const r = D.querySelector(`input[name="ed-way"][value="${w}"]`), sm = r && r.closest("label") ? r.closest("label").querySelector("small") : null;
    el.classList.add("is-own"); el.setAttribute("aria-hidden", "true"); el.textContent = sm ? sm.textContent : ""; el.hidden = !el.textContent;
    return;
  }
  el.classList.remove("is-own"); el.removeAttribute("aria-hidden");
  el.hidden = false;
  el.innerHTML = `${esc(WAYS[w].name)} is still being built, so you are reading The Daily Record for now. <button type="button" data-way-show="${esc(w)}">See what it will be</button>`;
}
function openWay(w, from) {
  const W = WAYS[w]; if (!W || !W.text) return;
  const pic = BOOT.wings && BOOT.wings[w];
  const fig = pic ? `<figure class="pop-pic"><img src="${esc(pic)}" alt="${esc(W.alt)}" decoding="async"></figure>`
    : `<figure class="pop-pic">${W.art}<figcaption>A picture of ${esc(W.place)} is on its way.</figcaption></figure>`;
  const links = W.links.map(([t, h]) => `<li><a href="${esc(link(h))}">${esc(t)}</a></li>`).join("");
  openPop(W.name, `${fig}<p>${esc(W.text)}</p><p>It is still being built. Until it opens, you can go straight to these parts of the record:</p><ul class="pop-links">${links}</ul>`,
    from, [{label: "Back to The Daily Record", act: () => chooseWay("daily-record", true)}]);
}
function chooseWay(w, focus) {
  if (!WAYS[w]) w = "daily-record";
  store.set(WAYKEY, JSON.stringify({way: w}));
  ED.dataset.way = w;
  const r = D.querySelector(`input[name="ed-way"][value="${w}"]`);
  if (r) { r.checked = true; if (focus) r.focus({preventScroll: true}); }
  wayLine(w);
}
function ways() {
  let saved = null;
  try { saved = JSON.parse(store.get(WAYKEY) || "null"); } catch (e) {}
  const w = saved && WAYS[saved.way] ? saved.way : "daily-record";
  const r = D.querySelector(`input[name="ed-way"][value="${w}"]`);
  if (r) r.checked = true;
  ED.dataset.way = w; wayLine(w);
  let pointerAt = 0;
  const fs = D.querySelector(".ui-ways");
  if (fs) fs.addEventListener("pointerup", () => { pointerAt = performance.now(); });
  for (const radio of D.querySelectorAll('input[name="ed-way"]')) {
    radio.addEventListener("change", () => {
      if (!radio.checked) return;
      const v = radio.value;
      store.set(WAYKEY, JSON.stringify({way: v})); ED.dataset.way = v; wayLine(v);
      if (v === "daily-record") say("The Daily Record.");
      else if (performance.now() - pointerAt < 600) openWay(v, radio);      // a click shows it; arrow keys only say so
      else say(`${WAYS[v].name} is still being built. Press See what it will be to look.`);
    });
  }
  D.addEventListener("click", e => { const b = e.target.closest("[data-way-show]"); if (b) openWay(b.dataset.wayShow, b); });
}

/* ---------- 4b. the hour: the reader's own (from the season's sunrise and sunset, the same table the film uses), or another ---------- */
function timeOfDay(d) {
  const S = Array.isArray(BOOT.sun) && BOOT.sun.length === 12 ? BOOT.sun : null, hr = d.getHours() + d.getMinutes() / 60;
  if (!S) return hr >= 5 && hr < 12 ? "morning" : hr >= 12 && hr < 17 ? "afternoon" : hr >= 17 && hr < 20 ? "dusk" : "night";
  let m = d.getMonth();
  const f = (d.getDate() - 15) / 30;
  try { if (/^(Australia|Pacific\/Auckland|Africa\/Johannesburg|America\/(Sao_Paulo|Argentina|Santiago))/.test(Intl.DateTimeFormat().resolvedOptions().timeZone)) m = (m + 6) % 12; } catch (e) {}
  const a = S[m], b = S[(m + (f < 0 ? 11 : 1)) % 12], k = Math.abs(f), rise = a[0] + (b[0] - a[0]) * k, set = a[1] + (b[1] - a[1]) * k;
  return hr < rise - .6 || hr >= set + .75 ? "night" : hr < 11.5 ? "morning" : hr < set - 1.25 ? "afternoon" : "dusk";
}
const ownHour = timeOfDay(new Date(now()));
let hourShown = HOURS.includes(QS.get("hour")) ? QS.get("hour") : ownHour;     // the hour asked for
let shownTime = hourShown, hourChosen = hourShown !== ownHour;                   // the hour the picture shows, and whether the reader chose it
function hourUI() {
  // with no picture at all the hour is only a greeting from the reader's own clock, and there is no other hour to look at
  const plain = ED.dataset.mode === "plain";
  ED.dataset.hour = H.dataset.edHour = shownTime;
  const line = D.querySelector("[data-hour-line]"), chose = D.querySelector("[data-hour-chose]");
  if (line) line.textContent = plain ? GREET[ownHour] : `${HOUR_WORDS[shownTime]} in the reading room${hourChosen ? "." : ""}`;
  if (chose) chose.hidden = plain || !hourChosen;
  const more = D.getElementById("ui-more");
  if (more && more.dataset.wired) {
    more.hidden = plain;
    if (plain) showHours(false);
  }
  let missing = false;
  for (const b of D.querySelectorAll(".ui-h[data-hour]")) {
    const h = b.dataset.hour;
    if (h) {
      b.setAttribute("aria-pressed", h === shownTime ? "true" : "false");      // the hour the picture shows
      b.disabled = !hasHour(h);      // only the pictures made for this screen's shape
      if (b.disabled) missing = true;
    } else b.hidden = !hourChosen;
  }
  const box = D.getElementById("ui-hours");
  let note = box && box.querySelector(".ui-hnote");
  if (box && missing && !note) { note = D.createElement("p"); note.className = "ui-hnote"; box.append(note); }
  if (note) { note.hidden = !missing; note.textContent = "Some hours are not ready yet for a screen this shape."; }
  if (SCENE) {
    SCENE.hidden = plain;      // no picture, so nothing to describe
    if (BOOT.scene && BOOT.scene[shownTime]) SCENE.textContent = BOOT.scene[shownTime];
  }
}
function setHour(h, from) {
  if (!HOURS.includes(h)) h = ownHour;
  const chose = h !== ownHour;
  if (h === hourShown && chose === hourChosen) return;
  hourShown = h; hourChosen = chose;
  if (filmCtl && filmCtl.setTime) { try { filmCtl.setTime(chose ? h : null); } catch (e) {} hourUI(); }      // the film says which picture it shows (stage:time)
  else { shownTime = h; hourUI(); drawRoom(); }
  say(`${HOUR_WORDS[h]} in the reading room.`);
}
/* the four hours: while they are open the ways step aside and the button says Done (Escape closes them too) */
const hoursOpen = () => { const b = D.getElementById("ui-hours"); return !!b && !b.hidden; };
function showHours(v, back) {
  const more = D.getElementById("ui-more"), box = D.getElementById("ui-hours"), pl = D.getElementById("ui-plate");
  if (!more || !box) return;
  more.setAttribute("aria-expanded", v ? "true" : "false"); box.hidden = !v;
  more.textContent = v ? "Done" : "Look at another hour";
  if (pl) pl.classList.toggle("is-hours", !!v);
  if (!v && back) { try { more.focus({preventScroll: true}); } catch (e) {} }
  placePlate();
}
function hours() {
  const more = D.getElementById("ui-more"), pl = D.getElementById("ui-plate");
  if (more) {
    more.dataset.wired = "1";      // hourUI() shows it, unless there is no picture
    more.addEventListener("click", () => showHours(!hoursOpen()));
  }
  if (pl) pl.addEventListener("click", e => { const b = e.target.closest(".ui-h"); if (b && !b.disabled) setHour(b.dataset.hour || ownHour, b); });
  hourUI();
}

/* ---------- 4b'. the plate over the film: closed, one slim line (the hour and "Ways to read"; on a phone the way past
   and "Ways to read"); open, the hour and the three ways, as a sheet from the bottom on a phone. Escape, Done, a tap
   outside it, or the film starting to move closes it. ---------- */
let plateOpen = false;
function setPlate(v, back) {
  const pl = D.getElementById("ui-plate"), tg = D.getElementById("ui-open");
  if (!pl || !tg) return;
  const was = plateOpen;
  plateOpen = !!v && !!filmCtl;
  pl.classList.toggle("is-open", plateOpen);
  tg.setAttribute("aria-expanded", plateOpen ? "true" : "false");
  if (!plateOpen && hoursOpen()) showHours(false);
  if (plateOpen && !was) {
    const r = pl.querySelector('input[name="ed-way"]:checked') || pl.querySelector(".ui-ways input");
    requestAnimationFrame(() => { try { r && r.focus({preventScroll: true}); } catch (e) {} });
  } else if (!plateOpen && back && pl.contains(D.activeElement)) { try { tg.focus({preventScroll: true}); } catch (e) {} }
  placePlate(); placeDock();
}
function plate() {
  const pl = D.getElementById("ui-plate"), tg = D.getElementById("ui-open"), done = pl && pl.querySelector("[data-ui-close]");
  if (!pl || !tg) return;
  tg.hidden = false; if (done) done.hidden = false;      // shown by the film's own rules; with no script there is no film
  tg.addEventListener("click", () => setPlate(!plateOpen, true));
  if (done) done.addEventListener("click", () => setPlate(false, true));
  D.addEventListener("keydown", e => {
    if (e.key !== "Escape" || popOpen) return;
    if (hoursOpen()) { e.preventDefault(); showHours(false, true); } else if (plateOpen) { e.preventDefault(); setPlate(false, true); }
  });
  D.addEventListener("pointerdown", e => { if (plateOpen && !pl.contains(e.target) && !(POP && POP.contains(e.target))) setPlate(false, false); });
}

/* ---------- 2. the room: the still picture and what is printed on it ---------- */
let roomKey = "", roomSet = null, SPOTS = {}, printed = [], lampDefault = "off", lampTouched = false;
function setFor(hour, orient) {
  const S = (MEDIA && MEDIA.sets) || {};
  const ok = k => (S[k] && S[k].first && S[k].first.length ? S[k] : null);
  // this screen's shape first, at the nearest hour there is (as the film chooses): a picture cut down to fit would cut the paper off
  const i0 = Math.max(0, HOURS.indexOf(hour)), order = HOURS.slice().sort((a, b) => Math.abs(HOURS.indexOf(a) - i0) - Math.abs(HOURS.indexOf(b) - i0));
  for (const h of order) { const s = ok(`${h}/${orient}`); if (s) return s; }
  for (const h of order) { const s = ok(`${h}/landscape`) || ok(`${h}/portrait`); if (s) return s; }
  return null;
}
/* the still picture itself (also the stand-in the film keeps under it while its own picture loads) */
function swapPicture(set) {
  const fig = D.getElementById("ed-still"), pic = fig && fig.querySelector("picture");
  if (!pic || !set) return fig && fig.querySelector("img");
  const key = `${set.time}/${set.layout}`, img0 = pic.querySelector("img"), cur = img0 ? img0.currentSrc || img0.src || "" : "";
  // the page's own picture (morning, either shape by the screen) is kept when it is already the one wanted
  if (pic.dataset.set === `${set.time}/*` && cur.includes(`/${set.time}/${set.layout}/`)) pic.dataset.set = key;
  if (pic.dataset.set !== key) {
    pic.innerHTML = pictureHTML(set);
    pic.dataset.set = key;
    const img = pic.querySelector("img");
    if (set.placeholder_data && /^data:image\//.test(set.placeholder_data)) img.style.backgroundImage = `url("${set.placeholder_data}")`;
  }
  return pic.querySelector("img");
}
/* whether an hour can be shown on this screen: the film says for itself; the still needs a picture of this shape */
function hasHour(h) {
  if (filmCtl && filmCtl.has) { try { return !!filmCtl.has(h); } catch (e) { return true; } }
  if (ED.dataset.mode === "plain" || !MEDIA) return true;
  const s = setFor(h, G.orient);
  return !!s && s.time === h;
}
function pictureHTML(set) {
  const by = t => set.first.filter(f => f.type === t).sort((a, b) => a.w - b.w);
  const ss = fs => fs.map(f => `${BASE}${f.file} ${f.w}w`).join(", ");
  const avif = by("image/avif"), webp = by("image/webp"), top = webp[webp.length - 1] || set.first[0];
  return (avif.length ? `<source type="image/avif" srcset="${ss(avif)}" sizes="100vw">` : "") + (webp.length ? `<source type="image/webp" srcset="${ss(webp)}" sizes="100vw">` : "") +
    `<img class="ed-still-img" src="${BASE}${top.file}" width="${top.w}" height="${top.h}" alt="" decoding="async">`;
}
/* The print on its corners (TL TR BR BL, in the stage's pixels), laid in two parts as the film lays the live paper: the
   print carries the plain 2D part (how the paper lies at its middle), its wrapper the perspective that is left, with one
   painted dot of its own, so the browser draws the type and the rules crisp instead of stretching a picture of them. */
function sheet(o, e, w, hh, q) {
  const [x0, y0, x1, y1, x2, y2, x3, y3] = q;
  const dx1 = x1 - x2, dx2 = x3 - x2, dy1 = y1 - y2, dy2 = y3 - y2, sx = x0 - x1 + x2 - x3, sy = y0 - y1 + y2 - y3,
    den = dx1 * dy2 - dx2 * dy1 || 1e-9, g = (sx * dy2 - dx2 * sy) / den / w, k = (dx1 * sy - sx * dy1) / den / hh,
    a = (x1 - x0) / w + g * x1, b = (x3 - x0) / hh + k * x3, d = (y1 - y0) / w + g * y1, f = (y3 - y0) / hh + k * y3,
    cx = w / 2, cy = hh / 2, Z = g * cx + k * cy + 1, X = (a * cx + b * cy + x0) / Z, Y = (d * cx + f * cy + y0) / Z,
    j = [(a - X * g) / Z, (b - X * k) / Z, (d - Y * g) / Z, (f - Y * k) / Z], det = j[0] * j[3] - j[1] * j[2] || 1e-12,
    i = [j[3] / det, -j[1] / det, -j[2] / det, j[0] / det], n = v => +v.toFixed(9);
  e.style.transform = `matrix(${n(j[0])},${n(j[2])},${n(j[1])},${n(j[3])},${n(-j[0] * cx - j[1] * cy)},${n(-j[2] * cx - j[3] * cy)})`;
  o.style.transform = `matrix3d(${n((a * i[0] + b * i[2]) / Z)},${n((d * i[0] + f * i[2]) / Z)},0,${n((g * i[0] + k * i[2]) / Z)},${n((a * i[1] + b * i[3]) / Z)},${n((d * i[1] + f * i[3]) / Z)},0,${n((g * i[1] + k * i[3]) / Z)},0,0,1,0,${n(X)},${n(Y)},0,1)`;
}
function scrub(el) {
  el.removeAttribute("id");
  for (const n of el.querySelectorAll("[id]")) n.removeAttribute("id");
  for (const n of el.querySelectorAll("[aria-labelledby],[aria-controls],[tabindex]")) { n.removeAttribute("aria-labelledby"); n.removeAttribute("aria-controls"); n.removeAttribute("tabindex"); }
  el.setAttribute("aria-hidden", "true"); el.inert = true;
  return el;
}
const ORIENT_POS = {landscape: [.5, .72], portrait: [.5, .72]};
function frameToStage(set) {
  const r = STAGE.getBoundingClientRect(), fw = set.first[0].w, fh = set.first[0].h;
  const [px, py] = ORIENT_POS[set.layout] || [.5, .72];
  const s = Math.max(r.width / fw, r.height / fh), ox = (r.width - fw * s) * px, oy = (r.height - fh * s) * py;
  return {fw, fh, s, map: (u, v) => [ox + u * fw * s, oy + v * fh * s], w: r.width, h: r.height};
}
/* the pictures that show now: the still's, or the film's for the hour it shows */
const shownSet = () => roomSet || (filmCtl && MEDIA && MEDIA.sets ? MEDIA.sets[`${shownTime}/${G.layout === "wide" ? "landscape" : "portrait"}`] || null : null);
function objectInPicture(id, s = shownSet()) {
  if (!id || !s) return false;
  if (test("object") === "1") return true;
  const M = MEDIA || {};
  return s.object === id || (Array.isArray(s.objects) && s.objects.includes(id)) || !!(s.object_layers && s.object_layers[id]) || (Array.isArray(M.objects) && M.objects.includes(id));
}
function lampLayer(set) {
  let img = STAGE.querySelector(".ed-lamp");
  if (!set.lamp || !set.lamp.file) { if (img) img.remove(); ED.dataset.lampLayer = "none"; return; }
  if (!img) { img = D.createElement("img"); img.className = "ed-lamp"; img.alt = ""; img.setAttribute("aria-hidden", "true"); img.decoding = "async"; STAGE.append(img); }
  const src = BASE + set.lamp.file;
  if (img.getAttribute("src") !== src) img.src = src;
  ED.dataset.lampLayer = set.lamp.lamp_on_in_frames ? "sub" : "add";
}
function spot(name, xy, w, h, label) {
  const el = D.createElement("span");
  el.className = "ed-spot"; el.dataset.spot = name; el.setAttribute("aria-hidden", "true"); el.title = label;
  el.style.left = xy[0].toFixed(1) + "px"; el.style.top = xy[1].toFixed(1) + "px";
  if (w) { el.style.width = w + "px"; el.style.height = h + "px"; el.style.margin = `${-h / 2}px 0 0 ${-w / 2}px`; }
  el.addEventListener("click", () => emit("spot", name));
  return el;
}
function printOn(ov, src, q, map, bw, bh, layout, blur) {
  const c = scrub(src.cloneNode(true)), o = D.createElement("div");
  c.classList.add("ed-inked"); o.className = "ed-q";
  if (src === LIVE) { c.classList.add("is-box"); c.dataset.layout = layout; c.style.removeProperty("--ts"); c.style.height = ""; }
  o.append(c); ov.append(o);
  if (src === LIVE) autofit(c, bw, bh);
  sheet(o, c, bw, bh, [...map(q[0], q[1]), ...map(q[2], q[3]), ...map(q[4], q[5]), ...map(q[6], q[7])]);
  if (blur > .2) c.style.filter = `blur(${blur.toFixed(2)}px)`;
  printed.push(c);
  return c;
}
const isQuad = q => Array.isArray(q) && q.length === 8 && q.every(Number.isFinite);
function overlay() {
  const set = roomSet, hd = set && set.hero;      // the hero's first frame rides with the pictures: nothing more to fetch
  let ov = STAGE.querySelector(".ed-ov");
  if (!ov) { ov = D.createElement("div"); ov.className = "ed-ov"; ov.setAttribute("aria-hidden", "true"); STAGE.append(ov); }
  ov.textContent = ""; printed = [];
  for (const s of STAGE.querySelectorAll(".ed-spot")) s.remove();
  SPOTS = {};
  if (!hd || !isQuad(hd.live)) { emit("picture", set); return; }
  const F = frameToStage(set), map = F.map, blur = (+hd.blur || 0) * (F.fh * F.s / 1080) * .38;
  const lw = (hd.vw || 1200) >= 800 ? "wide" : "narrow", [bw, bh] = BOX[lw];
  printOn(ov, LIVE, hd.live, map, bw, bh, lw, blur);
  if (isQuad(hd.card) && CARD) { printOn(ov, CARD, hd.card, map, 381, 228, "", blur * .8); SPOTS.card = centre(hd.card, map); }
  if (isQuad(hd.slip) && SLIP) { printOn(ov, SLIP, hd.slip, map, 300, 420, "", blur * .8); SPOTS.slip = centre(hd.slip, map); }
  const sp = hd.spots || {}, at = k => (Array.isArray(sp[k]) && sp[k].length > 1 ? map(sp[k][0], sp[k][1]) : null);
  SPOTS.lamp = at("lamp_chain"); SPOTS.object = at("object"); SPOTS.companion = at("companion");
  const inside = p => p && p[0] > 8 && p[1] > 8 && p[0] < F.w - 8 && p[1] < F.h - 64;
  if (inside(SPOTS.lamp)) STAGE.append(spot("lamp", SPOTS.lamp, 0, 0, "Pull the lamp’s chain"));
  if (inside(SPOTS.card)) STAGE.append(spot("card", SPOTS.card, 0, 0, "Turn the card over"));
  if (inside(SPOTS.slip)) STAGE.append(spot("slip", SPOTS.slip, 0, 0, "Since you were last here"));
  const obj = todaysObject();
  if (obj && objectInPicture(obj.id) && inside(SPOTS.object)) STAGE.append(spot("object", SPOTS.object, 0, 0, obj.name));
  emit("picture", set);
}
function centre(q, map) { const p = [map(q[0], q[1]), map(q[2], q[3]), map(q[4], q[5]), map(q[6], q[7])]; return [(p[0][0] + p[1][0] + p[2][0] + p[3][0]) / 4, (p[0][1] + p[1][1] + p[2][1] + p[3][1]) / 4]; }
function todaysObject() {
  const wd = ((new Date(now()).getDay() + 6) % 7) + 1;      // Monday 1 ... Sunday 7
  return (BOOT.objects || []).find(o => o.day === wd) || null;
}
async function drawRoom() {
  if (filmCtl) return;      // the film draws the room itself
  if (ED.dataset.mode === "plain" || !MEDIA || PRINT) { roomSet = null; emit("picture", null); return; }
  const set = setFor(hourShown, G.orient);
  if (!set) { ED.dataset.mode = "plain"; hourUI(); emit("picture", null); return; }
  if (shownTime !== set.time) { shownTime = set.time; hourUI(); }
  const key = `${set.time}/${set.layout}`;
  const img = swapPicture(set);
  const [px, py] = ORIENT_POS[set.layout] || [.5, .72];
  ED.style.setProperty("--ed-px", px * 100 + "%"); ED.style.setProperty("--ed-py", py * 100 + "%");
  roomKey = key; roomSet = set;
  if (!lampTouched) { lampDefault = set.lamp && set.lamp.lamp_on_in_frames ? "on" : "off"; ED.dataset.lamp = lampDefault; emit("lamp", ED.dataset.lamp === "on"); }
  lampLayer(set);
  try { if (img && img.decode) await img.decode(); } catch (e) {}
  if (roomSet !== set) return;
  overlay();
  placeDock();
}
function setLamp(on, quietly) {
  lampTouched = true;
  ED.dataset.lamp = on ? "on" : "off";
  if (filmCtl && filmCtl.setLamp) { try { filmCtl.setLamp(!!on); } catch (e) {} }
  emit("lamp", !!on);
  if (!quietly) say(on ? "The lamp is on." : "The lamp is off.");
}

/* ---------- the film (the stage role's engine, when it is there and the reader's settings allow it) ---------- */
let filmCtl = null, filmLayout = "", filmHanded = false, filmLean = 0, cspot = null, ospot = null, filmOff = [];
const barH = () => { const t = D.querySelector(".tca-top"); return t ? t.offsetHeight : 62; };
/* where the paper lands on the page, in the pinned view's own pixels: the column the page would give it, under the bar */
function slotFor(a) {
  const wide = a.layout !== "portrait", bw = a.vw || (wide ? 1200 : 390), w = a.width || innerWidth;
  const g = wide ? gutter(w) : 12, s = Math.min(w - 2 * g, wide ? 1320 : bw * 1.25) / bw;
  return {s, x: Math.round((w - bw * s) / 2), y: Math.round(barH() + (wide ? 18 : 10))};
}
function onFilmTime(e) {
  const d = e.detail || {};
  if (!HOURS.includes(d.time)) return;
  shownTime = d.time; hourChosen = !d.auto && d.time !== ownHour;
  if (!d.auto) hourShown = d.time;
  hourUI(); emit("picture", shownSet());
}
function onFilmLamp(e) { const on = !!(e.detail && e.detail.on); lampTouched = true; ED.dataset.lamp = on ? "on" : "off"; emit("lamp", on); }
async function film() {
  const src = BOOT.files && BOOT.files.stage;
  if (ED.dataset.mode !== "film") return false;
  // no film to play after all (its files left out of this build): the still, or the plain page when there is no picture
  if (!src || !MEDIA) { if (!MEDIA) ED.dataset.mode = "plain"; dropFilm(); return false; }
  ED.dataset.film = "loading";
  swapPicture(setFor(hourShown, G.orient));      // the stand-in under the film while it loads, at the hour the film will show
  let ready = false, given = false, t1 = 0;
  const giveUp = () => { if (ready || given) return; given = true; clearTimeout(t0); clearTimeout(t1); dropFilm(); };
  const t0 = setTimeout(giveUp, 9000);
  try {
    const mod = await import(new URL(src, location.href).href);
    if (given) return false;
    t1 = setTimeout(giveUp, 4000);
    filmLayout = G.layout;
    const narrow = G.layout !== "wide", obj = todaysObject(), spots = {};
    spots.companion = cspot = D.createElement("span"); cspot.className = "ed-cspot"; cspot.setAttribute("aria-hidden", "true");
    // the object of the day, where the picture shows it: a tap there opens the card that tells about it (the film hides
    // the spot in any picture that has no place for it)
    const orient = narrow ? "portrait" : "landscape", sets = MEDIA.sets || {};
    if (obj && HOURS.some(h => objectInPicture(obj.id, sets[`${h}/${orient}`]))) {
      spots.object = ospot = D.createElement("span"); ospot.className = "ed-ospot"; ospot.setAttribute("aria-hidden", "true"); ospot.title = obj.name;
      ospot.addEventListener("click", () => emit("spot", "object"));
    }
    const listen = (n, f) => { STAGE.addEventListener(n, f); filmOff.push(() => STAGE.removeEventListener(n, f)); };
    listen("stage:time", onFilmTime); listen("stage:lamp", onFilmLamp);
    listen("stage:error", () => { if (ready) dropFilm(); else giveUp(); });
    filmCtl = mod.mount({
      stage: STAGE, live: LIVE, card: CARD, slip: SLIP, overlay: UI, spots,
      media: MEDIA, base: BASE, time: hourChosen ? hourShown : null, describe: false,
      layout: () => (G.layout === "wide" ? "landscape" : "portrait"), slot: slotFor, top: barH,
      // a shorter lean and hand-over: the lean's largest frames are on screen for less of the scroll; lighter dust on a phone
      length: {lean: 1.35, hand: .5}, dust: narrow ? .6 : 1,
      ui: {skip: 1, chain: 1, dial: 0}, labels: {skip: "Skip to today’s edition", lamp: "The lamp", lampHint: "Pull the chain"},
      onReady: () => { if (given) return; ready = true; clearTimeout(t0); clearTimeout(t1); ED.dataset.film = "on"; hourUI(); emit("film", true); emit("picture", shownSet()); bar(); placePlate(); placeDock(); },
      onProgress: d => {
        const was = filmLean;
        filmHanded = !!d.handed; filmLean = d.lean || 0;
        if (!ready && !given) { clearTimeout(t1); t1 = setTimeout(giveUp, 4000); }
        if (plateOpen && (filmLean > .002 || d.hand > 0)) setPlate(false, false);
        if (was > 0 && !filmLean) placePlate();
        bar(); placeDock();
      }
    });
    return true;
  } catch (e) { giveUp(); return false; }
}
/* the film taken down: everything goes back where the page keeps it, and the still is drawn */
function dropFilm() {
  const c = filmCtl;
  filmCtl = null;
  if (c && c.destroy) { try { c.destroy(); } catch (e) {} }
  while (filmOff.length) filmOff.pop()();
  if (cspot) { cspot.remove(); cspot = null; }
  if (ospot) { ospot.remove(); ospot = null; }
  const pl = D.getElementById("ui-plate"), tg = D.getElementById("ui-open");
  plateOpen = false;
  if (pl) { pl.classList.remove("is-open", "is-wide"); delete pl.dataset.at; }
  if (tg) tg.setAttribute("aria-expanded", "false");
  delete ED.dataset.skip;
  filmHanded = false; filmLean = 0;
  if (ED.dataset.mode === "film") ED.dataset.mode = "still";
  ED.dataset.film = "off";
  geometry(); hourUI(); drawRoom(); bar(); placeDock();
}
/* the film fits only while the paper is the fixed box, in the layout it started in, and motion is welcome */
function filmStillFits() { return G.fit === "box" && G.layout === filmLayout && !stillWanted(); }

/* ---------- 4c. the bar: glass over the picture, solid once the page takes over ---------- */
let barRaf = 0;
function bar() {
  let show = false;
  if (ED.dataset.mode !== "plain" && !PRINT && STAGE) {
    if (filmCtl) show = !filmHanded;
    else { const t = D.querySelector(".tca-top"); show = STAGE.getBoundingClientRect().bottom > (t ? t.getBoundingClientRect().bottom : 62) + 6; }
  }
  H.classList.toggle("ed-glass", show);
  hold(show);
}
/* the site's "How much do you want to see?" card (the shell's own, once, on a reader's first visit) stood on the paper in
   the picture. The shell holds that card back while an Election Night notice is on the screen (any element of the class
   "pollsopen" in view); this page borrows the same wait with an invisible one-pixel marker, shown only while the picture
   holds the paper. The card then appears once the paper is the page, as on every other page, and steps aside again if
   the reader scrolls back up into the picture. Nothing else reads the marker. */
let HOLD = null;
function hold(v) {
  if (v && !HOLD && D.body) { HOLD = D.createElement("i"); HOLD.className = "ed-hold pollsopen"; HOLD.setAttribute("aria-hidden", "true"); D.body.append(HOLD); }
  H.classList.toggle("ed-held", !!v);
}

/* boxes on the screen: [left, top, right, bottom] of anything laid out (shown or fading), and how much two overlap */
const rectOf = el => { const r = el && el.getClientRects().length ? el.getBoundingClientRect() : null; return r && r.width ? [r.left, r.top, r.right, r.bottom] : null; };
const over = (a, b, m = 0) => (a && b ? Math.max(0, Math.min(a[2], b[2] + m) - Math.max(a[0], b[0] - m)) * Math.max(0, Math.min(a[3], b[3] + m) - Math.max(a[1], b[1] - m)) : 0);

/* ---------- 4c'. over the film, the plate and the way past are kept off the paper. On a phone the way past rides in the
   plate's line (at the picture's foot it stood on the paper). On a wider screen the film's own way past stays at the foot
   unless it would stand on the paper, and the plate takes the first corner where, opened, it clears the paper: the floor
   left of the table first, so the window that tells the hour stays clear. Checked again on every return to the
   picture's first view and on every resize. ---------- */
function placePlate() {
  const pl = D.getElementById("ui-plate");
  if (!pl || !filmCtl || ED.dataset.film !== "on" || filmHanded || filmLean > .002) return;
  if (G.layout !== "wide") { ED.dataset.skip = "plate"; return; }
  if (plateOpen) return;      // an open plate stays where the reader found it
  const live = rectOf(LIVE), pill = D.querySelector(".tca-st-skip");
  ED.dataset.skip = "pill";
  if (over(rectOf(pill), live, 8)) ED.dataset.skip = "plate";
  const pr = ED.dataset.skip === "pill" ? rectOf(pill) : null;
  const soft = [CARD, SLIP, D.querySelector(".tca-st-chain")].map(rectOf);
  // the closed plate is measured at its longest (another hour chosen, "Back to my hour" shown, the longest hour's name),
  // so its corner is the same at every hour and does not move when the reader chooses one
  const line = pl.querySelector("[data-hour-line]"), was = line && line.textContent;
  const extra = [pl.querySelector("[data-hour-chose]"), pl.querySelector(".ui-back")].filter(x => x && x.hidden);
  for (const x of extra) x.hidden = false;
  if (line) line.textContent = "Afternoon in the reading room.";
  // a corner is scored first by what the closed plate covers (the live area and the way past: never, where any corner
  // avoids them), then by what the open plate would cover: the live area heavily, the card, slip, pill and chain lightly.
  // Where no corner of the narrow plate clears the paper (a 4:3 screen, where the paper fills the width), the wide plate,
  // its three ways side by side, is tried along the top: it is short enough to sit in the band above the paper.
  let best = null;
  const score = (list, wide) => {
    pl.classList.toggle("is-wide", wide);
    for (const at of list) {
      pl.dataset.at = at;
      const c = rectOf(pl);
      pl.classList.add("is-measure");      // the open plate's size, with nothing hidden that may hold the focus
      const r = rectOf(pl);
      pl.classList.remove("is-measure");
      const hard = c ? over(c, live, 12) + over(c, pr, 8) : 1e6, o = r ? over(r, live, 10) : 1e6;
      const s = hard * 1e4 + (r ? o * 50 + [...soft, pr].reduce((n, b) => n + over(r, b, 4), 0) : 1e12);
      if (!best || s < best[1]) best = [at, s, wide, o];
      if (!s) return;
    }
  };
  score(["bl", "tl", "tr", "br"], false);
  if (best[3] > 0) score(["tl", "tr"], true);
  for (const x of extra) x.hidden = true;
  if (line) line.textContent = was;
  pl.dataset.at = best[0];
  pl.classList.toggle("is-wide", best[2]);
}

/* ---------- 4d. the companion (the site's own dock, moved, never redrawn). While the picture shows it stands at the
   table's edge, only where it fits whole and clear of the paper, the plate and the places to tap; else in its corner,
   or out of sight where the corner would cover the paper. On the page it is tucked to the edge where it would stand on
   the paper, and on a phone, whose text runs to the edge. It fades from one place to another (moves at once with motion
   off), and is dimmed at dusk and night as the room is. ---------- */
let heroSeen = true, compAt = "", compT = 0, backT = 0;
function setComp(s) {
  if (s !== "corner") { clearTimeout(backT); backT = 0; }
  if (s === compAt) return;
  const swap = (compAt === "table") !== (s === "table") && compAt && s && !quiet();
  compAt = s; clearTimeout(compT);
  const apply = () => {
    for (const k of ["table", "away", "corner"]) H.classList.toggle("ed-comp-" + k, s === k);
    H.classList.remove("ed-comp-fade");
    emit("companion", s === "table");
  };
  if (!swap) return apply();
  H.classList.add("ed-comp-fade"); compT = setTimeout(apply, 260);
}
/* anything a reader reads or presses under a box on the screen: a line of text, a link, a control or a picture. The
   screen is sampled on a close grid for what stands there (the companion itself left out), and only those parts are
   read for their lines, so it is cheap enough to run as the page scrolls */
const INKY = "a,button,input,select,textarea,summary,img";
function inkUnder(b) {
  const range = D.createRange(), done = new Set();
  const meets = r => r.width > 0 && r.height > 0 && r.right > b[0] && r.left < b[2] && r.bottom > b[1] && r.top < b[3];
  const seen = el => { for (let n = el; n && n.nodeType === 1; n = n.parentElement) { const cs = getComputedStyle(n); if (cs.visibility === "hidden" || +cs.opacity < .05) return false; } return true; };
  const mine = el => el.closest(".tca-dock,.tca-bubble");
  const ink = root => {
    if (root.matches(INKY) && meets(root.getBoundingClientRect()) && seen(root)) return true;
    const w = D.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {acceptNode(n) {
      if (n.nodeType === 3) return /\S/.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      if (n.matches("script,style,template,noscript") || !n.getClientRects().length && getComputedStyle(n).display !== "contents") return NodeFilter.FILTER_REJECT;
      const r = n.getBoundingClientRect();      // a part with a box away from this one is passed over whole (a box of no size may hold parts placed elsewhere)
      if (r.width && r.height && !meets(r)) return NodeFilter.FILTER_REJECT;
      return n.matches(INKY) && meets(r) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
    }});
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      if (n.nodeType === 1) { if (seen(n)) return true; continue; }
      range.selectNodeContents(n);
      for (const r of range.getClientRects()) if (meets(r) && seen(n.parentElement)) return true;
    }
    return false;
  };
  for (let i = 0; i < 6; i++) for (let j = 0; j < 7; j++) {
    const x = b[0] + (b[2] - b[0]) * (i + .5) / 6, y = b[1] + (b[3] - b[1]) * (j + .5) / 7;
    const el = D.elementsFromPoint(x, y).find(e => !mine(e));
    if (!el || el === D.body || el === H || done.has(el)) continue;
    done.add(el);
    if (ink(el)) return true;
  }
  return false;
}
function placeDock(settled) {
  const dock = D.querySelector(".tca-dock");
  if (!dock) return;
  if (PRINT || settings().companion === "off" || dock.dataset.rest === "perch") return setComp("");
  const film = !!filmCtl, W = innerWidth, Hh = innerHeight, dw = dock.offsetWidth || 96, dh = dock.offsetHeight || 108;
  const below = parseFloat(ED.style.getPropertyValue("--ed-below")) || 0, corner = [W - 10 - dw, Hh - below - 10 - dh, W - 10, Hh - below - 10];
  const page = rectOf(LIVE), paper = film ? page : rectOf(printed[0]) || page;
  // its own corner, as the reader sees it (above the phone's tab bar), with a little room around it
  const tab = D.querySelector(".tca-tabs"), tr = tab && tab.getClientRects().length ? tab.getBoundingClientRect() : null;
  const low = Math.min(Hh, tr && tr.height ? tr.top : Hh), at = [W - 10 - dw - 6, low - 10 - dh - 6, W - 4, low - 4];
  if (ED.dataset.mode !== "plain" && (film ? ED.dataset.film === "on" && !filmHanded : heroSeen)) {
    let p = null;
    if (film) { if (filmLean < .002 && cspot && cspot.style.visibility !== "hidden") { const r = cspot.getBoundingClientRect(); p = [r.left, r.top]; } }
    else if (SPOTS.companion) { const r = STAGE.getBoundingClientRect(); p = [SPOTS.companion[0] + r.left, SPOTS.companion[1] + r.top]; }
    const plate = rectOf(D.getElementById("ui-plate")), keep = [paper, plate, ...[...D.querySelectorAll(".tca-st-skip,.tca-st-chain,.ed-spot,.ed-ospot")].map(rectOf)];
    if (!film) keep.push(page, rectOf(printed[1]), rectOf(printed[2]));
    const b = p && [p[0] - dw / 2, p[1] - dh * .92, p[0] + dw / 2, p[1] + dh * .08];
    const foot = film ? Hh - below : Math.min(Hh - below, STAGE.getBoundingClientRect().bottom);
    if (b && b[0] >= 8 && b[2] <= W - 8 && b[1] >= barH() + 8 && b[3] <= foot - 8 && !keep.some(k => over(b, k, 6))) {
      H.style.setProperty("--ed-comp-x", (b[0] + scrollX).toFixed(1) + "px");
      H.style.setProperty("--ed-comp-y", (b[1] + scrollY).toFixed(1) + "px");
      return setComp("table");
    }
    // (the words test too: a long jump in the scroll reaches the page a frame before the film says it has handed over)
    return setComp(over(corner, paper, 4) || over(corner, page, 4) || over(corner, plate, 4) || inkUnder(at) ? "away" : "corner");
  }
  // on the page (and on the plain page): whole, in its own corner, only while no words, links or pictures are under it.
  // It fades away as soon as some are, and comes back once the reader has stopped scrolling where the page leaves room
  // (a wide screen's margin, the gap between parts); it is never pushed half off the screen.
  if (inkUnder(at)) return setComp("away");
  if (compAt === "corner" || settled === true) return setComp("corner");
  clearTimeout(backT); backT = setTimeout(() => { backT = 0; placeDock(true); }, 320);
}

/* ---------- the samples (?print=live|card|slip on this computer only): one element alone on white ---------- */
function printMode() {
  const target = {live: LIVE, card: CARD, slip: SLIP}[PRINT];
  if (!target) return false;
  H.classList.add("ed-print");
  if (target !== LIVE) D.body.append(target);
  target.classList.add("ed-print-target", "ed-inked");
  if (target === LIVE) {
    const lay = test("layout") === "narrow" ? "narrow" : "wide";
    LIVE.classList.add("is-box"); LIVE.dataset.layout = lay;
    const [bw, bh] = BOX[lay];
    D.fonts.ready.then(() => { autofit(LIVE, bw, bh); H.dataset.edReady = "1"; });
  } else D.fonts.ready.then(() => { H.dataset.edReady = "1"; });
  return true;
}

/* ---------- what the stage and the hooks are given ---------- */
const api = {
  boot: BOOT, root: ROOT, link, esc, test, store, now, ymdLocal, dayNum, shortDay, say, settings, quiet, on, emit,
  live: LIVE, slot: SLOT, card: CARD, slip: SLIP, stage: STAGE,
  geometry: () => G, slotRect, slotFor, film: () => (filmCtl ? filmCtl.progress : null), dropFilm,
  openPop, closePop, togglePanel,
  hour: () => hourShown, ownHour: () => ownHour, setHour,
  lamp: () => ED.dataset.lamp === "on", setLamp,
  objectInPicture, todaysObject, picture: () => shownSet(), spots: () => SPOTS,
  reprint() { if (roomSet) overlay(); }
};
window.tcaEdition = api;

/* ---------- start ---------- */
function start() {
  if (!ED || !LIVE) return;
  if (PRINT && printMode()) {
    tick();
    import(new URL(BOOT.files && BOOT.files.hooks ? BOOT.files.hooks : "hooks.js", location.href).href).then(m => m.start(api)).catch(() => {});
    return;
  }
  if (QS.has("nostage")) ED.dataset.mode = "plain";
  else if (QS.has("still") && ED.dataset.mode === "film") ED.dataset.mode = "still";
  geometry(); tick(); hours(); ways(); plate();
  // the plate's own way past: in the film (a phone, or a screen where the film's own would cover the paper) it plays the film to the page and hands the paper over
  const skipA = D.querySelector(".ui-skip");
  if (skipA) skipA.addEventListener("click", e => { if (filmCtl && filmCtl.skip) { e.preventDefault(); try { filmCtl.skip(); } catch (err) {} } });
  setInterval(tick, 15000);
  D.addEventListener("visibilitychange", () => { if (D.visibilityState === "visible") tick(); });
  const hooksReady = import(new URL(BOOT.files && BOOT.files.hooks ? BOOT.files.hooks : "hooks.js", location.href).href).then(m => m.start(api)).catch(() => {});
  hooksReady.then(() => { if (ED.dataset.mode === "film") film(); else drawRoom(); });
  let rT = 0, lastW = innerWidth, lastH = innerHeight;
  addEventListener("resize", () => {
    clearTimeout(rT);
    rT = setTimeout(() => {
      const before = `${G.orient}/${G.layout}/${G.fit}`;
      geometry();
      const changed = before !== `${G.orient}/${G.layout}/${G.fit}`;
      if (filmCtl && !filmStillFits()) dropFilm();
      else if (!filmCtl && (changed || Math.abs(innerWidth - lastW) > 2 || Math.abs(innerHeight - lastH) > 40)) drawRoom();
      lastW = innerWidth; lastH = innerHeight; bar(); placePlate(); placeDock();
    }, 120);
  });
  H.addEventListener("tca:axes", () => { geometry(); if (filmCtl && !filmStillFits()) dropFilm(); else if (!filmCtl) drawRoom(); bar(); placePlate(); placeDock(); });
  try { matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", () => { if (filmCtl && stillWanted()) dropFilm(); }); } catch (e) {}
  addEventListener("scroll", () => { if (!barRaf) barRaf = requestAnimationFrame(() => { barRaf = 0; bar(); placeDock(); }); }, {passive: true});
  bar();
  if ("IntersectionObserver" in window && STAGE) {
    new IntersectionObserver(es => { for (const e of es) { heroSeen = e.intersectionRatio >= .35; placeDock(); } }, {threshold: [0, .35, .6]}).observe(STAGE);
  }
  new MutationObserver(() => { if (D.querySelector(".tca-dock")) placeDock(); }).observe(D.body, {childList: true});
  D.fonts && D.fonts.ready.then(() => { geometry(); if (roomSet) overlay(); placePlate(); placeDock(); });
  on("spot", name => {
    if (name === "lamp") setLamp(ED.dataset.lamp !== "on");
  });
  shellReady.then(() => emit("shell", !!SHELL));
}
start();
