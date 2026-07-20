import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const workflowPath = path.join(repoRoot, '.claude/workflows/auditoria-deuda.js')

test('workflow de deuda bloquea parciales antes de sintetizar', () => {
  const source = fs.readFileSync(workflowPath, 'utf8')

  assert.doesNotMatch(source, /\.filter\(Boolean\)/)
  assert.match(source, /resultados\.length !== GRUPOS\.length/)
  assert.match(source, /resultados\.some\(resultado =>[\s\S]*!Array\.isArray\(resultado\.mediciones\)/)
  assert.match(source, /const EJES_ESPERADOS = \[1, 2, 3, 4, 5, 6, 7, 8\]/)
  assert.match(source, /const ejesUnicos = \[\.\.\.new Set\(ejes\)\]/)
  assert.match(source, /se requieren exactamente los ejes únicos 1\.\.8 antes de la síntesis/)

  const validation = source.indexOf("if (!Array.isArray(resultados)")
  const axesValidation = source.indexOf('if (mediciones.length !== EJES_ESPERADOS.length')
  const synthesisPhase = source.indexOf("phase('Síntesis')")
  const synthesisAgent = source.indexOf('const sintesis = await agent(')
  assert.ok(validation >= 0)
  assert.ok(axesValidation > validation)
  assert.ok(synthesisPhase > axesValidation)
  assert.ok(synthesisAgent > synthesisPhase)
})
