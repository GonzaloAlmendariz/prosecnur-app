"use strict";

// afterPack de electron-builder (F6.0b, plan de empaquetado P6).
//
// 1. Limpia atributos extendidos como antes (clean-mac-xattrs.cjs).
// 2. En macOS, copia el LibreOffice que dejó packaging/macos/stage-preview-renderer.sh en
//    Contents/Resources/Internals/preview-renderer/LibreOffice.app, donde lo encuentra
//    desktop/preview-renderer.cjs. Se copia con `ditto` y no con extraResources: LibreOffice trae
//    frameworks con symlinks (LibreOfficePython.framework) y la firma de TDF sólo verifica si llegan
//    intactos. La copia va DESPUÉS de limpiar atributos para no tocar lo que firmó TDF.
// 3. Verifica la copia anidada con `codesign --verify --deep --strict`.
//
// Falla cerrado: sin staging no hay build, porque un .app sin renderer deja la vista previa de
// láminas vacía sin aviso. Para un smoke del shell que no lo necesita, PROSECNUR_SKIP_PREVIEW_RENDERER=1
// lo omite con una advertencia explícita.

const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const cleanMacExtendedAttributes = require("./clean-mac-xattrs.cjs");

const REPO_ROOT = path.resolve(__dirname, "..", "..");

// Arch de builder-util (enum numérico) → nombre usado por build-dmg.sh y el staging.
const ARCH_NAMES = { 0: "ia32", 1: "x64", 2: "armv7l", 3: "arm64", 4: "universal" };

function archName(arch) {
  if (typeof arch === "string") return arch;
  const name = ARCH_NAMES[arch];
  if (!name) throw new Error(`Arquitectura desconocida para el renderer de vista previa: ${arch}`);
  return name;
}

function stagedPreviewRendererApp(arch, repoRoot = REPO_ROOT) {
  return path.join(repoRoot, "packaging", "macos", "preview-renderer", archName(arch), "LibreOffice.app");
}

function macResourcesDir(context) {
  const productFilename = context.packager.appInfo.productFilename;
  return path.join(context.appOutDir, `${productFilename}.app`, "Contents", "Resources");
}

function embeddedPreviewRendererApp(resourcesDir) {
  return path.join(resourcesDir, "Internals", "preview-renderer", "LibreOffice.app");
}

function embedPreviewRenderer({ resourcesDir, stagedApp, run = execFileSync, exists = fs.existsSync, log = console.log }) {
  const soffice = path.join(stagedApp, "Contents", "MacOS", "soffice");
  if (!exists(soffice)) {
    throw new Error(
      `Falta el LibreOffice del staging (${soffice}). Corre packaging/macos/stage-preview-renderer.sh ` +
        "o usa packaging/macos/build-dmg.sh; PROSECNUR_SKIP_PREVIEW_RENDERER=1 lo omite sólo para smokes del shell."
    );
  }
  const target = embeddedPreviewRendererApp(resourcesDir);
  fs.rmSync(target, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(target), { recursive: true });
  log(`[preview-renderer] ditto ${stagedApp} -> ${target}`);
  run("ditto", [stagedApp, target], { stdio: "inherit" });
  run("codesign", ["--verify", "--deep", "--strict", target], { stdio: "inherit" });
  log("[preview-renderer] codesign --verify --deep --strict OK sobre la copia anidada");
  return target;
}

module.exports = async function afterPackMac(context) {
  await cleanMacExtendedAttributes(context);
  if (!context || context.electronPlatformName !== "darwin") return;
  if (process.env.PROSECNUR_SKIP_PREVIEW_RENDERER === "1") {
    console.warn("[preview-renderer] ADVERTENCIA: PROSECNUR_SKIP_PREVIEW_RENDERER=1, el .app sale SIN vista previa real.");
    return;
  }
  embedPreviewRenderer({
    resourcesDir: macResourcesDir(context),
    stagedApp: stagedPreviewRendererApp(context.arch)
  });
};

module.exports.archName = archName;
module.exports.stagedPreviewRendererApp = stagedPreviewRendererApp;
module.exports.macResourcesDir = macResourcesDir;
module.exports.embeddedPreviewRendererApp = embeddedPreviewRendererApp;
module.exports.embedPreviewRenderer = embedPreviewRenderer;
