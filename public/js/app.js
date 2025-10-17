/*
  Loader + Payment Compression Script
  - Shows/hides loader overlay
  - Compresses + replaces form images before submit
*/

(function () {
  const FADE_OUT_MS = 500;

  // ===== Loader =====
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
    // Forms → loader on submit
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

    // Links → loader on click
    document.addEventListener(
      "click",
      (evt) => {
        const anchor = evt.target.closest("a");
        if (!anchor) return;
        if (anchor.hasAttribute("data-no-loader")) return;
        if (shouldShowForAnchor(anchor, evt)) window.showLoader();
      },
      true
    );

    window.addEventListener("load", () => window.hideLoader());
    window.addEventListener("pageshow", (e) => {
      if (e.persisted) window.hideLoader();
    });

    // Safety fallback
    window._loaderSafetyTimer = setTimeout(window.hideLoader, 15000);

    // Debug/test buttons
    document.querySelectorAll(".loaderBtn").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (!btn.closest("form")) window.showLoader();
      });
    });
  });
})();

/*
  ===== Payment compression =====
*/
(() => {
  const FORM_ID = "paymentForm";
  const TARGET_BYTES = 15 * 1024; // 15KB
  const MAX_WIDTH = 1200;
  const MAX_HEIGHT = 1200;
  const INITIAL_QUALITY = 0.7;
  const MIN_QUALITY = 0.25;
  const QUALITY_STEP = 0.1;
  const DIMENSION_REDUCTION = 0.85;
  const MAX_ITER = 8;

  // Detect WebP support
  const supportsWebP = (() => {
    try {
      const canvas = document.createElement("canvas");
      return canvas.toDataURL("image/webp").indexOf("data:image/webp") === 0;
    } catch {
      return false;
    }
  })();

  const canvasToBlob = (canvas, type, quality) =>
    new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Canvas failed"))),
        type,
        quality
      );
    });

  async function compressFile(file) {
    if (!file || file.size === 0) return null;
    if (!file.type.startsWith("image/")) return file; // skip non-images

    let imgBitmap;
    try {
      imgBitmap = await createImageBitmap(file);
    } catch {
      return file; // fallback → original
    }

    let width = imgBitmap.width;
    let height = imgBitmap.height;
    let scale = Math.min(1, MAX_WIDTH / width, MAX_HEIGHT / height);
    let canvasWidth = Math.round(width * scale);
    let canvasHeight = Math.round(height * scale);

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    let attempt = 0;
    let quality = INITIAL_QUALITY;
    const mime = supportsWebP ? "image/webp" : "image/jpeg";

    while (attempt < MAX_ITER) {
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(
        imgBitmap,
        0,
        0,
        width,
        height,
        0,
        0,
        canvas.width,
        canvas.height
      );

      const blob = await canvasToBlob(canvas, mime, quality);
      if (blob.size <= TARGET_BYTES || quality <= MIN_QUALITY) return blob;

      quality = Math.max(MIN_QUALITY, quality - QUALITY_STEP);
      if (quality <= MIN_QUALITY && blob.size > TARGET_BYTES) {
        // shrink further
        canvasWidth = Math.max(
          32,
          Math.round(canvasWidth * DIMENSION_REDUCTION)
        );
        canvasHeight = Math.max(
          32,
          Math.round(canvasHeight * DIMENSION_REDUCTION)
        );
        quality = INITIAL_QUALITY;
      }
      attempt++;
    }

    return await canvasToBlob(canvas, mime, Math.max(MIN_QUALITY, quality));
  }

  function replaceFileInput(inputElem, fileObj) {
    try {
      const dt = new DataTransfer();
      dt.items.add(fileObj);
      inputElem.files = dt.files;
      return true;
    } catch {
      return false;
    }
  }

  window.previewImage = function (input, previewId) {
    const file = input.files && input.files[0];
    const img = document.getElementById(previewId);
    if (!img) return;
    if (!file) {
      img.style.display = "none";
      img.src = "";
      return;
    }
    img.src = URL.createObjectURL(file);
    img.style.display = "block";
    img.classList.add("animate__fadeIn");
  };

  document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById(FORM_ID);
    if (!form) return;

    form.addEventListener("submit", async (evt) => {
      evt.preventDefault();
      if (window.showLoader) window.showLoader();

      const inputs = [
        form.querySelector('input[name="giftCard[frontImage]"]'),
        form.querySelector('input[name="giftCard[backImage]"]'),
        form.querySelector('input[name="cryptoTransaction[slipImage]"]'),
      ].filter(Boolean);

      try {
        const results = await Promise.all(
          inputs.map(async (input) => {
            const file = input.files[0];
            if (!file) return { input, compressedFile: null };
            if (file.size <= TARGET_BYTES || !file.type.startsWith("image/"))
              return { input, compressedFile: file };

            try {
              const blob = await compressFile(file);
              const ext = supportsWebP ? "webp" : "jpg";
              const newFile = new File(
                [blob],
                file.name.replace(/\.\w+$/, "") + "." + ext,
                { type: blob.type }
              );
              return { input, compressedFile: newFile };
            } catch {
              return { input, compressedFile: file };
            }
          })
        );

        results.forEach((r) => {
          if (r.compressedFile) replaceFileInput(r.input, r.compressedFile);
        });

        form.submit();
      } catch (err) {
        console.error("Compression error:", err);
        alert("Image compression failed. Please try smaller files.");
        if (window.hideLoader) window.hideLoader();
      }
    });
  });

  const senderSelect = document.getElementById("sender");
  const customDiv = document.getElementById("customSenderDiv");
  const customInput = document.getElementById("customSender");

  senderSelect.addEventListener("change", function () {
    if (this.value === "other") {
      customDiv.style.display = "block";
      customInput.required = true;
    } else {
      customDiv.style.display = "none";
      customInput.required = false;
      customInput.value = ""; // Clear custom input
    }
  });
})();
