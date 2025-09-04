// Pump Plays Pokemon Overlay JavaScript

class PokemonOverlay {
    constructor() {
        this.socket = null;
        this.state = {
            votes: {},
            lastMove: null,
            recentTrades: [],
            isVoting: false,
            timeRemaining: 0,
            stats: { totalMoves: 0, totalVotes: 0, popularCommands: {} }
        };
        
        this.commands = ['up', 'down', 'left', 'right', 'a', 'b', 'l', 'r', 'start', 'select'];
        this.chatMessages = [];
        this.maxChatMessages = 8;
        this.timerInterval = null;
        this.init();
    }
    
    init() {
        this.connectSocket();
        this.setupEventListeners();
        this.startTimerUpdates();
        console.log('🎮 Pump Plays Pokemon Emerald Overlay initialized');
    }
    
    startTimerUpdates() {
        // Update timer every second for countdown
        this.timerInterval = setInterval(() => {
            this.updateTimer();
        }, 1000);
    }
    
    connectSocket() {
        this.socket = io();
        
        this.socket.on('connect', () => {
            console.log('✅ Connected to overlay server');
            this.showConnectionStatus(true);
        });
        
        this.socket.on('disconnect', () => {
            console.log('❌ Disconnected from overlay server');
            this.showConnectionStatus(false);
        });
        
        this.socket.on('stateUpdate', (newState) => {
            this.updateState(newState);
        });
        
        this.socket.on('tradeEffect', (tradeData) => {
            this.triggerTradeEffect(tradeData);
        });
        
        this.socket.on('customEffect', (effect) => {
            this.triggerCustomEffect(effect);
        });
        
        this.socket.on('chatMessage', (messageData) => {
            this.addChatMessage(messageData);
        });
        
        this.socket.on('commandReceived', (commandData) => {
            this.showCommandReceived(commandData);
        });
    }
    
    setupEventListeners() {
        // Handle window resize
        window.addEventListener('resize', () => {
            this.adjustLayout();
        });
        
        // Initial layout adjustment
        this.adjustLayout();
    }
    
    updateState(newState) {
        this.state = { ...this.state, ...newState };
        this.lastStateUpdate = Date.now(); // Track when we last got state
        
        this.updateVoteDisplay();
        this.updateLastMove();
        this.updateRecentTrades();
        this.updateStats();
        this.updateTimer();
    }
    
    updateVoteDisplay() {
        const votes = this.state.votes || {};
        const totalVotes = Object.values(votes).reduce((sum, count) => sum + count, 0);
        const maxVotes = Math.max(...Object.values(votes), 1);
        
        // Find winning command(s)
        const winningCommands = Object.entries(votes)
            .filter(([_, count]) => count === maxVotes && count > 0)
            .map(([command]) => command);
        
        this.commands.forEach(command => {
            const voteBar = document.querySelector(`[data-command=\"${command}\"]`);
            if (!voteBar) return;
            
            const voteCount = votes[command] || 0;
            const percentage = totalVotes > 0 ? (voteCount / maxVotes) * 100 : 0;
            
            const barFill = voteBar.querySelector('.bar-fill');
            const countElement = voteBar.querySelector('.vote-count');
            
            // Update bar width
            barFill.style.width = `${percentage}%`;
            
            // Update vote count
            countElement.textContent = voteCount;
            
            // Highlight winning commands
            const isWinning = winningCommands.includes(command) && voteCount > 0;
            voteBar.classList.toggle('winning', isWinning);
            barFill.classList.toggle('winning', isWinning);
            
            // Add flash effect for new votes
            if (voteCount > (this.previousVotes?.[command] || 0)) {
                voteBar.classList.add('flash');
                setTimeout(() => voteBar.classList.remove('flash'), 500);
            }
        });
        
        this.previousVotes = { ...votes };
    }
    
    updateLastMove() {
        const lastMove = this.state.lastMove;
        const commandElement = document.querySelector('.move-command');
        const detailsElement = document.querySelector('.move-details');
        const winnerElement = document.getElementById('first-voter');
        
        if (!lastMove) {
            commandElement.textContent = 'Waiting...';
            detailsElement.textContent = 'Ready for commands!';
            winnerElement.textContent = '---';
            return;
        }
        
        const moveEmoji = {
            'up': '↑',
            'down': '↓',
            'left': '←',
            'right': '→',
            'a': '🅰️',
            'b': '🅱️',
            'l': '🛡️',
            'r': '🛡️', 
            'start': '▶️',
            'select': '⏹️'
        };
        
        commandElement.textContent = `${moveEmoji[lastMove.command] || ''} ${lastMove.command.toUpperCase()}`;
        detailsElement.textContent = `${lastMove.votes}/${lastMove.totalVotes} votes • ${this.getTimeAgo(lastMove.timestamp)}`;
        
        // Display the first voter (winner)
        const firstVoter = lastMove.firstVoter || 'Anonymous';
        winnerElement.textContent = firstVoter.length > 12 ? firstVoter.substring(0, 12) + '...' : firstVoter;
        
        // Add pulse effect for new moves
        if (this.lastMoveTimestamp !== lastMove.timestamp) {
            commandElement.classList.add('pulse');
            winnerElement.classList.add('pulse');
            setTimeout(() => {
                commandElement.classList.remove('pulse');
                winnerElement.classList.remove('pulse');
            }, 2000);
            this.lastMoveTimestamp = lastMove.timestamp;
        }
    }
    
    updateRecentTrades() {
        const tradesContainer = document.getElementById('trades-list');
        const trades = this.state.recentTrades || [];
        
        if (trades.length === 0) {
            tradesContainer.innerHTML = '<div class=\"no-trades\">No recent trades</div>';
            return;
        }
        
        tradesContainer.innerHTML = trades.map(trade => `
            <div class=\"trade-item ${trade.type}\">
                <div class=\"trade-type\">${trade.type.toUpperCase()}</div>
                <div class=\"trade-amount\">${trade.amount.toFixed(4)} SOL</div>
                <div class=\"trade-user\">${this.truncateUser(trade.user)}</div>
            </div>
        `).join('');
    }
    
    updateStats() {
        const stats = this.state.stats || {};
        
        document.getElementById('stat-moves').textContent = stats.totalMoves || 0;
        document.getElementById('stat-votes').textContent = stats.totalVotes || 0;
    }
    
    addChatMessage(messageData) {
        const { user, message, isCommand, isTrade } = messageData;
        
        // Add to chat messages array
        this.chatMessages.unshift({
            user,
            message,
            timestamp: Date.now(),
            isCommand,
            isTrade
        });
        
        // Keep only latest messages
        if (this.chatMessages.length > this.maxChatMessages) {
            this.chatMessages = this.chatMessages.slice(0, this.maxChatMessages);
        }
        
        this.updateChatDisplay();
    }
    
    updateChatDisplay() {
        const chatContainer = document.getElementById('chat-messages');
        const chatCounter = document.getElementById('chat-count');
        
        if (this.chatMessages.length === 0) {
            chatContainer.innerHTML = '<div class="no-chat">No messages yet...</div>';
            chatCounter.textContent = '0';
            return;
        }
        
        chatCounter.textContent = this.chatMessages.length;
        
        chatContainer.innerHTML = this.chatMessages.map(msg => {
            const messageClass = msg.isCommand ? 'command' : (msg.isTrade ? 'buy' : '');
            const timeAgo = this.getTimeAgo(msg.timestamp);
            
            return `
                <div class="chat-message ${messageClass}">
                    <span class="chat-user">${this.truncateUser(msg.user)}</span>
                    <span class="chat-text">${msg.message}</span>
                </div>
            `;
        }).join('');
        
        // Auto-scroll to top (newest messages)
        chatContainer.scrollTop = 0;
    }
    
    updateTimer() {
        const timerElement = document.getElementById('vote-timer');
        
        // Calculate time remaining since last state update
        let timeRemaining;
        if (this.lastStateUpdate && this.state.timeRemaining) {
            const timeSinceUpdate = Date.now() - this.lastStateUpdate;
            timeRemaining = Math.max(0, Math.floor((this.state.timeRemaining - timeSinceUpdate) / 1000));
        } else {
            timeRemaining = Math.max(0, Math.floor(this.state.timeRemaining / 1000));
        }
        
        timerElement.textContent = `${timeRemaining}s`;
        
        if (timeRemaining <= 3 && timeRemaining > 0) {
            timerElement.classList.add('pulse');
        } else {
            timerElement.classList.remove('pulse');
        }
    }
    
    triggerTradeEffect(tradeData) {
        const effectsContainer = document.getElementById('trade-effects');
        const effect = document.createElement('div');
        
        effect.className = `trade-effect ${tradeData.type}`;
        effect.textContent = `${tradeData.type.toUpperCase()} ${tradeData.amount.toFixed(2)} SOL!`;
        
        // Random position
        const randomX = (Math.random() - 0.5) * 200;
        const randomY = (Math.random() - 0.5) * 200;
        effect.style.transform = `translate(${randomX}px, ${randomY}px)`;
        
        effectsContainer.appendChild(effect);
        
        // Remove effect after animation
        setTimeout(() => {
            if (effect.parentNode) {
                effect.parentNode.removeChild(effect);
            }
        }, 3000);
        
        // Play sound effect (if audio is enabled)
        this.playTradeSound(tradeData.type);
    }
    
    triggerCustomEffect(effect) {
        console.log('Custom effect:', effect);
        // Implement custom effects as needed
    }
    
    playTradeSound(type) {
        // Could play Pokemon sound effects here
        // For now, just log
        console.log(`🔊 Trade sound: ${type}`);
    }
    
    showConnectionStatus(connected) {
        // Could add a connection indicator
        console.log(`Connection status: ${connected ? 'Connected' : 'Disconnected'}`);
    }
    
    adjustLayout() {
        // Adjust layout based on screen size
        const container = document.getElementById('overlay-container');
        const width = window.innerWidth;
        
        if (width < 1200) {
            container.style.gridTemplateColumns = '1fr';
        } else {
            container.style.gridTemplateColumns = '1fr 300px';
        }
    }
    
    getTimeAgo(timestamp) {
        const now = Date.now();
        const diff = now - timestamp;
        const seconds = Math.floor(diff / 1000);
        
        if (seconds < 60) return `${seconds}s ago`;
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        return `${hours}h ago`;
    }
    
    truncateUser(user) {
        if (!user) return 'anon';
        if (user.length <= 8) return user;
        return user.substring(0, 6) + '...';
    }
    
    /**
     * Show visual feedback when a command is received
     * @param {Object} commandData - { command, user, weight, timestamp }
     */
    showCommandReceived(commandData) {
        const { command, user, weight } = commandData;
        
        // Find the vote bar for this command
        const voteBar = document.querySelector(`[data-command="${command}"]`);
        if (!voteBar) return;
        
        // Add visual flash effect
        voteBar.classList.add('command-received');
        setTimeout(() => {
            voteBar.classList.remove('command-received');
        }, 500);
        
        // Show floating notification
        this.showFloatingCommand(command, user, weight);
        
        console.log(`⚡ Command received: ${command} from ${user} (weight: ${weight})`);
    }
    
    /**
     * Show floating command notification
     * @param {string} command - The command
     * @param {string} user - Username
     * @param {number} weight - Vote weight
     */
    showFloatingCommand(command, user, weight) {
        const notification = document.createElement('div');
        notification.className = 'floating-command';
        notification.innerHTML = `
            <div class="command-text">!${command}</div>
            <div class="command-user">${this.truncateUser(user)}</div>
            ${weight > 1 ? `<div class="command-weight">${weight}x</div>` : ''}
        `;
        
        // Position near the corresponding vote bar
        const voteBar = document.querySelector(`[data-command="${command}"]`);
        if (voteBar) {
            const rect = voteBar.getBoundingClientRect();
            notification.style.left = `${rect.right + 10}px`;
            notification.style.top = `${rect.top + rect.height/2 - 20}px`;
        }
        
        document.body.appendChild(notification);
        
        // Animate and remove
        setTimeout(() => notification.classList.add('show'), 10);
        setTimeout(() => {
            notification.classList.add('fade-out');
            setTimeout(() => notification.remove(), 300);
        }, 2000);
    }
}

// Initialize overlay when page loads
document.addEventListener('DOMContentLoaded', () => {
    new PokemonOverlay();
});

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        console.log('🙈 Overlay hidden');
    } else {
        console.log('👀 Overlay visible');
    }
});