#!/usr/bin/env node
// Lectura de las tablas del MSI de LibreOffice para el staging Windows (F6.0b, plan de empaquetado P7).
//
//   node scripts/preview-renderer-win.mjs cabinet   <media.tsv>   → nombre del único CAB embebido
//   node scripts/preview-renderer-win.mjs crt-amd64 <file.tsv>    → "clave<TAB>nombre" del CRT x64
//   node scripts/preview-renderer-win.mjs pe-amd64  <archivo>...  → falla si alguno no es PE x86-64
//
// Los .tsv son la salida de `msiinfo export <msi> Media|File`. No descarga, no firma, no instala.
//
// Por qué existe: el MSI trae el CRT de Visual C++ como merge modules que, al instalar, van a System32
// (y por eso no aparecen en program/). Extraer el MSI no los instala. Además el módulo X64 trae DOS
// juegos con el mismo destino (System64): amd64 y arm64, elegidos en la instalación por la condición
// ARM64CHECK. `msiextract` los escribe en la misma ruta y el último gana: en 26.2.6.3 quedaban DLL arm64
// en System64. Aquí se eligen por la clave de archivo del merge module (`<dll>_amd64.<GUID>`), que es
// la que identifica la variante, y el script las copia del CAB con gcab, nunca desde System64.

import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

// Sin estas tres, soffice.exe no arranca en un Windows sin el redistribuible instalado.
export const CRT_IMPRESCINDIBLES = ['vcruntime140.dll', 'vcruntime140_1.dll', 'msvcp140.dll']

const PE_MAQUINA_AMD64 = 0x8664

// `msiinfo export` emite: nombres de columna, tipos, "<Tabla>\t<claves>" y luego las filas.
export function filasDeTabla(texto) {
  const lineas = String(texto).replace(/\r/g, '').split('\n')
  const columnas = (lineas[0] ?? '').split('\t')
  return lineas.slice(3).filter((l) => l.length > 0).map((l) => {
    const celdas = l.split('\t')
    return Object.fromEntries(columnas.map((c, i) => [c, celdas[i] ?? '']))
  })
}

// El MSI de TDF embebe un solo CAB (`#libreoffice1.cab`). Otro esquema no es el que se verificó: se niega.
export function cabineteUnico(textoMedia) {
  const cabs = filasDeTabla(textoMedia).map((f) => f.Cabinet).filter(Boolean)
  if (cabs.length !== 1) throw new Error(`se esperaba un único CAB en la tabla Media; hay ${cabs.length}`)
  if (!cabs[0].startsWith('#')) throw new Error(`el CAB ${cabs[0]} no está embebido en el MSI`)
  const nombre = cabs[0].slice(1)
  if (!/^[A-Za-z0-9_.-]+$/.test(nombre)) throw new Error(`nombre de CAB inesperado: ${nombre}`)
  return nombre
}

// FileName de MSI: "CORTO~1.DLL|nombre_largo.dll" o sólo "nombre.dll".
const nombreLargo = (fileName) => String(fileName).split('|').pop()

// Archivos del CRT x64: clave `<dll>_amd64.<GUID del merge module>` cuyo nombre largo es esa misma dll.
export function crtAmd64(textoFile) {
  const elegidos = []
  for (const fila of filasDeTabla(textoFile)) {
    const m = /^([a-z0-9_]+\.dll)_amd64\.[0-9A-F_]+$/i.exec(fila.File)
    if (!m) continue
    const nombre = nombreLargo(fila.FileName)
    if (nombre.toLowerCase() !== m[1].toLowerCase()) {
      throw new Error(`la clave ${fila.File} no corresponde a su archivo ${nombre}`)
    }
    elegidos.push({ clave: fila.File, nombre })
  }
  const vistos = new Set()
  for (const { nombre } of elegidos) {
    const k = nombre.toLowerCase()
    if (vistos.has(k)) throw new Error(`el CRT amd64 trae ${nombre} dos veces: no sé cuál copiar`)
    vistos.add(k)
  }
  const faltan = CRT_IMPRESCINDIBLES.filter((n) => !vistos.has(n))
  if (faltan.length) throw new Error(`el MSI no trae el CRT amd64 imprescindible: ${faltan.join(', ')}`)
  return elegidos
}

// Máquina de la cabecera PE (0x8664 = x86-64, 0xAA64 = arm64, 0x14C = x86); null si no es un PE.
export function maquinaPE(buffer) {
  if (buffer.length < 0x40 || buffer.readUInt16LE(0) !== 0x5a4d) return null
  const pe = buffer.readUInt32LE(0x3c)
  if (pe + 6 > buffer.length || buffer.readUInt32LE(pe) !== 0x00004550) return null
  return buffer.readUInt16LE(pe + 4)
}

function leerCabecera(ruta) {
  const fd = fs.openSync(ruta, 'r')
  try {
    const buf = Buffer.alloc(4096)
    const n = fs.readSync(fd, buf, 0, buf.length, 0)
    return buf.subarray(0, n)
  } finally {
    fs.closeSync(fd)
  }
}

function main([orden, ...args]) {
  if (orden === 'cabinet') {
    console.log(cabineteUnico(fs.readFileSync(args[0], 'utf8')))
  } else if (orden === 'crt-amd64') {
    for (const { clave, nombre } of crtAmd64(fs.readFileSync(args[0], 'utf8'))) console.log(`${clave}\t${nombre}`)
  } else if (orden === 'pe-amd64') {
    if (!args.length) throw new Error('pe-amd64 necesita al menos un archivo')
    const malos = args.filter((ruta) => maquinaPE(leerCabecera(ruta)) !== PE_MAQUINA_AMD64)
    if (malos.length) throw new Error(`no son PE x86-64: ${malos.join(', ')}`)
  } else {
    throw new Error('uso: preview-renderer-win.mjs <cabinet|crt-amd64|pe-amd64> ...')
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])) {
  try {
    main(process.argv.slice(2))
  } catch (error) {
    console.error(`[preview-renderer-win] ${error.message}`)
    process.exit(1)
  }
}
