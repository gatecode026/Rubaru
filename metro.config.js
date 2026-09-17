const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Disable unstable worker threads to prevent Windows worker process initialization failure
if (config.transformer) {
  config.transformer.unstable_workerThreads = false;
}

// Block temporary npm staging folders from file watching
config.resolver.blockList = [
  /node_modules\/\..*/,
  /node_modules\\\..*/,
];

config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  '@react-native/normalize-colors': require.resolve('@react-native/normalize-colors'),
};

module.exports = config;
