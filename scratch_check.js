const fs = require('fs');
const path = require('path');

async function check() {
  console.log("Starting diagnostic check...");
  try {
    // 1. Resolve Metro config via Expo
    const { getDefaultConfig } = require('@expo/metro-config');
    const config = getDefaultConfig(__dirname);
    console.log("SUCCESS: Resolved Expo Metro Config");

    // 2. Load Metro's Transformer
    const Transformer = require('./node_modules/metro/src/DeltaBundler/Transformer').default || require('./node_modules/metro/src/DeltaBundler/Transformer');
    console.log("SUCCESS: Loaded Metro Transformer class");

    // 3. Try to initialize the Transformer with the config
    // We mock the getOrComputeSha1 function
    const transformer = new Transformer(config, {
      getOrComputeSha1: () => 'mock-sha1'
    });
    console.log("SUCCESS: Created Transformer instance!");
  } catch (error) {
    console.error("\n!!! DIAGNOSTIC FAILURE SOURCE FOUND !!!");
    console.error(error);
  }
}

check();
