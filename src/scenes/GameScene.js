import Phaser from 'phaser';

export default class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        this.players = new Map();
        this.otherPlayers = new Map();
        this.mazes = new Map();
        this.currentLevel = 0;
        this.riddlePanel = null;
        this.collectedClues = [];
        this.finalRiddle = {
            question: "Énigme finale: Je suis ce que je suis, mais je ne suis pas ce que je suis. Si j'étais ce que je suis, je ne serais pas ce que je suis. Que suis-je?",
            answer: "ombre",
            solved: false
        };
        this.initialized = false;
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
        console.log('Début du chargement des assets');
        
        // Modifions les chemins pour être sûr qu'ils pointent vers les bons fichiers
        this.load.image('player', '/player.png');
        this.load.image('wall', '/wall.png');
        this.load.image('door', '/door.png');
        this.load.image('panel', '/panel.png');

        // Ajoutons des gestionnaires d'événements pour le chargement
        this.load.on('loaderror', (fileObj) => {
            console.error('Erreur de chargement pour:', fileObj.src);
        });

        this.load.on('complete', () => {
            console.log('Tous les assets sont chargés');
        });
    }

    create() {
        // Créer la caméra qui suit le joueur
        this.cameras.main.setZoom(0.7);

        // Créer le joueur principal
        this.player = this.physics.add.sprite(400, 500, 'player')
            .setDisplaySize(32, 32);

        this.playerText = this.add.text(400, 480, this.playerName, {
            fontSize: '14px',
            fill: '#ffffff'
        }).setOrigin(0.5);

        this.cluesText = this.add.text(10, 10, 'Indices: 0/3', {
            fontSize: '16px',
            fill: '#ffffff'
        }).setScrollFactor(0);

        this.setupSocketListeners();
        this.createRiddlePanel();
        this.cursors = this.input.keyboard.createCursorKeys();

        // Informer le serveur du nouveau joueur seulement une fois
        if (!this.initialized) {
            this.socket.emit('playerJoined', {
                name: this.playerName,
                x: this.player.x,
                y: this.player.y
            });
            this.initialized = true;
        }

        // Demander la liste des joueurs existants
        this.socket.emit('getExistingPlayers');

        // Forcer la création d'un labyrinthe initial
        this.createMazes(1);
    }

    createMazes(playerCount) {
        console.log('Création des labyrinthes pour', playerCount, 'joueurs');
        
        // Correction : utiliser destroy() sur chaque élément du groupe
        if (this.mazes) {
            this.mazes.forEach((maze) => {
                maze.getChildren().forEach((child) => {
                    child.destroy();
                });
            });
        }
        this.mazes = this.add.group();

        const mazeWidth = 8;  // Correspond à la taille de generateMazeWithObstacles
        const mazeHeight = 8; // Correspond à la taille de generateMazeWithObstacles
        const cellSize = 64;  // Taille de chaque cellule

        const positions = this.calculateMazePositions(playerCount);
        console.log('Positions des labyrinthes:', positions);
        
        positions.forEach((pos, index) => {
            this.createSingleMaze(pos, index, cellSize, mazeWidth, mazeHeight);
        });
    }

    calculateMazePositions(playerCount) {
        const positions = [];
        const centerX = this.cameras.main.centerX;
        const centerY = this.cameras.main.centerY;
        
        switch(playerCount) {
            case 1:
                positions.push({ x: centerX, y: centerY });
                break;
            case 2:
                positions.push(
                    { x: centerX - 300, y: centerY },
                    { x: centerX + 300, y: centerY }
                );
                break;
            case 3:
                positions.push(
                    { x: centerX - 300, y: centerY - 200 },
                    { x: centerX + 300, y: centerY - 200 },
                    { x: centerX, y: centerY + 200 }
                );
                break;
            case 4:
                positions.push(
                    { x: centerX - 300, y: centerY - 200 },
                    { x: centerX + 300, y: centerY - 200 },
                    { x: centerX - 300, y: centerY + 200 },
                    { x: centerX + 300, y: centerY + 200 }
                );
                break;
        }
        return positions;
    }

    createSingleMaze(position, index, cellSize, mazeWidth, mazeHeight) {
        console.log(`Création du labyrinthe ${index} à la position:`, position);
        
        const mazeData = this.generateMazeWithObstacles();
        
        mazeData.forEach((row, y) => {
            row.forEach((cell, x) => {
                const worldX = position.x + (x - mazeWidth/2) * cellSize;
                const worldY = position.y + (y - mazeHeight/2) * cellSize;

                if (cell === 1) {  // Mur
                    const wall = this.physics.add.sprite(worldX, worldY, 'wall')
                        .setDisplaySize(cellSize, cellSize)
                        .setImmovable(true);
                    this.mazes.add(wall);
                    
                    // Ajouter un log pour vérifier la création des murs
                    console.log(`Mur créé à: ${worldX}, ${worldY}`);
                    
                } else if (cell === 2) {  // Porte
                    const door = this.physics.add.sprite(worldX, worldY, 'door')
                        .setDisplaySize(cellSize, cellSize)
                        .setImmovable(true);
                    door.riddle = this.getRiddle(y % 3);
                    this.mazes.add(door);
                    
                    // Ajouter un log pour vérifier la création des portes
                    console.log(`Porte créée à: ${worldX}, ${worldY}`);
                }
            });
        });
    }

    generateMazeWithObstacles() {
        return [
            [1, 1, 1, 1, 1, 1, 1, 1],
            [1, 0, 0, 0, 0, 0, 0, 1],
            [1, 1, 1, 2, 1, 1, 0, 1],
            [1, 0, 0, 0, 0, 0, 0, 1],
            [1, 0, 1, 2, 1, 1, 1, 1],
            [1, 0, 0, 0, 0, 0, 0, 1],
            [1, 1, 1, 2, 1, 1, 0, 1],
            [1, 1, 1, 1, 1, 1, 1, 1]
        ];
    }

    getRiddle(level) {
        const riddles = [
            {
                question: "Je suis grand quand je suis jeune et petit quand je suis vieux. Que suis-je?",
                answer: "bougie",
                clue: "Dans l'obscurité, je guide..."
            },
            {
                question: "Plus j'ai de gardiens, moins je suis en sécurité. Qui suis-je?",
                answer: "secret",
                clue: "Ce qui est caché..."
            },
            {
                question: "Je parle sans bouche et j'entends sans oreilles. Qui suis-je?",
                answer: "echo",
                clue: "Réflexion sonore..."
            }
        ];
        return riddles[level];
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

    showRiddlePrompt(door) {
        this.currentDoor = door;
        this.riddleText.setText(door.riddle.question);
        this.answerInput.setText('Cliquez pour répondre');
        this.riddlePanel.setVisible(true);
    }

    checkAnswer(door, answer) {
        if (answer.toLowerCase() === door.riddle.answer) {
            door.solved = true;
            this.currentLevel++;
            this.collectClue(door.riddle.clue);
            
            // Émettre la progression au serveur
            this.socket.emit('levelComplete', {
                level: this.currentLevel,
                playerId: this.playerId,
                clue: door.riddle.clue
            });

            this.riddlePanel.setVisible(false);

            // Vérifier si toutes les portes sont résolues
            if (this.currentLevel === 3) {
                this.showFinalRiddle();
            }
        } else {
            this.answerInput.setText('Mauvaise réponse, essayez encore');
        }
    }

    collectClue(clue) {
        const collectedClues = this.currentLevel;
        this.cluesText.setText(`Indices collectés: ${collectedClues}/3\n${clue}`);
    }

    showFinalRiddle() {
        this.riddleText.setText(this.finalRiddle.question);
        this.answerInput.setText('Cliquez pour répondre');
        this.riddlePanel.setVisible(true);
    }

    setupSocketListeners() {
        this.socket.on('playerCount', (count) => {
            console.log('Réception du nombre de joueurs:', count);
            this.createMazes(count);
        });

        this.socket.on('newPlayer', (playerInfo) => {
            console.log('Nouveau joueur connecté:', playerInfo);
            if (playerInfo.id !== this.playerId) {
                this.addOtherPlayer(playerInfo);
            }
        });

        this.socket.on('existingPlayers', (players) => {
            console.log('Liste des joueurs reçue:', players);
            // Nettoyer les joueurs existants
            this.otherPlayers.forEach((player) => {
                if (player.nameText) player.nameText.destroy();
                player.destroy();
            });
            this.otherPlayers.clear();

            // Ajouter tous les autres joueurs sauf soi-même
            players.forEach(playerInfo => {
                if (playerInfo.id && playerInfo.id !== this.playerId) {
                    this.addOtherPlayer(playerInfo);
                }
            });
        });

        this.socket.on('playerMoved', (playerInfo) => {
            console.log('Mouvement reçu:', playerInfo);
            const otherPlayer = this.otherPlayers.get(playerInfo.id);
            if (otherPlayer) {
                otherPlayer.setPosition(playerInfo.x, playerInfo.y);
                otherPlayer.nameText.setPosition(playerInfo.x, playerInfo.y - 20);
            }
        });

        this.socket.on('playerDisconnected', (playerId) => {
            console.log('Joueur déconnecté:', playerId);
            const otherPlayer = this.otherPlayers.get(playerId);
            if (otherPlayer) {
                if (otherPlayer.nameText) otherPlayer.nameText.destroy();
                otherPlayer.destroy();
                this.otherPlayers.delete(playerId);
            }
        });
    }

    addOtherPlayer(playerInfo) {
        // Vérifier si le joueur existe déjà
        if (this.otherPlayers.has(playerInfo.id)) {
            console.log('Joueur déjà existant:', playerInfo.id);
            return;
        }

        // Vérifier que les informations sont valides
        if (!playerInfo.id || !playerInfo.name) {
            console.log('Informations de joueur invalides:', playerInfo);
            return;
        }

        console.log('Ajout d\'un autre joueur:', playerInfo);
        const otherPlayer = this.physics.add.sprite(
            playerInfo.x,
            playerInfo.y,
            'player'
        ).setDisplaySize(32, 32);

        // Ajouter le nom au-dessus du joueur
        const nameText = this.add.text(
            playerInfo.x,
            playerInfo.y - 20,
            playerInfo.name,
            {
                fontSize: '14px',
                fill: '#ffffff'
            }
        ).setOrigin(0.5);

        otherPlayer.nameText = nameText;
        this.otherPlayers.set(playerInfo.id, otherPlayer);
        
        console.log('Liste mise à jour des autres joueurs:', 
            Array.from(this.otherPlayers.entries()).map(([id, player]) => ({
                id,
                name: player.nameText ? player.nameText.text : 'Sans nom'
            }))
        );
    }

    update() {
        if (this.cursors && this.player) {
            const speed = 4;
            let moved = false;

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
                this.playerText.setPosition(this.player.x, this.player.y - 20);
                // Émettre la position avec toutes les informations nécessaires
                this.socket.emit('playerMovement', {
                    x: this.player.x,
                    y: this.player.y,
                    id: this.playerId,
                    name: this.playerName
                });
            }
        }
    }
} 