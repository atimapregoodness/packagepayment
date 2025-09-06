document.addEventListener("DOMContentLoaded", function () {
  function showLoader() {
    const overlay = document.getElementById("loadingOverlay");
    overlay.style.display = "flex";
    overlay.classList.remove("animate__fadeOut");
    overlay.classList.add("animate__fadeIn");
  }

  function hideLoader() {
    const overlay = document.getElementById("loadingOverlay");
    overlay.classList.remove("animate__fadeIn");
    overlay.classList.add("animate__fadeOut");
    setTimeout(() => (overlay.style.display = "none"), 500); // delay until fadeOut finishes
  }

  // Attach loader to all forms automatically

  document.querySelectorAll("form").forEach((form) => {
    form.addEventListener("submit", function () {
      showLoader();
    });
  });
});
