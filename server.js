const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// On dit à Node.js de rendre public ton dossier contenant le jeu
app.use(express.static(path.join(__dirname, '/')));

// Quand on arrive sur le site, on charge l'index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Le serveur du jeu est lancé sur le port ${PORT}`);
});
