]
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const scene = $("scene");
  const startButton = $("start-ar");
  const statusEl = $("status");
  const intro = $("intro");
  const controls = $("controls");
  const fallback = $("fallback");
  const fallbackMessage = $("fallback-message");
  const reticle = $("reticle");
  const anchor = $("menu-anchor");
  const previewImage = $("preview-image");

  const menus = {
    drinks: {
      title: "Minuman 1",
      src: "poster-minuman-1.png"
    },
    drinks2: {
      title: "Minuman 2",
      src: "poster-minuman-2.png"
    },
    food: {
      title: "Makanan 1",
      src: "poster-makanan-1.png"
    },
    food2: {
      title: "Makanan 2",
      src: "poster-makanan-2.png"
    }
  };

  let xrSession = null;
  let hitTestSource = null;
  let viewerSpace = null;
  let localSpace = null;
  let lastHitMatrix = null;
  let placed = false;
  let currentCategory = "drinks";
  let posterPlane = null;
  let sessionStarting = false;

  function setStatus(message) {
    statusEl.textContent = message;
  }

  function showFallback(message) {
    intro.classList.add("hidden");
    controls.classList.add("hidden");
    fallback.classList.remove("hidden");

    if (message) {
      fallbackMessage.textContent = message;
    }

    updatePreview(currentCategory);
  }

  function setActiveButtons(category) {
    document.querySelectorAll("[data-category]").forEach((button) => {
      button.classList.toggle(
        "active",
        button.dataset.category === category
      );
    });

    document.querySelectorAll("[data-preview]").forEach((button) => {
      button.classList.toggle(
        "active",
        button.dataset.preview === category
      );
    });
  }

  function updatePreview(category) {
    if (!menus[category]) return;

    currentCategory = category;
    previewImage.src = menus[category].src;
    previewImage.alt = menus[category].title;
    setActiveButtons(category);
  }

  function removePoster() {
    if (posterPlane && posterPlane.parentNode) {
      posterPlane.parentNode.removeChild(posterPlane);
    }

    posterPlane = null;
  }

  function makePoster() {
    removePoster();

    const menu = menus[currentCategory];
    const image = document.createElement("a-image");

    image.setAttribute("src", menu.src);
    image.setAttribute("width", "0.72");
    image.setAttribute("height", "0.51");
    image.setAttribute("position", "0 0.015 0");
    image.setAttribute("rotation", "-90 0 0");
    image.setAttribute(
      "material",
      "shader: flat; side: double; transparent: false"
    );

    anchor.appendChild(image);
    posterPlane = image;
  }

  function setObjectMatrix(entity, matrixArray) {
    entity.object3D.matrix.fromArray(matrixArray);
    entity.object3D.matrixAutoUpdate = false;
    entity.object3D.matrixWorldNeedsUpdate = true;
    entity.object3D.visible = true;
  }

  async function startAR() {
    if (sessionStarting || xrSession) return;

    if (!navigator.xr) {
      showFallback(
        "WebXR tidak tersedia di browser ini. Gunakan Chrome Android dan perangkat yang mendukung ARCore."
      );
      return;
    }

    sessionStarting = true;
    startButton.disabled = true;
    setStatus("Menyiapkan kamera AR…");

    try {
      const supported =
        await navigator.xr.isSessionSupported("immersive-ar");

      if (!supported) {
        showFallback(
          "Sesi immersive-ar tidak didukung saat ini. Pratinjau di bawah bukan AR."
        );
        return;
      }

      // Pastikan A-Frame telah membuat renderer.
      if (!scene.renderer) {
        await new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            reject(new Error("Renderer A-Frame belum siap."));
          }, 10000);

          scene.addEventListener("renderstart", () => {
            clearTimeout(timer);
            resolve();
          }, { once: true });

          if (scene.renderer) {
            clearTimeout(timer);
            resolve();
          }
        });
      }

      // Permintaan sesi dilakukan setelah pengguna menekan tombol.
      xrSession = await navigator.xr.requestSession("immersive-ar", {
        requiredFeatures: ["hit-test"],
        optionalFeatures: ["dom-overlay"],
        domOverlay: { root: $("app") }
      });

      await scene.renderer.xr.setSession(xrSession);

      viewerSpace = await xrSession.requestReferenceSpace("viewer");
      localSpace = await xrSession.requestReferenceSpace("local");

      hitTestSource = await xrSession.requestHitTestSource({
        space: viewerSpace
      });

      lastHitMatrix = null;
      placed = false;

      anchor.object3D.visible = false;
      anchor.object3D.matrixAutoUpdate = true;

      reticle.object3D.visible = false;
      reticle.object3D.matrixAutoUpdate = true;

      intro.classList.add("hidden");
      fallback.classList.add("hidden");
      controls.classList.remove("hidden");

      setStatus(
        "AR aktif. Gerakkan HP perlahan ke arah meja sampai penanda muncul."
      );

      xrSession.addEventListener("select", onXRSelect);
      xrSession.addEventListener("end", cleanupAR);

      // Satu loop XR: perbarui objek dan render melalui A-Frame.
      scene.renderer.setAnimationLoop(onXRFrame);

    } catch (error) {
      console.error("Gagal memulai AR:", error);

      const message = error && error.message
        ? error.message
        : String(error);

      if (xrSession) {
        try {
          await xrSession.end();
        } catch (_) {
          // Sesi mungkin sudah berakhir.
        }
      }

      cleanupAR();

      showFallback(
        "AR gagal dimulai: " + message +
        ". Pastikan situs HTTPS dan izin kamera tersedia. Pratinjau bukan AR."
      );
    } finally {
      sessionStarting = false;
      startButton.disabled = false;
    }
  }

  function onXRFrame(time, frame) {
    if (!xrSession || !frame || !localSpace) return;

    try {
      if (!placed && hitTestSource) {
        const hits = frame.getHitTestResults(hitTestSource);

        if (hits.length > 0) {
          const pose = hits[0].getPose(localSpace);

          if (pose) {
            lastHitMatrix = Array.from(pose.transform.matrix);
            setObjectMatrix(reticle, lastHitMatrix);
          }
        } else {
          lastHitMatrix = null;
          reticle.object3D.visible = false;
        }
      }

      // Pertahankan siklus pembaruan A-Frame dan renderer XR.
      scene.tick(time, frame);
      scene.render(time, frame);

    } catch (error) {
      console.error("Kesalahan frame AR:", error);
    }
  }

  function onXRSelect() {
    if (!xrSession || placed || !lastHitMatrix) {
      if (!placed) {
        setStatus(
          "Permukaan belum terdeteksi. Arahkan kamera ke meja dan gerakkan HP perlahan."
        );
      }
      return;
    }

    setObjectMatrix(anchor, lastHitMatrix);
    makePoster();

    placed = true;
    reticle.object3D.visible = false;

    setStatus(
      "Menu " + menus[currentCategory].title +
      " sudah ditempatkan. Gunakan tombol kategori untuk mengganti menu."
    );
  }

  function resetPlacement() {
    if (!xrSession) return;

    placed = false;
    lastHitMatrix = null;

    removePoster();

    anchor.object3D.visible = false;
    anchor.object3D.matrixAutoUpdate = true;

    reticle.object3D.visible = false;
    reticle.object3D.matrixAutoUpdate = true;

    setStatus(
      "Cari permukaan meja lagi. Tunggu penanda muncul, lalu ketuk layar."
    );
  }

  async function endAR() {
    if (!xrSession) {
      cleanupAR();
      return;
    }

    try {
      await xrSession.end();
    } catch (error) {
      console.warn("Sesi AR sudah berakhir:", error);
      cleanupAR();
    }
  }

  function cleanupAR() {
    const oldSession = xrSession;

    if (oldSession) {
      oldSession.removeEventListener("select", onXRSelect);
      oldSession.removeEventListener("end", cleanupAR);
    }

    if (hitTestSource) {
      try {
        hitTestSource.cancel();
      } catch (_) {
        // Hit-test mungkin sudah dihentikan.
      }
    }

    xrSession = null;
    hitTestSource = null;
    viewerSpace = null;
    localSpace = null;
    lastHitMatrix = null;
    placed = false;

    if (scene.renderer) {
      // Hentikan loop XR setelah sesi immersive berakhir.
      scene.renderer.setAnimationLoop(null);
    }

    removePoster();

    anchor.object3D.visible = false;
    anchor.object3D.matrixAutoUpdate = true;

    reticle.object3D.visible = false;
    reticle.object3D.matrixAutoUpdate = true;

    controls.classList.add("hidden");
    intro.classList.remove("hidden");

    if (fallback.classList.contains("hidden")) {
      setStatus("AR selesai. Tekan Mulai kamera AR untuk mencoba lagi.");
    }
  }

  document.querySelectorAll("[data-category]").forEach((button) => {
    button.addEventListener("click", () => {
      const category = button.dataset.category;

      if (!menus[category]) return;

      currentCategory = category;
      setActiveButtons(category);

      if (placed) {
        makePoster();

        setStatus(
          "Menu diganti: " + menus[currentCategory].title + "."
        );
      }
    });
  });

  document.querySelectorAll("[data-preview]").forEach((button) => {
    button.addEventListener("click", () => {
      updatePreview(button.dataset.preview);
    });
  });

  startButton.addEventListener("click", startAR);
  $("exit-ar").addEventListener("click", endAR);
  $("reset-placement").addEventListener("click", resetPlacement);

  previewImage.addEventListener("error", () => {
    console.error("Gambar pratinjau gagal dimuat:", previewImage.src);
  });

  // Periksa dukungan awal tanpa meminta izin kamera.
  (async () => {
    if (!navigator.xr) {
      setStatus(
        "WebXR tidak tersedia di browser ini. Pratinjau menu tetap bisa dibuka."
      );
      return;
    }

    try {
      const supported =
        await navigator.xr.isSessionSupported("immersive-ar");

      setStatus(
        supported
          ? "Dukungan WebXR AR terdeteksi. Tekan Mulai kamera AR."
          : "Sesi AR belum didukung. Kamu masih bisa melihat pratinjau menu."
      );
    } catch (error) {
      setStatus(
        "Tidak dapat memeriksa dukungan AR. Pastikan situs menggunakan HTTPS."
      );
    }
  })();

})();
