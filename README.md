# 🛸 DEAD STATION: ZERO HOUR (3D Sci-Fi Horror Thriller)

> **"When the core died, the station went cold. When the lights went out, the swarm woke."**

---

## 🎮 Quick Start

1. **Already Running Live:** Open your browser to **[http://localhost:3000](http://localhost:3000)**.
2. **One-Click Launcher:** Double-click [`run.bat`](file:///C:/Users/mdhas/.gemini/antigravity/scratch/void-protocol/run.bat) in the project directory.
3. **Manual CLI:**
   ```bash
   agy-node server.js
   ```
4. **Standalone:** You can also open [`index.html`](file:///C:/Users/mdhas/.gemini/antigravity/scratch/void-protocol/index.html) directly in any modern web browser.

---

## 🕹️ Controls

| Action | Control | Description |
| :--- | :--- | :--- |
| **Move** | `W` `A` `S` `D` / Arrow Keys | Move operative through corridors and chambers |
| **Aim** | Mouse Cursor | Aim weapon and tactical flashlight cone |
| **Shoot** | Left Mouse Button (Hold) | Fire active weapon |
| **Deploy Flare** | Right Mouse Button or `F` | Throw high-intensity tactical flare into the dark |
| **Tactical Dash** | `Shift` or `Space` | Quick invulnerability dash to evade swarms |
| **Switch Weapon** | `1` `2` `3` `4` or Mouse Wheel | Swap between 4 specialized firearms |
| **Reload** | `R` | Reload current firearm |
| **Toggle Audio** | `M` | Mute or unmute synthesized soundscape |

---

## ⚡ What Makes This Game Unique?

### 1. **Dynamic Lighting vs. Cloaked Alien Ecology**
- **Flashlight & Shadows:** Your tactical flashlight cuts a narrow beam through pitch black fog.
- **Void Phantoms (Stealth Predators):** These aliens are semi-invisible in darkness; only their sinister purple eyes glow. Illuminating them with your flashlight or flares strips their cloak and forces them into view!
- **Deployable Flares:** Throw illumination flares that burn for 22 seconds, securing choke points and creating defensive safe zones.
- **Auxiliary Power Terminals:** Locate inactive generators across the sector and reboot them to flood entire rooms with overhead spotlights!

### 2. **Procedural Web Audio Thriller Soundscape (Zero Assets Needed)**
- **Sub-Bass Horror Drone:** Modulated LFO sub-bass frequencies create an eerie, claustrophobic atmosphere.
- **Biometric Heartbeat Sensor:** Your heartbeat accelerates in real-time as aliens stalk closer in the darkness or when your vitals drop.
- **Retro Motion Tracker:** Inspired by classic sci-fi thrillers, an animated green CRT radar sweeps for hostile biological signatures with periodic audio pings.

### 3. **Deep Weapon Arsenal & Physics**
1. **MK-IV Pulse Carbine:** Rapid-fire blue plasma rifle for precise engagements.
2. **Thermite Trench-Gun:** High-spread incendiary buckshot with massive knockback.
3. **Voltaic Arc Emitter:** Chains high-voltage electric bolts across clusters of aliens.
4. **Vortex Imploder:** Fires a gravitational singularity that vacuums aliens inward before detonating with massive force.

### 4. **Alien Bestiary**
- **Scuttler (The Swarm):** Erratically leaping arachnid bio-forms that flank in packs.
- **Spitter (Bile Hydra):** Ranged bio-artillery spitting corrosive acid orbs that leave damaging caustic pools on the floor.
- **Behemoth (Armored Crusher):** Heavy armored juggernaut that deflects frontal shots, roars, and charges at freight-train speed.
- **Phantom (Shadow Stalker):** Cloaked assassin that teleports behind you and strikes from the dark.
- **Hive Matriarch (Boss):** Massive multi-phase boss summoning minions and launching radial acid barrages.

### 5. **Roguelite Augmentations (Perk Cards)**
Survive each wave to choose powerful suit and weapon upgrades:
- *Bouncing Tungsten Rounds* (Bullets ricochet off walls)
- *Orbital Defense Drone* (Autonomous flying companion that zaps aliens)
- *Nanite Biometric Repair* (Regenerate health over time)
- *High-Energy Capacitors* (+35% fire rate)
- *Emergency Bio-EMP* (Discharges a room-wide shockwave when taking critical damage)

---

## 📁 Project Structure

```
void-protocol/
├── index.html          # Main HTML entry with CRT overlay and HUD
├── styles.css          # Dark sci-fi styling, radar UI, scanlines
├── server.js           # Zero-dependency local Node server
├── run.bat             # 1-click Windows launcher
└── js/
    ├── audio.js        # Procedural Web Audio synthesizer (ambience, heartbeat, SFX)
    ├── weapons.js      # Weapons, projectiles, flares, vortex physics
    ├── aliens.js       # 5 distinct alien AI behaviors, acid pools, boss logic
    ├── environment.js  # Procedural textures, outpost generator, interactive power
    └── game.js         # Core engine loop, player controller, radar, upgrades
```
