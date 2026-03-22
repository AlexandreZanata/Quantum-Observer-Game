import { solveSchrodinger } from "./utils.js";

export class World {
    constructor() {
        this.tileSize = 25;
        this.stateMap = new Map();
        this.timeElapsed = 0;
    }

    getTileState(x, y) {
        const key = `${x},${y}`;
        if (!this.stateMap.has(key)) {
            const state = solveSchrodinger(x, y, this.timeElapsed);
            this.stateMap.set(key, state);
        }
        return { x, y, key, type: this.stateMap.get(key) };
    }

    mutateTile(x, y, newType) {
        const key = `${x},${y}`;
        if (this.stateMap.has(key)) this.stateMap.set(key, newType);
    }

    getObservableUniverse(player) {
        const { x: px, y: py, observationRadius } = player;
        const radiusInTiles = Math.ceil(observationRadius / this.tileSize) + 1;
        const centerTx = Math.floor(px / this.tileSize);
        const centerTy = Math.floor(py / this.tileSize);
        const observable = [];
        const observedKeys = new Set();

        for (let dx = -radiusInTiles; dx <= radiusInTiles; dx++) {
            for (let dy = -radiusInTiles; dy <= radiusInTiles; dy++) {
                const tx = centerTx + dx;
                const ty = centerTy + dy;
                const distSq = (dx * this.tileSize) ** 2 + (dy * this.tileSize) ** 2;
                if (distSq <= observationRadius ** 2) {
                    const tile = this.getTileState(tx, ty);
                    observable.push(tile);
                    observedKeys.add(tile.key);
                }
            }
        }

        for (const key of this.stateMap.keys()) {
            if (!observedKeys.has(key)) this.stateMap.delete(key);
        }

        this.timeElapsed += 0.05;
        return observable;
    }
}