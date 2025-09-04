const colors = {
    APP: '\x1b[36m',      // Cyan
    CHAT: '\x1b[32m',     // Green  
    VOTE: '\x1b[33m',     // Yellow
    EMU: '\x1b[35m',      // Magenta
    TRADE: '\x1b[31m',    // Red
    OVERLAY: '\x1b[34m',  // Blue
    ERROR: '\x1b[91m',    // Bright Red
    RESET: '\x1b[0m'      // Reset
};

function log(message, type = 'APP') {
    const timestamp = new Date().toLocaleTimeString();
    const color = colors[type] || colors.APP;
    
    console.log(`${color}[${timestamp}] [${type}]${colors.RESET} ${message}`);
}

module.exports = { log };