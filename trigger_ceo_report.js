const LeaderboardManager = require('./src/stats/LeaderboardManager');

async function triggerCEOReport() {
    console.log('🎯 Triggering manual CEO report generation...');
    
    try {
        const leaderboardManager = new LeaderboardManager();
        
        // Wait a moment for initialization
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        console.log('📊 Generating CEO report...');
        const reportFile = await leaderboardManager.generateManualReport();
        
        if (reportFile) {
            console.log(`✅ CEO Report generated successfully: ${reportFile}`);
            console.log('📤 Report should now be uploaded to GitHub and website updated!');
        } else {
            console.log('❌ Failed to generate CEO report');
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        process.exit(0);
    }
}

triggerCEOReport();