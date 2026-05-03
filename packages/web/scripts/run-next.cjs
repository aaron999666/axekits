const path = require("path");
const { spawnSync } = require("child_process");

const cmd = process.argv[2] || "build";
const cwd = process.cwd();
const patchFile = path.join(cwd, "scripts", "readlink-windows-patch.cjs");

function resolveNextBin() {
  const candidates = [
    path.join(cwd, "node_modules", "next", "dist", "bin", "next"),
    path.join(cwd, "..", "..", "node_modules", "next", "dist", "bin", "next"),
  ];
  for (const p of candidates) {
    try {
      require("fs").accessSync(p);
      return p;
    } catch (_) {}
  }
  throw new Error("Cannot find next binary in local or workspace node_modules.");
}

const nextBin = resolveNextBin();
const args = ["-r", patchFile, nextBin, cmd];
const result = spawnSync(process.execPath, args, {
  stdio: "inherit",
  cwd,
  env: process.env,
});

process.exit(result.status || 0);

