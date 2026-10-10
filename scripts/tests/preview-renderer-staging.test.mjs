// Contrato estático del staging macOS del LibreOffice de la vista previa (F6.0b, plan de empaquetado P6).
// El staging real (montar el DMG, ditto, lipo, codesign) sólo corre en macOS con el DMG descargado;
// aquí se fija que nadie lo desarme sin que falle algo en milisegundos.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const leer = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')

test('el staging obtiene el DMG verificado, copia con ditto y verifica arch y firma de la copia', () => {
  const s = leer('packaging/macos/stage-preview-renderer.sh')
  assert.match(s, /set -euo pipefail/)
  assert.match(s, /scripts\/fetch-preview-renderer\.mjs" "\$LOCK_KEY"/)
  assert.match(s, /hdiutil attach -readonly -nobrowse/)
  assert.match(s, /ditto "\$SOURCE_APP" "\$TARGET_APP"/)
  assert.match(s, /lipo -archs "\$SOFFICE"/)
  assert.match(s, /codesign --verify --deep --strict "\$TARGET_APP"/)
  assert.match(s, /trap detach EXIT/)
  // Mapeo de arch de electron-builder a la clave del lock y a lipo.
  assert.match(s, /arm64\) LOCK_KEY="mac-arm64"; LIPO_ARCH="arm64"/)
  assert.match(s, /x64\)\s+LOCK_KEY="mac-x64";\s+LIPO_ARCH="x86_64"/)
})

test('build-dmg.sh stagea por arch, fuera de la limpieza de xattrs, y borra el staging al terminar', () => {
  const s = leer('packaging/macos/build-dmg.sh')
  assert.match(s, /stage-preview-renderer\.sh" "\$arch_eb" "\$PREVIEW_STAGE_DIR\/\$arch_eb"/)
  assert.match(s, /trap cleanup_stages EXIT/)
  assert.match(s, /rm -rf "\$RUNTIME_DIR" "\$PREVIEW_STAGE_DIR"/)
  const limpieza = s.match(/clean_macos_xattrs \\\n([\s\S]*?)\n\n/)
  assert.ok(limpieza, 'no encontré la llamada a clean_macos_xattrs')
  assert.doesNotMatch(limpieza[1], /PREVIEW_STAGE_DIR|preview-renderer/)
})

test('el staging está gitignorado', () => {
  assert.match(leer('.gitignore'), /^packaging\/macos\/preview-renderer\/$/m)
})
