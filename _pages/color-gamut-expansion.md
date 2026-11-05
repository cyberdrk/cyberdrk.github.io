---
layout: page
title: Colour Gamut Expansion
permalink: /projects/color-gamut-expansion/
description: Making HD content use the full colour range of a UHD screen. Research internship, Imaging Systems Lab, Changwon National University, South Korea, 2018.
nav: false
---

Your TV is 4K/UHD and can show almost **twice the colour range** of HD, but most of what you watch is still mastered in HD, so the extra range sits unused. Gamut expansion pushes each pixel's colour outward so the content fills the screen, keeping its hue and brightness. I implemented a published method, found why it barely changes real images, and fixed it with one extra parameter, **β**.

<div class="gd-stats">
  <div class="gd-stat">
    <span class="gd-stat-value">+45%</span>
    <span class="gd-stat-label">saturation gain on a portrait, vs +6% for the published method at the same α</span>
  </div>
  <div class="gd-stat">
    <span class="gd-stat-value">13% → 31%</span>
    <span class="gd-stat-label">of the UHD colour gamut the image actually uses</span>
  </div>
  <div class="gd-stat">
    <span class="gd-stat-value">α 0–0.9</span>
    <span class="gd-stat-label">whole range now useful; the published method does nothing above α ≈ 0.6</span>
  </div>
</div>

<section class="ocean-section gamut-demo" id="gamut-demo" aria-label="Interactive gamut expansion demo">
  <h4>Try it</h4>
  <p class="gd-lead">Pick an image, then move α and β. Drag the divider on the image to compare. Everything runs in your browser; uploaded photos never leave your device.</p>

  <div class="gd-images" role="group" aria-label="Test image">
    <button type="button" class="gd-chip" data-gd-src="{{ '/assets/img/gamut/portrait.jpg' | relative_url }}" aria-pressed="true">Portrait</button>
    <button type="button" class="gd-chip" data-gd-src="{{ '/assets/img/gamut/motocross.jpg' | relative_url }}" aria-pressed="false">Motocross</button>
    <button type="button" class="gd-chip" data-gd-src="{{ '/assets/img/gamut/ski.jpg' | relative_url }}" aria-pressed="false">Ski scene</button>
    <label class="gd-chip gd-upload" for="gd-file">Your photo<input type="file" id="gd-file" accept="image/*"></label>
    <span class="gd-status" id="gd-status" role="status"></span>
  </div>

  <div class="gd-controls">
    <div class="gd-slider">
      <label for="gd-alpha"><span>α &nbsp;inner gamut</span><output id="gd-alpha-out" for="gd-alpha">0.30</output></label>
      <input type="range" id="gd-alpha" min="0" max="0.9" step="0.05" value="0.3">
      <p class="gd-hint">Colours inside the dashed red gamut stay as they are. Lower α expands more.</p>
    </div>
    <div class="gd-slider">
      <label for="gd-beta"><span>β &nbsp;reference gamut</span><output id="gd-beta-out" for="gd-beta">0.30</output></label>
      <input type="range" id="gd-beta" min="0" max="0.6" step="0.05" value="0.3">
      <p class="gd-hint">β = 0 is the published method. Higher β fits the reference gamut (cyan) to the image.</p>
    </div>
    <div class="gd-presets" role="group" aria-label="Presets">
      <button type="button" class="gd-chip" data-gd-alpha="0.3" data-gd-beta="0">Published method</button>
      <button type="button" class="gd-chip" data-gd-alpha="0.3" data-gd-beta="0.3">With β</button>
    </div>
  </div>

  <div class="gd-stage">
    <figure class="gd-figure">
      <div class="gd-compare" id="gd-compare">
        <canvas id="gd-before" aria-label="Original image"></canvas>
        <canvas id="gd-after" aria-label="Expanded image"></canvas>
        <span class="gd-divider" aria-hidden="true"></span>
        <span class="gd-tag gd-tag-before">HD original</span>
        <span class="gd-tag gd-tag-after">Expanded</span>
        <input type="range" id="gd-split" min="0" max="100" value="50" aria-label="Move the divider between original and expanded">
      </div>
      <figcaption id="gd-render-note"></figcaption>
    </figure>

    <figure class="gd-figure">
      <div class="gd-canvas-wrap"><canvas id="gd-diagram" role="img" aria-label="CIE 1931 chromaticity diagram showing the image's colours before and after expansion"></canvas></div>
      <figcaption class="gd-legend">
        <span><i class="gd-key gd-key-dot" style="--k: #111"></i>pixels before</span>
        <span><i class="gd-key gd-key-dot" style="--k: #1f4fff"></i>pixels after</span>
        <span><i class="gd-key" style="--k: var(--global-text-color)"></i>UHD (BT.2020)</span>
        <span><i class="gd-key" style="--k: #e0b400"></i>HD (BT.709)</span>
        <span><i class="gd-key" style="--k: #00a6c7"></i>β·HD</span>
        <span><i class="gd-key gd-key-dash" style="--k: #e0402f"></i>inner gamut</span>
      </figcaption>
    </figure>

  </div>

  <dl class="gd-metrics">
    <div><dt>Pixels expanded</dt><dd id="gd-m-expanded">–</dd></div>
    <div><dt>Mean saturation gain</dt><dd id="gd-m-sat">–</dd></div>
    <div><dt>UHD gamut in use</dt><dd id="gd-m-usage">–</dd></div>
  </dl>

  <figure class="gd-figure gd-sweep">
    <div class="gd-canvas-wrap"><canvas id="gd-sweep" role="img" aria-label="Saturation gain for every α, for the published method and for the current β"></canvas></div>
    <figcaption>Saturation gain across every α for this image. The dashed line is the published method; the solid line uses your β.</figcaption>
  </figure>
</section>

<section class="ocean-section" markdown="1">

#### The problem

A display can only show colours inside its **gamut**, the triangle formed by its red, green and blue primaries on the CIE 1931 chromaticity diagram. HD uses **BT.709**; UHD uses **BT.2020**, which covers about **1.9×** the area. HD content on a UHD panel stays inside the small triangle, leaving almost half of the panel's colour unused.

</section>

<section class="ocean-section" markdown="1">

#### The published method

Azimi et al. ([IEEE ICC 2017](https://ieeexplore.ieee.org/document/7996741)) move each pixel along the line from the white point through its own colour, so hue never changes. Colours inside an **inner gamut** (HD scaled by α) stay put to protect skin tones and neutrals; everything outside it is stretched to the UHD border:

<p class="gd-formula">x = x<sub>m</sub> + (D − d) · (x<sub>m</sub> − d<sub>α</sub>) / (d − d<sub>α</sub>), &nbsp; with d<sub>α</sub> = α · d</p>

Here x<sub>m</sub> is the pixel's distance from the white point, and D and d are the distances to the UHD and HD borders along the same line.

</section>

<section class="ocean-section" markdown="1">

#### What I changed

Real images sit in a small cloud near the white point, far inside the HD border. So almost no pixel lies outside the inner gamut until α drops below about 0.6, and the pixels that do move are measured against the full HD distance d, so they barely shift.

I added **β**, which shrinks the reference HD gamut towards the white point until it hugs the image's own colours, and used this **β·HD** gamut in place of HD everywhere:

<p class="gd-formula">d<sub>β</sub> = (1 − β) · d &nbsp;&nbsp; d<sub>α</sub> = α · d<sub>β</sub> &nbsp;&nbsp; x = x<sub>m</sub> + (D − d<sub>β</sub>) · (x<sub>m</sub> − d<sub>α</sub>) / (d<sub>β</sub> − d<sub>α</sub>)</p>

With β = 0 it is exactly the published method. With β > 0, every α does something, expansion is several times stronger, and colours spread more evenly towards the UHD border. I presented the results to the lab and Korean graduate students, and a paper was submitted to _IET Electronics Letters_ (2018).

</section>

<section class="ocean-section" markdown="1">

#### Details

- **Where:** International research internship, Imaging Systems Lab, Changwon National University, South Korea, May–July 2018, funded by the Government of South Korea, under Prof. Oh-Seol Kwon.
- **Built with:** MATLAB (original research code); Python/NumPy reference implementation; this page recreates the algorithm in JavaScript.
- **Code:** [github.com/cyberdrk/Color](https://github.com/cyberdrk/Color), with the MATLAB scripts, Python port, figures and full write-up.
- **Test images:** Kodak Lossless True Color Image Suite and a standard ski-scene colour test image.

</section>

<script defer src="{{ '/assets/js/gamut-demo.js' | relative_url | bust_file_cache }}"></script>
