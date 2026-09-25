// ============================================================================
// ENVIRONMENT & PROCEDURAL OUTPOST GENERATOR
// Procedural textures, real-time lighting, interactive generators, hazards & barrels
// ============================================================================

class EnvironmentManager {
    constructor(scene) {
        this.scene = scene;
        this.walls = [];
        this.barrels = [];
        this.terminals = [];
        this.pickups = [];
        this.rotatingSirens = [];
        this.floatingParticles = null;

        // Generate procedural textures via Canvas API
        this.floorTexture = this.createFloorTexture();
        this.wallTexture = this.createWallTexture();
        this.crateTexture = this.createCrateTexture();
        this.hazardTexture = this.createHazardTexture();

        // Floor and Wall Materials
        this.floorMat = new THREE.MeshStandardMaterial({
            map: this.floorTexture,
            roughness: 0.6,
            metalness: 0.4
        });

        this.wallMat = new THREE.MeshStandardMaterial({
            map: this.wallTexture,
            roughness: 0.7,
            metalness: 0.3
        });

        this.crateMat = new THREE.MeshStandardMaterial({
            map: this.crateTexture,
            roughness: 0.5,
            metalness: 0.5
        });

        this.hazardMat = new THREE.MeshStandardMaterial({
            map: this.hazardTexture,
            roughness: 0.4,
            metalness: 0.2
        });
    }

    // ------------------------------------------------------------------------
    // PROCEDURAL TEXTURE GENERATORS (Zero external image dependencies)
    // ------------------------------------------------------------------------
    createFloorTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');

        // Dark industrial metal panels
        ctx.fillStyle = '#14181c';
        ctx.fillRect(0, 0, 512, 512);

        // Tile seams
        ctx.strokeStyle = '#0a0d10';
        ctx.lineWidth = 6;
        for (let i = 0; i <= 512; i += 128) {
            ctx.beginPath();
            ctx.moveTo(i, 0); ctx.lineTo(i, 512);
            ctx.moveTo(0, i); ctx.lineTo(512, i);
            ctx.stroke();
        }

        // Rivets
        ctx.fillStyle = '#222b33';
        for (let x = 16; x < 512; x += 128) {
            for (let y = 16; y < 512; y += 128) {
                ctx.beginPath();
                ctx.arc(x, y, 4, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Metal grating pattern in center panels
        ctx.fillStyle = '#111519';
        for (let x = 32; x < 512; x += 128) {
            for (let y = 32; y < 512; y += 128) {
                ctx.fillRect(x, y, 64, 64);
            }
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(16, 16);
        return texture;
    }

    createWallTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');

        // Dark gunmetal armor plates
        ctx.fillStyle = '#181e24';
        ctx.fillRect(0, 0, 256, 256);

        // Tech conduits / panel dividers
        ctx.fillStyle = '#101418';
        ctx.fillRect(0, 110, 256, 36);

        // Glowing blue status line
        ctx.fillStyle = '#00aaff';
        ctx.fillRect(0, 126, 256, 4);

        ctx.strokeStyle = '#0d1115';
        ctx.lineWidth = 4;
        ctx.strokeRect(4, 4, 248, 248);

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        return texture;
    }

    createCrateTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#2a343d';
        ctx.fillRect(0, 0, 256, 256);

        // Metal framing
        ctx.strokeStyle = '#151c22';
        ctx.lineWidth = 14;
        ctx.strokeRect(7, 7, 242, 242);

        // Diagonal cross bracing
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(10, 10); ctx.lineTo(246, 246);
        ctx.moveTo(246, 10); ctx.lineTo(10, 246);
        ctx.stroke();

        return new THREE.CanvasTexture(canvas);
    }

    createHazardTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');

        // Yellow and black warning hazard stripes
        ctx.fillStyle = '#e6b800';
        ctx.fillRect(0, 0, 256, 256);

        ctx.fillStyle = '#111';
        for (let i = -256; i < 512; i += 40) {
            ctx.beginPath();
            ctx.moveTo(i, 0);
            ctx.lineTo(i + 40, 256);
            ctx.lineTo(i + 20, 256);
            ctx.lineTo(i - 20, 0);
            ctx.fill();
        }

        return new THREE.CanvasTexture(canvas);
    }

    // ------------------------------------------------------------------------
    // BUILD MAP & STRUCTURES
    // ------------------------------------------------------------------------
    buildOutpost() {
        // 1. Massive Floor
        const floorGeom = new THREE.PlaneGeometry(120, 120);
        const floorMesh = new THREE.Mesh(floorGeom, this.floorMat);
        floorMesh.rotation.x = -Math.PI / 2;
        floorMesh.receiveShadow = true;
        this.scene.add(floorMesh);

        // 2. Boundary Enclosure Walls
        const mapSize = 58;
        const wallH = 6;
        this.addWall(0, 0, mapSize * 2, 2, wallH, 0, mapSize); // North
        this.addWall(0, 0, mapSize * 2, 2, wallH, 0, -mapSize); // South
        this.addWall(0, 0, 2, mapSize * 2, wallH, mapSize, 0); // East
        this.addWall(0, 0, 2, mapSize * 2, wallH, -mapSize, 0); // West

        // 3. Interior Rooms & Partitions (Tactical corridors, labs, choke points)
        // Central Core Room
        this.addWallWithOpening(0, 0, 24, 24, wallH);

        // Bio-containment wing (West)
        this.addWall(0, 0, 2, 26, wallH, -28, 12);
        this.addWall(0, 0, 16, 2, wallH, -36, 0);

        // Reactor Storage Bay (East)
        this.addWall(0, 0, 2, 26, wallH, 28, -12);
        this.addWall(0, 0, 16, 2, wallH, 36, 0);

        // Corridors & pillars for cover
        const pillarCoords = [
            [-14, -14], [14, -14], [-14, 14], [14, 14],
            [-36, -24], [36, 24], [-24, 34], [24, -34]
        ];
        pillarCoords.forEach(([px, pz]) => {
            this.addPillar(px, pz, 2.5, wallH);
        });

        // 4. Interactive Power Terminals / Sector Floodlights
        this.addPowerTerminal(0, 0, 'CORE REACTOR');
        this.addPowerTerminal(-36, 20, 'SUB-BAY ALPHA');
        this.addPowerTerminal(36, -20, 'SUB-BAY BETA');

        // 5. Explosive Fuel / Cryo Canisters
        const barrelCoords = [
            [-8, -8], [8, 8], [-22, 10], [22, -10],
            [-42, -12], [42, 12], [0, 22], [0, -22]
        ];
        barrelCoords.forEach(([bx, bz]) => {
            this.addExplosiveBarrel(bx, bz);
        });

        // 6. Rotating Emergency Red Sirens
        this.addEmergencySiren(-12, 12);
        this.addEmergencySiren(12, -12);

        // 7. Atmospheric Spore & Dust System
        this.initAtmosphericParticles();
    }

    addWall(x, y, w, d, h, posX, posZ) {
        const geom = new THREE.BoxGeometry(w, h, d);
        const mesh = new THREE.Mesh(geom, this.wallMat);
        mesh.position.set(posX, h / 2, posZ);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.scene.add(mesh);

        const box = new THREE.Box3().setFromObject(mesh);
        this.walls.push({ mesh: mesh, box: box, radius: Math.max(w, d) / 2 });
    }

    addWallWithOpening(cx, cz, size, h, wallH) {
        // Creates a square room with 4 doorways
        const half = size / 2;
        const segLen = (size - 6) / 2;

        // North wall left & right segments
        this.addWall(0, 0, segLen, 2, wallH, cx - half + segLen / 2, cz + half);
        this.addWall(0, 0, segLen, 2, wallH, cx + half - segLen / 2, cz + half);

        // South wall left & right segments
        this.addWall(0, 0, segLen, 2, wallH, cx - half + segLen / 2, cz - half);
        this.addWall(0, 0, segLen, 2, wallH, cx + half - segLen / 2, cz - half);

        // West wall
        this.addWall(0, 0, 2, segLen, wallH, cx - half, cz - half + segLen / 2);
        this.addWall(0, 0, 2, segLen, wallH, cx - half, cz + half - segLen / 2);

        // East wall
        this.addWall(0, 0, 2, segLen, wallH, cx + half, cz - half + segLen / 2);
        this.addWall(0, 0, 2, segLen, wallH, cx + half, cz + half - segLen / 2);
    }

    addPillar(x, z, size, h) {
        const geom = new THREE.BoxGeometry(size, h, size);
        const mesh = new THREE.Mesh(geom, this.wallMat);
        mesh.position.set(x, h / 2, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.scene.add(mesh);

        const box = new THREE.Box3().setFromObject(mesh);
        this.walls.push({ mesh: mesh, box: box, radius: size * 0.7 });
    }

    addPowerTerminal(x, z, name) {
        const group = new THREE.Group();

        // Terminal pedestal
        const geom = new THREE.CylinderGeometry(1.2, 1.4, 1.2, 8);
        const mat = new THREE.MeshStandardMaterial({ color: 0x2a333d, metalness: 0.6 });
        const mesh = new THREE.Mesh(geom, mat);
        mesh.position.y = 0.6;
        group.add(mesh);

        // Glowing holo-terminal core
        const coreGeom = new THREE.BoxGeometry(0.8, 0.4, 0.6);
        const coreMat = new THREE.MeshBasicMaterial({ color: 0xff3300 });
        const coreMesh = new THREE.Mesh(coreGeom, coreMat);
        coreMesh.position.y = 1.3;
        group.add(coreMesh);

        // Overhead Floodlight (Initially dark)
        const floodLight = new THREE.SpotLight(0xaaddff, 0, 42, Math.PI / 3, 0.5, 1.5);
        floodLight.position.set(x, 14, z);
        floodLight.target.position.set(x, 0, z);
        floodLight.castShadow = true;
        floodLight.shadow.mapSize.width = 1024;
        floodLight.shadow.mapSize.height = 1024;
        this.scene.add(floodLight);
        this.scene.add(floodLight.target);

        group.position.set(x, 0, z);
        this.scene.add(group);

        this.terminals.push({
            name: name,
            pos: new THREE.Vector3(x, 0, z),
            group: group,
            coreMesh: coreMesh,
            coreMat: coreMat,
            floodLight: floodLight,
            activated: false,
            powerTimer: 0,
            duration: 35 // Seconds of bright illumination
        });
    }

    addExplosiveBarrel(x, z) {
        const group = new THREE.Group();

        const geom = new THREE.CylinderGeometry(0.7, 0.7, 1.8, 12);
        const mat = new THREE.MeshStandardMaterial({
            color: 0xcc2200,
            roughness: 0.3,
            metalness: 0.5
        });
        const mesh = new THREE.Mesh(geom, mat);
        mesh.position.y = 0.9;
        mesh.castShadow = true;
        group.add(mesh);

        // Hazard ring
        const ringGeom = new THREE.TorusGeometry(0.72, 0.08, 6, 16);
        ringGeom.rotateX(Math.PI / 2);
        const ringMesh = new THREE.Mesh(ringGeom, this.hazardMat);
        ringMesh.position.y = 0.9;
        group.add(ringMesh);

        group.position.set(x, 0, z);
        this.scene.add(group);

        this.barrels.push({
            mesh: group,
            pos: new THREE.Vector3(x, 0, z),
            radius: 1.1,
            health: 20,
            alive: true
        });
    }

    addEmergencySiren(x, z) {
        const light = new THREE.SpotLight(0xff0022, 3.5, 30, Math.PI / 4, 0.8);
        light.position.set(x, 5.5, z);
        light.target.position.set(x + 10, 0, z);

        this.scene.add(light);
        this.scene.add(light.target);

        this.rotatingSirens.push({
            light: light,
            center: new THREE.Vector3(x, 0, z),
            angle: Math.random() * Math.PI * 2
        });
    }

    createPickupBadge(type) {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 68;
        const ctx = canvas.getContext('2d');

        let text = '⚡ AMMO';
        let sub = 'FULL RELOAD';
        let strokeColor = '#00d2ff';
        let bgColor = 'rgba(0, 30, 45, 0.9)';

        if (type === 'HEALTH') {
            text = '✚ MEDKIT';
            sub = '+35 HEALTH';
            strokeColor = '#00ff88';
            bgColor = 'rgba(0, 40, 20, 0.9)';
        } else if (type === 'FLARE') {
            text = '🔥 FLARES';
            sub = '+2 CHARGES';
            strokeColor = '#ff7700';
            bgColor = 'rgba(45, 20, 0, 0.9)';
        }

        ctx.fillStyle = bgColor;
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 4;
        ctx.strokeRect(4, 4, 248, 60);
        ctx.fillRect(4, 4, 248, 60);

        ctx.fillStyle = strokeColor;
        ctx.font = 'bold 24px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(text, 128, 30);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 17px monospace';
        ctx.fillText(sub, 128, 52);

        const texture = new THREE.CanvasTexture(canvas);
        const mat = new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true });
        const sprite = new THREE.Sprite(mat);
        sprite.scale.set(2.4, 0.65, 1);
        sprite.position.y = 1.35;
        return sprite;
    }

    spawnPickup(type, pos) {
        const group = new THREE.Group();
        let geom, mat, lightColor;

        if (type === 'HEALTH') {
            geom = new THREE.BoxGeometry(0.8, 0.8, 0.8);
            mat = new THREE.MeshBasicMaterial({ color: 0x00ff88 });
            lightColor = 0x00ff88;
        } else if (type === 'AMMO') {
            geom = new THREE.CylinderGeometry(0.4, 0.4, 0.9, 8);
            mat = new THREE.MeshBasicMaterial({ color: 0x00d2ff });
            lightColor = 0x00d2ff;
        } else {
            // FLARE
            geom = new THREE.ConeGeometry(0.3, 0.9, 6);
            mat = new THREE.MeshBasicMaterial({ color: 0xff6600 });
            lightColor = 0xff6600;
        }

        const mesh = new THREE.Mesh(geom, mat);
        group.add(mesh);

        // Add 3D Floating Holographic Label
        const badge = this.createPickupBadge(type);
        group.add(badge);

        const light = new THREE.PointLight(lightColor, 2.0, 8);
        group.add(light);

        group.position.copy(pos);
        group.position.y = 0.6;
        this.scene.add(group);

        this.pickups.push({
            type: type,
            mesh: group,
            pos: group.position,
            alive: true
        });
    }

    initAtmosphericParticles() {
        const count = 350;
        const geom = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 3);

        for (let i = 0; i < count * 3; i += 3) {
            positions[i] = (Math.random() - 0.5) * 110;
            positions[i + 1] = Math.random() * 6;
            positions[i + 2] = (Math.random() - 0.5) * 110;
        }

        geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const mat = new THREE.PointsMaterial({
            color: 0x4488aa,
            size: 0.18,
            transparent: true,
            opacity: 0.45
        });

        this.floatingParticles = new THREE.Points(geom, mat);
        this.scene.add(this.floatingParticles);
    }

    update(dt, player, aliens, weaponMgr) {
        // 1. Rotate Emergency Sirens
        for (let s = 0; s < this.rotatingSirens.length; s++) {
            const siren = this.rotatingSirens[s];
            siren.angle += 3.2 * dt;
            siren.light.target.position.set(
                siren.center.x + Math.cos(siren.angle) * 12,
                0,
                siren.center.z + Math.sin(siren.angle) * 12
            );
        }

        // 2. Animate Atmospheric Floating Particles
        if (this.floatingParticles) {
            const posAttr = this.floatingParticles.geometry.attributes.position;
            for (let i = 1; i < posAttr.count * 3; i += 3) {
                posAttr.array[i] += Math.sin(performance.now() * 0.001 + i) * 0.008;
            }
            posAttr.needsUpdate = true;
        }

        // 3. Update Power Terminals & Sector Floodlights
        for (let t = 0; t < this.terminals.length; t++) {
            const term = this.terminals[t];

            if (term.activated) {
                term.powerTimer -= dt;
                term.floodLight.intensity = Math.min(5.5, term.powerTimer * 0.5);

                if (term.powerTimer <= 0) {
                    term.activated = false;
                    term.floodLight.intensity = 0;
                    term.coreMat.color.setHex(0xff3300); // Back to standby red
                }
            } else {
                // Check if player is standing close to activate
                const dist = player.mesh.position.distanceTo(term.pos);
                if (dist < 2.5) {
                    term.activated = true;
                    term.powerTimer = term.duration;
                    term.coreMat.color.setHex(0x00ffcc);
                    Sound.playGeneratorBoot();
                }
            }
        }

        // 4. Update Pickups & Hover Animation
        for (let p = this.pickups.length - 1; p >= 0; p--) {
            const pk = this.pickups[p];
            pk.mesh.rotation.y += 2.5 * dt;
            pk.mesh.position.y = 0.6 + Math.sin(performance.now() * 0.005 + p) * 0.15;

            // Player collision
            if (player.mesh.position.distanceTo(pk.pos) < 1.8) {
                if (pk.type === 'HEALTH') {
                    player.heal(35);
                    if (window.game) window.game.showInGameHelpline("✚ +35 HEALTH RESTORED", 2.2);
                } else if (pk.type === 'AMMO') {
                    player.refillAmmo();
                    if (window.game) window.game.showInGameHelpline("⚡ AMMO REFILLED (ALL WEAPONS)", 2.2);
                } else if (pk.type === 'FLARE') {
                    player.flares = Math.min(6, player.flares + 2);
                    if (window.game) window.game.showInGameHelpline("🔥 +2 FLARES ADDED", 2.2);
                }
                Sound.playUpgradeSelect();
                this.scene.remove(pk.mesh);
                this.pickups.splice(p, 1);
            }
        }
    }

    explodeBarrel(barrel, weaponMgr, aliens, player) {
        barrel.alive = false;
        this.scene.remove(barrel.mesh);
        Sound.playExplosion();

        // Massive fire & spark particles
        weaponMgr.spawnSparks(barrel.pos, 0xff3300, 40);

        // Damage and knockback all aliens in blast radius
        const blastRadius = 9;
        for (let a = 0; a < aliens.length; a++) {
            const al = aliens[a];
            if (!al.alive) continue;
            const dist = al.mesh.position.distanceTo(barrel.pos);
            if (dist < blastRadius) {
                const damage = (1 - dist / blastRadius) * 220;
                const push = new THREE.Vector3().subVectors(al.mesh.position, barrel.pos).normalize().multiplyScalar(15);
                al.takeDamage(damage, push);
            }
        }

        // Damage player if caught in blast
        const pDist = player.mesh.position.distanceTo(barrel.pos);
        if (pDist < blastRadius) {
            player.takeDamage((1 - pDist / blastRadius) * 45);
        }
    }
}
