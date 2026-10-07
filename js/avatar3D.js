    import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js';
    import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/loaders/GLTFLoader.js';

    // =========================================================
    // CONFIGURACIÓN
    // =========================================================

    const API_URL = window.FITAI_API_URL || (
        window.location.protocol === "file:" ||
        window.location.hostname === "" ||
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1"
            ? "http://localhost:5000/api"
            : "https://fitai-style-backend.onrender.com/api"
    );

    // =========================================================
    // THREE.JS
    // =========================================================

    const scene = new THREE.Scene();

    console.info("[FITAI Avatar] avatar3D.js iniciado");

    const camera = new THREE.PerspectiveCamera(
        45,
        1,
        0.1,
        100
    );

    camera.position.set(3, 2.2, 7);

    const sceneContainer = document.querySelector("#scene");
    if (!sceneContainer) {
        throw new Error("[FITAI Avatar] No existe el contenedor #scene.");
    }

    let renderer;
    try {
        renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true,
            powerPreference: "high-performance"
        });
    } catch (error) {
        console.error("[FITAI Avatar] WebGL no pudo inicializarse:", error);
        sceneContainer.dataset.webglError = "true";
        throw error;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    sceneContainer.appendChild(renderer.domElement);

    const controls = new OrbitControls(
        camera,
        renderer.domElement
    );

    controls.enableDamping = true;
    controls.enableZoom = true;
    controls.enablePan = true;
    controls.zoomSpeed = 1.15;
    controls.minDistance = 2.2;
    controls.maxDistance = 12;
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
    // Modelo humano paramétrico CC0 basado en Anny/MakeHuman.
    // Se fija a un commit concreto para que el asset no cambie sin control.
    const HUMAN_MODEL_URL = 'https://cdn.jsdelivr.net/gh/nirholas/three.ws@5c7d87a768152cd64a8cce2feef8831411062eb5/public/avatars/parametric-base.glb';
    let humanModel = null;
    let humanMorphMeshes = [];
    let humanBones = [];

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
        humanBones = [];
        root.traverse(object => {
            if (object.isMesh && object.morphTargetDictionary && object.morphTargetInfluences) {
                humanMorphMeshes.push(object);
            }
            if (object.isBone) {
                humanBones.push({
                    bone: object,
                    baseScale: object.scale.clone()
                });
            }
        });
        console.info('[FITAI V6] Morph meshes:', humanMorphMeshes.length, 'bones:', humanBones.length);
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

    function applyAgeProportions(age) {
        // El GLB paramétrico trae morphs reales de cuerpo/rostro, pero su set
        // curado no incluye una malla infantil separada. Para que 0-100 sea
        // continuo, combinamos morphs de edad con proporciones esqueléticas.
        const t = THREE.MathUtils.clamp(Number(age) / 100, 0, 1);
        const child = THREE.MathUtils.clamp((16 - age) / 16, 0, 1);
        const baby = THREE.MathUtils.clamp((6 - age) / 6, 0, 1);
        const senior = THREE.MathUtils.clamp((age - 55) / 45, 0, 1);

        humanBones.forEach(({ bone, baseScale }) => {
            bone.scale.copy(baseScale);
            const key = normalizeKey(bone.name);

            // Cabeza proporcionalmente mayor en bebé/niño.
            if (key.includes('head')) {
                const factor = 1 + child * 0.30 + baby * 0.12;
                bone.scale.multiplyScalar(factor);
            }

            // Brazos y piernas más cortos durante el crecimiento.
            if (key.includes('upperarm') || key.includes('lowerarm') || key.includes('hand')) {
                const factor = 1 - child * 0.16 - baby * 0.18;
                bone.scale.y *= factor;
            }
            if (key.includes('upperleg') || key.includes('lowerleg') || key.includes('foot')) {
                const factor = 1 - child * 0.18 - baby * 0.22;
                bone.scale.y *= factor;
            }

            // Torso algo más compacto en infancia.
            if (key.includes('spine') || key.includes('chest')) {
                bone.scale.y *= 1 + child * 0.05 + baby * 0.10;
            }

            // Ligera compresión visual para edades muy avanzadas.
            if (key.includes('spine') && senior > 0) {
                bone.rotation.x += senior * 0.05;
            }
        });

        // El morph "bodyOlder" es el cambio de edad disponible en el asset.
        humanMorphMeshes.forEach(mesh => {
            setMorph(mesh, ['bodyolder', 'older', 'oldage'], senior);
            setMorph(mesh, ['bodysofter'], baby * 0.55 + senior * 0.20);
        });

        return { child, baby, senior, t };
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
        const ageProfile = applyAgeProportions(age);
        const baby = ageProfile.baby;
        const child = ageProfile.child;
        const young = THREE.MathUtils.clamp(1 - Math.abs(age - 25) / 25, 0, 1);
        const adult = THREE.MathUtils.clamp(1 - Math.abs(age - 45) / 35, 0, 1);
        const senior = ageProfile.senior;

        humanMorphMeshes.forEach(mesh => {
            // Si el asset usa un único shape key "Age", se controla directamente.
            setMorph(mesh, ['age', 'edad'], ageN);

            // Si usa etapas separadas, se distribuyen automáticamente.
            setMorph(mesh, ['baby', 'bebé', 'infant', 'newborn'], baby);
            setMorph(mesh, ['child', 'nino', 'niño', 'kid'], child);
            setMorph(mesh, ['young', 'youngadult', 'joven'], young);
            setMorph(mesh, ['adult', 'adulto'], adult);
            setMorph(mesh, ['old', 'elder', 'elderly', 'senior', 'anciano'], senior);

            setMorph(mesh, ['bodyfat', 'fat', 'body', 'bodyheavier'], body);
            setMorph(mesh, ['bodysofter'], THREE.MathUtils.clamp(1 - body, 0, 1));
            setMorph(mesh, ['bodymuscular'], THREE.MathUtils.clamp(body - 0.5, 0, 0.5) * 2);
            setMorph(mesh, ['shoulderswider', 'shoulderwidth', 'shoulders', 'hombros'], shoulder);
            setMorph(mesh, ['shouldersnarrower'], 1 - shoulder);
            setMorph(mesh, ['waistwider', 'waist', 'waistwidth', 'cintura'], 1 - waist);
            setMorph(mesh, ['waistnarrower'], waist);
            setMorph(mesh, ['headwider', 'facewidth', 'face', 'facialwidth', 'rostro'], face);
            setMorph(mesh, ['headnarrower'], 1 - face);
            setMorph(mesh, ['eyebigger', 'eyesize', 'eyes', 'ojos'], eyes);
            setMorph(mesh, ['eyesmaller'], 1 - eyes);
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

        // El GLB puede venir con el origen fuera de los pies.
        // Recalculamos el bounding box después del escalado y apoyamos
        // exactamente la base del avatar sobre el suelo de la escena.
        const fittedBox = new THREE.Box3().setFromObject(humanModel);
        if (Number.isFinite(fittedBox.min.y)) {
            humanModel.position.y += 0.02 - fittedBox.min.y;
        }
    }


    // =========================================================
    // APARIENCIA DE LA FOTO
    // =========================================================
    // La fotografía aporta dos capas: tono de piel y un recorte facial
    // real que se proyecta como textura sobre la cabeza del GLB.
    // La geometría continúa siendo 3D y el resto del cuerpo usa el material
    // paramétrico, evitando deformar la foto completa sobre el cuerpo.
    let photoFaceTexture = null;

    function applyPhotoAppearance(dna) {
        if (!humanModel) return;

        const identity = dna?.identity || {};
        const skin = dna?.skin || {};
        const skinHex = skin.hex || identity.skin_hex;

        humanModel.traverse(object => {
            if (!object.isMesh) return;

            const key = normalizeKey(object.name);
            const isHead = key.includes('head') || key.includes('face') || key.includes('facial');
            const isSkin = isHead ||
                key.includes('neck') ||
                key.includes('skin') ||
                key.includes('hand') ||
                key.includes('arm') ||
                key.includes('leg') ||
                key.includes('body');

            if (isSkin && skinHex && /^#[0-9a-f]{6}$/i.test(skinHex)) {
                object.material = Array.isArray(object.material)
                    ? object.material.map(m => m.clone())
                    : object.material.clone();

                const materials = Array.isArray(object.material)
                    ? object.material
                    : [object.material];

                materials.forEach(material => {
                    if (material?.color) material.color.set(skinHex);
                    if (material?.roughness !== undefined) {
                        material.roughness = Number(skin.roughness ?? 0.46);
                    }
                });
            }

            if (isHead && photoFaceTexture) {
                object.material = Array.isArray(object.material)
                    ? object.material.map(m => m.clone())
                    : object.material.clone();

                const materials = Array.isArray(object.material)
                    ? object.material
                    : [object.material];

                materials.forEach(material => {
                    if (!material) return;
                    material.map = photoFaceTexture;
                    material.needsUpdate = true;
                    if (material.color) material.color.set(0xffffff);
                    if (material.roughness !== undefined) {
                        material.roughness = Number(skin.roughness ?? 0.46);
                    }
                });
            }
        });

        // Ajustes faciales derivados de Face Mesh. Si el GLB no contiene
        // alguno de estos morphs, setMorph simplemente lo ignora.
        humanMorphMeshes.forEach(mesh => {
            setMorph(mesh, ['facewidth', 'headwider', 'facialwidth'], Number(identity.face_width ?? 0.5));
            setMorph(mesh, ['faceheight', 'headheight'], Number(identity.face_height ?? 0.5));
            setMorph(mesh, ['eyespacing', 'eye_distance', 'eyespace'], Number(identity.eye_spacing ?? 0.5));
            setMorph(mesh, ['eyesize', 'eyebigger', 'eyes'], Number(identity.eye_size ?? 0.5));
            setMorph(mesh, ['noselength', 'nose'], Number(identity.nose_length ?? 0.5));
            setMorph(mesh, ['nosewidth'], Number(identity.nose_width ?? 0.5));
            setMorph(mesh, ['mouthwidth', 'lipswidth'], Number(identity.mouth_width ?? 0.5));
            setMorph(mesh, ['jawwidth', 'jaw'], Number(identity.jaw_width ?? 0.5));
        });
    }

    function loadPhotoFaceTexture(dataUrl, dna) {
        if (!dataUrl || !humanModel) {
            applyPhotoAppearance(dna);
            return;
        }

        const loader = new THREE.TextureLoader();
        loader.load(
            dataUrl,
            texture => {
                texture.colorSpace = THREE.SRGBColorSpace;
                texture.flipY = false;
                photoFaceTexture = texture;
                applyPhotoAppearance(dna);
            },
            undefined,
            error => {
                console.warn('[FITAI] No se pudo cargar la textura facial de la foto.', error);
                applyPhotoAppearance(dna);
            }
        );
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
            console.info('[FITAI V6] Modelo humano paramétrico cargado:', HUMAN_MODEL_URL);
        },
        undefined,
        error => {
            console.warn('[FITAI V6] No se pudo cargar el modelo humano remoto; se mantiene el avatar procedural.', error);
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

    // Render inicial inmediato: nunca dejamos el escenario vacío si el GLB remoto tarda o falla.
    // El modelo humano reemplazará este respaldo automáticamente cuando termine de cargar.
    buildProcedural();

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

        const container = sceneContainer;
        const width = Math.max(
            1,
            container.clientWidth || container.parentElement?.clientWidth || 1
        );
        const height = Math.max(
            1,
            container.clientHeight || container.parentElement?.clientHeight || 1
        );

        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height, false);
    }

    window.addEventListener("resize", resize);

    if (window.ResizeObserver) {
        const observer = new ResizeObserver(resize);
        observer.observe(sceneContainer);
    }

    resize();

    const runtimeStatus = document.getElementById("avatarRuntimeStatus");
    if (runtimeStatus) {
        runtimeStatus.textContent = "Avatar 3D listo";
        setTimeout(() => runtimeStatus.remove(), 1200);
    }

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

    window.zoomAvatar = amount => {
        const direction = new THREE.Vector3();
        camera.getWorldDirection(direction);
        const distance = camera.position.distanceTo(controls.target);
        const nextDistance = THREE.MathUtils.clamp(
            distance * Number(amount || 0.8),
            controls.minDistance,
            controls.maxDistance
        );
        camera.position.copy(controls.target).sub(direction.multiplyScalar(nextDistance));
        camera.updateProjectionMatrix();
        controls.update();
    };

    window.resetAvatarView = () => {
        camera.position.set(0, 2.3, 7);
        controls.target.set(0, 1.8, 0);
        controls.update();
    };

    window.zoomAvatarToFace = () => {
        const faceTarget = new THREE.Vector3(0, 2.85, 0);
        const direction = new THREE.Vector3();
        camera.getWorldDirection(direction);
        const nextDistance = THREE.MathUtils.clamp(
            2.65,
            controls.minDistance,
            controls.maxDistance
        );
        controls.target.copy(faceTarget);
        camera.position.copy(faceTarget).sub(direction.multiplyScalar(nextDistance));
        camera.updateProjectionMatrix();
        controls.update();
    };

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

    const cameraCommand = new URLSearchParams(window.location.search).get("camera");
    if (cameraCommand) {
        setTimeout(() => {
            const commands = {
                zoom_in: () => window.zoomAvatar?.(0.72),
                zoom_out: () => window.zoomAvatar?.(1.38),
                face: () => window.zoomAvatarToFace?.(),
                front: () => window.view?.("front"),
                side: () => window.view?.("side"),
                back: () => window.view?.("back"),
                reset: () => window.resetAvatarView?.()
            };
            commands[cameraCommand]?.();
            if (window.history.replaceState) {
                window.history.replaceState({}, document.title, window.location.pathname);
            }
        }, 900);
    }

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

    async function prepararFotoParaAnalisis(file) {
        const maxDimension = 1280;
        if (file.size <= 4 * 1024 * 1024) return file;

        const bitmap = await createImageBitmap(file);
        const escala = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(bitmap.width * escala));
        canvas.height = Math.max(1, Math.round(bitmap.height * escala));
        const ctx = canvas.getContext("2d", { alpha: false });
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        bitmap.close();

        const blob = await new Promise(resolve =>
            canvas.toBlob(resolve, "image/jpeg", 0.82)
        );
        if (!blob) return file;

        return new File(
            [blob],
            "fitai-analysis.jpg",
            { type: "image/jpeg" }
        );
    }

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

                // Reducimos la foto antes de enviarla para evitar cargas
                // enormes y acelerar el análisis en Render.
                const uploadFile = await prepararFotoParaAnalisis(file);

                const formData =
                    new FormData();

                formData.append(
                    "imagen",
                    uploadFile,
                    uploadFile.name
                );

                const altura =
                    document.querySelector(
                        "#height"
                    ).value;

                formData.append(
                    "altura",
                    altura
                );

                const edad =
                    document.querySelector("#age")?.value || 25;

                formData.append(
                    "edad",
                    edad
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

    function aplicarAvatarDNA(dna) {
        if (!dna) return;
        const body = dna.body || {};
        const identity = dna.identity || {};
        const set = (id, value, min, max) => {
            const el = document.getElementById(id);
            const out = document.getElementById(id + "V");
            if (!el || value === undefined || value === null) return;
            const n = Math.max(min, Math.min(max, Math.round(Number(value))));
            el.value = String(n);
            if (out) out.textContent = String(n);
        };
        const norm = v => Math.max(0, Math.min(1, Number(v ?? 0.5)));
        set("age", dna.edad ?? dna.age?.age, 0, 100);
        set("height", body.height_cm, 145, 200);
        set("shoulder", 30 + norm(body.shoulder) * 45, 30, 75);
        set("waist", 30 + norm(body.waist) * 40, 30, 70);
        set("body", 20 + norm(body.body_ratio) * 60, 20, 80);
        set("face", norm(identity.face_width) * 40 + 30, 30, 70);
        set("eyes", norm(identity.eye_size) * 40 + 30, 30, 70);
        window._avatarDNA = dna;
        build();
        if (identity.face_texture_data_url) {
            loadPhotoFaceTexture(identity.face_texture_data_url, dna);
        }
    }

    function aplicarAnalisisIA(data) {
        aplicarAvatarDNA(data?.avatar_dna);

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

            document.querySelector("#height").value = String(altura);
            const heightOut = document.querySelector("#heightV");
            if (heightOut) heightOut.textContent = String(altura);

            if (medidas.shoulder_width || proporciones.shoulder) {
                const shoulderValue = medidas.shoulder_width ?? (Number(proporciones.shoulder) * 45 + 30);
                document.querySelector("#shoulder").value = String(Math.max(30, Math.min(75, Math.round(Number(shoulderValue)))));
                const out = document.querySelector("#shoulderV");
                if (out) out.textContent = document.querySelector("#shoulder").value;
            }

            if (medidas.waist_width || proporciones.waist) {
                const waistValue = medidas.waist_width ?? (Number(proporciones.waist) * 40 + 30);
                document.querySelector("#waist").value = String(Math.max(30, Math.min(70, Math.round(Number(waistValue)))));
                const out = document.querySelector("#waistV");
                if (out) out.textContent = document.querySelector("#waist").value;
            }

            build();
        }
    }
