(function () {
  const FADE_OUT_MS = 500; // matches animate.css timing
  const SAFETY_HIDE_MS = 30000; // fallback to auto-hide after 30s (avoid stuck overlay)

  // Expose functions globally
  window.showLoader = function showLoader() {
    const overlay = document.getElementById("loadingOverlay");
    if (!overlay) return;
    // clear any hide timer
    clearTimeout(window._loaderSafetyTimer);
    overlay.style.display = "flex";
    overlay.classList.remove("animate__fadeOut");
    overlay.classList.add("animate__fadeIn");
    // safety auto-hide in case navigation fails
    window._loaderSafetyTimer = setTimeout(() => {
      hideLoader(true);
    }, SAFETY_HIDE_MS);
  };

  window.hideLoader = function hideLoader(force) {
    const overlay = document.getElementById("loadingOverlay");
    if (!overlay) return;
    // if force = true we still run fadeOut; else if not visible skip
    overlay.classList.remove("animate__fadeIn");
    overlay.classList.add("animate__fadeOut");
    // clear safety timer
    clearTimeout(window._loaderSafetyTimer);
    setTimeout(() => {
      // only hide if still present (avoid overwriting a newly opened loader)
      if (overlay.classList.contains("animate__fadeOut")) {
        overlay.style.display = "none";
      }
    }, FADE_OUT_MS);
  };

  // helper to decide if an <a> should trigger loader
  function shouldShowForAnchor(a, evt) {
    if (!a) return false;
    const href = a.getAttribute("href");
    if (!href) return false;
    // skip pseudo/anchor links
    if (href.startsWith("#")) return false;
    if (href.startsWith("javascript:")) return false;
    if (href.startsWith("mailto:") || href.startsWith("tel:")) return false;
    // skip if using bootstrap toggles (modals, dropdowns, tabs) or other data-bs attributes
    if (
      a.hasAttribute("data-bs-toggle") ||
      a.hasAttribute("data-bs-target") ||
      a.hasAttribute("data-bs-dismiss")
    )
      return false;
    // skip if opening in new tab/window
    if (a.target && a.target.toLowerCase() === "_blank") return false;
    // skip when user uses modifier keys (open in new tab/window)
    if (evt && (evt.ctrlKey || evt.shiftKey || evt.metaKey || evt.altKey))
      return false;
    // skip non-left clicks (middle/right)
    if (evt && typeof evt.button === "number" && evt.button !== 0) return false;

    // skip same-page links where only hash would change
    try {
      const url = new URL(href, location.href);
      // If it's the same origin and same pathname/search, and only hash changes, skip
      if (
        url.origin === location.origin &&
        url.pathname === location.pathname &&
        url.search === location.search
      ) {
        return false;
      }
    } catch (err) {
      // If URL parsing fails, still continue (conservative)
    }

    return true;
  }

  document.addEventListener("DOMContentLoaded", function () {
    // Attach to form submissions
    document.addEventListener(
      "submit",
      function (evt) {
        const form = evt.target;
        if (!(form instanceof HTMLFormElement)) return;
        // If form has attribute data-no-loader, skip
        if (form.hasAttribute("data-no-loader")) return;
        // Show loader
        window.showLoader();
        // Note: do not call hideLoader here — the page will navigate away normally,
        // or AJAX handlers should call hideLoader when finished.
      },
      true
    ); // use capture to run early

    // Event delegation for clicks — catches dynamic anchors too
    document.addEventListener(
      "click",
      function (evt) {
        // if event already handled/ prevented, skip
        if (evt.defaultPrevented) return;

        const anchor = evt.target.closest("a");
        if (!anchor) return;

        // If anchor has data-no-loader, skip
        if (anchor.hasAttribute("data-no-loader")) return;

        if (shouldShowForAnchor(anchor, evt)) {
          // show loader and let the browser handle navigation
          window.showLoader();
        }
        // else do nothing
      },
      true
    );

    // Hide loader after this page fully loads (when coming back via navigation)
    window.addEventListener("load", function () {
      window.hideLoader();
    });

    // pageshow covers bfcache/back-forward load behavior
    window.addEventListener("pageshow", function () {
      window.hideLoader();
    });

    // If you want a demo button or class-based activation:
    document.querySelectorAll(".loaderBtn").forEach((btn) => {
      btn.addEventListener("click", function (evt) {
        // if button inside a form that will submit, submit handler already shows loader,
        // but for non-form buttons we show loader here.
        const form = btn.closest("form");
        if (!form) {
          window.showLoader();
        }
      });
    });
  });
})();
