/* The Daily Record: what brings a reader back (the page's own module, started by edition.js with its helpers).
   - Since you were last here: worked out on this device. The only thing kept is a date (tca.home.seen.v1): how far the
     record ran the last time this page was open. Nothing is sent anywhere.
   - One question a day: the card prints the question; a tap or Enter turns it over to the answer and its source.
   - Things to discover: the day's find (one of seven, every day; "on the table" only when the picture shows it), the
     lamp's chain, and a place for the companion at the table's edge (the site's own companion, moved there by edition.js).
   - Follows your day: the hour line and "Look at another hour" live on the plate (edition.js).
   Every one of them works with no picture, no film and no motion. */

const D = document, H = document.documentElement;
const SEEN = "tca.home.seen.v1";

/* small line drawings for the seven objects (stroke only, in the text's colour) */
const ICON = {
  magnifier: '<circle cx="10" cy="10" r="6.2"/><path d="M14.6 14.6 21 21"/><path d="M7.2 8.4a3.4 3.4 0 0 1 2.6-1.9"/>',
  "pocket-watch": '<circle cx="12" cy="13.5" r="7"/><path d="M12 6.5V4.2M10.4 3.2h3.2M12 13.5V9.8M12 13.5l2.6 1.6"/>',
  "pen-and-ink": '<path d="M5 20h8.5l-1-4.4H6Z"/><path d="M7.2 15.6c0-2 3.2-2 3.2 0"/><path d="M14 13.5 20.2 3.8l1 .7-5.6 10.3-2.2 1.1Z"/>',
  "desk-bell": '<path d="M4.5 17.5a7.5 7.5 0 0 1 15 0Z"/><path d="M3 20h18M12 10V7.6M10.6 7.6h2.8"/>',
  spectacles: '<circle cx="7" cy="14" r="3.6"/><circle cx="17" cy="14" r="3.6"/><path d="M10.6 13.4c.9-.8 1.9-.8 2.8 0M3.4 13.2 2 9.5M20.6 13.2 22 9.5"/>',
  apple: '<path d="M12 8.2c-1.6-1.3-5.6-1.6-6.6 2.2-1 3.9 1.8 9.6 4.4 9.6 1 0 1.4-.5 2.2-.5s1.2.5 2.2.5c2.6 0 5.4-5.7 4.4-9.6-1-3.8-5-3.5-6.6-2.2Z"/><path d="M12 8.2c0-2 .8-3.6 2.6-4.4"/>',
  fern: '<path d="M7 21C9 15 12 9 18 3"/><path d="M8.6 17.2 5 15.8M10 14.5l-3.8-2M11.6 11.7 8.4 9M13.4 9.2l-2.2-3.4M10 17.8l3.4.4M11.6 15l3.8-.2M13.4 12.2l3.6-.9M15.2 9.6l3.2-1.6"/>'
};
const icon = id => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${ICON[id] || ICON.magnifier}</svg>`;

export function start(ed) {
  since(ed);
  question(ed);
  discover(ed);
  ed.on("spot", name => {
    if (name === "card") {
      const d = D.querySelector("[data-q-details]");
      if (d) { d.open = true; const s = d.querySelector("summary"); d.closest(".hk").scrollIntoView({block: "center", behavior: ed.quiet() ? "auto" : "smooth"}); s && s.focus({preventScroll: true}); }
    } else if (name === "slip") openSince(ed, null);
    else if (name === "object") { const o = D.querySelector("[data-obj]"); if (o && !o.hidden) { o.scrollIntoView({block: "center", behavior: ed.quiet() ? "auto" : "smooth"}); const a = o.querySelector("a,button"); a && a.focus({preventScroll: true}); } }
  });
  ed.reprint();
}

/* ---------- since you were last here ---------- */
let SINCE = {items: [], fresh: [], seen: null};
function since(ed) {
  const box = D.getElementById("hk-slip");
  const items = (ed.boot.since || []).filter(i => i && /^\d{4}-\d\d-\d\d/.test(i.at || ""));
  const forced = ed.test("seen");
  let seen = forced || ed.store.get(SEEN);
  if (!/^\d{4}-\d\d-\d\d$/.test(seen || "")) seen = null;
  const fresh = seen ? items.filter(i => i.at.slice(0, 10) > seen) : [];
  SINCE = {items, fresh, seen};
  const when = !seen ? "Welcome. Here is the newest on the record."
    : fresh.length ? `${fresh.length === 1 ? "One new thing" : fresh.length + " new things"} on the record since your last visit.`
    : `Nothing new since your last visit. The record still runs through ${ed.shortDay(ed.boot.record_through)}.`;
  const list = (fresh.length ? fresh : items).slice(0, fresh.length ? 3 : !seen ? 3 : 2);
  if (box) {
    box.querySelector("[data-slip-when]").textContent = when;
    box.querySelector("[data-slip-list]").innerHTML = list.map(i =>
      `<li><span class="hk-d">${ed.esc(ed.shortDay(i.at))}</span> <a href="${ed.esc(ed.link(i.href))}">${ed.esc(i.t)}</a></li>`).join("");
    const btn = box.querySelector("[data-open-slip]");
    if (btn) {
      const n = fresh.length ? fresh.length : items.length;
      btn.hidden = !(fresh.length > list.length || (!fresh.length && items.length > list.length));
      btn.textContent = fresh.length ? `See all ${n} new` : "See the last two months";
      btn.addEventListener("click", () => openSince(ed, btn));
    }
  }
  /* the slip on the table prints the same thing, shorter */
  const slip = ed.slip;
  if (slip) {
    const w = slip.querySelector("[data-sl-when]"), ul = slip.querySelector("[data-sl-list]"), more = slip.querySelector("[data-sl-more]");
    const pool = fresh.length ? fresh : items, shown = pool.slice(0, 3);
    if (w) w.textContent = !seen ? "The newest on the record" : fresh.length ? `${fresh.length} new since your last visit` : "Nothing new since your last visit";
    if (ul) ul.innerHTML = shown.map(i => `<li><b>${ed.esc(ed.shortDay(i.at))}</b>${ed.esc(i.t)}</li>`).join("");
    if (more) more.textContent = fresh.length > shown.length ? `and ${fresh.length - shown.length} more` : "";
  }
  /* on leaving, remember how far the record ran (a date, nothing else) */
  const save = () => { if (!forced && ed.boot.record_through) ed.store.set(SEEN, String(ed.boot.record_through).slice(0, 10)); };
  addEventListener("pagehide", save);
  D.addEventListener("visibilitychange", () => { if (D.visibilityState === "hidden") save(); });
}
function openSince(ed, from) {
  const {items, fresh, seen} = SINCE, pool = fresh.length ? fresh : items;
  const lead = fresh.length ? `New on the record since your last visit, newest first. Your last visit was when the record ran through ${ed.shortDay(seen)}.`
    : "Everything on the record in the last two months, newest first.";
  const li = pool.map(i => `<li><span>${ed.esc(ed.shortDay(i.at))}</span><a href="${ed.esc(ed.link(i.href))}">${ed.esc(i.t)}</a></li>`).join("");
  ed.openPop("Since you were last here", `<p>${ed.esc(lead)}</p><ul class="pop-list">${li}</ul><p class="fine">This list is worked out on your device. The page keeps one date, and nothing about your visits is sent anywhere.</p>`,
    from || D.querySelector("[data-open-slip]"));
}

/* ---------- one question a day ---------- */
function question(ed) {
  const qs = ed.boot.questions || [];
  if (!qs.length) return;
  const n = qs.length, today = ed.ymdLocal();
  const i = ((Math.round(ed.dayNum(today) - ed.dayNum("2026-01-01")) % n) + n) % n;
  const q = qs[i], src = q.source || {};
  const set = (sel, html) => { const el = D.querySelector(sel); if (el) el.innerHTML = html; };
  set("[data-q-text]", ed.esc(q.q));
  set("[data-q-a]", ed.esc(q.a));
  set("[data-q-more]", q.more ? `<p class="hk-more">${ed.esc(q.more)}</p>` : "");
  set("[data-q-src]", `Where to see it: <a href="${ed.esc(ed.link(src.href))}">${ed.esc(src.t || "the record")}</a>`);
  const cq = ed.card && ed.card.querySelector("[data-card-q]");
  if (cq) cq.textContent = q.q;
  const d = D.querySelector("[data-q-details]");
  if (d) d.addEventListener("toggle", () => { const s = d.querySelector("summary"); if (s) s.lastChild.nodeValue = d.open ? "Turn it back" : "Turn the card over"; });
}

/* ---------- things to discover ---------- */
function discover(ed) {
  /* the day's find, one of seven by the reader's own day of the week: every day, so the card changes daily; it says
     "On the table today" only when the picture really shows it */
  const box = D.querySelector("[data-obj]"), o = ed.todaysObject();
  let shown = "";
  const showObject = () => {
    if (!box) return;
    if (!o) { box.hidden = true; box.innerHTML = ""; shown = ""; return; }
    const there = !!ed.objectInPicture(o.id), key = `${o.id}|${there}`;
    box.hidden = false;
    if (key === shown) return;
    shown = key;
    const name = ed.esc(o.name.charAt(0).toLowerCase() + o.name.slice(1));
    const go = o.href ? `<a href="${ed.esc(ed.link(o.href))}">Go there</a>` : '<button type="button" class="hk-link" data-obj-help>Open Help</button>';
    box.innerHTML = `${icon(o.id)}<b>${there ? "On the table today" : "Today’s find"}: ${name}</b><p>${ed.esc(o.line)} ${go}</p>`;
    const hb = box.querySelector("[data-obj-help]");
    if (hb) hb.addEventListener("click", () => { if (!ed.togglePanel("tca-help", hb)) location.href = ed.link("access/"); });
  };
  ed.on("picture", showObject);
  showObject();

  /* the lamp's chain */
  // the button itself: the page's main box carries data-lamp too (the lamp's state), and must not take the button's clicks
  const lamp = D.querySelector("button[data-lamp]"), words = lamp && lamp.querySelector("[data-lamp-words]");
  // drawn hidden, so that with no script there is no button that does nothing
  const lampLine = D.querySelector(".hk-lampline");
  if (lampLine && lamp) lampLine.hidden = false;
  const syncLamp = () => {
    if (!lamp) return;
    const lit = ed.lamp();
    lamp.setAttribute("aria-pressed", lit ? "true" : "false");
    if (words) words.textContent = lit ? "The lamp is on. Pull the chain again" : "Pull the lamp’s chain";
  };
  if (lamp) lamp.addEventListener("click", () => ed.setLamp(!ed.lamp()));
  ed.on("lamp", syncLamp);
  syncLamp();

  /* the companion: the site's own, chosen in Reading & access */
  const comp = D.querySelector("[data-comp]");
  if (comp) comp.hidden = false;
  const syncComp = () => {
    if (!comp) return;
    const c = ed.settings().companion, there = H.classList.contains("ed-comp-table");
    const line = c === "off" ? "Your companion can sit with you at the table."
      : there ? "Your companion is sitting at the table’s edge." : "Your companion keeps you company in the corner.";
    comp.innerHTML = `${line} <button type="button" class="hk-link" data-companion>${c === "off" ? "Choose one in Reading &amp; access" : "Change it in Reading &amp; access"}</button>`;
  };
  if (comp) comp.addEventListener("click", e => {
    const b = e.target.closest("button[data-companion]");      // <html> carries data-companion too (the reader's setting)
    if (b && !ed.togglePanel("tca-access", b)) location.href = ed.link("access/");
  });
  ed.on("companion", syncComp);
  ed.on("shell", syncComp);
  H.addEventListener("tca:axes", syncComp);
  syncComp();
}
