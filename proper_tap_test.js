// Proper key tap with down->delay->up sequence
const { exec } = require('child_process');

console.log('Testing proper key tap (down->delay->up) for Project64...');

function properKeyTap(keyName, keyCode, delayMs = 60) {
    console.log(`Sending proper tap for ${keyName} (${keyCode}) with ${delayMs}ms delay...`);
    
    const psScript = `
        Add-Type -AssemblyName System.Windows.Forms
        Add-Type -AssemblyName Microsoft.VisualBasic
        
        # Focus Project64
        $process = Get-Process -Name "Project64" -ErrorAction SilentlyContinue
        if ($process) {
            Write-Host "Focusing Project64..."
            [Microsoft.VisualBasic.Interaction]::AppActivate($process.Id)
            Start-Sleep -Milliseconds 200
            
            Write-Host "Sending ${keyName} key down..."
            [System.Windows.Forms.SendKeys]::SendWait("{${keyCode} down}")
            
            Write-Host "Waiting ${delayMs}ms..."
            Start-Sleep -Milliseconds ${delayMs}
            
            Write-Host "Sending ${keyName} key up..."
            [System.Windows.Forms.SendKeys]::SendWait("{${keyCode} up}")
            
            Write-Host "${keyName} tap complete!"
        } else {
            Write-Host "Project64 not found!"
        }
    `;
    
    exec(`powershell -Command "${psScript}"`, (error, stdout, stderr) => {
        if (error) {
            console.log(`❌ Error: ${error.message}`);
        } else {
            console.log(`✅ ${keyName} tap sent successfully`);
            console.log(`Output: ${stdout}`);
        }
    });
}

// Test START button with proper tap
properKeyTap('START', 'ENTER', 80);

// Test A button after 3 seconds
setTimeout(() => {
    properKeyTap('A_BUTTON', 'X', 80);
}, 3000);