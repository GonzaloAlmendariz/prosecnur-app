// Contrato del staging Windows del LibreOffice de la vista previa (F6.0b, plan de empaquetado P7).
// El staging real (msiextract + gcab sobre el MSI de 356 MB) tarda ~4 min y necesita msitools; aquí se fija
// en milisegundos que nadie lo desarme: la elección del CRT amd64 (no el arm64 que msiextract deja en
// System64), la verificación PE y el cableado con el bundle y el instalador.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { cabineteUnico, crtAmd64, maquinaPE, CRT_IMPRESCINDIBLES } from '../preview-renderer-win.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const leer = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')

const G64 = 'DFEFC2FE_EEE6_424C_841B_D4E66F0C84A3'
const G86 = 'F1670FCA_6780_3657_9C04_AF8005AC8143'
// Forma de `msiinfo export <msi> File` (filas reales de LibreOffice 26.2.6.3, recortadas).
const cabeceraFile = 'File\tComponent_\tFileName\tFileSize\tVersion\tLanguage\tAttributes\tSequence\n' +
  's72\ts72\tl255\ti4\tS72\tS20\tI2\ti4\nFile\tFile\n'
const fila = (clave, comp, nombre, seq) => `${clave}\t${comp}\t${nombre}\t1\t14.44\t0\t512\t${seq}\n`
const tablaFile = cabeceraFile +
  fila('soffice.exe', 'gid_soffice', 'soffice.exe', 1) +
  fila(`vcruntime140.dll_x86.${G86}`, `vcruntime140.dll_system_x86.${G86}`, 'e5c2w6m8.dll|vcruntime140.dll', 19470) +
  fila(`vcruntime140.dll_amd64.${G64}`, `vcruntime140.dll_system_amd64.${G64}`, 'be9mi6by.dll|vcruntime140.dll', 19491) +
  fila(`vcruntime140.dll_arm64.${G64}`, `vcruntime140.dll_system_arm64.${G64}`, '-bjy8rjk.dll|vcruntime140.dll', 19492) +
  fila(`vcruntime140_1.dll_amd64.${G64}`, `vcruntime140_1.dll_system_amd64.${G64}`, 'ts3_tpvm.dll|vcruntime140_1.dll', 19493) +
  fila(`vcruntime140_1.dll_arm64.${G64}`, `vcruntime140_1.dll_system_arm64.${G64}`, 's-sjmuxp.dll|vcruntime140_1.dll', 19494) +
  fila(`msvcp140.dll_amd64.${G64}`, `msvcp140.dll_system_amd64.${G64}`, 'msvcp140.dll', 19479) +
  fila(`msvcp140.dll_arm64.${G64}`, `msvcp140.dll_system_arm64.${G64}`, 'msvcp140.dll', 19480)

test('el CRT se elige por la clave amd64 del merge module: ni x86 ni arm64, aunque compartan destino', () => {
  const crt = crtAmd64(tablaFile)
  assert.deepEqual(crt.map((c) => c.nombre).sort(), ['msvcp140.dll', 'vcruntime140.dll', 'vcruntime140_1.dll'])
  assert.ok(crt.every((c) => c.clave.includes(`_amd64.${G64}`)))
  assert.deepEqual([...CRT_IMPRESCINDIBLES].sort(), ['msvcp140.dll', 'vcruntime140.dll', 'vcruntime140_1.dll'])
})

test('sin el CRT amd64 imprescindible, con duplicados o con una clave que no casa con su archivo, se niega', () => {
  const sinX64 = tablaFile.split('\n').filter((l) => !l.startsWith('vcruntime140_1.dll_amd64')).join('\n')
  assert.throws(() => crtAmd64(sinX64), /imprescindible: vcruntime140_1\.dll/)
  const duplicado = tablaFile + fila(`vcruntime140.dll_amd64.${G86}`, 'otro', 'vcruntime140.dll', 19499)
  assert.throws(() => crtAmd64(duplicado), /dos veces/)
  const cruzado = tablaFile + fila(`concrt140.dll_amd64.${G64}`, 'otro', 'xx.dll|msvcp140_2.dll', 19477)
  assert.throws(() => crtAmd64(cruzado), /no corresponde/)
})

test('el CAB debe ser único y embebido', () => {
  const media = (cabs) => 'DiskId\tLastSequence\tDiskPrompt\tCabinet\tVolumeLabel\tSource\n' +
    'i2\ti4\tL64\tS255\tS32\tS72\nMedia\tDiskId\n' + cabs.map((c, i) => `${i + 1}\t19496\t1\t${c}\tDISK1\t\n`).join('')
  assert.equal(cabineteUnico(media(['#libreoffice1.cab'])), 'libreoffice1.cab')
  assert.throws(() => cabineteUnico(media(['#a.cab', '#b.cab'])), /único CAB/)
  assert.throws(() => cabineteUnico(media(['externo.cab'])), /no está embebido/)
  assert.throws(() => cabineteUnico(media(['#../x.cab'])), /inesperado/)
})

test('la máquina PE distingue x86-64 de arm64 y de lo que no es PE', () => {
  const pe = (maquina) => {
    const b = Buffer.alloc(0x100)
    b.writeUInt16LE(0x5a4d, 0)
    b.writeUInt32LE(0x80, 0x3c)
    b.writeUInt32LE(0x00004550, 0x80)
    b.writeUInt16LE(maquina, 0x84)
    return b
  }
  assert.equal(maquinaPE(pe(0x8664)), 0x8664)
  assert.equal(maquinaPE(pe(0xaa64)), 0xaa64)
  assert.equal(maquinaPE(Buffer.from('no es un ejecutable, es texto plano de relleno suficiente para 64 bytes')), null)
})

test('el staging obtiene el MSI verificado, extrae con msiextract, saca el CRT del CAB y falla cerrado', () => {
  const s = leer('packaging/windows/stage-preview-renderer.sh')
  assert.match(s, /set -euo pipefail/)
  assert.match(s, /LOCK_KEY="win-x64"/)
  assert.match(s, /scripts\/fetch-preview-renderer\.mjs" "\$LOCK_KEY"/)
  assert.match(s, /for cmd in node msiextract msiinfo gcab; do/)
  assert.match(s, /msiextract -C "\$WORK\/msi" "\$MSI"/)
  // El nombre de la carpeta no se adivina: se exige un único */program/soffice.exe.
  assert.match(s, /-path '\*\/program\/soffice\.exe'/)
  assert.match(s, /SOFFICE_HITS\[@\]\}" -ne 1/)
  assert.match(s, /TARGET_TREE="\$DEST_DIR\/LibreOffice"/)
  // El CRT nunca se toma de System64 (mezcla amd64/arm64), sino del CAB por clave.
  assert.doesNotMatch(s, /cp [^\n]*System64/)
  assert.match(s, /node "\$HELPER" crt-amd64/)
  assert.match(s, /gcab -x -n -C "\$WORK\/cab"/)
  assert.match(s, /for required in soffice\.exe soffice\.bin vcruntime140\.dll vcruntime140_1\.dll msvcp140\.dll; do/)
  assert.match(s, /node "\$HELPER" pe-amd64 "\$SOFFICE"/)
  assert.match(s, /trap cleanup_work EXIT/)
})

test('el bundle Windows lleva LibreOffice donde lo resuelven main y el backend, con su aviso', () => {
  const b = leer('packaging/windows/build-self-contained.sh')
  assert.match(b, /PREVIEW_RENDERER_DIR="\$STAGING\/runtime\/preview-renderer"/)
  assert.match(b, /stage-preview-renderer\.sh "\$PREVIEW_RENDERER_DIR"/)
  assert.match(b, /cp packaging\/third-party\/LIBREOFFICE-NOTICE\.md "\$STAGING\/LIBREOFFICE-NOTICE\.md"/)
  assert.match(b, /runtime\/preview-renderer\/LibreOffice\/program\/soffice\.exe" \]/)
  // Stageado antes de cerrar el bundle, del ZIP y del instalador.
  const i = (re) => b.search(re)
  assert.ok(i(/stage-preview-renderer\.sh/) < i(/mv "\$STAGING" "\$OUT_DIR"/))
  assert.ok(i(/mv "\$STAGING" "\$OUT_DIR"/) < i(/makensis/))
  // Rutas que lo encuentran: <Internals>/../runtime/preview-renderer y LibreOffice/program/soffice.exe.
  assert.match(leer('desktop/preview-renderer.cjs'), /path\.join\(path\.dirname\(root\), "runtime", "preview-renderer"\)/)
  const r = leer('api/R/router_graficos.R')
  assert.match(r, /file\.path\(dirname\(app_root\), "runtime", "preview-renderer"\)/)
  assert.match(r, /file\.path\(roots, "LibreOffice", "program", "soffice\.exe"\)/)
  assert.match(leer('packaging/windows/Prosecnur.bat'), /set "PULSO_APP_ROOT=%INTERNALS%"/)
})

test('el instalador borra el aviso al reinstalar y al desinstalar, y el staging está gitignorado', () => {
  const nsi = leer('packaging/windows/installer.nsi')
  assert.equal((nsi.match(/Delete "\$INSTDIR\\LIBREOFFICE-NOTICE\.md"/g) ?? []).length, 2)
  assert.equal((nsi.match(/RMDir \/r "\$INSTDIR\\runtime"/g) ?? []).length, 2)
  const gi = leer('.gitignore')
  assert.match(gi, /^packaging\/windows\/preview-renderer\/$/m)
  assert.match(gi, /^packaging\/windows\/preview-renderer\.work\.\*\/$/m)
})
