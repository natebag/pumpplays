const EventEmitter = require('events');
const { Room, RoomEvent, DataPacket_Kind } = require('livekit-client');
const fetch = require('node-fetch');
const { log } = require('../utils/logger');

class LiveKitCollector extends EventEmitter {
    constructor() {
        super();
        this.room = null;
        this.livekitUrl = process.env.LIVEKIT_URL;
        this.token = process.env.LIVEKIT_TOKEN;
        this.isConnected = false;
    }
    
    /**
     * Connect to LiveKit room for Pump.fun chat
     */
    async connect() {
        try {
            if (!this.livekitUrl || !this.token) {
                throw new Error('LiveKit URL and token are required');
            }
            
            log('Connecting to LiveKit room...', 'CHAT');
            
            this.room = new Room();
            
            // Set up event listeners
            this.room.on(RoomEvent.Connected, () => {
                this.isConnected = true;
                log('Connected to LiveKit room', 'CHAT');
                this.emit('connected');
            });
            
            this.room.on(RoomEvent.Disconnected, () => {
                this.isConnected = false;
                log('Disconnected from LiveKit room', 'CHAT');
                this.emit('disconnected');
            });
            
            this.room.on(RoomEvent.DataReceived, (payload, participant) => {
                try {
                    const message = new TextDecoder().decode(payload);
                    const username = participant?.identity || 'anonymous';
                    
                    log(`Message from ${username}: ${message}`, 'CHAT');
                    this.emit('message', message, username);
                    
                } catch (error) {
                    log(`Error processing chat message: ${error.message}`, 'ERROR');
                }
            });
            
            this.room.on(RoomEvent.RoomMetadataChanged, (metadata) => {
                log(`Room metadata changed: ${metadata}`, 'CHAT');
            });
            
            // Connect to the room
            await this.room.connect(this.livekitUrl, this.token);
            
        } catch (error) {
            log(`Failed to connect to LiveKit: ${error.message}`, 'ERROR');
            this.emit('error', error);
            throw error;
        }
    }
    
    /**
     * Disconnect from LiveKit room
     */
    async disconnect() {
        if (this.room) {
            await this.room.disconnect();
            this.room = null;
        }
        this.isConnected = false;
    }
    
    /**
     * Send a message to the room (if we have permission)
     * @param {string} message - Message to send
     */
    async sendMessage(message) {
        if (!this.room || !this.isConnected) {
            throw new Error('Not connected to room');
        }
        
        try {
            const encoder = new TextEncoder();
            const data = encoder.encode(message);
            
            await this.room.localParticipant.publishData(data, DataPacket_Kind.RELIABLE);
            
        } catch (error) {
            log(`Failed to send message: ${error.message}`, 'ERROR');
            throw error;
        }
    }
    
    /**
     * Get room information
     * @returns {Object} Room status
     */
    getRoomInfo() {
        if (!this.room) return null;
        
        return {
            connected: this.isConnected,
            participantCount: this.room.participants.size,
            roomName: this.room.name,
            localParticipant: this.room.localParticipant?.identity
        };
    }
}

/**
 * Helper function to get LiveKit token from Pump.fun API
 * @param {string} tokenMint - The token mint address
 * @param {string} sessionCookie - Pump.fun session cookie
 * @returns {Promise<Object>} LiveKit connection info
 */
async function getLiveKitToken(tokenMint, sessionCookie) {
    try {
        // This would call Pump.fun's API to get livestream token
        // Based on the chat logs, the endpoint would be something like:
        const response = await fetch(`https://pump.fun/api/livestreams/livekit/token/participant`, {
            headers: {
                'Cookie': sessionCookie,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                mint: tokenMint
            }),
            method: 'POST'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        return data;
        
    } catch (error) {
        log(`Failed to get LiveKit token: ${error.message}`, 'ERROR');
        throw error;
    }
}

module.exports = LiveKitCollector;