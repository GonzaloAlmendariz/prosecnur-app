import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import test from 'node:test'
import { formatDocsGovernanceAudit, runDocsGovernanceAudit } from '../check-docs-governance.mjs'

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

function addQaDocument(root, {
  relative = 'docs/qa/plan-vigente.md',
  tipo = 'Plan',
  estado = 'Vigente',
  fecha = '2026-07-30',
  autoridad = 'Equipo QA',
  extra = ''
} = {}) {
  write(root, 'docs/qa/README.md', [
    '# QA',
    '',
    '[Plan vigente](plan-vigente.md)',
    '[Histórico](historico/README.md)',
    ''
  ].join('\n'))
  write(root, 'docs/qa/historico/README.md', '# Índice histórico\n')
  fs.appendFileSync(path.join(root, 'docs/README.md'), '[QA](qa/README.md)\n')
  write(root, relative, [
    '# Documento QA',
    '',
    `Tipo: ${tipo}`,
    `Estado: ${estado}`,
    `Fecha: ${fecha}`,
    `Autoridad: ${autoridad}`,
    extra,
    ''
  ].join('\n'))
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

test('un documento QA vigente con metadatos completos pasa y se cuenta en el reporte', () => {
  const root = fixture()
  addQaDocument(root)
  const result = runDocsGovernanceAudit(root)
  assert.deepEqual(result.errors, [])
  assert.deepEqual(result.report.qaStatusCounts, {
    Vigente: 1,
    'En curso': 0,
    Histórico: 0,
    Reemplazado: 0
  })
  assert.match(formatDocsGovernanceAudit(result), /QA: 1 documentos/)
  assert.match(formatDocsGovernanceAudit(result), /Vigente=1/)
})

test('cada metadato QA obligatorio se valida de forma independiente', async (t) => {
  for (const field of ['Tipo', 'Estado', 'Fecha', 'Autoridad']) {
    await t.test(`falta ${field}`, () => {
      const root = fixture()
      addQaDocument(root)
      const target = path.join(root, 'docs/qa/plan-vigente.md')
      const text = fs.readFileSync(target, 'utf8')
      fs.writeFileSync(target, text.replace(new RegExp(`^${field}:.*\\n`, 'm'), ''))
      const result = runDocsGovernanceAudit(root)
      assert.ok(result.errors.some((error) => error.includes(`${field} ausente o vacío`)))
    })
  }
})

test('estado QA desconocido y fecha ISO imposible fallan', () => {
  const root = fixture()
  addQaDocument(root, { estado: 'Activo', fecha: '2026-02-30' })
  const result = runDocsGovernanceAudit(root)
  assert.ok(result.errors.some((error) => error.includes('Estado QA no canónico')))
  assert.ok(result.errors.some((error) => error.includes('Fecha ISO inválida')))
})

test('un histórico exige Consolidado en con enlace Markdown local', () => {
  const root = fixture()
  addQaDocument(root, { estado: 'Histórico' })
  const result = runDocsGovernanceAudit(root)
  assert.ok(result.errors.some((error) => error.includes('Consolidado en exige un enlace Markdown local')))
})

test('un documento reemplazado exige Reemplazado por con enlace Markdown local', () => {
  const root = fixture()
  addQaDocument(root, { estado: 'Reemplazado' })
  const result = runDocsGovernanceAudit(root)
  assert.ok(result.errors.some((error) => error.includes('Reemplazado por exige un enlace Markdown local')))
})

test('los enlaces de ciclo de vida QA aceptan solo sintaxis Markdown local hacia .md', () => {
  const root = fixture()
  addQaDocument(root, {
    estado: 'Histórico',
    extra: 'Consolidado en: https://example.test/resumen.md'
  })
  const result = runDocsGovernanceAudit(root)
  assert.ok(result.errors.some((error) => error.includes('Consolidado en exige un enlace Markdown local')))
})

test('rutas transitorias fallan únicamente en documentos QA Vigente o En curso', async (t) => {
  const transientPaths = [
    '/Users/alguien/evidencia.png',
    '/private/tmp/evidencia.png',
    '/private/var/evidencia.png',
    '/tmp/evidencia.png',
    'file:///tmp/evidencia.png',
    'tmp/evidencia.png',
    'output/evidencia.png',
    'outputs/evidencia.png',
    'artifacts/evidencia.png',
    'screenshots/evidencia.png'
  ]

  for (const estado of ['Vigente', 'En curso']) {
    await t.test(`${estado} rechaza evidencia transitoria`, () => {
      const root = fixture()
      addQaDocument(root, { estado, extra: transientPaths.join('\n') })
      const result = runDocsGovernanceAudit(root)
      assert.ok(result.errors.some((error) => error.includes('ruta local o transitoria')))
    })
  }

  await t.test('Histórico conserva evidencia transitoria', () => {
    const root = fixture()
    addQaDocument(root, {
      estado: 'Histórico',
      extra: [
        'Consolidado en: [Resumen](historico/README.md)',
        ...transientPaths
      ].join('\n')
    })
    const result = runDocsGovernanceAudit(root)
    assert.deepEqual(result.errors, [])
  })

  await t.test('Reemplazado conserva evidencia transitoria', () => {
    const root = fixture()
    addQaDocument(root, {
      estado: 'Reemplazado',
      extra: [
        'Reemplazado por: [Índice QA](README.md)',
        ...transientPaths
      ].join('\n')
    })
    const result = runDocsGovernanceAudit(root)
    assert.deepEqual(result.errors, [])
  })
})

test('los README de índice QA están exentos de metadatos de ciclo de vida', () => {
  const root = fixture()
  addQaDocument(root)
  const result = runDocsGovernanceAudit(root)
  assert.equal(result.errors.some((error) => /docs\/qa\/(?:historico\/)?README\.md: .*ausente/.test(error)), false)
})
