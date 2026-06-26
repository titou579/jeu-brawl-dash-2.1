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
    Shelly: { speed: 5, hp: 100, damage: 20, color: '#FF9900' },
    Colt: { speed: 7, hp: 80, damage: 15, color: '#4361EE' }
};

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

// Gestion de la Caméra
const camera = {
    x: 0,
    targetX: 0
};

// Tableaux pour stocker les éléments du jeu
let obstacles = [];
let spawnTimer = 0;

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
    const controls = document.getElementById('mobile-controls');
    controls.style.flexDirection = invertedControls ? 'row-reverse' : 'row';
});

// ================= BOUTIQUE =================
function updateShopUI() {
    document.getElementById('coin-count').innerText = playerStats.coins;
    document.getElementById('speed-lvl').innerText = playerStats.upgrades.speed;
    document.getElementById('dmg-lvl').innerText = playerStats.upgrades.dmg;
    document.getElementById('colt-status').innerText = playerStats.unlockedBrawlers.includes('Colt') ? 'Débloqué' : 'Verrouillé';
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

function bindMobileBtn(id, keyCode) {
    const btn = document.getElementById(id);
    btn.addEventListener('touchstart', (e) => { e.preventDefault(); keys[keyCode] = true; });
    btn.addEventListener('touchend', (e) => { e.preventDefault(); keys[keyCode] = false; });
}
bindMobileBtn('btn-m-left', 'ArrowLeft');
bindMobileBtn('btn-m-right', 'ArrowRight');
bindMobileBtn('btn-m-jump', 'Space');

// ================= BOUCLE DE JEU =================
function startGame() {
    isPlaying = true;
    isPaused = false;
    score = 0;
    currentHp = brawlerConfig[playerStats.currentBrawler].hp;
    player.x = 100;
    player.y = 300;
    player.vy = 0;
    obstacles = [];
    spawnTimer = 0;
    camera.x = 0;
    
    showScreen('game-container');
    gameInterval = requestAnimationFrame(gameLoop);
}

function quitGame() { isPlaying = false; showScreen('main-menu'); }

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
    const speedMultiplier = 1 + (playerStats.upgrades.speed - 1) * 0.1;
    const finalSpeed = currentConfig.speed * speedMultiplier;

    // Déplacement et mise à jour du score basé sur la vraie distance parcourue
    if (keys['ArrowLeft'] || keys['KeyA']) {
        player.x -= finalSpeed;
    }
    if (keys['ArrowRight'] || keys['KeyD'] || true) { // Retirer "|| true" si tu ne veux pas que ça avance tout seul style Geometry Dash
        player.x += finalSpeed;
        score = Math.floor(player.x / 10); // Le score augmente proportionnellement à la distance !
    }

    // Saut
    if ((keys['Space'] || keys['KeyW'] || keys['ArrowUp']) && player.isGrounded) {
        player.vy = player.jumpForce;
        player.isGrounded = false;
    }

    // Gravité
    player.vy += player.gravity;
    player.y += player.vy;

    const groundLevel = canvas.height - 150;
    if (player.y + player.height >= groundLevel) {
        player.y = groundLevel - player.height;
        player.vy = 0;
        player.isGrounded = true;
    }

    // Centrer la caméra sur le joueur
    camera.x = player.x - canvas.width / 2 + player.width / 2;
    if (camera.x < 0) camera.x = 0; // Empêche la caméra de voir derrière le début de la map

    // --- GÉNÉRATEUR D'OBSTACLES ---
    spawnTimer++;
    if (spawnTimer > 120) { // Aléatoire ou fixe toutes les 2 secondes environ
        let type = Math.random() > 0.5 ? 'spike' : 'box';
        obstacles.push({
            x: player.x + canvas.width, // Apparaît juste hors de l'écran à droite
            y: type === 'spike' ? groundLevel - 40 : groundLevel - 50,
            width: type === 'spike' ? 40 : 50,
            height: type === 'spike' ? 40 : 50,
            type: type
        });
        spawnTimer = 0;
    }

    // Gestion des collisions avec les obstacles
    for (let i = obstacles.length - 1; i >= 0; i--) {
        let obs = obstacles[i];

        // Détection de collision AABB standard
        if (player.x < obs.x + obs.width &&
            player.x + player.width > obs.x &&
            player.y < obs.y + obs.height &&
            player.y + player.height > obs.y) {
            
            if (obs.type === 'spike') {
                currentHp -= 20; // Les pics font mal !
            } else {
                currentHp -= 10; // Les caisses font moins mal
            }
            obstacles.splice(i, 1); // Détruit l'obstacle après impact
            
            if (currentHp <= 0) {
                playerStats.coins += Math.floor(score / 5); // Gain de pièces à la mort !
                alert(`Game Over ! Score: ${score}. Vous gagnez ${Math.floor(score / 5)} pièces !`);
                quitGame();
            }
        }

        // Nettoyer les obstacles dépassés pour ne pas faire ramer le jeu
        if (obs.x < camera.x - 100) {
            obstacles.splice(i, 1);
        }
    }

    document.getElementById('hud-score').innerText = score;
    document.getElementById('hud-hp').innerText = currentHp;
}

function drawGame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const groundLevel = canvas.height - 150;

    // Dessiner le sol en prenant en compte le défilement de la caméra
    ctx.fillStyle = '#3c4e6b';
    ctx.fillRect(0, groundLevel, canvas.width, 150);
    
    // Lignes sur le sol pour bien voir l'effet de mouvement
    ctx.fillStyle = '#2b3a52';
    for (let i = 0; i < canvas.width + 200; i += 100) {
        let lineX = i - (camera.x % 100);
        ctx.fillRect(lineX, groundLevel, 5, 150);
    }

    // Dessiner les obstacles (en soustrayant camera.x pour les faire défiler)
    obstacles.forEach(obs => {
        if (obs.type === 'spike') {
            ctx.fillStyle = '#ff3333'; // Pics rouges style Geometry Dash
            ctx.beginPath();
            ctx.moveTo(obs.x - camera.x, obs.y + obs.height);
            ctx.lineTo(obs.x - camera.x + obs.width / 2, obs.y);
            ctx.lineTo(obs.x - camera.x + obs.width, obs.y + obs.height);
            ctx.closePath();
            ctx.fill();
        } else {
            ctx.fillStyle = '#8B4513'; // Caisses en bois marron
            ctx.fillRect(obs.x - camera.x, obs.y, obs.width, obs.height);
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 3;
            ctx.strokeRect(obs.x - camera.x, obs.y, obs.width, obs.height);
        }
    });

    // Dessiner le Brawler (sa position à l'écran dépend de sa position - camera.x)
    ctx.fillStyle = brawlerConfig[playerStats.currentBrawler].color;
    ctx.fillRect(player.x - camera.x, player.y, player.width, player.height);

    // Détail du visage selon la direction
    ctx.fillStyle = '#000';
    ctx.fillRect(player.x - camera.x + 25, player.y + 10, 8, 8);
}
