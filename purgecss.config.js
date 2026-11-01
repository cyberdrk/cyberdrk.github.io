module.exports = {
  content: ["_site/**/*.html", "_site/**/*.js"],
  css: ["_site/assets/css/*.css"],
  output: "_site/assets/css/",
  skippedContentGlobs: ["_site/assets/**/*.html"],
  // Added by script on click (starfish cursor wink), so never in the HTML itself
  safelist: ["starfish-wink"],
};
