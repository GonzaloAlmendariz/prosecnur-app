#!/usr/bin/env node
// Revisión mecánica de redacción (CLAUDE.md, sección Redacción).
//
// La regla de redacción existía en prosa desde el 2026-11-06 y las quejas por
// cliché siguieron: una regla que nadie ejecuta no frena el error. Este script
// lista, en el texto que se está por entregar, los caracteres y las fórmulas
// que Gonzalo ha corregido más de una vez.
//
// Uso:
//   node scripts/revisar-redaccion.mjs                 líneas añadidas del diff contra HEAD y archivos sin trackear
//   node scripts/revisar-redaccion.mjs a.md b.tsx      archivos completos
//   node scripts/revisar-redaccion.mjs --estricto ...  sale con 1 si hay hallazgos
//
// No es un gate transversal: el árbol tiene deuda histórica (cientos de puntos
// medios en api/R) y un rojo permanente no enseña nada. Revisa lo nuevo.
//
// La lista se amplía cada vez que aparece una corrección nueva. Una regla lleva
// `soloCadenas` cuando solo importa en texto que llega a una persona (literal
// entre comillas o texto JSX) y no en comentarios o código.

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

export const REGLAS = [
  { id: 'comillas-angulares', patron: /[«»]/u, mensaje: 'Comillas angulares: usar comillas dobles rectas.' },
  { id: 'punto-medio', patron: / · /u, soloCadenas: true, mensaje: 'Punto medio como separador: usar coma, dos puntos, paréntesis o una frase.' },
  { id: 'raya', patron: /—/u, soloCadenas: true, mensaje: 'Raya en un texto visible: reescribir con coma, dos puntos o paréntesis.' },
  { id: 'puntos-suspensivos-en-rotulo', patron: /(?:label|title|titulo|rotulo|placeholder)\s*[=:]\s*["'`][^"'`]*…/iu, mensaje: 'Puntos suspensivos en un rótulo.' },
  { id: 'cliche', patron: /\blo que (?:se hace|se muestra|se dice|hiciste bien|importa|necesitas saber)\b/iu, mensaje: 'Fórmula cliché: nombrar el objeto con un sustantivo.' },
  { id: 'cliche', patron: /\bde lo crudo a\b|\bsale list[ao]s? para\b|\ba un clic\b|\bsin fricci[oó]n\b/iu, mensaje: 'Giro publicitario.' },
  { id: 'cliche', patron: /\bno es (?:solo |sólo )?(?:un|una|el|la) [^.,;]{3,40}[,;:] (?:es|sino)\b/iu, mensaje: 'Fórmula "no es X, es Y".' },
  { id: 'plataforma-supuesta', patron: /\b(?:reportad[oa]s?|registrad[oa]s?) en Kobo\b/iu, soloCadenas: true, mensaje: 'No suponer la plataforma: "plataforma" o "reportado en campo".' },
  { id: 'concordancia', patron: /["'`>]\s*1 (?:aulas|encuestas|respuestas|casos|filas|bases|preguntas|secciones|unidades)\b/iu, mensaje: 'Concordancia de número con 1.' },
]

const EXTENSIONES_DE_CODIGO = /\.(?:tsx?|jsx?|mjs|cjs|R|r|css)$/u
const ES_COMENTARIO = /^\s*(?:\/\/|\/\*|\*|#|\{\/\*|<!--)/u
const TIENE_TEXTO_VISIBLE = /["'`]|>[^<>{}]*[\p{L}]/u

/**
 * @param {string} archivo nombre, para decidir si es código o prosa
 * @param {Array<{numero: number, texto: string}>} lineas
 */
export function revisarLineas(archivo, lineas) {
  const esCodigo = EXTENSIONES_DE_CODIGO.test(archivo)
  const hallazgos = []
  for (const { numero, texto } of lineas) {
    const comentario = esCodigo && ES_COMENTARIO.test(texto)
    for (const regla of REGLAS) {
      if (regla.soloCadenas && esCodigo && (comentario || !TIENE_TEXTO_VISIBLE.test(texto))) continue
      const m = regla.patron.exec(texto)
      if (!m) continue
      hallazgos.push({ archivo, linea: numero, regla: regla.id, mensaje: regla.mensaje, fragmento: recorte(texto, m.index) })
    }
  }
  return hallazgos
}

export function revisarTexto(archivo, contenido) {
  return revisarLineas(archivo, contenido.split('\n').map((texto, i) => ({ numero: i + 1, texto })))
}

/** Extrae las líneas añadidas de un `git diff -U0`, con su número en el archivo nuevo. */
export function lineasAnadidas(diff) {
  const porArchivo = new Map()
  let archivo = null
  let numero = 0
  for (const linea of diff.split('\n')) {
    if (linea.startsWith('+++ ')) {
      archivo = linea.startsWith('+++ b/') ? linea.slice(6) : null
      continue
    }
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)/u.exec(linea)
    if (hunk) {
      numero = Number(hunk[1])
      continue
    }
    if (!archivo || !linea.startsWith('+')) continue
    if (!porArchivo.has(archivo)) porArchivo.set(archivo, [])
    porArchivo.get(archivo).push({ numero, texto: linea.slice(1) })
    numero += 1
  }
  return porArchivo
}

function recorte(texto, indice) {
  const desde = Math.max(0, indice - 40)
  return texto.slice(desde, indice + 60).trim()
}

const IGNORADOS = /(?:^|\/)(?:node_modules|dist|\.codex|\.agents)\/|\.(?:test|contract\.test)\.[tj]sx?$|^api\/tests\/|^scripts\/revisar-redaccion\.mjs$|^scripts\/tests\/revisarRedaccion\.test\.mjs$/u

function main(argv) {
  const estricto = argv.includes('--estricto')
  const archivos = argv.filter((a) => !a.startsWith('--'))
  let hallazgos = []
  if (archivos.length) {
    for (const archivo of archivos) hallazgos.push(...revisarTexto(archivo, readFileSync(archivo, 'utf8')))
  } else {
    const diff = execFileSync('git', ['diff', '-U0', '--no-color', 'HEAD'], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })
    for (const [archivo, lineas] of lineasAnadidas(diff)) {
      if (IGNORADOS.test(archivo)) continue
      hallazgos.push(...revisarLineas(archivo, lineas))
    }
    // `git diff HEAD` no ve los archivos sin trackear, que es justo el texto más nuevo.
    const nuevos = execFileSync('git', ['ls-files', '--others', '--exclude-standard', '-z'], { encoding: 'utf8' })
    for (const archivo of nuevos.split('\0').filter(Boolean)) {
      if (IGNORADOS.test(archivo) || !/\.(?:md|txt|tsx?|jsx?|mjs|R|r)$/u.test(archivo)) continue
      hallazgos.push(...revisarTexto(archivo, readFileSync(archivo, 'utf8')))
    }
  }
  for (const h of hallazgos) console.log(`${h.archivo}:${h.linea}: [${h.regla}] ${h.mensaje}\n    ${h.fragmento}`)
  console.log(hallazgos.length ? `\n${hallazgos.length} hallazgos de redacción.` : 'Sin hallazgos de redacción.')
  if (estricto && hallazgos.length) process.exitCode = 1
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main(process.argv.slice(2))
