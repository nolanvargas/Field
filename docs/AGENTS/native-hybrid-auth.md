# Native hybrid auth (agent)

- **`nativeAuthMode`**: `field.nativeAuthMode` in Preferences — `idp` | `device` | null; mutually exclusive with the other credential store.
- **IdP cache**: MSAL `localStorage` on native; `field://auth` redirect (Android intent + iOS URL scheme).
- **UI gates**: `src/auth/nativeAuthKind.ts` — `useCompactMobileTaskUi`, `useNativeIdpMode`, `useNativeAdminCapable`.
- **FCM**: `MobilePushRegistration` only when `nativeAuthMode === 'device'`.
