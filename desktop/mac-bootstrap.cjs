// =============================================================================
// Mac bootstrap — instalacion del runtime de R en macOS al primer arranque del
// .dmg empaquetado por electron-builder.
//
// Layout esperado dentro del .app/Contents/Resources/:
//   Internals/
//     api/                          motor R
//     launcher/                     scripts launch.R, install-r-deps.R
//     r-mac-runtime/
//       R-<ver>-<arch>.pkg          instalador R para mac (arm64 o x64)
//       r-packages/                 .tgz binarios precompilados para mac
//       install-r-deps-offline.R    script offline igual al de Windows
//
// Flujo:
//   1. Detectar arch de la mac (arm64 vs x64).
//   2. Si /Library/Frameworks/R.framework no existe → installer -pkg con
//      `osascript do shell script ... with administrator privileges` (un
//      solo prompt de password al usuario en toda la vida del producto).
//   3. Si los paquetes R offline no estan instalados → Rscript con el
//      script offline contra los .tgz embebidos.
//
// Las dos verificaciones usan archivos centinela en
// ~/Library/Application Support/Prosecnur/ para no repetir setup en cada
// arranque.
// =============================================================================

const { app, dialog } = require("electron");
const { execFileSync, spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const R_FRAMEWORK = "/Library/Frameworks/R.framework";
const R_BIN = `${R_FRAMEWORK}/Resources/bin/Rscript`;

function macAppSupportDir() {
  return path.join(os.homedir(), "Library", "Application Support", "Prosecnur");
}

function detectedArch() {
  // process.arch en Electron universal devuelve la slice activa (arm64 o x64).
  return process.arch === "arm64" ? "arm64" : "x86_64";
}

function findRPkgInstaller(runtimeDir, arch) {
  if (!fs.existsSync(runtimeDir)) return null;
  // Aceptamos R-<version>-<arch>.pkg (preferido) o R-<version>.pkg generico.
  const entries = fs.readdirSync(runtimeDir);
  const archPkg = entries.find((f) => f.startsWith("R-") && f.includes(arch) && f.endsWith(".pkg"));
  if (archPkg) return path.join(runtimeDir, archPkg);
  const generic = entries.find((f) => f.startsWith("R-") && f.endsWith(".pkg"));
  return generic ? path.join(runtimeDir, generic) : null;
}

function escapeAppleScript(str) {
  return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function runWithAdminPrivileges(cmd, promptText) {
  // do shell script with administrator privileges → un dialogo nativo pide
  // password. Si el user cancela, lanza error.
  const script =
    `do shell script "${escapeAppleScript(cmd)}" ` +
    `with prompt "${escapeAppleScript(promptText)}" ` +
    `with administrator privileges`;
  return new Promise((resolve, reject) => {
    const proc = spawn("/usr/bin/osascript", ["-e", script], { stdio: "pipe" });
    let stderr = "";
    proc.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    proc.on("error", reject);
    proc.on("exit", (code) => {
      if (code === 0) resolve(true);
      else reject(new Error(`osascript exit ${code}: ${stderr.trim()}`));
    });
  });
}

async function installRFramework(rPkg, logger) {
  logger(`[mac-bootstrap] Instalando R desde ${rPkg}`);
  await dialog.showMessageBox({
    type: "info",
    title: "Configuracion inicial de Prosecnur",
    message: "Vamos a instalar el motor estadistico R en tu Mac.",
    detail: "Este paso solo ocurre la primera vez. macOS te va a pedir tu contrasena para instalar R en /Library/Frameworks. La instalacion toma 1-2 minutos.",
    buttons: ["Continuar"],
    defaultId: 0,
  });
  await runWithAdminPrivileges(
    `/usr/sbin/installer -pkg '${rPkg}' -target /`,
    "Prosecnur necesita instalar R 4.5.1"
  );
  if (!fs.existsSync(R_BIN)) {
    throw new Error("R installer corrio pero R.framework no aparece en /Library/Frameworks");
  }
  logger("[mac-bootstrap] R instalado correctamente.");
}

function runRscriptStreaming(args, logger) {
  return new Promise((resolve, reject) => {
    const proc = spawn(R_BIN, args, { stdio: ["ignore", "pipe", "pipe"] });
    proc.stdout.on("data", (chunk) => logger(`[Rscript] ${chunk.toString().trimEnd()}`));
    proc.stderr.on("data", (chunk) => logger(`[Rscript err] ${chunk.toString().trimEnd()}`));
    proc.on("error", reject);
    proc.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`Rscript exit ${code}`))));
  });
}

async function installRPackages(runtimeDir, logger) {
  const offlineScript = path.join(runtimeDir, "install-r-deps-offline.R");
  const packagesDir = path.join(runtimeDir, "r-packages");
  const libraryDir = path.join(macAppSupportDir(), "r-library");
  fs.mkdirSync(libraryDir, { recursive: true });
  logger(`[mac-bootstrap] Instalando paquetes R desde ${packagesDir}`);
  await runRscriptStreaming([offlineScript, packagesDir, libraryDir], logger);
  logger("[mac-bootstrap] Paquetes R instalados.");
}

async function bootstrapMacRuntime({ logger = () => {}, appRoot } = {}) {
  if (process.platform !== "darwin") return { rscriptPath: null, libraryDir: null };
  if (!app.isPackaged) return { rscriptPath: null, libraryDir: null };

  const runtimeDir = path.join(appRoot, "r-mac-runtime");
  const supportDir = macAppSupportDir();
  fs.mkdirSync(supportDir, { recursive: true });

  const rSentinel = path.join(supportDir, "r-framework-installed");
  const pkgSentinel = path.join(supportDir, "r-packages-installed");

  // Paso 1: instalar R framework si no esta.
  if (!fs.existsSync(R_BIN)) {
    const arch = detectedArch();
    const pkg = findRPkgInstaller(runtimeDir, arch);
    if (!pkg) {
      throw new Error(`No encontre R-*.pkg para arch ${arch} en ${runtimeDir}`);
    }
    try {
      await installRFramework(pkg, logger);
      fs.writeFileSync(rSentinel, new Date().toISOString());
    } catch (err) {
      // Si el user cancela el password prompt, notificamos y abortamos.
      await dialog.showMessageBox({
        type: "error",
        title: "No se pudo instalar R",
        message: "Prosecnur no puede continuar sin el motor R.",
        detail: `Detalle: ${err.message}\n\nVuelve a abrir Prosecnur cuando puedas dar la contrasena de administrador.`,
        buttons: ["Cerrar"],
      });
      throw err;
    }
  } else if (!fs.existsSync(rSentinel)) {
    // R ya estaba instalado por afuera (Homebrew, instalacion previa). OK.
    fs.writeFileSync(rSentinel, "pre-existing");
  }

  // Paso 2: instalar paquetes R offline si no estan.
  if (!fs.existsSync(pkgSentinel)) {
    try {
      await installRPackages(runtimeDir, logger);
      fs.writeFileSync(pkgSentinel, new Date().toISOString());
    } catch (err) {
      await dialog.showMessageBox({
        type: "error",
        title: "No se pudieron instalar los paquetes R",
        message: "Falto algun paquete R durante el setup.",
        detail: `Detalle: ${err.message}\n\nRevisa los logs en ~/Library/Logs/Prosecnur/ o vuelve a abrir Prosecnur para reintentar.`,
        buttons: ["Cerrar"],
      });
      throw err;
    }
  }

  return {
    rscriptPath: R_BIN,
    libraryDir: path.join(supportDir, "r-library"),
  };
}

module.exports = { bootstrapMacRuntime, R_BIN };
