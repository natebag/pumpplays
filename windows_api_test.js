// Try using Windows API directly instead of SendKeys
const { exec } = require('child_process');

console.log('Testing Windows API approach to send keys...');

const psScript = `
    Add-Type @"
        using System;
        using System.Runtime.InteropServices;
        public class Win32 {
            [DllImport("user32.dll")]
            public static extern IntPtr FindWindow(string lpClassName, string lpWindowName);
            
            [DllImport("user32.dll")]
            public static extern bool SetForegroundWindow(IntPtr hWnd);
            
            [DllImport("user32.dll")]
            public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
            
            public const int VK_RETURN = 0x0D;
            public const int KEYEVENTF_KEYDOWN = 0x0000;
            public const int KEYEVENTF_KEYUP = 0x0002;
        }
"@

    # Find Project64 window
    $processes = Get-Process -Name "Project64" -ErrorAction SilentlyContinue
    if ($processes) {
        foreach ($process in $processes) {
            Write-Host "Found Project64 process: $($process.Id)"
            Write-Host "Main window handle: $($process.MainWindowHandle)"
            Write-Host "Window title: $($process.MainWindowTitle)"
            
            if ($process.MainWindowHandle -ne 0) {
                Write-Host "Setting foreground window..."
                [Win32]::SetForegroundWindow($process.MainWindowHandle)
                Start-Sleep -Milliseconds 500
                
                Write-Host "Sending ENTER key via keybd_event..."
                [Win32]::keybd_event([Win32]::VK_RETURN, 0, [Win32]::KEYEVENTF_KEYDOWN, 0)
                Start-Sleep -Milliseconds 50
                [Win32]::keybd_event([Win32]::VK_RETURN, 0, [Win32]::KEYEVENTF_KEYUP, 0)
                Write-Host "ENTER key sent via Windows API!"
                break
            }
        }
    } else {
        Write-Host "No Project64 processes found!"
    }
`;

exec(`powershell -Command "${psScript}"`, (error, stdout, stderr) => {
    if (error) {
        console.log(`Error: ${error.message}`);
    }
    if (stderr) {
        console.log(`Stderr: ${stderr}`);
    }
    console.log(`Output: ${stdout}`);
    console.log('Windows API test complete - did Pokemon Stadium 2 respond?');
});