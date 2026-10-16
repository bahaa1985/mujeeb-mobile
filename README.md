# PharmacyDB Mobile

Expo Router client for pharmacy admins and staff pharmacists.

## Configuration

Set `EXPO_PUBLIC_API_BASE_URL` to the backend URL reachable by the device when it cannot be derived from the browser host. In a web browser, the API defaults to the same hostname as the app on port `3000`, so opening Expo web from a phone at `http://<computer-lan-ip>:8081` sends API requests to `http://<computer-lan-ip>:3000`. For an Android emulator, use `http://10.0.2.2:<backend-port>`; `localhost` refers to the device itself. Physical devices using the native app need the backend's LAN or public URL.

Optional Supabase Realtime support uses `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`. Without these values, conversations refresh every 15 seconds.

Push notifications use Expo Push Tokens for both Android and iOS. Initialize this app with EAS (`npx eas-cli@latest init`) and retain the generated `extra.eas.projectId` in the Expo app config. Configure the Android FCM v1 and iOS APNs credentials in EAS, then create a development or production build; push delivery is not available in a standard web browser.

## App structure

Screens are organized under `src/app/(auth)` and `src/app/(app)/(tabs)`. The root layout provides authentication, settings, and React Query; auth and app route layouts redirect based on the hydrated user session. API requests use the Axios client in `src/api.ts`, which attaches the SecureStore token and clears the session on non-login 401 responses.

The Messages screen uses cursor-paginated queries, Supabase Realtime when configured, periodic refresh as a fallback, and a confirmation action for blocking contacts. Inventory listing uses the authenticated `GET /inventory` endpoint with `page`, `limit`, `search`, and `stock=all|in|out` parameters; bulk uploads continue to use the rate-limited JSON endpoint. Notification receipt refreshes cached notifications, and tapping a push alert opens its related conversation when a contact number is present. Admin-only staff management is guarded in both the app and user-management API routes.

NativeWind is configured through `tailwind.config.js`, `babel.config.js`, and `metro.config.js`, with global styles in `src/global.css`. Its role colors follow the web palette: pharmacy admins use emerald and staff pharmacists use sky blue. Arabic is the default language; text direction and the web document's `dir` attribute follow the selected language.

## Run

```bash
npm install
npx expo start
```

Run `npx tsc --noEmit` and `npx expo lint` to validate changes.
