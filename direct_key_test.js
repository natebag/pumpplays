// Direct key test without controller wrapper
const { exec } = require('child_process');

console.log('Direct key test - sending X key to Project64...');

function sendDirectKey(keyName, key) {
    console.log(`Sending ${keyName} (${key}) directly...`);
    
    // Use the exact same pattern as the working controller
    const psCommand = `Add-Type -AssemblyName System.Windows.Forms; Add-Type -AssemblyName Microsoft.VisualBasic; $process = Get-Process -Name "Project64" -ErrorAction SilentlyContinue; if ($process) { [Microsoft.VisualBasic.Interaction]::AppActivate($process.Id); Start-Sleep -Milliseconds 200; [System.Windows.Forms.SendKeys]::SendWait('{${key}}'); } else { Write-Output "No Project64"; }`;
    
    exec(`powershell -Command "${psCommand}"`, (error, stdout, stderr) => {
        if (error) {
            console.log(`❌ Error: ${error.message}`);
        } else {
            console.log(`✅ Sent ${keyName} successfully`);
        }
    });
}

// Test different ways to send X
sendDirectKey('X_with_braces', 'X');
setTimeout(() => sendDirectKey('x_lowercase', 'x'), 1000);
setTimeout(() => {
    console.log('Trying raw x without braces...');
    const psCommand = `Add-Type -AssemblyName System.Windows.Forms; Add-Type -AssemblyName Microsoft.VisualBasic; $process = Get-Process -Name "Project64" -ErrorAction SilentlyContinue; if ($process) { [Microsoft.VisualBasic.Interaction]::AppActivate($process.Id); Start-Sleep -Milliseconds 200; [System.Windows.Forms.SendKeys]::SendWait('x'); }`;
    exec(`powershell -Command "${psCommand}"`, (error) => {
        if (error) {
            console.log(`❌ Raw x error: ${error.message}`);
        } else {
            console.log(`✅ Raw x sent successfully`);
        }
    });
}, 2000);