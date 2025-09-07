#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const reportsDir = path.join(__dirname, 'Leaderboard/30sec updates');
const latestFile = path.join(reportsDir, 'LATEST_30SEC_Report.txt');

console.log('🔍 Monitoring 30-second reports...');
console.log(`📁 Directory: ${reportsDir}`);
console.log(`📄 Latest file: ${latestFile}`);

let lastModTime = null;
let reportCount = 0;

function checkReports() {
    try {
        // Check if directory exists
        if (!fs.existsSync(reportsDir)) {
            console.log('❌ Reports directory does not exist yet');
            return;
        }
        
        // List all report files
        const files = fs.readdirSync(reportsDir).filter(f => f.startsWith('30SEC_Report_'));
        
        if (files.length !== reportCount) {
            reportCount = files.length;
            console.log(`📊 Found ${reportCount} total reports`);
            
            // Show latest files
            const sortedFiles = files.sort().slice(-3);
            console.log('📋 Latest reports:');
            sortedFiles.forEach(file => {
                const filePath = path.join(reportsDir, file);
                const stats = fs.statSync(filePath);
                console.log(`  - ${file} (${stats.mtime.toLocaleTimeString()})`);
            });
        }
        
        // Check latest file modification
        if (fs.existsSync(latestFile)) {
            const stats = fs.statSync(latestFile);
            const currentModTime = stats.mtime.getTime();
            
            if (lastModTime && currentModTime !== lastModTime) {
                console.log(`✅ LATEST_30SEC_Report.txt updated at ${stats.mtime.toLocaleTimeString()}`);
                
                // Show first few lines of the report
                const content = fs.readFileSync(latestFile, 'utf8');
                const lines = content.split('\n').slice(0, 5);
                console.log('📝 Report preview:');
                lines.forEach(line => console.log(`  ${line}`));
                console.log('');
            }
            
            lastModTime = currentModTime;
        } else {
            console.log('❌ LATEST_30SEC_Report.txt not found');
        }
        
    } catch (error) {
        console.error('❌ Error checking reports:', error.message);
    }
}

console.log('⏰ Checking every 10 seconds...\n');

// Check immediately
checkReports();

// Check every 10 seconds
const interval = setInterval(checkReports, 10000);

// Handle Ctrl+C
process.on('SIGINT', () => {
    console.log('\n🛑 Monitoring stopped');
    clearInterval(interval);
    process.exit(0);
});