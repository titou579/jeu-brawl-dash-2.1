// ================= GESTION DES ÉTATS ET STATS DE BASE =================
const playerStats = {
    coins: 100,
    currentBrawler: 'Shelly',
    unlockedBrawlers: ['Shelly'],
    upgrades: {
        speed: 1,
        dmg: 1
    }
};

const brawlerConfig = {
    Shelly: { speed: 4, hp: 100, damage: 20, color: '#FF9900', range: 400 },
    Colt: { speed: 6, hp: 80, damage: 15, color: '#4361EE', range: 600 }
};

let gameInterval;
let isPaused = false;
let isPlaying = false;
let score = 0;
let currentHp = 100;
let keys = {};

// Tableaux de jeu
let obstacles = [];
let bullets = [];
let spawnTimer = 0;
let shootCooldown = 0;

// Physique du joueur
const player = {
    x: 100,
    y: 300,
    width: 40,
    height: 50,
    vy: 0,
    gravity: 0.6,
    jumpForce: -13,
    isGrounded: false,
    direction: 1 // 1 = Droite, -1 = Gauche
};

// Gestion de la Caméra
const camera = {
    x: 0
};

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// ================= GESTION DES MENUS =================
function showScreen(screenId) {
    document.getElementById('main-menu').classList.add('hidden');
    document.getElementById('shop-menu').classList.add('hidden');
    document.getElementById('game-container').classList.add('hidden');
    document.getElementById('pause-menu').classList.add('hidden');
    document.getElementById(screenId).classList.remove('hidden');
}

document.getElementById('btn-start').addEventListener('click', startGame);
document.getElementById('btn-shop').addEventListener('click', () => { updateShopUI(); showScreen('shop-menu'); });
document.getElementById('btn-close-shop').addEventListener('click', () => showScreen('main-menu'));
document.getElementById('btn-pause-trigger').addEventListener('click', togglePause);
document.getElementById('btn-resume').addEventListener('click', togglePause);
document.getElementById('btn-quit').addEventListener('click', quitGame);

function togglePause() {
    isPaused = !isPaused;
    if (isPaused) document.getElementById('pause-menu').classList.remove('hidden');
    else document.getElementById('pause-menu').classList.add('hidden');
}

let invertedControls = false;
document.getElementById('btn-config-layout').addEventListener('click', () => {
    invertedControls = !invertedControls;
    document.getElementById('mobile-controls').style.flexDirection = invertedControls ? 'row-reverse' : 'row';
});

// ================= BOUTIQUE =================
function updateShopUI() {
    document.getElementById('coin-count').innerText = playerStats.coins;
    document.getElementById('speed-lvl').innerText = playerStats.upgrades.speed;
    document.getElementById('dmg-lvl').innerText = playerStats.upgrades.dmg;
    document.getElementById('colt-status').innerText = playerStats.unlockedBrawlers.includes('Colt') ? 'Sélectionner' : 'Acheter (500 🪙)';
}

document.getElementById('buy-speed').addEventListener('click', () => {
    if (playerStats.coins >= 100) { playerStats.coins -= 100; playerStats.upgrades.speed++; updateShopUI(); }
});
document.getElementById('buy-dmg').addEventListener('click', () => {
    if (playerStats.coins >= 150) { playerStats.coins -= 150; playerStats.upgrades.dmg++; updateShopUI(); }
});
document.getElementById('unlock-colt').addEventListener('click', () => {
    if (!playerStats.unlockedBrawlers.includes('Colt') && playerStats.coins >= 500) {
        playerStats.coins -= 500; playerStats.unlockedBrawlers.push('Colt');
        playerStats.currentBrawler = 'Colt'; document.getElementById('current-brawler-display').innerText = 'Colt'; updateShopUI();
    } else if (playerStats.unlockedBrawlers.includes('Colt')) {
        playerStats.currentBrawler = 'Colt'; document.getElementById('current-brawler-display').innerText = 'Colt'; showScreen('main-menu');
    }
});

// ================= ENTRÉES PC & MOBILE =================
window.addEventListener('keydown', (e) => keys[e.code] = true);
window.addEventListener('keyup', (e) => keys[e.code] = false);
window.addEventListener('keydown', (e) => { if (e.code === 'Escape' && isPlaying) togglePause(); });
window.addEventListener('mousedown', () => { if (isPlaying && !isPaused) keys['KeyF'] = true; });
window.addEventListener('mouseup', () => { if (isPlaying && !isPaused) keys['KeyF'] = false; });

function bindMobileBtn(id, keyCode) {
    const btn = document.getElementById(id);
    btn.addEventListener('touchstart', (e) => { e.preventDefault(); keys[keyCode] = true; }, { passive: false });
    btn.addEventListener('touchend', (e) => { e.preventDefault(); keys[keyCode] = false; }, { passive: false });
}
bindMobileBtn('btn-m-left', 'ArrowLeft');
bindMobileBtn('btn-m-right', 'ArrowRight');
bindMobileBtn('btn-m-jump', 'Space');
bindMobileBtn('btn-m-shoot', 'KeyF');

// ================= LOGIQUE DE JEU =================
function startGame() {
    isPlaying = true; isPaused = false; score = 0;
    currentHp = brawlerConfig[playerStats.currentBrawler].hp;
    player.x = 100; player.y = 300; player.vy = 0; player.direction = 1;
    obstacles = []; bullets = []; spawnTimer = 0; shootCooldown = 0; camera.x = 0;
    showScreen('game-container');
    gameInterval = requestAnimationFrame(gameLoop);
}

function quitGame() { isPlaying = false; showScreen('main-menu'); }

function gameLoop() {
    if (!isPlaying) return;
    if (!isPaused) { updatePhysics(); drawGame(); }
    gameInterval = requestAnimationFrame(gameLoop);
}

function updatePhysics() {
    const currentConfig = brawlerConfig[playerStats.currentBrawler];
    // Vitesse calculée correctement
    const finalSpeed = currentConfig.speed * (1 + (playerStats.upgrades.speed - 1) * 0.15);

    // Mouvements contrôlés par le joueur
    if (keys['ArrowLeft'] || keys['KeyA']) { player.x -= finalSpeed; player.direction = -1; }
    if (keys['ArrowRight'] || keys['KeyD']) { player.x += finalSpeed; player.direction = 1; }

    // Saut
    if ((keys['Space'] || keys['KeyW'] || keys['ArrowUp']) && player.isGrounded) {
        player.vy = player.jumpForce; player.isGrounded = false;
    }

    // Gravité
    player.vy += player.gravity; player.y += player.vy;
    const groundLevel = canvas.height - 150;
    if (player.y + player.height >= groundLevel) { player.y = groundLevel - player.height; player.vy = 0; player.isGrounded = true; }
    if (player.x < 0) player.x = 0;

    // Calcul du score basé uniquement sur l'avancement maximal
    if (Math.floor(player.x / 15) > score) { score = Math.floor(player.x / 15); }

    // Caméra centrée de manière fluide
    camera.x = player.x - canvas.width / 2 + player.width / 2;
    if (camera.x < 0) camera.x = 0;

    // --- SYSTÈME DE TIR ---
    if (shootCooldown > 0) shootCooldown--;
    if (keys['KeyF'] && shootCooldown === 0) {
        const dmgMultiplier = 1 + (playerStats.upgrades.dmg - 1) * 0.2;
        bullets.push({
            x: player.direction === 1 ? player.x + player.width : player.x,
            y: player.y + player.height / 2 - 4,
            width: 12, height: 6,
            speed: 12 * player.direction,
            damage: currentConfig.damage * dmgMultiplier,
            startX: player.x,
            range: currentConfig.range
        });
        shootCooldown = 15; // Cadence de tir
    }

    // Physique des balles
    for (let i = bullets.length - 1; i >= 0; i--) {
        let b = bullets[i]; b.x += b.speed;
        if (Math.abs(b.x - b.startX) > b.range || b.x < camera.x || b.x > camera.x + canvas.width) { bullets.splice(i, 1); }
    }

    // --- ENNEMIS ET OBSTACLES ---
    spawnTimer++;
    if (spawnTimer > 90) {
        let type = Math.random() > 0.4 ? 'spike' : 'box';
        obstacles.push({
            x: player.x + canvas.width,
            y: type === 'spike' ? groundLevel - 35 : groundLevel - 60,
            width: type === 'spike' ? 40 : 50,
            height: type === 'spike' ? 35 : 60,
            type: type,
            hp: type === 'box' ? 40 : 1 // Les caisses ont de la vie, pas les pics
        });
        spawnTimer = 0;
    }

    // Collisions balles contre obstacles
    for (let i = bullets.length - 1; i >= 0; i--) {
        for (let j = obstacles.length - 1; j >= 0; j--) {
            let b = bullets[i]; let o = obstacles[j];
            if (b && o && o.type === 'box' && b.x < o.x + o.width && b.x + b.width > o.x && b.y < o.y + o.height && b.y + b.height > o.y) {
                o.hp -= b.damage;
                bullets.splice(i, 1);
                if (o.hp <= 0) { obstacles.splice(j, 1); playerStats.coins += 5; } // 5 pièces par caisse détruite !
            }
        }
    }

    // Collisions joueur contre obstacles (Gestion propre)
    for (let i = obstacles.length - 1; i >= 0; i--) {
        let obs = obstacles[i];
        if (player.x < obs.x + obs.width && player.x + player.width > obs.x && player.y < obs.y + obs.height && player.y + player.height > obs.y) {
            currentHp -= obs.type === 'spike' ? 25 : 15;
            obstacles.splice(i, 1); // Disparaît proprement suite aux dégâts encaissés
            
            if (currentHp <= 0) {
                currentHp = 0;
                let reward = Math.floor(score / 3);
                playerStats.coins += reward;
                alert(`Mort au combat ! Score : ${score}. Tu as collecté : ${reward} 🪙`);
                quitGame();
            }
        }
    }

    document.getElementById('hud-score').innerText = score;
    document.getElementById('hud-hp').innerText = currentHp;
}

function drawGame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const groundLevel = canvas.height - 150;

    // Sol arrière plan
    ctx.fillStyle = '#3c4e6b'; ctx.fillRect(0, groundLevel, canvas.width, 150);
    ctx.fillStyle = '#2b3a52';
    for (let i = 0; i < canvas.width + 200; i += 100) { ctx.fillRect(i - (camera.x % 100), groundLevel, 6, 150); }

    // Dessiner les balles
    ctx.fillStyle = '#FFFF00';
    bullets.forEach(b => ctx.fillRect(b.x - camera.x, b.y, b.width, b.height));

    // Dessiner les obstacles
    obstacles.forEach(obs => {
        if (obs.type === 'spike') {
            ctx.fillStyle = '#ff3333'; ctx.beginPath();
            ctx.moveTo(obs.x - camera.x, obs.y + obs.height);
            ctx.lineTo(obs.x - camera.x + obs.width / 2, obs.y);
            ctx.lineTo(obs.x - camera.x + obs.width, obs.y + obs.height);
            ctx.closePath(); ctx.fill();
        } else {
            ctx.fillStyle = '#cd853f'; ctx.fillRect(obs.x - camera.x, obs.y, obs.width, obs.height);
            ctx.strokeStyle = '#5c3a21'; ctx.lineWidth = 4; ctx.strokeRect(obs.x - camera.x, obs.y, obs.width, obs.height);
            // Afficher la vie de la caisse
            ctx.fillStyle = '#fff'; ctx.font = '12px Arial';
            ctx.fillText(Math.max(0, obs.hp) + ' HP', obs.x - camera.x + 8, obs.y - 8);
        }
    });

    // Dessiner le Brawler
    ctx.fillStyle = brawlerConfig[playerStats.currentBrawler].color;
    ctx.fillRect(player.x - camera.x, player.y, player.width, player.height);

    // Dessiner l'Arme (Le pistolet)
    ctx.fillStyle = '#111';
    if (player.direction === 1) {
        ctx.fillRect(player.x - camera.x + player.width - 5, player.y + player.height / 2, 18, 8); // Vers la droite
    } else {
        ctx.fillRect(player.x - camera.x - 13, player.y + player.height / 2, 18, 8); // Vers la gauche
    }

    // Yeux
    ctx.fillStyle = '#000';
    let eyeOffset = player.direction === 1 ? 28 : 6;
    ctx.fillRect(player.x - camera.x + eyeOffset, player.y + 12, 6, 6);
}
