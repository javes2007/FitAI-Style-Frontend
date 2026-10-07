    import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.161/build/three.module.js';
    import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.161/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.161/examples/jsm/loaders/GLTFLoader.js';

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

    // =========================================================
    // V5 — MODELO HUMANO REAL + MORPH TARGETS
    // =========================================================
    const HUMAN_MODEL_URL = 'assets/avatars/human-base.glb';
    let humanModel = null;
    let humanMorphMeshes = [];

    const humanLoader = new GLTFLoader();

    function normalizeKey(value) {
        return String(value || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\\u0300-\\u036f]/g, '')
            .replace(/[^a-z0-9]/g, '');
    }

    function collectHumanMorphs(root) {
        humanMorphMeshes = [];
        root.traverse(object => {
            if (object.isMesh && object.morphTargetDictionary && object.morphTargetInfluences) {
                humanMorphMeshes.push(object);
            }
        });
        console.info('[FITAI V5] Morph meshes:', humanMorphMeshes.length);
    }

    function setMorph(mesh, aliases, value) {
        if (!mesh.morphTargetDictionary || !mesh.morphTargetInfluences) return false;
        const wanted = aliases.map(normalizeKey);
        let changed = false;
        for (const [name, index] of Object.entries(mesh.morphTargetDictionary)) {
            const key = normalizeKey(name);
            if (wanted.some(alias => key === alias || key.includes(alias))) {
                mesh.morphTargetInfluences[index] = THREE.MathUtils.clamp(value, 0, 1);
                changed = true;
            }
        }
        return changed;
    }

    function applyHumanDNA() {
        if (!humanModel) return;

        const age = Number(document.querySelector('#age')?.value || 25);
        const body = (Number(document.querySelector('#body')?.value || 50) - 20) / 60;
        const shoulder = (Number(document.querySelector('#shoulder')?.value || 50) - 30) / 45;
        const waist = (Number(document.querySelector('#waist')?.value || 50) - 30) / 40;
        const face = (Number(document.querySelector('#face')?.value || 50) - 30) / 40;
        const eyes = (Number(document.querySelector('#eyes')?.value || 50) - 30) / 40;

        const ageN = age / 100;
        const baby = THREE.MathUtils.clamp(1 - age / 16, 0, 1);
        const child = THREE.MathUtils.clamp(1 - Math.abs(age - 9) / 9, 0, 1);
        const young = THREE.MathUtils.clamp(1 - Math.abs(age - 25) / 25, 0, 1);
        const adult = THREE.MathUtils.clamp(1 - Math.abs(age - 45) / 35, 0, 1);
        const senior = THREE.MathUtils.clamp((age - 55) / 45, 0, 1);

        humanMorphMeshes.forEach(mesh => {
            // Si el asset usa un único shape key "Age", se controla directamente.
            setMorph(mesh, ['age', 'edad'], ageN);

            // Si usa etapas separadas, se distribuyen automáticamente.
            setMorph(mesh, ['baby', 'bebé', 'infant', 'newborn'], baby);
            setMorph(mesh, ['child', 'nino', 'niño', 'kid'], child);
            setMorph(mesh, ['young', 'youngadult', 'joven'], young);
            setMorph(mesh, ['adult', 'adulto'], adult);
            setMorph(mesh, ['old', 'elder', 'elderly', 'senior', 'anciano'], senior);

            setMorph(mesh, ['bodyfat', 'fat', 'body'], body);
            setMorph(mesh, ['shoulderwidth', 'shoulders', 'hombros'], shoulder);
            setMorph(mesh, ['waist', 'waistwidth', 'cintura'], 1 - waist);
            setMorph(mesh, ['facewidth', 'face', 'facialwidth', 'rostro'], face);
            setMorph(mesh, ['eyesize', 'eyes', 'ojos'], eyes);
        });

        // Escalado por altura real. El GLB puede tener cualquier unidad.
        const height = Number(document.querySelector('#height')?.value || 168);
        const box = new THREE.Box3().setFromObject(humanModel);
        const currentHeight = box.max.y - box.min.y;
        if (currentHeight > 0) {
            const targetMeters = height / 100;
            const baseScale = targetMeters / currentHeight;
            humanModel.scale.setScalar(baseScale);
        }
        humanModel.position.y = 0.02;
    }

    function buildHuman() {
        avatar.clear();
        avatar.add(humanModel);
        applyHumanDNA();
    }

    function build() {
        if (humanModel) {
            buildHuman();
        } else {
            buildProcedural();
        }
    }

    humanLoader.load(
        HUMAN_MODEL_URL,
        gltf => {
            humanModel = gltf.scene;
            humanModel.traverse(object => {
                if (object.isMesh) {
                    object.castShadow = true;
                    object.receiveShadow = true;
                }
            });
            collectHumanMorphs(humanModel);
            buildHuman();
            console.info('[FITAI V5] Modelo humano GLB cargado:', HUMAN_MODEL_URL);
        },
        undefined,
        error => {
            console.warn('[FITAI V5] No se encontró el GLB humano; se mantiene el avatar procedural.', error);
        }
    );

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

    function buildProcedural() {

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
        "age",
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
            age: "25",
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

            edad:
                document.querySelector("#age").value,

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

        const dna = data.avatar_dna || data.dna || {};
        if (dna.edad != null || dna.age != null) {
            const age = Math.max(0, Math.min(100, Number(dna.edad ?? dna.age)));
            document.querySelector("#age").value = age;
            document.querySelector("#ageV").textContent = Math.round(age);
        }

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

    // El GLB es opcional: la app sigue funcionando si todavía no existe.
    build();