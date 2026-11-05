// TraViol interactive walkthrough: bird's-eye view builder and speed trap.
// Same geometry and speed formula as traviol/geometry.py and traviol/speed.py in github.com/cyberdrk/TraViol.
(function () {
  "use strict";

  var root = document.getElementById("traviol-demo");
  if (!root) return;

  var DEFAULT_CORNERS = [
    [109, 218],
    [1007, 179],
    [1278, 525],
    [28, 610],
  ]; // TL, TR, BR, BL from the 2018 bird's-eye script
  var NAMES = ["TL", "TR", "BR", "BL"];
  var TOP_W = 240,
    TOP_H = 480; // bird's-eye canvas, same 1:2 shape as the Python default (400×800)

  var el = {
    frame: document.getElementById("tv-frame"),
    top: document.getElementById("tv-top"),
    stop: document.getElementById("tv-stop"),
    stopOut: document.getElementById("tv-stop-out"),
    reset: document.getElementById("tv-reset"),
    status: document.getElementById("tv-status"),
    shift: document.getElementById("tv-shift"),
    frames: document.getElementById("tv-frames"),
    fps: document.getElementById("tv-fps"),
    mpp: document.getElementById("tv-mpp"),
    limit: document.getElementById("tv-limit"),
    shiftOut: document.getElementById("tv-shift-out"),
    framesOut: document.getElementById("tv-frames-out"),
    fpsOut: document.getElementById("tv-fps-out"),
    mppOut: document.getElementById("tv-mpp-out"),
    limitOut: document.getElementById("tv-limit-out"),
    time: document.getElementById("tv-m-time"),
    dist: document.getElementById("tv-m-dist"),
    speed: document.getElementById("tv-m-speed"),
    verdict: document.getElementById("tv-verdict"),
  };

  function cssVar(name, fallback) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }

  // --- Homography (the maths behind cv2.getPerspectiveTransform) -------------
  // Returns H (3×3, row-major) mapping src points to dst points.
  function homography(src, dst) {
    var A = [],
      b = [];
    for (var i = 0; i < 4; i++) {
      var x = src[i][0],
        y = src[i][1],
        u = dst[i][0],
        v = dst[i][1];
      A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
      b.push(u);
      A.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
      b.push(v);
    }
    var h = solve(A, b);
    if (!h) return null;
    return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
  }

  function solve(A, b) {
    var n = b.length,
      M = A.map(function (row, i) {
        return row.concat([b[i]]);
      });
    for (var c = 0; c < n; c++) {
      var p = c;
      for (var r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      if (Math.abs(M[p][c]) < 1e-10) return null;
      var tmp = M[c];
      M[c] = M[p];
      M[p] = tmp;
      for (var r2 = 0; r2 < n; r2++) {
        if (r2 === c) continue;
        var f = M[r2][c] / M[c][c];
        for (var k = c; k <= n; k++) M[r2][k] -= f * M[c][k];
      }
    }
    return M.map(function (row, i) {
      return row[n] / row[i];
    });
  }

  function apply(H, x, y) {
    var w = H[6] * x + H[7] * y + H[8];
    return [(H[0] * x + H[1] * y + H[2]) / w, (H[3] * x + H[4] * y + H[5]) / w];
  }

  // A quadrilateral must be convex and ordered for the transform to make sense.
  function isConvex(q) {
    var sign = 0;
    for (var i = 0; i < 4; i++) {
      var a = q[i],
        b = q[(i + 1) % 4],
        c = q[(i + 2) % 4];
      var z = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
      if (Math.abs(z) < 1e-6) return false;
      var s = z > 0 ? 1 : -1;
      if (sign === 0) sign = s;
      else if (s !== sign) return false;
    }
    return true;
  }

  // --- State -------------------------------------------------------------------
  var img = new Image();
  var src = null; // ImageData of the road frame
  var W = 1280,
    H = 720;
  var corners = DEFAULT_CORNERS.map(function (p) {
    return p.slice();
  });
  var dragging = -1;
  var pending = false;

  var fctx = el.frame.getContext("2d");
  el.top.width = TOP_W;
  el.top.height = TOP_H;
  var tctx = el.top.getContext("2d");
  var topData = tctx.createImageData(TOP_W, TOP_H);

  function schedule() {
    if (!pending) {
      pending = true;
      requestAnimationFrame(draw);
    }
  }

  function draw() {
    pending = false;
    if (!src) return;
    var stop = parseFloat(el.stop.value);
    el.stopOut.textContent = Math.round(stop * 100) + "%";
    var dstRect = [
      [0, 0],
      [TOP_W - 1, 0],
      [TOP_W - 1, TOP_H - 1],
      [0, TOP_H - 1],
    ];
    var ok = isConvex(corners);
    var Hinv = ok ? homography(dstRect, corners) : null; // bird's-eye -> frame
    var accent = cssVar("--global-theme-color", "#0a7ea4");

    // Frame with the road rectangle and the stop line mapped back into perspective
    // Draw handles and lines at a fixed on-screen size, whatever the canvas scale.
    var k = W / Math.max(1, el.frame.clientWidth);
    fctx.drawImage(img, 0, 0, W, H);
    fctx.lineWidth = 2.5 * k;
    fctx.strokeStyle = ok ? "#ffd400" : "#ff5a4f";
    fctx.beginPath();
    corners.forEach(function (p, i) {
      if (i === 0) fctx.moveTo(p[0], p[1]);
      else fctx.lineTo(p[0], p[1]);
    });
    fctx.closePath();
    fctx.stroke();
    if (Hinv) {
      var ly = stop * (TOP_H - 1);
      var a = apply(Hinv, 0, ly),
        b = apply(Hinv, TOP_W - 1, ly);
      fctx.strokeStyle = "#ff2d2d";
      fctx.lineWidth = 3.5 * k;
      fctx.beginPath();
      fctx.moveTo(a[0], a[1]);
      fctx.lineTo(b[0], b[1]);
      fctx.stroke();
    }
    corners.forEach(function (p, i) {
      fctx.beginPath();
      fctx.arc(p[0], p[1], (dragging === i ? 17 : 14) * k, 0, Math.PI * 2);
      fctx.fillStyle = "rgba(255, 212, 0, 0.9)";
      fctx.fill();
      fctx.lineWidth = 2 * k;
      fctx.strokeStyle = "#111";
      fctx.stroke();
      fctx.fillStyle = "#111";
      fctx.font = "bold " + Math.round(11 * k) + "px Roboto, sans-serif";
      fctx.textAlign = "center";
      fctx.textBaseline = "middle";
      fctx.fillText(NAMES[i], p[0], p[1] + 1);
    });

    // Bird's-eye view: for every output pixel, look up where it comes from in the frame
    var out = topData.data,
      sd = src.data;
    if (Hinv) {
      for (var y = 0; y < TOP_H; y++) {
        for (var x = 0; x < TOP_W; x++) {
          var s = apply(Hinv, x, y);
          var sx = s[0],
            sy = s[1];
          var o = (y * TOP_W + x) * 4;
          if (sx < 0 || sy < 0 || sx >= W - 1 || sy >= H - 1) {
            out[o] = out[o + 1] = out[o + 2] = 30;
            out[o + 3] = 255;
            continue;
          }
          var x0 = sx | 0,
            y0 = sy | 0,
            fx = sx - x0,
            fy = sy - y0;
          var i00 = (y0 * W + x0) * 4,
            i10 = i00 + 4,
            i01 = i00 + W * 4,
            i11 = i01 + 4;
          for (var c = 0; c < 3; c++) {
            out[o + c] = (sd[i00 + c] * (1 - fx) + sd[i10 + c] * fx) * (1 - fy) + (sd[i01 + c] * (1 - fx) + sd[i11 + c] * fx) * fy;
          }
          out[o + 3] = 255;
        }
      }
      tctx.putImageData(topData, 0, 0);
      var line = Math.round(stop * (TOP_H - 1));
      tctx.fillStyle = "#ff2d2d";
      tctx.fillRect(0, line - 2, TOP_W, 4);
      tctx.font = "bold 13px Roboto, sans-serif";
      tctx.textAlign = "left";
      tctx.textBaseline = "bottom";
      tctx.fillText("stop line", 6, line - 5);
      el.status.textContent = "";
    } else {
      tctx.fillStyle = "#222";
      tctx.fillRect(0, 0, TOP_W, TOP_H);
      el.status.textContent = "The corners must form a simple four-sided shape in the order TL, TR, BR, BL.";
    }
    el.top.style.borderColor = accent;
  }

  // --- Dragging corners --------------------------------------------------------
  function toImage(e) {
    var r = el.frame.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H];
  }

  el.frame.addEventListener("pointerdown", function (e) {
    var p = toImage(e);
    var r = el.frame.getBoundingClientRect();
    var hit = (32 * W) / r.width; // ~32 css px hit radius
    var best = -1,
      bestD = hit;
    corners.forEach(function (c, i) {
      var d = Math.hypot(c[0] - p[0], c[1] - p[1]);
      if (d < bestD) {
        best = i;
        bestD = d;
      }
    });
    if (best >= 0) {
      dragging = best;
      el.frame.setPointerCapture(e.pointerId);
      e.preventDefault();
      schedule();
    }
  });

  el.frame.addEventListener("pointermove", function (e) {
    if (dragging < 0) return;
    var p = toImage(e);
    corners[dragging] = [Math.max(0, Math.min(W, p[0])), Math.max(0, Math.min(H, p[1]))];
    schedule();
  });

  function endDrag() {
    if (dragging >= 0) {
      dragging = -1;
      schedule();
    }
  }
  el.frame.addEventListener("pointerup", endDrag);
  el.frame.addEventListener("pointercancel", endDrag);

  el.stop.addEventListener("input", schedule);
  el.reset.addEventListener("click", function () {
    corners = DEFAULT_CORNERS.map(function (p) {
      return p.slice();
    });
    schedule();
  });

  // Redraw when the theme changes (canvas border colour).
  window.addEventListener("resize", schedule);
  new MutationObserver(schedule).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });

  img.onload = function () {
    W = img.naturalWidth;
    H = img.naturalHeight;
    el.frame.width = W;
    el.frame.height = H;
    var off = document.createElement("canvas");
    off.width = W;
    off.height = H;
    var octx = off.getContext("2d", { willReadFrequently: true });
    octx.drawImage(img, 0, 0);
    src = octx.getImageData(0, 0, W, H);
    schedule();
  };
  img.onerror = function () {
    el.status.textContent = "The road frame could not be loaded.";
  };
  img.src = el.frame.dataset.src;

  // --- Speed trap --------------------------------------------------------------
  function speedUpdate() {
    var shift = parseFloat(el.shift.value),
      n = parseInt(el.frames.value, 10),
      fps = parseFloat(el.fps.value),
      mpp = parseFloat(el.mpp.value),
      limit = parseFloat(el.limit.value);
    el.shiftOut.textContent = shift + " px";
    el.framesOut.textContent = n;
    el.fpsOut.textContent = fps;
    el.mppOut.textContent = mpp.toFixed(3) + " m";
    el.limitOut.textContent = limit + " km/h";
    var t = n / fps,
      d = shift * mpp,
      kmh = (d / t) * 3.6;
    el.time.textContent = t.toFixed(3) + " s";
    el.dist.textContent = d.toFixed(2) + " m";
    el.speed.textContent = kmh.toFixed(1) + " km/h";
    var over = kmh > limit;
    el.verdict.textContent = over ? "Overspeeding: evidence saved, plate read, uploaded" : "Within the limit: no action";
    el.verdict.setAttribute("data-state", over ? "violation" : "ok");
  }
  [el.shift, el.frames, el.fps, el.mpp, el.limit].forEach(function (i) {
    i.addEventListener("input", speedUpdate);
  });
  speedUpdate();
})();
