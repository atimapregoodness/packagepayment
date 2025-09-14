/*
  payment.js
  Handles client-side image compression + preview
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
  let supportsWebP = true;
  (() => {
    try {
      const canvas = document.createElement("canvas");
      supportsWebP =
        canvas.toDataURL("image/webp").indexOf("data:image/webp") === 0;
    } catch {
      supportsWebP = false;
    }
  })();

  function canvasToBlob(canvas, type, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Canvas toBlob failed"));
        },
        type,
        quality
      );
    });
  }

  async function compressFile(file) {
    if (!file || file.size === 0) return null;

    let imgBitmap;
    try {
      imgBitmap = await createImageBitmap(file);
    } catch {
      return file; // fallback
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
    let mime = supportsWebP ? "image/webp" : "image/jpeg";

    while (attempt < MAX_ITER) {
      canvas.width = canvasHeight ? canvasWidth : width;
      canvas.height = canvasHeight ? canvasHeight : height;
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
      if (blob.size <= TARGET_BYTES || quality <= MIN_QUALITY) {
        return blob;
      }

      quality = Math.max(MIN_QUALITY, quality - QUALITY_STEP);
      if (quality <= MIN_QUALITY && blob.size > TARGET_BYTES) {
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

  // Image preview
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
            if (file.size <= TARGET_BYTES)
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
        alert("Image compression failed. Please try smaller files.");
        if (window.hideLoader) window.hideLoader();
      }
    });
  });
})();
