(function () {
  const FADE_OUT_MS = 500; // matches animate.css fadeOut timing

  // Expose globally
  window.showLoader = function showLoader() {
    const overlay = document.getElementById("loadingOverlay");
    if (!overlay) return;
    clearTimeout(window._loaderSafetyTimer);
    overlay.style.display = "flex";
    overlay.classList.remove("animate__fadeOut");
    overlay.classList.add("animate__fadeIn");
  };

  window.hideLoader = function hideLoader(force) {
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

  // Helper: should this anchor show the loader?
  function shouldShowForAnchor(a, evt) {
    if (!a) return false;
    const href = a.getAttribute("href");
    if (!href) return false;

    // skip pseudo links
    if (href.startsWith("#")) return false;
    if (href.startsWith("javascript:")) return false;
    if (href.startsWith("mailto:") || href.startsWith("tel:")) return false;

    // skip bootstrap data attributes
    if (
      a.hasAttribute("data-bs-toggle") ||
      a.hasAttribute("data-bs-target") ||
      a.hasAttribute("data-bs-dismiss")
    )
      return false;

    // skip if opening in new tab
    if (a.target && a.target.toLowerCase() === "_blank") return false;

    // skip with modifier keys
    if (evt && (evt.ctrlKey || evt.shiftKey || evt.metaKey || evt.altKey))
      return false;

    // skip non-left clicks
    if (evt && typeof evt.button === "number" && evt.button !== 0) return false;

    // skip same-page hash changes
    try {
      const url = new URL(href, location.href);
      if (
        url.origin === location.origin &&
        url.pathname === location.pathname &&
        url.search === location.search
      ) {
        return false;
      }
    } catch (err) {
      // ignore parsing errors
    }

    return true;
  }

  document.addEventListener("DOMContentLoaded", function () {
    // Forms → auto show loader on submit
    document.addEventListener(
      "submit",
      function (evt) {
        const form = evt.target;
        if (!(form instanceof HTMLFormElement)) return;
        if (form.hasAttribute("data-no-loader")) return;
        window.showLoader();
      },
      true
    );

    // Links → auto show loader on click
    document.addEventListener(
      "click",
      function (evt) {
        if (evt.defaultPrevented) return;
        const anchor = evt.target.closest("a");
        if (!anchor) return;
        if (anchor.hasAttribute("data-no-loader")) return;

        if (shouldShowForAnchor(anchor, evt)) {
          window.showLoader();
        }
      },
      true
    );

    // Hide loader after page load
    window.addEventListener("load", function () {
      window.hideLoader();
    });

    // Handle back/forward cache
    window.addEventListener("pageshow", function () {
      window.hideLoader();
    });

    // Manual trigger for demo/test buttons
    document.querySelectorAll(".loaderBtn").forEach((btn) => {
      btn.addEventListener("click", function () {
        const form = btn.closest("form");
        if (!form) {
          window.showLoader();
        }
      });
    });
  });
})();
