const fs = require("fs");
const path = require("path");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function cleanDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  ensureDir(dir);
}

function copyDir(from, to) {
  ensureDir(path.dirname(to));
  fs.cpSync(from, to, { recursive: true, force: true });
}

function main() {
  const webRoot = path.resolve(__dirname, "..");
  const repoRoot = path.resolve(webRoot, "..", "..");
  const toolsRoot = path.join(repoRoot, "tools");
  const toolShellBridge = path.join(repoRoot, "packages", "tool-shell", "bridge.js");
  const publicRoot = path.join(webRoot, "public");
  const toolsPublicRoot = path.join(publicRoot, "tools-app");
  const bridgePublicPath = path.join(publicRoot, "bridge.js");

  if (!fs.existsSync(toolsRoot)) {
    throw new Error(`Tools directory not found: ${toolsRoot}`);
  }
  if (!fs.existsSync(toolShellBridge)) {
    throw new Error(`Bridge file not found: ${toolShellBridge}`);
  }

  cleanDir(toolsPublicRoot);
  copyDir(toolsRoot, toolsPublicRoot);
  fs.copyFileSync(toolShellBridge, bridgePublicPath);

  console.log(`Synced tools to ${toolsPublicRoot}`);
  console.log(`Synced bridge to ${bridgePublicPath}`);
}

main();
