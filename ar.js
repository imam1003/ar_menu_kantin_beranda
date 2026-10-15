(() => {
  const $ = (id) => document.getElementById(id);
  const scene = $("scene");
  const startButton = $("start-ar");
  const statusEl = $("status");
  const intro = $("intro");
  const controls = $("controls");
  const fallback = $("fallback");
  const reticle = $("reticle");
  const anchor = $("menu-anchor");
  const previewImage = $("preview-image");

  const menus = {
    drinks: { title: "Minuman 1", src: "assets/poster-minuman-1.png" },
    drinks2: { title: "Minuman 2", src: "assets/poster-minuman-2.png" },
    food: { title: "Makanan 1", src: "assets/poster-makanan-1.png" },
    food2: { title: "Makanan 2", src: "assets/poster-makanan-2.png" }
  };

  let xrSession = null;
  let hitTestSource = null;
  let viewerSpace = null;
  let localSpace = null;
  let lastHitMatrix = null;
  let placed = false;
  let currentCategory = "drinks";
  let posterPlane = null;
  let frameLoopRunning = false;

  function setStatus(message) { statusEl.textContent = message; }

  function showFallback(message) {
    intro.classList.add("hidden");
    controls.classList.add("hidden");
    fallback.classList.remove("hidden");
    if (message) fallback.querySelector("p").textContent = message;
  }

  function setActiveButtons(category) {
    document.querySelectorAll("[data-category]").forEach((button) => {
      button.classList.toggle("active", button.dataset.category === category);
    });
    document.querySelectorAll("[data-preview]").forEach((button) => {
      button.classList.toggle("active", button.dataset.preview === category);
    });
  }

  function updatePreview(category) {
    currentCategory = category;
    previewImage.src = menus[category].src;
    previewImage.alt = menus[category].title;
    setActiveButtons(category);
  }

  function makePoster() {
    if (posterPlane) {
      posterPlane.parentNode.removeChild(posterPlane);
      posterPlane = null;
    }
    const menu = menus[currentCategory];
    const img = document.createElement("a-image");
    img.setAttribute("src", menu.src);
    img.setAttribute("width", "0.72");
    img.setAttribute("height", "0.51");
    img.setAttribute("position", "0 0.015 0");
    img.setAttribute("rotation", "-90 0 0");
    img.setAttribute("material", "shader: flat; transparent: false; side: double");
    anchor.appendChild(img);
    posterPlane = img;
  }

  async function startAR() {
    if (!navigator.xr) {
      showFallback("Browser ini tidak menyediakan WebXR. Gunakan Chrome terbaru di Android dengan dukungan ARCore; pratinjau di bawah bukan AR.");
      return;
    }
    try {
      const supported = await navigator.xr.isSessionSupported("immersive-ar");
      if (!supported) {
        showFallback("Perangkat/browser ini tidak mendukung sesi WebXR immersive-ar. Pratinjau di bawah bukan AR.");
        return;
      }

      // Start only from this user gesture; the browser requires a user action.
      xrSession = await navigator.xr.requestSession("immersive-ar", {
        requiredFeatures: ["hit-test"],
        optionalFeatures: ["dom-overlay"],
        domOverlay: { root: $("app") }
      });

      await scene.renderer.xr.setSession(xrSession);
      viewerSpace = await xrSession.requestReferenceSpace("viewer");
      localSpace = await xrSession.requestReferenceSpace("local");
      hitTestSource = await xrSession.requestHitTestSource({ space: viewerSpace });

      // Hide A-Frame's ordinary page background so the immersive camera feed is visible.
      intro.classList.add("hidden");
      fallback.classList.add("hidden");
      controls.classList.remove("hidden");
      setStatus("AR aktif. Mencari permukaan meja…");
      anchor.setAttribute("visible", false);
      reticle.setAttribute("visible", false);
      placed = false;

      xrSession.addEventListener("end", cleanupAR);
      scene.renderer.setAnimationLoop(onXRFrame);
      frameLoopRunning = true;
    } catch (error) {
      console.error(error);
      setStatus("AR gagal dimulai: " + (error.message || error));
      if (xrSession) {
        try { await xrSession.end(); } catch (_) {}
      }
      showFallback("AR tidak berhasil dimulai. Pastikan situs HTTPS, Chrome terbaru, dan perangkat mendukung ARCore/WebXR hit-test. Pratinjau di bawah bukan AR.");
    }
  }

  function onXRFrame(time, frame) {
    if (!xrSession || !frame || !localSpace) return;
    const referenceSpace = scene.renderer.xr.getReferenceSpace() || localSpace;
    if (!placed && hitTestSource) {
      const hits = frame.getHitTestResults(hitTestSource);
      if (hits.length > 0) {
        const pose = hits[0].getPose(referenceSpace);
        if (pose) {
          lastHitMatrix = pose.transform.matrix;
          reticle.object3D.visible = true;
          reticle.object3D.matrix.fromArray(lastHitMatrix);
          reticle.object3D.matrixAutoUpdate = false;

          // Automatically place the menu at the first detected surface.
          anchor.object3D.visible = true;
          anchor.object3D.matrix.fromArray(lastHitMatrix);
          anchor.object3D.matrixAutoUpdate = false;
          makePoster();
          placed = true;
          reticle.setAttribute("visible", false);
          setStatus("Meja terdeteksi. Menu " + menus[currentCategory].title + " sudah ditempatkan.");
        }
      }
    }
    scene.renderer.render(scene.object3D, scene.camera);
  }

  async function endAR() {
    if (xrSession) {
      try { await xrSession.end(); } catch (error) { console.warn(error); }
    } else {
      cleanupAR();
    }
  }

  function cleanupAR() {
    if (scene.renderer) scene.renderer.setAnimationLoop(null);
    frameLoopRunning = false;
    if (hitTestSource) { try { hitTestSource.cancel(); } catch (_) {} }
    xrSession = null;
    hitTestSource = null;
    viewerSpace = null;
    localSpace = null;
    placed = false;
    anchor.object3D.matrixAutoUpdate = true;
    anchor.setAttribute("visible", false);
    reticle.object3D.matrixAutoUpdate = true;
    reticle.setAttribute("visible", false);
    controls.classList.add("hidden");
    intro.classList.remove("hidden");
    setStatus("AR selesai. Tekan Mulai kamera AR untuk mencoba lagi.");
  }

  function resetPlacement() {
    placed = false;
    anchor.setAttribute("visible", false);
    anchor.object3D.matrixAutoUpdate = true;
    reticle.setAttribute("visible", false);
    setStatus("Mencari meja lagi… arahkan kamera ke permukaan datar.");
  }

  document.querySelectorAll("[data-category]").forEach((button) => {
    button.addEventListener("click", () => {
      currentCategory = button.dataset.category;
      setActiveButtons(currentCategory);
      if (placed) {
        makePoster();
        setStatus("Menu diganti: " + menus[currentCategory].title + ".");
      }
    });
  });
  document.querySelectorAll("[data-preview]").forEach((button) => {
    button.addEventListener("click", () => updatePreview(button.dataset.preview));
  });

  startButton.addEventListener("click", startAR);
  $("exit-ar").addEventListener("click", endAR);
  $("reset-placement").addEventListener("click", resetPlacement);

  // Avoid claiming AR works before checking the platform.
  (async () => {
    if (!navigator.xr) {
      setStatus("WebXR tidak tersedia pada browser ini. Anda tetap dapat melihat pratinjau menu.");
      return;
    }
    try {
      const ok = await navigator.xr.isSessionSupported("immersive-ar");
      setStatus(ok ? "WebXR AR terdeteksi. Tekan Mulai kamera AR." :
        "Sesi AR belum didukung browser/perangkat ini. Tekan Mulai untuk melihat pilihan alternatif.");
    } catch (_) {
      setStatus("Tidak dapat memeriksa dukungan AR. Pastikan situs menggunakan HTTPS.");
    }
  })();

  // A-Frame's canvas must be initialized before setSession is called.
  scene.addEventListener("renderstart", () => {
    if (!scene.renderer) setStatus("Menyiapkan renderer AR…");
  });
})();