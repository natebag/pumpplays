const EventEmitter = require('events');
const { log } = require('../utils/logger');

class VoteManager extends EventEmitter {
    constructor() {
        super();
        this.voteDuration = (process.env.VOTE_DURATION_SECONDS || 8) * 1000;
        this.currentVotes = {};
        this.voteFirstUsers = {}; // Track first user to vote for each command
        this.voteTimer = null;
        this.isActive = false;
        this.lastMove = null;
        this.voteHistory = [];
        
        // Valid GBA Pokemon commands (supports both ! and / prefixes)
        this.validCommands = [
            'up', 'down', 'left', 'right', 
            'a', 'b', 'start', 'select', 'l', 'r',
            // Special commands
            'release',
            // Hold commands
            'holdup', 'holddown', 'holdleft', 'holdright',
            'holda', 'holdb', 'holdstart', 'holdselect', 'holdl', 'holdr'
        ];
        
        log(`Vote Manager initialized - ${this.voteDuration/1000}s vote periods`, 'VOTE');
    }
    
    /**
     * Start the voting system
     */
    start() {
        if (this.isActive) return;
        
        this.isActive = true;
        this.startVotingPeriod();
        log('Voting system started', 'VOTE');
    }
    
    /**
     * Stop the voting system
     */
    stop() {
        this.isActive = false;
        if (this.voteTimer) {
            clearTimeout(this.voteTimer);
            this.voteTimer = null;
        }
        log('Voting system stopped', 'VOTE');
    }
    
    /**
     * Start a new voting period
     */
    startVotingPeriod() {
        if (!this.isActive) return;
        
        // Clear previous votes and first users
        this.currentVotes = {};
        this.voteFirstUsers = {};
        
        // Don't start timer here - start it on first vote
        this.voteTimer = null;
        
        log('New voting period started', 'VOTE');
        this.emit('voteStart');
    }
    
    /**
     * End the current voting period and execute winning move
     */
    endVotingPeriod() {
        if (!this.isActive) return;
        
        const results = this.tallyVotes();
        const winner = this.determineWinner(results);
        
        if (winner) {
            log(`DEBUG: voteFirstUsers = ${JSON.stringify(this.voteFirstUsers)}`, 'VOTE');
            log(`DEBUG: winner = ${winner}, firstVoter = ${this.voteFirstUsers[winner]}`, 'VOTE');
            this.lastMove = {
                command: winner,
                timestamp: Date.now(),
                votes: results[winner] || 0,
                totalVotes: Object.values(results).reduce((a, b) => a + b, 0),
                firstVoter: this.voteFirstUsers[winner] || 'Anonymous'
            };
            
            // Add to history
            this.voteHistory.push(this.lastMove);
            if (this.voteHistory.length > 50) {
                this.voteHistory = this.voteHistory.slice(-50);
            }
            
            log(`Vote complete: ${winner} wins with ${results[winner]} votes`, 'VOTE');
            this.emit('voteComplete', winner, results);
        } else {
            log('No votes received, skipping move', 'VOTE');
        }
        
        // Start next voting period
        setTimeout(() => {
            this.startVotingPeriod();
        }, 1000); // 1 second break between votes
    }
    
    /**
     * Add a vote from chat
     * @param {string} command - The command voted for
     * @param {string} user - Username who voted
     * @param {number} weight - Vote weight (default 1, can be higher for token holders)
     */
    addVote(command, user, weight = 1) {
        if (!this.isActive) return false;
        
        const normalizedCommand = command.toLowerCase().trim();
        
        // Check if it's a valid command
        if (!this.validCommands.includes(normalizedCommand)) {
            return false;
        }
        
        // Start timer on first vote if not already running
        if (!this.voteTimer && Object.keys(this.currentVotes).length === 0) {
            this.voteTimer = setTimeout(() => {
                this.endVotingPeriod();
            }, this.voteDuration);
            log(`First vote received, starting ${this.voteDuration/1000}s countdown`, 'VOTE');
        }
        
        // Initialize vote count for this command
        if (!this.currentVotes[normalizedCommand]) {
            this.currentVotes[normalizedCommand] = 0;
            // Store the first user to vote for this command
            this.voteFirstUsers[normalizedCommand] = user;
        }
        
        // Add weighted vote
        this.currentVotes[normalizedCommand] += weight;
        
        log(`Vote: ${normalizedCommand} (+${weight}) from ${user}`, 'VOTE');
        this.emit('voteAdded', normalizedCommand, user, weight);
        
        return true;
    }
    
    /**
     * Tally all current votes
     * @returns {Object} Vote results
     */
    tallyVotes() {
        const results = { ...this.currentVotes };
        
        // Ensure all valid commands are in results
        this.validCommands.forEach(cmd => {
            if (!results[cmd]) results[cmd] = 0;
        });
        
        return results;
    }
    
    /**
     * Determine the winning command
     * @param {Object} results - Vote tally results
     * @returns {string|null} Winning command or null if no votes
     */
    determineWinner(results) {
        const entries = Object.entries(results);
        
        if (entries.length === 0) return null;
        
        // Find commands with highest vote count
        const maxVotes = Math.max(...entries.map(([_, votes]) => votes));
        
        if (maxVotes === 0) return null;
        
        const winners = entries.filter(([_, votes]) => votes === maxVotes);
        
        // If tie, randomly select winner
        if (winners.length > 1) {
            const randomWinner = winners[Math.floor(Math.random() * winners.length)];
            log(`Tie between ${winners.length} commands, randomly chose: ${randomWinner[0]}`, 'VOTE');
            return randomWinner[0];
        }
        
        return winners[0][0];
    }
    
    /**
     * Get current vote status
     * @returns {Object} Current voting state
     */
    getCurrentVotes() {
        return {
            votes: { ...this.currentVotes },
            timeRemaining: this.voteTimer ? Math.max(0, this.voteDuration - (Date.now() % this.voteDuration)) : 0,
            isActive: this.isActive
        };
    }
    
    /**
     * Get last executed move
     * @returns {Object|null} Last move data
     */
    getLastMove() {
        return this.lastMove;
    }
    
    /**
     * Get vote history
     * @returns {Array} Array of previous moves
     */
    getHistory() {
        return [...this.voteHistory];
    }
    
    /**
     * Get voting statistics
     * @returns {Object} Stats about voting patterns
     */
    getStats() {
        if (this.voteHistory.length === 0) {
            return { totalMoves: 0, averageVotes: 0, popularCommands: {} };
        }
        
        const totalMoves = this.voteHistory.length;
        const totalVotes = this.voteHistory.reduce((sum, move) => sum + move.totalVotes, 0);
        const averageVotes = totalVotes / totalMoves;
        
        // Count command popularity
        const commandCounts = {};
        this.voteHistory.forEach(move => {
            commandCounts[move.command] = (commandCounts[move.command] || 0) + 1;
        });
        
        return {
            totalMoves,
            totalVotes,
            averageVotes: Math.round(averageVotes * 100) / 100,
            popularCommands: commandCounts
        };
    }
}

module.exports = VoteManager;