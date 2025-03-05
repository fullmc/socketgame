import Phaser from 'phaser';

export default class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        this.players = new Map();
        this.doors = [];
        this.currentLevel = 0;
        this.riddlePanel = null;
        this.otherPlayers = new Map(); // Pour stocker les sprites des autres joueurs
        this.playerCount = 0; // Compteur pour gérer le positionnement
        this.PLAYER_SPACING = 40; // Espacement entre les joueurs
        this.finalRiddle = {
            question: "Énigme finale: Je suis ce que je suis, mais je ne suis pas ce que je suis. Si j'étais ce que je suis, je ne serais pas ce que je suis. Que suis-je?",
            answer: "ombre",
            solved: false
        };
        this.canMove = true;
        // this.playerColors = [0xff0000, 0x0000ff, 0xff00ff, 0x006400];
    }

    init(data) {
        this.socket = data.socket;
        this.playerId = data.playerId;
        this.playerName = data.playerName;
        
        // Ne pas définir de couleur ici, attendre la réponse du serveur
        this.players.set(this.playerId, {
            name: this.playerName,
            position: { x: 0, y: 0 }
        });

        // Envoyer uniquement l'ID et le nom
        this.socket.emit('playerJoined', {
            id: this.playerId,
            name: this.playerName
        });
    }

    preload() {
        this.load.image('player', '/player.png');
        this.load.image('wall', '/wall.png');
        this.load.image('door', '/door.png');
        this.load.image('panel', '/panel.png'); // Fond pour le panneau d'énigme
        this.load.image('brickWall', '/brickWall.png'); // Ajoutez cette ligne
    }

    create() {
        this.background = this.add.tileSprite(0, 0, 1200, 800, 'brickWall')
            .setOrigin(0, 0)
            .setDepth(-1); // Pour s'assurer que le background est derrière tous les autres éléments

        // Point de départ commun pour tous les joueurs
        const startPosition = { 
            x: 100 + (this.playerCount * this.PLAYER_SPACING), 
            y: 800 
        };
        
        // Définir les limites du monde de jeu
        this.physics.world.setBounds(0, 0, 1200, 800); // Ajustez ces valeurs selon la taille de votre canvas (1200, 800)        
        // Création du conteneur du joueur avec une taille spécifique
        this.playerContainer = this.add.container(startPosition.x, startPosition.y);
        
        // Création du sprite du joueur au centre du conteneur
        this.player = this.physics.add.sprite(0, 0, 'player')
            .setDisplaySize(32, 32);
        
        // Ajouter les pupilles statiques
        const pupilSize = 1.8;
        const pupilOffsetX = 4;
        const pupilOffsetY = -2;
        
        const leftPupil = this.add.circle(-pupilOffsetX, pupilOffsetY, pupilSize, 0x000000);
        const rightPupil = this.add.circle(pupilOffsetX, pupilOffsetY, pupilSize, 0x000000);
        
        // Ajouter le sprite et les pupilles au conteneur
        this.playerContainer.add([this.player, leftPupil, rightPupil]);
        
        // Activer la physique sur le conteneur avec une hitbox spécifique
        this.physics.world.enable(this.playerContainer);
        this.playerContainer.body.setSize(32, 32); // Définir la taille de la hitbox
        this.playerContainer.body.setOffset(-16, -16); // Centrer la hitbox
        this.playerContainer.body.setCollideWorldBounds(true);
        
        // Création du joueur avec physics
        this.player = this.physics.add.sprite(
            startPosition.x,
            startPosition.y,
            'player'
        ).setDisplaySize(32, 32);
        // Activer les collisions avec les bords du monde pour le joueur
        this.player.setCollideWorldBounds(true);
        // Colorer le joueur principal
        this.socket.on('playerColor', (data) => {
            if (data.playerId === this.playerId) {
                this.player.setTint(data.color);
                this.players.get(this.playerId).color = data.color;
            }
        });
        // Création des trois portes
        this.createDoors();
        
        // Affichage de l'énigme principale
        this.mainRiddle = this.add.text(400, 50, 'Collectez tous les indices !', {
            fontSize: '24px',
            fill: '#fff'
        }).setOrigin(0.5);

        // Zone de texte pour les indices collectés
        this.cluesText = this.add.text(400, 100, 'Indices collectés: 0/3', {
            fontSize: '18px',
            fill: '#ffff00'
        }).setOrigin(0.5);

        this.createRiddlePanel();
        this.setupSocketListeners();
        this.cursors = this.input.keyboard.createCursorKeys();

        // Ajouter ces nouveaux écouteurs d'événements socket
        this.setupMultiplayerListeners();
        this.canMove = true;
    }

    createRiddlePanel() {
        // Créer un panneau d'énigme caché par défaut
        this.riddlePanel = this.add.container(400, 300).setVisible(false);

        // Fond du panneau
        const background = this.add.rectangle(0, 0, 400, 300, 0x000000, 0.8);
        
        // Texte de l'énigme
        this.riddleText = this.add.text(0, -100, '', {
            fontSize: '20px',
            fill: '#ffffff',
            align: 'center',
            wordWrap: { width: 350 }
        }).setOrigin(0.5);

        // Champ de réponse
        this.answerInput = this.add.text(0, 0, 'Cliquez pour répondre', {
            fontSize: '16px',
            fill: '#ffffff',
            backgroundColor: '#333333',
            padding: { x: 10, y: 5 }
        }).setOrigin(0.5).setInteractive();

        // Bouton de validation
        const submitButton = this.add.text(0, 50, 'Valider', {
            fontSize: '16px',
            fill: '#ffffff',
            backgroundColor: '#4CAF50',
            padding: { x: 20, y: 10 }
        }).setOrigin(0.5).setInteractive();

        // Bouton de fermeture
        const closeButton = this.add.text(180, -130, 'X', {
            fontSize: '20px',
            fill: '#ffffff'
        }).setOrigin(0.5).setInteractive();

        this.riddlePanel.add([background, this.riddleText, this.answerInput, submitButton, closeButton]);

        // Gestionnaires d'événements
        this.answerInput.on('pointerdown', () => {
            // Utiliser un prompt temporairement - à remplacer par une vraie zone de texte
            const answer = prompt('Votre réponse:');
            if (answer) this.answerInput.setText(answer);
        });

        submitButton.on('pointerdown', () => {
            this.checkAnswer(this.currentDoor, this.answerInput.text);
        });

        closeButton.on('pointerdown', () => {
            this.riddlePanel.setVisible(false);
            this.canMove = true;
        });
    }

    createDoors() {
        const doorPositions = [
            { x: 200, y: 200 },
            { x: 600, y: 200 },
            { x: 1000, y: 200 },
            { x: 200, y: 400 },
            { x: 600, y: 400 },
            { x: 1000, y: 400 },
            { x: 400, y: 600 },
            { x: 800, y: 600 }        
        ];

        const doorRiddles = [
            { question: "Je suis grand quand je suis jeune et petit quand je suis vieux. Que suis-je?", 
              answer: "bougie", 
              clue: "Dans l'obscurité, je guide...",
              hasRiddle: true },
            { question: "Plus j'ai de gardiens, moins je suis en sécurité. Qui suis-je?", 
              answer: "secret", 
              clue: "Ce qui est caché...",
              hasRiddle: true },
            { question: "Je parle sans bouche et j'entends sans oreilles. Qui suis-je?", 
              answer: "echo", 
              clue: "Réflexion sonore...",
              hasRiddle: true },
            { question: "Pas de devinette ici, cherchez ailleurs !",
              hasRiddle: false },
            { question: "Cette porte est vide, continuez votre recherche !",
              hasRiddle: false },
            { question: "Plus je suis chaud, plus je suis frais. Que suis-je?",
              answer: "pain",
              clue: "Nourriture quotidienne...",
              hasRiddle: true },
            { question: "Rien à voir ici, poursuivez votre quête !",
              hasRiddle: false },
            { question: "Je monte et descends sans bouger. Que suis-je?",
              answer: "escalier",
              clue: "Le chemin vertical...",
              hasRiddle: true }
        ];

        // Mélanger aléatoirement les énigmes
        this.shuffleArray(doorRiddles);

        doorPositions.forEach((pos, index) => {
            const door = this.physics.add.sprite(pos.x, pos.y, 'door')
                .setDisplaySize(64, 96)
                .setImmovable(true);

            door.riddle = doorRiddles[index];
            door.index = index;

            // Ajouter un gestionnaire de collision et de chevauchement
            this.physics.add.collider(this.playerContainer, door, () => {
                if (!door.solved) {
                    this.showRiddlePrompt(door);
                }
            }, null, this);

            // Ajouter un événement quand le joueur n'est plus en collision
            door.on('overlapend', () => {
                if (this.riddlePanel && this.currentDoor === door) {
                    this.riddlePanel.setVisible(false);
                    this.canMove = true;
                }
            });

            this.doors.push(door);
        });
    }
    
       // Ajouter cette nouvelle méthode pour mélanger le tableau des énigmes
       shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    showRiddlePrompt(door) {
        this.currentDoor = door;
        this.riddleText.setText(door.riddle.question);
        this.answerInput.setText('Cliquez pour répondre');
        this.riddlePanel.setVisible(true);
        this.playerContainer.body.setVelocity(0);
        this.canMove = false;
    }

    checkAnswer(door, answer) {
        if (!door.riddle.hasRiddle) {
            this.riddlePanel.setVisible(false);
            return;
        }

        if (answer.toLowerCase() === door.riddle.answer) {
            door.solved = true;
            this.collectClue(door.riddle.clue);
            
            // Émettre la progression au serveur
            this.socket.emit('levelComplete', {
                level: this.getCompletedRiddlesCount(),
                playerId: this.playerId,
                clue: door.riddle.clue
            });

            this.riddlePanel.setVisible(false);

            // Vérifier si toutes les portes sont résolues
            if (this.allRiddlesSolved()) {
                this.showFinalRiddle();
            }
        } else {
            this.answerInput.setText('Mauvaise réponse, essayez encore');
        }
    }
        // Ajouter cette nouvelle méthode pour compter les énigmes résolues
        getCompletedRiddlesCount() {
            return this.doors.filter(door => door.solved && door.riddle.hasRiddle).length;
        }
    
        // Ajouter cette nouvelle méthode pour vérifier si toutes les énigmes sont résolues
        allRiddlesSolved() {
            const totalRiddles = this.doors.filter(door => door.riddle.hasRiddle).length;
            return this.getCompletedRiddlesCount() === totalRiddles;
        }

    collectClue(clue) {
        const collectedClues = this.currentLevel;
        const totalRiddles = this.doors.filter(door => door.riddle.hasRiddle).length;
        this.cluesText.setText(`Indices collectés: ${collectedClues}\n${clue}`);
    }

    showFinalRiddle() {
        this.riddleText.setText(this.finalRiddle.question);
        this.answerInput.setText('Cliquez pour répondre');
        this.riddlePanel.setVisible(true);
    }

    setupSocketListeners() {
        this.socket.on('playerMoved', (playerInfo) => {
            if (playerInfo.id !== this.playerId) {
                // Mettre à jour la position des autres joueurs
                const otherPlayer = this.players.get(playerInfo.id);
                if (otherPlayer) {
                    otherPlayer.x = playerInfo.x;
                    otherPlayer.y = playerInfo.y;
                }
            }
        });

        this.socket.on('playerProgress', (data) => {
            if (data.playerId !== this.playerId) {
                // Mettre à jour visuellement la progression des autres joueurs
                const otherPlayer = this.players.get(data.playerId);
                if (otherPlayer) {
                    otherPlayer.level = data.level;
                    // Ajouter un effet visuel pour montrer la progression
                    this.add.text(otherPlayer.x, otherPlayer.y - 20, 
                        `Niveau ${data.level} complété!`, {
                            fontSize: '14px',
                            fill: '#00ff00'
                        }).setOrigin(0.5);
                }
            }
        });
    }

    setupMultiplayerListeners() {
        // Quand un nouveau joueur rejoint
        this.socket.on('newPlayer', (playerInfo) => {
            if (playerInfo.id !== this.playerId) {
                this.addOtherPlayer(playerInfo);
            }
        });

        // Quand un joueur quitte
        this.socket.on('playerDisconnected', (playerId) => {
            if (this.otherPlayers.has(playerId)) {
                this.otherPlayers.get(playerId).destroy();
                this.otherPlayers.delete(playerId);
            }
        });

        // Mise à jour de la position des autres joueurs
        this.socket.on('playerMoved', (playerInfo) => {
            if (playerInfo.id !== this.playerId) {
                const otherPlayer = this.otherPlayers.get(playerInfo.id);
                if (otherPlayer) {
                    otherPlayer.setPosition(playerInfo.x, playerInfo.y);
                    
                    // Ajouter ou mettre à jour le nom du joueur
                    if (!otherPlayer.nameText) {
                        otherPlayer.nameText = this.add.text(0, -20, playerInfo.name, {
                            fontSize: '14px',
                            fill: '#ffffff'
                        }).setOrigin(0.5);
                    }
                    otherPlayer.nameText.setPosition(playerInfo.x, playerInfo.y - 20);
                }
            }
        });

        // Demander la liste des joueurs existants
        this.socket.emit('getExistingPlayers');
        
        // Recevoir la liste des joueurs existants
        this.socket.on('existingPlayers', (players) => {
            players.forEach(playerInfo => {
                if (playerInfo.id !== this.playerId) {
                    this.addOtherPlayer(playerInfo);
                }
            });
        });
    }

    addOtherPlayer(playerInfo) {
        this.playerCount++;
        const otherPlayer = this.physics.add.sprite(
            100 + (this.playerCount * this.PLAYER_SPACING),
            800,
            'player'
        ).setDisplaySize(32, 32)
        .setCollideWorldBounds(true)
        // Utiliser la couleur reçue du joueur
        .setTint(playerInfo.color);
        
        // Ajouter le nom au-dessus du joueur
        const nameText = this.add.text(
            100 + (this.playerCount * this.PLAYER_SPACING),
            800 - 40, 
            playerInfo.name,
            {
                fontSize: '14px',
                fill: '#ffffff'
            }
        ).setOrigin(0.5);

        otherPlayer.nameText = nameText;
        this.otherPlayers.set(playerInfo.id, otherPlayer);
    }

    update() {
        if (this.cursors && this.playerContainer && this.canMove) {
            const speed = 4;
            let moved = false;

            // Mouvement du conteneur du joueur
            if (this.cursors.left.isDown) {
                this.playerContainer.body.setVelocityX(-speed * 60);
                moved = true;
            } else if (this.cursors.right.isDown) {
                this.playerContainer.body.setVelocityX(speed * 60);
                moved = true;
            } else {
                this.playerContainer.body.setVelocityX(0);
            }

            if (this.cursors.up.isDown) {
                this.playerContainer.body.setVelocityY(-speed * 60);
                moved = true;
            } else if (this.cursors.down.isDown) {
                this.playerContainer.body.setVelocityY(speed * 60);
                moved = true;
            } else {
                this.playerContainer.body.setVelocityY(0);
            }

            if (moved) {
                this.socket.emit('playerMovement', {
                    x: this.playerContainer.x,
                    y: this.playerContainer.y,
                    id: this.playerId,
                    name: this.playerName
                });
            }
        }
    }
} 