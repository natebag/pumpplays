# 🎮 Pump Plays Pokemon

A real-time interactive Pokemon Red stream where Pump.fun chat viewers control the game through voting!

## 🚀 Features

- **Live Chat Voting**: Viewers type commands like `!up`, `!down`, `!a`, `!b` in Pump.fun chat
- **Token-Weighted Votes**: Recent token buyers get increased voting power
- **Real-time Overlay**: Beautiful OBS overlay showing live votes and game stats
- **Trade Integration**: Visual effects when people buy/sell your token
- **Automatic Input**: Winning moves are sent directly to the emulator

## 📋 Prerequisites

1. **Node.js** (v16 or higher)
2. **BGB Emulator** (already included in `/emulator/`)
3. **Pokemon Red ROM** (already in `/ROM/`)
4. **OBS Studio** (already in `/OBS/`)
5. **Pump.fun livestream access** (you mentioned you have this!)

## ⚙️ Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
1. Copy `.env.example` to `.env`
2. Your token mint is already set: `DxKwgDV2NZapgrpdvCHNdWcAByWuXvohKsdUAxcrpump`
3. For LiveKit chat (optional): Get session cookie from Pump.fun

### 3. Start the System
```bash
# Start the main application
npm start

# In another terminal, verify overlay server
npm run overlay
```

### 4. Setup BGB Emulator
1. Open BGB emulator (`/emulator/bgb.exe`)
2. Load Pokemon Red ROM (`/ROM/Pokemon - Red Version (USA, Europe) (SGB Enhanced).gb`)
3. Make sure BGB window title is \"BGB\" (default)
4. Test controls: The system uses these keys:
   - `!up` → Up Arrow
   - `!down` → Down Arrow  
   - `!left` → Left Arrow
   - `!right` → Right Arrow
   - `!a` → X key
   - `!b` → Z key
   - `!start` → Enter
   - `!select` → Backspace

### 5. Setup OBS Overlay
1. Open OBS Studio
2. Add Browser Source:
   - URL: `http://localhost:3001`
   - Width: 1920
   - Height: 1080
3. Position overlay on your scene

### 6. Go Live on Pump.fun
1. Go to your token page: https://pump.fun/coin/DxKwgDV2NZapgrpdvCHNdWcAByWuXvohKsdUAxcrpump
2. Click \"Create livestream\"
3. Select OBS Virtual Camera as video source
4. Setup audio routing (VB-Audio Cable recommended)
5. Start streaming!

## 🎯 Chat Commands

Viewers can control Pokemon Red by typing these commands in chat:

- `!up` - Move up
- `!down` - Move down  
- `!left` - Move left
- `!right` - Move right
- `!a` - A button (confirm/interact)
- `!b` - B button (cancel/back)
- `!start` - Start button (menu)
- `!select` - Select button

## 💰 Token Integration

- **Vote Weighting**: Recent token buyers get 2x-5x vote power based on purchase amount
- **Visual Effects**: Buys trigger special animations on overlay
- **Trade Monitoring**: Real-time trade feed via PumpPortal WebSocket

## 🛠️ Testing Mode

The system includes a mock chat mode for testing without live chat:

1. Start the application
2. It will generate random test commands every 2 seconds
3. Watch the overlay and emulator respond
4. Perfect for testing your setup before going live!

## 📊 Monitoring

- **Main App**: http://localhost:3000/status
- **Overlay**: http://localhost:3001
- **API State**: http://localhost:3000/state

## 🔧 Troubleshooting

### Emulator Not Responding
- Make sure BGB window is focused
- Check key mappings in EmulatorController.js
- Test manually: run `node -e \"require('./src/emulator/EmulatorController'); new (require('./src/emulator/EmulatorController'))().testInputs()\"`

### Chat Not Working  
- For LiveKit: Get proper session cookie from Pump.fun
- Fallback: System will use mock mode for testing

### Overlay Issues
- Check browser console at http://localhost:3001
- Verify WebSocket connection
- Make sure both servers are running

## 🎮 Pro Tips

1. **Test First**: Use mock mode to verify everything works
2. **Backup Save**: Keep Pokemon save file backups
3. **Moderation**: Consider chat rate limiting for popular streams
4. **Audio**: Route Pokemon game audio through OBS for full experience
5. **Engagement**: Announce vote weights for token holders

## 📝 File Structure

```
src/
├── app.js              # Main application
├── chat/               # Chat collection system
├── voting/             # Vote aggregation logic  
├── emulator/           # BGB emulator control
├── trading/            # Token trade monitoring
├── overlay/            # OBS overlay system
└── utils/              # Utilities and logging
```

## 🚨 Legal Note

This uses your legally owned Pokemon Red cartridge for streaming gameplay with interactive chat elements, similar to the original Twitch Plays Pokemon.

---

**Ready to make Pokemon history on Pump.fun? Let's go!** 🚀