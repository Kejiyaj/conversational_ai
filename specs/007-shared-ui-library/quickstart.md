# Quickstart: Validate the Shared UI Library

Run from `frontend/`.

## Automated

```bash
npm install
npm test        # Tests in all workspaces
npm run build   # Type checks and builds the website, type checks mobile
npm run bundle:mobile   # Confirms the mobile app bundles for iOS and Android
```

Expected: everything passes, and the website test count matches the count before the move.

## Website

1. Start the backend, then run `npm run web` and open http://localhost:5173.
2. Send a message, open a past chat, rate a reply, and switch the system theme.

Expected: no visible difference from before the move.

## Mobile

Needs Xcode or Android Studio, or Expo Go on a device.

1. Run `npm run mobile` and open the app on a simulator or device.
2. Switch the system theme between light and dark.

Expected: the starter screen shows the Button, text produced by `@convai/core`, and the matching brand palette.

## Failure checks

- Import `@convai/ui/bubble` in `apps/mobile`: type check and bundling should both fail.
- Pass `variant="nope"` to Button in either app: type check should fail.
- Change a value in `tokens.json` without regenerating: `npm test` should fail. After `npm run tokens`, both apps use the new value.
