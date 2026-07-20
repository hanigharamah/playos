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

// NOTE: deliberately NOT setting disableHierarchicalLookup here. pnpm gives
// each package a strict, nested node_modules (often several levels of
// symlinks deep for transitive deps like `invariant` or `@babel/runtime`),
// and Metro can only reach those by walking up the tree — which is exactly
// what hierarchical lookup does. Disabling it (the common Yarn/npm-hoisted
// monorepo advice) breaks resolution under pnpm and produces "Unable to
// resolve module X" errors for perfectly-installed transitive deps.

module.exports = config;
