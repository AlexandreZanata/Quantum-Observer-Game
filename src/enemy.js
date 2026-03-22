export class Enemy {
    constructor(x, y, type, entropyLevel = 50) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.speed = 1.5;
        this.health = 1;
        this.alive = true;
        this.size = 80;
        this.floatPhase = Math.random() * Math.PI * 2;
        this.floatAmplitude = 2 + Math.random() * 3;
        this.glowIntensity = 0.5;
        this.glowPhase = Math.random() * Math.PI * 2;
        this.deathTimer = 0;
        this.deathDuration = 40;
        this.opacity = 1;
        this.detectionRadius = 300;
        this.wanderAngle = Math.random() * Math.PI * 2;
        this.wanderTimer = 0;
        this.hitCooldown = 0;
        this.applyTypeTraits(entropyLevel);
    }

    applyTypeTraits(entropyLevel) {
        const e = entropyLevel / 100;
        this.quantumHash = crypto.getRandomValues(new Uint32Array(1))[0];

        const qSpeed = (this.quantumHash % 100) / 100;
        const qHealth = ((this.quantumHash >> 8) % 100) / 100;
        const qSize = ((this.quantumHash >> 16) % 100) / 100;
        const qMod = ((this.quantumHash >> 24) % 100) / 100;

        const isGiant = qMod > 0.9;
        const isTiny = qMod < 0.1;

        const healthMultiplier = isGiant ? 12 : (isTiny ? 0.6 : 3);
        const speedMultiplier = isGiant ? 0.4 : (isTiny ? 2.8 : 1);

        if (this.type === 1) {
            this.speed = (1.2 + qSpeed * 2.2 * e) * speedMultiplier;
            this.glowColor = '#ff6600';
            this.health = Math.max(1, Math.floor(1 + qHealth * e * 5 * healthMultiplier));
        } else if (this.type === 2) {
            this.speed = (1.0 + qSpeed * 1.5 * e) * speedMultiplier;
            this.glowColor = '#a855f7';
            this.health = Math.max(1, Math.floor(1 + qHealth * e * 3.5 * healthMultiplier));
        } else {
            this.speed = (1.6 + qSpeed * 2.6 * e) * speedMultiplier;
            this.glowColor = '#00aaff';
            this.health = Math.max(1, Math.floor(1 + qHealth * e * 2.5 * healthMultiplier));
        }

        this.size = isGiant ? 100 + Math.floor(qSize * 40 * e) : (isTiny ? 25 + Math.floor(qSize * 15) : 40 + Math.floor(qSize * 30 * e));
    }

    update(playerX, playerY) {
        if (!this.alive) {
            this.deathTimer++;
            this.opacity = 1 - (this.deathTimer / this.deathDuration);
            return this.deathTimer < this.deathDuration;
        }
        if (this.hitCooldown > 0) this.hitCooldown--;
        this.floatPhase += 0.05;
        this.glowPhase += 0.03;

        this.wanderTimer++;
        if (this.wanderTimer > 20) {
            this.quantumHash = (this.quantumHash * 1103515245 + 12345) >>> 0;
            this.wanderAngle = (this.quantumHash % 360) * (Math.PI / 180);

            if (this.quantumHash % 100 < 20) {
                this.x += Math.cos(this.wanderAngle) * 60;
                this.y += Math.sin(this.wanderAngle) * 60;
            }
            this.wanderTimer = 0;
        }

        this.x += Math.cos(this.wanderAngle) * this.speed;
        this.y += Math.sin(this.wanderAngle) * this.speed;
        return true;
    }

    wander() {
        this.wanderTimer++;
        if (this.wanderTimer > 120) { this.wanderAngle += (Math.random() - 0.5) * 1.5; this.wanderTimer = 0; }
        this.x += Math.cos(this.wanderAngle) * this.speed * 0.4;
        this.y += Math.sin(this.wanderAngle) * this.speed * 0.4;
    }

    takeDamage(amount = 1) {
        if (this.hitCooldown > 0) return false;
        this.health -= amount;
        this.hitCooldown = 10;
        if (this.health <= 0) this.alive = false;
        return true;
    }

    getFloatOffset() { return Math.sin(this.floatPhase) * this.floatAmplitude; }

    checkCollision(px, py, r = 30) {
        if (!this.alive) return false;
        const dx = this.x - px, dy = this.y - py;
        return Math.sqrt(dx * dx + dy * dy) < (this.size / 2.5 + r);
    }
}

export class CoinItem {
    constructor(x, y) {
        this.x = x; this.y = y; this.size = 40; this.collected = false;
        this.floatPhase = Math.random() * Math.PI * 2;
        this.glowPhase = Math.random() * Math.PI * 2;
        this.goldValue = 1 + Math.floor(Math.random() * 3);
    }
    update() { this.floatPhase += 0.04; this.glowPhase += 0.05; }
    getFloatOffset() { return Math.sin(this.floatPhase) * 4; }
    checkCollision(px, py, r = 30) {
        if (this.collected) return false;
        const dx = this.x - px, dy = this.y - py;
        return Math.sqrt(dx * dx + dy * dy) < (this.size / 2 + r);
    }
}

export class TreasureItem {
    constructor(x, y, entropyLevel = 50) {
        this.x = x; this.y = y; this.size = 55; this.collected = false;
        this.floatPhase = Math.random() * Math.PI * 2;
        this.glowPhase = Math.random() * Math.PI * 2;
        const e = entropyLevel / 100;
        this.goldValue = 5 + Math.floor(Math.random() * 10 * (0.5 + e));
    }
    update() { this.floatPhase += 0.03; this.glowPhase += 0.04; }
    getFloatOffset() { return Math.sin(this.floatPhase) * 5; }
    checkCollision(px, py, r = 30) {
        if (this.collected) return false;
        const dx = this.x - px, dy = this.y - py;
        return Math.sqrt(dx * dx + dy * dy) < (this.size / 2 + r);
    }
}

export class EnemySpawner {
    constructor() {
        this.enemies = [];
        this.coins = [];
        this.treasures = [];
        this.spawnTimer = 0;
        this.coinTimer = 0;
        this.treasureTimer = 0;
        this.maxEnemies = 15;
        this.maxCoins = 12;
        this.maxTreasures = 3;
        this.sprites = {};
        this.spritesLoaded = { 1: false, 2: false, 3: false, coin: false, treasure: false, sword: false, axe: false, spear: false };
        const load = (k, src) => { const img = new Image(); img.src = src; img.onload = () => { this.spritesLoaded[k] = true; }; return img; };
        this.sprites[1] = load(1, './assets/quantun_1.png');
        this.sprites[2] = load(2, './assets/quantun_2.png');
        this.sprites[3] = load(3, './assets/quantun_3.png');
        this.coinSprite = load('coin', './assets/coin.png');
        this.treasureSprite = load('treasure', './assets/treasure.png');
        this.weaponSprites = {};
        this.weaponSprites.sword = load('sword', './assets/sword.png');
        this.weaponSprites.axe = load('axe', './assets/axe.png');
        this.weaponSprites.spear = load('spear', './assets/spear.png');
    }

    update(playerX, playerY, entropyLevel, obsRadius = 250) {
        this.spawnTimer++;
        this.coinTimer++;
        this.treasureTimer++;
        const interval = Math.max(60, 300 - entropyLevel * 2.5);
        if (this.spawnTimer >= interval && this.enemies.length < this.maxEnemies) {
            this.spawnTimer = 0;
            this.spawnEnemy(playerX, playerY, entropyLevel, obsRadius);
        }
        if (this.coinTimer >= 70 && this.coins.length < this.maxCoins) {
            this.coinTimer = 0;
            this.spawnCoin(playerX, playerY, obsRadius);
        }
        if (this.treasureTimer >= 500 && this.treasures.length < this.maxTreasures) {
            this.treasureTimer = 0;
            this.spawnTreasure(playerX, playerY, entropyLevel, obsRadius);
        }
        this.enemies = this.enemies.filter(e => e.update(playerX, playerY));
        this.coins.forEach(c => c.update());
        this.treasures.forEach(t => t.update());
    }

    spawnEnemy(px, py, el, obsR) {
        const qH = crypto.getRandomValues(new Uint32Array(1))[0];
        const a = ((qH % 360) * Math.PI) / 180;
        const d = obsR * 0.6 + (((qH >> 8) % 100) / 100) * obsR * 0.35;
        const type = 1 + (qH % 3);
        this.enemies.push(new Enemy(px + Math.cos(a) * d, py + Math.sin(a) * d, type, el));
    }

    spawnCoin(px, py, obsR) {
        const qH = crypto.getRandomValues(new Uint32Array(1))[0];
        const a = ((qH % 360) * Math.PI) / 180;
        const d = obsR * 0.2 + (((qH >> 8) % 100) / 100) * obsR * 0.7;
        this.coins.push(new CoinItem(px + Math.cos(a) * d, py + Math.sin(a) * d));
    }

    spawnTreasure(px, py, el, obsR) {
        const qH = crypto.getRandomValues(new Uint32Array(1))[0];
        const a = ((qH % 360) * Math.PI) / 180;
        const d = obsR * 0.3 + (((qH >> 8) % 100) / 100) * obsR * 0.6;
        this.treasures.push(new TreasureItem(px + Math.cos(a) * d, py + Math.sin(a) * d, el));
    }

    checkPlayerCollisions(px, py) {
        const hits = [];
        for (const e of this.enemies) if (e.checkCollision(px, py)) hits.push(e);
        return hits;
    }

    checkCoinCollisions(px, py) {
        const c = [];
        for (const coin of this.coins) if (coin.checkCollision(px, py)) { coin.collected = true; c.push(coin); }
        this.coins = this.coins.filter(x => !x.collected);
        return c;
    }

    checkTreasureCollisions(px, py) {
        const c = [];
        for (const t of this.treasures) if (t.checkCollision(px, py)) { t.collected = true; c.push(t); }
        this.treasures = this.treasures.filter(x => !x.collected);
        return c;
    }

    getActiveEnemies() { return this.enemies; }
    getActiveCoins() { return this.coins; }
    getActiveTreasures() { return this.treasures; }
}
