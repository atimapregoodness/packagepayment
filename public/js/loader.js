/*
  loader.js
  Handles loader overlay show/hide
*/

(function () {
  const FADE_OUT_MS = 500;

  window.showLoader = function () {
    const overlay = document.getElementById("loadingOverlay");
    if (!overlay) return;
    clearTimeout(window._loaderSafetyTimer);
    overlay.style.display = "flex";
    overlay.classList.remove("animate__fadeOut");
    overlay.classList.add("animate__fadeIn");
  };

  window.hideLoader = function () {
    const overlay = document.getElementById("loadingOverlay");
    if (!overlay) return;
    overlay.classList.remove("animate__fadeIn");
    overlay.classList.add("animate__fadeOut");
    clearTimeout(window._loaderSafetyTimer);
    setTimeout(() => {
      if (overlay.classList.contains("animate__fadeOut")) {
        overlay.style.display = "none";
      }
    }, FADE_OUT_MS);
  };

  function shouldShowForAnchor(a, evt) {
    if (!a) return false;
    const href = a.getAttribute("href");
    if (!href) return false;
    if (
      href.startsWith("#") ||
      href.startsWith("javascript:") ||
      href.startsWith("mailto:") ||
      href.startsWith("tel:")
    )
      return false;
    if (
      a.hasAttribute("data-bs-toggle") ||
      a.hasAttribute("data-bs-target") ||
      a.hasAttribute("data-bs-dismiss")
    )
      return false;
    if (a.target && a.target.toLowerCase() === "_blank") return false;
    if (evt && (evt.ctrlKey || evt.shiftKey || evt.metaKey || evt.altKey))
      return false;
    if (evt && typeof evt.button === "number" && evt.button !== 0) return false;

    try {
      const url = new URL(href, location.href);
      if (
        url.origin === location.origin &&
        url.pathname === location.pathname &&
        url.search === location.search
      ) {
        return false;
      }
    } catch {}
    return true;
  }

  document.addEventListener("DOMContentLoaded", () => {
    // Loader on form submit
    document.addEventListener(
      "submit",
      (evt) => {
        const form = evt.target;
        if (!(form instanceof HTMLFormElement)) return;
        if (form.hasAttribute("data-no-loader")) return;
        window.showLoader();
      },
      true
    );

    // Loader on link click
    document.addEventListener(
      "click",
      (evt) => {
        const anchor = evt.target.closest("a");
        if (!anchor) return;
        if (anchor.hasAttribute("data-no-loader")) return;
        if (shouldShowForAnchor(anchor, evt)) {
          window.showLoader();
        }
      },
      true
    );

    // Auto-hide on load
    window.addEventListener("load", () => window.hideLoader());
    window.addEventListener("pageshow", (e) => {
      if (e.persisted) window.hideLoader();
    });

    // Safety fallback (15s max)
    window._loaderSafetyTimer = setTimeout(window.hideLoader, 15000);

    // Manual loader test buttons
    document.querySelectorAll(".loaderBtn").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (!btn.closest("form")) window.showLoader();
      });
    });
  });
})();
