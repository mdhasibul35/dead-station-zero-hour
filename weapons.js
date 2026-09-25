// ============================================================================
// WEAPON & PROJECTILE ARSENAL SYSTEM
// 4 Unique high-tech weapons, projectile physics, particles, flares & arcs
// ============================================================================

const WEAPONS = {
    CARBINE: {
        id: 'CARBINE',
        name: 'MK-IV Pulse Carbine',
        desc: 'High-velocity plasma rifle. Balanced fire rate and precision.',
        ammoCapacity: 30,
        fireRate: 0.12, // seconds between shots
        damage: 28,
        spread: 0.04,
        speed: 65,
        color: 0x00d2ff,
        recoil: 0.8,
        pellets: 1,
        pierce: 1,
        range: 45
    },
    SHOTGUN: {
        id: 'SHOTGUN',
        name: 'Thermite Trench-Gun',
        desc: 'Incendiary buckshot. Devastating at close range with heavy knockback.',
        ammoCapacity: 8,
        fireRate: 0.65,
        damage: 18, // per pellet
        spread: 0.28,
        speed: 55,
        color: 0xff6600,
        recoil: 3.2,
        pellets: 7,
        pierce: 1,
        range: 28
    },
    ARC: {
        id: 'ARC',
        name: 'Voltaic Arc Emitter',
        desc: 'High-voltage lightning conduit. Chains electric charges between nearby aliens.',
        ammoCapacity: 20,
        fireRate: 0.22,
        damage: 42,
        spread: 0.02,
        speed: 75,
        color: 0x8844ff,
        recoil: 1.2,
        pellets: 1,
        pierce: 1,
        chainCount: 3,
        range: 35
    },
    SINGULARITY: {
        id: 'SINGULARITY',
        name: 'Vortex Imploder',
        desc: 'Gravitational vortex missile. Drags aliens into an epicenter before detonation.',
        ammoCapacity: 4,
        fireRate: 1.2,
        damage: 140,
        spread: 0,
        speed: 38,
        color: 0xff00bb,
        recoil: 4.5,
        pellets: 1,
        pierce: 1,
        isVortex: true,
        radius: 12,
        range: 50
    }
};

class WeaponManager {
    constructor(scene) {
        this.scene = scene;
        this.projectiles = [];
        this.particles = [];
        this.flares = [];
        this.vortices = [];

        // Geometries and materials pooled for peak performance
        this.bulletGeom = new THREE.CylinderGeometry(0.08, 0.08, 0.9, 6);
        this.bulletGeom.rotateX(Math.PI / 2);

        this.carbineMat = new THREE.MeshBasicMaterial({ color: 0x00eeff });
        this.shotgunMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
        this.arcMat = new THREE.MeshBasicMaterial({ color: 0xaa55ff });
        this.vortexMat = new THREE.MeshBasicMaterial({ color: 0xff00dd });

        // Particle pool
        this.particleGeom = new THREE.BufferGeometry();
        this.sparkMat = new THREE.MeshBasicMaterial({ color: 0xffeedd });

        // Light for muzzle flash
        this.muzzleLight = new THREE.PointLight(0x00d2ff, 0, 15);
        this.scene.add(this.muzzleLight);
        this.muzzleTimer = 0;
    }

    fire(player, weapon, mouseWorldPos, perks) {
        const now = performance.now() / 1000;
        const fireInterval = weapon.fireRate * (perks.fireRateMult || 1.0);

        if (now - player.lastFireTime < fireInterval) {
            return false;
        }

        if (player.ammo[weapon.id] <= 0) {
            // Trigger dry click SFX
            return false;
        }

        player.ammo[weapon.id]--;
        player.lastFireTime = now;

        // Origin of shot
        const origin = player.mesh.position.clone();
        origin.y = 1.1; // Gun barrel height

        // Direction towards mouse cursor on ground plane
        const target = mouseWorldPos.clone();
        target.y = origin.y;
        const baseDir = new THREE.Vector3().subVectors(target, origin).normalize();

        // Audio
        if (weapon.id === 'CARBINE') Sound.playShootCarbine();
        else if (weapon.id === 'SHOTGUN') Sound.playShootShotgun();
        else if (weapon.id === 'ARC') Sound.playShootArc();
        else if (weapon.id === 'SINGULARITY') Sound.playShootSingularity();

        // Muzzle Flash
        this.triggerMuzzleFlash(origin, weapon.color);

        // Spawn Projectiles
        const count = weapon.pellets;
        for (let i = 0; i < count; i++) {
            let dir = baseDir.clone();
            if (weapon.spread > 0) {
                const spreadAngle = (Math.random() - 0.5) * weapon.spread;
                dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), spreadAngle);
            }

            const mesh = new THREE.Mesh(
                this.bulletGeom,
                weapon.id === 'CARBINE' ? this.carbineMat :
                weapon.id === 'SHOTGUN' ? this.shotgunMat :
                weapon.id === 'ARC' ? this.arcMat : this.vortexMat
            );
            mesh.position.copy(origin);
            mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);

            // Light up projectile slightly for visual flair
            let pLight = null;
            if (weapon.isVortex || Math.random() < 0.3) {
                pLight = new THREE.PointLight(weapon.color, 1.2, 8);
                mesh.add(pLight);
            }

            this.scene.add(mesh);

            this.projectiles.push({
                mesh: mesh,
                light: pLight,
                pos: mesh.position,
                vel: dir.multiplyScalar(weapon.speed),
                dir: dir.clone().normalize(),
                damage: weapon.damage * (perks.damageMult || 1.0),
                weapon: weapon,
                distanceTraveled: 0,
                maxRange: weapon.range,
                bouncesLeft: perks.bouncingRounds ? 2 : 0,
                isVortex: !!weapon.isVortex,
                chainCount: weapon.chainCount || 0,
                hasChained: false,
                alive: true
            });
        }

        // Camera recoil shake impulse
        return weapon.recoil;
    }

    triggerMuzzleFlash(pos, color) {
        this.muzzleLight.color.setHex(color);
        this.muzzleLight.position.copy(pos);
        this.muzzleLight.intensity = 3.5;
        this.muzzleTimer = 0.05;
    }

    throwFlare(origin, targetDir) {
        if (this.flares.length >= 6) {
            // Remove oldest flare
            const old = this.flares.shift();
            this.scene.remove(old.mesh);
            this.scene.remove(old.light);
        }

        const flareGeom = new THREE.CylinderGeometry(0.12, 0.12, 0.5, 8);
        const flareMat = new THREE.MeshBasicMaterial({ color: 0xff3300 });
        const mesh = new THREE.Mesh(flareGeom, flareMat);
        mesh.position.copy(origin);
        mesh.position.y = 1.0;

        const light = new THREE.PointLight(0xff6622, 6.0, 38);
        light.position.copy(mesh.position);
        light.castShadow = true;
        light.shadow.bias = -0.002;

        this.scene.add(mesh);
        this.scene.add(light);

        const throwVel = targetDir.clone().normalize().multiplyScalar(18);
        throwVel.y = 8; // Arc trajectory

        this.flares.push({
            mesh: mesh,
            light: light,
            vel: throwVel,
            life: 22, // Seconds of bright light
            maxLife: 22,
            grounded: false
        });

        Sound.playFlareDeploy();
    }

    update(dt, aliens, walls, onHitAlien, onDetonateVortex) {
        // Muzzle flash decay
        if (this.muzzleTimer > 0) {
            this.muzzleTimer -= dt;
            if (this.muzzleTimer <= 0) {
                this.muzzleLight.intensity = 0;
            }
        }

        // 1. Update Flares
        for (let i = this.flares.length - 1; i >= 0; i--) {
            const f = this.flares[i];
            f.life -= dt;

            if (!f.grounded) {
                f.vel.y -= 25 * dt; // Gravity
                f.mesh.position.addScaledVector(f.vel, dt);
                f.mesh.rotation.x += 8 * dt;
                f.mesh.rotation.z += 6 * dt;

                if (f.mesh.position.y <= 0.2) {
                    f.mesh.position.y = 0.2;
                    f.vel.set(0, 0, 0);
                    f.grounded = true;
                }
            }

            f.light.position.copy(f.mesh.position);
            f.light.position.y += 0.4;

            // Flare flicker effect
            const flicker = 1.0 + (Math.random() - 0.5) * 0.18;
            const lifeRatio = Math.max(0, f.life / f.maxLife);
            f.light.intensity = 6.0 * lifeRatio * flicker;

            // Spawn smoke/spark particles from flare
            if (Math.random() < 0.4) {
                this.spawnSpark(f.mesh.position, 0xff7722, 1, 0.4);
            }

            if (f.life <= 0) {
                this.scene.remove(f.mesh);
                this.scene.remove(f.light);
                this.flares.splice(i, 1);
            }
        }

        // 2. Update Projectiles
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            const moveStep = p.vel.clone().multiplyScalar(dt);
            const nextPos = p.pos.clone().add(moveStep);
            p.distanceTraveled += moveStep.length();

            // Check collision with walls
            let hitWall = false;
            for (let w = 0; w < walls.length; w++) {
                const wall = walls[w];
                if (wall.box.containsPoint(nextPos)) {
                    hitWall = true;
                    if (p.bouncesLeft > 0) {
                        // Ricochet
                        p.bouncesLeft--;
                        p.vel.x *= -1; // Simple normal bounce
                        this.spawnSparks(p.pos, p.weapon.color, 4);
                    } else {
                        p.alive = false;
                        this.spawnSparks(p.pos, p.weapon.color, 8);
                        if (p.isVortex) {
                            onDetonateVortex(p.pos, p.weapon);
                        }
                    }
                    break;
                }
            }

            if (hitWall && !p.alive) {
                this.removeProjectile(i);
                continue;
            }

            // Check collision with Aliens
            let hitAlien = false;
            for (let a = 0; a < aliens.length; a++) {
                const alien = aliens[a];
                if (!alien.alive) continue;

                const dist = p.pos.distanceTo(alien.mesh.position);
                if (dist < alien.radius + 0.3) {
                    hitAlien = true;
                    p.alive = false;
                    onHitAlien(alien, p);

                    this.spawnSparks(p.pos, 0x00ff88, 10); // Alien green acid spark

                    // Chain lightning mechanic for Arc weapon
                    if (p.weapon.id === 'ARC' && !p.hasChained) {
                        this.triggerChainArc(alien, aliens, p.damage * 0.75, onHitAlien);
                        p.hasChained = true;
                    }

                    if (p.isVortex) {
                        onDetonateVortex(p.pos, p.weapon);
                    }
                    break;
                }
            }

            if (hitAlien) {
                this.removeProjectile(i);
                continue;
            }

            // Max Range Check
            if (p.distanceTraveled >= p.maxRange) {
                if (p.isVortex) {
                    onDetonateVortex(p.pos, p.weapon);
                }
                this.removeProjectile(i);
                continue;
            }

            p.pos.copy(nextPos);
        }

        // 3. Update Vortices
        for (let i = this.vortices.length - 1; i >= 0; i--) {
            const v = this.vortices[i];
            v.life -= dt;

            // Rotate vortex mesh
            v.mesh.rotation.y += 12 * dt;
            const progress = 1.0 - (v.life / v.maxLife);
            v.mesh.scale.setScalar(1 + Math.sin(progress * Math.PI) * 1.5);

            // Gravitational pull on all aliens in radius
            for (let a = 0; a < aliens.length; a++) {
                const alien = aliens[a];
                if (!alien.alive) continue;
                const d = alien.mesh.position.distanceTo(v.pos);
                if (d < v.radius) {
                    const pull = new THREE.Vector3().subVectors(v.pos, alien.mesh.position).normalize();
                    const force = (1 - d / v.radius) * 18 * dt;
                    alien.mesh.position.addScaledVector(pull, force);
                }
            }

            if (v.life <= 0) {
                // Final implosion blast
                Sound.playExplosion();
                for (let a = 0; a < aliens.length; a++) {
                    const alien = aliens[a];
                    if (!alien.alive) continue;
                    if (alien.mesh.position.distanceTo(v.pos) < v.radius) {
                        alien.takeDamage(v.damage, new THREE.Vector3(0, 0, 0));
                    }
                }
                this.spawnSparks(v.pos, 0xff00ff, 35);
                this.scene.remove(v.mesh);
                this.scene.remove(v.light);
                this.vortices.splice(i, 1);
            }
        }

        // 4. Update Particle Sparks
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const pt = this.particles[i];
            pt.life -= dt;
            pt.mesh.position.addScaledVector(pt.vel, dt);
            pt.vel.y -= 18 * dt; // gravity

            const s = Math.max(0, pt.life / pt.maxLife);
            pt.mesh.scale.setScalar(s);

            if (pt.life <= 0 || pt.mesh.position.y < 0) {
                this.scene.remove(pt.mesh);
                this.particles.splice(i, 1);
            }
        }
    }

    triggerChainArc(originAlien, allAliens, chainDmg, onHitAlien) {
        let targets = [];
        for (let a = 0; a < allAliens.length; a++) {
            const al = allAliens[a];
            if (al !== originAlien && al.alive) {
                const dist = originAlien.mesh.position.distanceTo(al.mesh.position);
                if (dist < 14) {
                    targets.push({ alien: al, dist: dist });
                }
            }
        }
        targets.sort((a, b) => a.dist - b.dist);
        const maxChains = Math.min(3, targets.length);

        for (let c = 0; c < maxChains; c++) {
            const targetAlien = targets[c].alien;
            this.createLightningBeam(originAlien.mesh.position, targetAlien.mesh.position, 0x9944ff);
            targetAlien.takeDamage(chainDmg, new THREE.Vector3());
            this.spawnSparks(targetAlien.mesh.position, 0xaa55ff, 8);
        }
    }

    createLightningBeam(p1, p2, color) {
        const points = [];
        const segments = 6;
        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const pt = new THREE.Vector3().lerpVectors(p1, p2, t);
            if (i > 0 && i < segments) {
                pt.x += (Math.random() - 0.5) * 0.8;
                pt.y += (Math.random() - 0.5) * 0.8;
                pt.z += (Math.random() - 0.5) * 0.8;
            }
            points.push(pt);
        }
        const geom = new THREE.BufferGeometry().setFromPoints(points);
        const mat = new THREE.LineBasicMaterial({ color: color, linewidth: 2 });
        const line = new THREE.Line(geom, mat);
        this.scene.add(line);

        setTimeout(() => {
            this.scene.remove(line);
            geom.dispose();
            mat.dispose();
        }, 80);
    }

    spawnVortex(pos, weapon) {
        const geom = new THREE.TorusGeometry(1.6, 0.35, 12, 24);
        const mat = new THREE.MeshBasicMaterial({ color: 0xff00bb, wireframe: true });
        const mesh = new THREE.Mesh(geom, mat);
        mesh.rotation.x = Math.PI / 2;
        mesh.position.copy(pos);
        mesh.position.y = 0.8;

        const light = new THREE.PointLight(0xff00aa, 3.5, 18);
        light.position.copy(mesh.position);

        this.scene.add(mesh);
        this.scene.add(light);

        this.vortices.push({
            mesh: mesh,
            light: light,
            pos: pos.clone(),
            radius: weapon.radius,
            damage: weapon.damage,
            life: 2.2,
            maxLife: 2.2
        });
    }

    spawnSparks(pos, color, count = 6) {
        for (let i = 0; i < count; i++) {
            this.spawnSpark(pos, color);
        }
    }

    spawnSpark(pos, color, count = 1, speed = 1.0) {
        const geom = new THREE.BoxGeometry(0.12, 0.12, 0.12);
        const mat = new THREE.MeshBasicMaterial({ color: color });
        const mesh = new THREE.Mesh(geom, mat);
        mesh.position.copy(pos);
        mesh.position.y += (Math.random() - 0.5) * 0.4;

        const vel = new THREE.Vector3(
            (Math.random() - 0.5) * 8 * speed,
            (Math.random() * 6 + 2) * speed,
            (Math.random() - 0.5) * 8 * speed
        );

        this.scene.add(mesh);
        this.particles.push({
            mesh: mesh,
            vel: vel,
            life: 0.3 + Math.random() * 0.4,
            maxLife: 0.7
        });
    }

    removeProjectile(index) {
        const p = this.projectiles[index];
        this.scene.remove(p.mesh);
        if (p.light) this.scene.remove(p.light);
        this.projectiles.splice(index, 1);
    }
}
