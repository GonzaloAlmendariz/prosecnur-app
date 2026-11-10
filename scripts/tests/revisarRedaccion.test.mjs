import assert from 'node:assert/strict'
import { test } from 'node:test'

import { lineasAnadidas, revisarTexto } from '../revisar-redaccion.mjs'

const reglas = (archivo, texto) => revisarTexto(archivo, texto).map((h) => h.regla)

test('marca comillas angulares en prosa y en código', () => {
  assert.deepEqual(reglas('nota.md', 'El rótulo «Entrega» cambia.'), ['comillas-angulares'])
  assert.deepEqual(reglas('Vista.tsx', '// un comentario con «comillas»'), ['comillas-angulares'])
})

test('el punto medio y la raya cuentan en texto visible, no en comentarios de código', () => {
  assert.deepEqual(reglas('Vista.tsx', '<span>Aulas · Docentes</span>'), ['punto-medio'])
  assert.deepEqual(reglas('motor.R', 'titulo <- "Avance — semana 2"'), ['raya'])
  assert.deepEqual(reglas('Vista.tsx', '// ancho · alto, medido el 4 nov — ver ADR'), [])
  assert.deepEqual(reglas('motor.R', '# base · foco — no llega a la UI'), [])
})

test('en prosa el punto medio se marca siempre', () => {
  assert.deepEqual(reglas('correo.md', 'Lunes · Martes'), ['punto-medio'])
})

test('marca las fórmulas cliché corregidas', () => {
  assert.deepEqual(reglas('a.md', 'Lo que hiciste bien'), ['cliche'])
  assert.deepEqual(reglas('a.md', 'La base sale lista para el análisis'), ['cliche'])
  assert.deepEqual(reglas('a.md', 'No es un reporte, es una conversación'), ['cliche'])
})

test('marca la concordancia con 1 y la plataforma supuesta', () => {
  assert.deepEqual(reglas('Vista.tsx', 'const t = "1 aulas sin aplicador"'), ['concordancia'])
  assert.deepEqual(reglas('Vista.tsx', 'const t = "Reportado en Kobo"'), ['plataforma-supuesta'])
})

test('un texto conforme no produce hallazgos', () => {
  const texto = ['Condiciones de apertura', 'const t = "421 (52.6 %) de las aulas"', 'El rótulo "Entrega" cambia.'].join('\n')
  assert.deepEqual(reglas('Vista.tsx', texto), [])
})

test('lineasAnadidas conserva el número de línea del archivo nuevo y descarta lo borrado', () => {
  const diff = [
    'diff --git a/x.md b/x.md',
    '--- a/x.md',
    '+++ b/x.md',
    '@@ -3,0 +4,2 @@',
    '+primera',
    '+segunda',
    '@@ -9 +11 @@',
    '-vieja',
    '+nueva',
    '--- a/borrado.md',
    '+++ /dev/null',
    '@@ -1 +0,0 @@',
    '-adiós',
  ].join('\n')
  const mapa = lineasAnadidas(diff)
  assert.deepEqual([...mapa.keys()], ['x.md'])
  assert.deepEqual(mapa.get('x.md'), [
    { numero: 4, texto: 'primera' },
    { numero: 5, texto: 'segunda' },
    { numero: 11, texto: 'nueva' },
  ])
})
