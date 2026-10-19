import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js";

const statusText = document.querySelector("#status");
const startButton = document.querySelector("#start-ar");
const photoInput = document.querySelector("#photo-file");
const posterOptions = [...document.querySelectorAll(".poster-option")];

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
    70,
    window.innerWidth / window.innerHeight,
    0.01,
    20
);
const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true
});

renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 0);
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType("local");
document.body.appendChild(renderer.domElement);

const reticle = new THREE.Group();
const reticleRing = new THREE.Mesh(
    new THREE.RingGeometry(0.08, 0.1, 32),
    new THREE.MeshBasicMaterial({ color: 0x20ff90 })
);
reticleRing.rotation.x = -Math.PI / 2;
reticle.add(reticleRing);
reticle.matrixAutoUpdate = false;
reticle.visible = false;
scene.add(reticle);

const photoMaterial = new THREE.MeshBasicMaterial({
    side: THREE.DoubleSide,
    transparent: true
});
const photo = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), photoMaterial);
const posterTilt = -THREE.MathUtils.degToRad(12);
photo.rotation.x = posterTilt;
const photoPlacement = new THREE.Group();
photoPlacement.add(photo);
photoPlacement.visible = false;
scene.add(photoPlacement);

let currentPhotoUrl;
let hitTestSource;
let photoReady = false;
let photoLoadId = 0;

function loadPhoto(url, label) {
    const loadId = ++photoLoadId;
    photoReady = false;
    photoPlacement.visible = false;
    startButton.disabled = true;
    statusText.textContent = `Memuat ${label}...`;

    new THREE.TextureLoader().load(
        url,
        (texture) => {
            if (loadId !== photoLoadId) {
                texture.dispose();
                return;
            }
            texture.colorSpace = THREE.SRGBColorSpace;
            if (photoMaterial.map) {
                photoMaterial.map.dispose();
            }
            photoMaterial.map = texture;
            photoMaterial.needsUpdate = true;

            const aspectRatio = texture.image.width / texture.image.height;
            if (aspectRatio >= 1) {
                photo.scale.set(0.8, 0.8 / aspectRatio, 1);
            } else {
                photo.scale.set(0.8 * aspectRatio, 0.8, 1);
            }
            photoReady = true;
            startButton.disabled = false;
            statusText.textContent = `${label} siap. Tekan Mulai AR.`;
        },
        undefined,
        () => {
            if (loadId === photoLoadId) {
                startButton.disabled = true;
                statusText.textContent = `${label} tidak dapat dimuat. Coba pilih foto lain.`;
            }
        }
    );
}

function selectPoster(url, label) {
    if (currentPhotoUrl) {
        URL.revokeObjectURL(currentPhotoUrl);
        currentPhotoUrl = undefined;
    }
    photoInput.value = "";
    posterOptions.forEach((option) => {
        const selected = option.dataset.photo === url;
        option.setAttribute("aria-pressed", String(selected));
    });
    loadPhoto(url, label);
}

posterOptions.forEach((option) => {
    option.addEventListener("click", () => {
        selectPoster(option.dataset.photo, option.querySelector("span").textContent);
    });
});

selectPoster(posterOptions[0].dataset.photo, "Makanan 1");

photoInput.addEventListener("change", () => {
    const file = photoInput.files?.[0];
    if (!file) {
        return;
    }

    if (currentPhotoUrl) {
        URL.revokeObjectURL(currentPhotoUrl);
    }
    currentPhotoUrl = URL.createObjectURL(file);
    posterOptions.forEach((option) => option.setAttribute("aria-pressed", "false"));
    loadPhoto(currentPhotoUrl, file.name);
});

const controller = renderer.xr.getController(0);
controller.addEventListener("select", () => {
    if (!reticle.visible || !photoReady) {
        return;
    }

    const surfacePosition = new THREE.Vector3().setFromMatrixPosition(reticle.matrix);
    const xrCamera = renderer.xr.getCamera(camera);
    const cameraPosition = xrCamera.getWorldPosition(new THREE.Vector3());
    const towardCamera = cameraPosition.sub(surfacePosition);
    towardCamera.y = 0;

    if (towardCamera.lengthSq() > 0) {
        const yaw = Math.atan2(towardCamera.x, towardCamera.z);
        const facingCamera = new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(0, 1, 0),
            yaw
        );
        const leaningBack = new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(1, 0, 0),
            posterTilt
        );

        photoPlacement.quaternion.copy(facingCamera).multiply(leaningBack);
    }

    surfacePosition.y += photo.scale.y * Math.cos(posterTilt) / 2;
    photoPlacement.position.copy(surfacePosition);
    photoPlacement.visible = true;
});
scene.add(controller);

renderer.setAnimationLoop((_, frame) => {
    if (frame && hitTestSource) {
        const referenceSpace = renderer.xr.getReferenceSpace();
        const hit = frame.getHitTestResults(hitTestSource)[0];
        if (hit && referenceSpace) {
            const pose = hit.getPose(referenceSpace);
            if (pose) {
                reticle.visible = true;
                reticle.matrix.fromArray(pose.transform.matrix);
            }
        } else {
            reticle.visible = false;
        }
    }
    renderer.render(scene, camera);
});

startButton.addEventListener("click", async () => {
    if (!photoReady) {
        statusText.textContent = "Tunggu sampai foto selesai dimuat.";
        return;
    }

    if (!navigator.xr) {
        statusText.textContent = "Browser ini belum mendukung WebXR AR. Coba Chrome di perangkat Android yang mendukung AR.";
        return;
    }

    try {
        const supported = await navigator.xr.isSessionSupported("immersive-ar");
        if (!supported) {
            statusText.textContent = "Perangkat ini belum mendukung mode AR.";
            return;
        }

        const session = await navigator.xr.requestSession("immersive-ar", {
            requiredFeatures: ["hit-test"],
            optionalFeatures: ["dom-overlay"],
            domOverlay: { root: document.body }
        });
        await renderer.xr.setSession(session);

        const viewerSpace = await session.requestReferenceSpace("viewer");
        hitTestSource = await session.requestHitTestSource({ space: viewerSpace });
        photoPlacement.visible = false;
        reticle.visible = false;
        statusText.textContent = "Gerakkan perangkat perlahan untuk mencari lantai atau meja.";
        session.addEventListener("end", () => {
            hitTestSource?.cancel();
            hitTestSource = undefined;
            reticle.visible = false;
            statusText.textContent = "Sesi AR selesai. Tekan Mulai AR untuk mencoba lagi.";
        }, { once: true });
    } catch (error) {
        statusText.textContent = `AR gagal dimulai: ${String(error)}`;
    }
});

window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
