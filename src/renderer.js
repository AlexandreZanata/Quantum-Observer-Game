import { t } from "./i18n.js";

export class Renderer {
    constructor(ctx, world, player, es) {
        this.ctx = ctx; this.world = world; this.player = player; this.es = es;
        this.latticeNodes = Array.from({ length: 80 }, () => ({
            x: Math.random() * window.innerWidth, y: Math.random() * window.innerHeight,
            vx: (Math.random() - 0.5) * 1.2, vy: (Math.random() - 0.5) * 1.2,
            size: 1 + Math.random() * 2, pulse: Math.random() * Math.PI * 2
        }));
        this.qrgbPhase = 0;
        this.qrgbColors = [];
        for (let i = 0; i < 200; i++) this.qrgbColors.push({ x: Math.random(), y: Math.random(), r: Math.random(), g: Math.random(), b: Math.random(), phase: Math.random() * Math.PI * 2, speed: 0.005 + Math.random() * 0.02 });
        this.floatingTexts = [];
    }

    addFloatingText(x, y, text, color) {
        this.floatingTexts.push({ x, y, text, color, life: 1.0, vy: -1.5 });
    }

    drawLatticeBg() {
        const { ctx } = this; const w = window.innerWidth, h = window.innerHeight;
        const bg = ctx.createLinearGradient(0, 0, 0, h);
        bg.addColorStop(0, "#010108"); bg.addColorStop(0.5, "#030310"); bg.addColorStop(1, "#010108");
        ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
        for (const n of this.latticeNodes) {
            n.x += n.vx; n.y += n.vy; n.pulse += 0.02;
            if (n.x < 0 || n.x > w) n.vx *= -1; if (n.y < 0 || n.y > h) n.vy *= -1;
            ctx.fillStyle = `rgba(0,255,204,${0.25 + Math.sin(n.pulse) * 0.15})`;
            ctx.beginPath(); ctx.arc(n.x, n.y, n.size, 0, Math.PI * 2); ctx.fill();
            for (const o of this.latticeNodes) {
                if (n === o) continue;
                const d2 = (n.x - o.x) ** 2 + (n.y - o.y) ** 2;
                if (d2 < 18000) { ctx.strokeStyle = `rgba(0,255,204,${(1 - d2 / 18000) * 0.12})`; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(n.x, n.y); ctx.lineTo(o.x, o.y); ctx.stroke(); }
            }
        }
    }

    drawQuantumRgbBg() {
        const { ctx, player: p } = this;
        const w = window.innerWidth, h = window.innerHeight;
        const bw = 50, bh = 50;
        ctx.fillStyle = '#010103';
        ctx.fillRect(0, 0, w, h);

        const startX = Math.floor(p.x / bw) * bw - w / 2 - bw;
        const startY = Math.floor(p.y / bh) * bh - h / 2 - bh;
        const endX = startX + w + bw * 2;
        const endY = startY + h + bh * 2;

        for (let y = startY; y < endY; y += bh) {
            for (let x = startX; x < endX; x += bw) {
                const rx = x / bw, ry = y / bh;
                const noiseR = Math.sin(rx * 12.9898 + ry * 78.233) * 43758.5453;
                const noiseG = Math.sin(rx * 3.1415 + ry * 1.618) * 12345.6789;
                const noiseB = Math.sin(rx * 2.7182 + ry * 0.5772) * 98765.4321;

                const r = Math.floor(Math.abs(noiseR % 1) * 255);
                const g = Math.floor(Math.abs(noiseG % 1) * 255);
                const b = Math.floor(Math.abs(noiseB % 1) * 255);

                const alpha = 0.08 + Math.abs((noiseR * 13) % 1) * 0.18;
                ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;

                ctx.fillRect(x - p.x + w / 2, y - p.y + h / 2, bw + 1, bh + 1);
            }
        }
    }

    drawTiles(tiles) {
        const { ctx, world: { tileSize: ts }, player: p } = this;
        const hw = window.innerWidth / 2, hh = window.innerHeight / 2;
        for (const { x, y, type } of tiles) {
            if (type === "void") continue;
            const sx = x * ts - p.x + hw, sy = y * ts - p.y + hh;
            if (type === "energy") { ctx.fillStyle = 'rgba(0,255,204,0.12)'; ctx.fillRect(sx, sy, ts, ts); }
            else { ctx.fillStyle = '#0a1628'; ctx.fillRect(sx, sy, ts, ts); }
        }
    }

    drawEnemies() {
        const { ctx, player: p, es } = this; const hw = window.innerWidth / 2, hh = window.innerHeight / 2;
        for (const e of es.enemies) {
            const spr = es.sprites[e.type];
            if (!spr || !es.spritesLoaded[e.type]) continue;
            const sx = e.x - p.x + hw, sy = e.y - p.y + hh;
            ctx.save();
            ctx.translate(sx, sy);
            if (!e.alive) { ctx.globalAlpha = e.opacity; ctx.shadowColor = '#ff003c'; ctx.shadowBlur = 30 * e.opacity; }
            else {
                ctx.shadowColor = '#ff0000';
                ctx.shadowBlur = 20 + Math.sin(e.glowPhase) * 10;
            }
            ctx.drawImage(spr, -e.size / 2, -e.size / 2, e.size, e.size);
            ctx.restore();
        }
    }

    drawCoins() {
        const { ctx, player: p, es } = this; const hw = window.innerWidth / 2, hh = window.innerHeight / 2;
        if (!es.spritesLoaded.coin) return;
        for (const c of es.getActiveCoins()) {
            const sx = c.x - p.x + hw, sy = c.y - p.y + hh + c.getFloatOffset();
            ctx.save(); ctx.shadowColor = '#ffea00'; ctx.shadowBlur = 8 + Math.sin(c.glowPhase) * 4;
            ctx.drawImage(es.coinSprite, sx - c.size / 2, sy - c.size / 2, c.size, c.size);
            ctx.restore();
        }
    }

    drawTreasures() {
        const { ctx, player: p, es } = this; const hw = window.innerWidth / 2, hh = window.innerHeight / 2;
        if (!es.spritesLoaded.treasure) return;
        for (const tr of es.getActiveTreasures()) {
            const sx = tr.x - p.x + hw, sy = tr.y - p.y + hh + tr.getFloatOffset();
            ctx.save(); ctx.shadowColor = '#ff9900'; ctx.shadowBlur = 12 + Math.sin(tr.glowPhase) * 6;
            ctx.drawImage(es.treasureSprite, sx - tr.size / 2, sy - tr.size / 2, tr.size, tr.size);
            ctx.restore();
        }
    }

    drawWpPickups(pickups) {
        const { ctx, player: p, es } = this; const hw = window.innerWidth / 2, hh = window.innerHeight / 2;
        for (const wp of pickups) {
            const spr = es.weaponSprites[wp.weaponType];
            if (!spr || !es.spritesLoaded[wp.weaponType]) continue;
            const sx = wp.x - p.x + hw, sy = wp.y - p.y + hh + wp.getFloatOffset();
            ctx.save(); ctx.shadowColor = '#00aaff'; ctx.shadowBlur = 12 + Math.sin(wp.glowPhase) * 6;
            ctx.drawImage(spr, sx - wp.size / 2, sy - wp.size / 2, wp.size, wp.size);
            ctx.restore();
        }
    }

    drawThrown(thrown) {
        const { ctx, player: p, es } = this; const hw = window.innerWidth / 2, hh = window.innerHeight / 2;
        for (const tw of thrown) {
            const spr = es.weaponSprites[tw.weaponType]; if (!spr) continue;
            const sx = tw.x - p.x + hw, sy = tw.y - p.y + hh;
            ctx.save(); ctx.translate(sx, sy); ctx.rotate(tw.rotation);
            ctx.shadowColor = '#00aaff'; ctx.shadowBlur = 10;
            ctx.drawImage(spr, -tw.size / 2, -tw.size / 2, tw.size, tw.size);
            ctx.restore();
        }
    }

    drawOrbiting(orbs) {
        const { ctx, player: p, es } = this; const hw = window.innerWidth / 2, hh = window.innerHeight / 2;
        for (const o of orbs) {
            if (!o.active) continue;
            const spr = es.weaponSprites[o.weaponType]; if (!spr) continue;
            const sx = o.x - p.x + hw, sy = o.y - p.y + hh;
            const fade = Math.max(0.3, 1 - o.timer / o.duration);
            ctx.save(); ctx.globalAlpha = fade; ctx.translate(sx, sy); ctx.rotate(o.rotation);
            ctx.shadowColor = '#a855f7'; ctx.shadowBlur = 12;
            ctx.drawImage(spr, -o.size / 2, -o.size / 2, o.size, o.size);
            ctx.restore();
        }
    }

    drawAim(mx, my, hasWeapon) {
        if (!hasWeapon) return;
        const { ctx } = this; const cx = window.innerWidth / 2, cy = window.innerHeight / 2;
        const a = Math.atan2(my - cy, mx - cx);
        ctx.save();
        ctx.strokeStyle = 'rgba(0,170,255,0.5)'; ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
        ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * 40, cy + Math.sin(a) * 40);
        ctx.lineTo(cx + Math.cos(a) * 65, cy + Math.sin(a) * 65); ctx.stroke();
        ctx.setLineDash([]); ctx.fillStyle = 'rgba(0,170,255,0.7)';
        const tx = cx + Math.cos(a) * 65, ty = cy + Math.sin(a) * 65;
        ctx.beginPath(); ctx.moveTo(tx, ty);
        ctx.lineTo(tx - Math.cos(a - 0.4) * 12, ty - Math.sin(a - 0.4) * 12);
        ctx.lineTo(tx - Math.cos(a + 0.4) * 12, ty - Math.sin(a + 0.4) * 12);
        ctx.closePath(); ctx.fill(); ctx.restore();
    }

    drawPlayer() {
        const { ctx, player: p } = this; const cx = window.innerWidth / 2, cy = window.innerHeight / 2;
        for (const pt of p.trail) {
            ctx.fillStyle = `rgba(0,255,204,${pt.alpha * 0.3})`;
            ctx.beginPath(); ctx.arc(pt.x - p.x + cx, pt.y - p.y + cy, 4 * pt.alpha, 0, Math.PI * 2); ctx.fill();
        }
        if (p.decoherenceTime > 0 && Math.floor(Date.now() / 150) % 2 === 0) return;
        if (p.spriteLoaded) { ctx.save(); ctx.shadowColor = '#00ffcc'; ctx.shadowBlur = 15; ctx.drawImage(p.sprite, cx - 60, cy - 60, 120, 120); ctx.restore(); }
        else { ctx.fillStyle = "#00ffcc"; ctx.beginPath(); ctx.arc(cx, cy, 12, 0, Math.PI * 2); ctx.fill(); }
    }

    drawLighting() {
        const { ctx, player: p } = this; const cx = window.innerWidth / 2, cy = window.innerHeight / 2, r = p.observationRadius;
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(0.4, "rgba(0,0,0,0.25)");
        g.addColorStop(0.7, "rgba(0,0,0,0.65)"); g.addColorStop(1, "rgba(0,0,0,0.95)");
        ctx.fillStyle = g; ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
    }

    drawParticles(parts) {
        const { ctx, player: p } = this; const hw = window.innerWidth / 2, hh = window.innerHeight / 2;
        for (const pt of parts) {
            ctx.fillStyle = pt.color; ctx.globalAlpha = pt.life;
            ctx.beginPath(); ctx.arc(pt.x - p.x + hw, pt.y - p.y + hh, pt.size, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    drawFloatingTexts() {
        const { ctx, player: p } = this;
        const hw = window.innerWidth / 2, hh = window.innerHeight / 2;
        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            const ft = this.floatingTexts[i];
            ft.y += ft.vy;
            ft.life -= 0.025;
            ctx.save();
            ctx.globalAlpha = Math.max(0, ft.life);
            ctx.fillStyle = ft.color;
            ctx.font = "bold 22px 'JetBrains Mono',monospace";
            ctx.textAlign = 'center';
            ctx.shadowColor = ft.color;
            ctx.shadowBlur = 10;
            ctx.fillText(ft.text, ft.x - p.x + hw, ft.y - p.y + hh);
            ctx.restore();
            if (ft.life <= 0) this.floatingTexts.splice(i, 1);
        }
    }

    drawWeaponModal(w) {
        if (!w) return;
        const { ctx } = this; const W = window.innerWidth, H = window.innerHeight;
        ctx.fillStyle = 'rgba(0,0,0,0.88)'; ctx.fillRect(0, 0, W, H);
        const cx = W / 2, cy = H / 2, pw = Math.min(460, W - 30), ph = 380;
        const px = cx - pw / 2, py = cy - ph / 2;
        ctx.fillStyle = 'rgba(5,5,20,0.96)'; ctx.strokeStyle = '#00aaff'; ctx.lineWidth = 2;
        this._rr(px, py, pw, ph, 16); ctx.fill(); ctx.stroke();
        const spr = this.es.weaponSprites[w.weaponType];
        if (spr && this.es.spritesLoaded[w.weaponType]) {
            ctx.save(); ctx.shadowColor = '#00aaff'; ctx.shadowBlur = 20;
            ctx.drawImage(spr, cx - 30, py + 15, 60, 60); ctx.restore();
        }
        ctx.fillStyle = '#00aaff'; ctx.font = "bold 16px 'JetBrains Mono',monospace"; ctx.textAlign = 'center';
        ctx.fillText(t('weaponFound') + ' — ' + w.weaponType.toUpperCase(), cx, py + 95);
        ctx.fillStyle = '#444'; ctx.font = "9px 'JetBrains Mono',monospace";
        ctx.fillText(w.hash, cx, py + 112);
        const stats = [
            { name: t('weaponDamage'), val: w.damage, max: 6, color: '#ff003c' },
            { name: t('weaponSpin'), val: w.spin, max: 4, color: '#a855f7' },
            { name: t('weaponSpeed'), val: w.throwSpeed, max: 14, color: '#00ffcc' },
            { name: t('weaponAmmo'), val: w.ammo, max: 10, color: '#ffea00' }
        ];
        const barStart = py + 125;
        for (let i = 0; i < stats.length; i++) {
            const sy = barStart + i * 30;
            ctx.fillStyle = '#666'; ctx.font = "bold 10px 'JetBrains Mono',monospace"; ctx.textAlign = 'left';
            ctx.fillText(stats[i].name, px + 20, sy + 4);
            ctx.fillStyle = 'rgba(255,255,255,0.04)'; ctx.fillRect(px + 110, sy - 6, pw - 160, 12);
            ctx.fillStyle = stats[i].color; ctx.fillRect(px + 110, sy - 6, (pw - 160) * Math.min(1, stats[i].val / stats[i].max), 12);
            ctx.fillStyle = '#fff'; ctx.font = "bold 10px 'JetBrains Mono',monospace"; ctx.textAlign = 'right';
            ctx.fillText(typeof stats[i].val === 'number' && stats[i].val % 1 !== 0 ? stats[i].val.toFixed(1) : stats[i].val, px + pw - 15, sy + 4);
        }
        const gy = barStart + 130;
        ctx.fillStyle = '#555'; ctx.font = "9px 'JetBrains Mono',monospace"; ctx.textAlign = 'center';
        ctx.fillText(t('weaponEntropy') + ' ' + w.weaponEntropy + '%', cx, gy);
        ctx.strokeStyle = 'rgba(0,170,255,0.25)'; ctx.lineWidth = 1; ctx.strokeRect(px + 20, gy + 5, pw - 40, 50);
        ctx.strokeStyle = '#00aaff'; ctx.lineWidth = 1.5; ctx.beginPath();
        const ew = pw - 40;
        for (let i = 0; i < w.entropyHistory.length; i++) {
            const ex = px + 20 + (i / (w.entropyHistory.length - 1)) * ew;
            const ey = gy + 55 - (w.entropyHistory[i] / 100) * 50;
            i === 0 ? ctx.moveTo(ex, ey) : ctx.lineTo(ex, ey);
        }
        ctx.stroke();
        ctx.fillStyle = 'rgba(0,255,204,0.7)'; ctx.font = "13px 'JetBrains Mono',monospace"; ctx.textAlign = 'center';
        ctx.fillText(t('weaponEquip'), cx, py + ph - 15);
    }

    drawChallenge(cd, cr, btnRects, hintBtnRef, hintShown, hintErrorTimer) {
        if (!cd) return;
        const { ctx } = this; const W = window.innerWidth, H = window.innerHeight;
        ctx.fillStyle = 'rgba(0,0,0,0.88)'; ctx.fillRect(0, 0, W, H);
        const cx = W / 2, cy = H / 2;
        const pw = Math.min(640, W - 30), ph = hintShown ? 420 : 380;
        const px = cx - pw / 2, py = cy - ph / 2;
        ctx.fillStyle = 'rgba(8,8,18,0.96)'; ctx.strokeStyle = '#00ffcc'; ctx.lineWidth = 2;
        this._rr(px, py, pw, ph, 16); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#ff003c'; ctx.font = "bold 20px 'JetBrains Mono',monospace"; ctx.textAlign = 'center';
        ctx.fillText(t('challengeTitle'), cx, py + 36);
        ctx.fillStyle = '#b0b0c0'; ctx.font = "15px 'JetBrains Mono',monospace";
        ctx.fillText(t(cd.qKey), cx, py + 66);
        ctx.fillStyle = '#00ffcc'; ctx.font = "bold 22px 'JetBrains Mono',monospace";
        const displayText = cd.display;
        if (ctx.measureText(displayText).width > pw - 40) ctx.font = "bold 16px 'JetBrains Mono',monospace";
        ctx.fillText(displayText, cx, py + 105);

        if (hintShown && cd.hint) {
            ctx.fillStyle = 'rgba(0,255,204,0.08)'; this._rr(px + 15, py + 115, pw - 30, 30, 6); ctx.fill();
            ctx.fillStyle = '#00ffcc'; ctx.font = "12px 'JetBrains Mono',monospace"; ctx.textAlign = 'center';
            ctx.fillText('💡 ' + t(cd.hint), cx, py + 135);
        }

        const btnY = py + (hintShown ? 175 : 155);
        const optW = Math.min(170, (pw - 40) / 3 - 10);
        const gap = optW + 15;
        const startX = cx - ((cd.options.length - 1) * gap) / 2;
        btnRects.length = 0;
        for (let i = 0; i < cd.options.length; i++) {
            const bx = startX + i * gap, bh = 55;
            const rx = bx - optW / 2, ry = btnY;
            btnRects.push({ x: rx, y: ry, w: optW, h: bh });
            let bc = 'rgba(0,255,204,0.08)', brc = '#00ffcc', tc = '#00ffcc';
            if (cr !== null) {
                if (i === cd.correctIndex) { bc = 'rgba(0,255,100,0.25)'; brc = '#00ff66'; tc = '#00ff66'; }
                else { bc = 'rgba(255,0,60,0.12)'; brc = 'rgba(255,0,60,0.25)'; tc = 'rgba(255,0,60,0.5)'; }
            }
            ctx.fillStyle = bc; ctx.strokeStyle = brc; ctx.lineWidth = 1.5;
            this._rr(rx, ry, optW, bh, 8); ctx.fill(); ctx.stroke();
            ctx.fillStyle = tc; ctx.font = "bold 14px 'JetBrains Mono',monospace"; ctx.textAlign = 'center';
            let optText = cd.options[i];
            if (ctx.measureText(optText).width > optW - 10) ctx.font = "bold 11px 'JetBrains Mono',monospace";
            ctx.fillText(optText, bx, ry + bh / 2 + 2);
            ctx.fillStyle = '#444'; ctx.font = "9px 'JetBrains Mono',monospace";
            ctx.fillText(t('pressKey', i + 1), bx, ry + bh - 6);
        }

        if (cr === null && !hintShown && cd.hintCost) {
            const hbw = 160, hbh = 32, hbx = cx - hbw / 2, hby = btnY + 70;
            if (hintBtnRef) { hintBtnRef.x = hbx; hintBtnRef.y = hby; hintBtnRef.w = hbw; hintBtnRef.h = hbh; }
            ctx.fillStyle = 'rgba(255,234,0,0.08)'; ctx.strokeStyle = 'rgba(255,234,0,0.3)'; ctx.lineWidth = 1;
            this._rr(hbx, hby, hbw, hbh, 6); ctx.fill(); ctx.stroke();
            const tc = (hintErrorTimer > 0 && Math.floor(hintErrorTimer / 5) % 2 === 0) ? '#ff003c' : '#ffea00';
            ctx.fillStyle = tc; ctx.font = "bold 11px 'JetBrains Mono',monospace"; ctx.textAlign = 'center';
            if (hintErrorTimer > 0 && Math.floor(hintErrorTimer / 5) % 2 === 0) {
                ctx.fillText('! NOT ENOUGH GOLD !', cx, hby + hbh / 2 + 3);
            } else {
                ctx.fillText(t('hintBtn', cd.hintCost), cx, hby + hbh / 2 + 3);
            }
        }

        if (cr !== null) {
            const ry = btnY + 75;
            ctx.font = "bold 18px 'JetBrains Mono',monospace"; ctx.textAlign = 'center';
            ctx.fillStyle = cr ? '#00ff66' : '#ff003c';
            ctx.fillText(cr ? t('challengeCorrect', cd.goldReward) : t('challengeFail'), cx, ry);
        }
    }

    drawOrbitTip(timer) {
        if (timer <= 0) return;
        const { ctx } = this; const W = window.innerWidth;
        const alpha = Math.min(1, timer / 60);
        ctx.save(); ctx.globalAlpha = alpha;
        ctx.fillStyle = 'rgba(0,170,255,0.15)';
        this._rr(W / 2 - 200, window.innerHeight - 80, 400, 36, 8); ctx.fill();
        ctx.fillStyle = '#00aaff'; ctx.font = "bold 12px 'JetBrains Mono',monospace"; ctx.textAlign = 'center';
        ctx.fillText(t('orbitTip'), W / 2, window.innerHeight - 56);
        ctx.restore();
    }

    _rr(x, y, w, h, r) {
        const { ctx } = this; ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
    }

    draw(state, cd, cr, particles, pulse, mx, my, pWeapons, wpPickups, thrown, orbs, wModal, btnRects, hintBtnRef, hintShown, bgMode, orbitTip, hintErrorTimer) {
        const { ctx } = this;
        ctx.imageSmoothingEnabled = false;
        if (bgMode === 'quantum') this.drawQuantumRgbBg(); else this.drawLatticeBg();
        if (state === 'start') {
            const a = 0.5 + Math.sin(pulse) * 0.3;
            ctx.fillStyle = `rgba(0,255,204,${a})`; ctx.font = "16px 'JetBrains Mono',monospace"; ctx.textAlign = 'center';
            return;
        }
        const u = this.world.getObservableUniverse(this.player);
        this.drawTiles(u); this.drawCoins(); this.drawTreasures(); this.drawWpPickups(wpPickups);
        this.drawEnemies(); this.drawThrown(thrown); this.drawOrbiting(orbs);
        this.drawParticles(particles); this.drawLighting(); this.drawPlayer();
        this.drawFloatingTexts();
        this.drawAim(mx, my, pWeapons.length > 0);
        this.drawOrbitTip(orbitTip);
        if (state === 'challenge') this.drawChallenge(cd, cr, btnRects, hintBtnRef, hintShown, hintErrorTimer);
        if (state === 'weaponModal') this.drawWeaponModal(wModal);
    }
}