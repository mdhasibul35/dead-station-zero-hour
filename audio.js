// ============================================================================
// AUDIO SYSTEM - PROCEDURAL WEB AUDIO SYNTHESIZER
// Zero external assets required. 100% dynamic thriller soundscape & SFX.
// ============================================================================

class SoundManager {
    constructor() {
        this.ctx = null;
        this.isMuted = false;
        this.masterVolume = 0.7;
        this.ambientGain = null;
        this.sfxGain = null;
        this.initialized = false;

        // Ambient synthesizer state
        this.ambientOsc1 = null;
        this.ambientOsc2 = null;
        this.ambientFilter = null;
        this.ambientLfo = null;
        this.droneActive = false;

        // Heartbeat state
        this.heartbeatInterval = null;
        this.heartbeatRate = 1000; // ms between beats
        this.isHeartbeatRunning = false;
    }

    init() {
        if (this.initialized) return;
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();

            // Master Gain
            this.master = this.ctx.createGain();
            this.master.gain.value = this.masterVolume;
            this.master.connect(this.ctx.destination);

            // Channel Gains
            this.sfxGain = this.ctx.createGain();
            this.sfxGain.gain.value = 0.85;
            this.sfxGain.connect(this.master);

            this.ambientGain = this.ctx.createGain();
            this.ambientGain.gain.value = 0.35;
            this.ambientGain.connect(this.master);

            this.initialized = true;
            this.startDarkAmbience();
            this.startHeartbeatLoop();
        } catch (e) {
            console.warn("Web Audio API not supported or blocked", e);
        }
    }

    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        if (this.master) {
            this.master.gain.setTargetAtTime(this.isMuted ? 0 : this.masterVolume, this.ctx.currentTime, 0.05);
        }
        return this.isMuted;
    }

    // ------------------------------------------------------------------------
    // AMBIENT THRILLER SOUNDSCAPE
    // ------------------------------------------------------------------------
    startDarkAmbience() {
        if (!this.initialized || this.droneActive) return;
        const now = this.ctx.currentTime;

        // Sub-bass drone 1 (Low C# / D)
        this.ambientOsc1 = this.ctx.createOscillator();
        this.ambientOsc1.type = 'sawtooth';
        this.ambientOsc1.frequency.setValueAtTime(46.25, now); // F#1

        // Sub-bass drone 2 (Detuned for ominous beat frequencies)
        this.ambientOsc2 = this.ctx.createOscillator();
        this.ambientOsc2.type = 'triangle';
        this.ambientOsc2.frequency.setValueAtTime(47.1, now);

        // Low-pass filter to make it heavy and claustrophobic
        this.ambientFilter = this.ctx.createBiquadFilter();
        this.ambientFilter.type = 'lowpass';
        this.ambientFilter.frequency.setValueAtTime(140, now);
        this.ambientFilter.Q.setValueAtTime(4.0, now);

        // LFO modulating the filter cutoff for eerie breathing effect
        this.ambientLfo = this.ctx.createOscillator();
        this.ambientLfo.type = 'sine';
        this.ambientLfo.frequency.setValueAtTime(0.12, now); // Slow 8-second cycle

        const lfoGain = this.ctx.createGain();
        lfoGain.gain.setValueAtTime(60, now);

        this.ambientLfo.connect(lfoGain);
        lfoGain.connect(this.ambientFilter.frequency);

        this.ambientOsc1.connect(this.ambientFilter);
        this.ambientOsc2.connect(this.ambientFilter);
        this.ambientFilter.connect(this.ambientGain);

        this.ambientOsc1.start();
        this.ambientOsc2.start();
        this.ambientLfo.start();
        this.droneActive = true;

        // Occasional metallic dissonance
        this.scheduleMetallicSting();
    }

    scheduleMetallicSting() {
        if (!this.droneActive) return;
        const delay = 8000 + Math.random() * 12000;
        setTimeout(() => {
            if (this.droneActive && this.initialized) {
                this.playMetallicResonance();
                this.scheduleMetallicSting();
            }
        }, delay);
    }

    playMetallicResonance() {
        if (!this.initialized || this.isMuted) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        osc.type = 'sawtooth';
        const freqs = [311.13, 329.63, 415.30, 440.00, 622.25]; // Diminished/minor intervals
        osc.frequency.setValueAtTime(freqs[Math.floor(Math.random() * freqs.length)], now);

        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(800, now);
        filter.Q.setValueAtTime(12, now);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.exponentialRampToValueAtTime(0.08, now + 1.2);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 5.0);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ambientGain);

        osc.start(now);
        osc.stop(now + 5.2);
    }

    // ------------------------------------------------------------------------
    // DYNAMIC HEARTBEAT
    // Speeds up when health is low or aliens are lurking close in the dark
    // ------------------------------------------------------------------------
    startHeartbeatLoop() {
        if (this.isHeartbeatRunning) return;
        this.isHeartbeatRunning = true;

        const pulse = () => {
            if (!this.isHeartbeatRunning) return;
            if (this.heartbeatRate < 1400) {
                this.playSingleHeartbeat();
            }
            this.heartbeatTimeout = setTimeout(pulse, this.heartbeatRate);
        };
        pulse();
    }

    setHeartbeatIntensity(factor) {
        // factor 0 = calm (1600ms), 1 = maximum panic (400ms)
        const clamped = Math.max(0, Math.min(1, factor));
        this.heartbeatRate = 1500 - (clamped * 1100);
    }

    playSingleHeartbeat() {
        if (!this.initialized || this.isMuted) return;
        const now = this.ctx.currentTime;

        const playThump = (timeOffset, freq, vol) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + timeOffset);
            osc.frequency.exponentialRampToValueAtTime(25, now + timeOffset + 0.14);

            gain.gain.setValueAtTime(vol, now + timeOffset);
            gain.gain.exponentialRampToValueAtTime(0.001, now + timeOffset + 0.15);

            osc.connect(gain);
            gain.connect(this.sfxGain);

            osc.start(now + timeOffset);
            osc.stop(now + timeOffset + 0.16);
        };

        // Double thump ("lub-dub")
        playThump(0, 75, 0.4);
        playThump(0.12, 60, 0.28);
    }

    // ------------------------------------------------------------------------
    // WEAPONS & COMBAT SFX
    // ------------------------------------------------------------------------
    playShootCarbine() {
        if (!this.initialized || this.isMuted) return;
        const now = this.ctx.currentTime;

        // Tone component
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(580, now);
        osc.frequency.exponentialRampToValueAtTime(90, now + 0.08);

        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

        // Noise click
        const bufferSize = this.ctx.sampleRate * 0.04;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.2, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.04);

        osc.connect(gain);
        gain.connect(this.sfxGain);
        noise.connect(noiseGain);
        noiseGain.connect(this.sfxGain);

        osc.start(now);
        osc.stop(now + 0.1);
        noise.start(now);
    }

    playShootShotgun() {
        if (!this.initialized || this.isMuted) return;
        const now = this.ctx.currentTime;

        // Heavy bass punch
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + 0.22);

        gain.gain.setValueAtTime(0.7, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

        // Explosive burst noise
        const bufferSize = this.ctx.sampleRate * 0.2;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.25));
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(900, now);
        filter.frequency.exponentialRampToValueAtTime(200, now + 0.2);

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.5, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

        osc.connect(gain);
        gain.connect(this.sfxGain);

        noise.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(this.sfxGain);

        osc.start(now);
        osc.stop(now + 0.25);
        noise.start(now);
    }

    playShootArc() {
        if (!this.initialized || this.isMuted) return;
        const now = this.ctx.currentTime;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(920 + Math.random() * 300, now);
        osc.frequency.linearRampToValueAtTime(220, now + 0.12);

        gain.gain.setValueAtTime(0.28, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

        // Modulate with high freq tremolo
        const trem = this.ctx.createOscillator();
        trem.frequency.setValueAtTime(45, now);
        const tremGain = this.ctx.createGain();
        tremGain.gain.setValueAtTime(0.1, now);
        trem.connect(gain.gain);

        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.start(now);
        trem.start(now);
        osc.stop(now + 0.15);
        trem.stop(now + 0.15);
    }

    playShootSingularity() {
        if (!this.initialized || this.isMuted) return;
        const now = this.ctx.currentTime;

        // Whoosh charge
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.exponentialRampToValueAtTime(750, now + 0.18);

        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.22);

        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.start(now);
        osc.stop(now + 0.25);
    }

    playExplosion() {
        if (!this.initialized || this.isMuted) return;
        const now = this.ctx.currentTime;

        const bufferSize = this.ctx.sampleRate * 0.7;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.2));
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(600, now);
        filter.frequency.exponentialRampToValueAtTime(60, now + 0.6);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.9, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.68);

        // Sub shock
        const sub = this.ctx.createOscillator();
        const subGain = this.ctx.createGain();
        sub.type = 'sine';
        sub.frequency.setValueAtTime(90, now);
        sub.frequency.exponentialRampToValueAtTime(20, now + 0.4);
        subGain.gain.setValueAtTime(0.7, now);
        subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxGain);

        sub.connect(subGain);
        subGain.connect(this.sfxGain);

        noise.start(now);
        sub.start(now);
        sub.stop(now + 0.5);
    }

    // ------------------------------------------------------------------------
    // ALIEN VOICES & EVENTS
    // ------------------------------------------------------------------------
    playAlienScreech(type = 'scuttler') {
        if (!this.initialized || this.isMuted) return;
        const now = this.ctx.currentTime;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        if (type === 'behemoth') {
            // Low guttural bellow
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(90, now);
            osc.frequency.linearRampToValueAtTime(140, now + 0.2);
            osc.frequency.exponentialRampToValueAtTime(40, now + 0.6);
            gain.gain.setValueAtTime(0.5, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
        } else if (type === 'spitter') {
            // Corrosive bubbling hiss
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(420, now);
            osc.frequency.linearRampToValueAtTime(280, now + 0.18);
            gain.gain.setValueAtTime(0.3, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        } else if (type === 'phantom') {
            // Eerie spectral phasing
            osc.type = 'sine';
            osc.frequency.setValueAtTime(650, now);
            osc.frequency.exponentialRampToValueAtTime(120, now + 0.4);
            gain.gain.setValueAtTime(0.25, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
        } else {
            // High chitin scuttle shriek
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(800 + Math.random() * 300, now);
            osc.frequency.exponentialRampToValueAtTime(300, now + 0.12);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        }

        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.start(now);
        osc.stop(now + 0.7);
    }

    playAlienDeath() {
        if (!this.initialized || this.isMuted) return;
        const now = this.ctx.currentTime;
        // Wet squelch + pitch fall
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(240, now);
        osc.frequency.exponentialRampToValueAtTime(45, now + 0.16);

        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.start(now);
        osc.stop(now + 0.2);
    }

    // ------------------------------------------------------------------------
    // TACTICAL & UI SFX
    // ------------------------------------------------------------------------
    playMotionTrackerPing() {
        if (!this.initialized || this.isMuted) return;
        const now = this.ctx.currentTime;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1760, now); // A6
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.08);

        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.start(now);
        osc.stop(now + 0.1);
    }

    playDash() {
        if (!this.initialized || this.isMuted) return;
        const now = this.ctx.currentTime;

        const bufferSize = this.ctx.sampleRate * 0.15;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.sin((i / bufferSize) * Math.PI);
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(400, now);
        filter.frequency.exponentialRampToValueAtTime(1200, now + 0.12);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxGain);

        noise.start(now);
    }

    playPlayerHit() {
        if (!this.initialized || this.isMuted) return;
        const now = this.ctx.currentTime;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(130, now);
        osc.frequency.exponentialRampToValueAtTime(50, now + 0.15);

        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.start(now);
        osc.stop(now + 0.2);
    }

    playFlareDeploy() {
        if (!this.initialized || this.isMuted) return;
        const now = this.ctx.currentTime;

        // Flare spark hiss
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(700, now);
        osc.frequency.linearRampToValueAtTime(1800, now + 0.2);

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.start(now);
        osc.stop(now + 0.26);
    }

    playGeneratorBoot() {
        if (!this.initialized || this.isMuted) return;
        const now = this.ctx.currentTime;

        // Rising power turbine hum
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(60, now);
        osc.frequency.exponentialRampToValueAtTime(320, now + 0.8);

        gain.gain.setValueAtTime(0.01, now);
        gain.gain.linearRampToValueAtTime(0.35, now + 0.3);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);

        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.start(now);
        osc.stop(now + 1.0);
    }

    playUpgradeSelect() {
        if (!this.initialized || this.isMuted) return;
        const now = this.ctx.currentTime;

        const chord = [523.25, 659.25, 783.99, 1046.50]; // C Major arpeggio
        chord.forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + idx * 0.06);

            gain.gain.setValueAtTime(0.2, now + idx * 0.06);
            gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.3);

            osc.connect(gain);
            gain.connect(this.sfxGain);

            osc.start(now + idx * 0.06);
            osc.stop(now + idx * 0.06 + 0.35);
        });
    }

    playWaveAlarm() {
        if (!this.initialized || this.isMuted) return;
        const now = this.ctx.currentTime;

        for (let i = 0; i < 2; i++) {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sawtooth';
            const offset = i * 0.35;
            osc.frequency.setValueAtTime(440, now + offset);
            osc.frequency.linearRampToValueAtTime(880, now + offset + 0.25);

            gain.gain.setValueAtTime(0.25, now + offset);
            gain.gain.exponentialRampToValueAtTime(0.01, now + offset + 0.28);

            osc.connect(gain);
            gain.connect(this.sfxGain);

            osc.start(now + offset);
            osc.stop(now + offset + 0.3);
        }
    }
}

// Global Sound Instance
const Sound = new SoundManager();
