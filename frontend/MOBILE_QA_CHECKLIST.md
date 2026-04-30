# Mobile & Responsive QA Checklist

## ✅ Completed Implementation Summary

### 🏗️ Foundation (Completed)
- [x] **Viewport Configuration**: Meta viewport with `viewport-fit: cover`, `maximumScale: 5`
- [x] **Safe Area Support**: Tailwind utilities for `env(safe-area-inset-*)` 
- [x] **Breakpoints**: Added `xs: '380px'` breakpoint for smaller devices
- [x] **Touch Target System**: `TouchTarget` component ensures ≥44px on mobile
- [x] **Global CSS**: iOS zoom prevention, touch-action manipulation, overscroll prevention

### 🧭 Navigation & Layout (Completed)  
- [x] **Stacked Navigation**: Mobile shows single pane, desktop shows master-detail
- [x] **Responsive Shell**: `MusicShell` hides rail when content selected on mobile
- [x] **Responsive Topbar**: Different layouts for mobile vs desktop
- [x] **Safe Area Integration**: All edge-touching elements use safe-area padding

### 🎯 UI Components (Completed)
- [x] **ResponsiveModal**: Sheet on mobile, Dialog on desktop
- [x] **ResponsivePopover**: Sheet on mobile, Popover on desktop  
- [x] **ResponsiveDrawer**: Mobile navigation with proper sizing
- [x] **TouchTarget**: Consistent 44px touch targets with haptic feedback
- [x] **Enhanced Dialogs**: Proper mobile sizing with safe-area support
- [x] **Enhanced Popovers**: Collision padding and viewport overflow protection

### 🎵 Music Viewer (Completed)
- [x] **Mobile Header**: Proper wrapping and responsive layout
- [x] **Touch Targets**: All 13+ button instances upgraded to ≥44px
- [x] **Bottom Sheets**: Tom/Capo and Display Settings use sheets on mobile
- [x] **PDF Viewer**: Native device PDF viewer on mobile for better UX
- [x] **Responsive Layout**: Single column layout on mobile with proper spacing

### ✏️ Music Editor (Completed)
- [x] **Tabbed Interface**: Mobile uses tabs ("Editar | Visualizar"), desktop keeps split-pane
- [x] **Mobile Inputs**: All form inputs ≥44px height with 16px font size
- [x] **Toolbar**: Horizontal scroll with proper touch targets
- [x] **Responsive Metadata**: Title/Artist/Key inputs optimized for mobile

### 📋 Tables & Lists (Completed)
- [x] **Music Table**: Card grid on mobile, table on desktop
- [x] **Lists Table**: Card grid on mobile, table on desktop  
- [x] **Grouped View**: Responsive grid with TouchTarget buttons
- [x] **MusicCard Component**: Purpose-built for mobile with actions menu
- [x] **ListCard Component**: Mobile-optimized list display

### 👆 Gestures & Interactions (Completed)
- [x] **Pull-to-Refresh**: Implemented in library rail and main tables
- [x] **Swipe Gestures**: Right swipe = view, left swipe = edit on music cards
- [x] **Haptic Feedback**: Light feedback on TouchTarget interactions, medium on swipes
- [x] **Motion Respect**: `prefers-reduced-motion` support in CSS
- [x] **Custom Hooks**: `usePullToRefresh`, `useSwipe`, `useReducedMotion`

---

## 🧪 QA Validation Tasks

### 📱 Device Testing Checklist

#### **iPhone SE (320px width) - Critical baseline**
- [ ] App loads without horizontal scroll
- [ ] All touch targets ≥44px (visual measurement)
- [ ] Pull-to-refresh works smoothly
- [ ] Navigation flows work (library → music → back)
- [ ] PDF viewer opens natively
- [ ] Chord viewer is legible
- [ ] Editor tabs work properly

#### **iPhone 14 (390px width) - Mainstream**
- [ ] Layout looks balanced and spacious
- [ ] Cards have proper spacing
- [ ] Bottom sheets slide up properly
- [ ] Swipe gestures work on music cards
- [ ] Haptic feedback works (if device supports)

#### **Pixel 7 (412px width) - Android reference**
- [ ] Touch targets feel natural
- [ ] Material Design-ish interactions
- [ ] Pull-to-refresh has proper resistance
- [ ] Navigation drawer swipes properly

#### **iPad Mini (768px) - Tablet boundary**
- [ ] Should still show mobile layout in portrait
- [ ] Desktop layout in landscape
- [ ] Touch targets sized appropriately
- [ ] No awkward in-between states

### 🔍 Accessibility Testing

#### **Manual WCAG 2.2 AA Checks**
- [ ] **Touch Target Size**: All interactive elements ≥44×44px
- [ ] **Color Contrast**: Text meets 4.5:1 ratio (use browser devtools)
- [ ] **Focus Management**: Visible focus indicators on all interactive elements
- [ ] **Motion Respect**: Test with `prefers-reduced-motion: reduce` in devtools
- [ ] **Screen Reader**: Test key flows with VoiceOver/TalkBack
- [ ] **Zoom Support**: Page usable at 200% zoom level
- [ ] **Landscape/Portrait**: All features work in both orientations

#### **Automated axe-core Testing**
```bash
# Install axe-core CLI for testing
npm install -g axe-cli

# Test main pages
axe http://localhost:3000 --tags wcag2a,wcag2aa --mobile
axe http://localhost:3000/music --tags wcag2a,wcag2aa --mobile  
axe http://localhost:3000/lists --tags wcag2a,wcag2aa --mobile
```

### ⚡ Performance Testing

#### **Lighthouse Mobile Scores** (Target: Performance ≥85, A11y ≥95)
```bash
# Test with Lighthouse CLI
lighthouse http://localhost:3000 --preset=mobile --output=html --output-path=./lighthouse-mobile.html
lighthouse http://localhost:3000/music --preset=mobile --output=html --output-path=./lighthouse-music-mobile.html
```

#### **Core Web Vitals** (Mobile 4G simulation)
- [ ] **LCP (Largest Contentful Paint)**: <2.5s
- [ ] **FID (First Input Delay)**: <100ms  
- [ ] **CLS (Cumulative Layout Shift)**: <0.1
- [ ] **TTI (Time to Interactive)**: <3s on 4G

#### **Bundle Analysis**
- [ ] Main bundle <100KB gzipped
- [ ] No unused dependencies in mobile builds
- [ ] Proper code splitting for PDF.js (if used)

### 🔄 Regression Testing

#### **Desktop Functionality**  
- [ ] All desktop features still work normally
- [ ] Master-detail layout unchanged on ≥768px
- [ ] Popovers still work on desktop
- [ ] Editor split-pane works on desktop
- [ ] Table views work on desktop

#### **Cross-Browser Mobile**
- [ ] **Safari Mobile**: iOS 15+ compatibility
- [ ] **Chrome Mobile**: Android compatibility  
- [ ] **Samsung Internet**: Samsung device compatibility
- [ ] **Firefox Mobile**: Alternative browser support

#### **Edge Cases**
- [ ] Very long song titles (>50 chars) wrap properly
- [ ] Empty states display correctly
- [ ] Error states don't break layout
- [ ] Loading states don't cause layout shift
- [ ] Network offline handling

### 🐛 Known Issues to Verify Fixed

#### **Critical Touch Target Violations** 
- [ ] Music panel viewer buttons (previously 28×28px)
- [ ] Editor toolbar buttons  
- [ ] Table action buttons
- [ ] Library rail items
- [ ] Navigation elements

#### **Layout Issues**
- [ ] Horizontal overflow on 320px width
- [ ] Safe area gaps on iPhone X+ devices  
- [ ] Bottom sheets properly positioned
- [ ] PDF viewer doesn't break on mobile

#### **Performance Issues**
- [ ] pdf.js bundle impact on mobile
- [ ] Smooth scrolling in long lists
- [ ] No janky animations
- [ ] Proper loading states

### ✅ Success Criteria

#### **Quantitative Metrics**
- [ ] Zero touch targets <44px (automated lint check)
- [ ] Zero horizontal overflow 320-414px (visual regression)  
- [ ] Lighthouse mobile A11y ≥95, Performance ≥85
- [ ] Core Web Vitals: LCP <2.5s, CLS <0.1, FID <100ms

#### **Qualitative Experience**
- [ ] One-handed navigation feels natural
- [ ] Bottom sheets don't require scrolling to access content
- [ ] Editor is genuinely usable in portrait mode  
- [ ] PDF viewing doesn't frustrate users
- [ ] Lists are quickly scannable
- [ ] App feels native to mobile platform

#### **User Acceptance**
- [ ] Liturgical musicians can effectively use the app on phone
- [ ] No major regressions on desktop workflows
- [ ] Performance feels snappy on mid-range devices
- [ ] Accessibility users can complete core workflows

---

## 🚀 Testing Commands

### Development Server
```bash
cd frontend && npm run dev
```

### Run Accessibility Tests
```bash
# Install if needed
npm install -g axe-cli lighthouse

# Test main pages
axe http://localhost:3000 --mobile --tags wcag2a,wcag2aa
lighthouse http://localhost:3000 --preset=mobile --quiet --chrome-flags="--headless"
```

### Visual Regression Testing (if available)
```bash
# Requires percy or similar setup
npm run test:visual:mobile
```

### Bundle Analysis
```bash
npm run analyze
```

---

**Status**: Ready for comprehensive QA validation ✅
**Last Updated**: April 28, 2026
**Completion**: 8/9 tasks ✅ → Final QA in progress 🧪