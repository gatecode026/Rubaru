# Rubaru - React Native Expo Application

This project is a React Native app initialized using Expo (Expo Go compatible, managed workflow) with JavaScript only.

## Features & Tech Stack

- **Expo SDK 51** (latest stable) - Managed workflow
- **Expo Router** - File-based routing navigation
- **Zustand** - Global state management
- **Axios** - Network request/API client
- **@tanstack/react-query** - Server state caching and queries
- **@react-native-async-storage/async-storage** - Local persistence
- **ESLint & Prettier** - Configured for Javascript code quality
- **Absolute imports** - Configured using `babel-plugin-module-resolver` and `jsconfig.json` aliases (e.g. `@components`, `@screens`, `@store`)

## Project Structure

```
my-app/
├── app/                          # Expo Router (file-based routing)
│   ├── (tabs)/
│   │   ├── _layout.js
│   │   ├── index.js
│   │   └── explore.js
│   ├── _layout.js
│   └── +not-found.js
├── src/
│   ├── components/
│   │   ├── common/
│   │   └── layout/
│   ├── screens/
│   ├── navigation/
│   ├── hooks/
│   ├── store/
│   ├── services/
│   │   └── api.js
│   ├── constants/
│   ├── theme/
│   ├── types/
│   ├── utils/
│   └── assets/
│       ├── images/
│       ├── fonts/
│       └── icons/
```

## Setup & Running the Application

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start the Expo development server**:
   ```bash
   npx expo start
   ```

3. **Open with Expo Go**:
   - Install the **Expo Go** app on your iOS or Android device.
   - Scan the QR code displayed in the terminal/browser window with your device's camera (iOS) or the Expo Go app (Android).
   - Alternatively, press `a` to run on an Android emulator or `i` to run on an iOS simulator (requires emulator/simulator setup).
