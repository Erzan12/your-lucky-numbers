# Your Lucky Numbers (Expo)

Daily lucky numbers for PCSO Lotto 6/42, Mega Lotto 6/45, Super Lotto 6/49,
Grand Lotto 6/55 and Ultra Lotto 6/58.

- Same numbers all day (seeded by Philippine date + your name), new set at midnight
- Numbers only redraw when you tap the button, not while typing your name
- Optional 8:00 AM daily reminder notification
- Picks avoid commonly played combos (all birthdays, runs, even steps, all odd/even)
- Copy button per game, haptics, light/dark mode

## Setup

```bash
npx create-expo-app@latest lucky-numbers --template blank-typescript
cd lucky-numbers
npx expo install @react-native-async-storage/async-storage expo-clipboard expo-haptics expo-notifications react-native-safe-area-context
```

Then copy these files into the project, replacing `App.tsx`:

```
App.tsx
src/lucky.ts
src/theme.ts
src/notifications.ts
src/components/Ball.tsx
src/components/GameCard.tsx
```

Add the notifications plugin to `app.json` (inside `"expo"`):

```json
"plugins": ["expo-notifications"]
```

Run it:

```bash
npx expo start
```

## Notes

- The reminder is a local notification scheduled on the device, so no server or
  push token is needed. Local notifications work in Expo Go; if your Expo Go
  version gives you trouble with them, use a development build
  (`npx expo run:android`).
- The 8:00 AM reminder uses the phone's local time. Lucky numbers use Philippine
  time (UTC+8), computed directly so it doesn't depend on Intl support in Hermes.
- Every combination has the same odds. The spread rules only reduce the chance
  of splitting a jackpot with people who played birthdays or patterns.
