// =============================================================================
// Auto-updater — chequea GitHub Releases y notifica al usuario si hay version
// nueva. Solo se activa cuando la app esta empaquetada (no en dev) y cuando
// PROSECNUR_DISABLE_UPDATER no esta seteado.
//
// Flujo:
//   1. App arranca → checkForUpdates() consulta latest.yml en releases.
//   2. Si hay version mayor → descarga el Setup.exe / .dmg en background.
//   3. Cuando termina la descarga → muestra dialogo "Actualizar y reiniciar"
//      / "Despues". Si el usuario acepta, quitAndInstall() ejecuta el nuevo
//      instalador (Prosecnur-Setup.exe /S en Windows, monta el .dmg en mac).
// =============================================================================

// require('electron-updater') puede fallar si el bundle no incluye sus deps
// transitivas (paso pasado en v0.2.1: pnpm symlinks rotos no traian fs-extra).
// Lo cargamos defensivamente: si no se puede, la app sigue funcionando sin
// auto-update en lugar de crashear con "Cannot find module".
let autoUpdater = null;
let loadError = null;
try {
  autoUpdater = require("electron-updater").autoUpdater;
} catch (err) {
  loadError = err;
}
const { dialog } = require("electron");

function setupAutoUpdater({ logger, onUpdateAvailable } = {}) {
  if (loadError) {
    if (logger) logger(`[updater] no se pudo cargar electron-updater: ${loadError.message}`);
    return null;
  }
  if (!require("electron").app.isPackaged) {
    if (logger) logger("[updater] App en modo dev, updater deshabilitado.");
    return null;
  }
  if (process.env.PROSECNUR_DISABLE_UPDATER === "1") {
    if (logger) logger("[updater] Deshabilitado via PROSECNUR_DISABLE_UPDATER=1.");
    return null;
  }

  // Mostrar avisos al usuario solo en transiciones interesantes; el log crudo
  // queda en %APPDATA%\Prosecnur\logs\ via electron-log que electron-updater
  // configura solo. Aca solo redirigimos al logger de la app si nos lo pasaron.
  if (logger) {
    autoUpdater.logger = {
      info: (m) => logger(`[updater] ${m}`),
      warn: (m) => logger(`[updater] WARN ${m}`),
      error: (m) => logger(`[updater] ERROR ${m}`),
      debug: () => {},
    };
  }

  // Por default electron-updater descarga e instala silenciosamente al cerrar
  // la app. Preferimos preguntar al usuario para que tenga control.
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = false;

  autoUpdater.on("update-available", (info) => {
    if (onUpdateAvailable) onUpdateAvailable(info);
  });

  autoUpdater.on("update-downloaded", async (info) => {
    const choice = await dialog.showMessageBox({
      type: "info",
      title: "Actualizacion lista",
      message: `Prosecnur ${info.version} esta listo para instalarse.`,
      detail: "La actualizacion se aplica al reiniciar. Tus proyectos y el runtime de R se conservan.",
      buttons: ["Reiniciar y actualizar", "Mas tarde"],
      defaultId: 0,
      cancelId: 1,
    });
    if (choice.response === 0) {
      // isSilent=true en Windows lanza Setup.exe /S (mi NSIS soporta upgrade
      // in-place silencioso). isForceRunAfter=true reabre la app despues.
      autoUpdater.quitAndInstall(true, true);
    }
  });

  autoUpdater.on("error", (err) => {
    // Errores de red son comunes (offline, firewall, GitHub caido). No los
    // mostramos al usuario, solo log — la app sigue funcionando.
    if (logger) logger(`[updater] error: ${err && err.message ? err.message : err}`);
  });

  // Esperamos un poco antes del primer check para que la UI termine de cargar.
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      if (logger) logger(`[updater] checkForUpdates fallo: ${err && err.message ? err.message : err}`);
    });
  }, 8000);

  return autoUpdater;
}

module.exports = { setupAutoUpdater };
