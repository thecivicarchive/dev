/* The Civic Archive: the home page's film engine. It plays the reading room's rendered pictures (a still, a loop, a
   camera lean scrubbed by the scroll), lays the live front page on the photographed paper, adds dust, steam, a slight
   parallax and the lamp, and hands the paper to the page. No library; nothing asked of another server; nothing about
   the reader leaves the device. The page's side of it is in the production notes ("stage").
     import {mount} from './stage.js';  const film = mount({stage, live, card, slip, media, base, time, onReady, onProgress}); */

const D = document, HT = D.documentElement, W = window;
export const TIMES = ['morning', 'afternoon', 'dusk', 'night'];
const KEY = 'tca.home.stage.v1';
const QS = new URLSearchParams(location.search);
const flag = k => QS.has(k) && QS.get(k) !== '0', num = k => QS.has(k) ? parseFloat(QS.get(k)) : NaN;
const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v, lerp = (a, b, t) => a + (b - a) * t;
const ss = t => (t = clamp(t), t * t * (3 - 2 * t)), sss = t => (t = clamp(t), t * t * t * (t * (6 * t - 15) + 10));
const mq = s => { try { return matchMedia(s).matches; } catch (e) { return false; } };
const h = (tag, cls, par, at) => {
  const e = D.createElement(tag);
  if (cls) e.className = cls;
  if (at) for (const k in at) e.setAttribute(k, at[k]);
  if (par) par.appendChild(e);
  return e;
};

/* Sunrise and sunset by month, as the clock shows them at about 40 degrees north (daylight time in summer).
   Enough to light the room for the reader's own hour; nothing is looked up anywhere. */
const SUN = [[7.3, 17], [6.9, 17.6], [7.1, 19.1], [6.3, 19.7], [5.7, 20.2], [5.5, 20.5], [5.7, 20.4], [6.2, 19.9], [6.7, 19.1], [7.2, 18.3], [6.8, 16.8], [7.2, 16.6]];
export function timeOfDay(d = new Date()) {
  let m = d.getMonth();
  const f = (d.getDate() - 15) / 30, hr = d.getHours() + d.getMinutes() / 60;
  try { if (/^(Australia|Pacific\/Auckland|Africa\/Johannesburg|America\/(Sao_Paulo|Argentina|Santiago))/.test(Intl.DateTimeFormat().resolvedOptions().timeZone)) m = (m + 6) % 12; } catch (e) {}
  const a = SUN[m], b = SUN[(m + (f < 0 ? 11 : 1)) % 12], k = Math.abs(f), rise = lerp(a[0], b[0], k), set = lerp(a[1], b[1], k);
  return hr < rise - .6 || hr >= set + .75 ? 'night' : hr < 11.5 ? 'morning' : hr < set - 1.25 ? 'afternoon' : 'dusk';
}
/* Which pictures fit a screen: the tall set for narrow screens and for small ones held sideways. */
export const shapeOf = (w, hgt) => w / hgt < 1.1 || w < 720 || (hgt < 480 && w < 960) ? 'portrait' : 'landscape';

const LABELS = {
  skip: 'Skip to today’s edition', lamp: 'The lamp', lampHint: 'Pull the chain', dial: 'The room at another hour', now: 'Follow my clock',
  tilt: 'Move with my phone', morning: 'Morning', afternoon: 'Afternoon', dusk: 'Dusk', night: 'Night',
  /* the scene in words: "A reading room " + one of these + the rest */
  scene: {morning: 'in the morning, low sun through the tall windows', afternoon: 'in soft afternoon daylight', dusk: 'at dusk, the sky rose and amber and the lamp lit', night: 'at night, the windows deep blue and the lamp lit'},
  room: '. Today’s Daily Record lies open on an oak table, beside a brass lamp with a green glass shade and a cup of coffee.'
};
const IC = {
  morning: '<path d="M3 17.5h18M7.5 17.5a4.5 4.5 0 0 1 9 0M12 6.5v3M5.6 10.1l2 2M18.4 10.1l-2 2"/>',
  afternoon: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"/>',
  dusk: '<path d="M3 16h18M6.5 20h11M7.5 16a4.5 4.5 0 0 1 9 0M12 8.5V6.5"/>',
  night: '<path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z"/>'
};
const svg = k => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[k]}</svg>`;

/* media.json (or its short form, with each set's first hero frame under "hero") -> sets with whole addresses */
function norm(m, base) {
  const out = {}, u = f => f ? base + (f.file || f) : null;
  for (const k in m.sets) {
    const s = m.sets[k], t = s.tracks || {};
    out[k] = {
      time: s.time, layout: s.layout, ph: s.ph || s.placeholder_data,
      first: (s.first || []).map(f => ({u: base + f.file, type: f.type, w: f.w, h: f.h})),
      loop: (s.loop || []).map(f => ({u: base + f.file, type: f.type, bytes: f.bytes || 0})),
      lean: s.lean ? {pat: base + s.lean.pattern, n: s.lean.frames, w: s.lean.w, h: s.lean.h} : null,
      depth: u(s.depth), lamp: s.lamp ? {u: u(s.lamp), on: !!(s.lamp.on || s.lamp.lamp_on_in_frames)} : null,
      tr: u(t.lean), trh: u(t.hero), hero: s.hero || null
    };
  }
  return out;
}
const hero0 = t => ({vw: t.live.vw, vh: t.live.vh, live: t.live.q[0], card: t.card && t.card.q[0], slip: t.slip && t.slip.q[0],
  spots: Object.fromEntries(Object.keys(t.spots || {}).map(k => [k, t.spots[k][0]]))});

/* Lays a w by h box onto the quad q (TL, TR, BR, BL, px) in two parts, so the ink is drawn well: the element carries a
   plain 2D part (how the paper lies at its middle: its type is drawn squashed, with true edges), its wrapper it.o the
   rest, a perspective that barely stretches. The 2D part is kept while close and renewed when the paper has turned or
   come to rest (renewing it redraws the type). */
function setQ(it, e, q, sharp) {
  const w = it.w, hh = it.h, x0 = q[0], y0 = q[1], x1 = q[2], y1 = q[3], x2 = q[4], y2 = q[5], x3 = q[6], y3 = q[7],
    dx1 = x1 - x2, dx2 = x3 - x2, dy1 = y1 - y2, dy2 = y3 - y2, sx = x0 - x1 + x2 - x3, sy = y0 - y1 + y2 - y3,
    den = dx1 * dy2 - dx2 * dy1 || 1e-9, g = (sx * dy2 - dx2 * sy) / den / w, k = (dx1 * sy - sx * dy1) / den / hh,
    a = (x1 - x0) / w + g * x1, b = (x3 - x0) / hh + k * x3, d = (y1 - y0) / w + g * y1, f = (y3 - y0) / hh + k * y3,
    cx = w / 2, cy = hh / 2, D = g * cx + k * cy + 1, X = (a * cx + b * cy + x0) / D, Y = (d * cx + f * cy + y0) / D,
    j = [(a - X * g) / D, (b - X * k) / D, (d - Y * g) / D, (f - Y * k) / D], n = v => +v.toFixed(9),
    key = q.map(v => v.toFixed(2)).join();
  let A = it.A, i = A && inv2(A);
  if (!A || Math.abs(j[0] * i[0] + j[1] * i[2] - 1) + Math.abs(j[2] * i[1] + j[3] * i[3] - 1) + Math.abs(j[0] * i[1] + j[1] * i[3]) + Math.abs(j[2] * i[0] + j[3] * i[2]) > (sharp ? .02 : .3)) {
    A = it.A = j; i = inv2(A);
    e.style.transform = `matrix(${n(j[0])},${n(j[2])},${n(j[1])},${n(j[3])},${n(-j[0] * cx - j[1] * cy)},${n(-j[2] * cx - j[3] * cy)})`;
  }
  it.q = q;
  it.o.style.transform = `matrix3d(${n((a * i[0] + b * i[2]) / D)},${n((d * i[0] + f * i[2]) / D)},0,${n((g * i[0] + k * i[2]) / D)},${n((a * i[1] + b * i[3]) / D)},${n((d * i[1] + f * i[3]) / D)},0,${n((g * i[1] + k * i[3]) / D)},0,0,1,0,${n(X)},${n(Y)},0,1)`;
  return it.qk !== key && (it.qk = key, true);
}
const inv2 = m => { const d = m[0] * m[3] - m[1] * m[2] || 1e-12; return [m[3] / d, -m[1] / d, -m[2] / d, m[0] / d]; };

/* ------------------------------------------------------------------ the WebGL layer: parallax, dust, steam */
const HP = '#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\n';
const VS_PIC = 'attribute vec2 a;uniform vec4 uM;varying vec2 v;void main(){v=vec2(a.x*.5+.5,.5-a.y*.5)*uM.xy+uM.zw;gl_Position=vec4(a,0.,1.);}';
const FS_PIC = `uniform sampler2D A,B,Dp,Lm;uniform vec4 uK,uO;uniform vec3 uC;varying vec2 v;
void main(){float i=1./(.3+11.7*texture2D(Dp,v).r)-uK.z;vec2 u=v-uK.xy*i;vec2 c=(v-uC.xy)*vec2(uC.z,1.);u.y-=uO.z*exp(-dot(c,c)*700.);
vec3 p=texture2D(A,u).rgb;if(uK.w>0.)p=mix(p,texture2D(B,u).rgb,uK.w);p+=uO.y*texture2D(Lm,u).rgb;gl_FragColor=vec4(clamp(p,0.,1.)*uO.x,uO.x);}`;
const VS_DUST = `attribute vec4 a;uniform vec4 uM,uK,uT;varying vec3 w;
void main(){float z=.5+5.5*a.z*a.z,t=uT.x,s=a.w;
vec2 q=a.xy+vec2(.02*sin(t*.07+s*40.)+.003*t*(s-.4),-.0022*t*(.3+s))/z;
q+=.004*vec2(sin(t*.31+s*90.),cos(t*.27+s*70.));q=fract(q)*vec2(1.16,1.12)-vec2(.08,.06);
float i=1./z-uK.z;q+=uK.xy*i;
float r=(.0012+.021*abs(i))*uT.y;r=min(r,uT.w);gl_PointSize=2.*r+2.;
float tw=.5+.5*sin(t*(.5+s*1.4)+s*300.),br=.6+4.*pow(fract(s*7.31),4.);
w=vec3(q,uT.z*br*(.3+.7*tw*tw)*5./(r*r/(uT.w*uT.w)*1156.+6.));
gl_Position=vec4((q-uM.zw)/uM.xy*vec2(2.,-2.)+vec2(-1.,1.),0.,1.);}`;
const FS_DUST = 'uniform sampler2D Lu;uniform vec3 uCol;varying vec3 w;void main(){vec2 d=gl_PointCoord*2.-1.;float r=length(d),m=smoothstep(1.,.7,r)*(.8+.35*r*r);float L=texture2D(Lu,w.xy).r,l=smoothstep(.1,.5,L)*(1.-.8*smoothstep(.7,.95,L));gl_FragColor=vec4(uCol*m*w.z*l,0.);}';
const VS_STEAM = 'attribute vec2 a;uniform vec4 uR;varying vec2 v;void main(){v=a*.5+.5;gl_Position=vec4(uR.x+a.x*.5*uR.z,uR.y+v.y*uR.w,0.,1.);}';
const FS_STEAM = `uniform sampler2D N;uniform vec4 uS;uniform vec3 uCol;varying vec2 v;
void main(){float y=v.y,t=uS.x;float n1=texture2D(N,vec2(v.x*.11+t*.004,y*.09-t*.011)).r;float n2=texture2D(N,vec2(v.x*.23-t*.006+n1*.07,y*.2-t*.024)).r;
float x=(v.x-.5+(n1-.5)*.55*y+.05*sin(y*5.-t*.8)*y)/mix(.1,.36,y);
float al=exp(-x*x*3.2)*smoothstep(0.,.1,y)*pow(1.-y,1.25)*(.2+1.5*n2*n2);gl_FragColor=vec4(uCol*al*uS.y,0.);}`;

function makeGL(scene, lite) {
  const c = h('canvas', 'tca-st-gl', scene, {'aria-hidden': 'true'});
  let g;
  try { g = c.getContext('webgl', {alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'low-power'}); } catch (e) {}
  if (!g) { c.remove(); return null; }
  const shd = (t, s) => { const x = g.createShader(t); g.shaderSource(x, s); g.compileShader(x); return x; };
  const prog = (vs, fs, us) => {
    const p = g.createProgram();
    g.attachShader(p, shd(g.VERTEX_SHADER, vs)); g.attachShader(p, shd(g.FRAGMENT_SHADER, HP + fs));
    g.bindAttribLocation(p, 0, 'a'); g.linkProgram(p);
    if (!g.getProgramParameter(p, g.LINK_STATUS)) throw new Error(g.getProgramInfoLog(p));
    const u = {}; for (const n of us) u[n] = g.getUniformLocation(p, n);
    return {p, u};
  };
  const tex = (rep, px) => {
    const t = g.createTexture(); g.bindTexture(g.TEXTURE_2D, t);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, rep ? g.REPEAT : g.CLAMP_TO_EDGE); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, rep ? g.REPEAT : g.CLAMP_TO_EDGE);
    g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, 1, 1, 0, g.RGBA, g.UNSIGNED_BYTE, new Uint8Array(px || [0, 0, 0, 255]));
    return t;
  };
  const buf = arr => { const b = g.createBuffer(); g.bindBuffer(g.ARRAY_BUFFER, b); g.bufferData(g.ARRAY_BUFFER, new Float32Array(arr), g.STATIC_DRAW); return b; };
  let pic, dust, steam;
  try {
    pic = prog(VS_PIC, FS_PIC, ['uM', 'uK', 'uO', 'uC', 'A', 'B', 'Dp', 'Lm']);
    dust = prog(VS_DUST, FS_DUST, ['uM', 'uK', 'uT', 'uCol', 'Lu']);
    steam = prog(VS_STEAM, FS_STEAM, ['uR', 'uS', 'uCol', 'N']);
  } catch (e) { c.remove(); return null; }
  const N = lite ? 60 : 150, seeds = [], noise = new Uint8Array(64 * 64 * 4);
  let r = 12345; const rnd = () => (r = (r * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < N * 4; i++) seeds.push(rnd());
  for (let i = 0; i < noise.length; i++) noise[i] = rnd() * 255;
  const T = {A: tex(), B: tex(), Dp: tex(0, [128, 128, 128, 255]), Lm: tex(), Lu: tex(0, [0, 0, 0, 255]), N: tex(1)};
  g.bindTexture(g.TEXTURE_2D, T.N); g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, 64, 64, 0, g.RGBA, g.UNSIGNED_BYTE, noise);
  const bTri = buf([-1, -1, 3, -1, -1, 3]), bDust = buf(seeds), bQuad = buf([-1, -1, 1, -1, -1, 1, 1, 1]);
  const bind = (unit, t, loc) => { g.activeTexture(g.TEXTURE0 + unit); g.bindTexture(g.TEXTURE_2D, t); g.uniform1i(loc, unit); };
  let ratio = 1, lost = false;
  c.addEventListener('webglcontextlost', e => { e.preventDefault(); lost = true; c.style.display = 'none'; });
  g.disable(g.DEPTH_TEST); g.enableVertexAttribArray(0); g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL, false);
  return {
    c, get lost() { return lost; },
    size(w, hh) {
      ratio = Math.min(W.devicePixelRatio || 1, lite ? 1 : 1.75, Math.sqrt(2.6e6 / Math.max(1, w * hh)));
      const cw = Math.round(w * ratio), ch = Math.round(hh * ratio);
      if (c.width !== cw || c.height !== ch) { c.width = cw; c.height = ch; }
    },
    put(name, src) {  // a picture, a video frame or a canvas into a texture
      g.activeTexture(g.TEXTURE7); g.bindTexture(g.TEXTURE_2D, T[name]);
      try { g.texImage2D(g.TEXTURE_2D, 0, g.RGB, g.RGB, g.UNSIGNED_BYTE, src); return true; } catch (e) { return false; }
    },
    /* s.uv: stage to frame [x scale, y scale, x off, y off]; s.par: parallax, in parts of the frame per unit of nearness */
    draw(s) {
      if (lost) return;
      g.viewport(0, 0, c.width, c.height); g.clearColor(0, 0, 0, 0); g.clear(g.COLOR_BUFFER_BIT);
      if (s.pic > .001) {
        g.disable(g.BLEND); g.useProgram(pic.p); g.bindBuffer(g.ARRAY_BUFFER, bTri); g.vertexAttribPointer(0, 2, g.FLOAT, false, 0, 0);
        g.uniform4f(pic.u.uM, s.uv[0], s.uv[1], s.uv[2], s.uv[3]); g.uniform4f(pic.u.uK, s.par[0], s.par[1], s.z0, s.mix);
        g.uniform4f(pic.u.uO, s.pic, s.lamp, s.tug, 0); g.uniform3f(pic.u.uC, s.chain[0], s.chain[1], s.aspect);
        bind(0, T.A, pic.u.A); bind(1, T.B, pic.u.B); bind(2, T.Dp, pic.u.Dp); bind(3, T.Lm, pic.u.Lm);
        g.drawArrays(g.TRIANGLES, 0, 3);
      }
      g.enable(g.BLEND); g.blendFunc(g.ONE, g.ONE);
      if (s.dust > .002) {
        g.useProgram(dust.p); g.bindBuffer(g.ARRAY_BUFFER, bDust); g.vertexAttribPointer(0, 4, g.FLOAT, false, 0, 0);
        g.uniform4f(dust.u.uM, s.uv[0], s.uv[1], s.uv[2], s.uv[3]); g.uniform4f(dust.u.uK, s.par[0], s.par[1], s.z0, 0);
        g.uniform4f(dust.u.uT, s.t, s.px * ratio * (s.ds || 1), s.dust, 34 * ratio * (s.ds || 1)); g.uniform3f(dust.u.uCol, s.col[0], s.col[1], s.col[2]);
        bind(4, T.Lu, dust.u.Lu); g.drawArrays(g.POINTS, 0, N);
      }
      if (s.steam) {
        g.useProgram(steam.p); g.bindBuffer(g.ARRAY_BUFFER, bQuad); g.vertexAttribPointer(0, 2, g.FLOAT, false, 0, 0);
        g.uniform4f(steam.u.uR, s.steam[0], s.steam[1], s.steam[2], s.steam[3]); g.uniform4f(steam.u.uS, s.t, s.steam[4], 0, 0);
        g.uniform3f(steam.u.uCol, s.col[0], s.col[1], s.col[2]); bind(5, T.N, steam.u.N); g.drawArrays(g.TRIANGLE_STRIP, 0, 4);
      }
    },
    end() { const x = g.getExtension('WEBGL_lose_context'); if (x) x.loseContext(); c.remove(); }
  };
}

/* ------------------------------------------------------------------ mount */
export function mount(o) {
  const st = o.stage;
  if (!st) throw new Error('stage: no stage element');
  const LB = Object.assign({}, LABELS, o.labels), SC = t => (o.labels && o.labels.scene || {})[t] || 'A reading room ' + LABELS.scene[t] + LABELS.room;
  const base = o.base == null ? './' : o.base, offs = [];
  const on = (t, e, f, op) => { t.addEventListener(e, f, op); offs.push(() => t.removeEventListener(e, f, op)); };
  const items = ['live', 'card', 'slip'].filter(k => o[k]).map(k => ({k, e: o[k]})), taken = [];
  const take = (e, into) => { taken.push([e, e.parentNode, e.nextSibling]); into.appendChild(e); };
  const LIVE = items.find(i => i.k === 'live'), spotEls = o.spots || {};
  const pinF = num('film'), pinned = !isNaN(pinF), lite = flag('lite') || HT.dataset.lean === 'on';
  const AH = lite ? 4 : 7, BK = lite ? 2 : 3, PK = .0085;
  let store = {}; try { store = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {} };
  let sets, P = null, olds = [], still = false, gl = null, alive = true, raf = 0, last = 0, busy = false, built = false;
  let want = TIMES.includes(QS.get('time')) ? QS.get('time') : TIMES.includes(o.time) ? o.time : null;
  let layout, FW = 1920, FH = 1080, sw = 0, sh = 0, safe = 0, topPx = 0, TP = 0, V0, V1, V2, N = {s: 1, x: 0, y: 0}, Ll = 0, Lh = 0, snap = false, pendF = null;
  let lean = 0, hand = 0, tL = 0, tH = 0, fi = 0, handed = false, vis = true, pend = false, wasReady = false;
  let lc = 0, gp = 0, la = 0, uiA = 1, tug = 0, lampOn = false, moving = false, moveT = 0, lastP = '', filmVar = '';
  let par = [0, 0], parT = [0, 0], tilt0 = null, clock = 0, t0 = performance.now();
  let pin, under, scene, ink, ui, probe, tiltB, skipA, chainB, dialB, dialP, mo, io, vidT = -1;
  const kick = () => { if (!raf && alive) raf = requestAnimationFrame(tick); };
  const fire = (name, detail) => { try { st.dispatchEvent(new CustomEvent('stage:' + name, {bubbles: true, detail})); } catch (e) {} };
  const simple = () => flag('still') || mq('(prefers-reduced-motion: reduce)') || HT.dataset.motion === 'reduced' || HT.dataset.calm === 'on' ||
    HT.classList.contains('calm') || !!(navigator.connection && navigator.connection.saveData);
  const timeNow = () => want || timeOfDay();
  const shape = () => typeof o.layout === 'function' ? o.layout(sw, safe) : o.layout || shapeOf(sw, safe);
  const native = () => !!(P && P.set.lamp && P.set.lamp.on);
  const ramp = (v, to, ms, dt) => v === to ? v : (busy = true, ms <= 0 ? to : v < to ? Math.min(to, v + dt / ms) : Math.max(to, v - dt / ms));

  /* ---------- which pictures ---------- */
  function pick(t, lay) {
    const i0 = TIMES.indexOf(t), order = TIMES.slice().sort((a, b) => Math.abs(TIMES.indexOf(a) - i0) - Math.abs(TIMES.indexOf(b) - i0));
    for (const x of order) if (sets[x + '/' + lay]) return sets[x + '/' + lay];
    for (const x of order) for (const k in sets) if (sets[k].time === x) return sets[k];
    return null;
  }

  /* ---------- the page's furniture ---------- */
  function build() {
    still = simple();
    pin = h('div', 'tca-st-pin');
    // what the page already shows in the stage stays under the film until the film's own picture is in
    under = h('div', 'tca-st-under', pin);
    while (st.firstChild) take(st.firstChild, under);
    st.appendChild(pin);
    st.classList.add('tca-st'); st.dataset.mode = still ? 'still' : 'film';
    probe = h('div', 'tca-st-probe', pin);
    scene = h('div', 'tca-st-scene', pin, o.describe === false ? {'aria-hidden': 'true'} : {role: 'img'});
    ui = h('div', 'tca-st-ui', pin);
    ink = h('div', 'tca-st-ink', pin); ink.style.visibility = 'hidden';
    for (const it of items) {  // in the still the real paper stays in the page; a print goes on the picture
      it.o = h('div', 'tca-st-q', ink); it.A = null; it.qk = ''; it.page = false;
      if (still && it === LIVE) { reprint(); continue; }
      it.e.classList.add('tca-st-' + it.k); take(it.e, it.o);
    }
    for (const k in spotEls) if (spotEls[k]) { spotEls[k].classList.add('tca-st-spot'); take(spotEls[k], pin); }
    if (o.overlay) take(o.overlay, ui);
    // the way past the film, the lamp's chain, the hour
    const U = o.ui === false ? {} : Object.assign({skip: 1, chain: 1, dial: 1}, o.ui);
    skipA = h('a', 'tca-st-skip', ui, {href: '#'}); skipA.textContent = LB.skip; skipA.hidden = !U.skip;
    on(skipA, 'click', e => { e.preventDefault(); go(true); });
    chainB = h('button', 'tca-st-chain', ui, {type: 'button', 'aria-label': LB.lamp, 'aria-pressed': 'false'}); chainB.hidden = !U.chain;
    h('span', '', chainB).textContent = LB.lampHint;
    on(chainB, 'click', () => { setLamp(!lampOn, true); tug = 1; chainB.classList.remove('is-pulled'); void chainB.offsetWidth; chainB.classList.add('is-pulled'); });
    on(chainB, 'pointerenter', lampLayer); on(chainB, 'focus', lampLayer);
    const dial = h('div', 'tca-st-dial', ui); dial.hidden = !U.dial;
    dialB = h('button', 'tca-st-dial-b', dial, {type: 'button', 'aria-expanded': 'false'});
    dialP = h('div', 'tca-st-dial-p', dial, {role: 'radiogroup', 'aria-label': LB.dial, hidden: ''});
    for (const t of TIMES) { const b = h('button', '', dialP, {type: 'button', role: 'radio', 'data-t': t}); b.innerHTML = svg(t) + '<span></span>'; b.lastChild.textContent = LB[t]; }
    const nowB = h('button', 'tca-st-now', dialP, {type: 'button'}); nowB.textContent = LB.now;
    if (!still && W.DeviceOrientationEvent && DeviceOrientationEvent.requestPermission && mq('(pointer: coarse)')) {  // a phone that asks first
      tiltB = h('button', 'tca-st-now', dialP, {type: 'button', 'aria-pressed': 'false'}); tiltB.textContent = LB.tilt;
      on(tiltB, 'click', tiltAsk);
    }
    const open = v => { dialP.hidden = !v; dialB.setAttribute('aria-expanded', v); if (v) (dialP.querySelector('[aria-checked=true]') || dialP.firstChild).focus(); };
    on(dialB, 'click', () => open(dialP.hidden));
    on(dialP, 'click', e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.t) setTime(b.dataset.t); else if (b === nowB) setTime(null); });
    on(dialP, 'keydown', e => {
      const rs = [...dialP.querySelectorAll('[role=radio]')], i = rs.indexOf(D.activeElement), d = {ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1}[e.key];
      if (e.key === 'Escape') { open(false); dialB.focus(); } else if (d && i >= 0) { e.preventDefault(); rs[(i + d + 4) % 4].focus(); }
    });
    on(D, 'pointerdown', e => { if (!dialP.hidden && !dial.contains(e.target)) open(false); });
    // A browser can lose what is under the pointer on a sheet lying this flat (its plane's horizon is inside the
    // window), so a click that falls through the film is passed on by hand to the link it was on.
    const sheet = (x, y) => items.slice().reverse().find(it => { const q = it.q; if (!q || it.page || it.o.style.visibility) return false; let s = 0; for (let i = 0; i < 8; i += 2) { const c = (q[(i + 2) % 8] - q[i]) * (y - q[i + 1]) - (q[(i + 3) % 8] - q[i + 1]) * (x - q[i]); if (c * s < 0) return false; s = c || s; } return true; });
    const under2 = e => e.target.contains && e.target.contains(st) && pin.getBoundingClientRect();
    on(st, 'click', () => {});  // so a phone passes its taps on
    on(D, 'click', e => {
      const r = under2(e), it = r && sheet(e.clientX - r.left, e.clientY - r.top);
      if (!it) return;
      const hit = [...(it.print || it.e).querySelectorAll('a,button,summary,label,input,select,[role=button]')].reverse().find(n => [...n.getClientRects()].some(b => e.clientX >= b.left && e.clientX <= b.right && e.clientY >= b.top && e.clientY <= b.bottom));
      if (hit) hit.click(); else if (it === LIVE) go(); else it.e.click();
    });
    on(D, 'pointermove', e => { if (e.pointerType === 'mouse') { const r = under2(e); st.style.cursor = r && sheet(e.clientX - r.left, e.clientY - r.top) ? 'pointer' : ''; } }, {passive: true});
    if (LIVE) {
      const paper = e => { const s = W.getSelection && W.getSelection(); if (!handed && !(s && !s.isCollapsed) && !e.target.closest('a,button,input,select,textarea,label,summary,[role=button]')) go(); };
      on(LIVE.o, 'click', paper);
      // a key reaching the paper before the page has it: the page takes it at once, then the focused line is brought into view
      on(LIVE.e, 'focusin', e => { if (!still && !handed && e.target !== LIVE.e && e.target.matches(':focus-visible')) { pendF = e.target; go(0, 1); } });
    }
    built = true;
  }
  /* Still mode: the paper in the picture is a print of the real one, which the page keeps in its own place. */
  function reprint() {
    if (LIVE.print) LIVE.print.remove();
    const c = LIVE.print = LIVE.e.cloneNode(true);
    c.removeAttribute('id'); c.setAttribute('aria-hidden', 'true'); c.classList.add('tca-st-live');
    c.querySelectorAll('[id]').forEach(n => n.removeAttribute('id'));
    c.querySelectorAll('a,button,input,select,textarea,[tabindex]').forEach(n => { n.tabIndex = -1; });
    LIVE.o.appendChild(c); LIVE.A = null; LIVE.qk = '';
    if (P && P.hero) kick();
  }
  function unbuild() {
    built = false; cancelAnimationFrame(raf); raf = 0;
    for (const p of olds.concat(P ? [P] : [])) drop(p);
    olds = []; P = null;
    if (gl) { gl.end(); gl = null; }
    for (const it of items) {
      if (it.print) { it.print.remove(); it.print = null; }
      it.e.classList.remove('tca-st-' + it.k, 'is-page'); it.e.style.transform = '';
    }
    for (const k in spotEls) if (spotEls[k]) { spotEls[k].classList.remove('tca-st-spot'); spotEls[k].style.transform = spotEls[k].style.visibility = spotEls[k].style.opacity = ''; }
    while (taken.length) { const [e, par, nx] = taken.pop(); par.insertBefore(e, nx && nx.parentNode === par ? nx : null); }  // all back where the page had it
    pin.remove();
    st.style.height = st.style.paddingBottom = st.style.marginBottom = '';
    st.classList.remove('is-handed', 'is-in'); if (st.dataset.boot) st.style.background = st.style.minHeight = ''; handed = false; lean = hand = lc = gp = la = 0; fi = 0; moving = false;
    while (offs.length) offs.pop()();
  }
  function drop(p) {
    p.dead = true;
    if (p.F) { p.F.dead = true; for (const i in p.F.bmp) p.F.bmp[i].close && p.F.bmp[i].close(); p.F.bmp = {}; p.F.blob = []; }
    if (p.vid) { p.vid.pause(); p.vid.removeAttribute('src'); p.vid.load(); }
    p.el.remove();
  }

  /* ---------- sizes, the three views, the page's own place for the paper ---------- */
  function measure() {
    sw = pin.clientWidth || W.innerWidth; sh = pin.clientHeight || W.innerHeight;
    topPx = parseFloat(getComputedStyle(pin).top) || 0;
    safe = Math.min(sh, (probe.offsetHeight || W.innerHeight) - topPx);
    for (const it of items) { const e = it.print || it.e; it.w = e.offsetWidth || 1; it.h = e.offsetHeight || 1; }
  }
  function natural() {
    const sl = o.slot || {};
    if (typeof sl === 'function') return sl({layout, vw: LIVE.w, vh: LIVE.h, width: sw, height: sh, safe});
    const g = sl.gutter != null ? sl.gutter : layout === 'portrait' ? 0 : 16, s = Math.min(sl.maxScale || (layout === 'portrait' ? 1.6 : 1), (sw - 2 * g) / LIVE.w);
    return {s, x: (sw - LIVE.w * s) / 2, y: sl.top != null ? sl.top : Math.round(.07 * safe)};
  }
  function fit() {
    if (!P || !P.hero) return;
    measure();
    const box = q => { let a = 1e9, b = -1e9, c = 1e9, d = -1e9; for (let i = 0; i < 8; i += 2) { a = Math.min(a, q[i] * FW); b = Math.max(b, q[i] * FW); c = Math.min(c, q[i + 1] * FH); d = Math.max(d, q[i + 1] * FH); } return [a, b, c, d]; };
    const s0 = Math.max(sw / FW, sh / FH) * 1.0006, B = box(P.hero.live);
    // the hero: cover the stage, lean toward the paper, keep the paper where every screen shows it
    const keep = (t, lo, hi, ext, m) => { const a = lo * s0 + t, b = hi * s0 + t; return b - a > ext - 2 * m ? t + ext / 2 - (a + b) / 2 : a < m ? t + m - a : b > ext - m ? t - (b - ext + m) : t; };
    const cov = (t, ext, size) => clamp(t, Math.min(0, ext - size * s0), 0);
    const inside = (t, lo, hi, ext) => lo * s0 + t >= 11 && hi * s0 + t <= ext - 11;
    let tx = cov(keep(sw / 2 - s0 * lerp(FW / 2, (B[0] + B[1]) / 2, .5), B[0], B[1], sw, 12), sw, FW);
    let ty = cov(keep(safe / 2 - s0 * lerp(FH / 2, (B[2] + B[3]) / 2, .5), B[2], B[3], safe, 12), sh, FH);
    for (const c of [P.hero.spots.lamp_chain, P.hero.card]) if (c) {  // the chain and the card too, if the paper can stay
      const b = c.length > 3 ? box(c) : [c[0] * FW, c[0] * FW, c[1] * FH, c[1] * FH];
      const nx = cov(keep(tx, b[0], b[1], sw, 34), sw, FW), ny = cov(keep(ty, b[2], b[3], safe, 34), sh, FH);
      if (inside(nx, B[0], B[1], sw)) tx = nx;
      if (inside(ny, B[2], B[3], safe)) ty = ny;
    }
    V0 = V1 = V2 = {s: s0, tx, ty};
    if (LIVE) { N = natural(); N.x = Math.round(N.x); N.y = Math.round(N.y); }
    const lt = P.lt;
    TP = Math.max(0, +(typeof o.top === 'function' ? o.top() : o.top) || 0);  // a bar the page lays over the film's top
    if (lt && LIVE) {  // the lean's last frame (no wider than the stage), then the page
      const q = lt.live.q[lt.frames - 1], lw = (q[2] - q[0]) * FW, s1 = Math.min(s0, .97 * sw / lw), s2 = LIVE.w * N.s / lw;
      V1 = {s: s1, tx: s1 * FW >= sw ? clamp(sw / 2 - s1 * (q[0] + q[2]) / 2 * FW, sw - s1 * FW, 0) : (sw - s1 * FW) / 2, ty: 0};
      V2 = {s: s2, tx: N.x - s2 * q[0] * FW, ty: N.y - s2 * q[1] * FH};
    }
    if (LIVE) {
      const w = LIVE.w * N.s, hh = LIVE.h * N.s;
      LIVE.nq = [N.x, N.y, N.x + w, N.y, N.x + w, N.y + hh, N.x, N.y + hh];
    }
    if (!still) {
      const len = o.length || {}, tail = LIVE ? N.y + LIVE.h * N.s - sh : 0;
      Ll = P.set.lean ? (len.lean || 1.6) * sh : 0; Lh = (len.hand || .55) * sh;
      st.style.height = Math.round(sh + Ll + Lh) + 'px';
      st.style.paddingBottom = tail > 0 ? Math.round(tail) + 'px' : ''; st.style.marginBottom = tail < 0 ? Math.round(tail) + 'px' : '';
    }
    if (gl) gl.size(sw, sh);
    kick();
  }
  const mixV = (a, b, t) => ({s: lerp(a.s, b.s, t), tx: lerp(a.tx, b.tx, t), ty: lerp(a.ty, b.ty, t)});

  /* ---------- a set of pictures (one time of day, one layout) ---------- */
  function load(s, ms) {
    const p = {set: s, a: ms ? 0 : 1, ms: ms || 1, pa: 0, va: 0, el: h('div', 'tca-st-plane'), hero: null, lt: null, ready: false,
      F: s.lean && !still ? {n: s.lean.n, pat: s.lean.pat, s: [], blob: [], bmp: {}, dec: {}, live: 0, limit: 0, at: 0, shown: -1, key: ''} : null};
    if (P) olds.push(P);
    P = p; lc = gp = 0; fi = 0; vidT = -1;
    const big = s.first.reduce((a, f) => f.w > a.w ? f : a, s.first[0]);
    FW = big.w; FH = big.h; layout = s.layout;
    st.dataset.layout = layout; st.dataset.time = s.time;
    p.el.style.cssText = `width:${FW}px;height:${FH}px;opacity:${p.a}`;
    scene.insertBefore(p.el, gl ? gl.c : null);
    scene.setAttribute('aria-label', SC(s.time));
    // the blurred placeholder, unless the page's own stand-in picture shows under the film
    if (s.ph && (olds.length || !under.querySelector('img,picture'))) { p.ph = h('img', 'tca-st-ph', p.el, {alt: '', src: s.ph}); p.ph.style.filter = `blur(${Math.round(FW * .012)}px)`; }
    lampOn = store.lamp && store.lamp[s.time] != null ? !!store.lamp[s.time] : native();
    la = 0; syncUi(); fire('time', {time: s.time, auto: !want}); fire('lamp', {on: lampOn, user: false});
    measure();
    // the first picture: the size this screen needs, AVIF where the browser reads it
    const need = Math.max(sw / FW, sh / FH) * Math.min(W.devicePixelRatio || 1, 3) * FW, ws = [...new Set(s.first.map(f => f.w))].sort((a, b) => a - b),
      w = ws.find(x => x >= need * .8) || ws[ws.length - 1], pic = p.pic = h('picture', 'tca-st-first', p.el);
    for (const f of s.first) if (f.w === w && /avif/.test(f.type)) h('source', '', pic, {type: f.type, srcset: f.u});
    const im = p.img = h('img', '', pic, {alt: '', decoding: 'async', fetchpriority: 'high'});
    pic.style.opacity = 0;
    im.src = (s.first.find(f => f.w === w && !/avif/.test(f.type)) || s.first.find(f => f.w === w)).u;
    const shown = ok => { if (p.dead) return; p.ok = ok; p.ready = true; p.glDirty = true; kick(); if (p === P) later(); };
    (im.decode ? im.decode() : new Promise((y, n) => { im.onload = y; im.onerror = n; })).then(() => shown(true), () => shown(im.complete && im.naturalWidth > 0));
    // where the paper sits in the hero's first frame
    const got = hd => { if (p.dead) return; p.hero = hd; st.style.setProperty('--st-vw', hd.vw); st.style.setProperty('--st-vh', hd.vh); if (p === P) { fit(); if (lampOn !== native()) lampLayer(); } };
    if (s.hero) got(s.hero); else fetch(s.trh).then(r => r.json()).then(t => got(s.hero = hero0(t))).catch(fail);
  }
  /* After the first picture: what the film needs next. */
  function later() {
    const p = P, s = p.set;
    if (still || p.did) return;
    p.did = true;
    if (s.tr && s.lean) fetch(s.tr).then(r => r.json()).then(t => { if (p.dead) return; p.lt = t; if (p === P) fit(); if (pinned) more(p, 1); })
      .catch(() => { s.lean = null; p.F = null; if (p === P) fit(); });
    if (!gl && !flag('nogl')) { gl = makeGL(scene, lite); if (gl) { gl.size(sw, sh); st.dataset.gl = '1'; } }
    if (!pinned) { setTimeout(() => { if (!p.dead && p === P) loop(p); }, 250); setTimeout(() => more(p), 1500); }
  }
  /* The lean's frames in the background, a few at a time (on a phone's data or a slow line only once the reader moves) */
  function more(p, all) {
    const F = p.F, c = navigator.connection || {};
    if (!F || p.dead || F.limit >= F.n) return;
    F.limit = all ? F.n : F.limit + 8; pump(F);
    if (!all && c.type !== 'cellular' && !/2g|3g/.test(c.effectiveType || '')) setTimeout(() => more(p), 350);
  }
  function loop(p) {
    const v = h('video'), src = p.set.loop.filter(f => v.canPlayType(f.type)).sort((a, b) => a.bytes - b.bytes)[0];
    if (!src || p.vid) return;
    v.className = 'tca-st-loop'; v.muted = v.loop = v.playsInline = true; v.preload = 'auto';
    v.setAttribute('muted', ''); v.setAttribute('playsinline', ''); v.setAttribute('aria-hidden', 'true'); v.tabIndex = -1; v.style.opacity = 0;
    v.addEventListener('canplaythrough', kick);
    v.addEventListener('playing', () => { p.vplay = true; kick(); });
    v.src = src.u; p.vid = v; p.el.appendChild(v);
  }
  function depthLoad() {
    const p = P;
    if (!p || p.dz || p.dl || !p.set.depth || !gl || lite) return;
    p.dl = true;
    const im = new Image();
    im.onload = () => {
      const w = 192, hh = Math.round(w * FH / FW), c = h('canvas'); c.width = w; c.height = hh;
      const x = c.getContext('2d', {willReadFrequently: true}); x.drawImage(im, 0, 0, w, hh);
      let d; try { d = x.getImageData(0, 0, w, hh).data; } catch (e) { return; }
      p.dz = (u, v) => 1 / (.3 + 11.7 * d[4 * (clamp(Math.round(v * hh), 0, hh - 1) * w + clamp(Math.round(u * w), 0, w - 1))] / 255);
      const q = p.hero.live; p.z0 = p.dz((q[0] + q[2] + q[4] + q[6]) / 4, (q[1] + q[3] + q[5] + q[7]) / 4);
      p.dimg = im; p.glDirty = true; kick();
    };
    im.src = p.set.depth;
  }
  function lampLayer() {
    const p = P;
    if (!p || p.lampEl || !p.set.lamp) return;
    const im = p.lampEl = h('img', 'tca-st-lamp', p.el, {alt: ''});
    if (p.set.lamp.on) im.dataset.sub = '1';
    im.style.opacity = 0;
    im.onload = () => { p.lampOk = true; p.glDirty = true; kick(); };
    im.src = p.set.lamp.u;
  }

  /* ---------- the lean's frames: fetched near the reader's place, decoded a little ahead, let go behind ---------- */
  function pump(F) {
    while (F.live < (F.hot ? 4 : 2) && !F.dead) {
      let best = -1, bd = 1e9;
      for (let i = 0; i < F.limit; i++) if (!F.s[i]) { const d = Math.abs(i - F.at); if (d < bd) { bd = d; best = i; } }
      if (best < 0) return;
      const i = best; F.s[i] = 1; F.live++;
      fetch(F.pat.replace('%04d', String(i + 1).padStart(4, '0'))).then(r => r.ok ? r.blob() : Promise.reject()).then(b => { F.blob[i] = b; F.s[i] = 2; }, () => { F.s[i] = 3; })
        .then(() => { F.live--; pump(F); kick(); });
    }
  }
  function decode(F, i) {
    F.dec[i] = 1;
    (W.createImageBitmap ? createImageBitmap(F.blob[i]) : new Promise((y, n) => { const im = new Image(), u = URL.createObjectURL(F.blob[i]); im.onload = () => { URL.revokeObjectURL(u); y(im); }; im.onerror = n; im.src = u; }))
      .then(b => { F.dec[i] = 0; if (F.dead) { b.close && b.close(); return; } F.bmp[i] = b; kick(); }, () => { F.dec[i] = 0; F.s[i] = 3; });
  }
  function frames(F, c, dir) {
    const a = dir < 0 ? AH : BK, b = dir < 0 ? BK : AH;
    for (let i = Math.max(0, c - a); i <= Math.min(F.n - 1, c + b); i++) if (!F.bmp[i] && !F.dec[i] && F.s[i] === 2) decode(F, i);
    for (const i in F.bmp) if (i < c - a - 2 || i > c + b + 2) { F.bmp[i].close && F.bmp[i].close(); delete F.bmp[i]; }
  }
  /* soft edges, in parts of the frame: t at the top, from b0 down to b1 at the foot (nothing under b1), sd at each side */
  function drawLean(p, j, t, b0, b1, sd) {
    const F = p.F, key = [j, t, b0, b1, sd].map(n => n.toFixed(3)).join('|');
    if (F.key === key) return;
    const c = p.cv || (p.cv = Object.assign(h('canvas', 'tca-st-leanc', p.el, {'aria-hidden': 'true'}), {width: p.set.lean.w, height: p.set.lean.h}));
    const x = p.cx || (p.cx = c.getContext('2d')), w = c.width, hh = c.height;
    F.key = key; F.shown = j;
    x.globalCompositeOperation = 'copy'; x.drawImage(F.bmp[j], 0, 0, w, hh);
    if (t > 0 || b0 < 1 || sd > 0) {  // where the picture stops short of the stage, as it gives way to the page, under an upright paper
      x.globalCompositeOperation = 'destination-in';
      const T = 'rgba(0,0,0,0)', K = '#000', fade = (gx, gy, a, c0, c1) => {
        const g = x.createLinearGradient(0, 0, gx, gy), a1 = Math.max(a, .001), e0 = Math.max(a1, Math.min(c0, .999));
        g.addColorStop(0, a > 0 ? T : K); g.addColorStop(a1, K); g.addColorStop(e0, K); g.addColorStop(Math.max(e0, Math.min(c1, 1)), c0 < 1 ? T : K);
        x.fillStyle = g; x.fillRect(0, 0, w, hh);
      };
      fade(0, hh, t, b0, b1);
      if (sd > 0) fade(w, 0, sd, 1 - sd, 1);
    }
    x.globalCompositeOperation = 'source-over';
  }

  /* ---------- every frame ---------- */
  function quad(it, v, px, py) {
    const p = P, tr = fi > 0 && p.lt ? p.lt[it.k] : null, q = tr ? tr.q[fi] : p.hero[it.k];
    if (!q) return null;
    const out = [], cx = (q[0] + q[2] + q[4] + q[6]) / 4, cy = (q[1] + q[3] + q[5] + q[7]) / 4;
    for (let i = 0; i < 8; i += 2) {
      let x = q[i] * FW, y = q[i + 1] * FH;
      if ((px || py) && p.dz) { const d = p.dz(lerp(q[i], cx, .1), lerp(q[i + 1], cy, .1)) - p.z0; x += px * d; y += py * d; }
      out.push(v.tx + v.s * x, v.ty + v.s * y);
    }
    return out;
  }
  function tick(now) {
    raf = 0;
    if (!alive || !built || !P || !P.hero) return;
    const dt = clamp(now - last, 1, 80), p = P; last = now; busy = false;
    if (pend && (lean === 0 || handed)) { pend = false; setTime(want); return; }
    if (!still) {
      if (pinned) { tL = clamp(pinF); tH = clamp(pinF - 1); }
      else { const y = topPx - st.getBoundingClientRect().top; tL = Ll ? clamp(y / Ll) : 0; tH = clamp((y - Ll) / (Lh || 1)); }
      const k = pinned || !wasReady || snap ? 1 : 1 - Math.exp(-dt / 85);  /* a page opened part-way down starts there */
      snap = false;
      if (lean !== tL) { lean += (tL - lean) * k; if (Math.abs(tL - lean) < 4e-4) lean = tL; busy = true; }
      if (hand !== tH) { hand += (tH - hand) * k; if (Math.abs(tH - hand) < 4e-4) hand = tH; busy = true; }
    }
    const eh = sss(hand), v = mixV(mixV(V0, V1, sss(lean * 2 - 1)), V2, eh), F = p.F, moves = lean > 0 || tL > 0 || tH > 0 || pinned;
    // as the lean brings the paper up, its top is kept clear of a bar the page lays over the film (given back as the page takes it)
    if (TP && fi > 0 && p.lt) { const q = p.lt.live.q[fi], need = q ? TP + 6 - v.ty - v.s * Math.min(q[1], q[3]) * FH : 0; if (need > 0) v.ty += Math.min(need, TP) * (1 - eh); }
    // another hour's pictures coming in; the first picture over its placeholder
    p.a = ramp(p.a, p.ready && p.hero ? 1 : 0, p.ms, dt); p.pa = ramp(p.pa, p.ready && p.ok ? 1 : 0, 500, dt);
    if (p.a >= 1 && olds.length) { olds.forEach(drop); olds = []; }
    if (p.pa >= 1) { st.classList.add('is-in'); if (p.ph) { p.ph.remove(); p.ph = null; } }
    p.pic.style.opacity = ss(p.pa);
    // the lean
    if (F && p.lt && moves) {
      const ft = Math.round(lean * (F.n - 1));
      F.at = Math.round(tL * (F.n - 1)); F.limit = F.n; F.hot = 1; pump(F);
      frames(F, ft, tL < lean ? -1 : 1);
      let j = -1, bd = 1e9; for (const i in F.bmp) { const d = Math.abs(i - ft); if (d < bd) { bd = d; j = +i; } }
      const gap = sh - (v.ty + v.s * FH), side = sw - v.s * FW, he = eh > 0 ? .1 * ss(eh * 3) : 0;
      if (j >= 0) {
        let b0 = 1 - Math.max(gap > 1 ? .24 * ss(gap / 60) : 0, he), b1 = 1;
        if (layout === 'portrait') {  // upright, the table under the paper gives way to the page's own ground as the lean ends
          const q = p.lt.live.q[j], f = ss((lean - .55) / .45), e = q ? lerp(1, Math.max(q[5], q[7]) + .03, f) : 1;
          if (e < b1) { b1 = e; b0 = Math.min(b0, e - 22 / (v.s * FH)); }  // gone inside the paper's own margin: no blotter shows under its foot
        }
        drawLean(p, j, he, b0, b1, Math.max(he, side > 1 ? .12 * ss(side / 80) : 0));
      }
      if (j !== ft && F.s[ft] !== 3) busy = true;
    }
    lc = ramp(lc, F && F.shown >= 0 && moves ? 1 : 0, pinned ? 0 : lc < 1 && moves ? 260 : 450, dt);
    fi = lc > .5 && F ? F.shown : 0;
    if (p.cv) { p.cv.style.opacity = ss(lc); p.el.classList.toggle('is-lean', lc >= 1); }
    // the loop: started unseen (a phone fetches a video only when told to play), shown once it can play through
    if (p.vid) {
      const play = !p.vno && vis && !D.hidden && lc < 1 && !handed;
      if (play && p.vid.paused) p.vid.play().catch(() => { p.vno = 1; }); else if (!play && !p.vid.paused) p.vid.pause();
      p.vshow = p.vshow || (p.vplay && p.vid.readyState > 3);
      p.va = ramp(p.va, p.vshow ? 1 : 0, 800, dt); p.vid.style.opacity = ss(p.va);
    }
    // parallax, only while the hero is what shows
    const k2 = 1 - Math.exp(-dt / 130);
    for (let i = 0; i < 2; i++) { const d = parT[i] - par[i]; if (Math.abs(d) > 1e-4) { par[i] += d * k2; busy = true; } else par[i] = parT[i]; }
    const live3 = Math.abs(par[0]) + Math.abs(par[1]) + Math.abs(parT[0]) + Math.abs(parT[1]) > .004;
    gp = ramp(gp, gl && !gl.lost && !lite && p.dz && p.a >= 1 && p.ok && !moves && live3 ? 1 : 0, 320, dt);
    const pe = ss(gp) * (1 - ss(lc)), px = par[0] * pe * PK * FH, py = par[1] * pe * PK * .5 * FH;
    // the lamp
    la = ramp(la, p.lampOk && lampOn !== native() ? 1 : 0, la < 1 && lampOn !== native() ? 480 : 240, dt);
    const lampA = ss(la) * (1 - ss(lc));
    if (p.lampEl) p.lampEl.style.opacity = lampA;
    if (la !== p.lumA && (la === 0 || la === 1)) { p.lumA = la; p.glDirty = true; }
    tug = ramp(tug, 0, 300, dt);
    // where everything goes
    const tf = `translate(${v.tx.toFixed(2)}px,${v.ty.toFixed(2)}px) scale(${v.s.toFixed(5)})`;
    for (const q of olds.concat([p])) if (q.tf !== tf) { q.el.style.transform = q.tf = tf; }
    for (const q of olds) q.el.style.opacity = 1;
    p.el.style.opacity = ss(p.a);
    const so = 1 - ss((hand - .1) / .72);
    scene.style.opacity = so;
    const placeAll = sharp => {
      let moved = false;
      for (const it of items) {
        const e = it.print || it.e, w = it.o;
        if (it === LIVE && !still && hand >= 1) {  // on the page: a plain place and size
          if (!it.page) { it.page = true; it.A = null; it.qk = ''; w.style.transform = `translate(${N.x}px,${N.y}px)`; e.style.transform = `scale(${N.s})`; w.classList.add('is-page'); e.classList.add('is-page'); w.style.visibility = ''; }
          continue;
        }
        let q = quad(it, v, px, py);
        if (!q) { w.style.visibility = 'hidden'; continue; }
        if (it === LIVE && !still) {
          if (hand > 0) { const r = quad(it, V2, 0, 0); q = q.map((c, i) => c + (LIVE.nq[i] - r[i]) * eh); }  // off the picture only if the lean never played
          if (it.page) { it.page = false; w.classList.remove('is-page'); e.classList.remove('is-page'); }
        } else if (!still) w.style.opacity = so;
        const xs = [q[0], q[2], q[4], q[6]], ys = [q[1], q[3], q[5], q[7]];
        const off = Math.max(...xs) < 0 || Math.min(...xs) > sw || Math.max(...ys) < 0 || Math.min(...ys) > sh || (it !== LIVE && so <= 0);
        w.style.visibility = off ? 'hidden' : '';
        if (!off && setQ(it, e, q, sharp)) moved = true;
      }
      return moved;
    };
    if (placeAll(pinned || still || !moving)) { moveT = now; moving = true; }
    else if (moving && now - moveT > 140) { moving = false; placeAll(true); }
    if (moving) busy = true;
    ink.style.visibility = p.ph || p.pa >= 1 || p.ok === false ? '' : 'hidden';  /* over the page's own stand-in picture the paper waits */
    // the page's things pinned to the table (1 px = 1 mm there), and the lamp's chain
    const spot = k => { const tr = fi > 0 && p.lt ? p.lt.spots[k] : null, s = tr ? tr[fi] : p.hero.spots[k]; if (!s) return null; const d = p.dz && (px || py) ? p.dz(s[0], s[1]) - p.z0 : 0; return [v.tx + v.s * (s[0] * FW + px * d), v.ty + v.s * (s[1] * FH + py * d), s[2] ? s[2] * FH * v.s / 1000 : 1]; };
    for (const k in spotEls) if (spotEls[k]) {
      const s = spot(k), e = spotEls[k], out = !s || so <= 0 || s[0] < -200 || s[0] > sw + 200 || s[1] < -200 || s[1] > sh + 200;
      e.style.visibility = out ? 'hidden' : ''; if (!out) { e.style.transform = `translate(${s[0].toFixed(1)}px,${s[1].toFixed(1)}px) scale(${s[2].toFixed(4)})`; e.style.opacity = so; }
    }
    uiA = ramp(uiA, moves ? 0 : 1, 220, dt);
    ui.style.opacity = uiA; ui.style.visibility = uiA <= 0 ? 'hidden' : '';
    const ch = spot('lamp_chain'), chOk = ch && p.set.lamp && ch[0] > 20 && ch[0] < sw - 20 && ch[1] > 20 && ch[1] < safe - 20;
    chainB.style.display = chOk ? '' : 'none';
    if (chOk) chainB.style.transform = `translate(${(ch[0] - 22).toFixed(1)}px,${(ch[1] - 22).toFixed(1)}px)`;
    // handed over, or back in the film
    const hd = !still && hand >= 1;
    if (hd !== handed) {
      handed = hd; st.classList.toggle('is-handed', hd); scene.style.visibility = hd ? 'hidden' : '';
      if (hd && F) { for (const i in F.bmp) F.bmp[i].close && F.bmp[i].close(); F.bmp = {}; }  /* the page needs none of the film's frames */
      if (o.onHandOver) o.onHandOver(hd);
      fire('handed-over', {handed: hd});
    }
    if (pendF && handed) { const f = pendF; pendF = null; requestAnimationFrame(() => { try { f.scrollIntoView({block: 'nearest'}); } catch (e) {} }); }
    const fv = (1 - eh).toFixed(3);
    if (fv !== filmVar) st.style.setProperty('--st-film', filmVar = fv);
    const key = lean.toFixed(4) + hand.toFixed(4) + fi;
    if (key !== lastP) { lastP = key; const d = progress(); if (o.onProgress) o.onProgress(d); fire('progress', d); }
    // the WebGL layer
    if (gl && !gl.lost && !handed && vis) {
      if (p.glDirty && p.ready && p.ok) {
        p.glDirty = false; gl.put('A', p.img);
        if (p.dimg) gl.put('Dp', p.dimg);
        if (p.lampOk) gl.put('Lm', p.lampEl);
        const c = p.lum || (p.lum = h('canvas')), x = c.getContext('2d'); c.width = 64; c.height = Math.round(64 * FH / FW);
        x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1; x.drawImage(p.img, 0, 0, c.width, c.height);
        if (p.lampOk && la > 0) { x.globalCompositeOperation = native() ? 'difference' : 'lighter'; x.drawImage(p.lampEl, 0, 0, c.width, c.height); }
        gl.put('Lu', c);
      }
      const useV = p.vid && p.va > 0 && gp > 0;
      if (useV && p.vid.currentTime !== vidT) { vidT = p.vid.currentTime; gl.put('B', p.vid); }
      const T = {morning: [1, [1, .9, .7]], afternoon: [.45, [1, .97, .9]], dusk: [.5, [1, .8, .55]], night: [.4, [1, .82, .6]]}[p.set.time] || [.5, [1, .9, .8]];
      const fade = (1 - ss(lean / .3)) * so * ss(p.a) * ss(p.pa), tt = flag('t') ? num('t') : (now - t0) / 1000, cup = spot('cup'), ob = spot('object');
      let steam = null;
      if (cup && fade > 0 && cup[0] > -60 && cup[0] < sw + 60 && cup[1] > 0 && cup[1] < sh + 40) {
        const up = layout === 'portrait', mm = ob ? ob[2] : v.s * FH / 900, w = (up ? 125 : 150) * mm, hh = (up ? 170 : 260) * mm;  // a plume about 15 x 26 cm (shorter upright)
        steam = [cup[0] / sw * 2 - 1, 1 - cup[1] / sh * 2, w / sw * 2, hh / sh * 2, T[0] * (up ? .38 : .5) * fade];
      }
      const day = p.set.time === 'morning' || p.set.time === 'afternoon';  // by day the lamp is weak beside the sun: twice its light
      gl.draw({uv: [sw / (v.s * FW), sh / (v.s * FH), -v.tx / (v.s * FW), -v.ty / (v.s * FH)], par: [px / FW, py / FH], z0: p.z0 || .5,
        mix: useV ? ss(p.va) : 0, pic: ss(gp) * (1 - ss(lc)), lamp: (native() ? -1 : day ? 2 : 1) * lampA, tug: Math.sin(tug * Math.PI) * .007,
        chain: p.hero.spots.lamp_chain || [0, 0], aspect: FW / FH, dust: T[0] * fade * (o.dust == null ? 1 : o.dust), steam, t: tt, px: v.s * FH,
        ds: sw < 600 ? .6 : 1, col: T[1]});
      if (fade > 0 && !D.hidden && !flag('t')) busy = true;
    }
    // ready, idle
    if (!wasReady && p.ready && p.hero) { wasReady = true; st.dataset.ready = '1'; if (st.dataset.boot) st.style.background = st.style.minHeight = ''; if (o.onReady) o.onReady(api); fire('ready', progress()); }
    const calm = wasReady && p.a >= 1 && p.pa === (p.ok ? 1 : 0) && lean === tL && hand === tH && !moving && (!pinned || !F || !p.set.lean || F.shown === Math.round(tL * (F.n - 1))) && (la === 0 || la === 1) && uiA % 1 === 0;
    if (calm) st.dataset.idle = '1'; else delete st.dataset.idle;
    if (busy || !calm) kick();
  }
  const progress = () => ({p: Ll + Lh ? (lean * Ll + hand * Lh) / (Ll + Lh) : 0, lean, hand, frame: fi + 1, frames: P && P.F ? P.F.n : 0, handed,
    time: P ? P.set.time : null, layout, mode: still ? 'still' : 'film', gl: !!gl, lamp: lampOn, held: P && P.F ? Object.keys(P.F.bmp).length : 0});

  /* ---------- the reader's hand ---------- */
  function go(focus, now) {
    const r = (still && LIVE ? LIVE.e : st).getBoundingClientRect();
    W.scrollTo({top: W.scrollY + r.top - topPx + (still ? LIVE ? -12 : sh : Ll + Lh + 1), behavior: still || now ? 'auto' : 'smooth'});
    if (now) { snap = true; kick(); }
    if (focus && LIVE) { LIVE.e.tabIndex = -1; LIVE.e.focus({preventScroll: true}); }
  }
  function syncUi() {
    if (!built || !P) return;
    const t = P.set.time;
    dialB.innerHTML = svg(t); dialB.setAttribute('aria-label', LB.dial + ': ' + LB[t]);
    dialP.querySelectorAll('[role=radio]').forEach(b => { const c = b.dataset.t === t; b.setAttribute('aria-checked', c); b.tabIndex = c ? 0 : -1; b.disabled = !sets[b.dataset.t + '/' + layout]; });
    dialP.querySelector('.tca-st-now').setAttribute('aria-pressed', !want);
    chainB.setAttribute('aria-pressed', lampOn);
  }
  function setTime(t) {
    want = TIMES.includes(t) ? t : null;
    if (!built || !P) return;
    if (lean > 0 && !handed) { pend = true; return; }
    const s = pick(timeNow(), layout);
    if (s && s.layout !== layout) { rebuild(); return; }
    if (s && s !== P.set) load(s, still || handed ? 1 : 1300);
    syncUi(); kick();
  }
  function setLamp(v, user) {
    lampOn = !!v;
    if (!P) return;
    if (user) { (store.lamp || (store.lamp = {}))[P.set.time] = lampOn ? 1 : 0; save(); }
    if (lampOn !== native()) lampLayer();
    syncUi(); fire('lamp', {on: lampOn, user: !!user}); kick();
  }
  /* by the reader's own tap (a phone that asks first shows its question then) */
  const tiltAsk = () => { const d = W.DeviceOrientationEvent; if (d && d.requestPermission) d.requestPermission().then(tiltOn, () => {}); else tiltOn(); };
  function tiltOn() {
    if (tilt0 || still) return;
    tilt0 = [null, null];
    on(W, 'deviceorientation', e => {
      if (e.gamma == null) return;
      if (tilt0[0] == null) { tilt0 = [e.gamma, e.beta]; if (tiltB) tiltB.setAttribute('aria-pressed', 'true'); }
      tilt0[0] += (e.gamma - tilt0[0]) * .004; tilt0[1] += (e.beta - tilt0[1]) * .004;  // any hold becomes level
      parT = [clamp((e.gamma - tilt0[0]) / 14, -1, 1), clamp((e.beta - tilt0[1]) / 14, -1, 1)];
      depthLoad(); kick();
    }, {passive: true});
  }
  function listen() {
    on(W, 'scroll', kick, {passive: true});
    let rz = 0; on(W, 'resize', () => { clearTimeout(rz); rz = setTimeout(() => { if (!built) return; measure(); const s = pick(timeNow(), shape()); if (s && s.layout !== layout) rebuild(); else fit(); }, 120); });
    on(D, 'visibilitychange', kick); on(W, 'pageshow', kick);
    if (!still) {
      on(W, 'pointermove', e => { if (e.pointerType === 'touch' || handed) return; parT = [clamp(e.clientX / sw * 2 - 1, -1, 1), clamp((e.clientY - topPx) / sh * 2 - 1, -1, 1)]; depthLoad(); kick(); }, {passive: true});
      on(HT, 'pointerleave', () => { parT = [0, 0]; kick(); });
      on(W, 'pointerdown', e => { if (P) P.vno = 0; if (e.pointerType === 'touch') tiltOn(); }, {passive: true});  // listening asks nothing
    }
    if (W.IntersectionObserver) { io = new IntersectionObserver(es => { vis = es[es.length - 1].isIntersecting; kick(); }); io.observe(st); }
    mo = new MutationObserver(() => { if (simple() !== still) rebuild(); }); mo.observe(HT, {attributes: true, attributeFilter: ['data-motion', 'data-calm', 'class']});
    try { const m = matchMedia('(prefers-reduced-motion: reduce)'), f = () => { if (simple() !== still) rebuild(); }; m.addEventListener('change', f); offs.push(() => m.removeEventListener('change', f)); } catch (e) {}
    clock = setInterval(() => { if (!want && P && pick(timeOfDay(), layout) !== P.set && !D.hidden) setTime(null); }, 60000);
    offs.push(() => { clearInterval(clock); if (io) io.disconnect(); if (mo) mo.disconnect(); });
  }
  function begin() {
    build(); measure();
    layout = shape();
    const s = pick(timeNow(), layout);
    if (!s) throw new Error('stage: no pictures');
    listen(); load(s, 0); kick();
  }
  function rebuild() { if (built) unbuild(); wasReady = false; delete st.dataset.ready; begin(); }

  const api = {
    get progress() { return progress(); },
    get time() { return P ? P.set.time : null; }, has: t => !!(sets && sets[t + '/' + layout]),
    setTime, setLamp: v => setLamp(v, true), skip: () => go(true), tilt: tiltAsk, refresh: () => { if (still && LIVE) { reprint(); fit(); } else fit(); },
    destroy() {
      if (!alive) return;
      if (built) unbuild();
      alive = false;
      st.classList.remove('tca-st'); st.style.cursor = '';
      for (const k of ['mode', 'ready', 'idle', 'layout', 'time', 'gl']) delete st.dataset[k];
      for (const k of ['vw', 'vh', 'film']) st.style.removeProperty('--st-' + k);
    }
  };
  /* the film cannot play: the page is left as it was, and told */
  function fail(e) {
    if (!alive) return;
    api.destroy(); st.dataset.mode = 'plain';
    fire('error', {error: String(e)});
  }
  Promise.resolve(typeof o.media === 'string' ? fetch(o.media).then(r => r.json()) : o.media)
    .then(m => { if (!alive) return; sets = norm(m, base); begin(); }).catch(fail);
  return api;
}
