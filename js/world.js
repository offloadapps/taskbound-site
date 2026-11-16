/* The landing page's night: the Hollow Keep drawn as real Gaussian splats (the app's own sculpt, app/keep-splat.js),
   a painted sky with the ringed moon, smoke made of large soft splats and a drift of embers. Everything is drawn into a
   small pixel grid and scaled up with ordered dithering, so it sits with the app's pixel paintings.
   Scrolling turns and lowers the camera, pushes the smoke and wakes the keep's windows one by one.
   Needs WebGL2; without it the page shows the flat painting (see .no-gl in index.html). Reduced motion keeps it still. */
(function () {
  'use strict';
  const canvas = document.getElementById('world');
  const root = document.documentElement;
  const fail = () => { root.classList.add('no-gl'); if (canvas) canvas.remove() };
  try { start() } catch (e) { if (window.console) console.error(e); fail() }
  function start() {
  if (!canvas || typeof KEEP_SPLAT === 'undefined') return fail();
  let gl;
  try { gl = canvas.getContext('webgl2', { antialias: false, alpha: false, premultipliedAlpha: false, powerPreference: 'high-performance' }) } catch (e) { }
  if (!gl) return fail();
  const calm = matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------- the keep's splats ---------- */
  const K = KEEP_SPLAT, n = K.n, bin = atob(K.data), YT = 17, ZT = -0.2;
  const TW = 1024, TH = Math.ceil(n / TW);
  const tA = new Float32Array(TW * TH * 4), tB = new Float32Array(TW * TH * 4), tC = new Float32Array(TW * TH * 4);
  const P = new Float32Array(n * 3), WIN = new Uint8Array(n);
  const i16 = o => { const v = bin.charCodeAt(o) | bin.charCodeAt(o + 1) << 8; return v > 32767 ? v - 65536 : v };
  const i8 = o => { const v = bin.charCodeAt(o); return v > 127 ? v - 256 : v };
  const winSum = Array.from({ length: 9 }, () => [0, 0, 0, 0]);
  for (let i = 0; i < n; i++) {
    const o = i * 14, ls = K.ls;
    const x = i16(o) / 1000, y = i16(o + 2) / 1000 - YT, z = i16(o + 4) / 1000 - ZT;
    const a = i8(o + 6) * ls, b = i8(o + 7) * ls, c = i8(o + 8) * ls, d = i8(o + 9) * ls, e = i8(o + 10) * ls, f = i8(o + 11) * ls;
    const col = bin.charCodeAt(o + 12), w = bin.charCodeAt(o + 13);
    P[i * 3] = x; P[i * 3 + 1] = y; P[i * 3 + 2] = z; WIN[i] = w;
    tA.set([x, y, z, col], i * 4);
    // Σ = L Lᵀ with L = [[a,0,0],[b,c,0],[d,e,f]]
    tB.set([a * a, a * b, a * d, b * b + c * c], i * 4);
    tC.set([b * d + c * e, d * d + e * e + f * f, w, 0], i * 4);
    if (w) { const s = winSum[w]; s[0] += x; s[1] += y; s[2] += z; s[3]++ }
  }
  const WINPOS = new Float32Array(27);
  winSum.forEach((s, i) => { if (s[3]) WINPOS.set([s[0] / s[3], s[1] / s[3], s[2] / s[3] + 0.08], i * 3) });
  const PAL = new Float32Array(K.pal.length * 3);
  K.pal.forEach((h, i) => PAL.set([parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255], i * 3));

  /* ---------- GL helpers ---------- */
  function sh(type, src) {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  function prog(vs, fs) {
    const p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {}, cnt = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < cnt; i++) { const info = gl.getActiveUniform(p, i), nm = info.name.replace(/\[0\]$/, ''); u[nm] = gl.getUniformLocation(p, info.name) }
    return { p, u };
  }
  function tex(data, w, h, fmt, ifmt, type, filter) {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, ifmt, w, h, 0, fmt, type, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    return t;
  }

  // shared: projection by the camera's basis, in pixels of the small grid
  const CAM = `
uniform vec3 uEye, uR, uU, uF; uniform float uFocal; uniform vec2 uRes, uOff;
vec3 toView(vec3 p){ vec3 d = p - uEye; return vec3(dot(d, uR), dot(d, uU), dot(d, uF)); }
vec4 toClip(vec2 px){ return vec4(px / (uRes * .5) + uOff, 0., 1.); }`;

  const NOISE = `
float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p){ float s = 0., a = .5; for (int i = 0; i < 5; i++){ s += a * vnoise(p); p = p * 2.03 + 17.1; a *= .5; } return s; }`;

  /* the sky: night gradient, far crags, drifting cloud banks, stars, the ringed moon and the river of embers below */
  const skyP = prog(`#version 300 es
void main(){ vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2); gl_Position = vec4(p * 2. - 1., 0., 1.); }`,
  `#version 300 es
precision highp float;
uniform vec2 uRes; uniform float uTime, uScroll, uPan;
uniform vec3 uMoon; // centre (px from the grid's centre) and radius (px)
out vec4 o;
${NOISE}
void main(){
  vec2 px = gl_FragCoord.xy, c = px - uRes * .5;
  float H = uRes.y, y = px.y / H;
  // night, deepening to wine and ember near the horizon
  vec3 col = mix(vec3(.10,.035,.07), vec3(.035,.02,.06), smoothstep(.15,.55,y));
  col = mix(col, vec3(.015,.01,.03), smoothstep(.55,1.,y));
  col += vec3(.55,.16,.06) * pow(1. - y, 6.) * .9;
  // stars, twinkling
  vec2 sp = floor(px + vec2(uPan * H * .02, uScroll * H * .02));
  float st = hash(sp); if (st > .9965) col += vec3(.9,.85,1.) * (.45 + .55 * sin(uTime * (1. + st * 7.) + st * 40.)) * smoothstep(.25,.6,y);
  // the moon: a pale disc lit from the upper left, faint maria, and its ring (the back half hides behind the disc)
  vec2 m = c - uMoon.xy; float R = uMoon.z, dm = length(m);
  vec2 rq = mat2(.985, .17, -.17, .985) * m; float re = length(vec2(rq.x, rq.y * 4.2)) / R;
  float ring = smoothstep(1.48,1.52,re) * (1. - smoothstep(1.86,1.9,re)) * (.55 + .45 * smoothstep(1.55,1.8,re));
  ring *= .55 + .3 * vnoise(vec2(re * 40., 0.));
  col += vec3(.18,.08,.12) * exp(-pow(max(dm / R - 1., 0.) * 2.2, 2.)) ; // halo
  if (rq.y > 0. ) col = mix(col, vec3(.86,.74,.62), ring * .75);           // back half of the ring
  if (dm < R) {
    vec2 q = m / R; float lit = clamp(.65 - .45 * dot(q, vec2(.6,-.5)), 0., 1.);
    float mar = fbm(q * 3.2 + 4.) ; float cr = smoothstep(.55,.7,fbm(q * 9. + 1.));
    vec3 mc = mix(vec3(1.,.94,.81), vec3(.80,.66,.60), smoothstep(.45,.65,mar)); mc = mix(mc, vec3(.68,.56,.55), cr * .5);
    mc *= .55 + .55 * lit; mc *= smoothstep(1.,.93,length(q)) * .25 + .75;
    col = mc;
  }
  if (rq.y <= 0.) col = mix(col, vec3(.93,.80,.66), ring * .85);            // front half crosses the disc
  // cloud banks drifting across, lit ember underneath; they slide as you scroll
  for (int i = 0; i < 3; i++) {
    float fi = float(i), yy = .30 + fi * .19 + uScroll * (.03 + fi * .02);
    vec2 cp = vec2(px.x / H * (1.6 - fi * .3) + uTime * (.006 + fi * .004) + uScroll * (.2 + fi * .12) + uPan * (.3 + fi * .2), (y - yy) * 6.);
    float d = fbm(cp * vec2(2.2, 1.)) - abs(y - yy) * (5. + fi * 2.) ;
    float a = smoothstep(.08,.5,d) * (.55 - fi * .1);
    vec3 cc = mix(vec3(.06,.03,.08), vec3(.30,.10,.10), smoothstep(.45,.15,d) * (1. - y));
    col = mix(col, cc, a);
  }
  // far crags, two ranges, sliding the other way to the keep
  for (int i = 0; i < 2; i++) {
    float fi = float(i), sh = px.x / H * (2. + fi) + uPan * (.6 + fi * .7) + 7. * fi;
    float ridge = .22 - fi * .07 + fbm(vec2(sh * 1.3, fi)) * (.16 - fi * .04) + .05 * abs(sin(sh * 2.7));
    if (y < ridge) col = mix(vec3(.05,.025,.06), vec3(.025,.012,.03), fi) + vec3(.35,.10,.04) * pow(1. - y, 8.) * (.6 - fi * .3);
  }
  // the river of embers
  float rv = .055 + .02 * sin(px.x / H * 5. + uPan * 2.) + .012 * fbm(vec2(px.x / H * 8. + uTime * .05, uTime * .1));
  col += vec3(.6,.2,.06) * exp(-max(y - rv, 0.) * 28.) * .55; // the river's glow on the mist above it
  if (y < rv) {
    float f = fbm(vec2(px.x / H * 14. - uTime * .25, y * 40. + uTime * .3));
    col = mix(vec3(.55,.12,.05), vec3(1.,.62,.25), smoothstep(.45,.75,f)) * (.75 + .25 * sin(uTime * 2. + px.x * .1));
  }
  o = vec4(col, 1.);
}`);

  /* the keep: one quad a splat, laid far to near, each a Gaussian projected through the camera */
  const keepP = prog(`#version 300 es
precision highp float; precision highp int; precision highp usampler2D;
layout(location = 0) in vec2 aCorner;
layout(location = 1) in uint aIdx;
uniform highp sampler2D tA, tB, tC;
uniform vec3 uPal[30]; uniform float uLit[9]; uniform vec3 uWin[9]; uniform float uTime;
${CAM}
out vec2 vUV; out vec3 vCol; out float vGlow;
void main(){
  ivec2 tc = ivec2(int(aIdx % 1024u), int(aIdx / 1024u));
  vec4 A = texelFetch(tA, tc, 0), B = texelFetch(tB, tc, 0), C = texelFetch(tC, tc, 0);
  vec3 v = toView(A.xyz);
  if (v.z < 1.) { gl_Position = vec4(2., 2., 2., 1.); return; }
  mat3 S = mat3(B.x, B.y, B.z, B.y, B.w, C.x, B.z, C.x, C.y);
  float iz = 1. / v.z;
  vec3 j0 = uFocal * iz * uR - uFocal * v.x * iz * iz * uF;
  vec3 j1 = uFocal * iz * uU - uFocal * v.y * iz * iz * uF;
  vec3 s0 = S * j0, s1 = S * j1;
  float a = dot(j0, s0) + .3, b = dot(j0, s1), c = dot(j1, s1) + .3;
  float mid = .5 * (a + c), rad = sqrt(max(.25 * (a - c) * (a - c) + b * b, 0.));
  float l1 = mid + rad, l2 = max(mid - rad, .05);
  vec2 e1 = abs(b) > 1e-7 ? normalize(vec2(b, l1 - a)) : (a >= c ? vec2(1., 0.) : vec2(0., 1.)), e2 = vec2(-e1.y, e1.x);
  const float K = 2.2;
  vec2 off = aCorner.x * e1 * min(sqrt(l1) * K, 128.) + aCorner.y * e2 * min(sqrt(l2) * K, 128.);
  gl_Position = toClip(uFocal * v.xy * iz + off);
  vUV = aCorner * K;
  // colour: the sculpt's own palette; woken windows burn; stone near them and near the river takes their warmth
  vec3 col = uPal[int(A.w + .5)] * 1.45 + vec3(.012,.01,.022);
  int w = int(C.z + .5); vGlow = 0.;
  if (w > 0) { float L = uLit[w]; col = mix(col, vec3(1.,.70,.36) * (1.15 + .15 * sin(uTime * 3. + float(w))), L); vGlow = L; }
  vec3 warm = vec3(0.);
  for (int i = 1; i < 9; i++) { vec3 d = A.xyz - uWin[i]; warm += uLit[i] * exp(-dot(d, d) * 1.6) * vec3(.42,.16,.05); }
  col += warm * (w > 0 ? 0. : 1.);
  col += vec3(.32,.08,.03) * smoothstep(-5.,-13.5, A.y) * (.8 + .2 * sin(uTime * 1.7 + A.x));
  col = mix(col, vec3(.13,.06,.15), smoothstep(-6.,-14.,A.y) * .45); // low mist
  vCol = col;
}`, `#version 300 es
precision highp float;
in vec2 vUV; in vec3 vCol; in float vGlow; out vec4 o;
void main(){
  float q = dot(vUV, vUV); if (q > 4.84) discard;
  float a = min(1., 1.5 * exp(-.5 * q));
  o = vec4(vCol * a, a);
}`);

  /* glows: soft additive light round woken windows */
  const glowP = prog(`#version 300 es
precision highp float;
layout(location = 0) in vec2 aCorner;
uniform vec3 uWin[9]; uniform float uLit[9]; uniform float uTime;
${CAM}
out vec2 vUV; out float vA;
void main(){
  int i = gl_InstanceID + 1; vec3 v = toView(uWin[i]);
  float s = uFocal * 1.6 / max(v.z, 1.);
  gl_Position = toClip(uFocal * v.xy / max(v.z, 1.) + aCorner * s);
  vUV = aCorner; vA = uLit[i] * (.85 + .15 * sin(uTime * 4.1 + float(i) * 2.3));
}`, `#version 300 es
precision highp float;
in vec2 vUV; in float vA; out vec4 o;
void main(){ float g = exp(-dot(vUV, vUV) * 4.); o = vec4(vec3(1.,.48,.18) * g * vA * .55, 0.); }`);

  /* smoke: big, soft, slow splats; the scroll lifts and drags them, and quick scrolling stretches them */
  const smokeP = prog(`#version 300 es
precision highp float;
layout(location = 0) in vec2 aCorner;
layout(location = 1) in vec4 aBase;   // x, y, z, size
layout(location = 2) in vec4 aMisc;   // seed, rise speed, opacity, warmth
uniform float uTime, uScroll, uVel, uThin;
${CAM}
out vec2 vUV; out vec2 vN; out float vA; out vec3 vCol;
void main(){
  vec3 p = aBase.xyz; float sd = aMisc.x;
  float rise = uTime * aMisc.y + uScroll * (3.5 + sd * 4.);
  p.y = -17. + mod(p.y + 17. + rise, 36.);
  p.x += sin(uTime * .045 + sd * 6.283) * 2.5 + uScroll * (sd - .5) * 9.;
  p.z += cos(uTime * .037 + sd * 4.1) * 1.5;
  vec3 v = toView(p);
  if (v.z < 2.) { gl_Position = vec4(2., 2., 2., 1.); return; }
  float s = uFocal * aBase.w / v.z;
  float stretch = 1. + min(abs(uVel), 3.) * .45;
  vec2 off = vec2(aCorner.x * s * stretch, aCorner.y * s / sqrt(stretch));
  gl_Position = toClip(uFocal * v.xy / v.z + off);
  vUV = aCorner;
  vN = aCorner * .6 * vec2(stretch, 1.) + vec2(sd * 37.1, sd * 11.3) + vec2(uTime * .012, -uTime * .02 - uScroll * .25);
  float edge = smoothstep(-17., -12., p.y) * smoothstep(19., 11., p.y);
  vA = aMisc.z * edge * mix(1., uThin, smoothstep(-3., 6., p.y)) * (1. + min(abs(uVel), 2.) * .25);
  float lowness = smoothstep(2., -14., p.y);
  vCol = mix(vec3(.16,.10,.19), vec3(.42,.15,.10), lowness * aMisc.w) + vec3(.09,.06,.10) * smoothstep(0., 10., p.y);
}`, `#version 300 es
precision highp float;
uniform sampler2D tN;
in vec2 vUV; in vec2 vN; in float vA; in vec3 vCol; out vec4 o;
void main(){
  float r = dot(vUV, vUV); if (r > 1.) discard;
  float g = exp(-r * 3.2);
  float nz = texture(tN, vN).r * .65 + texture(tN, vN * 2.3 + .5).r * .35;
  float a = vA * smoothstep(.35, .8, nz + g * .35) * (g * 1.4);
  o = vec4(vCol * a, a);
}`);

  /* embers: single pixels rising from the river, quicker while scrolling */
  const emberP = prog(`#version 300 es
precision highp float;
uniform float uTime, uScroll, uRise, uPx;
${CAM}
out vec3 vCol; out float vA;
float h(float n){ return fract(sin(n * 127.1) * 43758.5453); }
void main(){
  float i = float(gl_VertexID);
  float life = fract(h(i) + (uTime * (.035 + h(i + 3.) * .05)) + uRise * (.06 + h(i + 9.) * .05));
  vec3 p = vec3((h(i + 1.) - .5) * 34., -15. + life * 30., (h(i + 2.) - .5) * 26.);
  p.x += sin(uTime * (.8 + h(i + 4.)) + h(i + 5.) * 30.) * (.4 + life * 1.6);
  vec3 v = toView(p);
  if (v.z < 2.) { gl_Position = vec4(2., 2., 2., 1.); return; }
  gl_Position = toClip(uFocal * v.xy / v.z);
  gl_PointSize = h(i + 6.) > .82 ? 2. : 1.;
  vA = smoothstep(0., .1, life) * (1. - smoothstep(.55, 1., life)) * (.6 + .4 * sin(uTime * 9. + i));
  vCol = mix(vec3(1.,.85,.5), vec3(.9,.3,.12), life);
}`, `#version 300 es
precision highp float; in vec3 vCol; in float vA; out vec4 o;
void main(){ o = vec4(vCol * vA, 0.); }`);

  /* to the screen: the small grid scaled up whole pixels, posterised with a 4 x 4 Bayer dither */
  const postP = prog(`#version 300 es
void main(){ vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2); gl_Position = vec4(p * 2. - 1., 0., 1.); }`,
  `#version 300 es
precision highp float;
uniform sampler2D tS; uniform vec2 uRes, uScreen; uniform float uDim;
out vec4 o;
const float B[16] = float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.);
void main(){
  vec2 uv = gl_FragCoord.xy / uScreen;
  ivec2 g = ivec2(uv * uRes);
  vec3 c = texelFetch(tS, g, 0).rgb;
  float d = (B[(g.y & 3) * 4 + (g.x & 3)] + .5) / 16. - .5;
  const float L = 22.;
  c = floor(c * L + .5 + d) / L;
  vec2 q = uv - .5; c *= 1. - dot(q, q) * .55;   // a soft vignette
  c *= uDim;
  o = vec4(c, 1.);
}`);

  /* ---------- buffers ---------- */
  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

  const texA = tex(tA, TW, TH, gl.RGBA, gl.RGBA32F, gl.FLOAT, gl.NEAREST);
  const texB = tex(tB, TW, TH, gl.RGBA, gl.RGBA32F, gl.FLOAT, gl.NEAREST);
  const texC = tex(tC, TW, TH, gl.RGBA, gl.RGBA32F, gl.FLOAT, gl.NEAREST);

  const order = new Uint32Array(n), depthKey = new Uint16Array(n), cnt = new Uint32Array(65537);
  const idxBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, idxBuf); gl.bufferData(gl.ARRAY_BUFFER, order.byteLength, gl.DYNAMIC_DRAW);
  const keepVAO = gl.createVertexArray(); gl.bindVertexArray(keepVAO);
  gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, idxBuf); gl.enableVertexAttribArray(1); gl.vertexAttribIPointer(1, 1, gl.UNSIGNED_INT, 0, 0); gl.vertexAttribDivisor(1, 1);

  const glowVAO = gl.createVertexArray(); gl.bindVertexArray(glowVAO);
  gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  // smoke: a low river fog, wisps climbing the spire, and a few great near drifts. Split behind and in front of the keep.
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const smokeBack = [], smokeFront = [];
  const puff = (list, x, y, z, s, sp, a, warm) => list.push(x, y, z, s, rnd(), sp, a, warm);
  for (let i = 0; i < 150; i++) puff(smokeBack, (rnd() - .5) * 64, -16 + rnd() * 10, -6 - rnd() * 22, 4 + rnd() * 7, .05 + rnd() * .08, .3 + rnd() * .25, 1);   // river fog, far
  for (let i = 0; i < 140; i++) puff(smokeBack, (rnd() - .5) * 16, -16 + rnd() * 34, -1.5 - rnd() * 5, 1.8 + rnd() * 3, .25 + rnd() * .35, .22 + rnd() * .2, .8); // climbing the spire
  for (let i = 0; i < 100; i++) puff(smokeFront, (rnd() - .5) * 14, -16 + rnd() * 34, 1.5 + rnd() * 4, 1.6 + rnd() * 2.4, .3 + rnd() * .35, .16 + rnd() * .14, .8);
  for (let i = 0; i < 80; i++) puff(smokeFront, (rnd() - .5) * 56, -16 + rnd() * 14, 4 + rnd() * 14, 4 + rnd() * 6, .08 + rnd() * .1, .2 + rnd() * .18, 1);       // river fog, near
  for (let i = 0; i < 40; i++) { const side = rnd() < .5 ? -1 : 1; puff(smokeFront, side * (9 + rnd() * 16), -16 + rnd() * 34, 12 + rnd() * 10, 5 + rnd() * 6, .12 + rnd() * .14, .16 + rnd() * .14, .5) } // great drifts at the edges
  function smokeVAO(arr) {
    const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arr), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 32, 0); gl.vertexAttribDivisor(1, 1);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 32, 16); gl.vertexAttribDivisor(2, 1);
    return { vao, count: arr.length / 8 };
  }
  const SB = smokeVAO(smokeBack), SF = smokeVAO(smokeFront);
  const emptyVAO = gl.createVertexArray();

  // tileable fbm noise for the smoke's texture
  const NS = 128, nd = new Uint8Array(NS * NS);
  (function () {
    const g = []; for (let i = 0; i < 4; i++) { const s = 4 << i, a = new Float32Array(s * s); for (let k = 0; k < a.length; k++) a[k] = rnd(); g.push([s, a]) }
    for (let y = 0; y < NS; y++) for (let x = 0; x < NS; x++) {
      let v = 0, amp = .5, tot = 0;
      for (const [s, a] of g) {
        const fx = x / NS * s, fy = y / NS * s, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
        const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty), at = (i, j) => a[((j % s) * s) + (i % s)];
        v += amp * ((at(x0, y0) * (1 - sx) + at(x0 + 1, y0) * sx) * (1 - sy) + (at(x0, y0 + 1) * (1 - sx) + at(x0 + 1, y0 + 1) * sx) * sy);
        tot += amp; amp *= .5;
      }
      nd[y * NS + x] = Math.round(v / tot * 255);
    }
  })();
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  const texN = tex(nd, NS, NS, gl.RED, gl.R8, gl.UNSIGNED_BYTE, gl.LINEAR);

  /* ---------- the small grid ---------- */
  let fbo = null, fboTex = null, W = 0, H = 0, PX = 3, SW = 0, SH = 0;
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cw = innerWidth, ch = innerHeight;
    // about 300 rows of pixels whatever the screen, each a whole number of device pixels
    PX = Math.max(2, Math.round(ch * dpr / 300));
    SW = Math.round(cw * dpr); SH = Math.round(ch * dpr);
    canvas.width = SW; canvas.height = SH;
    const w = Math.ceil(SW / PX), h = Math.ceil(SH / PX);
    if (w === W && h === H && fbo) return;
    W = w; H = h;
    if (fboTex) gl.deleteTexture(fboTex);
    if (fbo) gl.deleteFramebuffer(fbo);
    fboTex = tex(null, W, H, gl.RGBA, gl.RGBA8, gl.UNSIGNED_BYTE, gl.NEAREST);
    fbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, fboTex, 0);
    dirty = true;
  }

  /* ---------- the camera, led by the scroll ---------- */
  // keyframes along the page: [progress, yaw, pitch, distance, look-at height]
  const KEYS = [[0, -.3, -.12, 29, 5], [.22, -.08, -.03, 38, 2.5], [.5, .22, .02, 44, .5], [.78, .38, .05, 50, -1], [1, .1, -.02, 46, 2]];
  const ease = t => t * t * (3 - 2 * t);
  function camAt(p) {
    for (let i = 1; i < KEYS.length; i++) if (p <= KEYS[i][0] || i === KEYS.length - 1) {
      const a = KEYS[i - 1], b = KEYS[i], t = ease(Math.min(1, Math.max(0, (p - a[0]) / (b[0] - a[0]))));
      return a.map((v, k) => v + (b[k] - v) * t).slice(1);
    }
  }
  const norm = v => { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l] };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

  let lastSortKey = '';
  function sortFor(eye, f) {
    const key = eye.map(v => v.toFixed(2)).join();
    if (key === lastSortKey) return;
    lastSortKey = key;
    let lo = 1e9, hi = -1e9;
    const D = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const d = (P[i * 3] - eye[0]) * f[0] + (P[i * 3 + 1] - eye[1]) * f[1] + (P[i * 3 + 2] - eye[2]) * f[2];
      D[i] = d; if (d < lo) lo = d; if (d > hi) hi = d;
    }
    const sc = 65535 / Math.max(hi - lo, 1e-6);
    cnt.fill(0);
    for (let i = 0; i < n; i++) { const k = 65535 - ((D[i] - lo) * sc | 0); depthKey[i] = k; cnt[k + 1]++ } // far first
    for (let k = 0; k < 65536; k++) cnt[k + 1] += cnt[k];
    for (let i = 0; i < n; i++) order[cnt[depthKey[i]]++] = i;
    gl.bindBuffer(gl.ARRAY_BUFFER, idxBuf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, order);
  }

  /* ---------- state from the page ---------- */
  let scrollP = 0, scrollScreens = 0, vel = 0, lastY = scrollY, lastT = performance.now(), pan = 0, panT = 0, dirty = true;
  let litTarget = 1, lit = 1;
  const hud = document.querySelectorAll('[data-hud-win]'), hudText = document.getElementById('hud-n');
  function readScroll() {
    const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    scrollP = Math.min(1, Math.max(0, scrollY / max));
    scrollScreens = scrollY / innerHeight;
    // the keep wakes room by room as you read: one window lit at the top, all eight by the end
    litTarget = 1 + 7 * Math.min(1, Math.max(0, (scrollP - .04) / .8));
  }
  addEventListener('scroll', () => { readScroll(); dirty = true }, { passive: true });
  addEventListener('resize', () => { resize(); readScroll() });
  addEventListener('pointermove', e => { if (e.pointerType === 'mouse') panT = (e.clientX / innerWidth - .5) * 2 }, { passive: true });
  readScroll(); resize();

  const uni = (pr, name) => pr.u[name];
  function setCam(pr, C) {
    gl.uniform3fv(uni(pr, 'uEye'), C.eye); gl.uniform3fv(uni(pr, 'uR'), C.r); gl.uniform3fv(uni(pr, 'uU'), C.u); gl.uniform3fv(uni(pr, 'uF'), C.f);
    gl.uniform1f(uni(pr, 'uFocal'), C.focal); gl.uniform2f(uni(pr, 'uRes'), W, H); gl.uniform2f(uni(pr, 'uOff'), C.off[0], C.off[1]);
  }

  let t0 = performance.now(), frameN = 0, shownHud = -1;
  function frame(now) {
    requestAnimationFrame(frame);
    const still = calm.matches;
    // about 30 frames a second is plenty for drifting smoke; scrolling gets every frame
    frameN++;
    if (!dirty && (still || frameN % 2)) return;
    dirty = false;
    const t = still ? 12 : (now - t0) / 1000;
    const dt = Math.max(1, now - lastT); lastT = now;
    const dy = scrollY - lastY; lastY = scrollY;
    vel += ((dy / dt) * 16 / Math.max(innerHeight, 1) * 20 - vel) * .15;
    if (still) vel = 0;
    pan += (panT - pan) * (1 - Math.exp(-dt / 500));
    lit += (litTarget - lit) * (still ? 1 : 1 - Math.exp(-dt / 260));
    if (Math.abs(litTarget - lit) > .002 || Math.abs(vel) > .002 || Math.abs(panT - pan) > .002) dirty = true;

    const wide = innerWidth / innerHeight > 1.05;
    let [yaw, pitch, dist, ty] = camAt(still ? Math.min(scrollP, .5) : scrollP);
    if (!still) { yaw += Math.sin(t * .13) * .025 + pan * .05; pitch += Math.sin(t * .09) * .01 }
    const heroK = Math.max(0, 1 - scrollScreens * 1.2);
    if (!wide) { dist *= 1.2 + .75 * heroK; ty += 1.2 + 2 * heroK }
    const target = [0, ty, 0];
    const eye = [target[0] + dist * Math.sin(yaw) * Math.cos(pitch), target[1] + dist * Math.sin(pitch), target[2] + dist * Math.cos(yaw) * Math.cos(pitch)];
    const f = norm([target[0] - eye[0], target[1] - eye[1], target[2] - eye[2]]);
    const r = norm(cross(f, [0, 1, 0])), u = cross(r, f);
    const focal = (H * .5) / Math.tan(17 * Math.PI / 180);
    // wide screens: the keep stands right of the words; tall ones: centred, a little high at the top of the page
    const off = wide ? [.42 + Math.min(.08, (innerWidth / innerHeight - 1.6) * .1), 0] : [0, .62 * heroK];
    const C = { eye, r, u, f, focal, off };
    sortFor(eye, f);

    const litArr = new Float32Array(9);
    for (let i = 1; i <= 8; i++) litArr[i] = Math.min(1, Math.max(0, lit - (i - 1)));
    const nLit = Math.floor(lit + .02);
    if (nLit !== shownHud) {
      shownHud = nLit;
      hud.forEach((h, i) => h.classList.toggle('on', i < nLit));
      if (hudText) hudText.textContent = nLit;
    }

    // moon: kept behind the keep's upper half on screen, sliding a little against the turn (it is far off)
    const kc = [0 - eye[0], 6.5 - eye[1], -2 - eye[2]], kz = dot(kc, f);
    const moon = [focal * dot(kc, r) / kz + off[0] * W * .5 - yaw * H * .35 + H * .05, focal * dot(kc, u) / kz + off[1] * H * .5 + H * .04, H * (wide ? .27 : .2)];
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo); gl.viewport(0, 0, W, H);
    gl.disable(gl.BLEND);
    gl.useProgram(skyP.p); gl.bindVertexArray(emptyVAO);
    gl.uniform2f(skyP.u.uRes, W, H); gl.uniform1f(skyP.u.uTime, t); gl.uniform1f(skyP.u.uScroll, scrollScreens * .12); gl.uniform1f(skyP.u.uPan, yaw);
    gl.uniform3f(skyP.u.uMoon, moon[0], moon[1], moon[2]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    const smoke = (S, thin) => {
      gl.useProgram(smokeP.p); setCam(smokeP, C); gl.bindVertexArray(S.vao);
      gl.uniform1f(smokeP.u.uTime, t); gl.uniform1f(smokeP.u.uScroll, scrollScreens); gl.uniform1f(smokeP.u.uVel, vel); gl.uniform1f(smokeP.u.uThin, thin);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texN); gl.uniform1i(smokeP.u.tN, 0);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, S.count);
    };
    smoke(SB, .45);

    gl.useProgram(keepP.p); setCam(keepP, C); gl.bindVertexArray(keepVAO);
    [texA, texB, texC].forEach((tx, i) => { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, tx) });
    gl.uniform1i(keepP.u.tA, 0); gl.uniform1i(keepP.u.tB, 1); gl.uniform1i(keepP.u.tC, 2);
    gl.uniform3fv(keepP.u.uPal, PAL); gl.uniform1fv(keepP.u.uLit, litArr); gl.uniform3fv(keepP.u.uWin, WINPOS); gl.uniform1f(keepP.u.uTime, t);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, n);

    gl.blendFunc(gl.ONE, gl.ONE);
    gl.useProgram(glowP.p); setCam(glowP, C); gl.bindVertexArray(glowVAO);
    gl.uniform3fv(glowP.u.uWin, WINPOS); gl.uniform1fv(glowP.u.uLit, litArr); gl.uniform1f(glowP.u.uTime, t);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, 8);

    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    smoke(SF, .12);

    gl.blendFunc(gl.ONE, gl.ONE);
    gl.useProgram(emberP.p); setCam(emberP, C); gl.bindVertexArray(emptyVAO);
    gl.uniform1f(emberP.u.uTime, t); gl.uniform1f(emberP.u.uScroll, scrollScreens); gl.uniform1f(emberP.u.uRise, scrollScreens * 1.5);
    gl.drawArrays(gl.POINTS, 0, still ? 120 : 260);

    gl.disable(gl.BLEND);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, SW, SH);
    gl.useProgram(postP.p); gl.bindVertexArray(emptyVAO);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, fboTex); gl.uniform1i(postP.u.tS, 0);
    gl.uniform2f(postP.u.uRes, W, H); gl.uniform2f(postP.u.uScreen, SW, SH); gl.uniform1f(postP.u.uDim, 1);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (!root.classList.contains('gl-on')) root.classList.add('gl-on');
  }
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); fail() });
  try { requestAnimationFrame(frame) } catch (e) { fail() }
  window.__world = { get lit() { return lit }, get W() { return W }, get H() { return H } };
  }
})();
