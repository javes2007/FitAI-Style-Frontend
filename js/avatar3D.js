    import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.161/build/three.module.js';
    import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.161/examples/jsm/controls/OrbitControls.js';

    // =========================================================
    // CONFIGURACIÓN
    // =========================================================

    const API_URL =
        (window.location.protocol === "file:" ||
         window.location.hostname === "" ||
         window.location.hostname === "localhost" ||
         window.location.hostname === "127.0.0.1")
            ? "http://localhost:5000/api"
            : "/api";

    // =========================================================
    // THREE.JS
    // =========================================================

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(
        45,
        1,
        0.1,
        100
    );

    camera.position.set(3, 2.2, 7);

    const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true
    });

    renderer.setPixelRatio(
        Math.min(window.devicePixelRatio, 2)
    );

    renderer.shadowMap.enabled = true;

    document
        .querySelector("#scene")
        .appendChild(renderer.domElement);

    const controls = new OrbitControls(
        camera,
        renderer.domElement
    );

    controls.enableDamping = true;
    controls.target.set(0, 1.8, 0);

    // =========================================================
    // ILUMINACIÓN
    // =========================================================

    scene.add(
        new THREE.HemisphereLight(
            0x9bdcff,
            0x07101a,
            2
        )
    );

    const light = new THREE.PointLight(
        0x55caff,
        18,
        15
    );

    light.position.set(3, 5, 5);
    scene.add(light);

    const rim = new THREE.PointLight(
        0x3366ff,
        12,
        12
    );

    rim.position.set(-4, 3, -3);
    scene.add(rim);

    // =========================================================
    // AVATAR
    // =========================================================

    const avatar = new THREE.Group();

    scene.add(avatar);

    const mats = {};

    mats.skin = new THREE.MeshStandardMaterial({
        color: 0xd8a98e,
        roughness: 0.65
    }
    );

    mats.suit = new THREE.MeshStandardMaterial({
        color: 0x101827,
        metalness: 0.45,
        roughness: 0.3
    });

    mats.neon = new THREE.MeshStandardMaterial({
        color: 0x20bfff,
        emissive: 0x087dff,
        emissiveIntensity: 3
    });

    mats.hair = new THREE.MeshStandardMaterial({
        color: 0x17141c,
        roughness: 0.4
    });

    mats.shoe = new THREE.MeshStandardMaterial({
        color: 0x0b1018,
        metalness: 0.7,
        roughness: 0.2
    });

    function mesh(geometry, material) {

        const object = new THREE.Mesh(
            geometry,
            material
        );

        object.castShadow = true;
        object.receiveShadow = true;

        return object;
    }

    function capsule(radius, length, material) {

        return mesh(
            new THREE.CapsuleGeometry(
                radius,
                length,
                8,
                16
            ),
            material
        );
    }

    // =========================================================
    // CONSTRUIR AVATAR
    // =========================================================

    function build() {

        avatar.clear();

        const height =
            Number(
                document.querySelector("#height").value
            );

        const shoulder =
            Number(
                document.querySelector("#shoulder").value
            ) / 50;

        const waist =
            Number(
                document.querySelector("#waist").value
            ) / 50;

        const body =
            Number(
                document.querySelector("#body").value
            ) / 50;

        const face =
            Number(
                document.querySelector("#face").value
            ) / 50;

        const eyes =
            Number(
                document.querySelector("#eyes").value
            ) / 50;

        // Escala general
        const s = height / 168;

        // =====================================================
        // CADERA
        // =====================================================

        const hips = capsule(
            0.38 * body,
            0.48,
            mats.suit
        );

        hips.scale.set(
            waist * 0.9,
            1,
            1
        );

        hips.position.y = 1.15;

        avatar.add(hips);

        // =====================================================
        // TORSO
        // =====================================================

        const torso = capsule(
            0.58 * body,
            0.75,
            mats.suit
        );

        torso.scale.set(
            shoulder,
            1,
            0.62
        );

        torso.position.y = 2.05;

        avatar.add(torso);

        // =====================================================
        // CUELLO
        // =====================================================

        const neck = capsule(
            0.15,
            0.22,
            mats.skin
        );

        neck.position.y = 2.78;

        avatar.add(neck);

        // =====================================================
        // CABEZA
        // =====================================================

        const head = mesh(
            new THREE.SphereGeometry(
                0.48 * face,
                32,
                20
            ),
            mats.skin
        );

        head.scale.y = 1.12;

        head.position.y = 3.35;

        avatar.add(head);

        // =====================================================
        // CABELLO
        // =====================================================

        const hairTop = mesh(
            new THREE.SphereGeometry(
                0.51 * face,
                32,
                20
            ),
            mats.hair
        );

        hairTop.scale.set(
            1,
            1.05,
            1
        );

        hairTop.position.set(
            0,
            3.45,
            0.02
        );

        avatar.add(hairTop);

        const hairStyle =
            Number(window._hair || 0);

        if (hairStyle === 0) {

            const h = capsule(
                0.28,
                0.9,
                mats.hair
            );

            h.scale.set(
                1,
                1,
                0.7
            );

            h.position.set(
                -0.38,
                3.05,
                -0.02
            );

            h.rotation.z = 0.1;

            avatar.add(h);
        }

        if (hairStyle === 2) {

            const h = capsule(
                0.16,
                0.65,
                mats.hair
            );

            h.position.set(
                0,
                2.72,
                -0.28
            );

            avatar.add(h);
        }

        // =====================================================
        // OJOS
        // =====================================================

        for (const x of [-0.17, 0.17]) {

            const eye = mesh(
                new THREE.SphereGeometry(
                    0.055 * eyes,
                    16,
                    10
                ),
                mats.neon
            );

            eye.position.set(
                x,
                3.4,
                0.45
            );

            avatar.add(eye);
        }

        // =====================================================
        // BRAZOS
        // =====================================================

        for (const x of [-1, 1]) {

            const arm = capsule(
                0.17,
                0.85,
                mats.suit
            );

            arm.position.set(
                x * 0.73 * shoulder,
                2.18,
                0
            );

            arm.rotation.z =
                x * 0.12;

            avatar.add(arm);

            const fore = capsule(
                0.14,
                0.72,
                mats.skin
            );

            fore.position.set(
                x * 0.88 * shoulder,
                1.55,
                0.02
            );

            fore.rotation.z =
                x * 0.16;

            avatar.add(fore);

            const hand = mesh(
                new THREE.SphereGeometry(
                    0.15,
                    16,
                    12
                ),
                mats.skin
            );

            hand.position.set(
                x * 0.98 * shoulder,
                1.1,
                0.03
            );

            avatar.add(hand);
        }

        // =====================================================
        // PIERNAS
        // =====================================================

        for (const x of [-1, 1]) {

            const thigh = capsule(
                0.22,
                0.95,
                mats.suit
            );

            thigh.position.set(
                x * 0.24 * waist,
                0.55,
                0
            );

            avatar.add(thigh);

            const boot = capsule(
                0.18,
                0.75,
                mats.shoe
            );

            boot.position.set(
                x * 0.24 * waist,
                -0.35,
                0.05
            );

            avatar.add(boot);

            const glow = mesh(
                new THREE.BoxGeometry(
                    0.04,
                    0.5,
                    0.03
                ),
                mats.neon
            );

            glow.position.set(
                x * 0.24 * waist +
                0.16 * x,
                -0.35,
                0.2
            );

            avatar.add(glow);
        }

        avatar.scale.setScalar(s);

        avatar.position.y = 0.45;
    }

    // =========================================================
    // REDIMENSIONAR
    // =========================================================

    function resize() {

        const container =
            document.querySelector("#scene");

        const width =
            container.clientWidth;

        const height =
            container.clientHeight;

        camera.aspect =
            width / height;

        camera.updateProjectionMatrix();

        renderer.setSize(
            width,
            height
        );
    }

    window.addEventListener(
        "resize",
        resize
    );

    resize();

    // =========================================================
    // ANIMACIÓN
    // =========================================================

    function animate() {

        requestAnimationFrame(
            animate
        );

        controls.update();

        renderer.render(
            scene,
            camera
        );
    }

    animate();

    // =========================================================
    // SLIDERS
    // =========================================================

    [
        "height",
        "body",
        "shoulder",
        "waist",
        "face",
        "eyes"
    ].forEach(id => {

        const element =
            document.getElementById(id);

        const output =
            document.getElementById(
                id + "V"
            );

        element.addEventListener(
            "input",
            () => {

                output.textContent =
                    element.value;

                build();
            }
        );
    });

    // =========================================================
    // CABELLO
    // =========================================================

    window.hair = (
        number,
        element
    ) => {

        window._hair = number;

        document
            .querySelectorAll(".chip")
            .forEach(chip => {
                chip.classList.remove(
                    "active"
                );
            });

        element.classList.add(
            "active"
        );

        build();
    };

    // =========================================================
    // VISTAS
    // =========================================================

    window.view = value => {

        if (value === "front") {

            camera.position.set(
                0,
                2.3,
                7
            );
        }

        if (value === "side") {

            camera.position.set(
                7,
                2.3,
                0
            );
        }

        if (value === "back") {

            camera.position.set(
                0,
                2.3,
                -7
            );
        }

        controls.target.set(
            0,
            1.8,
            0
        );
    };

    // =========================================================
    // RESTABLECER
    // =========================================================

    window.resetAvatar = () => {

        const valores = {
            height: "168",
            body: "50",
            shoulder: "50",
            waist: "50",
            face: "50",
            eyes: "50"
        };

        Object.entries(valores)
            .forEach(([id, value]) => {

                document
                    .getElementById(id)
                    .value = value;

                document
                    .getElementById(id + "V")
                    .textContent = value;
            });

        window._hair = 0;

        build();
    };

    // =========================================================
    // EXPORTAR
    // =========================================================

    window.downloadInfo = () => {

        const data = {

            altura:
                document.querySelector("#height").value,

            proporcion:
                document.querySelector("#body").value,

            hombros:
                document.querySelector("#shoulder").value,

            cintura:
                document.querySelector("#waist").value,

            rostro:
                document.querySelector("#face").value,

            ojos:
                document.querySelector("#eyes").value,

            cabello:
                window._hair || 0
        };

        const blob =
            new Blob(
                [
                    JSON.stringify(
                        data,
                        null,
                        2
                    )
                ],
                {
                    type:
                        "application/json"
                }
            );

        const url =
            URL.createObjectURL(blob);

        const a =
            document.createElement("a");

        a.href = url;

        a.download =
            "avatar-config.json";

        a.click();

        URL.revokeObjectURL(url);
    };

    // =========================================================
    // FOTO + MEDIAPIPE
    // =========================================================

    const photoInput =
        document.getElementById(
            "photoInput"
        );

    photoInput.addEventListener(
        "change",
        async event => {

            const file =
                event.target.files[0];

            if (!file) {
                return;
            }

            // Mostrar fotografía
            const img =
                document.getElementById(
                    "photo"
                );

            img.src =
                URL.createObjectURL(file);

            img.style.display =
                "block";

            // Estado: analizando
            const status =
                document.getElementById(
                    "photoStatus"
                );

            status.textContent =
                "⏳ Analizando tu foto y calculando proporciones...";

            status.className =
                "photo-status is-loading";

            try {

                const formData =
                    new FormData();

                formData.append(
                    "imagen",
                    file
                );

                const altura =
                    document.querySelector(
                        "#height"
                    ).value;

                formData.append(
                    "altura",
                    altura
                );

                formData.append(
                    "estilo",
                    "casual"
                );

                const response =
                    await fetch(
                        `${API_URL}/avatar/render`,
                        {
                            method: "POST",
                            body: formData
                        }
                    );

                const data =
                    await response.json();

                if (!response.ok) {

                    throw new Error(
                        data.error ||
                        "No se pudo analizar la fotografía."
                    );
                }

                console.log(
                    "[FITAI] Resultado:",
                    data
                );

                aplicarAnalisisIA(data);

                status.textContent =
                    "✅ Avatar ajustado a tu altura y proporciones (aproximado).";

                status.className =
                    "photo-status is-success";

            } catch (error) {

                console.error(
                    "[FITAI] Error:",
                    error
                );

                status.textContent =
                    "⚠ " + error.message;

                status.className =
                    "photo-status is-error";
            }
        }
    );

    // =========================================================
    // APLICAR RESULTADO DE MEDIAPIPE
    // =========================================================

    function aplicarAnalisisIA(data) {

        const medidas =
            data.medidas || {};

        const proporciones =
            data.proporciones || {};

        // -----------------------------------------------
        // ALTURA
        // -----------------------------------------------

        if (data.altura_cm) {

            const altura =
                Math.max(
                    145,
                    Math.min(
                        200,
                        Number(
                            data.altura_cm
                        )
                    )
                );

            document
                .getElementById("height")
                .value = altura;

            document
                .getElementById("heightV")
                .textContent =
                Math.round(altura);
        }

        // -----------------------------------------------
        // HOMBROS
        // -----------------------------------------------

        if (
            medidas.ancho_hombros_cm
        ) {

            const hombros =
                Number(
                    medidas.ancho_hombros_cm
                );

            // Rango visual 30-75
            const valor =
                Math.max(
                    30,
                    Math.min(
                        75,
                        hombros
                    )
                );

            document
                .getElementById(
                    "shoulder"
                )
                .value =
                valor;

            document
                .getElementById(
                    "shoulderV"
                )
                .textContent =
                Math.round(valor);
        }

        // -----------------------------------------------
        // CADERA / CINTURA
        // -----------------------------------------------

        if (
            medidas.ancho_cadera_cm
        ) {

            const cadera =
                Number(
                    medidas.ancho_cadera_cm
                );

            const valor =
                Math.max(
                    30,
                    Math.min(
                        70,
                        cadera
                    )
                );

            document
                .getElementById(
                    "waist"
                )
                .value =
                valor;

            document
                .getElementById(
                    "waistV"
                )
                .textContent =
                Math.round(valor);
        }

        // -----------------------------------------------
        // PROPORCIÓN CORPORAL
        // -----------------------------------------------

        if (
            proporciones.torso &&
            proporciones.piernas
        ) {

            const torso =
                Number(
                    proporciones.torso
                );

            const piernas =
                Number(
                    proporciones.piernas
                );

            const total =
                torso + piernas;

            if (total > 0) {

                const proporcion =
                    piernas / total;

                const valor =
                    Math.max(
                        20,
                        Math.min(
                            80,
                            proporcion * 100
                        )
                    );

                document
                    .getElementById(
                        "body"
                    )
                    .value =
                    valor;

                document
                    .getElementById(
                        "bodyV"
                    )
                    .textContent =
                    Math.round(valor);
            }
        }

        // -----------------------------------------------
        // RECONSTRUIR AVATAR
        // -----------------------------------------------

        build();

        console.log(
            "[FITAI] Avatar actualizado con análisis IA."
        );

        console.log(
            "[FITAI] Detección:",
            data.deteccion_corporal
        );

        console.log(
            "[FITAI] Medidas:",
            medidas
        );

        console.log(
            "[FITAI] Proporciones:",
            proporciones
        );
    }

    // =========================================================
    // INICIO
    // =========================================================

    window._hair = 0;

    build();