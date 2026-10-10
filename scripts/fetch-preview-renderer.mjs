#!/usr/bin/env node
// Descarga verificada del LibreOffice que viaja en el instalador (F6.0b, plan de empaquetado P5).
//
//   node scripts/fetch-preview-renderer.mjs <plataforma> [--cache <dir>] [--pin]
//
// <plataforma>: mac-arm64 | mac-x64 | win-x64 (claves de packaging/preview-renderer.lock.json).
// Sin --pin, el archivo descargado debe coincidir con el sha256 del lock; si el lock no lo tiene, se niega.
// Con --pin, calcula el sha256 y lo escribe en el lock: sólo después de verificar a mano la firma .asc de TDF.
// Imprime la ruta del archivo verificado. No firma, no publica, no instala nada.

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const LOCK_PATH = path.join(ROOT, 'packaging', 'preview-renderer.lock.json')
const ORIGEN = 'https://downloadarchive.documentfoundation.org/libreoffice/old/'

export function leerLock(ruta = LOCK_PATH) {
  return JSON.parse(fs.readFileSync(ruta, 'utf8'))
}

// Problemas del lock que impiden usarlo; vacío si está sano. `exigirSha` falla también si falta algún sha256.
export function problemasDelLock(lock, { exigirSha = false } = {}) {
  const problemas = []
  if (!/^\d+\.\d+\.\d+$/.test(String(lock.version ?? ''))) problemas.push('version debe ser X.Y.Z')
  const plataformas = lock.plataformas ?? {}
  for (const clave of ['mac-arm64', 'mac-x64', 'win-x64']) {
    const p = plataformas[clave]
    if (!p) { problemas.push(`falta la plataforma ${clave}`); continue }
    if (!String(p.url ?? '').startsWith(ORIGEN)) problemas.push(`${clave}: la url debe estar en ${ORIGEN}`)
    if (!String(p.url ?? '').includes(`/${lock.version}.`)) problemas.push(`${clave}: la url no es de la versión ${lock.version}`)
    if (p.sha256 !== null && !/^[0-9a-f]{64}$/.test(String(p.sha256))) problemas.push(`${clave}: sha256 inválido`)
    if (exigirSha && p.sha256 === null) problemas.push(`${clave}: sha256 sin fijar`)
  }
  return problemas
}

export function sha256DeArchivo(ruta) {
  return crypto.createHash('sha256').update(fs.readFileSync(ruta)).digest('hex')
}

// ¿El archivo descargado es el del lock? Devuelve { ok, motivo }.
export function verificar(entrada, ruta) {
  if (entrada.sha256 === null) return { ok: false, motivo: 'el lock no tiene sha256: fíjalo con --pin tras verificar la firma .asc' }
  const real = sha256DeArchivo(ruta)
  return real === entrada.sha256 ? { ok: true, motivo: '' } : { ok: false, motivo: `sha256 distinto: ${real}` }
}

async function descargar(url, destino) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status} al descargar ${url}`)
  const tmp = `${destino}.part`
  fs.writeFileSync(tmp, Buffer.from(await res.arrayBuffer()))
  fs.renameSync(tmp, destino)
}

async function main(argv) {
  const plataforma = argv[0]
  const pin = argv.includes('--pin')
  const iCache = argv.indexOf('--cache')
  const cache = iCache >= 0 ? argv[iCache + 1] : path.join(ROOT, 'tmp', 'preview-renderer-cache')
  const lock = leerLock()
  const problemas = problemasDelLock(lock)
  if (problemas.length) throw new Error(`lock inválido: ${problemas.join('; ')}`)
  const entrada = lock.plataformas[plataforma]
  if (!entrada) throw new Error(`plataforma desconocida: ${plataforma} (usa mac-arm64, mac-x64 o win-x64)`)
  fs.mkdirSync(cache, { recursive: true })
  const destino = path.join(cache, path.basename(new URL(entrada.url).pathname))
  if (!fs.existsSync(destino)) await descargar(entrada.url, destino)
  if (pin) {
    entrada.sha256 = sha256DeArchivo(destino)
    fs.writeFileSync(LOCK_PATH, `${JSON.stringify(lock, null, 2)}\n`)
    console.error(`sha256 fijado para ${plataforma}: ${entrada.sha256}`)
  } else {
    const r = verificar(entrada, destino)
    if (!r.ok) throw new Error(`${plataforma}: ${r.motivo}`)
  }
  console.log(destino)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((e) => { console.error(e.message); process.exit(1) })
}
