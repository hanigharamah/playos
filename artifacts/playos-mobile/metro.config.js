// Learn more: https://docs.expo.dev/guides/monorepos/
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

// Find the monorepo root (walks up from this app dir).
const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "..", "..");

const config = getDefaultConfig(projectRoot);

// 1. Watch every file in the monorepo, not just this app's dir.
config.watchFolders = [workspaceRoot];

// 2. Resolve modules from both the app-local node_modules and the workspace root.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// 3. Force Metro to resolve each package to a single copy — pnpm hoists shared
//    deps to the workspace root, and Metro will duplicate them without this.
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
