/* =========================================================
   NEON ARENA — VERSION 2
   Clean Game State System
   ========================================================= */

"use strict";

/* =========================================================
   CANVAS
   ========================================================= */

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

let WIDTH = 0;
let HEIGHT = 0;

function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();

    WIDTH = canvas.width = Math.max(1, Math.floor(rect.width));
    HEIGHT = canvas.height = Math.max(1, Math.floor(rect.height));
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas();


/* =========================================================
   DOM ELEMENTS
   ========================================================= */

const startScreen = document.getElementById("startScreen");
const pauseScreen = document.getElementById("pauseScreen");
const gameOverScreen = document.getElementById("gameOverScreen");

const startButton = document.getElementById("startButton");
const resumeButton = document.getElementById("resumeButton");
const restartButton = document.getElementById("restartButton");

const scoreEl = document.getElementById("score");
const waveEl = document.getElementById("wave");
const healthEl = document.getElementById("health");
const shieldEl = document.getElementById("shield");
const coinsEl = document.getElementById("coins");
const weaponEl = document.getElementById("weapon");
const dashEl = document.getElementById("dash");

const finalScoreEl = document.getElementById("finalScore");
const finalWaveEl = document.getElementById("finalWave");
const bestScoreEl = document.getElementById("bestScore");

const messageEl = document.getElementById("message");


/* =========================================================
   GAME STATES
   ========================================================= */

const GAME_STATE = Object.freeze({
    MENU: "menu",
    PLAYING: "playing",
    PAUSED: "paused",
    GAME_OVER: "gameover"
});

let gameState = GAME_STATE.MENU;


/* =========================================================
   SAFE LOCAL STORAGE
   ========================================================= */

function loadBestScore() {
    try {
        return Number(localStorage.getItem("neonArenaBest")) || 0;
    } catch (error) {
        console.warn("Local storage unavailable.");
        return 0;
    }
}

function saveBestScore(value) {
    try {
        localStorage.setItem("neonArenaBest", String(value));
    } catch (error) {
        console.warn("Could not save high score.");
    }
}

let bestScore = loadBestScore();


/* =========================================================
   INPUT
   ========================================================= */

const keys = {};

const mouse = {
    x: WIDTH / 2,
    y: HEIGHT / 2,
    down: false
};

window.addEventListener("keydown", (event) => {

    keys[event.key.toLowerCase()] = true;

    if (event.code === "Space") {
        event.preventDefault();
    }

    /*
       SPACE = DASH
    */
    if (event.code === "Space" && gameState === GAME_STATE.PLAYING) {
        dash();
    }

    /*
       P = PAUSE / RESUME
    */
    if (event.key.toLowerCase() === "p") {

        if (gameState === GAME_STATE.PLAYING) {
            pauseGame();
        } else if (gameState === GAME_STATE.PAUSED) {
            resumeGame();
        }
    }

    /*
       ESC = PAUSE
    */
    if (event.key === "Escape" && gameState === GAME_STATE.PLAYING) {
        pauseGame();
    }

    /*
       R = RESTART AFTER GAME OVER
    */
    if (
        event.key.toLowerCase() === "r" &&
        gameState === GAME_STATE.GAME_OVER
    ) {
        restartGame();
    }
});

window.addEventListener("keyup", (event) => {
    keys[event.key.toLowerCase()] = false;
});


/* =========================================================
   MOUSE
   ========================================================= */

canvas.addEventListener("mousemove", (event) => {

    const rect = canvas.getBoundingClientRect();

    mouse.x =
        (event.clientX - rect.left) *
        (canvas.width / rect.width);

    mouse.y =
        (event.clientY - rect.top) *
        (canvas.height / rect.height);
});

canvas.addEventListener("mousedown", (event) => {

    if (event.button === 0) {
        mouse.down = true;
    }
});

window.addEventListener("mouseup", (event) => {

    if (event.button === 0) {
        mouse.down = false;
    }
});

canvas.addEventListener("contextmenu", (event) => {
    event.preventDefault();
});


/* =========================================================
   PLAYER
   ========================================================= */

const player = {
    x: 0,
    y: 0,

    radius: 17,

    speed: 4.2,

    health: 100,
    maxHealth: 100,

    shield: 50,
    maxShield: 50,

    damage: 20,

    weaponLevel: 1,

    fireRate: 180,
    lastShot: 0,

    dashPower: 13,
    dashCooldown: 1500,
    lastDash: -9999,

    invulnerableUntil: 0
};


/* =========================================================
   GAME DATA
   ========================================================= */

let score = 0;
let coins = 0;
let wave = 0;

let enemies = [];
let bullets = [];
let enemyBullets = [];
let particles = [];
let pickups = [];
let obstacles = [];

let waveEnemies = 0;
let enemiesSpawned = 0;

let waveTimer = 0;
let waveDelay = 2200;

let messageTimer = 0;

let screenShake = 0;

let lastTime = 0;


/* =========================================================
   UTILITY
   ========================================================= */

function random(min, max) {
    return Math.random() * (max - min) + min;
}

function randomInt(min, max) {
    return Math.floor(random(min, max + 1));
}

function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function circleCollision(a, b) {
    return distance(a, b) < a.radius + b.radius;
}


/* =========================================================
   GAME RESET
   ========================================================= */

function resetGame() {

    score = 0;
    coins = 0;
    wave = 0;

    enemies = [];
    bullets = [];
    enemyBullets = [];
    particles = [];
    pickups = [];
    obstacles = [];

    waveEnemies = 0;
    enemiesSpawned = 0;

    waveTimer = 0;
    messageTimer = 0;

    screenShake = 0;

    player.x = WIDTH / 2;
    player.y = HEIGHT / 2;

    player.health = player.maxHealth;
    player.shield = player.maxShield;

    player.weaponLevel = 1;
    player.damage = 20;

    player.lastShot = 0;
    player.lastDash = -9999;

    createObstacles();

    updateHUD();
}


/* =========================================================
   START GAME
   ========================================================= */

function startGame() {

    resetGame();

    gameState = GAME_STATE.PLAYING;

    hideAllScreens();

    wave = 1;

    startWave();

    showMessage("WAVE 1", 1500);

    lastTime = performance.now();

    requestAnimationFrame(gameLoop);
}


/* =========================================================
   PAUSE
   ========================================================= */

function pauseGame() {

    if (gameState !== GAME_STATE.PLAYING) {
        return;
    }

    gameState = GAME_STATE.PAUSED;

    pauseScreen.classList.remove("hidden");
}


/* =========================================================
   RESUME
   ========================================================= */

function resumeGame() {

    if (gameState !== GAME_STATE.PAUSED) {
        return;
    }

    gameState = GAME_STATE.PLAYING;

    pauseScreen.classList.add("hidden");

    lastTime = performance.now();

    requestAnimationFrame(gameLoop);
}


/* =========================================================
   RESTART
   ========================================================= */

function restartGame() {

    hideAllScreens();

    gameState = GAME_STATE.MENU;

    resetGame();

    /*
       Immediately start a fresh game.
    */
    startGame();
}


/* =========================================================
   GAME OVER
   ========================================================= */

function gameOver() {

    if (gameState === GAME_STATE.GAME_OVER) {
        return;
    }

    gameState = GAME_STATE.GAME_OVER;

    mouse.down = false;

    if (score > bestScore) {
        bestScore = score;
        saveBestScore(bestScore);
    }

    if (finalScoreEl) {
        finalScoreEl.textContent = score;
    }

    if (finalWaveEl) {
        finalWaveEl.textContent = wave;
    }

    if (bestScoreEl) {
        bestScoreEl.textContent = bestScore;
    }

    gameOverScreen.classList.remove("hidden");
}


/* =========================================================
   SCREEN MANAGEMENT
   ========================================================= */

function hideAllScreens() {

    if (startScreen) {
        startScreen.classList.add("hidden");
    }

    if (pauseScreen) {
        pauseScreen.classList.add("hidden");
    }

    if (gameOverScreen) {
        gameOverScreen.classList.add("hidden");
    }
}


/* =========================================================
   BUTTON SYSTEM
   ========================================================= */

if (startButton) {

    startButton.addEventListener("click", (event) => {

        event.preventDefault();

        if (
            gameState === GAME_STATE.MENU ||
            gameState === GAME_STATE.GAME_OVER
        ) {
            startGame();
        }
    });
}


if (resumeButton) {

    resumeButton.addEventListener("click", (event) => {

        event.preventDefault();

        resumeGame();
    });
}


if (restartButton) {

    restartButton.addEventListener("click", (event) => {

        event.preventDefault();

        restartGame();
    });
}


/* =========================================================
   WAVE SYSTEM
   ========================================================= */

function startWave() {

    waveEnemies = 5 + wave * 2;

    enemiesSpawned = 0;

    createWaveEnemies();

    if (wave % 5 === 0) {
        spawnBoss();
    }

    updateHUD();
}


function createWaveEnemies() {

    const count = waveEnemies;

    for (let i = 0; i < count; i++) {

        setTimeout(() => {

            if (gameState !== GAME_STATE.PLAYING) {
                return;
            }

            spawnEnemy();

            enemiesSpawned++;

        }, i * 350);
    }
}


/* =========================================================
   ENEMY SPAWNING
   ========================================================= */

function spawnEnemy() {

    const side = randomInt(0, 3);

    let x;
    let y;

    if (side === 0) {
        x = random(30, WIDTH - 30);
        y = -30;
    }

    if (side === 1) {
        x = WIDTH + 30;
        y = random(30, HEIGHT - 30);
    }

    if (side === 2) {
        x = random(30, WIDTH - 30);
        y = HEIGHT + 30;
    }

    if (side === 3) {
        x = -30;
        y = random(30, HEIGHT - 30);
    }

    const types = ["grunt", "fast", "shooter", "tank"];

    let type;

    const roll = Math.random();

    if (wave < 2) {
        type = "grunt";
    } else if (roll < 0.45) {
        type = "grunt";
    } else if (roll < 0.7) {
        type = "fast";
    } else if (roll < 0.9) {
        type = "shooter";
    } else {
        type = "tank";
    }

    enemies.push(createEnemy(type, x, y));
}


function createEnemy(type, x, y) {

    const enemy = {
        x,
        y,

        type,

        radius: 16,

        health: 50,
        maxHealth: 50,

        speed: 1.5,

        damage: 10,

        shootTimer: random(500, 1500),

        hitFlash: 0
    };


    if (type === "fast") {

        enemy.radius = 12;

        enemy.health = 30;
        enemy.maxHealth = 30;

        enemy.speed = 3.2;

        enemy.damage = 8;
    }


    if (type === "shooter") {

        enemy.radius = 15;

        enemy.health = 45;
        enemy.maxHealth = 45;

        enemy.speed = 1.1;

        enemy.damage = 12;
    }


    if (type === "tank") {

        enemy.radius = 25;

        enemy.health = 150;
        enemy.maxHealth = 150;

        enemy.speed = 0.75;

        enemy.damage = 22;
    }


    return enemy;
}


/* =========================================================
   BOSS
   ========================================================= */

function spawnBoss() {

    enemies.push({
        x: WIDTH / 2,
        y: -80,

        type: "boss",

        radius: 48,

        health: 900 + wave * 150,
        maxHealth: 900 + wave * 150,

        speed: 0.65,

        damage: 30,

        shootTimer: 1000,

        hitFlash: 0,

        boss: true
    });

    showMessage("⚠ BOSS INCOMING ⚠", 2500);
}


/* =========================================================
   PLAYER MOVEMENT
   ========================================================= */

function updatePlayer() {

    let dx = 0;
    let dy = 0;

    if (keys["w"] || keys["arrowup"]) {
        dy--;
    }

    if (keys["s"] || keys["arrowdown"]) {
        dy++;
    }

    if (keys["a"] || keys["arrowleft"]) {
        dx--;
    }

    if (keys["d"] || keys["arrowright"]) {
        dx++;
    }

    if (dx !== 0 || dy !== 0) {

        const length = Math.hypot(dx, dy);

        dx /= length;
        dy /= length;

        player.x += dx * player.speed;
        player.y += dy * player.speed;
    }

    player.x = clamp(
        player.x,
        player.radius,
        WIDTH - player.radius
    );

    player.y = clamp(
        player.y,
        player.radius,
        HEIGHT - player.radius
    );

    if (mouse.down) {
        shoot();
    }
}


/* =========================================================
   SHOOTING
   ========================================================= */

function shoot() {

    const now = performance.now();

    if (now - player.lastShot < player.fireRate) {
        return;
    }

    player.lastShot = now;

    const angle = Math.atan2(
        mouse.y - player.y,
        mouse.x - player.x
    );

    const spread =
        player.weaponLevel >= 3
            ? 0.09
            : 0;

    const shots =
        player.weaponLevel >= 4
            ? 3
            : player.weaponLevel >= 2
                ? 2
                : 1;


    for (let i = 0; i < shots; i++) {

        let shotAngle = angle;

        if (shots > 1) {

            const offset =
                (i - (shots - 1) / 2) * spread;

            shotAngle += offset;
        }

        bullets.push({
            x: player.x,
            y: player.y,

            vx: Math.cos(shotAngle) * 9,
            vy: Math.sin(shotAngle) * 9,

            radius: 5,

            damage: player.damage,

            life: 100
        });
    }

    createMuzzleParticles();
}


/* =========================================================
   DASH
   ========================================================= */

function dash() {

    const now = performance.now();

    if (
        now - player.lastDash <
        player.dashCooldown
    ) {
        return;
    }

    let dx = 0;
    let dy = 0;

    if (keys["w"] || keys["arrowup"]) dy--;
    if (keys["s"] || keys["arrowdown"]) dy++;
    if (keys["a"] || keys["arrowleft"]) dx--;
    if (keys["d"] || keys["arrowright"]) dx++;

    /*
       If no movement key is pressed,
       dash toward mouse.
    */
    if (dx === 0 && dy === 0) {

        dx = mouse.x - player.x;
        dy = mouse.y - player.y;

        const length = Math.hypot(dx, dy);

        if (length > 0) {
            dx /= length;
            dy /= length;
        }
    } else {

        const length = Math.hypot(dx, dy);

        dx /= length;
        dy /= length;
    }

    player.x += dx * player.dashPower * 4;
    player.y += dy * player.dashPower * 4;

    player.x = clamp(
        player.x,
        player.radius,
        WIDTH - player.radius
    );

    player.y = clamp(
        player.y,
        player.radius,
        HEIGHT - player.radius
    );

    player.lastDash = now;

    player.invulnerableUntil = now + 350;

    screenShake = 12;

    for (let i = 0; i < 20; i++) {

        particles.push({
            x: player.x,
            y: player.y,

            vx: random(-3, 3),
            vy: random(-3, 3),

            radius: random(2, 5),

            life: 30,
            maxLife: 30
        });
    }
}


/* =========================================================
   BULLET UPDATE
   ========================================================= */

function updateBullets() {

    bullets.forEach((bullet) => {

        bullet.x += bullet.vx;
        bullet.y += bullet.vy;

        bullet.life--;
    });

    bullets = bullets.filter((bullet) => {

        return (
            bullet.life > 0 &&
            bullet.x > -50 &&
            bullet.x < WIDTH + 50 &&
            bullet.y > -50 &&
            bullet.y < HEIGHT + 50
        );
    });
}


/* =========================================================
   ENEMY UPDATE
   ========================================================= */

function updateEnemies(delta) {

    enemies.forEach((enemy) => {

        const dx = player.x - enemy.x;
        const dy = player.y - enemy.y;

        const dist = Math.hypot(dx, dy);

        if (dist === 0) {
            return;
        }

        const nx = dx / dist;
        const ny = dy / dist;


        /*
           GRUNT / FAST / TANK
        */

        if (
            enemy.type === "grunt" ||
            enemy.type === "fast" ||
            enemy.type === "tank"
        ) {

            enemy.x += nx * enemy.speed;
            enemy.y += ny * enemy.speed;
        }


        /*
           SHOOTER
        */

        if (enemy.type === "shooter") {

            if (dist > 280) {

                enemy.x += nx * enemy.speed;
                enemy.y += ny * enemy.speed;

            } else if (dist < 180) {

                enemy.x -= nx * enemy.speed;
                enemy.y -= ny * enemy.speed;
            }

            enemy.shootTimer -= delta;

            if (enemy.shootTimer <= 0) {

                enemyShoot(enemy);

                enemy.shootTimer = 1300;
            }
        }


        /*
           BOSS
        */

        if (enemy.type === "boss") {

            if (dist > 220) {

                enemy.x += nx * enemy.speed;
                enemy.y += ny * enemy.speed;
            }

            enemy.shootTimer -= delta;

            if (enemy.shootTimer <= 0) {

                bossShoot(enemy);

                enemy.shootTimer = 700;
            }
        }


        enemy.x = clamp(
            enemy.x,
            -100,
            WIDTH + 100
        );

        enemy.y = clamp(
            enemy.y,
            -100,
            HEIGHT + 100
        );

        enemy.hitFlash = Math.max(
            0,
            enemy.hitFlash - delta
        );
    });
}


/* =========================================================
   ENEMY SHOOT
   ========================================================= */

function enemyShoot(enemy) {

    const angle = Math.atan2(
        player.y - enemy.y,
        player.x - enemy.x
    );

    enemyBullets.push({
        x: enemy.x,
        y: enemy.y,

        vx: Math.cos(angle) * 4,
        vy: Math.sin(angle) * 4,

        radius: 6,

        damage: enemy.damage,

        life: 180
    });
}


/* =========================================================
   BOSS SHOOT
   ========================================================= */

function bossShoot(enemy) {

    const baseAngle = Math.atan2(
        player.y - enemy.y,
        player.x - enemy.x
    );

    for (let i = -2; i <= 2; i++) {

        const angle =
            baseAngle + i * 0.16;

        enemyBullets.push({
            x: enemy.x,
            y: enemy.y,

            vx: Math.cos(angle) * 4.5,
            vy: Math.sin(angle) * 4.5,

            radius: 8,

            damage: 15,

            life: 220
        });
    }
}


/* =========================================================
   ENEMY BULLETS
   ========================================================= */

function updateEnemyBullets() {

    enemyBullets.forEach((bullet) => {

        bullet.x += bullet.vx;
        bullet.y += bullet.vy;

        bullet.life--;

        if (
            circleCollision(bullet, player) &&
            performance.now() > player.invulnerableUntil
        ) {

            damagePlayer(bullet.damage);

            bullet.life = 0;
        }
    });

    enemyBullets = enemyBullets.filter((bullet) => {

        return (
            bullet.life > 0 &&
            bullet.x > -100 &&
            bullet.x < WIDTH + 100 &&
            bullet.y > -100 &&
            bullet.y < HEIGHT + 100
        );
    });
}


/* =========================================================
   BULLET → ENEMY COLLISIONS
   ========================================================= */

function handleBulletCollisions() {

    bullets.forEach((bullet) => {

        enemies.forEach((enemy) => {

            if (enemy.health <= 0) {
                return;
            }

            if (circleCollision(bullet, enemy)) {

                enemy.health -= bullet.damage;

                enemy.hitFlash = 80;

                bullet.life = 0;

                createHitParticles(
                    enemy.x,
                    enemy.y
                );

                if (enemy.health <= 0) {

                    killEnemy(enemy);
                }
            }
        });
    });
}


/* =========================================================
   ENEMY → PLAYER COLLISION
   ========================================================= */

function handleEnemyCollisions() {

    if (
        performance.now() <
        player.invulnerableUntil
    ) {
        return;
    }

    enemies.forEach((enemy) => {

        if (circleCollision(player, enemy)) {

            damagePlayer(enemy.damage * 0.15);

            const dx = player.x - enemy.x;
            const dy = player.y - enemy.y;

            const length = Math.hypot(dx, dy) || 1;

            player.x +=
                (dx / length) * 10;

            player.y +=
                (dy / length) * 10;
        }
    });
}


/* =========================================================
   DAMAGE PLAYER
   ========================================================= */

function damagePlayer(amount) {

    if (
        performance.now() <
        player.invulnerableUntil
    ) {
        return;
    }

    let remaining = amount;

    /*
       Shield absorbs damage first.
    */

    if (player.shield > 0) {

        const absorbed =
            Math.min(player.shield, remaining);

        player.shield -= absorbed;

        remaining -= absorbed;
    }

    if (remaining > 0) {

        player.health -= remaining;
    }

    player.invulnerableUntil =
        performance.now() + 250;

    screenShake = 8;

    createHitParticles(
        player.x,
        player.y
    );

    if (player.health <= 0) {

        player.health = 0;

        updateHUD();

        gameOver();
    }

    updateHUD();
}


/* =========================================================
   KILL ENEMY
   ========================================================= */

function killEnemy(enemy) {

    score += enemy.type === "boss"
        ? 5000
        : enemy.type === "tank"
            ? 400
            : enemy.type === "shooter"
                ? 250
                : enemy.type === "fast"
                    ? 180
                    : 100;

    coins += enemy.type === "boss"
        ? 25
        : randomInt(1, 5);

    createExplosion(
        enemy.x,
        enemy.y
    );

    if (Math.random() < 0.15) {

        spawnPickup(
            enemy.x,
            enemy.y
        );
    }

    enemy.health = 0;

    updateHUD();
}


/* =========================================================
   REMOVE DEAD ENEMIES
   ========================================================= */

function cleanupEnemies() {

    enemies = enemies.filter(
        enemy => enemy.health > 0
    );
}


/* =========================================================
   WAVE CHECK
   ========================================================= */

function checkWaveComplete() {

    if (
        enemies.length === 0 &&
        enemiesSpawned >= waveEnemies
    ) {

        waveTimer += 16;

        if (waveTimer >= waveDelay) {

            waveTimer = 0;

            wave++;

            startWave();

            showMessage(
                `WAVE ${wave}`,
                1400
            );
        }
    }
}


/* =========================================================
   PICKUPS
   ========================================================= */

function spawnPickup(x, y) {

    const type =
        Math.random() < 0.5
            ? "health"
            : "shield";

    pickups.push({
        x,
        y,

        radius: 12,

        type,

        life: 900
    });
}


function updatePickups() {

    pickups.forEach((pickup) => {

        pickup.life--;

        if (circleCollision(pickup, player)) {

            if (pickup.type === "health") {

                player.health = Math.min(
                    player.maxHealth,
                    player.health + 25
                );

                showMessage("+25 HEALTH", 700);
            }

            if (pickup.type === "shield") {

                player.shield = Math.min(
                    player.maxShield,
                    player.shield + 25
                );

                showMessage("+25 SHIELD", 700);
            }

            pickup.life = 0;

            updateHUD();
        }
    });

    pickups = pickups.filter(
        pickup => pickup.life > 0
    );
}


/* =========================================================
   AUTO WEAPON UPGRADE
   ========================================================= */

function checkUpgrade() {

    const requiredCoins =
        player.weaponLevel * 25;

    if (
        coins >= requiredCoins &&
        player.weaponLevel < 5
    ) {

        coins -= requiredCoins;

        player.weaponLevel++;

        player.damage += 7;

        player.fireRate =
            Math.max(
                80,
                player.fireRate - 15
            );

        showMessage(
            `WEAPON LEVEL ${player.weaponLevel}`,
            1200
        );

        updateHUD();
    }
}


/* =========================================================
   PARTICLES
   ========================================================= */

function createHitParticles(x, y) {

    for (let i = 0; i < 8; i++) {

        particles.push({
            x,
            y,

            vx: random(-3, 3),
            vy: random(-3, 3),

            radius: random(2, 4),

            life: 20,
            maxLife: 20
        });
    }
}


function createExplosion(x, y) {

    for (let i = 0; i < 25; i++) {

        particles.push({
            x,
            y,

            vx: random(-5, 5),
            vy: random(-5, 5),

            radius: random(2, 6),

            life: randomInt(20, 45),

            maxLife: 45
        });
    }

    screenShake = 10;
}


function createMuzzleParticles() {

    const angle = Math.atan2(
        mouse.y - player.y,
        mouse.x - player.x
    );

    const x =
        player.x + Math.cos(angle) * 22;

    const y =
        player.y + Math.sin(angle) * 22;

    for (let i = 0; i < 4; i++) {

        particles.push({
            x,
            y,

            vx: Math.cos(angle) * random(1, 3),
            vy: Math.sin(angle) * random(1, 3),

            radius: random(2, 4),

            life: 12,
            maxLife: 12
        });
    }
}


function updateParticles() {

    particles.forEach((particle) => {

        particle.x += particle.vx;
        particle.y += particle.vy;

        particle.vx *= 0.96;
        particle.vy *= 0.96;

        particle.life--;
    });

    particles = particles.filter(
        particle => particle.life > 0
    );
}


/* =========================================================
   OBSTACLES
   ========================================================= */

function createObstacles() {

    obstacles = [];

    for (let i = 0; i < 8; i++) {

        const width = random(50, 110);
        const height = random(40, 90);

        const x = random(
            50,
            WIDTH - width - 50
        );

        const y = random(
            50,
            HEIGHT - height - 50
        );

        /*
           Don't place obstacle directly on player.
        */

        if (
            Math.hypot(
                x + width / 2 - WIDTH / 2,
                y + height / 2 - HEIGHT / 2
            ) < 160
        ) {
            continue;
        }

        obstacles.push({
            x,
            y,
            width,
            height
        });
    }
}


/* =========================================================
   DRAW BACKGROUND
   ========================================================= */

function drawBackground() {

    ctx.fillStyle = "#070b18";

    ctx.fillRect(
        0,
        0,
        WIDTH,
        HEIGHT
    );


    /*
       Grid
    */

    ctx.strokeStyle = "rgba(60, 120, 200, 0.08)";
    ctx.lineWidth = 1;

    const gridSize = 40;

    for (
        let x = 0;
        x < WIDTH;
        x += gridSize
    ) {

        ctx.beginPath();

        ctx.moveTo(x, 0);
        ctx.lineTo(x, HEIGHT);

        ctx.stroke();
    }

    for (
        let y = 0;
        y < HEIGHT;
        y += gridSize
    ) {

        ctx.beginPath();

        ctx.moveTo(0, y);
        ctx.lineTo(WIDTH, y);

        ctx.stroke();
    }
}


/* =========================================================
   DRAW OBSTACLES
   ========================================================= */

function drawObstacles() {

    obstacles.forEach((obstacle) => {

        ctx.fillStyle = "#111a2d";

        ctx.fillRect(
            obstacle.x,
            obstacle.y,
            obstacle.width,
            obstacle.height
        );

        ctx.strokeStyle =
            "rgba(80, 200, 255, 0.35)";

        ctx.strokeRect(
            obstacle.x,
            obstacle.y,
            obstacle.width,
            obstacle.height
        );
    });
}


/* =========================================================
   DRAW PLAYER
   ========================================================= */

function drawPlayer() {

    const angle = Math.atan2(
        mouse.y - player.y,
        mouse.x - player.x
    );

    /*
       Shield ring
    */

    if (player.shield > 0) {

        ctx.beginPath();

        ctx.arc(
            player.x,
            player.y,
            player.radius + 7,
            0,
            Math.PI * 2
        );

        ctx.strokeStyle =
            "rgba(0, 220, 255, 0.7)";

        ctx.lineWidth = 3;

        ctx.stroke();
    }


    /*
       Player body
    */

    ctx.save();

    ctx.translate(
        player.x,
        player.y
    );

    ctx.rotate(angle);

    ctx.beginPath();

    ctx.moveTo(22, 0);
    ctx.lineTo(-14, -13);
    ctx.lineTo(-8, 0);
    ctx.lineTo(-14, 13);

    ctx.closePath();

    ctx.fillStyle = "#35e7ff";

    ctx.shadowBlur = 20;
    ctx.shadowColor = "#00eaff";

    ctx.fill();

    ctx.restore();

    ctx.shadowBlur = 0;


    /*
       Aim line
    */

    ctx.beginPath();

    ctx.moveTo(
        player.x,
        player.y
    );

    ctx.lineTo(
        mouse.x,
        mouse.y
    );

    ctx.strokeStyle =
        "rgba(80, 220, 255, 0.08)";

    ctx.stroke();
}


/* =========================================================
   DRAW ENEMIES
   ========================================================= */

function drawEnemies() {

    enemies.forEach((enemy) => {

        let fill = "#ff3b6b";

        if (enemy.type === "fast") {
            fill = "#ff9f43";
        }

        if (enemy.type === "shooter") {
            fill = "#b86bff";
        }

        if (enemy.type === "tank") {
            fill = "#ff4f4f";
        }

        if (enemy.type === "boss") {
            fill = "#ff205e";
        }


        ctx.beginPath();

        ctx.arc(
            enemy.x,
            enemy.y,
            enemy.radius,
            0,
            Math.PI * 2
        );

        ctx.fillStyle =
            enemy.hitFlash > 0
                ? "#ffffff"
                : fill;

        ctx.shadowBlur =
            enemy.type === "boss"
                ? 25
                : 12;

        ctx.shadowColor = fill;

        ctx.fill();

        ctx.shadowBlur = 0;


        /*
           Health bar
        */

        const barWidth =
            enemy.radius * 2.2;

        const healthRatio =
            enemy.health / enemy.maxHealth;

        ctx.fillStyle =
            "rgba(0,0,0,0.5)";

        ctx.fillRect(
            enemy.x - barWidth / 2,
            enemy.y - enemy.radius - 9,
            barWidth,
            4
        );

        ctx.fillStyle = "#ff416c";

        ctx.fillRect(
            enemy.x - barWidth / 2,
            enemy.y - enemy.radius - 9,
            barWidth * healthRatio,
            4
        );
    });
}


/* =========================================================
   DRAW BULLETS
   ========================================================= */

function drawBullets() {

    bullets.forEach((bullet) => {

        ctx.beginPath();

        ctx.arc(
            bullet.x,
            bullet.y,
            bullet.radius,
            0,
            Math.PI * 2
        );

        ctx.fillStyle = "#65f5ff";

        ctx.shadowBlur = 15;
        ctx.shadowColor = "#00eaff";

        ctx.fill();

        ctx.shadowBlur = 0;
    });


    enemyBullets.forEach((bullet) => {

        ctx.beginPath();

        ctx.arc(
            bullet.x,
            bullet.y,
            bullet.radius,
            0,
            Math.PI * 2
        );

        ctx.fillStyle = "#ff4675";

        ctx.shadowBlur = 15;
        ctx.shadowColor = "#ff174f";

        ctx.fill();

        ctx.shadowBlur = 0;
    });
}


/* =========================================================
   DRAW PICKUPS
   ========================================================= */

function drawPickups() {

    pickups.forEach((pickup) => {

        ctx.beginPath();

        ctx.arc(
            pickup.x,
            pickup.y,
            pickup.radius,
            0,
            Math.PI * 2
        );

        ctx.fillStyle =
            pickup.type === "health"
                ? "#4cff88"
                : "#50aaff";

        ctx.shadowBlur = 18;

        ctx.shadowColor =
            pickup.type === "health"
                ? "#4cff88"
                : "#50aaff";

        ctx.fill();

        ctx.shadowBlur = 0;
    });
}


/* =========================================================
   DRAW PARTICLES
   ========================================================= */

function drawParticles() {

    particles.forEach((particle) => {

        const alpha =
            particle.life / particle.maxLife;

        ctx.globalAlpha = alpha;

        ctx.beginPath();

        ctx.arc(
            particle.x,
            particle.y,
            particle.radius,
            0,
            Math.PI * 2
        );

        ctx.fillStyle = "#ffffff";

        ctx.fill();
    });

    ctx.globalAlpha = 1;
}


/* =========================================================
   AIM CROSSHAIR
   ========================================================= */

function drawCrosshair() {

    if (
        gameState !== GAME_STATE.PLAYING
    ) {
        return;
    }

    const size = 8;

    ctx.strokeStyle =
        "rgba(100, 240, 255, 0.8)";

    ctx.lineWidth = 1.5;

    ctx.beginPath();

    ctx.moveTo(
        mouse.x - size,
        mouse.y
    );

    ctx.lineTo(
        mouse.x + size,
        mouse.y
    );

    ctx.moveTo(
        mouse.x,
        mouse.y - size
    );

    ctx.lineTo(
        mouse.x,
        mouse.y + size
    );

    ctx.stroke();
}


/* =========================================================
   HUD
   ========================================================= */

function updateHUD() {

    if (scoreEl) {
        scoreEl.textContent =
            Math.floor(score);
    }

    if (waveEl) {
        waveEl.textContent =
            wave;
    }

    if (healthEl) {
        healthEl.textContent =
            Math.ceil(player.health);
    }

    if (shieldEl) {
        shieldEl.textContent =
            Math.ceil(player.shield);
    }

    if (coinsEl) {
        coinsEl.textContent =
            coins;
    }

    if (weaponEl) {
        weaponEl.textContent =
            player.weaponLevel;
    }

    if (dashEl) {

        const cooldown =
            Math.max(
                0,
                player.dashCooldown -
                (performance.now() -
                    player.lastDash)
            );

        if (cooldown <= 0) {
            dashEl.textContent = "READY";
        } else {
            dashEl.textContent =
                `${(cooldown / 1000).toFixed(1)}s`;
        }
    }
}


/* =========================================================
   MESSAGE
   ========================================================= */

function showMessage(text, duration) {

    if (!messageEl) {
        return;
    }

    messageEl.textContent = text;

    messageEl.classList.add("show");

    messageTimer = duration;
}


function updateMessage(delta) {

    if (messageTimer <= 0) {
        return;
    }

    messageTimer -= delta;

    if (messageTimer <= 0) {

        if (messageEl) {
            messageEl.classList.remove("show");
        }
    }
}


/* =========================================================
   GAME LOOP
   ========================================================= */

function gameLoop(timestamp) {

    /*
       VERY IMPORTANT:
       Do not continue updating when paused
       or game over.
    */

    if (gameState !== GAME_STATE.PLAYING) {
        return;
    }

    const delta = Math.min(
        timestamp - lastTime,
        40
    );

    lastTime = timestamp;


    update(delta);
    draw();


    if (gameState === GAME_STATE.PLAYING) {
        requestAnimationFrame(gameLoop);
    }
}


/* =========================================================
   UPDATE
   ========================================================= */

function update(delta) {

    updatePlayer();

    updateBullets();

    updateEnemies(delta);

    updateEnemyBullets();

    handleBulletCollisions();

    handleEnemyCollisions();

    cleanupEnemies();

    updatePickups();

    updateParticles();

    updateMessage(delta);

    checkWaveComplete();

    checkUpgrade();

    screenShake *= 0.9;

    updateHUD();
}


/* =========================================================
   DRAW
   ========================================================= */

function draw() {

    ctx.save();


    /*
       Screen shake
    */

    if (screenShake > 0.5) {

        ctx.translate(
            random(-screenShake, screenShake),
            random(-screenShake, screenShake)
        );
    }


    drawBackground();

    drawObstacles();

    drawPickups();

    drawBullets();

    drawEnemies();

    drawPlayer();

    drawParticles();

    drawCrosshair();


    ctx.restore();
}


/* =========================================================
   INITIAL MENU
   ========================================================= */

function initializeGame() {

    gameState = GAME_STATE.MENU;

    resetGame();

    hideAllScreens();

    if (startScreen) {
        startScreen.classList.remove("hidden");
    }

    if (bestScoreEl) {
        bestScoreEl.textContent = bestScore;
    }

    updateHUD();
}


/* =========================================================
   INITIALIZE
   ========================================================= */

initializeGame();


/* =========================================================
   DEBUG HELPER
   =========================================================

   You can type this in browser console:

   gameDebug()

   ========================================================= */

window.gameDebug = function () {

    console.log({
        state: gameState,
        score,
        wave,
        health: player.health,
        shield: player.shield,
        coins,
        weaponLevel: player.weaponLevel,
        enemies: enemies.length,
        bullets: bullets.length
    });
};