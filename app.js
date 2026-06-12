// Compatibility entrypoint. New pages should load assets/js/app.js as a module.
(function () {
  const currentScript = document.currentScript;
  const baseUrl = currentScript ? currentScript.src : window.location.href;
  const moduleScript = document.createElement("script");
  moduleScript.type = "module";
  moduleScript.src = new URL("assets/js/app.js", baseUrl).href;
  document.head.appendChild(moduleScript);
})();
