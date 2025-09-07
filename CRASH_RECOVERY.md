# 🚨 CRASH RECOVERY GUIDE - PUMP PLAYS POKEMON

## QUICK START (GET BACK ONLINE FAST!)

### Step 1: Check What's Running
```bash
tasklist | findstr node
```

### Step 2: Install Dependencies (if needed)
```bash
npm install
```

### Step 3: Start the System
```bash
set PORT=11000 && set OVERLAY_PORT=11001 && npm start
```

### Step 4: Open the Overlay
```bash
start http://localhost:16001
```
Note: The overlay actually runs on port 16001, not the OVERLAY_PORT env variable

---

## SYSTEM COMPONENTS & STATUS CHECK

### ✅ Core Systems That Should Be Running:
1. **Puppeteer Chat Scraper** - Connects to pump.fun chat
2. **Overlay Server** - Runs on http://localhost:16001
3. **Game Boy Bridge** - Writes commands to `F:\coding\automated gameboyu\commands.txt`
4. **Vote Manager** - 3-second voting periods
5. **CEO Reports** - Generates every 4 hours
6. **Leaderboard Manager** - Updates stats and publishes to GitHub
7. **Surgical HTML Updater** - Updates `F:\coding\PUMPPLAYSPOKEMON\Leaderboard\index.html` with fresh CEO data while preserving layout

### 📊 Key Log Messages to Look For:
- `[CHAT] Connected to Pump.fun chat` - Chat scraper is working
- `[OVERLAY] Overlay server running on http://localhost:16001` - Overlay is up
- `[GAMEBOY] Game Boy Bridge connected successfully` - Game commands working
- `[STATS] CEO report timer started (4-hour intervals)` - Reports scheduled
- `[HTML] ✅ Surgical HTML update completed - layout preserved with fresh data!` - Leaderboard site auto-updating
- `[APP] All systems online! Ready for Pokemon Emerald!` - Full system ready

---

## TROUBLESHOOTING

### If GitHub Push Fails:
This is OKAY! The system continues to run. To fix later:
```bash
git stash
git pull origin main
git stash pop
git add .
git commit -m "Merge local changes"
git push origin main
```

### If Token 404 Errors Appear:
The token `DxKwgDV2NZapgrpdvCHNdWcAByWuXvohKsdUAxcrpump` might not exist on pump.fun anymore. System will continue but may need a new token address.

### If Overlay Won't Load:
1. Check if port 16001 is in use: `netstat -an | findstr 16001`
2. Kill any blocking process: `taskkill /F /PID [process_id]`
3. Restart the system

### To Run in Background:
Add `run_in_background: true` parameter when starting via Claude Code

---

## IMPORTANT FILES & LOCATIONS

- **Main App**: `F:\coding\PUMPPLAYSPOKEMON\src\app.js`
- **Commands Output**: `F:\coding\automated gameboyu\commands.txt`
- **CEO Reports**: `F:\coding\PUMPPLAYSPOKEMON\reports\`
- **Stats Database**: `F:\coding\PUMPPLAYSPOKEMON\stats\stats.json`
- **Leaderboard Site**: `F:\coding\pumpplays-website\`
- **Config**: Check `.env` file for token addresses and settings

---

## CEO REPORTS & LEADERBOARD

### Report Schedule:
- Reports generate every **4 hours** automatically
- Location: `F:\coding\PUMPPLAYSPOKEMON\reports\CEO_Report_[timestamp].txt`
- Latest always copied to: `LATEST_CEO_Report.txt`

### Leaderboard Updates:
- **SURGICAL HTML UPDATER**: Updates `F:\coding\PUMPPLAYSPOKEMON\Leaderboard\index.html` automatically every 4 hours
- Preserves exact page layout while updating with fresh CEO report data
- Auto-commits and pushes to GitHub Pages
- Updates with each vote/command for real-time stats
- Manual CEO report: Use `leaderboardManager.generateManualReport()`

### Critical Files:
- **HTML Site**: `F:\coding\PUMPPLAYSPOKEMON\Leaderboard\index.html` (auto-updated)
- **Surgical Updater**: `F:\coding\PUMPPLAYSPOKEMON\src\stats\surgicalHTMLUpdater.js`
- **Main Manager**: `F:\coding\PUMPPLAYSPOKEMON\src\stats\leaderboardManager.js`

---

## EMERGENCY CONTACTS & RESOURCES

- **GitHub Repo**: https://github.com/natebag/pumpplays
- **Token Address**: DxKwgDV2NZapgrpdvCHNdWcAByWuXvohKsdUAxcrpump
- **Pump.fun Page**: https://pump.fun/[token_address]

---

## QUICK REFERENCE COMMANDS

```bash
# Start everything
set PORT=11000 && set OVERLAY_PORT=11001 && npm start

# Open overlay
start http://localhost:16001

# Check processes
tasklist | findstr node

# Kill all Node processes (nuclear option)
taskkill /F /IM node.exe

# Check latest CEO report
type reports\LATEST_CEO_Report.txt

# View real-time logs (if running in background)
# Use BashOutput tool with the bash_id
```

---

Last Updated: 2025-09-07
System Version: Pump Plays Pokemon with CEO Reports & Leaderboard