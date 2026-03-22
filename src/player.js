import { QuantumSignatureChain } from "./crypto-engine.js";

export class Player {
    constructor() {
        this.x = 0;
        this.y = 0;
        this.speed = 5;
        this.acceleration = 0.4;
        this.friction = 0.88;
        this.observationRadius = 250;
        this.vx = 0;
        this.vy = 0;
        this.keys = new Set();
        this.qubits = 5;
        this.maxQubits = 5;
        this.gold = 0;
        this.decoherenceTime = 0;
        this.signatureChain = new QuantumSignatureChain();
        this.trail = [];
        this.maxTrailLength = 25;
        this.sprite = new Image();
        this.sprite.src = './assets/player_image__caracter.png';
        this.spriteLoaded = false;
        this.sprite.onload = () => { this.spriteLoaded = true; };
        this.touchActive = false;
        this.touchTarget = { x: 0, y: 0 };
        this._initTouchControls();
    }

    _initTouchControls() {
        window.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.touchActive = true;
            this.touchTarget.x = e.touches[0].clientX;
            this.touchTarget.y = e.touches[0].clientY;
        }, { passive: false });
        window.addEventListener('touchmove', (e) => {
            e.preventDefault();
            this.touchTarget.x = e.touches[0].clientX;
            this.touchTarget.y = e.touches[0].clientY;
        }, { passive: false });
        window.addEventListener('touchend', () => { this.touchActive = false; });
    }

    handleInput(key, isDown) {
        const k = key.toLowerCase();
        isDown ? this.keys.add(k) : this.keys.delete(k);
    }

    takeDamage() {
        if (this.decoherenceTime <= 0) {
            this.qubits--;
            this.decoherenceTime = 30;
            this.signatureChain.addBlock({
                type: 'DAMAGE',
                qubitsLeft: this.qubits,
                position: { x: Math.round(this.x), y: Math.round(this.y) }
            });
        }
    }

    addGold(amount) {
        this.gold += amount;
        this.signatureChain.addBlock({
            type: 'COLLECT_GOLD',
            gold: this.gold,
            amount,
            position: { x: Math.round(this.x), y: Math.round(this.y) }
        });
    }

    signAction(actionType, data = {}) {
        return this.signatureChain.addBlock({
            type: actionType,
            ...data,
            position: { x: Math.round(this.x), y: Math.round(this.y) }
        });
    }

    verifyChain() {
        return this.signatureChain.verifyChain();
    }

    update() {
        if (this.decoherenceTime > 0) this.decoherenceTime--;
        if (this.qubits <= 0) {
            this.vx *= 0.9;
            this.vy *= 0.9;
            return;
        }

        let ax = 0;
        let ay = 0;

        if (this.keys.has("d") || this.keys.has("arrowright")) ax += 1;
        if (this.keys.has("a") || this.keys.has("arrowleft")) ax -= 1;
        if (this.keys.has("s") || this.keys.has("arrowdown")) ay += 1;
        if (this.keys.has("w") || this.keys.has("arrowup")) ay -= 1;

        if (this.touchActive) {
            const cx = window.innerWidth / 2;
            const cy = window.innerHeight / 2;
            const dx = this.touchTarget.x - cx;
            const dy = this.touchTarget.y - cy;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 20) {
                ax = dx / dist;
                ay = dy / dist;
            }
        }

        if (ax !== 0 && ay !== 0) {
            const norm = 1 / Math.SQRT2;
            ax *= norm;
            ay *= norm;
        }

        this.vx += ax * this.acceleration;
        this.vy += ay * this.acceleration;
        this.vx *= this.friction;
        this.vy *= this.friction;

        const maxSpeed = this.speed;
        const currentSpeed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        if (currentSpeed > maxSpeed) {
            this.vx = (this.vx / currentSpeed) * maxSpeed;
            this.vy = (this.vy / currentSpeed) * maxSpeed;
        }

        this.x += this.vx;
        this.y += this.vy;

        if (Math.abs(this.vx) > 0.1 || Math.abs(this.vy) > 0.1) {
            this.trail.push({ x: this.x, y: this.y, alpha: 1 });
            if (this.trail.length > this.maxTrailLength) this.trail.shift();
        }
        for (const point of this.trail) point.alpha -= 0.04;
        this.trail = this.trail.filter(p => p.alpha > 0);
    }
}