const EventEmitter = require('events');
const { log } = require('../utils/logger');
const fs = require('fs');
const path = require('path');

class BrowserCollector extends EventEmitter {
    constructor(tokenMint) {
        super();
        this.tokenMint = tokenMint;
        this.isConnected = false;
        this.browser = null;
        this.page = null;
        this.reconnectInterval = null;
        this.messageCount = 0;
    }
    
    /**
     * Connect to Pump.fun using browser automation (fallback method)
     */
    async connect() {
        try {
            // Check if we should disable mock mode
            if (process.env.DISABLE_MOCK_MODE === 'true') {
                log('Mock mode disabled - attempting real pump.fun chat connection', 'CHAT');
                await this.connectToRealChat();
            } else {
                log('Mock mode enabled for testing', 'CHAT');
                this.startMockMode();
            }
            
        } catch (error) {
            log(`Browser collector error: ${error.message}`, 'ERROR');
            this.emit('error', error);
            throw error;
        }
    }
    
    /**
     * Connect to real pump.fun chat using WebSocket
     */
    async connectToRealChat() {
        try {
            log('Starting Puppeteer browser for pump.fun chat scraping', 'CHAT');
            
            // Use Puppeteer to scrape chat from pump.fun website
            const puppeteer = require('puppeteer');
            
            this.browser = await puppeteer.launch({
                headless: false, // Keep visible for streaming
                defaultViewport: null, // Use full window size
                args: [
                    '--no-sandbox', 
                    '--disable-setuid-sandbox',
                    '--disable-web-security',
                    '--disable-features=VizDisplayCompositor',
                    '--disable-dev-shm-usage',
                    '--no-first-run',
                    '--disable-default-apps',
                    '--disable-background-networking',
                    '--disable-background-timer-throttling',
                    '--disable-backgrounding-occluded-windows',
                    '--disable-renderer-backgrounding'
                ]
            });
            
            this.page = await this.browser.newPage();
            
            // Prevent page from closing due to errors
            this.page.on('error', (error) => {
                log(`Page error (continuing): ${error.message}`, 'CHAT');
                // Don't throw - keep page alive
            });
            
            this.page.on('pageerror', (error) => {
                log(`Page script error (continuing): ${error.message}`, 'CHAT');
                // Don't throw - keep page alive
            });
            
            // Keep browser alive on disconnection
            this.browser.on('disconnected', () => {
                log('Browser disconnected - attempting to reconnect...', 'CHAT');
                setTimeout(() => this.reconnectBrowser(), 5000);
            });
            
            // Set session cookie if provided
            if (process.env.PUMP_FUN_SESSION_COOKIE) {
                await this.page.setCookie({
                    name: 'session',
                    value: process.env.PUMP_FUN_SESSION_COOKIE,
                    domain: 'pump.fun'
                });
            }
            
            // Navigate to the token page with more resilient loading
            const tokenUrl = `https://pump.fun/${this.tokenMint}`;
            log(`Navigating to: ${tokenUrl}`, 'CHAT');
            
            try {
                // Try with domcontentloaded first (faster)
                await this.page.goto(tokenUrl, { 
                    waitUntil: 'domcontentloaded',
                    timeout: 60000 // 60 second timeout
                });
                log('Page DOM loaded, waiting for chat elements...', 'CHAT');
            } catch (error) {
                log(`Initial navigation failed: ${error.message}`, 'CHAT');
                // Try again with just load event
                await this.page.goto(tokenUrl, { 
                    waitUntil: 'load',
                    timeout: 60000
                });
            }
            
            // Wait for any chat element to appear (more flexible)
            try {
                await this.page.waitForSelector('[class*="live"], [class*="chat"], .messages, [data-testid*="chat"], body', { 
                    timeout: 30000,
                    visible: true
                });
                log('Chat elements found!', 'CHAT');
            } catch (error) {
                log(`Chat selector not found, but continuing anyway: ${error.message}`, 'CHAT');
                // Continue anyway - we'll still monitor for messages
            }
            
            log('Chat elements found, starting message monitoring', 'CHAT');
            
            // Monitor chat messages with Puppeteer
            this.startChatMonitoring();
            
            this.isConnected = true;
            this.emit('connected');
            log('Connected to real pump.fun chat via browser', 'CHAT');
            
            // Start keep-alive mechanism to prevent timeouts
            this.startKeepAlive();
            
            // Add periodic chat scanning as backup to DOM mutations
            this.startPeriodicChatScan();
            
        } catch (error) {
            log(`Failed to connect to real pump.fun chat: ${error.message}`, 'ERROR');
            throw error;
        }
    }
    
    /**
     * Periodic chat scanning as backup to DOM mutations
     */
    startPeriodicChatScan() {
        this.lastScannedContent = '';
        this.chatLogFile = path.join(process.cwd(), 'chat_log.txt');
        
        // Initialize log file
        fs.writeFileSync(this.chatLogFile, `Chat log started at ${new Date().toISOString()}\n`);
        log(`Chat logging to: ${this.chatLogFile}`, 'CHAT');
        
        this.scanInterval = setInterval(async () => {
            if (this.page && !this.page.isClosed()) {
                try {
                    // Extract all text content from the page and look for new commands
                    const pageContent = await this.page.evaluate(() => {
                        // Look for any text containing ! commands
                        const allText = document.body.innerText || document.body.textContent || '';
                        const lines = allText.split('\n');
                        const recentLines = lines.slice(-50); // Get last 50 lines
                        return recentLines.join('\n');
                    });
                    
                    // Check for new content
                    if (pageContent !== this.lastScannedContent) {
                        const newContent = pageContent.replace(this.lastScannedContent, '');
                        
                        // Log all new content to file
                        if (newContent.trim()) {
                            const timestamp = new Date().toISOString();
                            fs.appendFileSync(this.chatLogFile, `\n[${timestamp}] NEW CONTENT:\n${newContent}\n`);
                            log(`New content detected and logged to file`, 'CHAT');
                        }
                        
                        // Look for commands in new content
                        const commandMatches = newContent.match(/!\w+/g);
                        if (commandMatches) {
                            commandMatches.forEach(cmd => {
                                const timestamp = new Date().toISOString();
                                fs.appendFileSync(this.chatLogFile, `\n[${timestamp}] COMMAND FOUND: ${cmd}\n`);
                                log(`Periodic scan found command: ${cmd}`, 'CHAT');
                                this.emit('message', cmd, 'pump_user');
                                this.messageCount++;
                            });
                        }
                        
                        this.lastScannedContent = pageContent;
                    }
                } catch (error) {
                    log(`Periodic chat scan error: ${error.message}`, 'ERROR');
                }
            }
        }, 3000); // Scan every 3 seconds
    }
    
    /**
     * Keep browser alive with periodic activity
     */
    startKeepAlive() {
        // Keep page active by periodically evaluating a harmless script
        this.keepAliveInterval = setInterval(async () => {
            if (this.page && !this.page.isClosed()) {
                try {
                    // Just check if page is still responsive
                    await this.page.evaluate(() => Date.now());
                } catch (error) {
                    log(`Keep-alive check failed: ${error.message}`, 'CHAT');
                    // Attempt to reconnect
                    this.reconnectBrowser();
                }
            }
        }, 30000); // Every 30 seconds
    }
    
    /**
     * Attempt to reconnect browser if it disconnects
     */
    async reconnectBrowser() {
        if (this.isReconnecting) {
            return; // Already trying to reconnect
        }
        
        this.isReconnecting = true;
        log('Attempting to reconnect browser...', 'CHAT');
        
        try {
            // Clean up existing browser
            if (this.page && !this.page.isClosed()) {
                await this.page.close();
            }
            if (this.browser && this.browser.isConnected()) {
                await this.browser.close();
            }
            
            // Wait a moment then reconnect
            await new Promise(resolve => setTimeout(resolve, 2000));
            await this.connectToRealChat();
            
            log('Browser reconnected successfully', 'CHAT');
        } catch (error) {
            log(`Failed to reconnect browser: ${error.message}`, 'ERROR');
            // Try again in 10 seconds
            setTimeout(() => this.reconnectBrowser(), 10000);
        } finally {
            this.isReconnecting = false;
        }
    }
    
    /**
     * Start monitoring chat messages from the pump.fun page
     */
    async startChatMonitoring() {
        if (!this.page) return;
        
        try {
            // Listen for new chat messages appearing on the page
            await this.page.evaluate(() => {
                console.log('Setting up chat monitoring...');
                
                // Create a MutationObserver to watch for new messages
                const observer = new MutationObserver((mutations) => {
                    console.log(`Mutation observed: ${mutations.length} mutations`);
                    mutations.forEach((mutation) => {
                        mutation.addedNodes.forEach((node) => {
                            if (node.nodeType === 1) { // Element node
                                // Check if this is a chat message element or contains one
                                let chatMessage = null;
                                if (node.hasAttribute && node.hasAttribute('data-message-id')) {
                                    chatMessage = node;
                                } else if (node.querySelector) {
                                    chatMessage = node.querySelector('[data-message-id]');
                                }
                                
                                if (chatMessage) {
                                    console.log('New chat message detected!');
                                    
                                    // Extract message text from the paragraph element
                                    const messageText = chatMessage.querySelector('p.break-words');
                                    const usernameLink = chatMessage.querySelector('a[href*="/profile/"]');
                                    
                                    if (messageText) {
                                        const text = messageText.textContent.trim();
                                        const user = usernameLink ? usernameLink.textContent.trim() : 'anonymous';
                                        
                                        console.log(`Chat message: ${user}: ${text}`);
                                        
                                        // Check for commands starting with !
                                        if (text.startsWith('!') || text.includes('!')) {
                                            const commandMatch = text.match(/!\w+/g);
                                            if (commandMatch) {
                                                commandMatch.forEach(cmd => {
                                                    console.log('PUMP_COMMAND:', JSON.stringify({
                                                        user: user,
                                                        text: cmd
                                                    }));
                                                });
                                            }
                                        }
                                        
                                        // Also log all chat messages
                                        console.log('PUMP_MESSAGE:', JSON.stringify({
                                            user: user,
                                            text: text
                                        }));
                                    }
                                } else {
                                    // Fallback: look for any new text content
                                    const text = node.textContent?.trim() || '';
                                    if (text && text.length > 0 && text.length < 500) {
                                        console.log('New text detected:', text.substring(0, 100));
                                    }
                                }
                            }
                        });
                    });
                });
                
                // Start observing the chat container (target pump.fun live chat specifically)
                const chatSelectors = [
                    '[data-message-id]', // Direct chat message elements
                    'div[data-message-id]', // Chat message divs
                    'body' // Fallback - monitor entire body for new message-id elements
                ];
                
                let chatContainer = null;
                for (const selector of chatSelectors) {
                    chatContainer = document.querySelector(selector);
                    if (chatContainer) {
                        console.log(`Found chat container with selector: ${selector}`);
                        console.log(`Container classes: ${chatContainer.className}`);
                        console.log(`Container ID: ${chatContainer.id}`);
                        break;
                    }
                }
                
                // Look for existing chat messages to understand structure
                const existingMessages = document.querySelectorAll('[data-message-id]');
                console.log(`Found ${existingMessages.length} existing chat messages`);
                if (existingMessages.length > 0) {
                    console.log('Sample message structure:', existingMessages[0].outerHTML.substring(0, 200));
                }
                
                if (chatContainer) {
                    observer.observe(chatContainer, { childList: true, subtree: true });
                    console.log('Chat monitoring started successfully');
                } else {
                    // Still start monitoring on body as fallback
                    observer.observe(document.body, { childList: true, subtree: true });
                    console.log('Chat monitoring started on body (fallback)');
                }
            });
            
            // Listen for messages from the page
            this.page.on('console', (msg) => {
                const text = msg.text();
                if (text.includes('Chat monitoring started')) {
                    log('Chat monitoring active on pump.fun page', 'CHAT');
                } else if (text.includes('Found potential command')) {
                    log(`Browser detected: ${text}`, 'CHAT');
                } else if (text.includes('Found chat container')) {
                    log(`Chat container detected: ${text}`, 'CHAT');
                } else {
                    // Log all console messages for debugging
                    log(`Page console: ${text}`, 'DEBUG');
                }
            });
            
            // Listen for chat commands via postMessage
            await this.page.evaluateOnNewDocument(() => {
                window.addEventListener('message', (event) => {
                    if (event.data.type === 'PUMP_CHAT_COMMAND') {
                        console.log('PUMP_COMMAND:', JSON.stringify(event.data));
                    }
                });
            });
            
            this.page.on('console', (msg) => {
                const text = msg.text();
                if (text.startsWith('PUMP_COMMAND:')) {
                    try {
                        const data = JSON.parse(text.replace('PUMP_COMMAND:', ''));
                        log(`Real chat command: ${data.user}: ${data.text}`, 'CHAT');
                        // Remove ! from command and emit as 'command' event
                        const command = data.text.replace('!', '');
                        log(`Command: ${command} from ${data.user} (weight: 1)`, 'CHAT');
                        log(`🚀 EMITTING COMMAND EVENT IN NODE.JS: ${command} from ${data.user}`, 'DEBUG');
                        // Emit the command event in Node.js context so app.js can receive it
                        this.emit('command', command, data.user);
                        this.messageCount++;
                    } catch (error) {
                        log(`Failed to parse chat command: ${error.message}`, 'ERROR');
                    }
                } else if (text.startsWith('PUMP_MESSAGE:')) {
                    try {
                        const data = JSON.parse(text.replace('PUMP_MESSAGE:', ''));
                        log(`Real chat message: ${data.user}: ${data.text}`, 'CHAT');
                        // Don't emit as command, just log all chat messages
                    } catch (error) {
                        log(`Failed to parse chat message: ${error.message}`, 'ERROR');
                    }
                } else if (text.includes('New chat message detected')) {
                    log('Chat message detection working!', 'CHAT');
                } else if (text.includes('Found') && text.includes('existing chat messages')) {
                    log(text, 'CHAT');
                }
            });
            
        } catch (error) {
            log(`Failed to start chat monitoring: ${error.message}`, 'ERROR');
        }
    }
    
    /**
     * Mock mode for testing without real chat connection
     */
    startMockMode() {
        log('Starting mock chat mode for testing', 'CHAT');
        
        this.isConnected = true;
        this.emit('connected');
        
        // Simulate N64 chat messages for testing
        const mockCommands = [
            // Basic commands
            'up', 'down', 'left', 'right', 'a', 'b', 'start', 'z', 'l', 'r',
            // C-buttons  
            'cup', 'cdown', 'cleft', 'cright',
            // Aliases
            'cu', 'cd', 'cl', 'cr',
            // Hold commands (occasionally)
            'holda', 'holdb 1000', 'holdleft', 'holdstart 500',
            // Momentum commands (occasionally)
            'up50', 'left25', 'right75', 'down100'
        ];
        const mockUsers = ['player1', 'cryptogamer', 'pokemonfan', 'trainer_red', 'stadium_fan', 'n64_master'];
        const mockMessages = [
            'Pokemon Stadium 2 is amazing!',
            'go battle tower!', 
            'lets win some battles',
            'HODL!',
            'moon mission',
            'best N64 stream ever',
            'love this concept',
            'use Z trigger!',
            'stadium mode is epic'
        ];
        
        // Send some immediate !start commands for testing
        setTimeout(() => {
            this.emit('message', '!start', 'test_user1');
            log('Sent !start command for testing', 'CHAT');
        }, 1000);
        
        setTimeout(() => {
            this.emit('message', '!start', 'test_user2');
            log('Sent another !start command for testing', 'CHAT');
        }, 3000);
        
        setInterval(() => {
            const user = mockUsers[Math.floor(Math.random() * mockUsers.length)];
            
            // 40% chance of command, 60% chance of regular chat
            if (Math.random() < 0.4) {
                const command = mockCommands[Math.floor(Math.random() * mockCommands.length)];
                this.emit('message', `!${command}`, user);
            } else if (Math.random() < 0.7) { // Some regular messages
                const message = mockMessages[Math.floor(Math.random() * mockMessages.length)];
                this.emit('message', message, user);
            }
        }, 2000); // Every 2 seconds
        
        log('Mock mode active - generating test commands and chat', 'CHAT');
    }
    
    /**
     * Disconnect from browser/WebSocket
     */
    async disconnect() {
        if (this.reconnectInterval) {
            clearInterval(this.reconnectInterval);
            this.reconnectInterval = null;
        }
        
        if (this.keepAliveInterval) {
            clearInterval(this.keepAliveInterval);
            this.keepAliveInterval = null;
        }
        
        if (this.scanInterval) {
            clearInterval(this.scanInterval);
            this.scanInterval = null;
        }
        
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
        
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        
        if (this.page) {
            await this.page.close();
            this.page = null;
        }
        
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
        
        this.isConnected = false;
        this.emit('disconnected');
    }
    
    /**
     * Get collector status
     */
    getStatus() {
        return {
            connected: this.isConnected,
            mode: 'browser_mock',
            tokenMint: this.tokenMint,
            messagesReceived: this.messageCount
        };
    }
}

/**
 * Real browser implementation would look something like this:
 * 
 * async connectWithPuppeteer() {
 *     const puppeteer = require('puppeteer');
 *     
 *     this.browser = await puppeteer.launch({ 
 *         headless: false,
 *         defaultViewport: null
 *     });
 *     
 *     this.page = await this.browser.newPage();
 *     
 *     // Set session cookie
 *     await this.page.setCookie({
 *         name: 'session',
 *         value: process.env.PUMP_FUN_SESSION_COOKIE,
 *         domain: 'pump.fun'
 *     });
 *     
 *     // Navigate to token page
 *     await this.page.goto(`https://pump.fun/coin/${this.tokenMint}`);
 *     
 *     // Wait for chat to load
 *     await this.page.waitForSelector('.chat-container', { timeout: 10000 });
 *     
 *     // Monitor chat messages
 *     await this.page.evaluate(() => {
 *         const chatContainer = document.querySelector('.chat-container');
 *         const observer = new MutationObserver((mutations) => {
 *             mutations.forEach((mutation) => {
 *                 mutation.addedNodes.forEach((node) => {
 *                     if (node.nodeType === 1 && node.classList.contains('chat-message')) {
 *                         const username = node.querySelector('.username')?.textContent;
 *                         const message = node.querySelector('.message')?.textContent;
 *                         if (username && message) {
 *                             window.postMessage({ type: 'CHAT_MESSAGE', username, message }, '*');
 *                         }
 *                     }
 *                 });
 *             });
 *         });
 *         
 *         observer.observe(chatContainer, { childList: true, subtree: true });
 *     });
 *     
 *     // Listen for chat messages
 *     this.page.on('console', (msg) => {
 *         try {
 *             const data = JSON.parse(msg.text());
 *             if (data.type === 'CHAT_MESSAGE') {
 *                 this.emit('message', data.message, data.username);
 *             }
 *         } catch (e) {
 *             // Ignore non-JSON console messages
 *         }
 *     });
 * }
 */

module.exports = BrowserCollector;