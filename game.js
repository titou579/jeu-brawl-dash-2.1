// ================= CHARGEMENT DES IMAGES =================
const images = {
    shelly: new Image(),
    edgard: new Image(),
    melody: new Image(),
    pic: new Image()
};
images.shelly.src = 'shelly.png.png'; 
images.edgard.src = 'edgard.png.png';
images.melody.src = 'melody.png.png';
images.pic.src = 'pic.png.png';

// ================= STATS ET CONFIGURATION =================
const playerStats = {
    coins: 200,
    currentBrawler: 'Shelly',
    unlockedBrawlers: ['Shelly'],
    upgrades: { speed: 1, dmg: 1 }
};

const brawlerConfig = {
    Shelly: { speed: 5, hp: 100, damage: 20, img: images.shelly, range: 450 },
    Edgar: { speed: 7, hp: 90, damage: 25, img: images.edgard, range: 250 },
    Melodie: { speed: 6, hp: 110, damage: 18, img: images.melody, range: 500 }
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
let spawnProtectionTimer = 0; 

// Dimensions fixes du brawler en pixels réels (assez grandes pour être bien visibles)
const player = {
    x: 150,
    y: 100,
    width: 70,  
    height: 90,
    vy: 0,
    gravity: 0.6,
    jumpForce: -14,
    isGrounded: false,
    direction: 1
};

const camera = { x: 0 };
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
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
    resizeCanvas(); 
    isPlaying = true; 
    isPaused = false; 
    score = 0;
    currentHp = brawlerConfig[playerStats.currentBrawler].hp;
    
    // Position de départ sécurisée au-dessus du sol réel
    player.x = 150; 
    player.y = canvas.height - 300; 
    player.vy = 0; 
    player.isGrounded = false;
    player.direction = 1;
    
    obstacles = []; 
    bullets = []; 
    spawnTimer = 0; 
    shootCooldown = 0; 
    camera.x = 0;
    spawnProtectionTimer = 50; // Courte immunité visuelle
    
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

    // Mouvements
    if (keys['ArrowLeft'] || keys['KeyA']) { player.x -= finalSpeed; player.direction = -1; }
    if (keys['ArrowRight'] || keys['KeyD']) { player.x += finalSpeed; player.direction = 1; }

    // Saut
    if ((keys['Space'] || keys['KeyW'] || keys['ArrowUp']) && player.isGrounded) {
        player.vy = player.jumpForce; player.isGrounded = false;
    }

    // Application Gravité brute
    player.vy += player.gravity; 
    player.y += player.vy;
    
    // Sol calé sur le bas réel de l'écran de l'appareil
    const groundLevel = canvas.height - 150;
    if (player.y + player.height >= groundLevel) {
        player.y = groundLevel - player.height;
        player.vy = 0;
        player.isGrounded = true;
    }
    if (player.x < 0) player.x = 0;

    // Score
    if (Math.floor(player.x / 15) > score) { score = Math.floor(player.x / 15); }

    // Caméra centrée réelle
    camera.x = player.x - canvas.width / 2 + player.width / 2;
    if (camera.x < 0) camera.x = 0;

    // Logic de Tir
    if (shootCooldown > 0) shootCooldown--;
    if (keys['KeyF'] && shootCooldown === 0) {
        const dmgMultiplier = 1 + (playerStats.upgrades.dmg - 1) * 0.2;
        let bulletSpawnX = player.direction === 1 ? player.x + player.width + 10 : player.x - 20;
        
        bullets.push({
            x: bulletSpawnX,
            y: player.y + player.height / 2,
            width: 20, height: 8,
            speed: 16 * player.direction,
            damage: currentConfig.damage * dmgMultiplier,
            startX: player.x,
            range: currentConfig.range
        });
        shootCooldown = 18;
    }

    for (let i = bullets.length - 1; i >= 0; i--) {
        let b = bullets[i]; b.x += b.speed;
        if (Math.abs(b.x - b.startX) > b.range || b.x < camera.x || b.x > camera.x + canvas.width) { bullets.splice(i, 1); }
    }

    // Génération obstacles (adaptés aux tailles réelles)
    spawnTimer++;
    if (spawnTimer > 85) {
        let type = Math.random() > 0.4 ? 'spike' : 'box';
        obstacles.push({
            x: player.x + canvas.width,
            y: type === 'spike' ? groundLevel - 60 : groundLevel - 80,
            width: type === 'spike' ? 60 : 70,
            height: type === 'spike' ? 60 : 80,
            type: type,
            hp: type === 'box' ? 40 : 1
        });
        spawnTimer = 0;
    }

    // Balles VS Caisses
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

    // Collisions mortelles (Uniquement hors protection)
    if (spawnProtectionTimer === 0) {
        for (let i = obstacles.length - 1; i >= 0; i--) {
            let obs = obstacles[i];
            
            if (player.x < obs.x + obs.width && 
                player.x + player.width > obs.x && 
                player.y < obs.y + obs.height && 
                player.y + player.height > obs.y) {
                
                currentHp -= obs.type === 'spike' ? 35 : 20;
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

// ================= RENDU VISUEL SANS CANVAS-SCALE =================
function drawGame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const groundLevel = canvas.height - 150;

    // Dessin du Sol
    ctx.fillStyle = '#223147'; ctx.fillRect(0, groundLevel, canvas.width, 150);
    ctx.fillStyle = '#1b2636';
    for (let i = 0; i < canvas.width + 200; i += 120) { ctx.fillRect(i - (camera.x % 120), groundLevel, 8, 150); }

    // Dessin des Balles
    ctx.fillStyle = '#00FFFF';
    bullets.forEach(b => ctx.fillRect(b.x - camera.x, b.y, b.width, b.height));

    // Dessin des Obstacles (Tailles réelles)
    obstacles.forEach(obs => {
        if (obs.type === 'spike') {
            ctx.drawImage(images.pic, obs.x - camera.x, obs.y, obs.width, obs.height);
        } else {
            ctx.fillStyle = '#cd853f'; ctx.fillRect(obs.x - camera.x, obs.y, obs.width, obs.height);
            ctx.strokeStyle = '#5c3a21'; ctx.lineWidth = 4; ctx.strokeRect(obs.x - camera.x, obs.y, obs.width, obs.height);
            ctx.fillStyle = '#fff'; ctx.font = 'bold 13px Arial';
            ctx.fillText(Math.max(0, obs.hp) + ' HP', obs.x - camera.x + 12, obs.y - 10);
        }
    });

    // Dessin du Brawler
    const currentBrawlerImg = brawlerConfig[playerStats.currentBrawler].img;
    
    ctx.save();
    // Clignotement léger au spawn
    if (spawnProtectionTimer > 0 && Math.floor(spawnProtectionTimer / 4) % 2 === 0) {
        ctx.globalAlpha = 0.5;
    }
    
    if (player.direction === -1) {
        ctx.translate(player.x - camera.x + player.width, player.y);
        ctx.scale(-1, 1);
        ctx.drawImage(currentBrawlerImg, 0, 0, player.width, player.height);
    } else {
        ctx.drawImage(currentBrawlerImg, player.x - camera.x, player.y, player.width, player.height);
    }
    ctx.restore();
}
