import { EntropyPool } from "./entropy.js";

export const entropyPool = new EntropyPool();

export const createQuantumState = () => {
    return entropyPool.nextFloat();
};

export const solveSchrodinger = (x, y, timeElapsed) => {
    const phase = Math.sin((x * 0.1) + timeElapsed) * Math.cos((y * 0.1) - timeElapsed);
    const amplitude = Math.abs(phase);
    const trueRandom = entropyPool.nextBiased();
    const entropyFactor = entropyPool.entropyLevel / 100;
    const probability = (amplitude * (1 - entropyFactor * 0.5)) + (trueRandom * (0.5 + entropyFactor * 0.5));
    if (probability > 0.6) return "energy";
    if (probability > 0.3) return "matter";
    return "void";
};
