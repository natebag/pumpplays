# 🎮 Pump Plays Pokemon - Hall of Fame Leaderboard

A Gen 3 Pokemon Emerald-style leaderboard website displaying top trainers and voting statistics from the Pump Plays Pokemon stream.

## 🌟 Features

- **Champion & Elite Four Display**: Top 5 users get special Pokemon-themed cards
- **Gym Leaders**: Remaining users displayed as gym leaders
- **Command Statistics**: Visual bars showing most popular commands
- **Auto-refresh**: Updates every 5 minutes with latest data
- **Responsive Design**: Works on desktop, tablet, and mobile
- **Pokemon Aesthetics**: Authentic Gen 3 styling with gradients and animations
- **Easter Eggs**: Konami Code support and special effects

## 🎨 Design Features

- **Authentic Pokemon Emerald Color Palette**: Greens, golds, and purples
- **Pixel-Perfect Typography**: Press Start 2P font for retro feel  
- **Animated Elements**: Sparkle effects, entrance animations, hover states
- **Responsive Grid**: Adapts to different screen sizes
- **Loading States**: Visual feedback during data updates

## 📊 Data Sources

- **Live Stats**: Updates from `/api/leaderboard` endpoint
- **CEO Reports**: Parses latest generated reports from `/reports/`
- **Real-time Votes**: Current voting statistics from the stream

## 🚀 Usage

### Access the Leaderboard
Navigate to: `http://localhost:15000/leaderboard-page/`

### API Endpoints
- `GET /api/leaderboard` - Full leaderboard data with stats
- `GET /leaderboard` - Simple top users list
- `GET /leaderboard/user/:username` - Individual user stats

### Manual Refresh
Open browser console and run: `refreshLeaderboard()`

## 🎮 Easter Eggs

- **Konami Code**: ↑↑↓↓←→←→BA - Activates special champion effects
- **Click Effects**: Cards have satisfying click animations
- **Sparkle Animations**: Dynamic star effects on champion card

## 🛠 Technical Details

### Files
- `index.html` - Main leaderboard page structure
- `styles.css` - Pokemon-themed CSS styling
- `script.js` - Interactive functionality and auto-refresh
- `README.md` - This documentation

### Dependencies
- Google Fonts (Press Start 2P)
- Vanilla JavaScript (no frameworks)
- CSS Grid & Flexbox for layouts

### Browser Support
- Modern browsers with CSS Grid support
- Mobile responsive (iOS Safari, Chrome Mobile)
- Desktop (Chrome, Firefox, Edge, Safari)

## 🎯 Future Enhancements

- [ ] Real-time WebSocket updates
- [ ] User profile pages with detailed stats
- [ ] Historical leaderboard data
- [ ] Pokemon team display integration
- [ ] Sound effects for interactions
- [ ] Additional Pokemon-themed animations

## 🏆 Hall of Fame Categories

1. **Champion** (1st place): Gold card with crown and special effects
2. **Elite Four** (2nd-5th): Purple cards with elite styling
3. **Gym Leaders** (6th+): Compact cards in a grid layout

## 📱 Responsive Breakpoints

- **Desktop**: Full layout with side-by-side elite cards
- **Tablet**: Stacked elite cards, maintained spacing
- **Mobile**: Single column layout, optimized font sizes

---

Built with ❤️ for the Pump Plays Pokemon community!