import { Game } from "./src/game.js";

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

resize();
window.addEventListener("resize", resize);

const game = new Game(canvas, ctx);

function loop() {
    game.update();
    game.render();
    requestAnimationFrame(loop);
}

loop();