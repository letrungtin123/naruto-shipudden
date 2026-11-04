/* WebGL post-processing for Shinobi Siege.
 * The game keeps drawing every frame with Canvas 2D; this module takes that frame as a
 * texture and re-presents it through the GPU on a WebGL canvas laid over it:
 *   - bloom: bright, hot pixels (jutsu cores, fire, lightning) bleed light the way anime
 *     compositing glows them (bright-pass + dual-Kawase blur pyramid),
 *   - shockwaves: rings that refract the frame outward from big impacts,
 *   - chromatic aberration on heavy hits, and a light anime grade (contrast, saturation, vignette).
 * If WebGL2 is unavailable the overlay is never created and the 2D canvas shows as before. */
(() => {
  'use strict';

  const MAX_SHOCKS = 8, LEVELS = 5;
  const VS = `#version 300 es
in vec2 p; out vec2 uv;
void main(){ uv = p * .5 + .5; gl_Position = vec4(p, 0., 1.); }`;

  // Bright pass at half resolution. Brightness is the max channel so saturated fire and
  // chakra count as "hot"; a soft knee keeps the cut-off from banding. Pale terrain sits
  // under the threshold, near-clipped VFX cores sit above it.
  const FS_BRIGHT = `#version 300 es
precision mediump float;
in vec2 uv; out vec4 o;
uniform sampler2D t; uniform vec2 px; uniform float thr, knee;
vec3 hot(vec3 c){
  float m = max(c.r, max(c.g, c.b)), lo = min(c.r, min(c.g, c.b));
  float sat = m > 0. ? (m - lo) / m : 0.;
  // saturated light (fire, chakra) blooms earlier; pale walls stay just under the curve,
  // clipped VFX cores get the full colour
  float th = thr - sat * knee;
  float w = clamp((m - th) / max(1. - th, 1e-3), 0., 1.);
  return c * w * w * w;
}
void main(){
  vec3 c = hot(texture(t, uv + vec2(-px.x, -px.y)).rgb) + hot(texture(t, uv + vec2(px.x, -px.y)).rgb)
         + hot(texture(t, uv + vec2(-px.x, px.y)).rgb) + hot(texture(t, uv + vec2(px.x, px.y)).rgb);
  o = vec4(c * .25, 1.);
}`;

  const FS_DOWN = `#version 300 es
precision mediump float;
in vec2 uv; out vec4 o;
uniform sampler2D t; uniform vec2 px;
void main(){
  vec3 c = texture(t, uv).rgb * 4.;
  c += texture(t, uv - px).rgb + texture(t, uv + px).rgb;
  c += texture(t, uv + vec2(px.x, -px.y)).rgb + texture(t, uv - vec2(px.x, -px.y)).rgb;
  o = vec4(c / 8., 1.);
}`;

  const FS_UP = `#version 300 es
precision mediump float;
in vec2 uv; out vec4 o;
uniform sampler2D t, cur; uniform vec2 px;
void main(){
  vec3 c = texture(t, uv + vec2(-px.x * 2., 0.)).rgb + texture(t, uv + vec2(px.x * 2., 0.)).rgb
         + texture(t, uv + vec2(0., -px.y * 2.)).rgb + texture(t, uv + vec2(0., px.y * 2.)).rgb;
  c += (texture(t, uv + vec2(-px.x, px.y)).rgb + texture(t, uv + vec2(px.x, px.y)).rgb
      + texture(t, uv + vec2(-px.x, -px.y)).rgb + texture(t, uv + vec2(px.x, -px.y)).rgb) * 2.;
  // each level adds its own detail on the way up: a tight core glow plus a wide haze
  o = vec4(c / 12. + texture(cur, uv).rgb, 1.);
}`;

  // Final composite: shockwave refraction, chromatic aberration, bloom, grade, vignette.
  const FS_COMP = `#version 300 es
precision highp float;
in vec2 uv; out vec4 o;
uniform sampler2D scene, bloom;
uniform vec2 res;                  // CSS pixel size of the view
uniform vec4 shock[${MAX_SHOCKS}];  // x, y (CSS px, y up), ring radius, strength
uniform float shockW[${MAX_SHOCKS}];
uniform float bloomK, ca, sat, con, vig, flash;
uniform vec3 flashC;
void main(){
  vec2 p = uv * res, off = vec2(0.);
  float glint = 0.;
  for (int i = 0; i < ${MAX_SHOCKS}; i++) {
    vec4 s = shock[i];
    if (s.w <= 0.) continue;
    vec2 d = p - s.xy; float r = length(d) + 1e-3;
    float x = (r - s.z) / shockW[i];
    float ring = exp(-x * x);
    // push pixels outward ahead of the ring and inward behind it: a lens-like ripple
    off += d / r * ring * x * -s.w;
    glint += ring * s.w * .012;
  }
  vec2 suv = uv + off / res;
  vec2 dir = (suv - .5);
  float k = ca * (.35 + dot(dir, dir) * 2.4);
  vec3 c;
  c.r = texture(scene, suv + dir * k).r;
  c.g = texture(scene, suv).g;
  c.b = texture(scene, suv - dir * k).b;
  vec3 b = texture(bloom, suv).rgb;
  c += b * bloomK + glint;
  // anime grade: a touch more contrast and colour, shadows kept cool
  float l = dot(c, vec3(.299, .587, .114));
  c = mix(vec3(l), c, sat);
  c = (c - .5) * con + .5;
  c += vec3(-.006, -.002, .012) * (1. - smoothstep(.0, .35, l));
  float v = smoothstep(.95, .25, length((uv - .5) * vec2(res.x / res.y, 1.) * .9));
  c *= mix(1. - vig, 1., v);
  c = mix(c, flashC, flash);
  o = vec4(clamp(c, 0., 1.), 1.);
}`;

  let gl = null, glc = null, src = null, enabled = true, available = false;
  let progs = null, quad = null, sceneTex = null, levels = [], last = 0;
  const shocks = [];
  let caAmt = 0, caLife = 0, caMax = 1, flashAmt = 0, flashLife = 0, flashMax = 1, flashColor = [1, 1, 1];

  function compile(type, code) {
    const s = gl.createShader(type);
    gl.shaderSource(s, code); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  function program(fs) {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, VS)); gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(p, 0, 'p'); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i), name = info.name.replace(/\[0\]$/, ''); u[name] = gl.getUniformLocation(p, info.name); }
    return { p, u };
  }
  function texture(w, h) {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (w) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    return t;
  }
  function target(w, h) {
    const tex = texture(w, h), fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    return { tex, fb, w, h };
  }

  function init(source) {
    src = source;
    try {
      const saved = localStorage.getItem('shinobi.postfx');
      if (saved === 'off') enabled = false;
    } catch (e) { /* storage blocked */ }
    glc = document.createElement('canvas');
    glc.id = 'gameFx';
    glc.setAttribute('aria-hidden', 'true');
    gl = glc.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
    if (!gl) { glc = null; return false; }
    try {
      progs = { bright: program(FS_BRIGHT), down: program(FS_DOWN), up: program(FS_UP), comp: program(FS_COMP) };
    } catch (err) { console.warn('PostFX disabled:', err); gl = null; glc = null; return false; }
    quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    sceneTex = texture();
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    glc.addEventListener('webglcontextlost', e => { e.preventDefault(); available = false; });
    glc.addEventListener('webglcontextrestored', () => { init(src); resize(); });
    src.insertAdjacentElement('afterend', glc);
    available = true;
    resize();
    apply();
    return true;
  }

  function resize() {
    if (!gl || !src) return;
    glc.width = src.width; glc.height = src.height;
    glc.style.width = src.style.width; glc.style.height = src.style.height;
    for (const l of levels) { gl.deleteTexture(l.tex); gl.deleteFramebuffer(l.fb); }
    levels = [];
    let w = Math.max(1, src.width >> 1), h = Math.max(1, src.height >> 1);
    for (let i = 0; i < LEVELS; i++) { levels.push(target(w, h)); w = Math.max(1, w >> 1); h = Math.max(1, h >> 1); }
    // up-sample chain writes back into separate targets of the same sizes
    for (let i = 0; i < LEVELS - 1; i++) levels.push(target(levels[i].w, levels[i].h));
  }

  function apply() {
    if (!glc) return;
    const on = enabled && available;
    glc.style.display = on ? 'block' : 'none';
    src.style.opacity = on ? '0' : '';
  }

  function pass(prog, fb, w, h, tex, setup) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.viewport(0, 0, w, h);
    gl.useProgram(prog.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex);
    if (prog.u.t) gl.uniform1i(prog.u.t, 0);
    if (setup) setup(prog.u);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  // Screen-space (CSS px, y down) ring that refracts the frame as it expands.
  // radius: final ring radius; strength: px of displacement; life: seconds.
  function shock(x, y, radius = 220, strength = 14, life = .55) {
    if (!enabled || !available) return;
    if (shocks.length >= MAX_SHOCKS) shocks.shift();
    shocks.push({ x, y, radius, strength, life, max: life });
  }
  function aberrate(amount = .006, life = .35) {
    if (amount >= caAmt * (caLife / caMax || 0)) { caAmt = amount; caLife = caMax = life; }
  }
  function flash(rgb = [1, 1, 1], amount = .5, life = .2) {
    flashColor = rgb; flashAmt = amount; flashLife = flashMax = life;
  }

  const shockData = new Float32Array(MAX_SHOCKS * 4), shockWidth = new Float32Array(MAX_SHOCKS);
  function render(opts = {}) {
    if (!enabled || !available || !gl) return;
    const now = performance.now(), dt = Math.min(.05, (now - last) / 1000 || 0); last = now;
    const cssW = parseFloat(src.style.width) || src.width, cssH = parseFloat(src.style.height) || src.height;

    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, sceneTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);

    // bloom pyramid: bright pass → down ×(LEVELS-1) → up back to half res
    const L = levels;
    pass(progs.bright, L[0].fb, L[0].w, L[0].h, sceneTex, u => {
      gl.uniform2f(u.px, .5 / L[0].w, .5 / L[0].h);
      gl.uniform1f(u.thr, opts.threshold || .9); gl.uniform1f(u.knee, .14);
    });
    for (let i = 1; i < LEVELS; i++) pass(progs.down, L[i].fb, L[i].w, L[i].h, L[i - 1].tex, u => gl.uniform2f(u.px, .5 / L[i - 1].w, .5 / L[i - 1].h));
    let from = L[LEVELS - 1];
    for (let i = LEVELS - 2; i >= 0; i--) {
      const to = L[LEVELS + i];
      pass(progs.up, to.fb, to.w, to.h, from.tex, u => {
        gl.uniform2f(u.px, .5 / from.w, .5 / from.h);
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, L[i].tex); gl.uniform1i(u.cur, 1);
        gl.activeTexture(gl.TEXTURE0);
      });
      from = to;
    }

    // shockwaves age; the ring eases out and its push fades
    shockData.fill(0);
    for (let i = shocks.length - 1; i >= 0; i--) { shocks[i].life -= dt; if (shocks[i].life <= 0) shocks.splice(i, 1); }
    shocks.forEach((s, i) => {
      const t = 1 - s.life / s.max, e = 1 - Math.pow(1 - t, 3);
      shockData[i * 4] = s.x; shockData[i * 4 + 1] = cssH - s.y;
      shockData[i * 4 + 2] = s.radius * (.08 + e * .92);
      shockData[i * 4 + 3] = s.strength * (1 - t) * (1 - t);
      shockWidth[i] = 18 + s.radius * .12 * (1 - t * .5);
    });
    if (caLife > 0) caLife -= dt;
    if (flashLife > 0) flashLife -= dt;
    const caNow = caLife > 0 ? caAmt * (caLife / caMax) : 0;
    const flashNow = flashLife > 0 ? flashAmt * (flashLife / flashMax) : 0;

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, glc.width, glc.height);
    const c = progs.comp;
    gl.useProgram(c.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, sceneTex); gl.uniform1i(c.u.scene, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, from.tex); gl.uniform1i(c.u.bloom, 1);
    gl.uniform2f(c.u.res, cssW, cssH);
    gl.uniform4fv(c.u.shock, shockData); gl.uniform1fv(c.u.shockW, shockWidth);
    gl.uniform1f(c.u.bloomK, (opts.bloom === undefined ? 1 : opts.bloom) * .32);
    gl.uniform1f(c.u.ca, (opts.aberration || 0) + caNow);
    gl.uniform1f(c.u.sat, opts.saturation || 1.08);
    gl.uniform1f(c.u.con, opts.contrast || 1.04);
    gl.uniform1f(c.u.vig, opts.vignette === undefined ? .16 : opts.vignette);
    gl.uniform1f(c.u.flash, flashNow);
    gl.uniform3f(c.u.flashC, flashColor[0], flashColor[1], flashColor[2]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.activeTexture(gl.TEXTURE0);
  }

  function setEnabled(on) {
    enabled = !!on;
    try { localStorage.setItem('shinobi.postfx', enabled ? 'on' : 'off'); } catch (e) { /* storage blocked */ }
    if (!enabled) shocks.length = 0;
    apply();
  }

  window.PostFX = {
    init, resize, render, shock, aberrate, flash, setEnabled,
    get enabled() { return enabled && available; },
    get available() { return available; }
  };
})();
