// @ts-check

/**
 * Build-time Expo config. Reads per-customer data from JSON to avoid
 * transitive TS imports (which Expo's config loader does not transpile).
 *
 * @param {{ config: import('expo/config').ExpoConfig }} _ctx
 * @returns {import('expo/config').ExpoConfig}
 */
module.exports = (_ctx) => {
  const slug = process.env.APP_CUSTOMER ?? 'default';
  let customer;
  switch (slug) {
    case 'default':
      customer = require('./src/platform/config/customers/default.json');
      break;
    default:
      throw new Error(`Unknown customer slug: ${slug}`);
  }

  // Apply env overrides
  customer = {
    ...customer,
    serverBaseUrl: process.env.APP_SERVER_BASE_URL ?? customer.serverBaseUrl,
    apiImpl: process.env.APP_API_IMPL ?? customer.apiImpl,
  };

  return {
    name: customer.brandName,
    slug: `carmen-asset-${customer.customerSlug}`,
    version: '0.1.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    scheme: 'carmenasset',
    plugins: [
      'expo-router',
      [
        'expo-camera',
        { cameraPermission: 'Allow $(PRODUCT_NAME) to use the camera to scan asset codes.' },
      ],
      [
        'expo-image-picker',
        { cameraPermission: 'Allow $(PRODUCT_NAME) to take photos of assets during a count.' },
      ],
    ],
    assetBundlePatterns: ['**/*'],
    ios: {
      supportsTablet: true,
      bundleIdentifier: `com.carmen.asset.${customer.customerSlug}`,
    },
    android: {
      package: `com.carmen.asset.${customer.customerSlug}`,
      adaptiveIcon: {
        backgroundColor: '#E6F4FE',
        foregroundImage: './assets/android-icon-foreground.png',
        backgroundImage: './assets/android-icon-background.png',
        monochromeImage: './assets/android-icon-monochrome.png',
      },
      predictiveBackGestureEnabled: false,
    },
    web: {
      favicon: './assets/favicon.png',
    },
    extra: {
      customer,
    },
  };
};
