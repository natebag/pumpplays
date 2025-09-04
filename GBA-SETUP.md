# GBA Pokemon Emerald Setup

## Quick Start
1. **Start the emulator**: Run `start-gba.bat` to launch mGBA with Pokemon Emerald
2. **Start the app**: Run `node src/app.js` to start the main application  
3. **Open overlay**: Navigate to `http://localhost:3005` in your browser

## Files Updated/Created

### New Files
- `src/emulator/EmulatorControllerGBA.js` - GBA emulator controller
- `config/controls.gba.json` - GBA button mappings and configuration
- `start-gba.bat` - Script to launch mGBA with Pokemon Emerald
- `test-gba.js` - Test script to verify setup

### Updated Files
- `src/app.js` - Updated to use GBA controller instead of N64
- `src/chat/CommandParser.js` - Updated to load GBA controls configuration

## Controls

### Basic Commands
- `!up`, `!down`, `!left`, `!right` - Directional movement
- `!a`, `!b` - Action buttons (A maps to X key, B maps to Z key)
- `!l`, `!r` - Shoulder buttons (L maps to A key, R maps to S key)
- `!start`, `!select` - Menu buttons

### Advanced Commands  
- `!holda` - Hold A button for 500ms (default)
- `!holda 1000` - Hold A button for 1000ms
- `!holdleft 750` - Hold left for 750ms
- `!up25`, `!up50`, `!up100` - Momentum commands (treated as regular movement in GBA)

### Aliases
- `!w` = `!up`
- `!s` = `!down`  
- `!d` = `!right`
- `!space` = `!a`
- `!ctrl` = `!b`
- `!shift` = `!l`
- `!tab` = `!r`

## How It Works

1. **Chat Collection**: Commands from chat are collected and parsed
2. **Vote System**: Commands are voted on with weighted voting based on pump.fun activity
3. **Command Execution**: Winning commands are sent to mGBA via PowerShell SendKeys
4. **Overlay Display**: Real-time voting, chat, and trade effects displayed on overlay

## mGBA Scripting (Future Enhancement)

The documentation at https://mgba.io/docs/scripting.html shows mGBA supports Lua scripting which could provide more robust integration than the current PowerShell approach. This could be implemented later for:
- Better input handling
- Memory reading (for game state detection)
- Save state management
- Screenshot automation

## Testing

Run `node test-gba.js` to verify all components are working correctly.