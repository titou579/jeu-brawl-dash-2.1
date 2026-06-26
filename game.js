// ================= CHARGEMENT DES IMAGES =================
const images = {
    shelly: new Image(),
    edgard: new Image(),
    melody: new Image(),
    pic: new Image()
};
images.shelly.src = 'shelly.png.png'; 
images.edgard.src = 'edgard.png';
images.melody.src = 'melody.png';
images.pic.src = 'pic.png';

// ================= STATS ET CONFIGURATION =================
const playerStats = {
    coins: 200,
    currentBrawler: 'Shelly',
    unlockedBrawlers: ['Shelly'],
    upgrades: { speed: 1, dmg: 1 }
};

const brawlerConfig = {
    Shelly: { speed: 4.5, hp: 100, damage: 20, img: images.shelly, range: 450 },
    Edgar: { speed: 6.5, hp: 90, damage: 25, img: images.edgard, range: 250 },
    Melodie: { speed: 5.5, hp: 110, damage: 18, img: images.melody, range: 500 }
};

let gameInterval;
let isPaused = false;
let isPlaying = false;
let score = 0;
let currentHp = 100;
let keys = {};

let obstacles = [];
let bullets = [];
let spawnTimer = 0;
let shootCooldown = 0;
let spawnProtectionTimer = 0; // Sécurité anti-dépop au démarrage

let gameScale = 1;
const BASE_HEIGHT = 600; 

const player = {
    x: 150,
    y: 50, // MODIFIÉ : On le fait apparaître bien haut dans le ciel pour éviter le bug du sol
    width: 65,  
    height: 80,
    vy: 0,
    gravity: 0.6,
    jumpForce: -13,
    isGrounded: false,
    direction: 1
};

const camera = { x: 0 };
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
    // Force l'affichage CSS pour éviter que le navigateur n'écrase ou ne compresse l'image
    canvas.style.width = '100vw';
    canvas.style.height = '100vh';
    
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    // Calcul précis du zoom pour garder les proportions du brawler intactes
    gameScale = canvas.height / BASE_HEIGHT;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// ================= GESTION DES ÉTATS / MENUS =================
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

document.getElementById('current-brawler-display').addEventListener('click', () => {
    if (playerStats.currentBrawler === 'Shelly') playerStats.currentBrawler = 'Edgar';
    else if (playerStats.currentBrawler === 'Edgar') playerStats.currentBrawler = 'Melodie';
    else playerStats.currentBrawler = 'Shelly';
    document.getElementById('current-brawler-display').innerText = playerStats.currentBrawler + " (Clique pour changer)";
});

function updateShopUI() {
    document.getElementById('coin-count').innerText = playerStats.coins;
    document.getElementById('speed-lvl').innerText = playerStats.upgrades.speed;
    document.getElementById('dmg-lvl').innerText = playerStats.upgrades.dmg;
    document.getElementById('unlock-colt').style.display = "none";
}

document.getElementById('buy-speed').addEventListener('click', () => {
    if (playerStats.coins >= 100) { playerStats.coins -= 100; playerStats.upgrades.speed++; updateShopUI(); }
});
document.getElementById('buy-dmg').addEventListener('click', () => {
    if (playerStats.coins >= 150) { playerStats.coins -= 150; playerStats.upgrades.dmg++; updateShopUI(); }
});

// ================= ENTRÉES CLAVIER & TACTILE =================
window.addEventListener('keydown', (e) => keys[e.code] = true);
window.addEventListener('keyup', (e) => keys[e.code] = false);

function bindMobileBtn(id, keyCode) {
    const btn = document.getElementById(id);
    btn.addEventListener('touchstart', (e) => { e.preventDefault(); keys[keyCode] = true; }, { passive: false });
    btn.addEventListener('touchend', (e) => { e.preventDefault(); keys[keyCode] = false; }, { passive: false });
}
bindMobileBtn('btn-m-left', 'ArrowLeft');
bindMobileBtn('btn-m-right', 'ArrowRight');
bindMobileBtn('btn-m-jump', 'Space');
bindMobileBtn('btn-m-shoot', 'KeyF');

// ================= MOTEUR PHYSIQUE =================
function startGame() {
    resizeCanvas(); // Relance le calcul propre des tailles au départ
    isPlaying = true; 
    isPaused = false; 
    score = 0;
    currentHp = brawlerConfig[playerStats.currentBrawler].hp;
    
    // Position de départ sécurisée en l'air
    player.x = 150; 
    player.y = 50; 
    player.vy = 0; 
    player.isGrounded = false;
    player.direction = 1;
    
    obstacles = []; 
    bullets = []; 
    spawnTimer = 0; 
    shootCooldown = 0; 
    camera.x = 0;
    spawnProtectionTimer = 60; // 60 frames (1 seconde) d'invulnérabilité totale au spawn
    
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
    const finalSpeed = currentConfig.speed * (1 + (playerStats.upgrades.speed - 1) * 0.12);

    if (spawnProtectionTimer > 0) spawnProtectionTimer--;

    if (keys['ArrowLeft'] || keys['KeyA']) { player.x -= finalSpeed; player.direction = -1; }
    if (keys['ArrowRight'] || keys['KeyD']) { player.x += finalSpeed; player.direction = 1; }

    if ((keys['Space'] || keys['KeyW'] || keys['ArrowUp']) && player.isGrounded) {
        player.vy = player.jumpForce; player.isGrounded = false;
    }

    player.vy += player.gravity; player.y += player.vy;
    
    const groundLevel = BASE_HEIGHT - 120;
    if (player.y + player.height >= groundLevel) {
        player.y = groundLevel - player.height;
        player.vy = 0;
        player.isGrounded = true;
    }
    if (player.x < 0) player.x = 0;

    if (Math.floor(player.x / 15) > score) { score = Math.floor(player.x / 15); }

    const virtualWidth = canvas.width / gameScale;
    camera.x = player.x - virtualWidth / 2 + player.width / 2;
    if (camera.x < 0) camera.x = 0;

    // Tir
    if (shootCooldown > 0) shootCooldown--;
    if (keys['KeyF'] && shootCooldown === 0) {
        const dmgMultiplier = 1 + (playerStats.upgrades.dmg - 1) * 0.2;
        let bulletSpawnX = player.direction === 1 ? player.x + player.width + 15 : player.x - 25;
        
        bullets.push({
            x: bulletSpawnX,
            y: player.y + player.height / 2 - 2,
            width: 20, height: 10,
            speed: 15 * player.direction,
            damage: currentConfig.damage * dmgMultiplier,
            startX: player.x,
            range: currentConfig.range
        });
        shootCooldown = 18;
    }

    for (let i = bullets.length - 1; i >= 0; i--) {
        let b = bullets[i]; b.x += b.speed;
        if (Math.abs(b.x - b.startX) > b.range || b.x < camera.x || b.x > camera.x + virtualWidth) { bullets.splice(i, 1); }
    }

    // Obstacles
    spawnTimer++;
    if (spawnTimer > 90) {
        let type = Math.random() > 0.4 ? 'spike' : 'box';
        obstacles.push({
            x: player.x + virtualWidth,
            y: type === 'spike' ? groundLevel - 55 : groundLevel - 75,
            width: type === 'spike' ? 55 : 65,
            height: type === 'spike' ? 55 : 75,
            type: type,
            hp: type === 'box' ? 40 : 1
        });
        spawnTimer = 0;
    }

    // Balles VS Obstacles
    for (let i = bullets.length - 1; i >= 0; i--) {
        for (let j = obstacles.length - 1; j >= 0; j--) {
            let b = bullets[i]; let o = obstacles[j];
            if (b && o && o.type === 'box' && b.x < o.x + o.width && b.x + b.width > o.x && b.y < o.y + o.height && b.y + b.height > o.y) {
                o.hp -= b.damage;
                bullets.splice(i, 1);
                if (o.hp <= 0) { obstacles.splice(j, 1); playerStats.coins += 8; }
            }
        }
    }

    // Joueur VS Obstacles (Bloqué si la protection est active)
    if (spawnProtectionTimer === 0) {
        for (let i = obstacles.length - 1; i >= 0; i--) {
            let obs = obstacles[i];
            
            if (player.x < obs.x + obs.width && 
                player.x + player.width > obs.x && 
                player.y < obs.y + obs.height && 
                player.y + player.height > obs.y) {
                
                currentHp -= obs.type === 'spike' ? 30 : 15;
                obstacles.splice(i, 1);
                
                if (currentHp <= 0) {
                    currentHp = 0;
                    let reward = Math.floor(score / 3);
                    playerStats.coins += reward;
                    alert(`Game Over ! Score : ${score}. Tu as récolté ${reward} 🪙`);
                    quitGame();
                }
            }
        }
    }

    document.getElementById('hud-score').innerText = score;
    document.getElementById('hud-hp').innerText = currentHp;
}

// ================= RENDU VISUEL =================
function drawGame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ctx.save();
    ctx.scale(gameScale, gameScale);
    
    const groundLevel = BASE_HEIGHT - 120;
    const virtualWidth = canvas.width / gameScale;

    // Sol
    ctx.fillStyle = '#223147'; ctx.fillRect(0, groundLevel, virtualWidth, 120);
    ctx.fillStyle = '#1b2636';
    for (let i = 0; i < virtualWidth + 200; i += 100) { ctx.fillRect(i - (camera.x % 100), groundLevel, 8, 120); }

    // Balles
    ctx.fillStyle = '#00FFFF';
    bullets.forEach(b => ctx.fillRect(b.x - camera.x, b.y, b.width, b.height));

    // Obstacles
    obstacles.forEach(obs => {
        if (obs.type === 'spike') {
            ctx.drawImage(images.pic, obs.x - camera.x, obs.y, obs.width, obs.height);
        } else {
            ctx.fillStyle = '#cd853f'; ctx.fillRect(obs.x - camera.x, obs.y, obs.width, obs.height);
            ctx.strokeStyle = '#5c3a21'; ctx.lineWidth = 4; ctx.strokeRect(obs.x - camera.x, obs.y, obs.width, obs.height);
            ctx.fillStyle = '#fff'; ctx.font = 'bold 12px Arial';
            ctx.fillText(Math.max(0, obs.hp) + ' HP', obs.x - camera.x + 10, obs.y - 8);
        }
    });

    // Dessin du Brawler
    const currentBrawlerImg = brawlerConfig[playerStats.currentBrawler].img;
    
    ctx.save();
    // Petit effet de clignotement si le bouclier de départ est actif
    if (spawnProtectionTimer > 0 && Math.floor(spawnProtectionTimer / 4) % 2 === 0) {
        ctx.globalAlpha = 0.4;
    }
    
    if (player.direction === -1) {
        ctx.translate(player.x - camera.x + player.width, player.y);
        ctx.scale(-1, 1);
        ctx.drawImage(currentBrawlerImg, 0, 0, player.width, player.height);
    } else {
        ctx.drawImage(currentBrawlerImg, player.x - camera.x, player.y, player.width, player.height);
    }
    ctx.restore();

    ctx.restore(); 
}
