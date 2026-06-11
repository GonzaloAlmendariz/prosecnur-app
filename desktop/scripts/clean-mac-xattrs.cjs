const { execFileSync } = require('node:child_process');
const { existsSync } = require('node:fs');
const path = require('node:path');

module.exports = async function cleanMacExtendedAttributes(context) {
  if (!context || context.electronPlatformName !== 'darwin') {
    return;
  }

  const targets = [
    context.appOutDir,
    context.appDir ? path.join(context.appDir, 'node_modules', 'electron', 'dist') : null,
  ].filter(Boolean);

  try {
    for (const target of targets) {
      if (existsSync(target)) {
        execFileSync('xattr', ['-cr', target], { stdio: 'inherit' });
      }
    }
  } catch (error) {
    const message = error && error.message ? error.message : String(error);
    throw new Error(`No se pudieron limpiar atributos extendidos macOS: ${message}`);
  }
};
