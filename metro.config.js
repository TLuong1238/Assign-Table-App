const { getDefaultConfig } = require('expo/metro-config');

// ✅ GET DEFAULT EXPO CONFIG
const config = getDefaultConfig(__dirname);

// ✅ ADD SVG SUPPORT
config.transformer = {
  ...config.transformer,
  babelTransformerPath: require.resolve('react-native-svg-transformer'),
};

config.resolver = {
  ...config.resolver,
  assetExts: config.resolver.assetExts.filter((ext) => ext !== 'svg'),
  sourceExts: [...config.resolver.sourceExts, 'svg'],
};

module.exports = config;