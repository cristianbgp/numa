# numa.channel — Site Guide

## 🎵 Overview

Your minimalist website for numa sound journals is now complete! The site features a calm, atmospheric design with monospace typography and soft gradients inspired by your artwork aesthetic.

## 📄 Pages

### 1. **Home** (`/`)
- Minimalist intro text
- Embedded latest mix (YouTube)
- Soft gradient background with subtle noise overlay
- **TO UPDATE**: Replace the YouTube embed URL on line 30 of `src/pages/index.astro`

### 2. **Mixes** (`/mixes`)
- Grid layout showcasing all releases
- Each mix has:
  - Cover art with gradient backgrounds
  - Title and description
  - YouTube link
- **TO UPDATE**: Edit the `mixes` array in `src/pages/mixes.astro` (lines 6-27)

### 3. **About** (`/about`)
- Expanded philosophy about numa
- Poetic description of your creative process
- **TO UPDATE**: Customize the text to match your voice

### 4. **Support** (`/support`)
- Ko-fi support link
- Alternative ways to support
- **TO UPDATE**: Replace `yourusername` with your actual Ko-fi username (line 24 of `src/pages/support.astro`)

### 5. **Tools** (`/tools`)
- Artwork generator for creating cover art
- Integrated with your existing generator component

## 🎨 Design Features

### Typography
- **Font**: IBM Plex Mono (monospace)
- Consistent with your cover art aesthetic
- Loaded via Google Fonts

### Color Gradients
Three pre-built gradient classes in `src/styles/global.css`:
- `.gradient-sunset` - warm sunset tones
- `.gradient-evening` - cool evening blues/purples  
- `.gradient-soft` - subtle pastel gradient

### Navigation
- Fixed top navigation bar
- Minimal design with hover effects
- Active page indicator (reduced opacity)

### Atmosphere
- Subtle noise overlay on all pages
- Generous negative space
- Smooth transitions and hover effects

## ✏️ Quick Customization Guide

### Update Latest Mix
1. Open `src/pages/index.astro`
2. Line 30: Replace `dQw4w9WgXcQ` with your YouTube video ID
3. Line 39: Update the mix number and title

### Add/Update Mixes
1. Open `src/pages/mixes.astro`
2. Edit the `mixes` array (lines 6-27)
3. Each mix needs:
   ```js
   {
     number: "numa.XXX",
     title: "mix name",
     description: "description here",
     youtube_url: "https://www.youtube.com/watch?v=YOUR_VIDEO_ID",
     coverGradient: "gradient-sunset" // or "gradient-evening" or custom class
   }
   ```

### Update Ko-fi Link
1. Open `src/pages/support.astro`
2. Line 24: Replace `yourusername` with your Ko-fi username

### Customize Colors
1. Open `src/styles/global.css`
2. Modify gradient definitions (lines 125-148)
3. Use [OKLCH color picker](https://oklch.com/) for best results

## 🚀 Development

```bash
# Start dev server
bun run dev

# Build for production
bun run build

# Preview production build
bum run preview
```

## 📱 Responsive Design

The site is fully responsive with:
- Mobile-first approach
- Adaptive grid layouts (1 column → 2 columns → 3 columns)
- Touch-friendly navigation

## 🎭 Optional Enhancements

Consider adding later:
- Ambient hover sounds (as mentioned in your brief)
- Fade-in animations on page load
- Audio player component (alternative to YouTube embeds)
- Newsletter signup
- More gradient variations for different moods

## 📝 Notes

- All external links open in new tabs
- YouTube embeds are responsive (aspect-video)
- Accessibility features included (semantic HTML, proper ARIA labels)
- Performance optimized (preconnect to Google Fonts)

---

*The site reflects numa's essence: calm, timeless, and clean. A quiet space rather than a typical artist site.*

