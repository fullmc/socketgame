<script setup>
import { onMounted, ref } from 'vue'
import io from 'socket.io-client'
import Phaser from 'phaser'
import GameScene from './scenes/GameScene'

const gameState = ref({
  playerId: null,
  playerName: '',
  players: [],
  currentRoom: null,
  clues: [],
  gameStarted: false
})

const showNameInput = ref(true)
const playerName = ref('')

const socket = io('http://localhost:8080', {
  reconnection: true
})

const game = ref(null)

// Gestion des événements socket
socket.on('connect', () => {
  console.log('Connecté au serveur')
  gameState.value.playerId = socket.id
})

socket.on('playerJoined', (players) => {
  gameState.value.players = players
  console.log('Joueurs connectés:', players)
})

socket.on('gameStarted', (gameData) => {
  gameState.value.gameStarted = true
  // Initialiser Phaser seulement quand le jeu commence
  if (!game.value) {
    game.value = new Phaser.Game(gameConfig)
    game.value.scene.start('GameScene', {
      socket: socket,
      playerId: gameState.value.playerId,
      playerName: gameState.value.playerName,
      riddle: gameData.question
    })
  }
})

socket.on('roomFull', () => {
  alert('La salle est pleine ! Maximum 4 joueurs.')
})

// Ajouter un gestionnaire pour le redémarrage
socket.on('gameRestarted', () => {
    gameState.value.gameStarted = false;
    gameState.value.clues = [];
    showNameInput.value = true;  // Réafficher le formulaire de nom
    
    // Réinitialiser le jeu Phaser
    if (game.value) {
        game.value.destroy(true);
        game.value = null;
    }
});

// Fonction pour soumettre le nom du joueur
const submitPlayerName = () => {
  if (playerName.value.trim()) {
    if (gameState.value.players.length < 4) {
      socket.emit('setPlayerName', playerName.value)
      showNameInput.value = false
      gameState.value.playerName = playerName.value
    } else {
      alert('La salle est pleine ! Maximum 4 joueurs.')
    }
  }
}

// Fonction pour démarrer le jeu
const startGame = () => {
  socket.emit('startGame')
}

// Mise à jour de la configuration Phaser
const gameConfig = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    parent: 'game-container',
    backgroundColor: '#000000',
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },  // Pas de gravité pour un jeu en vue de dessus
            debug: false        // Mettre à true pour voir les hitbox
        }
    },
    scene: GameScene
};

</script>

<template>
  <div class="game-wrapper">
    <!-- Formulaire de nom -->
    <div v-if="showNameInput" class="name-input-container">
      <h2>Entrez votre nom</h2>
      <input 
        v-model="playerName" 
        @keyup.enter="submitPlayerName"
        placeholder="Votre nom"
      >
      <button @click="submitPlayerName">Rejoindre</button>
    </div>

    <!-- Interface principale du jeu -->
    <div v-else>
      <div class="player-info" v-if="gameState.playerId">
        <h2>Bienvenue, {{ gameState.playerName }}</h2>
        <div class="players-list">
          <h3>Joueurs connectés: {{ gameState.players.length }}/4</h3>
          <ul>
            <li v-for="player in gameState.players" :key="player.id">
              {{ player.name || 'Joueur sans nom' }}
            </li>
          </ul>
        </div>
        
        <!-- Bouton de démarrage -->
        <button 
          v-if="gameState.players.length >= 2 && !gameState.gameStarted" 
          @click="startGame"
          class="start-button"
        >
          Démarrer la partie
        </button>
      </div>
      <div id="game-container" v-if="gameState.gameStarted"></div>
    </div>
  </div>
</template>

<style scoped>
.game-wrapper {
  display: flex;
  gap: 20px;
  padding: 20px;
}

.player-info {
  width: 250px;
}

.name-input-container {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-width: 300px;
  margin: 20px auto;
}

input {
  padding: 8px;
  font-size: 16px;
}

button {
  padding: 8px 16px;
  background-color: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

button:hover {
  background-color: #45a049;
}

.start-button {
  margin-top: 20px;
  background-color: #2196F3;
}

.start-button:hover {
  background-color: #1976D2;
}

#game-container {
  border: 1px solid #ccc;
  max-width: 800px;
  max-height: 600px;
  margin: 0 auto;
}
</style>
