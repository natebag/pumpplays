const fs = require('fs');
const path = require('path');

const colors = {
    APP: '\x1b[36m',      // Cyan
    CHAT: '\x1b[32m',     // Green  
    VOTE: '\x1b[33m',     // Yellow
    EMU: '\x1b[35m',      // Magenta
    TRADE: '\x1b[31m',    // Red
    OVERLAY: '\x1b[34m',  // Blue
    ERROR: '\x1b[91m',    // Bright Red
    WS_CHAT: '\x1b[96m',  // Bright Cyan
    PUMPFUN: '\x1b[95m',  // Bright Magenta
    STATS: '\x1b[93m',    // Bright Yellow
    DEBUG: '\x1b[90m',    // Gray
    RESET: '\x1b[0m'      // Reset
};

class Logger {
    constructor() {
        this.logsDir = path.join(__dirname, '../../logs');
        this.currentLogFile = null;
        this.logStream = null;
        this.lastLogDate = null;
        
        // Ensure logs directory exists
        if (!fs.existsSync(this.logsDir)) {
            fs.mkdirSync(this.logsDir, { recursive: true });
        }
        
        // Initialize log file
        this.initLogFile();
    }
    
    initLogFile() {
        const now = new Date();
        const dateStr = this.getDateString(now);
        
        // Check if we need a new log file (new day)
        if (this.lastLogDate !== dateStr) {
            // Close previous stream if exists
            if (this.logStream) {
                this.logStream.end();
            }
            
            // Create new log file with day-month-time format
            const logFileName = `pumpplays_${dateStr}.log`;
            this.currentLogFile = path.join(this.logsDir, logFileName);
            this.lastLogDate = dateStr;
            
            // Create or append to log file
            this.logStream = fs.createWriteStream(this.currentLogFile, { flags: 'a' });
            
            // Write header for new log session
            const sessionHeader = `\n${'='.repeat(80)}\n` +
                                `NEW SESSION STARTED: ${now.toLocaleString()}\n` +
                                `${'='.repeat(80)}\n\n`;
            this.logStream.write(sessionHeader);
        }
    }
    
    getDateString(date) {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        
        // Create 4-hour blocks: 00-03, 04-07, 08-11, 12-15, 16-19, 20-23
        const hourBlock = Math.floor(date.getHours() / 4) * 4;
        const blockHour = String(hourBlock).padStart(2, '0');
        
        // Format: day-month-hourblock (e.g., "09-01-12" for Jan 9, 12-15 block)
        return `${day}-${month}-${blockHour}`;
    }
    
    log(message, type = 'APP') {
        const now = new Date();
        const timestamp = now.toLocaleTimeString();
        const color = colors[type] || colors.APP;
        
        // Console output with color
        console.log(`${color}[${timestamp}] [${type}]${colors.RESET} ${message}`);
        
        // Check if we need a new log file (4-hour block boundary crossed)
        const currentDateStr = this.getDateString(now);
        if (this.lastLogDate !== currentDateStr) {
            this.initLogFile();
        }
        
        // File output without color codes
        const logEntry = `[${now.toISOString()}] [${type}] ${message}\n`;
        if (this.logStream) {
            this.logStream.write(logEntry);
        }
    }
    
    cleanup() {
        if (this.logStream) {
            this.logStream.end();
        }
    }
}

// Create singleton logger instance
const logger = new Logger();

// Export log function for compatibility
function log(message, type = 'APP') {
    logger.log(message, type);
}

// Cleanup on process exit
process.on('exit', () => {
    logger.cleanup();
});

process.on('SIGINT', () => {
    logger.cleanup();
    process.exit(0);
});

module.exports = { log };