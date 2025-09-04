// Focus Project64 and press START 3 times with 3 second delays
const { exec } = require('child_process');

console.log('Focusing Project64 and pressing START 3 times...');

function focusAndSendStart(attempt) {
    console.log(`\nAttempt ${attempt}: Focusing Project64 and sending START...`);
    
    const psCommand = `
        Add-Type -AssemblyName System.Windows.Forms
        Add-Type -AssemblyName Microsoft.VisualBasic
        
        $process = Get-Process -Name "Project64" -ErrorAction SilentlyContinue
        if ($process) {
            Write-Output "Focusing Project64..."
            [Microsoft.VisualBasic.Interaction]::AppActivate($process.Id)
            Start-Sleep -Milliseconds 500
            Write-Output "Sending START button..."
            [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
            Write-Output "START sent!"
        } else {
            Write-Output "Project64 not found"
        }
    `;
    
    exec(`powershell -Command "${psCommand}"`, (error, stdout, stderr) => {
        if (error) {
            console.log(`❌ Error on attempt ${attempt}: ${error.message}`);
        } else {
            console.log(`✅ Attempt ${attempt} complete`);
            console.log(`Output: ${stdout}`);
        }
    });
}

// Send START 3 times with 3 second delays
focusAndSendStart(1);
setTimeout(() => focusAndSendStart(2), 3000);
setTimeout(() => focusAndSendStart(3), 6000);