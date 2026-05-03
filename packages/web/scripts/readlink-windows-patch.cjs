/**
 * Windows + Node 24 compatibility patch:
 * Some toolchains call fs.readlink on regular files to detect symlinks.
 * On this environment it throws EISDIR instead of a benign "not a symlink" code.
 * We normalize EISDIR/UNKNOWN/EINVAL to ENOENT-style callback errors so callers skip symlink logic.
 */
const fs = require("fs");

const originalReadlink = fs.readlink;
const originalReadlinkSync = fs.readlinkSync;
const originalReadlinkPromise =
  fs.promises && typeof fs.promises.readlink === "function"
    ? fs.promises.readlink.bind(fs.promises)
    : null;

function normalizeErr(err, pathLike) {
  if (!err) return err;
  if (err.code === "EISDIR" || err.code === "EINVAL" || err.code === "UNKNOWN") {
    const e = new Error(`not a symbolic link: ${pathLike}`);
    e.code = "ENOENT";
    return e;
  }
  return err;
}

fs.readlink = function patchedReadlink(pathLike, options, callback) {
  if (typeof options === "function") {
    callback = options;
    options = undefined;
  }
  return originalReadlink.call(fs, pathLike, options, (err, linkString) => {
    callback(normalizeErr(err, pathLike), linkString);
  });
};

fs.readlinkSync = function patchedReadlinkSync(pathLike, options) {
  try {
    return originalReadlinkSync.call(fs, pathLike, options);
  } catch (err) {
    throw normalizeErr(err, pathLike);
  }
};

if (originalReadlinkPromise) {
  fs.promises.readlink = async function patchedReadlinkPromise(pathLike, options) {
    try {
      return await originalReadlinkPromise(pathLike, options);
    } catch (err) {
      throw normalizeErr(err, pathLike);
    }
  };
}
