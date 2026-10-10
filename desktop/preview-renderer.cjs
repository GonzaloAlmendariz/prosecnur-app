"use strict";

// Dónde está el LibreOffice empaquetado para la vista previa de láminas (F6.0b, plan de empaquetado P4).
//
// Gonzalo, 2026-10-09: «se instala en el instalador de escritorio». El backend R lo busca en
// PROSECNUR_PREVIEW_RENDERER_DIR y, si no está, en rutas relativas al directorio de trabajo
// (router_graficos.R, .preview_renderer_roots). En macOS el directorio de trabajo era la única pista: si
// cambiaba, la vista previa salía vacía sin aviso. Aquí se resuelve la ruta una vez, desde el bundle.

const path = require("node:path");

// macOS: Contents/Resources/Internals/preview-renderer. Windows: <app>/runtime/preview-renderer
// (junto a los otros binarios de terceros) o Internals/preview-renderer.
function previewRendererCandidates(root) {
  return [
    path.join(root, "preview-renderer"),
    path.join(path.dirname(root), "runtime", "preview-renderer")
  ];
}

// Devuelve la carpeta del renderer empaquetado, o "" si no hay ninguna. Una variable ya definida por
// quien lanza la app (desarrollo, pruebas) se respeta.
function resolvePreviewRendererDir(root, env, exists) {
  if (env && env.PROSECNUR_PREVIEW_RENDERER_DIR) return env.PROSECNUR_PREVIEW_RENDERER_DIR;
  for (const candidate of previewRendererCandidates(root)) {
    try {
      if (exists(candidate)) return candidate;
    } catch (_error) {
      // Una ruta ilegible no es el renderer; se sigue con la siguiente.
    }
  }
  return "";
}

module.exports = { previewRendererCandidates, resolvePreviewRendererDir };
