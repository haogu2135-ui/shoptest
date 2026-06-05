const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');

const projectRoot = path.resolve(__dirname, '..', '..');
const frontendRoot = path.resolve(__dirname, '..');

function isRootProcess() {
  return typeof process.getuid === 'function' && process.getuid() === 0;
}

function restoreOwner(targetPath, uid, gid) {
  if (!fs.existsSync(targetPath)) {
    return;
  }
  childProcess.execFileSync('chown', ['-R', `${uid}:${gid}`, targetPath], {
    stdio: 'ignore',
  });
}

if (isRootProcess()) {
  const owner = fs.statSync(projectRoot);
  const targets = [
    path.join(frontendRoot, 'build'),
    path.join(frontendRoot, 'node_modules', '.cache'),
    path.join(frontendRoot, 'public', 'downloads'),
  ];

  targets.forEach((target) => restoreOwner(target, owner.uid, owner.gid));
}
