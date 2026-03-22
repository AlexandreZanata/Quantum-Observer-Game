import { fastHash } from "./crypto-engine.js";

const WEAPON_TYPES = ['sword', 'axe', 'spear'];
const WEAPON_SPRITES = {
    sword: './assets/sword.png',
    axe: './assets/axe.png',
    spear: './assets/spear.png'
};

export class QuantumWeapon {
    constructor(x, y, entropyLevel) {
        this.x = x;
        this.y = y;
        this.size = 50;
        this.collected = false;
        this.floatPhase = Math.random() * Math.PI * 2;
        this.glowPhase = Math.random() * Math.PI * 2;
        this.seed = Date.now().toString() + Math.random().toString();
        this.hash = fastHash(this.seed);

        const qSeed = crypto.getRandomValues(new Uint32Array(1))[0];
        const q1 = (qSeed % 100) / 100;
        const q2 = ((qSeed >> 8) % 100) / 100;
        const q3 = ((qSeed >> 16) % 100) / 100;
        const q4 = ((qSeed >> 24) % 100) / 100;

        this.weaponType = WEAPON_TYPES[Math.floor(q1 * WEAPON_TYPES.length)];
        this.weaponEntropy = 20 + Math.floor(q2 * 80);
        const e = this.weaponEntropy / 100;

        this.damage = Math.max(1, Math.floor(q1 * 8 * e) + (q4 > 0.9 ? 12 : 0));
        this.spin = Math.max(0.1, +(0.1 + e * 4 * q2).toFixed(2));
        this.throwSpeed = Math.max(2, +(2 + e * 10 * q3).toFixed(1));
        this.ammo = Math.max(1, 1 + Math.floor(q4 * 10 * e));

        this.entropyHistory = [];
        for (let i = 0; i < 20; i++) this.entropyHistory.push(Math.abs(Math.sin(qSeed + i)) * this.weaponEntropy);
    }

    update() {
        this.floatPhase += 0.05;
        this.glowPhase += 0.04;
    }

    getFloatOffset() {
        return Math.sin(this.floatPhase) * 5;
    }

    checkCollision(px, py, r = 30) {
        if (this.collected) return false;
        const dx = this.x - px, dy = this.y - py;
        return Math.sqrt(dx * dx + dy * dy) < (this.size / 2 + r);
    }
}

export class ThrownWeapon {
    constructor(x, y, angle, weapon) {
        this.x = x;
        this.y = y;
        this.vx = Math.cos(angle) * weapon.throwSpeed;
        this.vy = Math.sin(angle) * weapon.throwSpeed;
        this.damage = weapon.damage;
        this.spin = weapon.spin;
        this.weaponType = weapon.weaponType;
        this.rotation = 0;
        this.life = 120;
        this.size = 40;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.rotation += this.spin * 0.15;
        this.life--;
        return this.life > 0;
    }

    checkEnemyHit(enemy) {
        if (!enemy.alive) return false;
        const dx = this.x - enemy.x, dy = this.y - enemy.y;
        return Math.sqrt(dx * dx + dy * dy) < (this.size / 2 + enemy.size / 3);
    }
}

export class OrbitingWeapon {
    constructor(weapon, orbitIndex = 0) {
        this.damage = weapon.damage;
        this.spin = weapon.spin;
        this.weaponType = weapon.weaponType;
        this.angle = (Math.PI * 2 / 3) * orbitIndex;
        this.radius = 80 + orbitIndex * 25;
        this.size = 36;
        this.rotation = 0;
        this.active = true;
        this.ammo = weapon.ammo;
        this.x = 0;
        this.y = 0;
        this.y = 0;
        this.hitCooldowns = new Map();
    }

    update(playerX, playerY) {
        this.angle += this.spin * 0.05;
        this.rotation += this.spin * 0.1;
        this.x = playerX + Math.cos(this.angle) * this.radius;
        this.y = playerY + Math.sin(this.angle) * this.radius;
        for (const [id, cd] of this.hitCooldowns) {
            if (cd <= 0) this.hitCooldowns.delete(id);
            else this.hitCooldowns.set(id, cd - 1);
        }
        return this.ammo > 0;
    }

    checkEnemyHit(enemy) {
        if (!enemy.alive || this.ammo <= 0) return false;
        const eid = enemy.x.toFixed(0) + '_' + enemy.y.toFixed(0);
        if (this.hitCooldowns.has(eid)) return false;
        const dx = this.x - enemy.x, dy = this.y - enemy.y;
        if (Math.sqrt(dx * dx + dy * dy) < (this.size / 2 + enemy.size / 3)) {
            this.hitCooldowns.set(eid, 30);
            this.ammo--;
            return true;
        }
        return false;
    }
}

export { WEAPON_TYPES, WEAPON_SPRITES };
