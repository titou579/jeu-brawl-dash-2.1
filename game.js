// ================= CHARGEMENT DES IMAGES =================
const images = {
    shelly: new Image(),
    edgard: new Image(),
    melody: new Image(),
    pic: new Image()
};
// Prise en compte de ta petite correction pour le double .png !
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

// Variables pour gérer le zoom universel
let gameScale = 1;
const BASE_HEIGHT = 600; // Hauteur virtuelle de référence (style console rétro)

// Dimensions de base augmentées pour les visuels
const player = {
    x: 100,
    y: 200,
    width: 60,  
    height: 75,
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
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    // On calcule le zoom nécessaire pour que le jeu ne soit plus minuscule
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
document.getElementById('current-brawler-display').innerText = "Shelly (Clique pour changer)";

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
window.addEventListener('keydown', (e) => { if (e.code === 'Escape' && isPlaying) togglePause(); });

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
    isPlaying = true; isPaused = false; score = 0;
    currentHp = brawlerConfig[playerStats.currentBrawler].hp;
    player.x = 100; player.y = 100; player.vy = 0; player.direction = 1;
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
    const finalSpeed = currentConfig.speed * (1 + (playerStats.upgrades.speed - 1) * 0.12);

    // Contrôles de déplacement
    if (keys['ArrowLeft'] || keys['KeyA']) { player.x -= finalSpeed; player.direction = -1; }
    if (keys['ArrowRight'] || keys['KeyD']) { player.x += finalSpeed; player.direction = 1; }

    // Saut
    if ((keys['Space'] || keys['KeyW'] || keys['ArrowUp']) && player.isGrounded) {
        player.vy = player.jumpForce; player.isGrounded = false;
    }

    player.vy += player.gravity; player.y += player.vy;
    
    // Hauteur du sol calée sur notre hauteur virtuelle fixe
    const groundLevel = BASE_HEIGHT - 120;
    if (player.y + player.height >= groundLevel) {
        player.y = groundLevel - player.height;
        player.vy = 0;
        player.isGrounded = true;
    }
    if (player.x < 0) player.x = 0;

    if (Math.floor(player.x / 15) > score) { score = Math.floor(player.x / 15); }

    // Caméra centrée basée sur la largeur de l'écran convertie à l'échelle zoomée
    const virtualWidth = canvas.width / gameScale;
    camera.x = player.x - virtualWidth / 2 + player.width / 2;
    if (camera.x < 0) camera.x = 0;

    // --- TIR (CORRIGÉ POUR APPARAÎTRE EN DEHORS DE LA HITBOX) ---
    if (shootCooldown > 0) shootCooldown--;
    if (keys['KeyF'] && shootCooldown === 0) {
        const dmgMultiplier = 1 + (playerStats.upgrades.dmg - 1) * 0.2;
        // On décale le point de départ de la balle pour qu'elle sorte bien du pistolet sans toucher le brawler
        let bulletSpawnX = player.direction === 1 ? player.x + player.width + 10 : player.x - 20;
        
        bullets.push({
            x: bulletSpawnX,
            y: player.y + player.height / 2 - 2,
            width: 16, height: 8,
            speed: 14 * player.direction,
            damage: currentConfig.damage * dmgMultiplier,
            startX: player.x,
            range: currentConfig.range
        });
        shootCooldown = 20;
    }

    for (let i = bullets.length - 1; i >= 0; i--) {
        let b = bullets[i]; b.x += b.speed;
        if (Math.abs(b.x - b.startX) > b.range || b.x < camera.x || b.x > camera.x + virtualWidth) { bullets.splice(i, 1); }
    }

    // --- POP DES ENNEMIS ET OBSTACLES ---
    spawnTimer++;
    if (spawnTimer > 85) {
        let type = Math.random() > 0.4 ? 'spike' : 'box';
        obstacles.push({
            x: player.x + virtualWidth,
            y: type === 'spike' ? groundLevel - 50 : groundLevel - 70,
            width: type === 'spike' ? 50 : 60,
            height: type === 'spike' ? 50 : 70,
            type: type,
            hp: type === 'box' ? 40 : 1
        });
        spawnTimer = 0;
    }

    // Balles contre Obstacles
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

    // Joueur contre Obstacles (Hitbox renforcée à 100% de fiabilité)
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

    document.getElementById('hud-score').innerText = score;
    document.getElementById('hud-hp').innerText = currentHp;
}

// ================= SYSTÈME DE RENDU (AFFICHAGE) =================
function drawGame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ctx.save();
    // LE TRUC MAGIQUE : On applique le zoom global sur tout ce qu'on dessine en jeu
    ctx.scale(gameScale, gameScale);
    
    const groundLevel = BASE_HEIGHT - 120;
    const virtualWidth = canvas.width / gameScale;

    // Décor Sol
    ctx.fillStyle = '#223147'; ctx.fillRect(0, groundLevel, virtualWidth, 120);
    ctx.fillStyle = '#1b2636';
    for (let i = 0; i < virtualWidth + 200; i += 100) { ctx.fillRect(i - (camera.x % 100), groundLevel, 8, 120); }

    // Balles
    ctx.fillStyle = '#00FFFF';
    bullets.forEach(b => ctx.fillRect(b.x - camera.x, b.y, b.width, b.height));

    // Obstacles (Images zoomées automatiquement)
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
    if (player.direction === -1) {
        ctx.translate(player.x - camera.x + player.width, player.y);
        ctx.scale(-1, 1);
        ctx.drawImage(currentBrawlerImg, 0, 0, player.width, player.height);
    } else {
        ctx.drawImage(currentBrawlerImg, player.x - camera.x, player.y, player.width, player.height);
    }
    ctx.restore();

    // Arme visuelle
    ctx.fillStyle = '#111';
    if (player.direction === 1) {
        ctx.fillRect(player.x - camera.x + player.width - 5, player.y + player.height / 2 + 5, 20, 10);
    } else {
        ctx.fillRect(player.x - camera.x - 15, player.y + player.height / 2 + 5, 20, 10);
    }

    ctx.restore(); // On réinitialise l'échelle pour ne pas casser le reste
}
