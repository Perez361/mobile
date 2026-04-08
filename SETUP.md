# ImportFlow PRO — Mobile App

React Native / Expo equivalent of the ImportFlow PRO web app.

## Tech Stack

- **Expo SDK 54** with Expo Router v5 (file-based routing)
- **NativeWind v4** (Tailwind CSS for React Native)
- **Supabase** — same backend as the web app
- **React Hook Form + Zod** — form validation
- **AsyncStorage** — session persistence (replaces cookies)

## Prerequisites

- Node.js 18+
- Expo CLI: `npm install -g expo-cli`
- For iOS: Xcode + iOS Simulator (macOS only)
- For Android: Android Studio + Emulator

## Setup

```bash
cd mobile
npm install
```

The `.env` file is pre-configured with the Supabase credentials.

## Running

```bash
# Start Metro bundler
npm start

# Open on Android emulator
npm run android

# Open on iOS simulator (macOS only)
npm run ios

# Open in browser (limited)
npm run web
```

Or scan the QR code in the Expo Go app on your phone.

## App Structure

```
app/
├── index.tsx              → Welcome screen (choose Importer or Customer)
├── (auth)/                → Importer login & register
├── (importer)/            → Importer dashboard (tab navigation)
│   ├── index.tsx          → Dashboard KPIs & recent orders
│   ├── products/          → Product management (list, create, edit)
│   ├── orders.tsx         → Order management with status updates
│   ├── customers.tsx      → Customer directory
│   └── analytics.tsx      → Revenue & analytics with period filters
└── store/
    ├── index.tsx          → Enter store slug
    └── [slug]/            → Customer storefront (tab navigation)
        ├── index.tsx      → Product listing
        ├── cart.tsx       → Shopping cart & checkout
        ├── orders.tsx     → Customer order history
        ├── profile.tsx    → Customer profile editor
        ├── login.tsx      → Customer login
        └── register.tsx   → Customer registration
```

## Key Differences from Web App

| Web | Mobile |
|-----|--------|
| Next.js App Router | Expo Router |
| `@supabase/ssr` + cookies | `@supabase/supabase-js` + AsyncStorage |
| Server Actions | Direct Supabase client calls |
| Tailwind CSS (web) | NativeWind v4 (React Native) |
| `NEXT_PUBLIC_` env prefix | `EXPO_PUBLIC_` env prefix |
| localStorage | AsyncStorage |

## Adding App Icons & Splash Screen

Replace the placeholder files in `assets/images/`:
- `icon.png` — 1024×1024 app icon
- `splash.png` — 1284×2778 splash screen
- `adaptive-icon.png` — 1024×1024 Android adaptive icon foreground
- `favicon.png` — 48×48 web favicon
