export class EntropyPool {
    constructor() {
        this.pool = new Uint8Array(256);
        this.poolIndex = 0;
        this.entropyLevel = 50;
        this.rawEntropy = 0;
        this.lastMouseTime = 0;
        this.totalBitsCollected = 0;
        this.recentKeys = [];
        this.maxRecentKeys = 50;
        this._seedFromCrypto();
        this._initMouseCollector();
    }

    _seedFromCrypto() {
        crypto.getRandomValues(this.pool);
        this.totalBitsCollected += this.pool.length * 8;
    }

    _initMouseCollector() {
        window.addEventListener('mousemove', (e) => {
            const now = performance.now();
            if (now - this.lastMouseTime < 50) return;
            this.lastMouseTime = now;
            const byte1 = (e.clientX ^ (now & 0xFF)) & 0xFF;
            const byte2 = (e.clientY ^ ((now >> 8) & 0xFF)) & 0xFF;
            this.pool[this.poolIndex] ^= byte1;
            this.pool[(this.poolIndex + 1) % 256] ^= byte2;
            this.poolIndex = (this.poolIndex + 2) % 256;
            this.totalBitsCollected += 4;
            this._updateRawEntropy();
        });
    }

    _updateRawEntropy() {
        const freq = new Array(256).fill(0);
        for (const byte of this.pool) freq[byte]++;
        let entropy = 0;
        for (const f of freq) {
            if (f > 0) {
                const p = f / 256;
                entropy -= p * Math.log2(p);
            }
        }
        this.rawEntropy = (entropy / 8) * 100;
    }

    setLevel(level) {
        this.entropyLevel = Math.max(0, Math.min(100, level));
    }

    nextFloat() {
        const buf = new Uint32Array(1);
        crypto.getRandomValues(buf);
        const poolByte = this.pool[this.poolIndex];
        this.poolIndex = (this.poolIndex + 1) % 256;
        const mixed = (buf[0] ^ (poolByte << 24)) >>> 0;
        const result = mixed / 0xFFFFFFFF;
        let hexKey = mixed.toString(16).padStart(8, '0');
        const extra = new Uint32Array(3);
        crypto.getRandomValues(extra);
        for (let i = 0; i < 3; i++) hexKey += (extra[i] ^ this.pool[(this.poolIndex + i) % 256]).toString(16).padStart(8, '0');
        this.recentKeys.push({ time: Date.now(), key: hexKey });
        if (this.recentKeys.length > this.maxRecentKeys) this.recentKeys.shift();
        return result;
    }

    nextBiased() {
        const raw = this.nextFloat();
        const bias = this.entropyLevel / 100;
        return 0.5 + (raw - 0.5) * bias;
    }

    getBytes(n) {
        const result = new Uint8Array(n);
        for (let i = 0; i < n; i++) {
            const buf = new Uint8Array(1);
            crypto.getRandomValues(buf);
            result[i] = buf[0] ^ this.pool[(this.poolIndex + i) % 256];
        }
        this.poolIndex = (this.poolIndex + n) % 256;
        return result;
    }

    getRecentKeys() {
        return this.recentKeys;
    }

    addLog(action, hashStr) {
        this.recentKeys.push({ time: Date.now(), key: `${action}] 0x${hashStr}` });
        if (this.recentKeys.length > 50) this.recentKeys.shift();
    }

    getStats() {
        this._updateRawEntropy();
        return {
            level: this.entropyLevel,
            rawEntropy: Math.round(this.rawEntropy * 10) / 10,
            bitsCollected: this.totalBitsCollected,
            poolHealth: Math.min(100, Math.round(this.rawEntropy))
        };
    }
}
