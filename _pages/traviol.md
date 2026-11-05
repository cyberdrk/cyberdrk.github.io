---
layout: page
title: TraViol
permalink: /projects/traviol/
description: Automatic traffic-violation detection from one roadside camera. Electronics in Service to Society project, VJTI Mumbai, 2018.
nav: false
---

India sees at least **22 traffic violations a minute** and **one road death every four minutes** (figures from our 2018 presentation), yet enforcement still depends on an officer being there. TraViol watches a fixed traffic camera, finds each moving vehicle, measures its speed, checks whether it jumps the red light, and for every violation saves the evidence, locates the licence plate, reads it and sends it to the cloud. It uses classical computer vision only, so it needs no training data and runs on modest hardware.

<div class="gd-stats">
  <div class="gd-stat">
    <span class="gd-stat-value">88.4 km/h</span>
    <span class="gd-stat-label">car measured and flagged for overspeeding on our 2018 test clip</span>
  </div>
  <div class="gd-stat">
    <span class="gd-stat-value">±0.1 km/h</span>
    <span class="gd-stat-label">error recovering a known speed on a synthetic clip, after the 2026 Python 3 rebuild</span>
  </div>
  <div class="gd-stat">
    <span class="gd-stat-value">5 stages</span>
    <span class="gd-stat-label">detect, measure speed, check red light, find the plate, notify the police</span>
  </div>
</div>

<section class="ocean-section traviol-demo" id="traviol-demo" aria-label="Interactive TraViol walkthrough">
  <h4>Build the bird's-eye view</h4>
  <p class="gd-lead">The camera sees the road at an angle, so a metre near the camera covers more pixels than a metre far away. Drag the four yellow corners onto a stretch of road that is rectangular in reality; the bird's-eye panel shows the road from directly above, where distances are even and the stop line is a straight row. Move the stop line and watch it map back into the camera's perspective.</p>

  <div class="tv-stage">
    <figure class="gd-figure tv-frame-fig">
      <canvas id="tv-frame" data-src="{{ '/assets/img/traviol/road_frame.jpg' | relative_url }}" role="img" aria-label="Road frame from the test clip with draggable corners of the road rectangle"></canvas>
      <figcaption>Frame from our 2018 test clip. Corners start where our 2018 script put them.</figcaption>
    </figure>
    <figure class="gd-figure tv-top-fig">
      <canvas id="tv-top" role="img" aria-label="Bird's-eye view of the selected road rectangle"></canvas>
      <figcaption>Bird's-eye view</figcaption>
    </figure>
  </div>

  <div class="tv-controls">
    <div class="gd-slider">
      <label for="tv-stop"><span>Stop line</span><output id="tv-stop-out" for="tv-stop">50%</output></label>
      <input type="range" id="tv-stop" min="0.05" max="0.95" step="0.01" value="0.5">
      <p class="gd-hint">A vehicle whose front crosses this row while the signal is red is flagged.</p>
    </div>
    <button type="button" class="gd-chip" id="tv-reset">Reset corners</button>
    <span class="gd-status" id="tv-status" role="status"></span>
  </div>

  <h4 class="tv-h">Run the speed trap</h4>
  <p class="gd-lead">ORB feature matching finds the same corners on the car in two frames and measures how far they moved. Set the measurement and calibration to see what the system decides.</p>

  <div class="tv-speed">
    <div class="gd-slider">
      <label for="tv-shift"><span>Shift of matched points</span><output id="tv-shift-out" for="tv-shift">36 px</output></label>
      <input type="range" id="tv-shift" min="2" max="160" step="1" value="36">
    </div>
    <div class="gd-slider">
      <label for="tv-frames"><span>Frames between the two images</span><output id="tv-frames-out" for="tv-frames">3</output></label>
      <input type="range" id="tv-frames" min="1" max="10" step="1" value="3">
    </div>
    <div class="gd-slider">
      <label for="tv-fps"><span>Camera frame rate (fps)</span><output id="tv-fps-out" for="tv-fps">30</output></label>
      <input type="range" id="tv-fps" min="10" max="60" step="5" value="30">
    </div>
    <div class="gd-slider">
      <label for="tv-mpp"><span>Calibration, metres per pixel</span><output id="tv-mpp-out" for="tv-mpp">0.030 m</output></label>
      <input type="range" id="tv-mpp" min="0.005" max="0.1" step="0.005" value="0.03">
    </div>
    <div class="gd-slider">
      <label for="tv-limit"><span>Speed limit</span><output id="tv-limit-out" for="tv-limit">50 km/h</output></label>
      <input type="range" id="tv-limit" min="20" max="120" step="5" value="50">
    </div>
  </div>

  <dl class="gd-metrics">
    <div><dt>Time between frames</dt><dd id="tv-m-time">–</dd></div>
    <div><dt>Distance travelled</dt><dd id="tv-m-dist">–</dd></div>
    <div><dt>Speed</dt><dd id="tv-m-speed">–</dd></div>
  </dl>
  <p class="tv-verdict" id="tv-verdict" role="status" aria-live="polite"></p>
</section>

<section class="ocean-section" markdown="1">

#### How the pipeline works

1. **Find moving vehicles.** A Mixture-of-Gaussians model learns what the empty road looks like at every pixel, so anything moving stands out. Erosion and dilation clean the mask, and each large blob becomes a vehicle box.
2. **Measure speed.** ORB finds distinctive corners on the car in two frames _n_ apart and matches them. The median shift, in metres, divided by _n_ / fps is the speed.
3. **Check the red light.** A perspective transform gives the bird's-eye view above; a vehicle whose front crosses the stop line on red is flagged.
4. **Find and read the plate.** Sobel edges, Otsu's threshold and a wide closing kernel merge each plate into a blob, filtered by shape and edge density. Tesseract OCR reads the crop.
5. **Notify.** The frame and plate are uploaded to Dropbox for the traffic police.

<div class="tv-gallery">
  <figure><img src="{{ '/assets/img/traviol/2_vehicle_detected.jpg' | relative_url }}" alt="Vehicle detected with a red box" loading="lazy"><figcaption>1 · Vehicle detected</figcaption></figure>
  <figure><img src="{{ '/assets/img/traviol/3_orb_speed.jpg' | relative_url }}" alt="ORB keypoints matched between two frames, giving 38.9 km/h" loading="lazy"><figcaption>2 · ORB matches give the speed</figcaption></figure>
  <figure><img src="{{ '/assets/img/traviol/4_birds_eye.jpg' | relative_url }}" alt="Road rectangle and its bird's-eye view with a stop line" loading="lazy"><figcaption>3 · Bird's-eye view and stop line</figcaption></figure>
  <figure><img src="{{ '/assets/img/traviol/5_plate.jpg' | relative_url }}" alt="Licence plate located on the car" loading="lazy"><figcaption>4 · Plate located</figcaption></figure>
</div>

</section>

<section class="ocean-section" markdown="1">

#### Results

- **2018:** on our test clip, the system measured a car at 88.4 km/h and flagged it for overspeeding.
- **2026 rebuild:** on a synthetic clip with a known speed, the pipeline recovered 58.3 km/h and 38.9 km/h exactly, flagged red-light crossings only while the signal was red, and located the plate on the real frame as the only candidate.
- **Honest limit:** the plate in our footage is only 13 pixels tall, too small for OCR to read; reading needs closer or higher-resolution video.

</section>

<section class="ocean-section" markdown="1">

#### Details

- **Team:** Dipti Kulkarni, Aditi Sharma and Ruhi Dongre, _Electronics in Service to Society_ project, Veermata Jijabai Technological Institute (VJTI), Mumbai, 2018.
- **Built with:** Python, OpenCV (Mixture of Gaussians, ORB, perspective transforms, morphology), Tesseract OCR, the Dropbox API. Rebuilt in 2026 as a Python 3 package with tests; this page recreates the bird's-eye and speed steps in JavaScript.
- **Code:** [github.com/cyberdrk/TraViol](https://github.com/cyberdrk/TraViol), with the original 2018 scripts, the Python 3 pipeline, tests and a full write-up.
- **Next steps:** detect the signal colour from the camera, track vehicles in dense traffic, and add zebra-crossing obstruction, the third violation in our presentation.

</section>

<script defer src="{{ '/assets/js/traviol-demo.js' | relative_url | bust_file_cache }}"></script>
