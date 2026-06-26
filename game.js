// ================= GESTION DES ÉTATS ET STATS DE BASE =================
const playerStats = {
    coins: 100, // On commence avec 100 pièces pour tester la boutique !
    currentBrawler: 'Shelly',
    unlockedBrawlers: ['Shelly'],
    upgrades: {
        speed: 1,
        dmg: 1
    }
};

// Configuration des brawlers (Vitesse de base, points de vie, dégâts)
const brawlerConfig = {
    Shelly: { speed: 4, hp: 100, damage: 20, color: '#FF9900' },
    Colt: { speed: 6, hp: 80, damage: 15, color: '#4361EE' }
};

// Variables du jeu en cours
let gameInterval;
let isPaused = false;
let isPlaying = false;
let score = 0;
let currentHp = 100;
let keys = {};

// Physique du joueur
const player = {
    x: 100,
    y: 300,
    width: 40,
    height: 50,
    vy: 0,
    gravity: 0.6,
    jumpForce: -12,
    isGrounded: false
};

// Définition des éléments HTML
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Ajuster le Canvas à la taille de l'écran
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// ================= GESTION DES MENUS ET INTERFACES =================
function showScreen(screenId) {
    document.getElementById('main-menu').classList.add('hidden');
    document.getElementById('shop-menu').classList.add('hidden');
    document.getElementById('game-container').classList.add('hidden');
    document.getElementById('pause-menu').classList.add('hidden');

    document.getElementById(screenId).classList.remove('hidden');
}

// Liaisons des boutons du Menu
document.getElementById('btn-start').addEventListener('click', startGame);
document.getElementById('btn-shop').addEventListener('click', () => {
    updateShopUI();
    showScreen('shop-menu');
});
document.getElementById('btn-close-shop').addEventListener('click', () => showScreen('main-menu'));

// Système de Pause
document.getElementById('btn-pause-trigger').addEventListener('click', togglePause);
document.getElementById('btn-resume').addEventListener('click', togglePause);
document.getElementById('btn-quit').addEventListener('click', quitGame);

function togglePause() {
    isPaused = !isPaused;
    if (isPaused) {
        document.getElementById('pause-menu').classList.remove('hidden');
    } else {
        document.getElementById('pause-menu').classList.add('hidden');
    }
}

// Inverser la position des touches mobiles (Critère config)
let invertedControls = false;
document.getElementById('btn-config-layout').addEventListener('click', () => {
    invertedControls = !invertedControls;
    const controls = document.getElementById('mobile-controls');
    if (invertedControls) {
        controls.style.flexDirection = 'row-reverse';
    } else {
        controls.style.flexDirection = 'row';
    }
});

// ================= SYSTÈME DE LA BOUTIQUE =================
function updateShopUI() {
    document.getElementById('coin-count').innerText = playerStats.coins;
    document.getElementById('speed-lvl').innerText = playerStats.upgrades.speed;
    document.getElementById('dmg-lvl').innerText = playerStats.upgrades.dmg;
    document.getElementById('colt-status').innerText = playerStats.unlockedBrawlers.includes('Colt') ? 'Débloqué' : 'Verrouillé';
}

document.getElementById('buy-speed').addEventListener('click', () => {
    if (playerStats.coins >= 100) {
        playerStats.coins -= 100;
        playerStats.upgrades.speed++;
        updateShopUI();
    }
});

document.getElementById('buy-dmg').addEventListener('click', () => {
    if (playerStats.coins >= 150) {
        playerStats.coins -= 150;
        playerStats.upgrades.dmg++;
        updateShopUI();
    }
});

document.getElementById('unlock-colt').addEventListener('click', () => {
    if (!playerStats.unlockedBrawlers.includes('Colt') && playerStats.coins >= 500) {
        playerStats.coins -= 500;
        playerStats.unlockedBrawlers.push('Colt');
        document.getElementById('current-brawler-display').innerText = 'Colt (Sélectionné)';
        playerStats.currentBrawler = 'Colt';
        updateShopUI();
    } else if (playerStats.unlockedBrawlers.includes('Colt')) {
        playerStats.currentBrawler = 'Colt';
        document.getElementById('current-brawler-display').innerText = 'Colt';
        showScreen('main-menu');
    }
});

// ================= GESTION DES ENTRÉES (PC & MOBILE) =================

// Clavier PC
window.addEventListener('keydown', (e) => keys[e.code] = true);
window.addEventListener('keyup', (e) => keys[e.code] = false);
window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && isPlaying) togglePause();
});

// Tactile Mobile
function bindMobileBtn(id, keyCode) {
    const btn = document.getElementById(id);
    btn.addEventListener('touchstart', (e) => { e.preventDefault(); keys[keyCode] = true; });
    btn.addEventListener('touchend', (e) => { e.preventDefault(); keys[keyCode] = false; });
}
bindMobileBtn('btn-m-left', 'ArrowLeft');
bindMobileBtn('btn-m-right', 'ArrowRight');
bindMobileBtn('btn-m-jump', 'Space');
bindMobileBtn('btn-m-shoot', 'KeyF');

// ================= BOUCLE DE JEU PRINCIPALE =================
function startGame() {
    isPlaying = true;
    isPaused = false;
    score = 0;
    currentHp = brawlerConfig[playerStats.currentBrawler].hp;
    player.x = 100;
    player.y = 300;
    player.vy = 0;
    
    showScreen('game-container');
    gameInterval = requestAnimationFrame(gameLoop);
}

function quitGame() {
    isPlaying = false;
    showScreen('main-menu');
}

function gameLoop() {
    if (!isPlaying) return;

    if (!isPaused) {
        updatePhysics();
        drawGame();
    }

    gameInterval = requestAnimationFrame(gameLoop);
}

function updatePhysics() {
    const currentConfig = brawlerConfig[playerStats.currentBrawler];
    // Vitesse boostée par les améliorations de la boutique
    const speedMultiplier = 1 + (playerStats.upgrades.speed - 1) * 0.1;
    const finalSpeed = currentConfig.speed * speedMultiplier;

    // Déplacement Gauche / Droite (touches PC ou boutons mobiles)
    if (keys['ArrowLeft'] || keys['KeyA']) player.x -= finalSpeed;
    if (keys['ArrowRight'] || keys['KeyD']) player.x += finalSpeed;

    // Saut (Espace ou Z)
    if ((keys['Space'] || keys['KeyW'] || keys['ArrowUp']) && player.isGrounded) {
        player.vy = player.jumpForce;
        player.isGrounded = false;
    }

    // Application de la gravité
    player.vy += player.gravity;
    player.y += player.vy;

    // Sol virtuel temporaire pour éviter de tomber à l'infini
    const groundLevel = canvas.height - 150;
    if (player.y + player.height >= groundLevel) {
        player.y = groundLevel - player.height;
        player.vy = 0;
        player.isGrounded = true;
    }

    // Bloquer le joueur dans les limites de l'écran
    if (player.x < 0) player.x = 0;
    if (player.x + player.width > canvas.width) player.x = canvas.width - player.width;

    // Augmenter le score passivement pour simuler l'avancée
    score++;
    
    // Mettre à jour l'ATH
    document.getElementById('hud-score').innerText = score;
    document.getElementById('hud-hp').innerText = currentHp;
}

function drawGame() {
    // Effacer l'écran précédent
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Dessiner le sol
    ctx.fillStyle = '#3c4e6b';
    ctx.fillRect(0, canvas.height - 150, canvas.width, 150);

    // Dessiner le Brawler (Représenté par un rectangle coloré)
    ctx.fillStyle = brawlerConfig[playerStats.currentBrawler].color;
    ctx.fillRect(player.x, player.y, player.width, player.height);

    // Yeux ou détails simples pour lui donner vie
    ctx.fillStyle = '#000';
    ctx.fillRect(player.x + (keys['ArrowLeft'] ? 5 : 25), player.y + 10, 8, 8);
}
