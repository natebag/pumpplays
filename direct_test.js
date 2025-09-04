// Direct test based on working pattern from test_n64_input.js
const { exec } = require('child_process');

console.log('Direct A button test for Project64...');

const psScript = `
    Write-Host "Starting A button test..."
    Add-Type -AssemblyName System.Windows.Forms
    Add-Type -AssemblyName Microsoft.VisualBasic
    
    $process = Get-Process -Name "Project64" -ErrorAction SilentlyContinue
    if ($process) {
        Write-Host "Found Project64 process with ID: $($process.Id)"
        Write-Host "Window title: $($process.MainWindowTitle)"
        [Microsoft.VisualBasic.Interaction]::AppActivate($process.Id)
        Start-Sleep -Milliseconds 500
        Write-Host "Sending X key (A button)..."
        [System.Windows.Forms.SendKeys]::SendWait("x")
        Write-Host "X key sent! Did Pokemon Stadium 2 respond?"
    } else {
        Write-Host "Project64 process not found!"
    }
`;

exec(`powershell -Command "${psScript}"`, (error, stdout, stderr) => {
    if (error) {
        console.log(`Error: ${error.message}`);
    }
    if (stderr) {
        console.log(`Stderr: ${stderr}`);
    }
    console.log(`Stdout: ${stdout}`);
    console.log('Test complete - check Pokemon Stadium 2!');
});