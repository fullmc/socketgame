import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';

const app = express();
const http = createServer(app);
const io = new Server(http, {
  cors: {
    origin: "http://localhost:5173", // L'URL par défaut de Vite/Vue
    methods: ["GET", "POST"]
  }
});

// Gestion des joueurs
const players = new Map();
const gameState = {
    riddlesProgress: new Map(),
    finalRiddleSolved: false
};
const MAX_PLAYERS = 4;

// Liste d'énigmes simples
const riddles = [
    {
        question: "Je suis grand quand je suis jeune et petit quand je suis vieux. Que suis-je ?",
        answer: "une bougie",
        clues: [
            "On m'utilise pour éclairer",
            "La chaleur me fait fondre",
            "Je peux être parfumé(e)",
            "On me souffle pour m'éteindre"
        ]
    },
    // Ajoutez d'autres énigmes ici
];

io.on('connection', (socket) => {
  console.log('Un joueur est connecté:', socket.id);
  
  // Informer le nouveau joueur du nombre actuel de joueurs
  socket.emit('playerJoined', Array.from(players.values()));

  socket.on('playerJoined', (playerInfo) => {
    players.set(socket.id, {
        id: socket.id,
        name: playerInfo.name,
        x: 400,
        y: 500
    });

    // Informer les autres joueurs du nouveau joueur
    socket.broadcast.emit('newPlayer', {
        id: socket.id,
        name: playerInfo.name,
        x: 400,
        y: 500
    });
});

socket.on('getExistingPlayers', () => {
    socket.emit('existingPlayers', Array.from(players.values()));
});

socket.on('playerMovement', (movementData) => {
    const player = players.get(socket.id);
    if (player) {
        player.x = movementData.x;
        player.y = movementData.y;
        
        // Broadcast la position aux autres joueurs
        socket.broadcast.emit('playerMoved', {
            id: socket.id,
            x: movementData.x,
            y: movementData.y,
            name: player.name
        });
    }
});
  
  // Gérer le nom du joueur
  socket.on('setPlayerName', (name) => {
    if (players.size < MAX_PLAYERS) {
      players.set(socket.id, {
        id: socket.id,
        name: name,
        clues: [],
        ready: false
      });
      
      // Informer tous les joueurs de la nouvelle liste
      io.emit('playerJoined', Array.from(players.values()));
    } else {
      socket.emit('roomFull');
    }
  });

  // Gérer le démarrage du jeu
  socket.on('startGame', () => {
    if (players.size >= 2 && players.size <= MAX_PLAYERS) {
      // Sélectionner une énigme aléatoire
      const selectedRiddle = riddles[Math.floor(Math.random() * riddles.length)];
      
      // Distribuer les indices aux joueurs
      const playerArray = Array.from(players.values());
      playerArray.forEach((player, index) => {
        const clueIndex = index % selectedRiddle.clues.length;
        player.clue = selectedRiddle.clues[clueIndex];
        io.to(player.id).emit('receiveClue', player.clue);
      });

      // Envoyer l'énigme à tous les joueurs
      io.emit('gameStarted', {
        question: selectedRiddle.question
      });
    }
  });

  socket.on('playerMovement', (movementData) => {
    const player = players.get(socket.id);
    if (player) {
      player.x = movementData.x;
      player.y = movementData.y;
      socket.broadcast.emit('playerMoved', {
        id: socket.id,
        x: movementData.x,
        y: movementData.y
      });
    }
  });

  socket.on('levelComplete', (data) => {
    const player = players.get(data.playerId);
    if (player) {
        player.level = data.level;
        player.clues = player.clues || [];
        player.clues.push(data.clue);

        // Informer tous les autres joueurs
        socket.broadcast.emit('playerProgress', {
            playerId: data.playerId,
            level: data.level
        });

        // Vérifier si tous les joueurs ont terminé
        checkGameProgress();
    }
  });

  socket.on('finalRiddleAttempt', (data) => {
      if (data.answer.toLowerCase() === "ombre") {
          gameState.finalRiddleSolved = true;
          io.emit('gameComplete', {
              winner: data.playerId
          });
      }
  });

  function checkGameProgress() {
    const allPlayersComplete = Array.from(players.values())
        .every(player => player.level === 3);
    
    if (allPlayersComplete) {
        io.emit('allPlayersReady');
    }
  }

  socket.on('disconnect', () => {
    console.log('Un joueur s\'est déconnecté:', socket.id);
    players.delete(socket.id);
    io.emit('playerDisconnected', socket.id);
  });
});

const PORT = 8080;
http.listen(PORT, () => {
  console.log(`Serveur en écoute sur le port ${PORT}`);
}); 