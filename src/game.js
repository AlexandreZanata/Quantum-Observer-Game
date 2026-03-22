import { Player } from "./player.js";
import { World } from "./world.js";
import { Renderer } from "./renderer.js";
import { EnemySpawner } from "./enemy.js";
import { QuantumWeapon, ThrownWeapon, OrbitingWeapon } from "./weapon.js";
import { entropyPool } from "./utils.js";
import { generateHumanChallenge, encryptScore, fastHash } from "./crypto-engine.js";
import { t, initI18n, setLanguage, getCurrentLang } from "./i18n.js";

export class Game {
    constructor(canvas, ctx) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.player = new Player();
        this.world = new World();
        this.enemySpawner = new EnemySpawner();
        this.renderer = new Renderer(ctx, this.world, this.player, this.enemySpawner);
        this.entropy = entropyPool;
        this.state = 'start';
        this.playerName = localStorage.getItem('qo_name') || '';
        this.bgMode = localStorage.getItem('qo_bg') || 'lattice';
        this.gameMode = localStorage.getItem('qo_mode') || 'quantum';
        this.runSeedHash = null;
        this.maxWeaponsActive = 3;
        this.challengeData = null;
        this.challengeResult = null;
        this.challengeResultTimer = 0;
        this.challengeHintShown = false;
        this.startPulse = 0;
        this.particles = [];
        this.maxTerminalLines = 20;
        this.terminalUpdateTimer = 0;
        this.ranking = this.loadRanking();
        this.mouseX = 0;
        this.mouseY = 0;
        this.weaponPickups = [];
        this.thrownWeapons = [];
        this.orbitingWeapons = [];
        this.playerWeapons = [];
        this.weaponModalData = null;
        this.weaponSpawnTimer = 0;
        this.challengeBtnRects = [];
        this.hintBtnRect = { x: 0, y: 0, w: 0, h: 0 };
        this.orbitTipTimer = 0;
        this.showOrbitTip = false;

        initI18n();
        this.initControls();
        this._bindEntropySlider();
        this._bindLangSelector();
        this._bindSelectors();
        this._bindStartButton();
        this._updateRankingDisplay();
        const ni = document.getElementById('player-name');
        if (ni && this.playerName) ni.value = this.playerName;
    }

    loadRanking() { try { return JSON.parse(localStorage.getItem('qo_ranking') || '[]'); } catch { return []; } }

    saveRanking(gold) {
        this.ranking.push({ name: this.playerName || 'Observer', mode: this.gameMode || 'quantum', gold, date: new Date().toLocaleDateString(), chain: this.player.signatureChain.getStats().length });
        this.ranking.sort((a, b) => b.gold - a.gold);
        this.ranking = this.ranking.slice(0, 10);
        localStorage.setItem('qo_ranking', JSON.stringify(this.ranking));
    }

    _updateRankingDisplay() {
        const rList = document.getElementById('ranking-list');
        if (!rList) return;
        rList.innerHTML = this.ranking.length === 0 ? `<div style="text-align:center;color:#888;margin-top:20px;">${t('rankEmpty')}</div>` :
            `<table style="width:100%; border-collapse: collapse;">
                <tr style="color:#00ffcc; border-bottom:1px solid #333; font-size: 14px; text-transform: uppercase;">
                    <th style="padding-bottom:10px;text-align:left;">Rank</th>
                    <th style="padding-bottom:10px;text-align:left;">Mode</th>
                    <th style="padding-bottom:10px;text-align:left;">Name</th>
                    <th style="padding-bottom:10px;text-align:right;">${t('rankGold')}</th>
                    <th style="padding-bottom:10px;text-align:right;">Chain</th>
                    <th style="padding-bottom:10px;text-align:right;">${t('rankDate')}</th>
                </tr>
                ${this.ranking.map((r, i) => `
                <tr style="border-bottom:1px solid #222; font-size: 13px;">
                    <td style="padding:10px 0; color:#fff;">#${i + 1}</td>
                    <td style="padding:10px 0; color:#a855f7;">${(r.mode || 'quantum').toUpperCase()}</td>
                    <td style="padding:10px 0; color:#fff;">${r.name}</td>
                    <td style="padding:10px 0; text-align:right; color:#ffea00;">${r.gold}</td>
                    <td style="padding:10px 0; text-align:right; color:#00aaff;">${r.chain}</td>
                    <td style="padding:10px 0; text-align:right; color:#888;">${r.date}</td>
                </tr>
                `).join('')}
            </table>`;
    }

    _bindEntropySlider() {
        const s = document.getElementById('entropy-slider'), v = document.getElementById('entropy-value');
        if (s) s.addEventListener('input', e => { const val = parseInt(e.target.value); this.entropy.setLevel(val); if (v) v.textContent = val + '%'; });
    }

    _bindLangSelector() {
        const s = document.getElementById('lang-select');
        if (s) { s.value = getCurrentLang(); s.addEventListener('change', e => { setLanguage(e.target.value); this._updateRankingDisplay(); }); }
    }

    _bindSelectors() {
        const bg = document.getElementById('bg-select');
        if (bg) { bg.value = this.bgMode; bg.addEventListener('change', e => { this.bgMode = e.target.value; localStorage.setItem('qo_bg', this.bgMode); }); }

        const mode = document.getElementById('mode-select');
        if (mode) { mode.value = this.gameMode; mode.addEventListener('change', e => { this.gameMode = e.target.value; localStorage.setItem('qo_mode', this.gameMode); }); }
    }

    _bindStartButton() {
        const btn = document.getElementById('start-btn');
        if (btn) btn.addEventListener('click', e => { e.stopPropagation(); this._startGame(); });

        window.addEventListener('keydown', e => {
            if (this.state === 'start') {
                if (document.activeElement === document.getElementById('player-name')) return;
                if (e.key === 'Enter') this._startGame();
                return;
            }
            if (this.state === 'weaponModal') {
                if (e.key === ' ' || e.code === 'Space' || e.key === 'Enter') { e.preventDefault(); this._equipWeapon(); }
                else if (e.key === 'r' || e.key === 'R') { e.preventDefault(); this._equipWeapon(); this._activateOrbit(); }
                return;
            }
            if (this.state === 'challenge') { this._handleChallengeInput(e.key); return; }
            if (this.state === 'gameover') { this.restart(); return; }
            if (e.key === 'Escape') {
                if (this.state === 'playing') {
                    this.state = 'paused';
                    const pscr = document.getElementById('pause-screen');
                    if (pscr) pscr.style.display = 'flex';
                } else if (this.state === 'paused') {
                    this.state = 'playing';
                    const pscr = document.getElementById('pause-screen');
                    if (pscr) pscr.style.display = 'none';
                }
                return;
            }
            if (this.state === 'playing' && (e.key === 'r' || e.key === 'R')) {
                e.preventDefault();
                this._activateOrbit();
            }
        });

        window.addEventListener('click', e => {
            if (this.state === 'challenge') { this._handleChallengeClick(e); return; }
            if (this.state === 'weaponModal') { this._equipWeapon(); return; }
            if (this.state === 'playing' && this.playerWeapons.length > 0) this._throwWeapon(e);
        });
    }

    _startGame() {
        const ni = document.getElementById('player-name');
        this.playerName = (ni && ni.value.trim()) ? ni.value.trim() : 'Observer';
        localStorage.setItem('qo_name', this.playerName);
        this.state = 'playing';

        this.luckHistory = [];
        this.player.maxQubits = 5;
        this.runSeedHash = crypto.getRandomValues(new Uint32Array(1))[0];
        const q1 = (this.runSeedHash % 100) / 100;
        const q2 = ((this.runSeedHash >> 8) % 100) / 100;
        const q3 = ((this.runSeedHash >> 16) % 100) / 100;
        const q4 = ((this.runSeedHash >> 24) % 100) / 100;

        if (this.gameMode === 'seed') {
            const eLvl = 15 + Math.floor(q1 * 70);
            this.entropy.setLevel(eLvl);
            this.enemySpawner.maxEnemies = Math.max(12, 15 + Math.floor(q2 * 20));
            this.enemySpawner.maxCoins = Math.max(2, 2 + Math.floor(q3 * 6));
            this.enemySpawner.maxTreasures = Math.max(1, 1 + Math.floor(q4 * 2));
            this.maxWeaponsActive = Math.max(1, Math.floor(this.enemySpawner.maxCoins / 2));

            const s = document.getElementById('entropy-slider'), v = document.getElementById('entropy-value');
            if (s) { s.value = eLvl; s.disabled = true; s.style.opacity = 0.5; }
            if (v) v.textContent = eLvl + '%';
        } else if (this.gameMode === 'hardcore') {
            this.enemySpawner.maxEnemies = 40 + Math.floor(q1 * 30);
            this.enemySpawner.maxCoins = 3 + Math.floor(q2 * 2);
            this.enemySpawner.maxTreasures = 1 + Math.floor(q3 * 1);
            this.maxWeaponsActive = Math.max(1, Math.floor(this.enemySpawner.maxCoins / 2));
            this.player.maxQubits = 3;
            const s = document.getElementById('entropy-slider');
            if (s) { s.disabled = false; s.style.opacity = 1; }
        } else if (this.gameMode === 'nightmare') {
            this.enemySpawner.maxEnemies = 80 + Math.floor(q1 * 60);
            this.enemySpawner.maxCoins = 1 + Math.floor(q2 * 2);
            this.enemySpawner.maxTreasures = 1;
            this.maxWeaponsActive = Math.max(1, Math.floor(this.enemySpawner.maxCoins / 2));
            this.player.maxQubits = 1;
            const s = document.getElementById('entropy-slider');
            if (s) { s.disabled = false; s.style.opacity = 1; }
        } else if (this.gameMode === 'abyss') {
            this.enemySpawner.maxEnemies = 150 + Math.floor(q1 * 100);
            this.enemySpawner.maxCoins = Math.floor(q2 * 1.5) + 1; // 1 to guarantee at least 0 weapons via floor(1/2) if we want extreme scarcity, but let's give at least some means
            this.enemySpawner.maxTreasures = 0;
            this.maxWeaponsActive = Math.floor(this.enemySpawner.maxCoins / 2);
            this.player.maxQubits = 1;
            const s = document.getElementById('entropy-slider');
            if (s) { s.disabled = false; s.style.opacity = 1; }
        } else {
            this.enemySpawner.maxEnemies = 20 + Math.floor(q1 * 20);
            this.enemySpawner.maxCoins = 4 + Math.floor(q2 * 4);
            this.enemySpawner.maxTreasures = 2 + Math.floor(q3 * 3);
            this.maxWeaponsActive = Math.max(1, Math.floor(this.enemySpawner.maxCoins / 2));
            const s = document.getElementById('entropy-slider');
            if (s) { s.disabled = false; s.style.opacity = 1; }
        }

        this.player.qubits = this.player.maxQubits;

        this.player.signAction('GAME_START', { name: this.playerName, mode: this.gameMode });
        document.getElementById('start-screen').style.display = 'none';
        document.getElementById('hud-panel').style.display = 'flex';
        document.getElementById('entropy-panel').style.display = 'block';
        document.getElementById('terminal-panel').style.display = 'block';
        const eh = document.getElementById('enemy-hashes-container'); if (eh) eh.style.display = 'block';
        const ql = document.getElementById('quantum-luck-container'); if (ql) ql.style.display = 'block';
    }

    initControls() {
        window.addEventListener("keydown", e => { if (this.state === 'playing') this.player.handleInput(e.key, true); });
        window.addEventListener("keyup", e => { this.player.handleInput(e.key, false); });
        window.addEventListener("mousemove", e => { this.mouseX = e.clientX; this.mouseY = e.clientY; });
    }

    _throwWeapon(e) {
        if (!this.playerWeapons.length) return;
        const w = this.playerWeapons[0];
        const angle = Math.atan2(e.clientY - this.canvas.height / 2, e.clientX - this.canvas.width / 2);
        this.thrownWeapons.push(new ThrownWeapon(this.player.x, this.player.y, angle, w));
        w.ammo--;
        if (w.ammo <= 0) this.playerWeapons.shift();
        this.player.signAction('WEAPON_THROW');
    }

    _activateOrbit() {
        if (!this.playerWeapons.length) return;
        const w = this.playerWeapons.shift();
        this.orbitingWeapons.push(new OrbitingWeapon(w, this.orbitingWeapons.length));
        this.player.signAction('WEAPON_ORBIT');
    }

    _showWeaponModal(weapon) {
        this.weaponModalData = weapon;
        this.state = 'weaponModal';
        if (!this.showOrbitTip && this.playerWeapons.length === 0) { this.showOrbitTip = true; this.orbitTipTimer = 300; }
    }

    _equipWeapon() {
        if (!this.weaponModalData) return;
        this.playerWeapons.push(this.weaponModalData);
        this.weaponModalData = null;
        this.state = 'playing';
    }

    update() {
        this.startPulse += 0.02;
        if (this.orbitTipTimer > 0) this.orbitTipTimer--;
        if (this.state === 'start' || this.state === 'gameover' || this.state === 'weaponModal' || this.state === 'paused') return;
        if (this.state === 'challenge') {
            if (this.challengeResultTimer > 0) { this.challengeResultTimer--; if (this.challengeResultTimer <= 0) { this.state = 'playing'; this.challengeData = null; this.challengeResult = null; this.challengeHintShown = false; } }
            if (this.challengeHintErrorTimer > 0) this.challengeHintErrorTimer--;
            return;
        }
        this.player.update();
        if (this.player.qubits <= 0) {
            this.state = 'gameover';
            this.saveRanking(this.player.gold);
            this.player.signAction('GAME_OVER', { finalGold: this.player.gold });
            document.getElementById('gameover-screen').style.display = 'flex';
            this._updateGameOverStats();
            this._updateRankingDisplay();
            return;
        }

        const obsR = this.player.observationRadius;
        const inView = (obj) => Math.sqrt((obj.x - this.player.x) ** 2 + (obj.y - this.player.y) ** 2) <= obsR + obj.size;

        this.enemySpawner.enemies = this.enemySpawner.enemies.filter(inView);
        this.enemySpawner.coins = this.enemySpawner.coins.filter(inView);
        this.enemySpawner.treasures = this.enemySpawner.treasures.filter(inView);
        this.weaponPickups = this.weaponPickups.filter(inView);

        this.enemySpawner.update(this.player.x, this.player.y, this.entropy.entropyLevel, obsR);

        this.weaponSpawnTimer++;
        if (this.weaponSpawnTimer >= 400 && this.weaponPickups.length < this.maxWeaponsActive) {
            this.weaponSpawnTimer = 0;

            const wHash = parseInt(fastHash(Date.now().toString()).substring(0, 2), 16);
            const weaponsToSpawn = Math.max(1, Math.min(this.maxWeaponsActive - this.weaponPickups.length, (wHash % 3) + 1));

            for (let w = 0; w < weaponsToSpawn; w++) {
                const qH = crypto.getRandomValues(new Uint32Array(1))[0];
                const a = ((qH % 360) * Math.PI) / 180;
                const d = obsR * 0.3 + (((qH >> 8) % 100) / 100) * obsR * 0.5;
                this.weaponPickups.push(new QuantumWeapon(this.player.x + Math.cos(a) * d + (w * 30), this.player.y + Math.sin(a) * d, this.entropy.entropyLevel));
            }
        }

        for (const wp of this.weaponPickups) wp.update();
        for (let i = this.weaponPickups.length - 1; i >= 0; i--) {
            if (this.weaponPickups[i].checkCollision(this.player.x, this.player.y)) {
                const wp = this.weaponPickups.splice(i, 1)[0];
                this._showWeaponModal(wp);
                this._spawnParticles(wp.x, wp.y, '#00aaff', 20);
                return;
            }
        }

        if (this.player.decoherenceTime <= 0) {
            const hits = this.enemySpawner.checkPlayerCollisions(this.player.x, this.player.y);
            if (hits.length > 0) {
                hits[0].takeDamage();
                this._spawnParticles(hits[0].x, hits[0].y, hits[0].glowColor || '#ff003c', 15);
                this._triggerChallenge();
            }
        }

        this.thrownWeapons = this.thrownWeapons.filter(tw => {
            if (!tw.update()) return false;
            for (const e of this.enemySpawner.enemies) {
                if (e.alive && tw.checkEnemyHit(e) && e.takeDamage(tw.damage)) {
                    this._spawnParticles(e.x, e.y, '#00aaff', 12);
                    this.renderer.addFloatingText(e.x, e.y, `-${tw.damage}`, '#ff003c');
                    if (!e.alive) this._enemyDied(e);
                    return false;
                }
            }
            return true;
        });

        this.orbitingWeapons = this.orbitingWeapons.filter(ow => {
            if (!ow.update(this.player.x, this.player.y)) return false;
            for (const e of this.enemySpawner.enemies) {
                if (e.alive && ow.checkEnemyHit(e) && e.takeDamage(ow.damage)) {
                    this._spawnParticles(e.x, e.y, '#a855f7', 8);
                    this.renderer.addFloatingText(e.x, e.y, `-${ow.damage}`, '#ff003c');
                    if (!e.alive) this._enemyDied(e);
                }
            }
            return true;
        });

        const coins = this.enemySpawner.checkCoinCollisions(this.player.x, this.player.y);
        for (const c of coins) { this.player.addGold(c.goldValue); this._spawnParticles(c.x, c.y, '#ffea00', 12); }

        const treasures = this.enemySpawner.checkTreasureCollisions(this.player.x, this.player.y);
        for (const tr of treasures) { this.player.addGold(tr.goldValue); this._spawnParticles(tr.x, tr.y, '#ff9900', 25); }

        this.particles = this.particles.filter(p => { p.x += p.vx; p.y += p.vy; p.life -= 0.02; p.vy += 0.05; return p.life > 0; });
        this.terminalUpdateTimer++;
        if (this.terminalUpdateTimer >= 8) { this.terminalUpdateTimer = 0; this._updateTerminal(); }
        this._updateHUD();
    }

    _enemyDied(e) {
        this.player.addGold(2);
        const dropHash = fastHash(Date.now().toString() + Math.random());
        this.entropy.addLog('KILL', dropHash.substring(0, 16));

        const r = parseInt(dropHash[dropHash.length - 1], 16);
        if (r < 4) {
            import('./enemy.js').then(module => {
                this.enemySpawner.coins.push(new module.CoinItem(e.x, e.y));
                this._spawnParticles(e.x, e.y, '#ffea00', 10);
                this.entropy.addLog('DROP', 'GOLD_COIN');
            });
        } else if (r < 8) {
            this.player.qubits = Math.min(this.player.maxQubits, this.player.qubits + 1);
            this._spawnParticles(e.x, e.y, '#00ffcc', 15);
            this.entropy.addLog('DROP', 'QUBIT_LIFE');
        } else if (r >= 14) {
            this.weaponPickups.push(new QuantumWeapon(e.x, e.y, this.entropy.entropyLevel));
            this._spawnParticles(e.x, e.y, '#00aaff', 20);
            this.entropy.addLog('DROP', 'Q_WEAPON');
        }
        this._updateTerminal();
    }

    _triggerChallenge() {
        const d = Math.min(3, 1 + Math.floor(this.player.gold / 15));
        this.challengeData = generateHumanChallenge(d, this.entropy.entropyLevel);
        this.state = 'challenge';
        this.challengeResult = null;
        this.challengeResultTimer = 0;
        this.challengeHintShown = false;
        this.challengeHintErrorTimer = 0;
        this.challengeBtnRects = [];
        this.hintBtnRect.x = 0; this.hintBtnRect.y = 0; this.hintBtnRect.w = 0; this.hintBtnRect.h = 0;
    }

    _handleChallengeInput(key) {
        if (this.challengeResult !== null) return;
        const n = parseInt(key);
        if (n >= 1 && n <= 3) this._resolveChallenge(n - 1);
    }

    _handleChallengeClick(e) {
        if (!this.challengeData) return;
        if (this.challengeResult === null && this.hintBtnRect && this.hintBtnRect.w > 0 && !this.challengeHintShown) {
            const r = this.hintBtnRect;
            if (e.clientX >= r.x && e.clientX <= r.x + r.w && e.clientY >= r.y && e.clientY <= r.y + r.h) {
                if (this.player.gold >= this.challengeData.hintCost) {
                    this.player.gold -= this.challengeData.hintCost;
                    this.challengeHintShown = true;
                } else {
                    this.challengeHintErrorTimer = 30;
                }
                return;
            }
        }
        if (this.challengeResult !== null) return;
        for (let i = 0; i < this.challengeBtnRects.length; i++) {
            const r = this.challengeBtnRects[i];
            if (e.clientX >= r.x && e.clientX <= r.x + r.w && e.clientY >= r.y && e.clientY <= r.y + r.h) {
                this._resolveChallenge(i);
                return;
            }
        }
    }

    _resolveChallenge(idx) {
        const ok = idx === this.challengeData.correctIndex;
        this.challengeResult = ok;
        this.challengeResultTimer = 90;
        if (ok) { this.player.addGold(this.challengeData.goldReward); this._spawnParticles(this.player.x, this.player.y, '#00ffcc', 30); this.player.signAction('CHALLENGE_WIN'); }
        else { this.player.takeDamage(); this.player.signAction('CHALLENGE_FAIL'); }
    }

    _spawnParticles(x, y, color, count) {
        for (let i = 0; i < count; i++) this.particles.push({ x, y, vx: (Math.random() - 0.5) * 6, vy: (Math.random() - 0.5) * 6, color, life: 1, size: 2 + Math.random() * 4 });
    }

    _updateTerminal() {
        const keys = this.entropy.getRecentKeys();
        const el = document.getElementById('terminal-content');
        if (!el || !keys.length) return;
        el.innerHTML = keys.slice(-this.maxTerminalLines).map(k =>
            `<div class="term-line"><span class="term-time">${new Date(k.time).toLocaleTimeString()}</span><span class="term-key">0x${k.key}</span></div>`
        ).join('');
        el.scrollTop = el.scrollHeight;
    }

    _updateHUD() {
        const q = document.getElementById('hud-qubits');
        if (q) { let s = ''; for (let i = 0; i < this.player.maxQubits; i++) s += i < this.player.qubits ? '◆' : '◇'; q.textContent = s; }
        const g = document.getElementById('hud-gold'); if (g) g.textContent = this.player.gold;
        const e = document.getElementById('hud-entropy'); if (e) e.textContent = this.entropy.entropyLevel + '%';
        const c = document.getElementById('hud-chain'); if (c) c.textContent = this.player.signatureChain.getStats().length;
        const h = document.getElementById('hud-hash'); if (h) h.textContent = this.player.signatureChain.getStats().lastHash;
        const hi = document.getElementById('hud-highscore'); if (hi) hi.textContent = this.ranking.length > 0 ? this.ranking[0].gold : 0;
        const w = document.getElementById('hud-weapon-list');
        if (w) {
            const allWeapons = [...this.playerWeapons, ...this.orbitingWeapons];
            if (allWeapons.length === 0) {
                w.innerHTML = `<span style="color:#555">—</span>`;
            } else {
                w.innerHTML = allWeapons.map(wp => `
                    <div class="weapon-icon-wrapper" style="${this.orbitingWeapons.includes(wp) ? 'opacity:0.6' : ''}">
                        <img src="./assets/${wp.weaponType}.png" class="weapon-mini" />
                        <span class="weapon-ammo">${wp.ammo}</span>
                    </div>
                `).join('');
            }
        }

        const eHList = document.getElementById('enemy-hashes-list');
        if (eHList) {
            eHList.innerHTML = this.enemySpawner.enemies.slice(-6).map(e => `
                <div class="enemy-hash-entry">
                    <img src="./assets/quantun_${e.type}.png" class="enemy-hash-icon" />
                    <span>0x${e.quantumHash ? e.quantumHash.toString(16).padStart(8, '0') : Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, '0')}</span>
                </div>
            `).join('');
        }

        const luckVal = document.getElementById('quantum-luck-value');
        if (luckVal) {
            const hashLuck = (this.entropy.rawEntropy || 50) / 100;
            const goldFactor = Math.min(100, this.player.gold) / 100;
            const enemiesPenalty = this.enemySpawner.enemies.length * 0.04;
            let dropLuck = (this.enemySpawner.coins.length * 0.05) + (this.enemySpawner.treasures.length * 0.15) + (this.weaponPickups.length * 0.2);

            const qFluctuation = Math.sin((this.entropy.totalBitsCollected || 0) * 0.1 + Date.now() * 0.002) * (this.entropy.entropyLevel / 100) * 15;
            let finalLuck = ((hashLuck * 0.4 + goldFactor * 0.3 + dropLuck * 0.3 - enemiesPenalty) * 100) + qFluctuation;
            finalLuck = Math.max(0, Math.min(100, finalLuck));

            luckVal.textContent = finalLuck.toFixed(1) + '%';
            luckVal.style.color = finalLuck > 65 ? '#00ffcc' : (finalLuck > 35 ? '#ffea00' : '#ff003c');

            const luckDrops = document.getElementById('luck-drops');
            if (luckDrops) luckDrops.textContent = this.enemySpawner.coins.length + this.enemySpawner.treasures.length + this.weaponPickups.length;
            const luckAlive = document.getElementById('luck-alive');
            if (luckAlive) luckAlive.textContent = this.enemySpawner.enemies.length;

            if (!this.luckHistory) this.luckHistory = [];
            this.luckHistory.push(finalLuck);
            if (this.luckHistory.length > 60) this.luckHistory.shift();

            const cv = document.getElementById('luck-graph');
            if (cv) {
                const cx = cv.getContext('2d');
                const w = cv.width, h = cv.height;
                cx.clearRect(0, 0, w, h);
                cx.beginPath();
                const step = w / Math.max(1, this.luckHistory.length - 1);
                this.luckHistory.forEach((v, i) => {
                    const x = i * step;
                    const y = Math.max(2, Math.min(h - 2, h - (v / 100 * (h - 4))));
                    if (i === 0) cx.moveTo(x, y);
                    else cx.lineTo(x, y);
                });
                cx.strokeStyle = finalLuck > 50 ? '#00ffcc' : '#ff003c';
                cx.lineWidth = 1.5;
                cx.stroke();
            }
        }
    }

    _updateGameOverStats() {
        const cs = this.player.signatureChain.getStats();
        const enc = encryptScore(this.player.gold, cs.lastHash);
        const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        set('final-gold', this.player.gold);
        set('chain-length', cs.length + ' ' + t('blocks'));
        const cv = document.getElementById('chain-valid');
        if (cv) { cv.textContent = cs.valid ? '✓ ' + t('valid') : '✗ ' + t('broken'); cv.style.color = cs.valid ? '#00ffcc' : '#ff003c'; }
        set('encrypted-score', '0x' + enc);
        set('best-score', this.ranking.length > 0 ? this.ranking[0].gold : 0);
        set('gameover-player', this.playerName);
    }

    restart() {
        this.player = new Player();
        this.world = new World();
        this.enemySpawner = new EnemySpawner();
        this.renderer = new Renderer(this.ctx, this.world, this.player, this.enemySpawner);
        this.particles = []; this.thrownWeapons = []; this.weaponPickups = [];
        this.orbitingWeapons = []; this.playerWeapons = []; this.weaponModalData = null;
        this.state = 'playing'; this.challengeData = null; this.challengeResult = null;
        document.getElementById('gameover-screen').style.display = 'none';
        document.getElementById('hud-panel').style.display = 'flex';
    }

    render() {
        this.renderer.draw(this.state, this.challengeData, this.challengeResult, this.particles,
            this.startPulse, this.mouseX, this.mouseY, this.playerWeapons,
            this.weaponPickups, this.thrownWeapons, this.orbitingWeapons,
            this.weaponModalData, this.challengeBtnRects, this.hintBtnRect,
            this.challengeHintShown, this.bgMode, this.orbitTipTimer, this.challengeHintErrorTimer);
    }
}