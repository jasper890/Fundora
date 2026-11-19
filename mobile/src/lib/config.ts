// EXPO_PUBLIC_* values are inlined at build time, so each must be read by its full static name.
export const config = {
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? '',
  webBaseUrl: process.env.EXPO_PUBLIC_WEB_BASE_URL ?? process.env.EXPO_PUBLIC_API_BASE_URL ?? '',
};

export const configError = config.apiBaseUrl
  ? null
  : 'App is not configured. Copy mobile/.env.example to mobile/.env.local and restart Expo.';
