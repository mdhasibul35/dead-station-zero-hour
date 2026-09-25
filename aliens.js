// ============================================================================
// ALIEN ECOLOGY & AI BEHAVIOR SYSTEM
// 5 Unique alien species with distinct silhouettes, mechanics, and behaviors
// ============================================================================

class AlienManager {
    constructor(scene) {
        this.scene = scene;
        this.aliens = [];
        this.acidPools = [];
        this.acidProjectiles = [];

        // Shared materials
        this.chitinMat = new THREE.MeshStandardMaterial({
            color: 0x111618,
            roughness: 0.3,
            metalness: 0.4
        });
        this.eyeMatGreen = new THREE.MeshBasicMaterial({ color: 0x39ff14 });
        this.eyeMatRed = new THREE.MeshBasicMaterial({ color: 0xff1133 });
        this.eyeMatPurple = new THREE.MeshBasicMaterial({ color: 0xcc00ff });
        this.eyeMatYellow = new THREE.MeshBasicMaterial({ color: 0xffdd00 });

        // Acid Pool geometry
        this.acidGeom = new THREE.CircleGeometry(1.8, 16);
        this.acidGeom.rotateX(-Math.PI / 2);
        this.acidMat = new THREE.MeshBasicMaterial({
            color: 0x44ff00,
            transparent: true,
            opacity: 0.7
        });
    }

    spawnAlien(type, pos) {
        let alien;
        switch (type) {
            case 'SCUTTLER':
                alien = this.createScuttler(pos);
                break;
            case 'SPITTER':
                alien = this.createSpitter(pos);
                break;
            case 'BEHEMOTH':
                alien = this.createBehemoth(pos);
                break;
            case 'PHANTOM':
                alien = this.createPhantom(pos);
                break;
            case 'BOSS':
                alien = this.createBoss(pos);
                break;
            default:
                alien = this.createScuttler(pos);
        }

        this.scene.add(alien.mesh);
        this.aliens.push(alien);
        Sound.playAlienScreech(type.toLowerCase());
        return alien;
    }

    // ------------------------------------------------------------------------
    // 1. SCUTTLER - Fast, erratic swarmers
    // ------------------------------------------------------------------------
    createScuttler(pos) {
        const group = new THREE.Group();

        // Main body thorax
        const bodyGeom = new THREE.ConeGeometry(0.5, 1.0, 5);
        bodyGeom.rotateX(Math.PI / 2);
        const bodyMesh = new THREE.Mesh(bodyGeom, this.chitinMat);
        bodyMesh.castShadow = true;
        group.add(bodyMesh);

        // Glowing predatory eyes
        const eyeGeom = new THREE.SphereGeometry(0.1, 6, 6);
        const eyeL = new THREE.Mesh(eyeGeom, this.eyeMatYellow);
        const eyeR = new THREE.Mesh(eyeGeom, this.eyeMatYellow);
        eyeL.position.set(0.2, 0.15, 0.45);
        eyeR.position.set(-0.2, 0.15, 0.45);
        group.add(eyeL);
        group.add(eyeR);

        // Claws
        const clawGeom = new THREE.BoxGeometry(0.12, 0.1, 0.6);
        const clawL = new THREE.Mesh(clawGeom, this.chitinMat);
        const clawR = new THREE.Mesh(clawGeom, this.chitinMat);
        clawL.position.set(0.4, -0.1, 0.3);
        clawR.position.set(-0.4, -0.1, 0.3);
        clawL.rotation.y = 0.5;
        clawR.rotation.y = -0.5;
        group.add(clawL);
        group.add(clawR);

        group.position.copy(pos);
        group.position.y = 0.5;

        return {
            type: 'SCUTTLER',
            mesh: group,
            radius: 0.65,
            health: 45,
            maxHealth: 45,
            speed: 8.5,
            damage: 14,
            attackRange: 1.2,
            attackCooldown: 0.6,
            lastAttackTime: 0,
            alive: true,
            scoreValue: 100,
            leapCooldown: 0,
            update: function(dt, player, walls, alienMgr) {
                const toPlayer = new THREE.Vector3().subVectors(player.mesh.position, this.mesh.position);
                toPlayer.y = 0;
                const dist = toPlayer.length();

                // Rotate towards player with erratic twitching
                const targetRot = Math.atan2(toPlayer.x, toPlayer.z);
                this.mesh.rotation.y = targetRot + (Math.sin(performance.now() * 0.015) * 0.18);

                // Movement / Leap mechanic
                if (this.leapCooldown > 0) this.leapCooldown -= dt;

                let moveSpeed = this.speed;
                if (dist < 6.5 && dist > 2.0 && this.leapCooldown <= 0) {
                    // Quick leap burst
                    moveSpeed = this.speed * 2.2;
                    this.leapCooldown = 3.5;
                    this.mesh.position.y = 0.9;
                } else if (this.mesh.position.y > 0.5) {
                    this.mesh.position.y = Math.max(0.5, this.mesh.position.y - 4 * dt);
                }

                const dir = toPlayer.clone().normalize();
                this.mesh.position.addScaledVector(dir, moveSpeed * dt);

                // Melee strike
                if (dist < this.attackRange) {
                    const now = performance.now() / 1000;
                    if (now - this.lastAttackTime > this.attackCooldown) {
                        this.lastAttackTime = now;
                        player.takeDamage(this.damage);
                    }
                }
            },
            takeDamage: function(dmg, impulse) {
                this.health -= dmg;
                this.mesh.position.add(impulse);
                if (this.health <= 0) {
                    this.alive = false;
                    Sound.playAlienDeath();
                }
            }
        };
    }

    // ------------------------------------------------------------------------
    // 2. SPITTER - Ranged bio-corrosive artillery
    // ------------------------------------------------------------------------
    createSpitter(pos) {
        const group = new THREE.Group();

        // Slender serpentine torso
        const bodyGeom = new THREE.CylinderGeometry(0.35, 0.6, 1.8, 7);
        const bodyMesh = new THREE.Mesh(bodyGeom, this.chitinMat);
        bodyMesh.position.y = 0.9;
        bodyMesh.castShadow = true;
        group.add(bodyMesh);

        // Glowing Bioluminescent Acid Sac
        const sacGeom = new THREE.SphereGeometry(0.55, 10, 10);
        const sacMat = new THREE.MeshStandardMaterial({
            color: 0x33ff00,
            emissive: 0x22aa00,
            roughness: 0.2
        });
        const sacMesh = new THREE.Mesh(sacGeom, sacMat);
        sacMesh.position.set(0, 1.2, -0.4);
        group.add(sacMesh);

        // Head and Green Eyes
        const headGeom = new THREE.BoxGeometry(0.5, 0.4, 0.7);
        const headMesh = new THREE.Mesh(headGeom, this.chitinMat);
        headMesh.position.set(0, 1.8, 0.2);
        group.add(headMesh);

        const eyeGeom = new THREE.SphereGeometry(0.12, 6, 6);
        const eyeL = new THREE.Mesh(eyeGeom, this.eyeMatGreen);
        const eyeR = new THREE.Mesh(eyeGeom, this.eyeMatGreen);
        eyeL.position.set(0.22, 1.9, 0.5);
        eyeR.position.set(-0.22, 1.9, 0.5);
        group.add(eyeL);
        group.add(eyeR);

        group.position.copy(pos);
        group.position.y = 0;

        return {
            type: 'SPITTER',
            mesh: group,
            sacMesh: sacMesh,
            radius: 0.9,
            health: 80,
            maxHealth: 80,
            speed: 4.8,
            preferredDist: 14,
            shootCooldown: 2.2,
            lastShootTime: 0,
            alive: true,
            scoreValue: 220,
            update: function(dt, player, walls, alienMgr) {
                const toPlayer = new THREE.Vector3().subVectors(player.mesh.position, this.mesh.position);
                toPlayer.y = 0;
                const dist = toPlayer.length();

                this.mesh.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);

                // Tactical positioning: keep distance from player
                const dir = toPlayer.clone().normalize();
                if (dist < this.preferredDist - 2) {
                    // Back away
                    this.mesh.position.addScaledVector(dir, -this.speed * dt);
                } else if (dist > this.preferredDist + 4) {
                    // Advance
                    this.mesh.position.addScaledVector(dir, this.speed * dt);
                } else {
                    // Strafe sideways
                    const strafe = new THREE.Vector3(-dir.z, 0, dir.x);
                    this.mesh.position.addScaledVector(strafe, Math.sin(performance.now() * 0.003) * this.speed * 0.7 * dt);
                }

                // Pulsate acid sac
                const pulse = 1.0 + Math.sin(performance.now() * 0.008) * 0.2;
                this.sacMesh.scale.setScalar(pulse);

                // Shoot acid spit
                const now = performance.now() / 1000;
                if (now - this.lastShootTime > this.shootCooldown && dist < 24) {
                    this.lastShootTime = now;
                    alienMgr.spawnAcidProjectile(this.mesh.position.clone().add(new THREE.Vector3(0, 1.8, 0)), player.mesh.position);
                }
            },
            takeDamage: function(dmg, impulse) {
                this.health -= dmg;
                this.mesh.position.add(impulse.multiplyScalar(0.7));
                if (this.health <= 0) {
                    this.alive = false;
                    Sound.playAlienDeath();
                }
            }
        };
    }

    // ------------------------------------------------------------------------
    // 3. BEHEMOTH - Heavy armored juggernaut
    // ------------------------------------------------------------------------
    createBehemoth(pos) {
        const group = new THREE.Group();

        // Massive armored carapace
        const bodyGeom = new THREE.BoxGeometry(2.4, 2.0, 2.8);
        const armorMat = new THREE.MeshStandardMaterial({
            color: 0x1f2326,
            roughness: 0.15,
            metalness: 0.8
        });
        const bodyMesh = new THREE.Mesh(bodyGeom, armorMat);
        bodyMesh.position.y = 1.4;
        bodyMesh.castShadow = true;
        group.add(bodyMesh);

        // Horns/Battering Spikes
        const spikeGeom = new THREE.ConeGeometry(0.35, 1.4, 6);
        spikeGeom.rotateX(Math.PI / 2);
        const spikeL = new THREE.Mesh(spikeGeom, armorMat);
        const spikeR = new THREE.Mesh(spikeGeom, armorMat);
        spikeL.position.set(0.9, 1.4, 1.6);
        spikeR.position.set(-0.9, 1.4, 1.6);
        group.add(spikeL);
        group.add(spikeR);

        // Molten glowing eyes and spinal vents
        const ventGeom = new THREE.BoxGeometry(0.4, 0.4, 1.6);
        const ventMesh = new THREE.Mesh(ventGeom, this.eyeMatRed);
        ventMesh.position.set(0, 2.5, -0.2);
        group.add(ventMesh);

        const eyeGeom = new THREE.SphereGeometry(0.18, 6, 6);
        const eyeL = new THREE.Mesh(eyeGeom, this.eyeMatRed);
        const eyeR = new THREE.Mesh(eyeGeom, this.eyeMatRed);
        eyeL.position.set(0.5, 1.8, 1.45);
        eyeR.position.set(-0.5, 1.8, 1.45);
        group.add(eyeL);
        group.add(eyeR);

        group.position.copy(pos);
        group.position.y = 0;

        return {
            type: 'BEHEMOTH',
            mesh: group,
            radius: 1.8,
            health: 320,
            maxHealth: 320,
            speed: 3.8,
            chargeSpeed: 16.0,
            isCharging: false,
            chargeTimer: 0,
            chargeCooldown: 5.0,
            chargeDir: new THREE.Vector3(),
            damage: 35,
            alive: true,
            scoreValue: 500,
            update: function(dt, player, walls, alienMgr) {
                const toPlayer = new THREE.Vector3().subVectors(player.mesh.position, this.mesh.position);
                toPlayer.y = 0;
                const dist = toPlayer.length();

                if (this.chargeCooldown > 0) this.chargeCooldown -= dt;

                if (this.isCharging) {
                    // Charging forward
                    this.chargeTimer -= dt;
                    this.mesh.position.addScaledVector(this.chargeDir, this.chargeSpeed * dt);

                    // Impact player
                    if (dist < 2.2) {
                        player.takeDamage(this.damage);
                        player.applyKnockback(this.chargeDir.clone().multiplyScalar(15));
                        this.isCharging = false;
                        Sound.playExplosion();
                    }

                    if (this.chargeTimer <= 0) {
                        this.isCharging = false;
                        this.chargeCooldown = 5.5;
                    }
                } else {
                    // Regular stalk
                    this.mesh.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);
                    const dir = toPlayer.clone().normalize();
                    this.mesh.position.addScaledVector(dir, this.speed * dt);

                    // Trigger Charge
                    if (dist < 18 && dist > 5 && this.chargeCooldown <= 0) {
                        this.isCharging = true;
                        this.chargeTimer = 1.3;
                        this.chargeDir = dir.clone();
                        Sound.playAlienScreech('behemoth');
                    }

                    if (dist < 2.0) {
                        player.takeDamage(15);
                    }
                }
            },
            takeDamage: function(dmg, impulse) {
                // Armored front deflects 40% damage
                this.health -= dmg * 0.7;
                this.mesh.position.add(impulse.multiplyScalar(0.2));
                if (this.health <= 0) {
                    this.alive = false;
                    Sound.playAlienDeath();
                }
            }
        };
    }

    // ------------------------------------------------------------------------
    // 4. PHANTOM - Cloaked predator, visible in light
    // ------------------------------------------------------------------------
    createPhantom(pos) {
        const group = new THREE.Group();

        // Translucent insectoid stalker
        const cloakMat = new THREE.MeshStandardMaterial({
            color: 0x330044,
            transparent: true,
            opacity: 0.25,
            roughness: 0.1,
            metalness: 0.9
        });

        const bodyGeom = new THREE.CylinderGeometry(0.25, 0.4, 2.0, 6);
        const bodyMesh = new THREE.Mesh(bodyGeom, cloakMat);
        bodyMesh.position.y = 1.0;
        group.add(bodyMesh);

        // Twin Sickle Blades
        const bladeGeom = new THREE.BoxGeometry(0.1, 0.8, 0.2);
        const bladeL = new THREE.Mesh(bladeGeom, cloakMat);
        const bladeR = new THREE.Mesh(bladeGeom, cloakMat);
        bladeL.position.set(0.6, 1.2, 0.5);
        bladeR.position.set(-0.6, 1.2, 0.5);
        bladeL.rotation.x = 0.6;
        bladeR.rotation.x = 0.6;
        group.add(bladeL);
        group.add(bladeR);

        // Glowing Sinister Eyes (Always visible in dark!)
        const eyeGeom = new THREE.SphereGeometry(0.12, 6, 6);
        const eyeL = new THREE.Mesh(eyeGeom, this.eyeMatPurple);
        const eyeR = new THREE.Mesh(eyeGeom, this.eyeMatPurple);
        eyeL.position.set(0.18, 1.8, 0.3);
        eyeR.position.set(-0.18, 1.8, 0.3);
        group.add(eyeL);
        group.add(eyeR);

        group.position.copy(pos);

        return {
            type: 'PHANTOM',
            mesh: group,
            cloakMat: cloakMat,
            radius: 0.8,
            health: 95,
            maxHealth: 95,
            speed: 7.2,
            damage: 26,
            alive: true,
            scoreValue: 350,
            teleportCooldown: 4.0,
            update: function(dt, player, walls, alienMgr) {
                const toPlayer = new THREE.Vector3().subVectors(player.mesh.position, this.mesh.position);
                toPlayer.y = 0;
                const dist = toPlayer.length();

                this.mesh.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);

                // Check illumination by player's flashlight or nearby flares
                const inLight = player.isIlluminating(this.mesh.position) || alienMgr.isPositionLitByFlare(this.mesh.position);
                this.cloakMat.opacity = inLight ? 0.95 : 0.25;

                // Teleport flanking maneuver when taking heavy pursuit
                if (this.teleportCooldown > 0) this.teleportCooldown -= dt;

                if (dist > 10 && this.teleportCooldown <= 0 && Math.random() < 0.02) {
                    this.teleportCooldown = 6.0;
                    // Flank behind player
                    const behind = player.getForwardVector().negate().multiplyScalar(5 + Math.random() * 3);
                    this.mesh.position.copy(player.mesh.position).add(behind);
                    this.mesh.position.y = 0;
                    Sound.playAlienScreech('phantom');
                } else {
                    const dir = toPlayer.clone().normalize();
                    this.mesh.position.addScaledVector(dir, this.speed * dt);
                }

                if (dist < 1.4) {
                    player.takeDamage(this.damage);
                    // Fade strike
                    this.teleportCooldown = 2.0;
                }
            },
            takeDamage: function(dmg, impulse) {
                this.health -= dmg;
                this.cloakMat.opacity = 1.0; // Flickers visible on hit
                this.mesh.position.add(impulse);
                if (this.health <= 0) {
                    this.alive = false;
                    Sound.playAlienDeath();
                }
            }
        };
    }

    // ------------------------------------------------------------------------
    // 5. BOSS: HIVE MATRIARCH
    // ------------------------------------------------------------------------
    createBoss(pos) {
        const group = new THREE.Group();

        // Enormous organic horror mesh
        const coreGeom = new THREE.DodecahedronGeometry(3.2);
        const coreMat = new THREE.MeshStandardMaterial({
            color: 0x220515,
            roughness: 0.2,
            metalness: 0.5
        });
        const coreMesh = new THREE.Mesh(coreGeom, coreMat);
        coreMesh.position.y = 3.2;
        coreMesh.castShadow = true;
        group.add(coreMesh);

        // Crown of Glowing Eyes
        const eyeRing = 8;
        for (let i = 0; i < eyeRing; i++) {
            const angle = (i / eyeRing) * Math.PI * 2;
            const eye = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 8), this.eyeMatRed);
            eye.position.set(Math.cos(angle) * 3.1, 3.6, Math.sin(angle) * 3.1);
            group.add(eye);
        }

        // Giant Mandible scythes
        const scytheGeom = new THREE.BoxGeometry(0.4, 4.0, 0.8);
        const scytheL = new THREE.Mesh(scytheGeom, coreMat);
        const scytheR = new THREE.Mesh(scytheGeom, coreMat);
        scytheL.position.set(3.4, 2.0, 2.0);
        scytheR.position.set(-3.4, 2.0, 2.0);
        scytheL.rotation.z = -0.4;
        scytheR.rotation.z = 0.4;
        group.add(scytheL);
        group.add(scytheR);

        group.position.copy(pos);

        return {
            type: 'BOSS',
            mesh: group,
            radius: 3.5,
            health: 1200,
            maxHealth: 1200,
            speed: 3.0,
            alive: true,
            scoreValue: 3000,
            summonTimer: 6.0,
            barrageTimer: 4.0,
            update: function(dt, player, walls, alienMgr) {
                const toPlayer = new THREE.Vector3().subVectors(player.mesh.position, this.mesh.position);
                toPlayer.y = 0;
                const dist = toPlayer.length();

                this.mesh.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);

                const dir = toPlayer.clone().normalize();
                this.mesh.position.addScaledVector(dir, this.speed * dt);

                // Pulse boss body
                const p = 1.0 + Math.sin(performance.now() * 0.005) * 0.08;
                this.mesh.scale.setScalar(p);

                // 1. Minion Swarm Summoning
                this.summonTimer -= dt;
                if (this.summonTimer <= 0) {
                    this.summonTimer = 9.0;
                    for (let s = 0; s < 3; s++) {
                        const spawnOffset = new THREE.Vector3(
                            (Math.random() - 0.5) * 6,
                            0,
                            (Math.random() - 0.5) * 6
                        );
                        alienMgr.spawnAlien('SCUTTLER', this.mesh.position.clone().add(spawnOffset));
                    }
                    Sound.playAlienScreech('behemoth');
                }

                // 2. Radial Acid Barrage
                this.barrageTimer -= dt;
                if (this.barrageTimer <= 0) {
                    this.barrageTimer = 4.5;
                    const pellets = 8;
                    for (let b = 0; b < pellets; b++) {
                        const angle = (b / pellets) * Math.PI * 2;
                        const tgt = this.mesh.position.clone().add(new THREE.Vector3(Math.cos(angle) * 15, 0, Math.sin(angle) * 15));
                        alienMgr.spawnAcidProjectile(this.mesh.position.clone().add(new THREE.Vector3(0, 3, 0)), tgt);
                    }
                }

                if (dist < 4.0) {
                    player.takeDamage(40);
                }
            },
            takeDamage: function(dmg, impulse) {
                this.health -= dmg;
                if (this.health <= 0) {
                    this.alive = false;
                    Sound.playAlienDeath();
                    Sound.playExplosion();
                }
            }
        };
    }

    // ------------------------------------------------------------------------
    // ACID PROJECTILE & HAZARD POOL SIMULATION
    // ------------------------------------------------------------------------
    spawnAcidProjectile(from, target) {
        const geom = new THREE.SphereGeometry(0.3, 8, 8);
        const mat = new THREE.MeshBasicMaterial({ color: 0x39ff14 });
        const mesh = new THREE.Mesh(geom, mat);
        mesh.position.copy(from);

        const light = new THREE.PointLight(0x39ff14, 2.0, 7);
        mesh.add(light);
        this.scene.add(mesh);

        const toTarget = new THREE.Vector3().subVectors(target, from);
        const flightTime = 1.0;
        const vel = new THREE.Vector3(toTarget.x / flightTime, 7.0, toTarget.z / flightTime);

        this.acidProjectiles.push({
            mesh: mesh,
            vel: vel,
            life: flightTime,
            maxLife: flightTime
        });

        Sound.playAlienScreech('spitter');
    }

    createAcidWarningBadge() {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = 'rgba(25, 0, 5, 0.88)';
        ctx.strokeStyle = '#ff2255';
        ctx.lineWidth = 3;
        ctx.strokeRect(4, 4, 248, 56);
        ctx.fillRect(4, 4, 248, 56);

        ctx.fillStyle = '#ff2255';
        ctx.font = 'bold 22px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('⚠️ HAZARD', 128, 27);

        ctx.fillStyle = '#ffcc00';
        ctx.font = 'bold 15px monospace';
        ctx.fillText('TOXIC CORROSIVE ACID', 128, 48);

        const texture = new THREE.CanvasTexture(canvas);
        const mat = new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true });
        const sprite = new THREE.Sprite(mat);
        sprite.scale.set(2.4, 0.6, 1);
        return sprite;
    }

    spawnAcidPool(pos) {
        const mesh = new THREE.Mesh(this.acidGeom, this.acidMat);
        mesh.position.copy(pos);
        mesh.position.y = 0.05; // Slightly above floor to prevent z-fighting
        this.scene.add(mesh);

        // Add 3D warning label
        const badge = this.createAcidWarningBadge();
        badge.position.copy(pos);
        badge.position.y = 1.0;
        this.scene.add(badge);

        this.acidPools.push({
            mesh: mesh,
            badge: badge,
            pos: pos.clone(),
            radius: 1.8,
            life: 8.0,
            maxLife: 8.0,
            damageTick: 0
        });
    }

    isPositionLitByFlare(pos) {
        if (!this.flares) return false;
        for (let i = 0; i < this.flares.length; i++) {
            const f = this.flares[i];
            if (f.mesh.position.distanceTo(pos) < 24) {
                return true;
            }
        }
        return false;
    }

    update(dt, player, walls, weaponMgr) {
        this.flares = weaponMgr.flares;
        // Update all living aliens
        for (let i = this.aliens.length - 1; i >= 0; i--) {
            const alien = this.aliens[i];
            if (!alien.alive) {
                // Drop dead particles
                weaponMgr.spawnSparks(alien.mesh.position, 0x00ff66, 20);
                this.scene.remove(alien.mesh);
                this.aliens.splice(i, 1);
                continue;
            }
            alien.update(dt, player, walls, this);
        }

        // Update acid projectiles
        for (let i = this.acidProjectiles.length - 1; i >= 0; i--) {
            const p = this.acidProjectiles[i];
            p.life -= dt;
            p.vel.y -= 14 * dt; // gravity
            p.mesh.position.addScaledVector(p.vel, dt);

            if (p.life <= 0 || p.mesh.position.y <= 0.2) {
                // Hit ground, spawn pool
                this.spawnAcidPool(p.mesh.position);
                this.scene.remove(p.mesh);
                this.acidProjectiles.splice(i, 1);
            }
        }

        // Update acid hazard pools
        for (let i = this.acidPools.length - 1; i >= 0; i--) {
            const pool = this.acidPools[i];
            pool.life -= dt;
            pool.mesh.material.opacity = (pool.life / pool.maxLife) * 0.7;
            if (pool.badge) {
                pool.badge.material.opacity = Math.min(1.0, pool.life / 2.0);
            }

            // Damage player if stepped in
            const dist = player.mesh.position.distanceTo(pool.pos);
            if (dist < pool.radius) {
                pool.damageTick += dt;
                if (pool.damageTick > 0.4) {
                    pool.damageTick = 0;
                    player.takeDamage(12);
                    Sound.playPlayerHit();
                }
            }

            if (pool.life <= 0) {
                this.scene.remove(pool.mesh);
                if (pool.badge) this.scene.remove(pool.badge);
                this.acidPools.splice(i, 1);
            }
        }
    }
}
