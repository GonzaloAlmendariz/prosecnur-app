import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import test from 'node:test'

import {
  compareSemVer,
  evaluateReleaseContract,
  runReleaseContractCli
} from '../release-contract.mjs'

function write(root, relative, content) {
  const target = path.join(root, relative)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, content)
}

function git(root, ...args) {
  return execFileSync('git', ['-C', root, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  }).trim()
}

function fixture(t, {
  api = '0.5.19',
  desktop = api,
  inApp = api,
  docs = api,
  docsTable = docs,
  githubNotes = api,
  tags = []
} = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'release-contract-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))

  write(root, 'api/DESCRIPTION', `Package: prosecnurapp\nVersion: ${api}\n`)
  write(root, 'desktop/package.json', `${JSON.stringify({ name: 'prosecnur-desktop', version: desktop }, null, 2)}\n`)
  write(root, 'frontend/src/features/home/releaseNotes.ts', [
    'export const RELEASE_NOTES = [',
    `  { version: "${inApp}", date: "2026-07-30", highlights: [] },`,
    ']',
    ''
  ].join('\n'))
  write(root, 'docs/versiones-app.md', [
    '# Versiones de Prosecnur',
    '',
    '| Version | Estado |',
    '|---|---|',
    `| ${docsTable} | Preparada |`,
    '',
    '## Version actual',
    '',
    `Estamos en \`${docs}\` (corte \`${docs}\`).`,
    ''
  ].join('\n'))
  write(root, '.github/RELEASE_NOTES.md', `# Prosecnur ${githubNotes} — Fixture\n`)

  git(root, 'init', '-q')
  git(root, 'add', '.')
  git(root, '-c', 'user.name=Release Contract', '-c', 'user.email=release@example.test', 'commit', '-qm', 'fixture')
  for (const tag of tags) git(root, 'tag', tag)
  return root
}

function codes(items) {
  return items.map(({ code }) => code)
}

test('compara SemVer numéricamente, no de forma lexicográfica', () => {
  assert.equal(compareSemVer('0.5.19', '0.5.9'), 1)
  assert.equal(compareSemVer('3.10.0', '3.9.99'), 1)
  assert.equal(compareSemVer('4.0.0', '4.0.0'), 0)
  assert.equal(compareSemVer('2.9.9', '3.0.0'), -1)
})

test('preview acepta las cuatro superficies operativas y advierte notas GitHub desfasadas', (t) => {
  const root = fixture(t, {
    githubNotes: '0.5.16',
    tags: ['v0.5.19', 'v3.4.2']
  })

  const result = evaluateReleaseContract(root, { mode: 'preview' })

  assert.equal(result.ok, true)
  assert.equal(result.currentVersion, '0.5.19')
  // v3.4.2 es legacy (ADR 0053): sigue existiendo como tag, pero no cuenta
  // para monotonicidad, así que el máximo comparable es la serie vigente.
  assert.equal(result.maxTag, 'v0.5.19')
  assert.equal(result.recommendedVersion, '1.0.0')
  assert.deepEqual(codes(result.errors), [])
  assert.ok(codes(result.warnings).includes('GITHUB_NOTES_MISMATCH'))
  assert.ok(codes(result.warnings).includes('CURRENT_NOT_ABOVE_TAGS'))
  assert.match(result.warnings.find(({ code }) => code === 'GITHUB_NOTES_MISMATCH').message, /0\.5\.16/)
})

test('la exclusión legacy no tapa un tag ajeno a la lista del ADR 0053', (t) => {
  // Falsabilidad de la exclusión: un 4.1.0 que NO está en LEGACY_RELEASE_TAGS
  // debe seguir bloqueando el corte. Si esta prueba pasara a verde, la
  // exclusión habría dejado de ser una lista cerrada y estaría filtrando por
  // forma —justo lo que el ADR prohíbe.
  const root = fixture(t, {
    githubNotes: '0.5.19',
    tags: ['v0.5.19', 'v3.4.2', 'v4.1.0']
  })

  const result = evaluateReleaseContract(root, { mode: 'prepare' })

  assert.equal(result.maxTag, 'v4.1.0')
  assert.ok(codes(result.errors).includes('CURRENT_NOT_ABOVE_TAGS'))
})

test('prepare deja pasar un corte que supera la serie vigente pese al legacy 3.x', (t) => {
  const root = fixture(t, {
    api: '0.6.0',
    desktop: '0.6.0',
    inApp: '0.6.0',
    docs: '0.6.0',
    githubNotes: '0.6.0',
    tags: ['v0.5.19', 'v3.4.2']
  })

  const result = evaluateReleaseContract(root, { mode: 'prepare' })

  assert.equal(result.maxTag, 'v0.5.19')
  assert.deepEqual(codes(result.errors), [])
  assert.equal(result.targetTag, 'v0.6.0')
})

test('preview falla si una de las cuatro superficies operativas diverge', (t) => {
  const root = fixture(t, { desktop: '0.5.18' })

  const result = evaluateReleaseContract(root, { mode: 'preview' })

  assert.equal(result.ok, false)
  assert.ok(result.errors.some(({ code, surface }) => (
    code === 'SURFACE_VERSION_MISMATCH' && surface === 'desktop'
  )))
})

test('documentación exige que historial y sección de versión actual coincidan', (t) => {
  const root = fixture(t, {
    docs: '4.0.0',
    docsTable: '3.4.2',
    api: '4.0.0',
    tags: ['v3.4.2']
  })

  const result = evaluateReleaseContract(root, { mode: 'preview' })

  assert.equal(result.ok, false)
  assert.ok(result.errors.some(({ code, surface }) => (
    code === 'SURFACE_UNREADABLE' && surface === 'docs'
  )))
})

test('prepare pasa con cinco superficies alineadas, versión mayor y tag libre', (t) => {
  const root = fixture(t, {
    api: '4.0.0',
    tags: ['v0.5.19', 'v3.4.2']
  })

  const result = evaluateReleaseContract(root, { mode: 'prepare' })

  assert.equal(result.ok, true)
  assert.equal(result.targetTag, 'v4.0.0')
  assert.deepEqual(result.errors, [])
  assert.equal(result.recommendedVersion, null)
})

test('prepare diagnostica notas desfasadas, versión no monótona y tag ocupado', (t) => {
  const root = fixture(t, {
    githubNotes: '0.5.16',
    tags: ['v0.5.19', 'v3.4.2']
  })

  const result = evaluateReleaseContract(root, { mode: 'prepare' })

  assert.equal(result.ok, false)
  assert.ok(codes(result.errors).includes('GITHUB_NOTES_MISMATCH'))
  assert.ok(codes(result.errors).includes('CURRENT_NOT_ABOVE_TAGS'))
  assert.ok(codes(result.errors).includes('TARGET_TAG_EXISTS'))
  // Se recomienda sobre la serie vigente, no sobre el legacy 3.x (ADR 0053).
  assert.equal(result.recommendedVersion, '1.0.0')
})

test('stable pasa cuando las cinco superficies coinciden y el tag máximo propio apunta a HEAD', (t) => {
  const root = fixture(t, {
    api: '4.0.0',
    tags: ['v3.4.2', 'v4.0.0']
  })

  const result = evaluateReleaseContract(root, {
    mode: 'stable',
    tag: 'v4.0.0'
  })

  assert.equal(result.ok, true)
  assert.equal(result.targetVersion, '4.0.0')
  assert.equal(result.targetCommit, result.headCommit)
  assert.deepEqual(result.errors, [])
})

test('stable excluye su propio tag, pero exige superar todos los demás', (t) => {
  // La versión anterior de esta prueba usaba v3.4.1 y v3.4.2, que el ADR 0053
  // volvió legacy: al quedar ambos fuera de la comparación no había nada que
  // superar y la prueba pasaba por vacío. Se rehace sobre la serie vigente,
  // que es donde la monotonicidad sigue siendo estricta.
  const root = fixture(t, {
    api: '0.5.18',
    desktop: '0.5.18',
    inApp: '0.5.18',
    docs: '0.5.18',
    githubNotes: '0.5.18',
    tags: ['v0.5.18', 'v0.5.19']
  })

  const result = evaluateReleaseContract(root, {
    mode: 'stable',
    tag: 'v0.5.18'
  })

  assert.equal(result.ok, false)
  assert.ok(codes(result.errors).includes('TARGET_NOT_ABOVE_OTHER_TAGS'))
  assert.equal(result.comparisonMaxTag, 'v0.5.19')
  assert.equal(result.recommendedVersion, '1.0.0')
})

test('stable exige las cinco superficies y que el tag exista en HEAD', (t) => {
  const root = fixture(t, {
    api: '4.0.0',
    githubNotes: '3.4.2',
    tags: ['v3.4.2']
  })

  const result = evaluateReleaseContract(root, {
    mode: 'stable',
    tag: 'v4.0.0'
  })

  assert.equal(result.ok, false)
  assert.ok(result.errors.some(({ code, surface }) => (
    code === 'SURFACE_VERSION_MISMATCH' && surface === 'githubNotes'
  )))
  assert.ok(codes(result.errors).includes('TARGET_TAG_MISSING'))
})

test('stable falla si el tag existe pero apunta a otro commit', (t) => {
  const root = fixture(t, {
    api: '4.0.0',
    tags: ['v3.4.2', 'v4.0.0']
  })
  write(root, 'README.md', '# Commit posterior al tag\n')
  git(root, 'add', 'README.md')
  git(root, '-c', 'user.name=Release Contract', '-c', 'user.email=release@example.test', 'commit', '-qm', 'advance HEAD')

  const result = evaluateReleaseContract(root, {
    mode: 'stable',
    tag: 'v4.0.0'
  })

  assert.equal(result.ok, false)
  assert.ok(codes(result.errors).includes('TARGET_TAG_NOT_AT_HEAD'))
  assert.notEqual(result.targetCommit, result.headCommit)
})

test('stable rechaza prereleases: el contrato admite sólo vX.Y.Z', (t) => {
  const root = fixture(t, { api: '4.0.0', tags: ['v3.4.2'] })

  const result = evaluateReleaseContract(root, {
    mode: 'stable',
    tag: 'v4.0.0-rc.1'
  })

  assert.equal(result.ok, false)
  assert.ok(codes(result.errors).includes('INVALID_TARGET_TAG'))
})

test('las superficies y los release tags también exigen SemVer estricto', (t) => {
  const root = fixture(t, {
    api: '4.0.0-rc.1',
    tags: ['v3.4.2', 'v4.0.0-rc.1']
  })

  const result = evaluateReleaseContract(root, { mode: 'preview' })

  assert.equal(result.ok, false)
  assert.ok(result.errors.some(({ code, surface }) => (
    code === 'INVALID_SURFACE_VERSION' && surface === 'api'
  )))
  assert.ok(result.errors.some(({ code, tag }) => (
    code === 'INVALID_RELEASE_TAG' && tag === 'v4.0.0-rc.1'
  )))
})

test('--json entrega un único documento parseable y conserva el exit code', (t) => {
  const root = fixture(t, {
    githubNotes: '0.5.16',
    tags: ['v0.5.19', 'v3.4.2']
  })
  let stdout = ''
  let stderr = ''

  const exitCode = runReleaseContractCli(['preview', '--json'], {
    repoRoot: root,
    stdout: { write: (chunk) => { stdout += chunk } },
    stderr: { write: (chunk) => { stderr += chunk } }
  })

  assert.equal(exitCode, 0)
  assert.equal(stderr, '')
  const payload = JSON.parse(stdout)
  assert.equal(payload.mode, 'preview')
  assert.equal(payload.ok, true)
  assert.equal(payload.surfaces.githubNotes.version, '0.5.16')
})

test('el workflow separa preview interno de publicación stable y falla cerrado', () => {
  const workflow = fs.readFileSync(
    new URL('../../.github/workflows/release.yml', import.meta.url),
    'utf8'
  )
  const windowsPreview = workflow.match(
    /- name: Upload Windows internal preview([\s\S]*?)- name: Upload Windows stable payload/
  )?.[1] ?? ''
  const macPreview = workflow.match(
    /- name: Upload macOS internal preview([\s\S]*?)- name: Upload macOS stable payload/
  )?.[1] ?? ''

  assert.match(workflow, /^\s{2}workflow_dispatch:\s*$/m)
  assert.doesNotMatch(workflow, /^\s{4}inputs:\s*$/m)
  assert.match(workflow, /node scripts\/release-contract\.mjs preview/)
  assert.match(workflow, /node scripts\/release-contract\.mjs stable --tag/)
  assert.match(workflow, /name: Remove updater metadata from Windows internal preview/)
  assert.match(workflow, /name: Remove updater payloads from macOS internal preview/)
  assert.doesNotMatch(windowsPreview, /latest\.yml/)
  assert.doesNotMatch(macPreview, /latest-mac\.yml|\.blockmap|\.zip/)
  assert.doesNotMatch(workflow, /continue-on-error/)
  assert.equal((workflow.match(/contents:\s*write/g) ?? []).length, 1)
  // El ADR 0055 retira la firma de distribucion y los payloads de updater de
  // macOS: exigirlos dejaba `stable` inalcanzable por construccion, no por un
  // defecto del build. Se afirma su AUSENCIA, y no solo se borra la afirmacion
  // contraria, para que reintroducirlos sin certificados vuelva a romper aqui
  // en vez de romper a los veinte minutos dentro del runner de macOS.
  assert.doesNotMatch(workflow, /osslsigncode/)
  assert.doesNotMatch(workflow, /codesign --verify/)
  assert.doesNotMatch(workflow, /Authority=Developer ID Application/)
  assert.match(workflow, /ADR 0055/)
  // Lo que si sigue siendo fail-closed sin depender de un certificado.
  assert.match(workflow, /El payload stable de macOS está incompleto/)
  assert.doesNotMatch(workflow, /artifacts\/mac\/latest-mac\.yml/)
  assert.match(workflow, /needs: \[contract, quality, build-windows, build-mac\]/)
  assert.match(workflow, /fail_on_unmatched_files:\s*true/)
})
