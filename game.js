// ============================================================================
// MAIN GAME CONTROLLER & ENGINE LOOP
// Void Protocol: Sub-Zero Blackout
// ============================================================================

class Game {
    constructor() {
        this.canvasContainer = document.getElementById('canvas-container');
        this.radarCanvas = document.getElementById('radar-canvas');
        this.radarCtx = this.radarCanvas.getContext('2d');

        // Three.js Core
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.FogExp2(0x0d1724, 0.021); // Crisp sci-fi atmospheric mist with high visibility

        this.isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (window.innerWidth <= 1024);
        this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
        this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(this.isTouchDevice ? 1.0 : Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.canvasContainer.appendChild(this.renderer.domElement);

        // Subsystems
        this.env = new EnvironmentManager(this.scene);
        this.weaponMgr = new WeaponManager(this.scene);
        this.alienMgr = new AlienManager(this.scene);

        // Player & Gameplay State
        this.initPlayer();
        this.initLighting();
        this.initDrone();
        this.initWaypoints();
        this.initHelplineSim();

        // Game Loop & State
        this.gameState = 'MENU'; // 'MENU', 'PLAYING', 'UPGRADE', 'GAMEOVER'
        this.wave = 1;
        this.waveAliensTotal = 0;
        this.waveAliensSpawned = 0;
        this.waveSpawnTimer = 0;
        this.waveBreakTimer = 0;
        this.isWaveBreak = false;

        this.score = 0;
        this.killCount = 0;
        this.combo = 1;
        this.comboTimer = 0;

        this.screenShake = 0;
        this.radarSweepAngle = 0;
        this.radarPingTimer = 0;

        // Mouse & Touch Tracking
        this.keys = {};
        this.mousePos = new THREE.Vector2();
        this.mouseWorld = new THREE.Vector3();
        this.raycaster = new THREE.Raycaster();
        this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        this.isTouchDevice = false;
        this.joystickMove = { x: 0, y: 0, active: false };
        this.joystickAim = { x: 0, y: 0, active: false };

        this.perks = {
            damageMult: 1.0,
            fireRateMult: 1.0,
            speedMult: 1.0,
            bouncingRounds: false,
            droneActive: false,
            healthRegen: false,
            empReady: true
        };

        this.lastTime = performance.now();

        // Bind events
        this.setupEvents();
        this.env.buildOutpost();

        // Start render loop
        this.animate = this.animate.bind(this);
        requestAnimationFrame(this.animate);
    }

    // ------------------------------------------------------------------------
    // PLAYER INITIALIZATION
    // ------------------------------------------------------------------------
    initPlayer() {
        this.player = {
            mesh: null,
            flashlight: null,
            laserLine: null,
            speed: 12.0,
            health: 100,
            maxHealth: 100,
            flares: 4,
            currentWeapon: WEAPONS.CARBINE,
            ammo: {
                CARBINE: WEAPONS.CARBINE.ammoCapacity,
                SHOTGUN: WEAPONS.SHOTGUN.ammoCapacity,
                ARC: WEAPONS.ARC.ammoCapacity,
                SINGULARITY: WEAPONS.SINGULARITY.ammoCapacity
            },
            lastFireTime: 0,
            isDashing: false,
            dashTimer: 0,
            dashCooldown: 0,
            dashDir: new THREE.Vector3(),
            knockback: new THREE.Vector3(),
            invulnTimer: 0,
            takeDamage: (amt) => this.onPlayerTakeDamage(amt),
            heal: (amt) => {
                this.player.health = Math.min(this.player.maxHealth, this.player.health + amt);
                this.updateHUD();
            },
            refillAmmo: () => {
                for (let k in this.player.ammo) {
                    this.player.ammo[k] = WEAPONS[k].ammoCapacity;
                }
                this.updateHUD();
            },
            applyKnockback: (vec) => {
                this.player.knockback.add(vec);
            },
            isIlluminating: (targetPos) => {
                if (!this.player.flashlight) return false;
                const toTarget = new THREE.Vector3().subVectors(targetPos, this.player.mesh.position);
                toTarget.y = 0;
                const dist = toTarget.length();
                if (dist > 48) return false;

                const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.player.mesh.quaternion);
                forward.y = 0;
                forward.normalize();
                const angle = forward.angleTo(toTarget.normalize());
                return angle < 0.72; // Wide, visible flashlight illumination
            },
            getForwardVector: () => {
                return new THREE.Vector3(0, 0, 1).applyQuaternion(this.player.mesh.quaternion);
            }
        };

        // --------------------------------------------------------------------
        // BUILD HIGH-DETAIL PROFESSIONAL SPEC-OPS OPERATIVE MODEL
        // --------------------------------------------------------------------
        this.player.anim = { walkCycle: 0, recoil: 0, lean: 0 };
        this.player.bones = {};

        const rootGroup = new THREE.Group();

        // 1. Professional Tactical Materials
        const suitMat = new THREE.MeshStandardMaterial({
            color: 0x1e2732, // Dark tactical navy/slate combat suit
            roughness: 0.5,
            metalness: 0.3
        });
        const armorPlateMat = new THREE.MeshStandardMaterial({
            color: 0x11161d, // Carbon ballistic composite armor
            roughness: 0.25,
            metalness: 0.85
        });
        const metalAccentsMat = new THREE.MeshStandardMaterial({
            color: 0x3d4b58,
            roughness: 0.2,
            metalness: 0.95
        });
        const visorMat = new THREE.MeshStandardMaterial({
            color: 0x00f0ff,
            emissive: 0x00b4d8,
            emissiveIntensity: 0.75,
            roughness: 0.1,
            metalness: 0.9
        });
        const glowCyanMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
        const glowRedMat = new THREE.MeshBasicMaterial({ color: 0xff1133 });

        // 2. LEGS & COMBAT BOOTS (Separated pivots for walking kinematics)
        const createLeg = (isLeft) => {
            const legPivot = new THREE.Group();
            const sign = isLeft ? -1 : 1;
            legPivot.position.set(sign * 0.22, 0.9, 0);

            // Thigh
            const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.48, 0.26), suitMat);
            thigh.position.y = -0.22;
            thigh.castShadow = true;
            legPivot.add(thigh);

            // Thigh Holster / Pouch (Right thigh has pistol holster)
            if (!isLeft) {
                const holster = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.22, 0.16), armorPlateMat);
                holster.position.set(0.14, -0.2, 0);
                legPivot.add(holster);
            }

            // Knee Guard
            const knee = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 0.12), armorPlateMat);
            knee.position.set(0, -0.42, 0.1);
            legPivot.add(knee);

            // Shin / Lower leg
            const shin = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.42, 0.24), suitMat);
            shin.position.y = -0.62;
            shin.castShadow = true;
            legPivot.add(shin);

            // Armored Tactical Combat Boot
            const boot = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.2, 0.38), armorPlateMat);
            boot.position.set(0, -0.82, 0.06);
            boot.castShadow = true;
            legPivot.add(boot);

            return legPivot;
        };

        const leftLeg = createLeg(true);
        const rightLeg = createLeg(false);
        rootGroup.add(leftLeg);
        rootGroup.add(rightLeg);
        this.player.bones.leftLeg = leftLeg;
        this.player.bones.rightLeg = rightLeg;

        // 3. TORSO & BALLISTIC CHEST RIG
        const torsoGroup = new THREE.Group();
        torsoGroup.position.y = 1.0;
        rootGroup.add(torsoGroup);
        this.player.bones.torsoGroup = torsoGroup;

        // Pelvis / Under-suit
        const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.25, 0.38), suitMat);
        pelvis.position.y = -0.05;
        torsoGroup.add(pelvis);

        // Heavy Tactical Utility Belt
        const belt = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.12, 0.44), armorPlateMat);
        belt.position.y = 0.04;
        torsoGroup.add(belt);

        // Belt Buckle / Power Conduit
        const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.05), glowCyanMat);
        buckle.position.set(0, 0.04, 0.23);
        torsoGroup.add(buckle);

        // Chest Core
        const chest = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.6, 0.46), suitMat);
        chest.position.y = 0.35;
        chest.castShadow = true;
        torsoGroup.add(chest);

        // Ballistic Front Armor Plate (V-Shape Spec-Ops Rig)
        const armorPlate = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.45, 0.15), armorPlateMat);
        armorPlate.position.set(0, 0.38, 0.22);
        armorPlate.castShadow = true;
        torsoGroup.add(armorPlate);

        // Tactical Ammo Pouches on Chest
        const pouch1 = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.18, 0.1), armorPlateMat);
        pouch1.position.set(-0.16, 0.25, 0.29);
        torsoGroup.add(pouch1);

        const pouch2 = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.18, 0.1), armorPlateMat);
        pouch2.position.set(0.16, 0.25, 0.29);
        torsoGroup.add(pouch2);

        // Left Combat Knife Sheath across shoulder strap
        const knifeSheath = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.32, 0.08), armorPlateMat);
        knifeSheath.position.set(-0.24, 0.46, 0.24);
        knifeSheath.rotation.z = -0.3;
        torsoGroup.add(knifeSheath);

        // Shoulder Pauldrons (Heavy Armored Shoulder Guards)
        const pauldronGeom = new THREE.BoxGeometry(0.24, 0.24, 0.34);
        const leftPauldron = new THREE.Mesh(pauldronGeom, armorPlateMat);
        leftPauldron.position.set(-0.44, 0.54, 0);
        torsoGroup.add(leftPauldron);

        const rightPauldron = new THREE.Mesh(pauldronGeom, armorPlateMat);
        rightPauldron.position.set(0.44, 0.54, 0);
        torsoGroup.add(rightPauldron);

        // Cyan LED Accent on Pauldrons
        const paulStripeL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.06, 0.3), glowCyanMat);
        paulStripeL.position.set(-0.55, 0.58, 0);
        torsoGroup.add(paulStripeL);

        // 4. BACKPACK & LIFE-SUPPORT THRUSTER PACK
        const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.55, 0.26), armorPlateMat);
        backpack.position.set(0, 0.36, -0.3);
        backpack.castShadow = true;
        torsoGroup.add(backpack);

        // Dual Thruster Exhaust Nozzles
        const nozzleGeom = new THREE.CylinderGeometry(0.07, 0.1, 0.22, 10);
        const nozzleL = new THREE.Mesh(nozzleGeom, metalAccentsMat);
        nozzleL.rotation.x = Math.PI / 4;
        nozzleL.position.set(-0.16, 0.14, -0.4);
        torsoGroup.add(nozzleL);

        const nozzleR = new THREE.Mesh(nozzleGeom, metalAccentsMat);
        nozzleR.rotation.x = Math.PI / 4;
        nozzleR.position.set(0.16, 0.14, -0.4);
        torsoGroup.add(nozzleR);

        // Glowing Thruster Cores
        const thrustGlowL = new THREE.Mesh(new THREE.CircleGeometry(0.06, 8), glowCyanMat);
        thrustGlowL.position.set(-0.16, 0.07, -0.47);
        thrustGlowL.rotation.x = -Math.PI / 4;
        torsoGroup.add(thrustGlowL);

        const thrustGlowR = new THREE.Mesh(new THREE.CircleGeometry(0.06, 8), glowCyanMat);
        thrustGlowR.position.set(0.16, 0.07, -0.47);
        thrustGlowR.rotation.x = -Math.PI / 4;
        torsoGroup.add(thrustGlowR);

        // Comms Antenna
        const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.5, 6), metalAccentsMat);
        antenna.position.set(0.2, 0.72, -0.34);
        antenna.rotation.z = -0.1;
        torsoGroup.add(antenna);

        // 5. HELMET & CYBER-VISOR
        const helmetGroup = new THREE.Group();
        helmetGroup.position.set(0, 0.75, 0);
        torsoGroup.add(helmetGroup);

        // Helmet Dome (Aerodynamic Spec-Ops Shell)
        const domeGeom = new THREE.BoxGeometry(0.48, 0.44, 0.52);
        const dome = new THREE.Mesh(domeGeom, armorPlateMat);
        dome.position.y = 0.12;
        dome.castShadow = true;
        helmetGroup.add(dome);

        // Mandible / Rebreather Lower Mask
        const mandible = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.22, 0.3), suitMat);
        mandible.position.set(0, 0, 0.18);
        helmetGroup.add(mandible);

        // Curved Holographic Visor (Glossy glowing cyan)
        const visor = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.15, 0.15), visorMat);
        visor.position.set(0, 0.12, 0.25);
        helmetGroup.add(visor);

        // Helmet Mounted Tactical Flashlight / Rangefinder (Right ear)
        const rangefinder = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.26), metalAccentsMat);
        rangefinder.position.set(0.28, 0.15, 0.08);
        helmetGroup.add(rangefinder);

        const rfLens = new THREE.Mesh(new THREE.CircleGeometry(0.04, 8), glowRedMat);
        rfLens.position.set(0.28, 0.15, 0.22);
        helmetGroup.add(rfLens);

        // 6. DETAILED TACTICAL RIFLE & ARMS
        const gunGroup = new THREE.Group();
        gunGroup.position.set(0.28, 0.36, 0.45);
        torsoGroup.add(gunGroup);
        this.player.bones.gunGroup = gunGroup;

        // Gun Receiver (Matte black firearm)
        const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.2, 0.75), armorPlateMat);
        receiver.castShadow = true;
        gunGroup.add(receiver);

        // Gun Barrel with Shroud
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.65, 8), metalAccentsMat);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0, 0.02, 0.65);
        gunGroup.add(barrel);

        // Tactical Muzzle Brake / Suppressor
        const muzzleBrake = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.16, 8), metalAccentsMat);
        muzzleBrake.rotation.x = Math.PI / 2;
        muzzleBrake.position.set(0, 0.02, 1.0);
        gunGroup.add(muzzleBrake);

        // Holographic Optic Sight on Top Rail
        const sightBase = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.08, 0.24), metalAccentsMat);
        sightBase.position.set(0, 0.14, 0.05);
        gunGroup.add(sightBase);

        const sightLens = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.07), glowRedMat);
        sightLens.position.set(0, 0.15, -0.06);
        gunGroup.add(sightLens);

        // Curved 30-Round Magazine
        const mag = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.32, 0.16), metalAccentsMat);
        mag.position.set(0, -0.22, 0.1);
        mag.rotation.x = -0.25;
        gunGroup.add(mag);

        // Stock against shoulder
        const stock = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.35), armorPlateMat);
        stock.position.set(0, -0.02, -0.45);
        gunGroup.add(stock);

        // Left Hand Forward Grip Arm
        const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.55), suitMat);
        leftArm.position.set(-0.4, 0.05, 0.1);
        leftArm.rotation.set(-0.35, 0.45, 0);
        gunGroup.add(leftArm);

        // Right Hand Trigger Arm
        const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.38), suitMat);
        rightArm.position.set(0.05, 0.02, -0.2);
        rightArm.rotation.set(-0.2, -0.1, 0);
        gunGroup.add(rightArm);

        // 7. LIGHTING & LASERS (Mounted to rifle)
        const spotLight = new THREE.SpotLight(0xf4f9ff, 9.5, 52, Math.PI / 4.2, 0.5, 1.2);
        spotLight.position.set(0, -0.05, 0.95);
        spotLight.castShadow = true;
        spotLight.shadow.mapSize.width = 1024;
        spotLight.shadow.mapSize.height = 1024;
        spotLight.shadow.bias = -0.001;

        const spotTarget = new THREE.Object3D();
        spotTarget.position.set(0, -0.05, 25);
        gunGroup.add(spotTarget);
        spotLight.target = spotTarget;
        gunGroup.add(spotLight);
        this.player.flashlight = spotLight;

        // Tactical 360-degree Aura Light centered on operative
        const playerAura = new THREE.PointLight(0x44bbff, 2.4, 14);
        playerAura.position.set(0, 0.5, 0);
        torsoGroup.add(playerAura);

        // Red Laser Sight Line projecting from rifle
        const laserGeom = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, -0.03, 1.0),
            new THREE.Vector3(0, -0.03, 38)
        ]);
        const laserMat = new THREE.LineBasicMaterial({ color: 0xff0044, transparent: true, opacity: 0.75 });
        this.player.laserLine = new THREE.Line(laserGeom, laserMat);
        gunGroup.add(this.player.laserLine);

        rootGroup.position.set(0, 0, 0);
        this.scene.add(rootGroup);
        this.player.mesh = rootGroup;
    }

    initLighting() {
        // High-clarity ambient facility lighting
        const ambLight = new THREE.AmbientLight(0x223348, 1.9);
        this.scene.add(ambLight);

        // Overhead soft directional fill light
        const dirLight = new THREE.DirectionalLight(0x557799, 0.6);
        dirLight.position.set(10, 30, 15);
        this.scene.add(dirLight);
    }

    initDrone() {
        this.drone = {
            mesh: null,
            targetAlien: null,
            lastFire: 0,
            angle: 0
        };

        const group = new THREE.Group();
        const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.35), new THREE.MeshBasicMaterial({ color: 0x00ffff, wireframe: true }));
        const light = new THREE.PointLight(0x00ffff, 1.5, 6);
        group.add(core);
        group.add(light);
        group.visible = false;

        this.scene.add(group);
        this.drone.mesh = group;
    }

    // ------------------------------------------------------------------------
    // INPUT HANDLING & WEAPON CONTROLS
    // ------------------------------------------------------------------------
    setupEvents() {
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });

        window.addEventListener('keydown', (e) => {
            this.keys[e.key.toLowerCase()] = true;

            // Audio init on first user interaction
            Sound.init();
            Sound.resume();

            // Weapon Switching [1, 2, 3, 4]
            if (e.key === '1') this.switchWeapon(WEAPONS.CARBINE);
            if (e.key === '2') this.switchWeapon(WEAPONS.SHOTGUN);
            if (e.key === '3') this.switchWeapon(WEAPONS.ARC);
            if (e.key === '4') this.switchWeapon(WEAPONS.SINGULARITY);

            // Manual Reload [R]
            if (e.key === 'r' || e.key === 'R') {
                this.reloadCurrentWeapon();
            }

            // Throw Flare [F or Space]
            if (e.key === 'f' || e.key === 'F') {
                this.throwTacticalFlare();
            }

            // Dash [Shift or Space]
            if (e.key === 'shift' || e.key === ' ') {
                this.triggerDash();
            }

            // Toggle Audio Mute [M]
            if (e.key === 'm' || e.key === 'M') {
                const muted = Sound.toggleMute();
                document.getElementById('audio-indicator').textContent = muted ? 'AUDIO: MUTED [M]' : 'AUDIO: ON [M]';
            }
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.key.toLowerCase()] = false;
        });

        window.addEventListener('mousemove', (e) => {
            this.mousePos.x = (e.clientX / window.innerWidth) * 2 - 1;
            this.mousePos.y = -(e.clientY / window.innerHeight) * 2 + 1;

            // Direct facing update: mouse movement always defines operative facing direction
            if (this.gameState === 'PLAYING' && this.camera && this.groundPlane && this.player && this.player.mesh) {
                this.raycaster.setFromCamera(this.mousePos, this.camera);
                const hit = new THREE.Vector3();
                if (this.raycaster.ray.intersectPlane(this.groundPlane, hit)) {
                    this.mouseWorld.copy(hit);
                    const toMouse = new THREE.Vector3().subVectors(hit, this.player.mesh.position);
                    toMouse.y = 0;
                    if (toMouse.lengthSq() > 0.01) {
                        this.player.mesh.rotation.y = Math.atan2(toMouse.x, toMouse.z);
                    }
                }
            }

            // Absolute hardware button state sync: if Left Mouse Button is NOT actively depressed, clear isMouseDown!
            if (e.buttons !== undefined && (e.buttons & 1) !== 1) {
                this.isMouseDown = false;
            }
        });

        window.addEventListener('mousedown', (e) => {
            Sound.init();
            Sound.resume();

            if (this.gameState !== 'PLAYING') return;

            // Ignore synthetic mouse events generated by touch taps
            if (e.sourceCapabilities && e.sourceCapabilities.firesTouchEvents) {
                return;
            }

            // Do not fire if clicking on UI interactive elements
            const target = e.target;
            if (target && (
                target.closest('.hud-top-buttons') ||
                target.closest('.hud-top-btn') ||
                target.closest('.round-arsenal') ||
                target.closest('.round-slot') ||
                target.closest('.hud-vitals') ||
                target.closest('.radar-container') ||
                target.closest('.modal-overlay') ||
                target.closest('#help-popup') ||
                target.closest('#countdown-overlay') ||
                target.closest('#mobile-controls')
            )) {
                return;
            }

            if (e.button === 0) {
                // Left Click: Shoot
                this.isMouseDown = true;
                this.fireWeapon();
            } else if (e.button === 2) {
                // Right Click: Flare
                e.preventDefault();
                this.throwTacticalFlare();
            }
        });

        const clearMouseDown = (e) => {
            if (!e || e.button === undefined || e.button === 0) {
                this.isMouseDown = false;
            }
        };

        window.addEventListener('mouseup', clearMouseDown);
        document.addEventListener('mouseup', clearMouseDown);
        window.addEventListener('pointerup', (e) => {
            if (e.pointerType === 'mouse' || !e.pointerType) {
                this.isMouseDown = false;
            }
        });
        document.addEventListener('pointerup', (e) => {
            if (e.pointerType === 'mouse' || !e.pointerType) {
                this.isMouseDown = false;
            }
        });

        window.addEventListener('blur', () => {
            this.isMouseDown = false;
            this.isScreenFiring = false;
            this.isMobileFiring = false;
            if (this.joystickMove) this.joystickMove.active = false;
            if (this.joystickAim) this.joystickAim.active = false;
            for (let k in this.keys) this.keys[k] = false;
        });

        document.addEventListener('mouseleave', () => {
            this.isMouseDown = false;
        });

        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.isMouseDown = false;
                this.isScreenFiring = false;
                this.isMobileFiring = false;
            }
        });

        window.addEventListener('contextmenu', (e) => e.preventDefault());

        // Mouse wheel weapon cycle
        window.addEventListener('wheel', (e) => {
            if (this.gameState !== 'PLAYING') return;
            const weaponList = [WEAPONS.CARBINE, WEAPONS.SHOTGUN, WEAPONS.ARC, WEAPONS.SINGULARITY];
            let idx = weaponList.findIndex(w => w.id === this.player.currentWeapon.id);
            if (e.deltaY > 0) idx = (idx + 1) % weaponList.length;
            else idx = (idx - 1 + weaponList.length) % weaponList.length;
            this.switchWeapon(weaponList[idx]);
        });

        // Clickable Arsenal Slots
        // Clickable & Touchable Arsenal Slots (4 guns on Web & Mobile)
        const slotBindings = [
            { id: 'slot-1', w: WEAPONS.CARBINE },
            { id: 'slot-2', w: WEAPONS.SHOTGUN },
            { id: 'slot-3', w: WEAPONS.ARC },
            { id: 'slot-4', w: WEAPONS.SINGULARITY }
        ];
        slotBindings.forEach(b => {
            const el = document.getElementById(b.id);
            if (el) {
                const pickSlot = (e) => {
                    if (e) {
                        e.preventDefault();
                        e.stopPropagation();
                    }
                    Sound.init();
                    Sound.resume();
                    if (this.gameState === 'PLAYING') this.switchWeapon(b.w);
                };
                el.addEventListener('click', pickSlot);
                el.addEventListener('touchstart', pickSlot, { passive: false });
            }
        });

        // UI Buttons
        const startBtn = document.getElementById('start-btn');
        if (startBtn) {
            startBtn.addEventListener('click', () => {
                Sound.init();
                Sound.resume();
                this.startGame();
            });
            startBtn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                Sound.init();
                Sound.resume();
                this.startGame();
            }, { passive: false });
        }

        const restartBtn = document.getElementById('restart-btn');
        if (restartBtn) {
            restartBtn.addEventListener('click', () => {
                this.restartGame();
            });
            restartBtn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.restartGame();
            }, { passive: false });
        }

        // Initialize Mobile Touch System
        this.setupMobileControls();
    }

    setupMobileControls() {
        this.joystickMove = { x: 0, y: 0, active: false };
        this.joystickAim = { x: 0, y: 0, active: false };
        this.isMobileFiring = false;
        this.isScreenFiring = false;
        this.screenTouchAim = new THREE.Vector2();

        // Auto-detect touch capability or small viewport
        this.isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (window.innerWidth <= 1024);
        if (this.isTouchDevice) {
            document.body.classList.add('touch-enabled');
        }

        // Global touch unlock for Web Audio
        const unlockAudio = () => {
            Sound.init();
            Sound.resume();
            window.removeEventListener('touchstart', unlockAudio);
            window.removeEventListener('touchend', unlockAudio);
        };
        window.addEventListener('touchstart', unlockAudio, { passive: true });
        window.addEventListener('touchend', unlockAudio, { passive: true });

        const moveZone = document.getElementById('stick-move-zone');
        const moveBase = document.getElementById('stick-move-base');
        const moveKnob = document.getElementById('stick-move-knob');

        const aimZone = document.getElementById('stick-aim-zone');
        const aimBase = document.getElementById('stick-aim-base');
        const aimKnob = document.getElementById('stick-aim-knob');

        let moveTouchId = null;
        let aimTouchId = null;
        let moveCenter = { x: 0, y: 0 };
        let aimCenter = { x: 0, y: 0 };
        const maxRadius = 45;

        // Dynamic Full-Screen Touch Handling (Left: Move Stick, Right: Aim & Fire)
        window.addEventListener('touchstart', (e) => {
            this.isTouchDevice = true;
            this.isMouseDown = false;
            if (this.gameState !== 'PLAYING') return;

            for (let i = 0; i < e.changedTouches.length; i++) {
                const touch = e.changedTouches[i];
                const target = document.elementFromPoint(touch.clientX, touch.clientY);
                if (target && (
                    target.closest('.mob-btn') || 
                    target.closest('.round-slot') || 
                    target.closest('.hud-weapons') || 
                    target.closest('.hud-top-btn') || 
                    target.closest('.hud-top-buttons') || 
                    target.closest('.hud-vitals') || 
                    target.closest('.radar-container') || 
                    target.closest('.fullscreen-btn') || 
                    target.closest('#help-popup') || 
                    target.closest('#countdown-overlay')
                )) {
                    continue;
                }

                // Left Half: Movement Virtual Stick
                if (touch.clientX < window.innerWidth * 0.45) {
                    if (moveTouchId === null) {
                        moveTouchId = touch.identifier;
                        moveCenter = { x: touch.clientX, y: touch.clientY };
                        if (moveBase) {
                            moveBase.style.position = 'fixed';
                            moveBase.style.left = (touch.clientX - 66) + 'px';
                            moveBase.style.top = (touch.clientY - 66) + 'px';
                            moveBase.style.opacity = '1';
                        }
                        if (moveKnob) moveKnob.style.transform = 'translate(0px, 0px)';
                    }
                }
                // Right Half: Screen Pressing as Instant Aim & Fire
                else {
                    if (aimTouchId === null) {
                        aimTouchId = touch.identifier;
                        this.isScreenFiring = true;
                        this.screenTouchAim.x = (touch.clientX / window.innerWidth) * 2 - 1;
                        this.screenTouchAim.y = -(touch.clientY / window.innerHeight) * 2 + 1;

                        // Immediately raycast to ground plane and rotate operative
                        this.raycaster.setFromCamera(this.screenTouchAim, this.camera);
                        const hit = new THREE.Vector3();
                        if (this.raycaster.ray.intersectPlane(this.groundPlane, hit)) {
                            this.mouseWorld.copy(hit);
                            const toHit = new THREE.Vector3().subVectors(hit, this.player.mesh.position);
                            toHit.y = 0;
                            if (toHit.lengthSq() > 0.01) {
                                this.player.mesh.rotation.y = Math.atan2(toHit.x, toHit.z);
                            }
                        }

                        // Fire immediately on touch contact
                        if (this.player.ammo[this.player.currentWeapon.id] <= 0) {
                            this.reloadCurrentWeapon();
                        } else {
                            this.fireWeapon();
                        }
                    }
                }
            }
        }, { passive: false });

        window.addEventListener('touchmove', (e) => {
            if (this.gameState !== 'PLAYING') return;

            for (let i = 0; i < e.changedTouches.length; i++) {
                const touch = e.changedTouches[i];
                if (touch.identifier === moveTouchId) {
                    e.preventDefault();
                    let dx = touch.clientX - moveCenter.x;
                    let dy = touch.clientY - moveCenter.y;
                    const dist = Math.hypot(dx, dy);
                    if (dist > maxRadius) {
                        dx = (dx / dist) * maxRadius;
                        dy = (dy / dist) * maxRadius;
                    }
                    if (moveKnob) moveKnob.style.transform = `translate(${dx}px, ${dy}px)`;
                    this.joystickMove.x = dx / maxRadius;
                    this.joystickMove.y = dy / maxRadius;
                    this.joystickMove.active = dist > 5;
                } else if (touch.identifier === aimTouchId) {
                    e.preventDefault();
                    this.isScreenFiring = true;
                    this.screenTouchAim.x = (touch.clientX / window.innerWidth) * 2 - 1;
                    this.screenTouchAim.y = -(touch.clientY / window.innerHeight) * 2 + 1;

                    this.raycaster.setFromCamera(this.screenTouchAim, this.camera);
                    const hit = new THREE.Vector3();
                    if (this.raycaster.ray.intersectPlane(this.groundPlane, hit)) {
                        this.mouseWorld.copy(hit);
                        const toHit = new THREE.Vector3().subVectors(hit, this.player.mesh.position);
                        toHit.y = 0;
                        if (toHit.lengthSq() > 0.01) {
                            this.player.mesh.rotation.y = Math.atan2(toHit.x, toHit.z);
                        }
                    }
                }
            }
        }, { passive: false });

        const endTouch = (e) => {
            this.isMouseDown = false;
            for (let i = 0; i < e.changedTouches.length; i++) {
                const touch = e.changedTouches[i];
                if (touch.identifier === moveTouchId) {
                    moveTouchId = null;
                    this.joystickMove.x = 0;
                    this.joystickMove.y = 0;
                    this.joystickMove.active = false;
                    if (moveKnob) moveKnob.style.transform = 'translate(0px, 0px)';
                    if (moveBase) {
                        moveBase.style.position = '';
                        moveBase.style.left = '';
                        moveBase.style.top = '';
                        moveBase.style.opacity = '';
                    }
                } else if (touch.identifier === aimTouchId) {
                    aimTouchId = null;
                    this.isScreenFiring = false;
                    this.joystickAim.x = 0;
                    this.joystickAim.y = 0;
                    this.joystickAim.active = false;
                    if (aimKnob) aimKnob.style.transform = 'translate(0px, 0px)';
                    if (aimBase) {
                        aimBase.style.position = '';
                        aimBase.style.left = '';
                        aimBase.style.top = '';
                        aimBase.style.opacity = '';
                    }
                }
            }

            // Universal Failsafe: if no fingers on screen, immediately stop all sticks and firing
            if (!e.touches || e.touches.length === 0) {
                moveTouchId = null;
                aimTouchId = null;
                this.isScreenFiring = false;
                this.isMobileFiring = false;
                this.isMouseDown = false;
                this.joystickMove.x = 0;
                this.joystickMove.y = 0;
                this.joystickMove.active = false;
                this.joystickAim.x = 0;
                this.joystickAim.y = 0;
                this.joystickAim.active = false;
                if (moveKnob) moveKnob.style.transform = 'translate(0px, 0px)';
                if (aimKnob) aimKnob.style.transform = 'translate(0px, 0px)';
                if (moveBase) {
                    moveBase.style.position = '';
                    moveBase.style.left = '';
                    moveBase.style.top = '';
                    moveBase.style.opacity = '';
                }
                if (aimBase) {
                    aimBase.style.position = '';
                    aimBase.style.left = '';
                    aimBase.style.top = '';
                    aimBase.style.opacity = '';
                }
                const fireBtn = document.getElementById('btn-mob-fire');
                if (fireBtn) fireBtn.classList.remove('firing');
            }
        };

        window.addEventListener('touchend', endTouch, { passive: true });
        window.addEventListener('touchcancel', endTouch, { passive: true });

        // Action Buttons Binding
        const bindTouchAction = (id, callback) => {
            const btn = document.getElementById(id);
            if (!btn) return;
            btn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                e.stopPropagation();
                Sound.init();
                Sound.resume();
                callback();
            }, { passive: false });
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                Sound.init();
                Sound.resume();
                callback();
            });
        };

        bindTouchAction('btn-mob-dash', () => this.triggerDash());
        bindTouchAction('btn-mob-flare', () => this.throwTacticalFlare());
        bindTouchAction('btn-mob-reload', () => this.reloadCurrentWeapon());
        bindTouchAction('btn-mob-weapon', () => {
            const weaponList = [WEAPONS.CARBINE, WEAPONS.SHOTGUN, WEAPONS.ARC, WEAPONS.SINGULARITY];
            let idx = weaponList.findIndex(w => w.id === this.player.currentWeapon.id);
            idx = (idx + 1) % weaponList.length;
            this.switchWeapon(weaponList[idx]);
        });

        // Dedicated Primary FIRE Button on Mobile
        const fireBtn = document.getElementById('btn-mob-fire');
        if (fireBtn) {
            const startFire = (e) => {
                if (e) {
                    e.preventDefault();
                    e.stopPropagation();
                }
                Sound.init();
                Sound.resume();
                this.isMobileFiring = true;
                fireBtn.classList.add('firing');
                if (this.player.ammo[this.player.currentWeapon.id] <= 0) {
                    this.reloadCurrentWeapon();
                } else {
                    this.fireWeaponMobileAuto();
                }
            };
            const stopFire = (e) => {
                if (e) {
                    e.preventDefault();
                    e.stopPropagation();
                }
                this.isMobileFiring = false;
                fireBtn.classList.remove('firing');
            };
            fireBtn.addEventListener('touchstart', startFire, { passive: false });
            fireBtn.addEventListener('touchend', stopFire, { passive: false });
            fireBtn.addEventListener('touchcancel', stopFire, { passive: false });
            fireBtn.addEventListener('mousedown', startFire);
            fireBtn.addEventListener('mouseup', stopFire);
            fireBtn.addEventListener('mouseleave', stopFire);
        }

        // Fullscreen Toggle
        const toggleFullscreen = () => {
            if (!document.fullscreenElement && !document.webkitFullscreenElement) {
                const docEl = document.documentElement;
                if (docEl.requestFullscreen) docEl.requestFullscreen().catch(() => {});
                else if (docEl.webkitRequestFullscreen) docEl.webkitRequestFullscreen();
            } else {
                if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
                else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
            }
        };

        const fsBtn = document.getElementById('btn-fullscreen-toggle');
        if (fsBtn) {
            fsBtn.addEventListener('click', toggleFullscreen);
            fsBtn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                toggleFullscreen();
            }, { passive: false });
        }

        // Tactical Help Popup: Pause during reading & 3-2-1 Countdown on close
        const helpPopup = document.getElementById('help-popup');
        const openHelp = () => {
            if (this.gameState === 'PLAYING') {
                this.wasPlayingBeforeHelp = true;
                this.gameState = 'PAUSED';
            }
            if (helpPopup) helpPopup.style.display = 'flex';
        };
        const closeHelp = () => {
            if (helpPopup) helpPopup.style.display = 'none';
            if (this.wasPlayingBeforeHelp) {
                this.wasPlayingBeforeHelp = false;
                this.startResumeCountdown();
            }
        };

        const helpBtn = document.getElementById('btn-help-toggle');
        if (helpBtn) {
            helpBtn.addEventListener('click', openHelp);
            helpBtn.addEventListener('touchstart', (e) => { e.preventDefault(); openHelp(); }, { passive: false });
        }

        const closeBtn = document.getElementById('btn-close-help');
        if (closeBtn) {
            closeBtn.addEventListener('click', closeHelp);
            closeBtn.addEventListener('touchstart', (e) => { e.preventDefault(); closeHelp(); }, { passive: false });
        }

        const dismissBtn = document.getElementById('btn-dismiss-help');
        if (dismissBtn) {
            dismissBtn.addEventListener('click', closeHelp);
            dismissBtn.addEventListener('touchstart', (e) => { e.preventDefault(); closeHelp(); }, { passive: false });
        }
    }

    startResumeCountdown() {
        const overlay = document.getElementById('countdown-overlay');
        const numElem = document.getElementById('countdown-number');
        if (!overlay || !numElem) {
            this.lastTime = performance.now();
            this.gameState = 'PLAYING';
            return;
        }

        overlay.style.display = 'flex';
        let count = 3;
        numElem.textContent = count;
        numElem.style.color = '#00ffff';
        Sound.playCountdownTick(false);

        if (this.countdownTimer) clearInterval(this.countdownTimer);
        this.countdownTimer = setInterval(() => {
            count--;
            if (count > 0) {
                numElem.textContent = count;
                numElem.style.animation = 'none';
                numElem.offsetHeight;
                numElem.style.animation = null;
                Sound.playCountdownTick(false);
            } else if (count === 0) {
                numElem.textContent = 'ENGAGE!';
                numElem.style.color = '#00ffaa';
                numElem.style.animation = 'none';
                numElem.offsetHeight;
                numElem.style.animation = null;
                Sound.playCountdownTick(true);
            } else {
                clearInterval(this.countdownTimer);
                this.countdownTimer = null;
                overlay.style.display = 'none';
                this.isMouseDown = false;
                this.isScreenFiring = false;
                this.isMobileFiring = false;
                this.lastTime = performance.now();
                this.gameState = 'PLAYING';
            }
        }, 850);
    }

    switchWeapon(weapon) {
        this.player.currentWeapon = weapon;
        Sound.playUpgradeSelect();
        this.updateHUD();
    }

    reloadCurrentWeapon() {
        const p = this.player;
        const maxCap = p.currentWeapon.ammoCapacity;
        p.ammo[p.currentWeapon.id] = maxCap;
        Sound.playUpgradeSelect();
        this.updateHUD();

        // Visual flash feedback on Reload button
        const rBtn = document.getElementById('btn-mob-reload');
        if (rBtn) {
            rBtn.classList.add('active-reload');
            setTimeout(() => rBtn.classList.remove('active-reload'), 350);
        }
    }

    fireWeaponMobileAuto() {
        const p = this.player;
        let nearestAlien = null;
        let minDistSq = 35 * 35;
        for (let a of this.alienMgr.aliens) {
            if (!a.alive) continue;
            const d2 = p.mesh.position.distanceToSquared(a.mesh.position);
            if (d2 < minDistSq) {
                minDistSq = d2;
                nearestAlien = a;
            }
        }

        if (nearestAlien) {
            const toAlien = new THREE.Vector3().subVectors(nearestAlien.mesh.position, p.mesh.position);
            toAlien.y = 0;
            const rotY = Math.atan2(toAlien.x, toAlien.z);
            p.mesh.rotation.y = rotY;
            this.mouseWorld.copy(nearestAlien.mesh.position);
        } else if (this.joystickMove && this.joystickMove.active) {
            const rotY = Math.atan2(this.joystickMove.x, this.joystickMove.y);
            p.mesh.rotation.y = rotY;
            this.mouseWorld.set(
                p.mesh.position.x + Math.sin(rotY) * 25,
                0,
                p.mesh.position.z + Math.cos(rotY) * 25
            );
        }
        this.fireWeapon();
    }

    fireWeapon() {
        const p = this.player;
        if (p.ammo[p.currentWeapon.id] <= 0) {
            // Out of ammo: stop firing immediately until player reloads with [R] or reload button!
            return;
        }

        const recoil = this.weaponMgr.fire(
            this.player,
            this.player.currentWeapon,
            this.mouseWorld,
            this.perks
        );

        if (recoil) {
            this.screenShake = Math.min(1.2, this.screenShake + recoil * 0.15);
            if (this.player.anim) this.player.anim.recoil = 0.14;
            this.updateHUD();
        }
    }

    throwTacticalFlare() {
        if (this.player.flares <= 0) return;
        this.player.flares--;

        let dir = new THREE.Vector3().subVectors(this.mouseWorld, this.player.mesh.position);
        dir.y = 0;
        if (dir.lengthSq() < 0.1) dir = this.player.getForwardVector();
        this.weaponMgr.throwFlare(this.player.mesh.position, dir.normalize());
        this.updateHUD();
    }

    triggerDash() {
        if (this.player.dashCooldown > 0 || this.player.isDashing) return;

        // Compute dash direction from movement keys, virtual joystick, or forward
        const moveVec = new THREE.Vector3();
        if (this.keys['w'] || this.keys['arrowup']) moveVec.z -= 1;
        if (this.keys['s'] || this.keys['arrowdown']) moveVec.z += 1;
        if (this.keys['a'] || this.keys['arrowleft']) moveVec.x -= 1;
        if (this.keys['d'] || this.keys['arrowright']) moveVec.x += 1;

        if (this.joystickMove && this.joystickMove.active) {
            moveVec.x += this.joystickMove.x;
            moveVec.z += this.joystickMove.y;
        }

        if (moveVec.lengthSq() > 0.05) {
            this.player.dashDir = moveVec.normalize();
        } else {
            this.player.dashDir = this.player.getForwardVector().normalize();
        }

        this.player.isDashing = true;
        this.player.dashTimer = 0.22;
        this.player.dashCooldown = 1.4;
        this.player.invulnTimer = 0.25;

        // Backpack jet-thruster blue spark burst
        this.weaponMgr.spawnSparks(this.player.mesh.position.clone().add(new THREE.Vector3(0, 1.2, -0.4)), 0x00ffff, 16);
        Sound.playDash();
    }

    // ------------------------------------------------------------------------
    // GAMEPLAY FLOW & WAVE SYSTEM
    // ------------------------------------------------------------------------
    startGame() {
        this.isMouseDown = false;
        this.isScreenFiring = false;
        this.isMobileFiring = false;
        this.gameState = 'PLAYING';
        document.getElementById('start-screen').style.display = 'none';
        document.getElementById('hud').style.display = 'block';
        this.startWave(1);
    }

    restartGame() {
        this.isMouseDown = false;
        this.isScreenFiring = false;
        this.isMobileFiring = false;
        document.getElementById('game-over-screen').style.display = 'none';
        document.getElementById('upgrade-modal').style.display = 'none';

        // Clear active aliens & hazards
        for (let a of this.alienMgr.aliens) this.scene.remove(a.mesh);
        for (let ap of this.alienMgr.acidPools) this.scene.remove(ap.mesh);
        for (let f of this.weaponMgr.flares) {
            this.scene.remove(f.mesh);
            this.scene.remove(f.light);
        }
        this.alienMgr.aliens = [];
        this.alienMgr.acidPools = [];
        this.weaponMgr.flares = [];

        // Reset player
        this.player.health = 100;
        this.player.flares = 4;
        this.player.mesh.position.set(0, 0, 0);
        this.player.refillAmmo();

        this.score = 0;
        this.killCount = 0;
        this.wave = 1;
        this.gameState = 'PLAYING';
        this.startWave(1);
    }

    startWave(num) {
        this.wave = num;
        this.isWaveBreak = false;
        this.waveAliensTotal = 8 + num * 5;
        this.waveAliensSpawned = 0;
        this.waveSpawnTimer = 0;

        Sound.playWaveAlarm();
        this.updateHUD();
    }

    triggerWaveBreak() {
        this.isWaveBreak = true;
        this.waveBreakTimer = 3.0; // Short pause before perk upgrade selection
    }

    showUpgradeModal() {
        this.gameState = 'UPGRADE';
        const modal = document.getElementById('upgrade-modal');
        const container = document.getElementById('upgrade-cards');
        container.innerHTML = '';

        const allPerks = [
            {
                title: 'High-Energy Capacitors',
                desc: '+35% Weapon Fire Rate & Quick Velocity',
                apply: () => { this.perks.fireRateMult *= 0.65; }
            },
            {
                title: 'Bouncing Tungsten Rounds',
                desc: 'Projectiles ricochet off containment walls into enemies',
                apply: () => { this.perks.bouncingRounds = true; }
            },
            {
                title: 'Orbital Defense Drone',
                desc: 'Deploys an automated support drone firing plasma beams',
                apply: () => {
                    this.perks.droneActive = true;
                    this.drone.mesh.visible = true;
                }
            },
            {
                title: 'Nanite Biometric Repair',
                desc: 'Continuously regenerates player health over time',
                apply: () => { this.perks.healthRegen = true; }
            },
            {
                title: 'Uranium Hollow-Points',
                desc: '+40% Weapon Damage across all firearms',
                apply: () => { this.perks.damageMult *= 1.4; }
            },
            {
                title: 'Hydraulic Exo-Stems',
                desc: '+25% Movement and Dash sprint speed',
                apply: () => { this.perks.speedMult *= 1.25; }
            }
        ];

        // Pick 3 random
        const shuffled = allPerks.sort(() => 0.5 - Math.random()).slice(0, 3);
        shuffled.forEach(perk => {
            const card = document.createElement('div');
            card.className = 'upgrade-card';
            card.innerHTML = `<h3>${perk.title}</h3><p>${perk.desc}</p><button class="btn-select">INSTALL PROTOCOL</button>`;
            card.querySelector('button').addEventListener('click', () => {
                perk.apply();
                Sound.playUpgradeSelect();
                modal.style.display = 'none';
                this.gameState = 'PLAYING';
                this.startWave(this.wave + 1);
            });
            container.appendChild(card);
        });

        modal.style.display = 'flex';
    }

    showTransmission(text) {
        const elem = document.getElementById('transmission-log');
        if (!elem) return;
        elem.textContent = text;
        elem.style.opacity = '1';
        clearTimeout(this.transTimeout);
        this.transTimeout = setTimeout(() => {
            if (elem) elem.style.opacity = '0';
        }, 5000);
    }

    onPlayerTakeDamage(amt) {
        if (this.player.invulnTimer > 0) return;

        this.player.health -= amt;
        this.player.invulnTimer = 0.35;
        this.screenShake = 0.8;

        Sound.playPlayerHit();

        // Screen red flash
        const flash = document.getElementById('damage-flash');
        flash.style.opacity = '0.7';
        setTimeout(() => { flash.style.opacity = '0'; }, 150);

        // Emergency EMP Perk check
        if (this.player.health <= 25 && this.perks.empReady) {
            this.perks.empReady = false;
            this.triggerEmergencyEMP();
        }

        if (this.player.health <= 0) {
            this.player.health = 0;
            this.gameOver();
        }

        this.updateHUD();
    }

    triggerEmergencyEMP() {
        Sound.playExplosion();
        this.weaponMgr.spawnSparks(this.player.mesh.position, 0x00ffff, 50);

        // Stun / push back all aliens
        for (let a of this.alienMgr.aliens) {
            const push = new THREE.Vector3().subVectors(a.mesh.position, this.player.mesh.position).normalize().multiplyScalar(20);
            a.takeDamage(50, push);
        }
        this.showTransmission("EMERGENCY BIO-EMP DISCHARGED! Surrounding hostiles neutralized.");
    }

    gameOver() {
        this.gameState = 'GAMEOVER';
        document.getElementById('final-score').textContent = this.score;
        document.getElementById('final-wave').textContent = this.wave;
        document.getElementById('final-kills').textContent = this.killCount;
        document.getElementById('game-over-screen').style.display = 'flex';
    }

    // ------------------------------------------------------------------------
    // COLLISION & COMBAT RESOLUTION
    // ------------------------------------------------------------------------
    handleAlienHit(alien, proj) {
        const pushDir = proj.dir.clone().multiplyScalar(proj.weapon.recoil * 1.5);
        alien.takeDamage(proj.damage, pushDir);

        // Immediate score feedback on every successful projectile hit
        this.score += 10 * this.combo;
        this.updateHUD();

        if (!alien.alive) {
            this.onAlienKilled(alien);
        }
    }

    onAlienKilled(alien) {
        this.killCount++;
        this.combo++;
        this.comboTimer = 2.5;

        const pts = alien.scoreValue * this.combo;
        this.score += pts;

        // Chance to spawn pickup
        const roll = Math.random();
        if (roll < 0.25) {
            this.env.spawnPickup('HEALTH', alien.mesh.position);
        } else if (roll < 0.50) {
            this.env.spawnPickup('AMMO', alien.mesh.position);
        } else if (roll < 0.65) {
            this.env.spawnPickup('FLARE', alien.mesh.position);
        }

        this.updateHUD();
    }

    // ------------------------------------------------------------------------
    // ENGINE LOOP & PHYSICS
    // ------------------------------------------------------------------------
    animate() {
        requestAnimationFrame(this.animate);

        const now = performance.now();
        const dt = Math.min((now - this.lastTime) / 1000, 0.1);
        this.lastTime = now;

        if (this.gameState === 'PLAYING') {
            this.updatePlayer(dt);
            this.updateCombat(dt);
            this.updateAliensAndSpawns(dt);
            this.updateEnvironment(dt);
            this.updateDrone(dt);
            this.updateWaypoints(dt);
            this.updateThrillerAudio();
            this.updateRadar(dt);
        }

        this.updateCamera(dt);
        this.renderer.render(this.scene, this.camera);
    }

    updatePlayer(dt) {
        const p = this.player;

        // Invulnerability timer
        if (p.invulnTimer > 0) p.invulnTimer -= dt;

        // Passive Health Regen perk
        if (this.perks.healthRegen && p.health < p.maxHealth) {
            p.health = Math.min(p.maxHealth, p.health + 4.0 * dt);
            this.updateHUD();
        }

        // Dash state
        if (p.dashCooldown > 0) p.dashCooldown -= dt;

        if (p.isDashing) {
            p.dashTimer -= dt;
            const dashSpeed = p.speed * 2.8 * (this.perks.speedMult || 1.0);
            p.mesh.position.addScaledVector(p.dashDir, dashSpeed * dt);

            if (p.dashTimer <= 0) {
                p.isDashing = false;
            }
        } else {
            // Movement input (Keyboard + Touch Joystick)
            const move = new THREE.Vector3();
            if (this.keys['w'] || this.keys['arrowup']) move.z -= 1;
            if (this.keys['s'] || this.keys['arrowdown']) move.z += 1;
            if (this.keys['a'] || this.keys['arrowleft']) move.x -= 1;
            if (this.keys['d'] || this.keys['arrowright']) move.x += 1;

            if (this.joystickMove && this.joystickMove.active) {
                move.x += this.joystickMove.x;
                move.z += this.joystickMove.y;
            }

            const moveLen = move.length();
            if (moveLen > 0.05) {
                const moveNorm = move.clone().divideScalar(moveLen);
                const analogSpeed = Math.min(1.0, moveLen) * (this.perks.speedMult || 1.0);
                const actualSpeed = p.speed * analogSpeed;
                const nextPos = p.mesh.position.clone().addScaledVector(moveNorm, actualSpeed * dt);

                // Wall Collision Check
                if (!this.checkWallCollision(nextPos, 0.6)) {
                    p.mesh.position.copy(nextPos);
                } else {
                    // Try sliding on X
                    const tryX = p.mesh.position.clone().add(new THREE.Vector3(moveNorm.x * actualSpeed * dt, 0, 0));
                    if (!this.checkWallCollision(tryX, 0.6)) p.mesh.position.copy(tryX);
                    // Try sliding on Z
                    const tryZ = p.mesh.position.clone().add(new THREE.Vector3(0, 0, moveNorm.z * actualSpeed * dt));
                    if (!this.checkWallCollision(tryZ, 0.6)) p.mesh.position.copy(tryZ);
                }
            }

            // Procedural walking kinematics animation
            const isMoving = moveLen > 0.05;
            if (p.anim && p.bones && p.bones.leftLeg) {
                if (isMoving) {
                    p.anim.walkCycle += dt * 14.0;
                    p.bones.leftLeg.rotation.x = Math.sin(p.anim.walkCycle) * 0.55;
                    p.bones.rightLeg.rotation.x = -Math.sin(p.anim.walkCycle) * 0.55;
                    p.bones.torsoGroup.position.y = 1.0 + Math.abs(Math.sin(p.anim.walkCycle)) * 0.05;
                    p.bones.gunGroup.position.x = 0.28 + Math.sin(p.anim.walkCycle * 0.5) * 0.02;
                } else {
                    p.bones.leftLeg.rotation.x = THREE.MathUtils.lerp(p.bones.leftLeg.rotation.x, 0, dt * 10);
                    p.bones.rightLeg.rotation.x = THREE.MathUtils.lerp(p.bones.rightLeg.rotation.x, 0, dt * 10);
                    p.bones.torsoGroup.position.y = THREE.MathUtils.lerp(p.bones.torsoGroup.position.y, 1.0, dt * 8);
                    p.bones.gunGroup.position.x = 0.28;
                }
            }
        }

        // Procedural weapon recoil kickback & recovery
        if (p.anim && p.bones && p.bones.gunGroup) {
            if (p.anim.recoil > 0.001) {
                p.anim.recoil = THREE.MathUtils.lerp(p.anim.recoil, 0, dt * 16);
                p.bones.gunGroup.position.z = 0.45 - p.anim.recoil;
                p.bones.gunGroup.rotation.x = -p.anim.recoil * 0.4;
            } else {
                p.bones.gunGroup.position.z = 0.45;
                p.bones.gunGroup.rotation.x = 0;
            }
        }

        // Apply knockback
        if (p.knockback.lengthSq() > 0.01) {
            p.mesh.position.addScaledVector(p.knockback, dt);
            p.knockback.multiplyScalar(0.85); // Damping
        }

        // Aiming & Rotation (STRICT: Zero firing without active touch or mouse hold)
        if (this.isScreenFiring) {
            // Mobile: Screen touch held - raycast to touch point and continuous fire
            this.raycaster.setFromCamera(this.screenTouchAim, this.camera);
            const hit = new THREE.Vector3();
            if (this.raycaster.ray.intersectPlane(this.groundPlane, hit)) {
                this.mouseWorld.copy(hit);
                const toHit = new THREE.Vector3().subVectors(hit, p.mesh.position);
                toHit.y = 0;
                if (toHit.lengthSq() > 0.01) {
                    p.mesh.rotation.y = Math.atan2(toHit.x, toHit.z);
                }
            }
            if (p.ammo[p.currentWeapon.id] <= 0) {
                this.reloadCurrentWeapon();
            } else {
                this.fireWeapon();
            }
        } else if (this.isMobileFiring) {
            // Mobile: Dedicated FIRE button held - auto-target closest alien and continuous fire
            if (p.ammo[p.currentWeapon.id] <= 0) {
                this.reloadCurrentWeapon();
            } else {
                this.fireWeaponMobileAuto();
            }
        } else if (this.joystickAim && this.joystickAim.active) {
            // Mobile: Aim stick pulled - direct fire in stick direction
            const rotY = Math.atan2(this.joystickAim.x, this.joystickAim.y);
            p.mesh.rotation.y = rotY;
            this.mouseWorld.set(
                p.mesh.position.x + Math.sin(rotY) * 25,
                0,
                p.mesh.position.z + Math.cos(rotY) * 25
            );
            if (p.ammo[p.currentWeapon.id] <= 0) {
                this.reloadCurrentWeapon();
            } else {
                this.fireWeapon();
            }
        } else if (this.isTouchDevice && this.joystickMove && this.joystickMove.active) {
            // Mobile moving without firing: Face movement heading (NO FIRING)
            const rotY = Math.atan2(this.joystickMove.x, this.joystickMove.y);
            p.mesh.rotation.y = THREE.MathUtils.lerp(p.mesh.rotation.y, rotY, dt * 10);
            this.mouseWorld.set(
                p.mesh.position.x + Math.sin(rotY) * 25,
                0,
                p.mesh.position.z + Math.cos(rotY) * 25
            );
            // No firing when only moving!
        } else {
            // Desktop mouse raycasting onto ground plane
            this.raycaster.setFromCamera(this.mousePos, this.camera);
            const hit = new THREE.Vector3();
            if (this.raycaster.ray.intersectPlane(this.groundPlane, hit)) {
                this.mouseWorld.copy(hit);
                const toMouse = new THREE.Vector3().subVectors(hit, p.mesh.position);
                toMouse.y = 0;
                const rotY = Math.atan2(toMouse.x, toMouse.z);
                p.mesh.rotation.y = rotY;
            }

            // Desktop continuous firing ONLY when actively holding Left Mouse Button
            if (this.isMouseDown) {
                this.fireWeapon();
            }
        }
    }

    checkWallCollision(pos, radius) {
        for (let w = 0; w < this.env.walls.length; w++) {
            const wall = this.env.walls[w];
            // Check Box3 expansion by radius
            const expanded = wall.box.clone().expandByScalar(radius);
            if (expanded.containsPoint(pos)) {
                return true;
            }
        }
        return false;
    }

    updateCombat(dt) {
        // Update projectiles, flares, vortices
        this.weaponMgr.update(
            dt,
            this.alienMgr.aliens,
            this.env.walls,
            (alien, proj) => this.handleAlienHit(alien, proj),
            (pos, weapon) => this.weaponMgr.spawnVortex(pos, weapon)
        );

        // Check if bullets hit explosive barrels
        for (let p of this.weaponMgr.projectiles) {
            for (let b of this.env.barrels) {
                if (b.alive && p.pos.distanceTo(b.pos) < b.radius) {
                    this.env.explodeBarrel(b, this.weaponMgr, this.alienMgr.aliens, this.player);
                    p.alive = false;
                    break;
                }
            }
        }

        // Combo decay
        if (this.comboTimer > 0) {
            this.comboTimer -= dt;
            if (this.comboTimer <= 0) {
                this.combo = 1;
                this.updateHUD();
            }
        }
    }

    updateAliensAndSpawns(dt) {
        // Wave Spawner
        if (!this.isWaveBreak) {
            this.waveSpawnTimer -= dt;
            if (this.waveSpawnTimer <= 0 && this.waveAliensSpawned < this.waveAliensTotal) {
                this.waveSpawnTimer = Math.max(0.6, 2.2 - this.wave * 0.18);
                this.spawnNextWaveAlien();
            }

            // Check if wave finished
            if (this.waveAliensSpawned >= this.waveAliensTotal && this.alienMgr.aliens.length === 0) {
                this.triggerWaveBreak();
            }
        } else {
            this.waveBreakTimer -= dt;
            if (this.waveBreakTimer <= 0) {
                this.showUpgradeModal();
            }
        }

        // Update Aliens AI
        this.alienMgr.update(dt, this.player, this.env.walls, this.weaponMgr);
    }

    spawnNextWaveAlien() {
        this.waveAliensSpawned++;

        // Select alien type based on wave progression
        let type = 'SCUTTLER';
        const roll = Math.random();

        if (this.wave === 5 && this.waveAliensSpawned === this.waveAliensTotal) {
            // Boss spawn!
            type = 'BOSS';
            this.showTransmission("CRITICAL THREAT: BIO-MATRIARCH HAS BREACHED CONTAINMENT!");
        } else if (this.wave >= 4 && roll < 0.25) {
            type = 'PHANTOM';
        } else if (this.wave >= 3 && roll < 0.28) {
            type = 'BEHEMOTH';
        } else if (this.wave >= 2 && roll < 0.45) {
            type = 'SPITTER';
        }

        // Spawn position outside player's direct sightline
        const angle = Math.random() * Math.PI * 2;
        const dist = 28 + Math.random() * 15;
        const spawnPos = this.player.mesh.position.clone().add(
            new THREE.Vector3(Math.cos(angle) * dist, 0, Math.sin(angle) * dist)
        );

        // Clamp inside map boundaries
        spawnPos.x = Math.max(-48, Math.min(48, spawnPos.x));
        spawnPos.z = Math.max(-48, Math.min(48, spawnPos.z));

        this.alienMgr.spawnAlien(type, spawnPos);
    }

    updateEnvironment(dt) {
        this.env.update(dt, this.player, this.alienMgr.aliens, this.weaponMgr);
    }

    updateDrone(dt) {
        if (!this.perks.droneActive) return;

        this.drone.angle += 2.2 * dt;
        const orbitRadius = 2.4;
        const dronePos = this.player.mesh.position.clone().add(
            new THREE.Vector3(Math.cos(this.drone.angle) * orbitRadius, 1.8, Math.sin(this.drone.angle) * orbitRadius)
        );
        this.drone.mesh.position.copy(dronePos);

        // Drone auto-fires laser at closest alien within 18 units
        const now = performance.now() / 1000;
        if (now - this.drone.lastFire > 0.8) {
            let closest = null;
            let minDist = 18;
            for (let a of this.alienMgr.aliens) {
                if (!a.alive) continue;
                const d = dronePos.distanceTo(a.mesh.position);
                if (d < minDist) {
                    minDist = d;
                    closest = a;
                }
            }

            if (closest) {
                this.drone.lastFire = now;
                this.weaponMgr.createLightningBeam(dronePos, closest.mesh.position, 0x00ffff);
                closest.takeDamage(32, new THREE.Vector3());
                Sound.playShootArc();
            }
        }
    }

    // ------------------------------------------------------------------------
    // THRILLER AUDIO & MOTION TRACKER RADAR
    // ------------------------------------------------------------------------
    updateThrillerAudio() {
        // Find distance to closest lurking alien
        let minDist = 999;
        for (let a of this.alienMgr.aliens) {
            if (!a.alive) continue;
            const d = this.player.mesh.position.distanceTo(a.mesh.position);
            if (d < minDist) minDist = d;
        }

        // Factor heartbeat panic from both distance and low health
        const proximityPanic = Math.max(0, 1 - (minDist / 20));
        const healthPanic = Math.max(0, 1 - (this.player.health / 100));
        const totalPanic = Math.max(proximityPanic, healthPanic);

        Sound.setHeartbeatIntensity(totalPanic);
    }

    updateRadar(dt) {
        // Radar sweep rotation
        this.radarSweepAngle += 3.5 * dt;
        if (this.radarSweepAngle > Math.PI * 2) {
            this.radarSweepAngle -= Math.PI * 2;
        }

        this.radarPingTimer -= dt;
        if (this.radarPingTimer <= 0) {
            this.radarPingTimer = 1.8;
            if (this.alienMgr.aliens.length > 0) {
                Sound.playMotionTrackerPing();
            }
        }

        // Draw Motion Tracker Radar
        const ctx = this.radarCtx;
        const w = this.radarCanvas.width;
        const h = this.radarCanvas.height;
        const cx = w / 2;
        const cy = h / 2;
        const r = w / 2 - 4;

        // Clear with fade trail
        ctx.fillStyle = 'rgba(6, 12, 10, 0.25)';
        ctx.fillRect(0, 0, w, h);

        // Circular grid rings
        ctx.strokeStyle = '#00ff6633';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.33, 0, Math.PI * 2);
        ctx.arc(cx, cy, r * 0.66, 0, Math.PI * 2);
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();

        // Crosshairs
        ctx.beginPath();
        ctx.moveTo(cx, 4); ctx.lineTo(cx, h - 4);
        ctx.moveTo(4, cy); ctx.lineTo(w - 4, cy);
        ctx.stroke();

        // Rotating Sweep Line
        ctx.strokeStyle = '#39ff14';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(this.radarSweepAngle) * r, cy + Math.sin(this.radarSweepAngle) * r);
        ctx.stroke();

        // Radar Blips for Aliens
        const radarRange = 40; // World units
        for (let a of this.alienMgr.aliens) {
            if (!a.alive) continue;
            const relX = a.mesh.position.x - this.player.mesh.position.x;
            const relZ = a.mesh.position.z - this.player.mesh.position.z;
            const dist = Math.sqrt(relX * relX + relZ * relZ);

            if (dist < radarRange) {
                const mapRatio = dist / radarRange;
                const blipAngle = Math.atan2(relZ, relX);
                const bx = cx + Math.cos(blipAngle) * (mapRatio * r);
                const by = cy + Math.sin(blipAngle) * (mapRatio * r);

                ctx.fillStyle = a.type === 'BOSS' ? '#ff0000' : (a.type === 'PHANTOM' ? '#cc00ff' : '#39ff14');
                ctx.beginPath();
                ctx.arc(bx, by, a.type === 'BOSS' ? 5 : 3.5, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    // ------------------------------------------------------------------------
    // CAMERA & HUD
    // ------------------------------------------------------------------------
    updateCamera(dt) {
        // Camera smooth follow player with subtle look-ahead towards cursor
        const targetCam = this.player.mesh.position.clone();
        targetCam.y += 24; // Isometric height
        targetCam.z += 14; // Angle back

        // Look-ahead
        const lookAhead = new THREE.Vector3().subVectors(this.mouseWorld, this.player.mesh.position).multiplyScalar(0.12);
        targetCam.add(lookAhead);

        // Screen Shake
        if (this.screenShake > 0) {
            targetCam.x += (Math.random() - 0.5) * this.screenShake * 2.2;
            targetCam.z += (Math.random() - 0.5) * this.screenShake * 2.2;
            this.screenShake = Math.max(0, this.screenShake - 3.5 * dt);
        }

        this.camera.position.lerp(targetCam, 7.5 * dt);
        this.camera.lookAt(this.player.mesh.position.x, 0, this.player.mesh.position.z);
    }

    updateHUD() {
        const p = this.player;
        document.getElementById('health-bar').style.width = `${Math.max(0, p.health)}%`;
        document.getElementById('health-val').textContent = `${Math.ceil(p.health)} / ${p.maxHealth}`;

        const curAmmo = p.ammo[p.currentWeapon.id];
        document.getElementById('ammo-val').textContent = `${curAmmo} / ${p.currentWeapon.ammoCapacity}`;
        document.getElementById('weapon-name').textContent = p.currentWeapon.name;
        document.getElementById('flare-count').textContent = p.flares;

        document.getElementById('score-val').textContent = this.score;
        document.getElementById('wave-val').textContent = this.wave;
        document.getElementById('combo-val').textContent = `x${this.combo}`;

        // Highlight active arsenal slot
        const slotMap = { 'CARBINE': 'slot-1', 'SHOTGUN': 'slot-2', 'ARC': 'slot-3', 'SINGULARITY': 'slot-4' };
        ['slot-1', 'slot-2', 'slot-3', 'slot-4'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.remove('active');
        });
        const activeSlot = document.getElementById(slotMap[p.currentWeapon.id]);
        if (activeSlot) activeSlot.classList.add('active');

        // Update mobile round weapon button: visual icon & dynamic neon plasma glow
        const mobIcon = document.getElementById('mob-weapon-icon');
        const mobBtn = document.getElementById('btn-mob-weapon');
        const weaponVisuals = {
            'CARBINE': { icon: '🔫', color: '#00d2ff' },
            'SHOTGUN': { icon: '💥', color: '#ff7700' },
            'ARC': { icon: '⚡', color: '#aa44ff' },
            'SINGULARITY': { icon: '🌀', color: '#ff00aa' }
        };
        const curVis = weaponVisuals[p.currentWeapon.id] || { icon: '🔫', color: '#00d2ff' };
        if (mobIcon) {
            mobIcon.textContent = curVis.icon;
        }
        if (mobBtn) {
            mobBtn.style.borderColor = curVis.color;
            mobBtn.style.boxShadow = `0 0 16px ${curVis.color}`;
        }
    }

    // ------------------------------------------------------------------------
    // HOLOGRAPHIC 3D WAYPOINTS & HELPLINES
    // ------------------------------------------------------------------------
    initWaypoints() {
        const group = new THREE.Group();

        // Pulsating Hologram Ground Ring
        const ringGeom = new THREE.RingGeometry(1.4, 1.8, 24);
        ringGeom.rotateX(-Math.PI / 2);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, side: THREE.DoubleSide });
        const ring = new THREE.Mesh(ringGeom, ringMat);
        ring.position.y = 0.15;
        group.add(ring);

        // Bouncing Hologram Marker Arrow
        const arrowGeom = new THREE.ConeGeometry(0.55, 1.2, 4);
        arrowGeom.rotateX(Math.PI);
        const arrowMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, wireframe: true });
        const arrow = new THREE.Mesh(arrowGeom, arrowMat);
        arrow.position.y = 3.6;
        group.add(arrow);

        group.position.set(0, 0, 0); // Position at central core terminal
        this.scene.add(group);

        this.beaconGroup = group;
        this.beaconRing = ring;
        this.beaconArrow = arrow;
    }

    updateWaypoints(dt) {
        if (!this.beaconGroup) return;
        const now = performance.now() * 0.003;
        this.beaconArrow.position.y = 3.6 + Math.sin(now * 3.5) * 0.45;
        this.beaconArrow.rotation.y += 2.5 * dt;
        this.beaconRing.rotation.z += 1.8 * dt;

        // Check if core terminal is powered
        const coreTerm = this.env.terminals[0];
        if (coreTerm && coreTerm.activated) {
            this.beaconArrow.material.color.setHex(0x39ff14);
            this.beaconRing.material.color.setHex(0x39ff14);
        } else {
            this.beaconArrow.material.color.setHex(0x00ffff);
            this.beaconRing.material.color.setHex(0x00ffff);
        }
    }

    showInGameHelpline(text, duration = 5.0) {
        const elem = document.getElementById('in-game-helpline');
        const txt = document.getElementById('helpline-text');
        if (!elem || !txt) return;

        txt.textContent = text;
        elem.style.display = 'flex';
        elem.style.opacity = '1';

        clearTimeout(this.helplineTimeout);
        this.helplineTimeout = setTimeout(() => {
            elem.style.opacity = '0';
            setTimeout(() => { elem.style.display = 'none'; }, 400);
        }, duration * 1000);
    }

    initHelplineSim() {
        const canvas = document.getElementById('helpline-sim-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const ticker = document.getElementById('helpline-ticker');

        const tips = [
            "⚡ TIP 1: THROW FLARES [F / RMB] TO EXPOSE CLOAKED SHADOW PHANTOMS!",
            "⚡ TIP 2: STEP ONTO GLOWING TERMINALS TO REBOOT OVERHEAD FLOODLIGHTS!",
            "⚡ TIP 3: PRESS [SHIFT] OR [SPACE] TO DASH & ESCAPE TOXIC ACID POOLS!",
            "⚡ TIP 4: SWAP WEAPONS [1, 2, 3, 4] TO COUNTER DIFFERENT ALIEN SIZES!"
        ];
        let tipIdx = 0;
        setInterval(() => {
            if (this.gameState === 'MENU' && ticker) {
                tipIdx = (tipIdx + 1) % tips.length;
                ticker.textContent = tips[tipIdx];
            }
        }, 3600);

        let t = 0;
        const drawSim = () => {
            if (this.gameState !== 'MENU') return;
            requestAnimationFrame(drawSim);
            t += 0.035;

            const w = canvas.width;
            const h = canvas.height;
            ctx.fillStyle = '#03080e';
            ctx.fillRect(0, 0, w, h);

            // Subtle tactical grid
            ctx.strokeStyle = '#0e1e2d';
            ctx.lineWidth = 1;
            for (let x = 0; x < w; x += 40) {
                ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
            }
            for (let y = 0; y < h; y += 30) {
                ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
            }

            // Operative animated coordinates
            const ox = 150 + Math.sin(t * 0.8) * 50;
            const oy = 55 + Math.cos(t * 0.6) * 18;

            // Flashlight sweeping beam
            const aimAngle = t * 1.3;
            const coneLen = 170;
            const coneSpread = 0.55;
            const grad = ctx.createRadialGradient(ox, oy, 8, ox, oy, coneLen);
            grad.addColorStop(0, 'rgba(0, 210, 255, 0.5)');
            grad.addColorStop(1, 'rgba(0, 210, 255, 0)');

            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.moveTo(ox, oy);
            ctx.arc(ox, oy, coneLen, aimAngle - coneSpread, aimAngle + coneSpread);
            ctx.closePath();
            ctx.fill();

            // Tactical flare bouncing in corner
            const fx = 480;
            const fy = 55;
            const flarePulse = 45 + Math.sin(t * 4) * 8;
            const flareGrad = ctx.createRadialGradient(fx, fy, 4, fx, fy, flarePulse);
            flareGrad.addColorStop(0, 'rgba(255, 120, 20, 0.7)');
            flareGrad.addColorStop(1, 'rgba(255, 60, 0, 0)');
            ctx.fillStyle = flareGrad;
            ctx.beginPath();
            ctx.arc(fx, fy, flarePulse, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ffaa33';
            ctx.beginPath(); ctx.arc(fx, fy, 4, 0, Math.PI * 2); ctx.fill();

            // Aliens tracking towards flare / light
            const aliens = [
                { x: 440 + Math.sin(t * 1.5) * 15, y: 35, color: '#39ff14', name: 'SPITTER' },
                { x: 500 + Math.cos(t * 1.8) * 12, y: 75, color: '#ff2255', name: 'BEHEMOTH' },
                { x: ox + Math.cos(aimAngle) * 95, y: oy + Math.sin(aimAngle) * 95, color: '#cc00ff', name: 'PHANTOM' }
            ];

            aliens.forEach(a => {
                ctx.fillStyle = a.color;
                ctx.beginPath();
                ctx.arc(a.x, a.y, 6, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = a.color;
                ctx.strokeRect(a.x - 9, a.y - 9, 18, 18);
            });

            // Laser projectile firing from operative towards alien
            if (Math.sin(t * 8) > 0.25) {
                ctx.strokeStyle = '#00ffff';
                ctx.lineWidth = 2.5;
                ctx.beginPath();
                ctx.moveTo(ox, oy);
                ctx.lineTo(aliens[2].x, aliens[2].y);
                ctx.stroke();

                // Spark hit burst
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(aliens[2].x, aliens[2].y, 5, 0, Math.PI * 2);
                ctx.fill();
            }

            // Operative dot
            ctx.fillStyle = '#00d2ff';
            ctx.beginPath();
            ctx.arc(ox, oy, 7, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.stroke();
        };
        requestAnimationFrame(drawSim);
    }
}

// Instantiate game on load
window.addEventListener('DOMContentLoaded', () => {
    window.game = new Game();
});
