import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import test from 'node:test'
import { runDocsGovernanceAudit } from '../check-docs-governance.mjs'

function write(root, relative, content) {
  const target = path.join(root, relative)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, content)
}

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'docs-governance-'))
  write(root, 'README.md', '[Documentación](docs/README.md)\n')
  write(root, 'CLAUDE.md', '# Reglas\n')
  write(root, 'AGENTS.md', '# Agentes\n')
  write(root, '.gitignore', 'tmp/\n')
  write(root, 'docs/README.md', '[Guía](guia.md)\n[ADRs](adrs/README.md)\n')
  write(root, 'docs/guia.md', '# Guía\n')
  write(root, 'docs/adrs/README.md', [
    '# ADRs',
    '',
    '[Plantilla](0000-template.md)',
    '',
    '| ADR | Estado | Fecha | Decisión |',
    '|---|---|---:|---|',
    '| [0001](0001-local.md) | Aceptado | 2026-01-01 | Local |',
    ''
  ].join('\n'))
  write(root, 'docs/adrs/0000-template.md', '# ADR NNNN: Título\n')
  write(root, 'docs/adrs/0001-local.md', [
    '# ADR 0001: Local',
    '',
    'Estado: Aceptado',
    '',
    'Fecha: 2026-01-01',
    '',
    '## Contexto',
    'x',
    '## Decisión',
    'x',
    '## Consecuencias',
    'x',
    '## Cumplimiento',
    'x',
    '## Notas',
    'x',
    ''
  ].join('\n'))
  execFileSync('git', ['init', '-q'], { cwd: root })
  execFileSync('git', ['add', '.'], { cwd: root })
  return root
}

test('un árbol indexado y un ADR coherente pasan', () => {
  const result = runDocsGovernanceAudit(fixture())
  assert.deepEqual(result.errors, [])
  assert.deepEqual(result.warnings, [])
  assert.equal(result.report.markdownFiles, 5)
  assert.equal(result.report.reachable, 5)
  assert.deepEqual(result.report.statusCounts, { Aceptado: 1, Propuesto: 0, Rechazado: 0, Reemplazado: 0 })
})

test('enlaces rotos y documentos huérfanos fallan', () => {
  const root = fixture()
  write(root, 'docs/README.md', '[ADRs](adrs/README.md)\n[Fantasma](no-existe.md)\n')
  const result = runDocsGovernanceAudit(root)
  assert.ok(result.errors.some((error) => error.includes('enlace local inexistente')))
  assert.ok(result.errors.some((error) => error.includes('docs/guia.md: Markdown no alcanzable')))
})

test('desalinear estado del ADR y del índice falla', () => {
  const root = fixture()
  const file = path.join(root, 'docs/adrs/0001-local.md')
  fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('Estado: Aceptado', 'Estado: Propuesto'))
  const result = runDocsGovernanceAudit(root)
  assert.ok(result.errors.some((error) => error.includes('no coincide con índice')))
})

test('un destino local ignorado no vuelve verde un enlace no portable', () => {
  const root = fixture()
  write(root, 'tmp/local.md', '# Solo existe en esta máquina\n')
  fs.appendFileSync(path.join(root, 'docs/README.md'), '[Evidencia](../tmp/local.md)\n')
  const result = runDocsGovernanceAudit(root)
  assert.ok(result.errors.some((error) => error.includes('ignorado o no versionable')))
})

test('un ID duplicado y cumplimiento ausente quedan visibles como deuda', () => {
  const root = fixture()
  const source = fs.readFileSync(path.join(root, 'docs/adrs/0001-local.md'), 'utf8')
  write(root, 'docs/adrs/0001-otro.md', source.replace('# ADR 0001: Local', '# ADR 0001: Otro').replace('## Cumplimiento\nx\n', ''))
  const index = path.join(root, 'docs/adrs/README.md')
  fs.appendFileSync(index, '| [0001 — otro](0001-otro.md) | Aceptado | 2026-01-01 | Otro |\n')
  const result = runDocsGovernanceAudit(root)
  assert.deepEqual(result.errors, [])
  assert.ok(result.warnings.some((warning) => warning.includes('ID 0001 duplicado')))
  assert.ok(result.warnings.some((warning) => warning.includes('falta sección ## Cumplimiento')))
})
