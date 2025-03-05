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
    }

    init(data) {
        this.socket = data.socket;
        this.playerId = data.playerId;
        this.playerName = data.playerName;
        
        // Ajouter le joueur actuel à la Map des joueurs
        this.players.set(this.playerId, {
            name: this.playerName,
            position: { x: 0, y: 0 }
        });
    }

    preload() {
        this.load.image('player', '/player.png');
        this.load.image('wall', '/wall.png');
        this.load.image('door', '/door.png');
        this.load.image('panel', '/panel.png'); // Fond pour le panneau d'énigme
    }

    create() {
        // Point de départ commun pour tous les joueurs
        const startPosition = { 
            x: 100 + (this.playerCount * this.PLAYER_SPACING), 
            y: 800 
        };
        
        // Définir les limites du monde de jeu
        this.physics.world.setBounds(0, 0, 1200, 800); // Ajustez ces valeurs selon la taille de votre canvas (1200, 800)
        
        // Création du joueur avec physics
        this.player = this.physics.add.sprite(
            startPosition.x,
            startPosition.y,
            'player'
        ).setDisplaySize(32, 32);
        
        // Activer les collisions avec les bords du monde pour le joueur
        this.player.setCollideWorldBounds(true);

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

        // Remplacer les colliders existants par un overlap
        this.physics.add.overlap(
            this.player,
            this.doors,
            (player, door) => {
                if (!door.solved) {
                    this.showRiddlePrompt(door);
                }
            },
            null,
            this
        );
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
        });
    }

    createDoors() {
        const doorPositions = [
            { x: 200, y: 300 },
            { x: 400, y: 300 },
            { x: 600, y: 300 },
            { x: 200, y: 500 },
            { x: 400, y: 500 },
            { x: 600, y: 500 },
            { x: 300, y: 400 },
            { x: 500, y: 400 }
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
            const door = this.physics.add.sprite(pos.x, pos.y, 'door-closed')
                .setDisplaySize(64, 96)
                .setImmovable(true);

            door.riddle = doorRiddles[index];
            door.index = index;
            

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

            // Vérifier si toutes les énigmes sont résolues
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
        const collectedClues = this.getCompletedRiddlesCount();
        const totalRiddles = this.doors.filter(door => door.riddle.hasRiddle).length;
        this.cluesText.setText(`Indices collectés: ${collectedClues}/${totalRiddles}\n${clue}`);
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
                    otherPlayer.nameText.setPosition(playerInfo.x, playerInfo.y -20);
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
        .setCollideWorldBounds(true);

        // Ajouter le nom au-dessus du joueur avec un décalage vertical plus important
        const nameText = this.add.text(
            100 + (this.playerCount * this.PLAYER_SPACING),
            800 - 40,  // Augmenté le décalage vertical de -20 à -40
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
        if (this.cursors && this.player) {
            const speed = 4;
            let moved = false;

            // Mouvement du joueur
            if (this.cursors.left.isDown) {
                this.player.setVelocityX(-speed * 60);
                moved = true;
            } else if (this.cursors.right.isDown) {
                this.player.setVelocityX(speed * 60);
                moved = true;
            } else {
                this.player.setVelocityX(0);
            }

            if (this.cursors.up.isDown) {
                this.player.setVelocityY(-speed * 60);
                moved = true;
            } else if (this.cursors.down.isDown) {
                this.player.setVelocityY(speed * 60);
                moved = true;
            } else {
                this.player.setVelocityY(0);
            }

            if (moved) {
                // Émettre la position avec plus d'informations
                this.socket.emit('playerMovement', {
                    x: this.player.x,
                    y: this.player.y,
                    id: this.playerId,
                    name: this.playerName
                });
            }

            // Vérifier si le joueur touche encore une porte
            let touchingAnyDoor = false;
            this.doors.forEach(door => {
                if (this.physics.overlap(this.player, door)) {
                    touchingAnyDoor = true;
                }
            });

            // Cacher le panneau si le joueur ne touche plus aucune porte
            if (!touchingAnyDoor && this.riddlePanel.visible) {
                this.riddlePanel.setVisible(false);
            }
        }
    }
} 