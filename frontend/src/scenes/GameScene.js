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
        this.load.image('player', 'player.png');
        this.load.image('wall', 'wall.png');
        this.load.image('door', 'door.png');
        this.load.image('panel', 'panel.png');
        this.load.image('brickWall', 'brickWall.png');
    }

    create() {
        this.background = this.add.tileSprite(0, 0, 1200, 800, 'brickWall')
            .setOrigin(0, 0)
            .setDepth(-1); // Pour s'assurer que le background est derrière tous les autres éléments

        // Ajuster la taille du monde de jeu
        this.physics.world.setBounds(0, 0, 800, 600);  // Mettre à jour les limites du monde

        // Ajuster la position de départ des joueurs
        const startPosition = { 
            x: 100 + (this.playerCount * this.PLAYER_SPACING), 
            y: 550  // Position plus haute pour être visible dans l'écran plus petit
        };
        
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

    

        this.createRiddlePanel();
        this.setupSocketListeners();
        this.cursors = this.input.keyboard.createCursorKeys();

        // Ajouter ces nouveaux écouteurs d'événements socket
        this.setupMultiplayerListeners();
        this.canMove = true;

        // Ajouter un conteneur pour les indices
        this.cluesContainer = this.add.container(10, 10);
        this.cluesText = this.add.text(0, 0, 'Indices collectés: 0', {
            fontSize: '18px',
            color: '#ffffff'
        }).setDepth(90);
        this.cluesList = this.add.text(0, 30, '', {
            fontSize: '16px',
            color: '#ffffff',
            wordWrap: { width: 200 }
        }).setDepth(90);
        
        this.cluesContainer.add([this.cluesText, this.cluesList]);
        this.collectedClues = [];

        // Ajouter l'écouteur d'événement pour la mise à jour des indices
        this.socket.on('playerClueUpdate', (data) => {
            if (data.playerId === this.socket.id) {
                this.collectedClues = data.allClues || [];
                this.updateCluesDisplay();
            }
            
            if (data.playerId !== this.socket.id) {
                const player = this.otherPlayers.get(data.playerId);
                if (player && player.playerName) {
                    this.showTemporaryMessage(`${player.playerName} a trouvé un indice !`);
                }
            }
        });

        // Ajuster la profondeur des joueurs
        this.playerContainer.setDepth(1);  // Les joueurs auront une profondeur de 1

        // Ajouter l'écouteur pour la fin du jeu
        this.socket.on('gameComplete', (data) => {
            const winner = this.players.get(data.winner);
            const winnerName = winner ? winner.name : 'Un joueur';
            
            // Créer un panneau de victoire
            const victoryPanel = this.add.container(400, 300)
                .setDepth(2000);

            const background = this.add.rectangle(0, 0, 600, 300, 0x333333, 0.95);
            
            const victoryText = this.add.text(0, -80, 
                `${winnerName} a résolu l'énigme finale !`, 
                { 
                    fontSize: '24px',
                    fill: '#ffffff',
                    align: 'center'
                }
            ).setOrigin(0.5);

            const restartText = this.add.text(0, 50, 'Retour à l\'accueil', {
                fontSize: '20px',
                fill: '#ffffff',
                backgroundColor: '#4CAF50',
                padding: { x: 30, y: 15 }
            })
            .setOrigin(0.5)
            .setInteractive();

            restartText.on('pointerdown', () => {
                this.socket.emit('restartGame');
                window.location.reload();
            });

            victoryPanel.add([background, victoryText, restartText]);
        });

        // Ajouter l'écouteur pour le redémarrage
        this.socket.on('gameRestarted', () => {
            // Réinitialiser l'état du jeu
            this.collectedClues = [];
            this.updateCluesDisplay();
            
            // Réinitialiser les portes
            this.doors.forEach(door => {
                door.solved = false;
            });
            
            // Cacher tous les panneaux
            if (this.riddlePanel) this.riddlePanel.setVisible(false);
            
            // Replacer le joueur à sa position initiale
            this.playerContainer.setPosition(100, 550);
            
            // Réactiver les mouvements
            this.canMove = true;
            
            // Réinitialiser l'état du jeu
            this.finalRiddle.solved = false;
            
            // Nettoyer tous les autres joueurs
            this.otherPlayers.forEach(player => {
                if (player.nameText) player.nameText.destroy();
                player.destroy();
            });
            this.otherPlayers.clear();
            this.players.clear();
            this.playerCount = 0;
            
            // Détruire le panneau de victoire s'il existe
            this.children.list
                .filter(child => child.type === 'Container' && child.y === 300)
                .forEach(container => container.destroy());
        });
    }

    createRiddlePanel() {
        // Créer un panneau d'énigme caché par défaut
        this.riddlePanel = this.add.container(400, 300)
            .setVisible(false)
            .setDepth(1000);

        // Agrandir le fond du panneau
        const background = this.add.rectangle(0, 0, 600, 400, 0x000000, 0.8);
        
        // Ajuster la position du texte de l'énigme
        this.riddleText = this.add.text(0, -150, '', {
            fontSize: '16px',
            fill: '#ffffff',
            align: 'center',
            wordWrap: { width: 550 }
        }).setOrigin(0.5);

        // Ajuster la position du champ de réponse
        this.answerInput = this.add.text(0, 0, 'Cliquez pour répondre', {
            fontSize: '20px',
            fill: '#ffffff',
            backgroundColor: '#333333',
            padding: { x: 10, y: 5 }
        }).setOrigin(0.5).setInteractive();

        // Ajuster la position du bouton de validation
        const submitButton = this.add.text(0, 100, 'Valider', {
            fontSize: '20px',
            fill: '#ffffff',
            backgroundColor: '#4CAF50',
            padding: { x: 20, y: 10 }
        }).setOrigin(0.5).setInteractive();

        // Ajuster la position du bouton de fermeture
        const closeButton = this.add.text(280, -180, 'X', {
            fontSize: '24px',
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
            { x: 150, y: 150 },    // Ajuster les positions des portes
            { x: 400, y: 150 },    // pour qu'elles soient visibles
            { x: 650, y: 150 },    // dans l'écran plus petit
            { x: 150, y: 300 },
            { x: 400, y: 300 },
            { x: 650, y: 300 },
            { x: 275, y: 450 },
            { x: 525, y: 450 }        
        ];

        const doorRiddles = [
            { question: "10+5x3=?", 
              answer: "25", 
              clue: "Je vis dans la lumière",
              hasRiddle: true },

            { question: "Quel est le deuxieme jour de la semaine ?", 
              answer: "mardi", 
              clue: "Je te suis partout sans jamais te quitter",
              hasRiddle: true },

            { question: "Si j'ai 3 pommes et que j'en prends 2, combien j'en ai ?", 
              answer: "2", 
              clue: "Tapis dans...",
              hasRiddle: true },

            { question: "Pas de devinette ici, cherchez ailleurs !",
              hasRiddle: false },

            { question: "Cette porte est vide, continuez votre recherche !",
              hasRiddle: false },

            { question: "Qu'est-ce qui est jaune et qui attend ?",
              answer: "jonathan",
              clue: "Sans moi, le soleil ne prouverait rien.",
              hasRiddle: true },

            { question: "Rien à voir ici, poursuivez votre quête !",
              hasRiddle: false },

            { question: "Combien y a t-il de lettres dans l'alphabet ?",
              answer: "26",
              clue: "Je change de forme mais jamais de nature.",
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
        
        // Gérer différemment l'affichage selon si la porte a une énigme ou non
        if (!door.riddle.hasRiddle) {
            // Cacher les éléments interactifs
            this.answerInput.setVisible(false);
            this.riddlePanel.getAt(3).setVisible(false); // Cache le bouton Valider
            
            // Ajouter un message pour fermer
            this.riddleText.setText(door.riddle.question + '\n\n(Cliquez sur X pour fermer)');
        } else {
            // Afficher normalement les éléments pour une porte avec énigme
            this.answerInput.setVisible(true).setText('Cliquez pour répondre');
            this.riddlePanel.getAt(3).setVisible(true); // Affiche le bouton Valider
        }
        
        this.riddlePanel.setVisible(true);
        this.playerContainer.body.setVelocity(0);
        this.canMove = false;
    }

    checkAnswer(door, answer) {
        // Vérifier d'abord si c'est l'énigme finale
        if (this.finalRiddle && !this.finalRiddle.solved && this.allRiddlesSolved()) {
            if (answer.toLowerCase() === this.finalRiddle.answer) {
                this.finalRiddle.solved = true;
                this.riddlePanel.setVisible(false);
                this.canMove = true;
                // Émettre l'événement de victoire avec finalRiddleAttempt au lieu de gameComplete
                this.socket.emit('finalRiddleAttempt', {
                    playerId: this.playerId,
                    answer: answer
                });
                // Afficher un message de victoire
                this.showTemporaryMessage('Félicitations ! Vous avez résolu toutes les énigmes !');
                return;
            }
        }

        // Pour les énigmes normales
        if (!door.riddle.hasRiddle) {
            this.riddlePanel.setVisible(false);
            return;
        }

        // Normaliser la réponse (enlever les accents et mettre en minuscules)
        const normalizedAnswer = answer.toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
        
        if (normalizedAnswer === door.riddle.answer) {
            door.solved = true;
            this.collectClue(door.riddle.clue);
            this.canMove = true;
            
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
        // Vérifier si l'indice n'est pas déjà dans la liste
        if (!this.collectedClues) {
            this.collectedClues = [];
        }
        
        if (!this.collectedClues.includes(clue)) {
            // Ajouter le nouvel indice à la liste
            this.collectedClues.push(clue);
            this.updateCluesDisplay();
            
            // Émettre l'événement au serveur avec la liste complète des indices
            this.socket.emit('clueCollected', {
                playerId: this.socket.id,
                clue: clue,
                allClues: this.collectedClues
            });
        }
    }

    updateCluesDisplay() {
        // Mettre à jour le compteur
        this.cluesText.setText(`Indices collectés: ${this.collectedClues.length}`);
        
        // Construire la liste complète des indices
        let cluesListText = '';
        this.collectedClues.forEach((clue, index) => {
            cluesListText += `${index + 1}. ${clue}\n`;
        });
        
        // Mettre à jour le texte de la liste
        this.cluesList.setText(cluesListText);
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
            550,
            'player'
        )
        .setDisplaySize(32, 32)
        .setCollideWorldBounds(true)
        .setDepth(1)  // Même profondeur que le joueur principal
        .setTint(playerInfo.color);
        
        // Ajouter le nom au-dessus du joueur
        const nameText = this.add.text(
            100 + (this.playerCount * this.PLAYER_SPACING),
            550 - 40, 
            playerInfo.name,
            {
                fontSize: '14px',
                fill: '#ffffff'
            }
        )
        .setOrigin(0.5)
        .setDepth(1);  // Même profondeur que les joueurs

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

    showRiddleWindow() {
        this.canMove = false;
        
        // Créer la fenêtre d'énigme
        this.riddleWindow = this.add.rectangle(400, 300, 400, 300, 0xffffff)
            .setOrigin(0.5)
            .setDepth(99);

        // Ajouter la croix pour fermer
        const closeButton = this.add.text(580, 160, 'X', {
            fontSize: '24px',
            color: '#000000'
        })
        .setInteractive()
        .setDepth(100);

        // Gestionnaire pour le clic sur la croix uniquement
        closeButton.on('pointerdown', () => {
            this.closeRiddleWindow();
        });

        // ... reste du code de la fenêtre ...
    }

    closeRiddleWindow() {
        this.canMove = true;
        if (this.riddleWindow) this.riddleWindow.destroy();
        // Supprimer tous les éléments de la fenêtre (textes, boutons, etc.)
        this.children.list
            .filter(child => child.depth >= 99)
            .forEach(child => child.destroy());
    }

    // Ajouter cette méthode pour afficher des messages temporaires
    showTemporaryMessage(message) {
        const text = this.add.text(600, 100, message, {
            fontSize: '20px',
            color: '#ffffff',
            backgroundColor: '#000000',
            padding: { x: 10, y: 5 }
        })
        .setOrigin(0.5)
        .setDepth(100);

        // Faire disparaître le message après 2 secondes
        this.time.delayedCall(2000, () => {
            text.destroy();
        });
    }
} 