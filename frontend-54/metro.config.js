// Learn more https://expo.io
// FIX: Appended '.js' to the import path to resolve the ES Module subpath error in SDK 54
import { getDefaultConfig } from 'expo/metro-config.js';

/** @type {import('expo/metro-config').MetroConfig} */
// FIX: Using process.cwd() instead of __dirname to support ES Modules
const config = getDefaultConfig(process.cwd());

config.resolver.assetExts.push('wasm');

config.server.enhanceMiddleware = (middleware) => {
  return (req, res, next) => {
    res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    middleware(req, res, next);
  };
};

export default config;
