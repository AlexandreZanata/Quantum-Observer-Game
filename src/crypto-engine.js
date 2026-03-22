function fastHash(data) {
    let h = 0x811c9dc5;
    const s = typeof data === 'string' ? data : JSON.stringify(data);
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); h = h >>> 0; }
    let h2 = 0xcbf29ce4;
    for (let i = s.length - 1; i >= 0; i--) { h2 ^= s.charCodeAt(i); h2 = Math.imul(h2, 0x01000193); h2 = h2 >>> 0; }
    return h.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
}

function buildHashChain(seed, length = 8) {
    const c = [fastHash(seed)];
    for (let i = 1; i < length; i++) c.push(fastHash(c[i - 1] + i));
    return c;
}

function signAction(action, pos, chain) {
    return { signature: fastHash(JSON.stringify(action) + chain[pos]), position: pos, publicKey: chain[chain.length - 1] };
}

const SYM = ['◈', '◇', '◆', '⟡', '⟐', '⬡', '⬢', '△', '▽', '⊕', '⊗', '⊙', '⟁', '⟴', '⧫', '⬟'];
const QS = ['|0⟩', '|1⟩', '|+⟩', '|−⟩', '|i⟩', '|−i⟩'];
const GATES = ['H', 'X', 'Y', 'Z', 'T', 'S'];

function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]]; } }

function makeOpts(answer, pool, count = 3) {
    const o = [answer];
    let tries = 0;
    while (o.length < count && tries < 50) { const f = pool[Math.floor(Math.random() * pool.length)]; if (!o.includes(f)) o.push(f); tries++; }
    while (o.length < count) o.push(SYM[o.length]);
    shuffle(o);
    return { options: o, correctIndex: o.indexOf(answer) };
}

function generateHumanChallenge(diff = 1, entropy = 50) {
    const e = entropy / 100;
    const type = Math.floor(Math.random() * 10);
    const gr = 2 + diff + Math.floor(e * 2);
    const hintCost = 1 + Math.floor(Math.random() * 3 + e * 3);

    if (type === 0) {
        const len = 3 + diff;
        const syms = [];
        for (let i = 0; i < len; i++) syms.push(SYM[Math.floor(Math.random() * SYM.length)]);
        const ans = syms[syms.length - 1];
        const display = syms.slice(0, -1).join(' ') + ' ?';
        const { options, correctIndex } = makeOpts(ans, SYM);
        return { qKey: 'cQ1', display, options, correctIndex, difficulty: diff, goldReward: gr, hintCost, hint: 'hintPattern' };
    }

    if (type === 1) {
        const t = SYM[Math.floor(Math.random() * SYM.length)];
        const { options, correctIndex } = makeOpts(t, SYM);
        return { qKey: 'cQ2', display: t + ' ↔ ?', options, correctIndex, difficulty: diff, goldReward: gr, hintCost, hint: 'hintPair' };
    }

    if (type === 2) {
        const col = Math.random() > 0.5 ? '|0⟩' : '|1⟩';
        const st = QS[Math.floor(Math.random() * QS.length)];
        const { options, correctIndex } = makeOpts(col, QS);
        return { qKey: 'cQ3', display: st + ' → measure → ?', options, correctIndex, difficulty: diff, goldReward: gr + 1, hintCost, hint: 'hintCollapse' };
    }

    if (type === 3) {
        const seed = Math.floor(Math.random() * (500 + e * 5000)).toString();
        const h = fastHash(seed);
        const len = Math.min(8, 4 + diff);
        const ans = h.substring(0, len);
        const pool = [];
        for (let i = 0; i < 10; i++) pool.push(fastHash(Math.random().toString()).substring(0, len));
        const { options, correctIndex } = makeOpts(ans, pool);
        return { qKey: 'cQ4', display: 'sig(' + seed + ')', options, correctIndex, difficulty: diff, goldReward: gr + 1, hintCost, hint: 'hintHash' };
    }

    if (type === 4) {
        const k = [];
        for (let j = 0; j < 2 + diff; j++) k.push(Math.floor(Math.random() * 10));
        const sum = k.reduce((a, b) => a + b, 0);
        const ans = '[' + k.join(',') + ']';
        const pool = [];
        for (let i = 0; i < 8; i++) {
            const fk = [];
            for (let j = 0; j < 2 + diff; j++) fk.push(Math.floor(Math.random() * 10));
            pool.push('[' + fk.join(',') + ']');
        }
        const { options, correctIndex } = makeOpts(ans, pool);
        return { qKey: 'cQ5', display: 'lock(' + sum + ')', options, correctIndex, difficulty: diff, goldReward: gr, hintCost, hint: 'hintLock' };
    }

    if (type === 5) {
        const g = GATES[Math.floor(Math.random() * GATES.length)];
        const inp = Math.random() > 0.5 ? '|0⟩' : '|1⟩';
        let out;
        if (g === 'X') out = inp === '|0⟩' ? '|1⟩' : '|0⟩';
        else if (g === 'H') out = '|+⟩';
        else if (g === 'Z') out = inp === '|1⟩' ? '-|1⟩' : '|0⟩';
        else out = inp;
        const pool = [...QS, '-|1⟩'];
        const { options, correctIndex } = makeOpts(out, pool);
        return { qKey: 'cQ6', display: g + '(' + inp + ')', options, correctIndex, difficulty: diff, goldReward: gr + 1, hintCost, hint: 'hintGate' };
    }

    if (type === 6) {
        const a = Math.floor(Math.random() * 16);
        const b = Math.floor(Math.random() * 16);
        const xor = a ^ b;
        const ans = xor.toString(16).toUpperCase();
        const pool = [];
        for (let i = 0; i < 16; i++) pool.push(i.toString(16).toUpperCase());
        const { options, correctIndex } = makeOpts(ans, pool);
        return { qKey: 'cQ7', display: '0x' + a.toString(16).toUpperCase() + ' ⊕ 0x' + b.toString(16).toUpperCase(), options, correctIndex, difficulty: diff, goldReward: gr, hintCost, hint: 'hintXor' };
    }

    if (type === 7) {
        const bits = [];
        for (let i = 0; i < 4; i++) bits.push(Math.random() > 0.5 ? '1' : '0');
        const val = parseInt(bits.join(''), 2);
        const ans = val.toString();
        const pool = [];
        for (let i = 0; i < 16; i++) pool.push(i.toString());
        const { options, correctIndex } = makeOpts(ans, pool);
        return { qKey: 'cQ8', display: bits.join('') + '₂ = ?₁₀', options, correctIndex, difficulty: diff, goldReward: gr, hintCost, hint: 'hintBinary' };
    }

    if (type === 8) {
        const n = 2 + Math.floor(Math.random() * 4);
        const syms = [];
        for (let i = 0; i < n; i++) syms.push(SYM[Math.floor(Math.random() * SYM.length)]);
        const reversed = [...syms].reverse();
        const ans = reversed.join(' ');
        const pool = [];
        for (let i = 0; i < 6; i++) {
            const f = [...syms]; shuffle(f); pool.push(f.join(' '));
        }
        const { options, correctIndex } = makeOpts(ans, pool);
        return { qKey: 'cQ9', display: 'reverse(' + syms.join(' ') + ')', options, correctIndex, difficulty: diff, goldReward: gr, hintCost, hint: 'hintReverse' };
    }

    const primes = [2, 3, 5, 7, 11, 13];
    const p = primes[Math.floor(Math.random() * primes.length)];
    const mult = 2 + Math.floor(Math.random() * 5);
    const product = p * mult;
    const ans = p.toString();
    const pool = primes.map(x => x.toString());
    const { options, correctIndex } = makeOpts(ans, pool);
    return { qKey: 'cQ10', display: 'smallest_factor(' + product + ')', options, correctIndex, difficulty: diff, goldReward: gr + 1, hintCost, hint: 'hintPrime' };
}

class QuantumSignatureChain {
    constructor() { this.blocks = []; this.hashChain = buildHashChain(Date.now().toString(), 256); this.chainIndex = 0; }
    addBlock(action) {
        const ph = this.blocks.length > 0 ? this.blocks[this.blocks.length - 1].hash : '0000000000000000';
        const bd = { index: this.blocks.length, timestamp: Date.now(), action, prevHash: ph };
        const sig = signAction(bd, this.chainIndex % this.hashChain.length, this.hashChain);
        this.chainIndex++;
        const block = { ...bd, hash: fastHash(JSON.stringify(bd) + sig.signature), signature: sig };
        this.blocks.push(block);
        return block;
    }
    verifyChain() {
        for (let i = 1; i < this.blocks.length; i++) if (this.blocks[i].prevHash !== this.blocks[i - 1].hash) return { valid: false, brokenAt: i };
        return { valid: true, length: this.blocks.length };
    }
    getStats() {
        const v = this.verifyChain();
        return { length: this.blocks.length, valid: v.valid, lastHash: this.blocks.length > 0 ? this.blocks[this.blocks.length - 1].hash : 'genesis', signaturesUsed: this.chainIndex };
    }
}

function encryptScore(score, key) {
    const s = score.toString().padStart(10, '0'), k = fastHash(key);
    let e = '';
    for (let i = 0; i < s.length; i++) e += (s.charCodeAt(i) ^ k.charCodeAt(i % k.length)).toString(16).padStart(2, '0');
    return e;
}

export { fastHash, buildHashChain, signAction, generateHumanChallenge, QuantumSignatureChain, encryptScore };
