// Pascal Madfouni portfolio
// - Language toggle (Arabic RTL / English LTR)
// - Desktop: full-screen panels that slide one at a time (wheel, touch, keys, nav)
// - WebGL background: cross-fade between panel images with motion blur in the
//   scroll direction, slow drifting zoom, animated light leaks and vignette
// - Mobile: native scrolling, same WebGL background driven by scroll position
(function () {
  var root = document.documentElement;
  var exp = document.getElementById("experience");
  var track = document.getElementById("panels");
  var stage = document.getElementById("webgl-stage");
  var label = document.getElementById("current-label");
  var bar = document.getElementById("progress-bar");
  var btn = document.getElementById("langBtn");
  var panels = Array.prototype.slice.call(document.querySelectorAll(".panel"));
  var navLinks = Array.prototype.slice.call(document.querySelectorAll(".rail-nav a"));
  var reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var mobileMQ = matchMedia("(max-width: 900px)");
  var N = panels.length;

  // ---------- language ----------
  var active = 0;
  function setLabel() {
    var p = panels[active];
    if (p && label) label.textContent = p.getAttribute("data-" + root.lang) || "";
  }
  function applyLang(lang) {
    root.lang = lang;
    root.dir = lang === "ar" ? "rtl" : "ltr";
    try { localStorage.setItem("lang", lang); } catch (e) {}
    var url = new URL(window.location);
    url.searchParams.set("lang", lang);
    history.replaceState(null, "", url.pathname + url.search + url.hash);
    setLabel();
  }
  var q = new URLSearchParams(location.search).get("lang");
  var saved = null;
  try { saved = localStorage.getItem("lang"); } catch (e) {}
  applyLang(q === "en" || q === "ar" ? q : (saved || "ar"));
  btn.addEventListener("click", function () { applyLang(root.lang === "ar" ? "en" : "ar"); });
  var yr = document.getElementById("yr");
  if (yr) yr.textContent = new Date().getFullYear();

  // ---------- shared state ----------
  var pos = 0;          // continuous position in panel units (0 .. N-1)
  var target = 0;       // panel index we are heading to
  var dir = 1;          // last movement direction
  var velocity = 0;     // drives the motion blur (0..1)
  var blur = 0;         // smoothed blur

  function setActive(i) {
    i = Math.max(0, Math.min(N - 1, i));
    if (i === active && panels[i].classList.contains("is-active")) return;
    active = i;
    panels.forEach(function (p, k) { p.classList.toggle("is-active", k === i); });
    var id = panels[i].id;
    var group = /^work/.test(id) ? "work01" : id;
    navLinks.forEach(function (a) { a.classList.toggle("on", a.getAttribute("href") === "#" + group); });
    setLabel();
  }

  function isMobile() { return mobileMQ.matches; }

  // ---------- slider (same on desktop and mobile, timings copied from the reference) ----------
  var tween = null;
  function ease(t) { return t < .5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2; } // power4.inOut
  function render() {
    var h = exp.clientHeight;
    track.style.transform = "translate3d(0," + (-pos * h) + "px,0)";
    if (bar) bar.style.transform = "scaleX(" + (N > 1 ? pos / (N - 1) : 0) + ")";
  }
  function goTo(i, strength) {
    i = Math.max(0, Math.min(N - 1, i));
    if (tween || i === target) return false;
    dir = i > target ? 1 : -1;
    // the incoming panel starts at its top (or bottom when going back up)
    var p = panels[i]; p.scrollTop = 0;
    [].forEach.call(p.querySelectorAll(".scroller,.panel-copy"), function (s) { s.scrollTop = dir > 0 ? 0 : s.scrollHeight; });
    target = i;
    velocity = Math.max(velocity, Math.min(.58, .16 + (strength || 0) / 3200));
    var from = pos, start = performance.now(), dur = reduced ? 1 : 820;
    tween = function (now) {
      var t = Math.max(0, Math.min(1, (now - start) / dur));
      var prev = pos;
      pos = from + (i - from) * ease(t);
      velocity = Math.max(velocity, Math.min(.72, Math.abs(pos - prev) * exp.clientHeight / 72));
      setActive(Math.round(pos));
      render();
      if (t >= 1) { tween = null; tweenEnd = performance.now(); pos = i; setActive(i); render(); }
    };
    return true;
  }

  // a scrollable block inside the panel scrolls first, then the page flicks
  function inStrip(el) { return !!(el && el.closest && el.closest(".strip")); }

  function innerScroller(el, dy) {
    while (el && el !== exp) {
      var sc = isMobile() && el.classList && (el.classList.contains("scroller") || el.classList.contains("panel-copy"));
      if (sc) {
        var max = el.scrollHeight - el.clientHeight;
        if (max > 2 && ((dy > 0 && el.scrollTop < max - 1) || (dy < 0 && el.scrollTop > 1))) return el;
      }
      el = el.parentNode;
    }
    return null;
  }

  // wheel: one gesture = one panel. A trackpad keeps firing (inertia) for a
  // while, so a new flick needs a short pause in the stream and the previous
  // transition to be finished.
  var lastWheel = -Infinity, tweenEnd = -Infinity, hist = [], wheelAxis = null, sumX = 0, sumY = 0;
  window.addEventListener("wheel", function (e) {
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    var now = performance.now(), gap = now - lastWheel, ad = Math.abs(e.deltaY);
    if (gap > 200) { hist = []; wheelAxis = null; sumX = 0; sumY = 0; }
    if (!wheelAxis) {                             // decide the gesture axis from its first frames
      sumX += Math.abs(e.deltaX); sumY += ad;
      if (e.deltaMode !== 0 || ad >= 96 || sumX + sumY > 12) wheelAxis = sumX > sumY * .7 ? "x" : "y";
      else { lastWheel = now; if (e.cancelable && !inStrip(e.target)) e.preventDefault(); return; }
    }
    if (wheelAxis === "x") {                      // sideways gesture: gallery only, no page flip
      lastWheel = now;
      if (!inStrip(e.target) && e.cancelable) e.preventDefault();
      return;
    }
    if (innerScroller(e.target, e.deltaY)) return;
    if (e.cancelable) e.preventDefault();
    lastWheel = now;
    if (!e.deltaY) return;
    var prev = hist.slice(-4), avg = 0;
    prev.forEach(function (v) { avg += v / prev.length; });
    hist.push(ad); if (hist.length > 12) hist.shift();
    if (tween || now - tweenEnd < 90) return;
    var notch = e.deltaMode !== 0 || (gap > 40 && ad >= 96 && (ad % 100 === 0 || ad % 120 === 0));
    var fresh = !prev.length || (ad > avg * 1.6 && ad > 10);
    if (notch || fresh) goTo(target + (e.deltaY > 0 ? 1 : -1), e.deltaY);
  }, { passive: false, capture: true });

  // touch: a 34px swipe flicks a full page
  var touchY = null, touchX = 0, touchUsed = false, touchEl = null, touchAxis = null;
  exp.addEventListener("touchstart", function (e) {
    touchY = e.touches[0].clientY; touchX = e.touches[0].clientX;
    touchUsed = false; touchEl = e.target; touchAxis = null;
  }, { passive: true });
  exp.addEventListener("touchmove", function (e) {
    if (touchY === null || touchUsed) return;
    var dy = touchY - e.touches[0].clientY, dx = touchX - e.touches[0].clientX;
    if (!touchAxis && (Math.abs(dx) > 8 || Math.abs(dy) > 8))
      touchAxis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
    if (touchAxis === "x" && inStrip(touchEl)) return;  // gallery: native sideways scroll
    if (touchAxis === "x") { if (e.cancelable) e.preventDefault(); return; }
    if (innerScroller(touchEl, dy)) return;          // native scroll inside the panel
    if (e.cancelable) e.preventDefault();
    if (Math.abs(dy) >= 34) { touchUsed = true; goTo(target + (dy > 0 ? 1 : -1)); }
  }, { passive: false });
  exp.addEventListener("touchend", function () { touchY = null; });
  exp.addEventListener("touchcancel", function () { touchY = null; });

  window.addEventListener("keydown", function (e) {
    var k = e.key;
    if (k === "ArrowDown" || k === "PageDown" || k === " ") { e.preventDefault(); goTo(target + 1); }
    else if (k === "ArrowUp" || k === "PageUp") { e.preventDefault(); goTo(target - 1); }
    else if (k === "Home") { e.preventDefault(); goTo(0); }
    else if (k === "End") { e.preventDefault(); goTo(N - 1); }
  });

  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a) return;
    var el = document.getElementById(a.getAttribute("href").slice(1));
    var i = panels.indexOf(el);
    if (i < 0) return;
    e.preventDefault();
    goTo(i);
  });

  window.addEventListener("resize", function () { tween = null; pos = target; render(); });

  [].forEach.call(document.querySelectorAll(".strip"), function (s) {
    var wrap = document.createElement("div"); wrap.className = "strip-wrap";
    s.parentNode.insertBefore(wrap, s); wrap.appendChild(s);
    [["prev", -1, "\u2039"], ["next", 1, "\u203A"]].forEach(function (b) {
      var btn = document.createElement("button");
      btn.type = "button"; btn.className = "strip-btn " + b[0]; btn.textContent = b[2];
      btn.setAttribute("aria-label", b[0]);
      btn.addEventListener("click", function () {
        var rtl = getComputedStyle(s).direction === "rtl";
        s.scrollBy({ left: b[1] * (rtl ? -1 : 1) * s.clientWidth * .8, behavior: "smooth" });
      });
      wrap.appendChild(btn);
    });
  });

  var startEl = location.hash ? document.getElementById(location.hash.slice(1)) : null;
  var startI = Math.max(0, panels.indexOf(startEl));
  pos = target = startI; setActive(startI); render();

  // laptop: every page fits the screen, nothing scrolls inside it
  function fitPanels() {
    panels.forEach(function (p) {
      var c = p.querySelector(".panel-copy");
      if (!c) return;
      c.style.zoom = "";
      if (isMobile()) return;
      var cs = getComputedStyle(p);
      var avail = p.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      var need = c.scrollHeight;
      if (need > avail + 1) c.style.zoom = Math.max(.6, (avail - 6) / need).toFixed(3);
    });
  }
  var fitT = null;
  function fitSoon() { clearTimeout(fitT); fitT = setTimeout(fitPanels, 80); }
  window.addEventListener("resize", fitSoon);
  window.addEventListener("load", fitPanels);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitPanels);
  [].forEach.call(document.querySelectorAll(".panel img"), function (im) { if (!im.complete) im.addEventListener("load", fitSoon); });
  document.addEventListener("click", function (e) { if (e.target.closest && e.target.closest(".language-toggle,[data-lang-toggle],#lang")) setTimeout(fitPanels, 30); });
  fitPanels();
  root.classList.add("js-ready");

  // ---------- WebGL background ----------
  var canvas = document.createElement("canvas");
  stage.appendChild(canvas);
  var gl = canvas.getContext("webgl", { antialias: false, premultipliedAlpha: false, alpha: false });

  var loop;
  function frame(now) {
    if (tween) tween(now);
    velocity *= .88;
    blur += (velocity - blur) * (velocity > blur ? .34 : .14);
    if (loop) loop(now);
    requestAnimationFrame(frame);
  }

  if (!gl) { requestAnimationFrame(frame); return; }

  var VS = "attribute vec2 p;varying vec2 vUv;void main(){vUv=p*.5+.5;gl_Position=vec4(p,0.,1.);}";
  var FS = [
    "precision highp float;",
    "uniform sampler2D tFrom,tTo;",
    "uniform vec2 uRes,uFromSize,uToSize,uFromFocus,uToFocus;",
    "uniform float uProgress,uBlur,uDir,uTime;",
    "varying vec2 vUv;",
    "vec2 cover(vec2 uv,vec2 s,vec2 f,float z){",
    "  float vr=uRes.x/max(uRes.y,1.),ir=s.x/max(s.y,1.);",
    "  vec2 r=vec2(min(vr/ir,1.),min(ir/vr,1.));",
    "  uv=(uv-.5)/z+.5;",
    "  return uv*r+(1.-r)*f;}",
    "vec4 dirBlur(sampler2D t,vec2 uv,vec2 s,vec2 f,float z){",
    "  float px=mix(0.,26.,smoothstep(0.,1.,uBlur));",
    "  vec2 st=vec2(0.,uDir*px/max(uRes.y,1.));",
    "  vec4 c=vec4(0.);",
    "  c+=texture2D(t,clamp(cover(uv-st,s,f,z),.001,.999))*.06;",
    "  c+=texture2D(t,clamp(cover(uv-st*.66,s,f,z),.001,.999))*.12;",
    "  c+=texture2D(t,clamp(cover(uv-st*.33,s,f,z),.001,.999))*.2;",
    "  c+=texture2D(t,clamp(cover(uv,s,f,z),.001,.999))*.24;",
    "  c+=texture2D(t,clamp(cover(uv+st*.33,s,f,z),.001,.999))*.2;",
    "  c+=texture2D(t,clamp(cover(uv+st*.66,s,f,z),.001,.999))*.12;",
    "  c+=texture2D(t,clamp(cover(uv+st,s,f,z),.001,.999))*.06;",
    "  return c;}",
    "float blob(vec2 uv,vec2 c,float r){return smoothstep(r,0.,distance(uv,c));}",
    "void main(){",
    "  float e=uProgress*uProgress*(3.-2.*uProgress);",
    // slow breathing zoom + drift, outgoing image pushes away, incoming settles in
    "  float br=.035*sin(uTime*.18);",
    "  vec2 drift=vec2(sin(uTime*.07),cos(uTime*.05))*.012;",
    "  vec2 uvF=vUv+drift+vec2(0.,uDir*e*.06);",
    "  vec2 uvT=vUv+drift-vec2(0.,uDir*(1.-e)*.06);",
    "  vec4 a=dirBlur(tFrom,uvF,uFromSize,uFromFocus,1.06+br+e*.05);",
    "  vec4 b=dirBlur(tTo,uvT,uToSize,uToFocus,1.11+br-e*.05);",
    "  vec3 col=mix(a.rgb,b.rgb,e);",
    // grade: indigo shadows, warm coral highlights
    "  float l=dot(col,vec3(.2126,.7152,.0722));",
    "  col=mix(vec3(l),col,.78);",
    "  col=(col-.5)*1.06+.5;",
    "  col=mix(col*vec3(.78,.84,1.12),col*vec3(1.08,.97,.9),smoothstep(.15,.85,l));",
    // animated light leaks
    "  vec2 q=vUv*vec2(uRes.x/uRes.y,1.);",
    "  float ar=uRes.x/uRes.y;",
    "  vec2 c1=vec2(ar*(.15+.12*sin(uTime*.11)),.85+.1*cos(uTime*.09));",
    "  vec2 c2=vec2(ar*(.9+.1*cos(uTime*.08)),.15+.12*sin(uTime*.13));",
    "  vec2 c3=vec2(ar*(.55+.3*sin(uTime*.05)),.5+.3*cos(uTime*.07));",
    "  col+=vec3(1.,.42,.28)*blob(q,c1,.9)*.16;",
    "  col+=vec3(.3,.36,1.)*blob(q,c2,1.)*.18;",
    "  col+=vec3(.95,.55,.75)*blob(q,c3,.7)*.06*(.5+.5*sin(uTime*.3));",
    // a soft light sweep during transitions
    "  float sweep=smoothstep(.0,.5,uProgress)*smoothstep(1.,.5,uProgress);",
    "  col+=vec3(1.,.55,.4)*sweep*.12*smoothstep(.6,0.,abs(vUv.y-(uDir>0.?1.-uProgress:uProgress)));",
    "  float v=smoothstep(.95,.2,distance(vUv,vec2(.52,.48)));",
    "  col*=mix(.62,1.03,v);",
    "  gl_FragColor=vec4(col,1.);}"
  ].join("\n");

  function sh(type, src) {
    var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  var prog;
  try {
    prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  } catch (err) { console.warn(err); requestAnimationFrame(frame); return; }
  gl.useProgram(prog);
  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  var loc = gl.getAttribLocation(prog, "p");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  var U = {};
  ["tFrom", "tTo", "uRes", "uFromSize", "uToSize", "uFromFocus", "uToFocus", "uProgress", "uBlur", "uDir", "uTime"]
    .forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });
  gl.uniform1i(U.tFrom, 0); gl.uniform1i(U.tTo, 1);

  var focus = panels.map(function (p) {
    var v = (p.getAttribute("data-position") || "50% 50%").split(" ");
    return [parseFloat(v[0]) / 100, 1 - parseFloat(v[1]) / 100];
  });
  var tex = new Array(N), size = new Array(N);
  function load(i) {
    return new Promise(function (res) {
      var img = new Image();
      img.onload = function () {
        var t = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        tex[i] = t; size[i] = [img.naturalWidth, img.naturalHeight]; res(true);
      };
      img.onerror = function () { res(false); };
      img.src = panels[i].getAttribute("data-image");
    });
  }

  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    var w = Math.max(1, stage.clientWidth), h = Math.max(1, stage.clientHeight);
    canvas.width = w * dpr; canvas.height = h * dpr;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(U.uRes, w, h);
  }
  window.addEventListener("resize", resize);

  // load the first panels quickly, the rest in the background
  var order = [startI].concat(panels.map(function (_, i) { return i; }).filter(function (i) { return i !== startI; }));
  load(order[0]).then(function (ok) {
    if (!ok) { requestAnimationFrame(frame); return; }
    resize();
    root.classList.add("webgl-ready");
    order.slice(1).reduce(function (p, i) { return p.then(function () { return load(i); }); }, Promise.resolve());
    var t0 = performance.now();
    loop = function (now) {
      var a = Math.max(0, Math.min(N - 1, Math.floor(pos))), b = Math.min(N - 1, a + 1);
      var ta = tex[a] || tex[startI], tb = tex[b] || ta;
      var sa = size[a] || size[startI], sb = size[b] || sa;
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, ta);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tb);
      gl.uniform2f(U.uFromSize, sa[0], sa[1]); gl.uniform2f(U.uToSize, sb[0], sb[1]);
      gl.uniform2f(U.uFromFocus, focus[a][0], focus[a][1]); gl.uniform2f(U.uToFocus, focus[b][0], focus[b][1]);
      gl.uniform1f(U.uProgress, a === b ? 0 : pos - a);
      gl.uniform1f(U.uBlur, reduced ? 0 : Math.min(1, blur));
      gl.uniform1f(U.uDir, dir);
      gl.uniform1f(U.uTime, reduced ? 0 : (now - t0) / 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    canvas.addEventListener("webglcontextlost", function (e) { e.preventDefault(); root.classList.remove("webgl-ready"); loop = null; });
  });
  requestAnimationFrame(frame);
})();

// Floating dust, like light catching dust in a projector beam
(function () {
  var cv = document.getElementById("dust");
  if (!cv || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  var ctx = cv.getContext("2d"), W, H, P = [], dpr = Math.min(window.devicePixelRatio || 1, 2);
  function size() {
    W = cv.width = innerWidth * dpr; H = cv.height = innerHeight * dpr;
    var n = Math.round(innerWidth * innerHeight / 18000);
    P = [];
    for (var i = 0; i < n; i++) P.push({ x: Math.random() * W, y: Math.random() * H, r: (Math.random() * 1.4 + .3) * dpr,
      vx: (Math.random() - .5) * .12 * dpr, vy: -(Math.random() * .22 + .04) * dpr, a: Math.random() * .45 + .1, t: Math.random() * 6.28,
      warm: Math.random() < .5 });
  }
  function tick() {
    ctx.clearRect(0, 0, W, H);
    for (var i = 0; i < P.length; i++) {
      var p = P[i]; p.x += p.vx; p.y += p.vy; p.t += .02;
      if (p.y < -10) { p.y = H + 10; p.x = Math.random() * W; }
      if (p.x < -10) p.x = W + 10; if (p.x > W + 10) p.x = -10;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.28);
      var a = p.a * (.6 + .4 * Math.sin(p.t));
      ctx.fillStyle = p.warm ? "rgba(255,170,140," + a + ")" : "rgba(190,200,255," + a + ")"; ctx.fill();
    }
    requestAnimationFrame(tick);
  }
  addEventListener("resize", size); size(); tick();
})();
