// Interactive HD → UHD colour gamut expansion (α, β).
// Same algorithm as python/gamut_expansion.py in github.com/cyberdrk/Color.
(function () {
  "use strict";

  var root = document.getElementById("gamut-demo");
  if (!root) return;

  // --- Colorimetry ---------------------------------------------------------
  var WP = [0.3127, 0.329]; // D65
  var HD = [
    [0.64, 0.33],
    [0.3, 0.6],
    [0.15, 0.06],
  ];
  var UHD = [
    [0.708, 0.292],
    [0.17, 0.797],
    [0.131, 0.046],
  ];
  var SRGB_TO_XYZ = [
    [0.4124564, 0.3575761, 0.1804375],
    [0.2126729, 0.7151522, 0.072175],
    [0.0193339, 0.119192, 0.9503041],
  ];
  var XYZ_TO_SRGB = [
    [3.2404548, -1.5371389, -0.4985315],
    [-0.9692664, 1.8760109, 0.0415561],
    [0.0556434, -0.2040259, 1.0572252],
  ];
  var XYZ_TO_P3 = [
    [2.4934969, -0.9313836, -0.4027108],
    [-0.829489, 1.7626641, 0.0236247],
    [0.0358458, -0.0761724, 0.9568845],
  ];
  // CIE 1931 2° spectral locus, 380–700 nm in 5 nm steps
  var LOCUS = [
    [0.1741, 0.005],
    [0.174, 0.005],
    [0.1738, 0.0049],
    [0.1736, 0.0049],
    [0.1733, 0.0048],
    [0.173, 0.0048],
    [0.1726, 0.0048],
    [0.1721, 0.0048],
    [0.1714, 0.0051],
    [0.1703, 0.0058],
    [0.1689, 0.0069],
    [0.1669, 0.0086],
    [0.1644, 0.0109],
    [0.1611, 0.0138],
    [0.1566, 0.0177],
    [0.151, 0.0227],
    [0.144, 0.0297],
    [0.1355, 0.0399],
    [0.1241, 0.0578],
    [0.1096, 0.0868],
    [0.0913, 0.1327],
    [0.0687, 0.2007],
    [0.0454, 0.295],
    [0.0235, 0.4127],
    [0.0082, 0.5384],
    [0.0039, 0.6548],
    [0.0139, 0.7502],
    [0.0389, 0.812],
    [0.0743, 0.8338],
    [0.1142, 0.8262],
    [0.1547, 0.8059],
    [0.1929, 0.7816],
    [0.2296, 0.7543],
    [0.2658, 0.7243],
    [0.3016, 0.6923],
    [0.3373, 0.6589],
    [0.3731, 0.6245],
    [0.4087, 0.5896],
    [0.4441, 0.5547],
    [0.4788, 0.5202],
    [0.5125, 0.4866],
    [0.5448, 0.4544],
    [0.5752, 0.4242],
    [0.6029, 0.3965],
    [0.627, 0.3725],
    [0.6482, 0.3514],
    [0.6658, 0.334],
    [0.6801, 0.3197],
    [0.6915, 0.3083],
    [0.7006, 0.2993],
    [0.7079, 0.292],
    [0.714, 0.2859],
    [0.719, 0.2809],
    [0.723, 0.277],
    [0.726, 0.274],
    [0.7283, 0.2717],
    [0.73, 0.27],
    [0.7311, 0.2689],
    [0.732, 0.268],
    [0.7327, 0.2673],
    [0.7334, 0.2666],
    [0.734, 0.266],
    [0.7344, 0.2656],
    [0.7346, 0.2654],
    [0.7347, 0.2653],
  ];

  var MAX_SIDE = 800; // test images run at full size; larger uploads are scaled down
  var GRID = 0.01; // chromaticity cell size for "UHD gamut in use"
  var GRID_N = 100;
  var MIN_Y = 0.01; // ignore near-black pixels, whose chromaticity is noise
  var DIAGRAM_POINTS = 2500;
  var SWEEP_POINTS = 15000;
  var SWEEP_ALPHAS = [];
  for (var a = 0; a <= 0.9001; a += 0.05) SWEEP_ALPHAS.push(Math.round(a * 100) / 100);

  // --- Helpers ---------------------------------------------------------------
  function decode(c) {
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }
  var DECODE = new Float32Array(256);
  for (var i = 0; i < 256; i++) DECODE[i] = decode(i / 255);

  var ENC_N = 4096;
  var ENCODE = new Uint8ClampedArray(ENC_N + 1);
  for (var k = 0; k <= ENC_N; k++) {
    var v = k / ENC_N;
    ENCODE[k] = Math.round((v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055) * 255);
  }
  function enc(v) {
    if (!(v > 0)) return 0;
    if (v >= 1) return 255;
    return ENCODE[(v * ENC_N) | 0];
  }

  // Distance from the white point to a triangle's border along a unit direction.
  function exitDistance(ux, uy, tri) {
    var best = Infinity;
    for (var e = 0; e < 3; e++) {
      var ax = tri[e][0],
        ay = tri[e][1];
      var ex = tri[(e + 1) % 3][0] - ax,
        ey = tri[(e + 1) % 3][1] - ay;
      var denom = ux * ey - uy * ex;
      if (Math.abs(denom) < 1e-12) continue;
      var awx = ax - WP[0],
        awy = ay - WP[1];
      var t = (awx * ey - awy * ex) / denom;
      var s = (awx * uy - awy * ux) / denom;
      if (t > 0 && s >= -1e-9 && s <= 1 + 1e-9 && t < best) best = t;
    }
    return best;
  }

  function insideTriangle(px, py, tri) {
    function side(a, b) {
      return (b[0] - a[0]) * (py - a[1]) - (b[1] - a[1]) * (px - a[0]);
    }
    var s1 = side(tri[0], tri[1]),
      s2 = side(tri[1], tri[2]),
      s3 = side(tri[2], tri[0]);
    return (s1 >= 0 && s2 >= 0 && s3 >= 0) || (s1 <= 0 && s2 <= 0 && s3 <= 0);
  }

  var UHD_CELLS = new Uint8Array(GRID_N * GRID_N);
  var UHD_CELL_COUNT = 0;
  for (var gx = 0; gx < 80; gx++) {
    for (var gy = 0; gy < 80; gy++) {
      if (insideTriangle((gx + 0.5) * GRID, (gy + 0.5) * GRID, UHD)) {
        UHD_CELLS[gx * GRID_N + gy] = 1;
        UHD_CELL_COUNT++;
      }
    }
  }

  function scaledTriangle(tri, k) {
    return tri.map(function (p) {
      return [WP[0] + k * (p[0] - WP[0]), WP[1] + k * (p[1] - WP[1])];
    });
  }

  function cssVar(name, fallback) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }

  function supportsP3() {
    try {
      if (!window.matchMedia("(color-gamut: p3)").matches) return false;
      var c = document.createElement("canvas").getContext("2d", { colorSpace: "display-p3" });
      return !!(c && c.getContextAttributes && c.getContextAttributes().colorSpace === "display-p3");
    } catch (e) {
      return false;
    }
  }
  var USE_P3 = supportsP3();
  var OUT_MATRIX = USE_P3 ? XYZ_TO_P3 : XYZ_TO_SRGB;
  var CTX_OPTS = USE_P3 ? { colorSpace: "display-p3" } : undefined;

  // --- Elements --------------------------------------------------------------
  var el = {
    alpha: document.getElementById("gd-alpha"),
    beta: document.getElementById("gd-beta"),
    alphaOut: document.getElementById("gd-alpha-out"),
    betaOut: document.getElementById("gd-beta-out"),
    before: document.getElementById("gd-before"),
    after: document.getElementById("gd-after"),
    compare: document.getElementById("gd-compare"),
    split: document.getElementById("gd-split"),
    diagram: document.getElementById("gd-diagram"),
    sweep: document.getElementById("gd-sweep"),
    file: document.getElementById("gd-file"),
    note: document.getElementById("gd-render-note"),
    status: document.getElementById("gd-status"),
    expanded: document.getElementById("gd-m-expanded"),
    sat: document.getElementById("gd-m-sat"),
    usage: document.getElementById("gd-m-usage"),
  };
  var imageButtons = root.querySelectorAll("[data-gd-src]");
  var presetButtons = root.querySelectorAll("[data-gd-alpha]");

  el.note.textContent = USE_P3
    ? "Shown in Display P3: your screen can show many of the expanded colours that HD cannot."
    : "Your screen shows the HD (sRGB) range, so colours beyond it are clipped, as in the original MATLAB output.";

  // --- Image state -----------------------------------------------------------
  var S = null; // per-image precomputed data

  function prepare(img) {
    var scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height));
    var w = Math.max(1, Math.round((img.naturalWidth || img.width) * scale));
    var h = Math.max(1, Math.round((img.naturalHeight || img.height) * scale));
    var tmp = document.createElement("canvas");
    tmp.width = w;
    tmp.height = h;
    var tctx = tmp.getContext("2d", { willReadFrequently: true });
    tctx.drawImage(img, 0, 0, w, h);
    var px = tctx.getImageData(0, 0, w, h).data;

    var n = w * h;
    var st = {
      w: w,
      h: h,
      n: n,
      X: new Float32Array(n),
      Y: new Float32Array(n),
      Z: new Float32Array(n),
      ux: new Float32Array(n),
      uy: new Float32Array(n),
      xm: new Float32Array(n),
      D: new Float32Array(n),
      d: new Float32Array(n),
      chromatic: new Uint8Array(n),
      reliable: [],
    };
    var M = SRGB_TO_XYZ;
    for (var p = 0; p < n; p++) {
      var r = DECODE[px[p * 4]],
        g = DECODE[px[p * 4 + 1]],
        b = DECODE[px[p * 4 + 2]];
      var X = M[0][0] * r + M[0][1] * g + M[0][2] * b;
      var Y = M[1][0] * r + M[1][1] * g + M[1][2] * b;
      var Z = M[2][0] * r + M[2][1] * g + M[2][2] * b;
      st.X[p] = X;
      st.Y[p] = Y;
      st.Z[p] = Z;
      var sum = X + Y + Z;
      if (sum <= 1e-9) continue;
      var ox = X / sum - WP[0],
        oy = Y / sum - WP[1];
      var xm = Math.sqrt(ox * ox + oy * oy);
      if (xm <= 1e-6) continue;
      var ux = ox / xm,
        uy = oy / xm;
      st.ux[p] = ux;
      st.uy[p] = uy;
      st.xm[p] = xm;
      st.D[p] = exitDistance(ux, uy, UHD);
      st.d[p] = exitDistance(ux, uy, HD);
      st.chromatic[p] = 1;
      if (Y > MIN_Y) st.reliable.push(p);
    }
    st.diagramIdx = sample(st.reliable, DIAGRAM_POINTS);
    st.sweepIdx = sample(st.reliable, SWEEP_POINTS);

    [el.before, el.after].forEach(function (c) {
      c.width = w;
      c.height = h;
    });
    el.compare.style.aspectRatio = w + " / " + h;
    return st;
  }

  function sample(arr, k) {
    if (arr.length <= k) return arr.slice();
    var out = [];
    var step = arr.length / k;
    for (var i = 0; i < k; i++) out.push(arr[Math.floor(i * step)]);
    return out;
  }

  // Expanded distance from the white point for pixel p.
  function expandedDistance(st, p, alpha, beta) {
    var xm = st.xm[p];
    var dB = (1 - beta) * st.d[p];
    var dA = alpha * dB;
    if (xm <= dA || dB - dA <= 1e-9) return xm;
    var x = xm + ((st.D[p] - dB) * (xm - dA)) / (dB - dA);
    return x < st.D[p] ? x : st.D[p];
  }

  function paint(canvas, st, alpha, beta, expandOn) {
    var ctx = canvas.getContext("2d", CTX_OPTS);
    var data;
    try {
      data = CTX_OPTS ? ctx.createImageData(st.w, st.h, CTX_OPTS) : ctx.createImageData(st.w, st.h);
    } catch (e) {
      data = ctx.createImageData(st.w, st.h);
    }
    var out = data.data;
    var M = OUT_MATRIX;
    var moved = 0,
      sumBefore = 0,
      sumAfter = 0;
    var cells = expandOn ? new Uint8Array(GRID_N * GRID_N) : null;
    var reliableSet = st.reliableMask || buildMask(st);

    for (var p = 0; p < st.n; p++) {
      var X = st.X[p],
        Y = st.Y[p],
        Z = st.Z[p];
      if (st.chromatic[p]) {
        var xm = st.xm[p];
        var xn = expandOn ? expandedDistance(st, p, alpha, beta) : xm;
        if (xn !== xm) {
          var nx = WP[0] + st.ux[p] * xn,
            ny = WP[1] + st.uy[p] * xn;
          X = (nx * Y) / ny;
          Z = ((1 - nx - ny) * Y) / ny;
        }
        if (expandOn && reliableSet[p]) {
          sumBefore += xm;
          sumAfter += xn;
          if (xn > xm + 1e-9) moved++;
          var cx = Math.floor((WP[0] + st.ux[p] * xn) / GRID);
          var cy = Math.floor((WP[1] + st.uy[p] * xn) / GRID);
          if (cx >= 0 && cy >= 0 && cx < GRID_N && cy < GRID_N) cells[cx * GRID_N + cy] = 1;
        }
      }
      var o = p * 4;
      out[o] = enc(M[0][0] * X + M[0][1] * Y + M[0][2] * Z);
      out[o + 1] = enc(M[1][0] * X + M[1][1] * Y + M[1][2] * Z);
      out[o + 2] = enc(M[2][0] * X + M[2][1] * Y + M[2][2] * Z);
      out[o + 3] = 255;
    }
    ctx.putImageData(data, 0, 0);
    if (!expandOn) return null;

    var used = 0;
    for (var c = 0; c < cells.length; c++) if (cells[c] && UHD_CELLS[c]) used++;
    var nRel = st.reliable.length || 1;
    return {
      expanded: moved / nRel,
      saturation: sumBefore > 0 ? sumAfter / sumBefore - 1 : 0,
      usage: used / UHD_CELL_COUNT,
    };
  }

  function buildMask(st) {
    st.reliableMask = new Uint8Array(st.n);
    for (var i = 0; i < st.reliable.length; i++) st.reliableMask[st.reliable[i]] = 1;
    return st.reliableMask;
  }

  function usageOf(st, xs, ys) {
    var cells = new Uint8Array(GRID_N * GRID_N);
    for (var i = 0; i < xs.length; i++) {
      var cx = Math.floor(xs[i] / GRID),
        cy = Math.floor(ys[i] / GRID);
      if (cx >= 0 && cy >= 0 && cx < GRID_N && cy < GRID_N) cells[cx * GRID_N + cy] = 1;
    }
    var used = 0;
    for (var c = 0; c < cells.length; c++) if (cells[c] && UHD_CELLS[c]) used++;
    return used / UHD_CELL_COUNT;
  }

  function baselineUsage(st) {
    if (st.usageBefore != null) return st.usageBefore;
    var xs = new Float32Array(st.reliable.length),
      ys = new Float32Array(st.reliable.length);
    for (var i = 0; i < st.reliable.length; i++) {
      var p = st.reliable[i];
      xs[i] = WP[0] + st.ux[p] * st.xm[p];
      ys[i] = WP[1] + st.uy[p] * st.xm[p];
    }
    st.usageBefore = usageOf(st, xs, ys);
    return st.usageBefore;
  }

  // --- Chromaticity diagram --------------------------------------------------
  var diagramBg = null;
  var DX = [0, 0.8],
    DY = [0, 0.9];

  function setupCanvas(canvas, cssW, cssH) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = Math.round(cssW * dpr),
      h = Math.round(cssH * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    var ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return ctx;
  }

  function diagramGeom(cssW) {
    var pad = { l: 34, r: 8, t: 8, b: 28 };
    var plotW = cssW - pad.l - pad.r;
    var plotH = (plotW * (DY[1] - DY[0])) / (DX[1] - DX[0]);
    return { pad: pad, w: plotW, h: plotH, cssH: plotH + pad.t + pad.b };
  }

  function buildDiagramBg(g) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = Math.round(g.w * dpr),
      h = Math.round(g.h * dpr);
    var c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    var ctx = c.getContext("2d");
    var img = ctx.createImageData(w, h);
    var poly = LOCUS;
    for (var j = 0; j < h; j++) {
      var y = DY[1] - ((j + 0.5) / h) * (DY[1] - DY[0]);
      for (var i = 0; i < w; i++) {
        var x = DX[0] + ((i + 0.5) / w) * (DX[1] - DX[0]);
        if (!inPolygon(x, y, poly)) continue;
        var X = x / y,
          Z = (1 - x - y) / y;
        var M = XYZ_TO_SRGB;
        var r = Math.max(0, M[0][0] * X + M[0][1] + M[0][2] * Z);
        var gg = Math.max(0, M[1][0] * X + M[1][1] + M[1][2] * Z);
        var b = Math.max(0, M[2][0] * X + M[2][1] + M[2][2] * Z);
        var m = Math.max(r, gg, b, 1e-6);
        var o = (j * w + i) * 4;
        img.data[o] = enc(r / m);
        img.data[o + 1] = enc(gg / m);
        img.data[o + 2] = enc(b / m);
        img.data[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function inPolygon(x, y, poly) {
    var inside = false;
    for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      var xi = poly[i][0],
        yi = poly[i][1],
        xj = poly[j][0],
        yj = poly[j][1];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }

  function drawDiagram(alpha, beta) {
    if (!S) return;
    var cssW = el.diagram.parentElement.clientWidth;
    var g = diagramGeom(cssW);
    var ctx = setupCanvas(el.diagram, cssW, g.cssH);
    el.diagram.style.height = g.cssH + "px";
    if (!diagramBg || diagramBg.cssW !== cssW) {
      diagramBg = { cssW: cssW, canvas: buildDiagramBg(g) };
    }
    var text = cssVar("--global-text-color", "#0b2e59");
    var soft = cssVar("--global-text-color-light", "#3b5f82");
    var X0 = g.pad.l,
      Y0 = g.pad.t;
    function px(x) {
      return X0 + ((x - DX[0]) / (DX[1] - DX[0])) * g.w;
    }
    function py(y) {
      return Y0 + ((DY[1] - y) / (DY[1] - DY[0])) * g.h;
    }

    ctx.clearRect(0, 0, cssW, g.cssH);
    ctx.drawImage(diagramBg.canvas, X0, Y0, g.w, g.h);

    // axes
    ctx.strokeStyle = soft;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 1;
    ctx.strokeRect(X0 + 0.5, Y0 + 0.5, g.w - 1, g.h - 1);
    ctx.globalAlpha = 1;
    ctx.fillStyle = soft;
    ctx.font = "11px Roboto, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    [0, 0.2, 0.4, 0.6, 0.8].forEach(function (t) {
      ctx.fillText(t.toFixed(1), px(t), Y0 + g.h + 5);
    });
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    [0, 0.2, 0.4, 0.6, 0.8].forEach(function (t) {
      ctx.fillText(t.toFixed(1), X0 - 5, py(t));
    });
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText("x", X0 + g.w / 2, g.cssH);
    ctx.save();
    ctx.translate(10, Y0 + g.h / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textBaseline = "middle";
    ctx.fillText("y", 0, 0);
    ctx.restore();

    // pixel clouds
    var idx = S.diagramIdx;
    ctx.fillStyle = "rgba(17,17,17,0.45)";
    for (var i = 0; i < idx.length; i++) {
      var p = idx[i];
      ctx.fillRect(px(WP[0] + S.ux[p] * S.xm[p]) - 1, py(WP[1] + S.uy[p] * S.xm[p]) - 1, 2, 2);
    }
    ctx.fillStyle = "rgba(31,79,255,0.5)";
    for (var j = 0; j < idx.length; j++) {
      var q = idx[j];
      var xn = expandedDistance(S, q, alpha, beta);
      ctx.fillRect(px(WP[0] + S.ux[q] * xn) - 1, py(WP[1] + S.uy[q] * xn) - 1, 2, 2);
    }

    function tri(t, color, width, dash) {
      ctx.beginPath();
      ctx.moveTo(px(t[0][0]), py(t[0][1]));
      ctx.lineTo(px(t[1][0]), py(t[1][1]));
      ctx.lineTo(px(t[2][0]), py(t[2][1]));
      ctx.closePath();
      ctx.setLineDash(dash || []);
      ctx.lineWidth = width;
      ctx.strokeStyle = color;
      ctx.stroke();
      ctx.setLineDash([]);
    }
    tri(UHD, text, 2);
    tri(HD, "#e0b400", 2);
    if (beta > 0) tri(scaledTriangle(HD, 1 - beta), "#00a6c7", 2);
    tri(scaledTriangle(HD, alpha * (1 - beta)), "#e0402f", 2, [5, 4]);

    // white point
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 2;
    var wx = px(WP[0]),
      wy = py(WP[1]);
    ctx.beginPath();
    ctx.moveTo(wx - 5, wy - 5);
    ctx.lineTo(wx + 5, wy + 5);
    ctx.moveTo(wx + 5, wy - 5);
    ctx.lineTo(wx - 5, wy + 5);
    ctx.stroke();
  }

  // --- α sweep chart ---------------------------------------------------------
  var sweepCache = { key: null, paper: null, mine: null };

  function sweepGain(st, alpha, beta) {
    var idx = st.sweepIdx,
      sb = 0,
      sa = 0;
    for (var i = 0; i < idx.length; i++) {
      var p = idx[i];
      sb += st.xm[p];
      sa += expandedDistance(st, p, alpha, beta);
    }
    return sb > 0 ? (sa / sb - 1) * 100 : 0;
  }

  function niceMax(v) {
    var steps = [10, 20, 25, 50, 100, 150, 200, 250, 300];
    for (var i = 0; i < steps.length; i++) if (v <= steps[i]) return steps[i];
    return Math.ceil(v / 100) * 100;
  }

  function drawSweep(alpha, beta) {
    if (!S) return;
    var key = S.n + ":" + beta;
    if (sweepCache.key !== key) {
      sweepCache.key = key;
      sweepCache.paper = SWEEP_ALPHAS.map(function (a) {
        return sweepGain(S, a, 0);
      });
      sweepCache.mine = SWEEP_ALPHAS.map(function (a) {
        return sweepGain(S, a, beta);
      });
    }
    var cssW = el.sweep.parentElement.clientWidth;
    var cssH = Math.max(190, Math.min(260, cssW * 0.45));
    el.sweep.style.height = cssH + "px";
    var ctx = setupCanvas(el.sweep, cssW, cssH);
    var pad = { l: 40, r: 12, t: 12, b: 30 };
    var w = cssW - pad.l - pad.r,
      h = cssH - pad.t - pad.b;
    var maxV = niceMax(Math.max.apply(null, sweepCache.mine.concat(sweepCache.paper, [5])));
    var text = cssVar("--global-text-color", "#0b2e59");
    var soft = cssVar("--global-text-color-light", "#3b5f82");
    var accent = cssVar("--global-theme-color", "#0a7ea4");
    function px(a) {
      return pad.l + (a / 0.9) * w;
    }
    function py(v) {
      return pad.t + h - (v / maxV) * h;
    }

    ctx.clearRect(0, 0, cssW, cssH);
    ctx.font = "11px Roboto, sans-serif";
    ctx.lineWidth = 1;
    var ticks = 4;
    for (var t = 0; t <= ticks; t++) {
      var v = (maxV / ticks) * t;
      ctx.strokeStyle = soft;
      ctx.globalAlpha = t === 0 ? 0.6 : 0.18;
      ctx.beginPath();
      ctx.moveTo(pad.l, py(v) + 0.5);
      ctx.lineTo(pad.l + w, py(v) + 0.5);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = soft;
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText("+" + Math.round(v) + "%", pad.l - 6, py(v));
    }
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    [0, 0.3, 0.6, 0.9].forEach(function (a) {
      ctx.fillText(a.toFixed(1), px(a), pad.t + h + 6);
    });
    ctx.textBaseline = "bottom";
    ctx.fillText("α", pad.l + w / 2, cssH);

    function line(vals, color, width, dash) {
      ctx.beginPath();
      vals.forEach(function (v, i) {
        var x = px(SWEEP_ALPHAS[i]),
          y = py(v);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.setLineDash(dash || []);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    line(sweepCache.paper, soft, 2, [5, 4]);
    if (beta > 0) line(sweepCache.mine, accent, 2.5);

    // current α
    ctx.strokeStyle = text;
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.moveTo(px(alpha) + 0.5, pad.t);
    ctx.lineTo(px(alpha) + 0.5, pad.t + h);
    ctx.stroke();
    ctx.globalAlpha = 1;
    function dot(v, color) {
      ctx.beginPath();
      ctx.arc(px(alpha), py(v), 4.5, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    }
    dot(sweepGain(S, alpha, 0), soft);
    if (beta > 0) dot(sweepGain(S, alpha, beta), accent);

    // direct labels at the left end of each line
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.fillStyle = soft;
    ctx.fillText("paper (β = 0)", px(0) + 6, py(sweepCache.paper[0]) - 4);
    if (beta > 0) {
      ctx.fillStyle = accent;
      ctx.fillText("β = " + beta.toFixed(2), px(0) + 6, py(sweepCache.mine[0]) - 4);
    }
  }

  // --- Update loop -----------------------------------------------------------
  var pending = false;
  var dirtyBefore = true;

  function values() {
    return { alpha: parseFloat(el.alpha.value), beta: parseFloat(el.beta.value) };
  }

  function pct(v) {
    return (v * 100).toFixed(0) + "%";
  }

  function update() {
    pending = false;
    if (!S) return;
    var v = values();
    el.alphaOut.textContent = v.alpha.toFixed(2);
    el.betaOut.textContent = v.beta.toFixed(2);
    if (dirtyBefore) {
      paint(el.before, S, v.alpha, v.beta, false);
      dirtyBefore = false;
    }
    var m = paint(el.after, S, v.alpha, v.beta, true);
    el.expanded.textContent = pct(m.expanded);
    el.sat.textContent = (m.saturation >= 0 ? "+" : "") + pct(m.saturation);
    el.usage.textContent = pct(baselineUsage(S)) + " → " + pct(m.usage);
    drawDiagram(v.alpha, v.beta);
    drawSweep(v.alpha, v.beta);
    presetButtons.forEach(function (b) {
      var on = parseFloat(b.dataset.gdAlpha) === v.alpha && parseFloat(b.dataset.gdBeta) === v.beta;
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  function schedule() {
    if (!pending) {
      pending = true;
      requestAnimationFrame(update);
    }
  }

  function loadImage(src, onDone) {
    el.status.textContent = "Loading image…";
    var img = new Image();
    img.decoding = "async";
    img.onload = function () {
      try {
        S = prepare(img);
        dirtyBefore = true;
        sweepCache.key = null;
        el.status.textContent = "";
        schedule();
      } catch (e) {
        el.status.textContent = "That image could not be read. Try a JPEG or PNG.";
      }
      if (onDone) onDone();
    };
    img.onerror = function () {
      el.status.textContent = "That image could not be loaded. Try a JPEG or PNG.";
      if (onDone) onDone();
    };
    img.src = src;
  }

  function selectButton(btn) {
    imageButtons.forEach(function (b) {
      b.setAttribute("aria-pressed", b === btn ? "true" : "false");
    });
  }

  // --- Wiring ----------------------------------------------------------------
  el.alpha.addEventListener("input", schedule);
  el.beta.addEventListener("input", schedule);

  el.split.addEventListener("input", function () {
    el.compare.style.setProperty("--split", el.split.value + "%");
  });

  presetButtons.forEach(function (b) {
    b.addEventListener("click", function () {
      el.alpha.value = b.dataset.gdAlpha;
      el.beta.value = b.dataset.gdBeta;
      schedule();
    });
  });

  imageButtons.forEach(function (b) {
    b.addEventListener("click", function () {
      selectButton(b);
      loadImage(b.dataset.gdSrc);
    });
  });

  el.file.addEventListener("change", function () {
    var f = el.file.files && el.file.files[0];
    if (!f) return;
    selectButton(null);
    var url = URL.createObjectURL(f);
    loadImage(url, function () {
      URL.revokeObjectURL(url);
    });
  });

  var resizeTimer;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      diagramBg = null;
      schedule();
    }, 150);
  });

  // Redraw charts when the light/dark theme changes.
  new MutationObserver(schedule).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme", "class"],
  });
  if (window.matchMedia) {
    var mq = window.matchMedia("(prefers-color-scheme: dark)");
    if (mq.addEventListener) mq.addEventListener("change", schedule);
  }

  var first = root.querySelector('[data-gd-src][aria-pressed="true"]') || imageButtons[0];
  if (first) loadImage(first.dataset.gdSrc);
})();
