// Quick test - spam N64 controls to Pokemon Stadium 2 menu
const { exec } = require('child_process');

console.log('🎮 Starting quick N64 control test for Pokemon Stadium 2 menu...');
console.log('This will spam A, B, START, and directional commands every 1 second');

const commands = [
    'a',      // A button (X key)
    'a',      // More A button presses
    'start',  // START button (ENTER key) 
    'a',      // A button
    'b',      // B button (Z key)
    'up',     // Up arrow
    'down',   // Down arrow
    'left',   // Left arrow
    'right',  // Right arrow
    'a',      // A button
    'start'   // START button
];

const controls = {
    'a': 'X',
    'b': 'Z', 
    'start': 'ENTER',
    'up': 'UP',
    'down': 'DOWN',
    'left': 'LEFT',
    'right': 'RIGHT'
};

let commandIndex = 0;

function sendCommand() {
    const command = commands[commandIndex];
    const key = controls[command];
    
    console.log(`Sending: !${command} (${key} key)`);
    
    const psScript = `
        Add-Type -AssemblyName System.Windows.Forms
        Add-Type -AssemblyName Microsoft.VisualBasic
        $process = Get-Process -Name "Project64" -ErrorAction SilentlyContinue
        if ($process) {
            [Microsoft.VisualBasic.Interaction]::AppActivate($process.Id)
            Start-Sleep -Milliseconds 100
            [System.Windows.Forms.SendKeys]::SendWait("{${key}}")
        }
    `;
    
    exec(`powershell -Command "${psScript}"`, (error, stdout, stderr) => {
        if (error) {
            console.log(`Error: ${error.message}`);
        }
    });
    
    commandIndex = (commandIndex + 1) % commands.length;
}

// Send a command every 1 second
const interval = setInterval(sendCommand, 1000);

// Run for 30 seconds then stop
setTimeout(() => {
    clearInterval(interval);
    console.log('🎮 Control test complete! Did Pokemon Stadium 2 respond?');
    process.exit(0);
}, 30000);

console.log('🎮 Test running for 30 seconds... Watch Pokemon Stadium 2!');