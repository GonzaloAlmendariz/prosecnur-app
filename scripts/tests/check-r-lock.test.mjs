import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { formatRLockAudit, runRLockAudit } from '../check-r-lock.mjs'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const SHAS = {
  checkout: '11d5960a326750d5838078e36cf38b85af677262',
  setupNode: '49933ea5288caeca8642d1e84afbd3f7d6820020',
  pnpm: 'b906affcce14559ad1aafd4ab0e942779e9f58b1',
  rActions: 'd3c5be51b12e724e68f33216ca3c148b66d5f0b6',
  cache: '0057852bfaa89a56745cba8c7296529d2fc39830',
  upload: 'ea165f8d65b6e75b540449e92b4886f43607fa02',
  download: 'd3f86a106a0bac45b974a628896c90dbdf5c8093',
  release: '3bb12739c298aeb8a4eeaf626c5b8d85266b0e65'
}

function write(root, relative, content) {
  const target = path.join(root, relative)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, content)
}

function record(packageName, version, dependencies = {}) {
  return {
    Package: packageName,
    Version: version,
    ...dependencies,
    Source: 'Repository',
    Repository: 'CRAN',
    Path: 'src/contrib',
    MD5sum: '0123456789abcdef0123456789abcdef'
  }
}

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'r-lock-audit-'))
  write(root, 'api/DESCRIPTION', [
    'Package: ejemplo',
    'Version: 1.0.0',
    'Depends:',
    '    R (>= 4.2),',
    '    grid',
    'Imports:',
    '    foo (>= 1.0.0)',
    'Suggests:',
    '    bar',
    ''
  ].join('\n'))
  write(root, 'api/renv.lock', `${JSON.stringify({
    R: {
      Version: '4.5.1',
      Repositories: [{ Name: 'CRAN', URL: 'https://cloud.r-project.org' }]
    },
    Packages: {
      bar: record('bar', '2.0.0'),
      foo: record('foo', '1.2.3', { Imports: 'transitive' }),
      renv: record('renv', '1.2.3'),
      transitive: record('transitive', '3.0.0')
    }
  }, null, 2)}\n`)
  write(root, '.github/workflows/quality.yml', `
jobs:
  quality:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@${SHAS.checkout} # v4
      - uses: actions/setup-node@${SHAS.setupNode} # v4
      - uses: pnpm/action-setup@${SHAS.pnpm} # v4
      - uses: r-lib/actions/setup-r@${SHAS.rActions} # v2
      - uses: actions/cache@${SHAS.cache} # v4
        with:
          key: r-\${{ hashFiles('api/renv.lock') }}
      - run: node scripts/check-r-lock.mjs
      - run: node --test scripts/tests/*.test.mjs
      - run: node scripts/check-docs-governance.mjs
      - run: node scripts/release-contract.mjs preview
      - run: Rscript launcher/install-r-deps.R
      - run: mkdir -p "\${RUNNER_TEMP}/r-check"
      - run: R CMD check --no-manual --output="\${RUNNER_TEMP}/r-check" api
      - run: pnpm -C frontend audit --audit-level=high
      - run: pnpm -C desktop audit --audit-level=high
`)
  // El fixture representa un repo válido, y uno válido tiene contratos de
  // scripts: la auditoría comprueba que cada archivo de scripts/tests/ corra
  // en algún job, así que sin este archivo el repo sintético no ejercitaría
  // esa regla.
  write(root, 'scripts/tests/ejemplo.test.mjs', 'export default null\n')
  write(root, '.github/workflows/release.yml', `
jobs:
  linux:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@${SHAS.checkout} # v4
      - uses: actions/upload-artifact@${SHAS.upload} # v4
      - uses: actions/download-artifact@${SHAS.download} # v4
      - uses: softprops/action-gh-release@${SHAS.release} # v2
      - uses: actions/cache@${SHAS.cache} # v4
        with:
          key: r-\${{ hashFiles('api/renv.lock') }}
  macos:
    runs-on: macos-26
    steps:
      - uses: actions/setup-node@${SHAS.setupNode} # v4
      - uses: pnpm/action-setup@${SHAS.pnpm} # v4
      - uses: r-lib/actions/setup-r@${SHAS.rActions} # v2
`)
  return root
}

function md5(content) {
  return createHash('md5').update(content).digest('hex')
}

function binaryFixture(platform) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `r-binary-${platform}-`))
  const repository = path.join(root, 'repository')
  const cache = path.join(root, 'cache')
  fs.mkdirSync(repository, { recursive: true })
  fs.mkdirSync(cache, { recursive: true })
  const extension = platform === 'windows' ? 'zip' : 'tgz'
  const binaryName = `foo_1.0.0.${extension}`
  const binary = Buffer.from(`binary-${platform}-exact`)
  const binaryHash = md5(binary)
  write(root, 'api/renv.lock', `${JSON.stringify({
    R: {
      Version: '4.5.1',
      Repositories: [{ Name: 'CRAN', URL: 'https://cloud.r-project.org' }]
    },
    Packages: {
      foo: record('foo', '1.0.0')
    }
  }, null, 2)}\n`)
  fs.writeFileSync(path.join(repository, binaryName), binary)
  write(root, 'repository/PACKAGES', [
    'Package: foo',
    'Version: 1.0.0',
    platform === 'windows' ? `Hash: ${binaryHash}` : `MD5sum: ${binaryHash}`,
    ''
  ].join('\n'))
  fs.writeFileSync(path.join(cache, `stale_0.9.0.${extension}`), 'stale')
  fs.writeFileSync(path.join(cache, 'manifest.csv'), 'stale manifest')
  return { root, repository, cache, binaryName, binary, binaryHash }
}

function runDownloader(platform, fixtureState) {
  const script = platform === 'windows'
    ? 'packaging/windows/download-r-win-binaries.R'
    : 'packaging/macos/download-r-mac-binaries.R'
  const args = [
    path.join(REPO_ROOT, script),
    fixtureState.cache,
    '4.5.1',
    ...(platform === 'windows' ? [] : ['arm64'])
  ]
  return spawnSync('Rscript', args, {
    cwd: fixtureState.root,
    encoding: 'utf8',
    env: {
      ...process.env,
      PROSECNUR_BINARY_TEST_MODE: '1',
      PROSECNUR_BINARY_TEST_REPOSITORY: pathToFileURL(fixtureState.repository).href.replace(/\/$/, '')
    }
  })
}

function runOfflineInstaller(platform, fixtureState) {
  const script = platform === 'windows'
    ? 'packaging/windows/install-r-deps-offline.R'
    : 'packaging/macos/install-r-deps-offline.R'
  return spawnSync('Rscript', [
    path.join(REPO_ROOT, script),
    fixtureState.cache,
    path.join(fixtureState.root, 'library')
  ], {
    cwd: fixtureState.root,
    encoding: 'utf8',
    env: process.env
  })
}

test('lock, cierre y workflows inmutables pasan', () => {
  const result = runRLockAudit(fixture())
  assert.deepEqual(result.errors, [])
  assert.deepEqual(result.report, {
    rVersion: '4.5.1',
    directDependencies: 2,
    lockedPackages: 4,
    repositories: 1,
    actionUses: 13,
    runners: 3
  })
  assert.match(formatRLockAudit(result), /R 4\.5\.1/)
  assert.match(formatRLockAudit(result), /4 paquetes exactos/)
})

test('una dependencia directa o transitiva ausente falla', () => {
  const root = fixture()
  const lockPath = path.join(root, 'api/renv.lock')
  const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'))
  delete lock.Packages.bar
  delete lock.Packages.transitive
  fs.writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`)
  const result = runRLockAudit(root)
  assert.ok(result.errors.some((error) => error.includes('dependencia directa sin versión exacta: bar')))
  assert.ok(result.errors.some((error) => error.includes('dependencia transitiva sin registro: foo -> transitive')))
})

test('R, repositorio y registros del lock son estrictos', () => {
  const root = fixture()
  const descriptionPath = path.join(root, 'api/DESCRIPTION')
  fs.writeFileSync(
    descriptionPath,
    fs.readFileSync(descriptionPath, 'utf8').replace('R (>= 4.2)', 'R (>= 4.1)')
  )
  const lockPath = path.join(root, 'api/renv.lock')
  const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'))
  lock.R.Version = '4.5.0'
  lock.R.Repositories[0].URL = 'https://example.test/cran/latest'
  lock.Packages.foo.Source = 'GitHub'
  lock.Packages.foo.MD5sum = 'sin-hash'
  fs.writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`)
  const result = runRLockAudit(root)
  assert.ok(result.errors.some((error) => error.includes('R debe ser exactamente 4.5.1')))
  assert.ok(result.errors.some((error) => error.includes('Depends debe declarar R (>= 4.2)')))
  assert.ok(result.errors.some((error) => error.includes('repositorio mutable')))
  assert.ok(result.errors.some((error) => error.includes('foo: Source debe ser Repository')))
  assert.ok(result.errors.some((error) => error.includes('foo: MD5sum inválido')))
})

test('acciones y runners mutables fallan', () => {
  const root = fixture()
  const qualityPath = path.join(root, '.github/workflows/quality.yml')
  let quality = fs.readFileSync(qualityPath, 'utf8')
  quality = quality
    .replace(`actions/checkout@${SHAS.checkout}`, 'actions/checkout@v4')
    .replace('runs-on: ubuntu-24.04', 'runs-on: ubuntu-latest')
  fs.writeFileSync(qualityPath, quality)
  const result = runRLockAudit(root)
  assert.ok(result.errors.some((error) => error.includes('acción no fijada a SHA completo')))
  assert.ok(result.errors.some((error) => error.includes('runner mutable o no aprobado')))
})

test('audit fail-open y gates incompletos fallan', () => {
  const root = fixture()
  const qualityPath = path.join(root, '.github/workflows/quality.yml')
  let quality = fs.readFileSync(qualityPath, 'utf8')
  quality = quality
    .replace('pnpm -C frontend audit --audit-level=high', 'pnpm -C frontend audit --audit-level=high || true')
    .replace('node scripts/check-docs-governance.mjs', 'echo docs omitidos')
    .replace('R CMD check --no-manual --output="${RUNNER_TEMP}/r-check" api', 'echo R CMD check omitido')
    .replace('mkdir -p "${RUNNER_TEMP}/r-check"', 'echo directorio R check omitido')
    .replace("hashFiles('api/renv.lock')", "hashFiles('api/DESCRIPTION')")
  fs.writeFileSync(qualityPath, quality)
  const result = runRLockAudit(root)
  assert.ok(result.errors.some((error) => error.includes('audit pnpm debe fallar cerrado')))
  assert.ok(result.errors.some((error) => error.includes('falta gate documental')))
  assert.ok(result.errors.some((error) => error.includes('falta R CMD check')))
  assert.ok(result.errors.some((error) => error.includes('falta crear el directorio de salida')))
  assert.ok(result.errors.some((error) => error.includes('caché R no depende de api/renv.lock')))
})

test('JSON inválido produce diagnóstico y no excepción', () => {
  const root = fixture()
  write(root, 'api/renv.lock', '{')
  const result = runRLockAudit(root)
  assert.ok(result.errors.some((error) => error.includes('JSON inválido')))
})

test('Windows poda el caché, regenera manifest y verifica MD5 en cache hit y descarga', () => {
  const state = binaryFixture('windows')
  let result = runDownloader('windows', state)
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
  assert.deepEqual(
    fs.readdirSync(state.cache).sort(),
    ['.prosecnur-r-binary-cache', state.binaryName, 'manifest.csv'].sort()
  )
  assert.equal(md5(fs.readFileSync(path.join(state.cache, state.binaryName))), state.binaryHash)

  fs.writeFileSync(path.join(state.cache, state.binaryName), 'cache corrupto')
  result = runDownloader('windows', state)
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
  assert.equal(md5(fs.readFileSync(path.join(state.cache, state.binaryName))), state.binaryHash)

  fs.rmSync(path.join(state.cache, state.binaryName))
  fs.writeFileSync(path.join(state.repository, state.binaryName), 'descarga corrupta')
  result = runDownloader('windows', state)
  assert.notEqual(result.status, 0)
  assert.match(`${result.stdout}\n${result.stderr}`, /Checksum binario inválido/)
})

test('macOS poda extras y deja exactamente binarios verificados más manifest', () => {
  const state = binaryFixture('macos')
  let result = runDownloader('macos', state)
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
  assert.deepEqual(
    fs.readdirSync(state.cache).sort(),
    ['.prosecnur-r-binary-cache', state.binaryName, 'manifest.csv'].sort()
  )
  assert.equal(md5(fs.readFileSync(path.join(state.cache, state.binaryName))), state.binaryHash)

  fs.writeFileSync(path.join(state.cache, state.binaryName), 'cache corrupto')
  result = runDownloader('macos', state)
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
  assert.equal(md5(fs.readFileSync(path.join(state.cache, state.binaryName))), state.binaryHash)
})

test('la fecha del snapshot de binarios es una fuente única ISO que ambos descargadores leen', () => {
  // ADR 0059: un solo calendario de binarios R. La fecha vive en un único
  // archivo compartido; ninguno de los dos descargadores lleva fecha inline ni
  // lee el índice vivo de cloud.r-project.org, cuya deriva intra-run rompió
  // v0.7.0 dos veces.
  const datePath = path.join(REPO_ROOT, 'packaging/r-snapshot-date.txt')
  assert.ok(fs.existsSync(datePath), 'falta packaging/r-snapshot-date.txt')
  const snapshotDate = fs.readFileSync(datePath, 'utf8').trim()
  assert.match(snapshotDate, /^\d{4}-\d{2}-\d{2}$/)
  const parsed = new Date(`${snapshotDate}T00:00:00Z`)
  assert.ok(!Number.isNaN(parsed.getTime()), `fecha inválida: ${snapshotDate}`)
  // Rechaza fechas con forma ISO pero imposibles (p. ej. 2026-02-31).
  assert.equal(parsed.toISOString().slice(0, 10), snapshotDate)

  for (const script of [
    'packaging/windows/download-r-win-binaries.R',
    'packaging/macos/download-r-mac-binaries.R'
  ]) {
    const text = fs.readFileSync(path.join(REPO_ROOT, script), 'utf8')
    assert.match(text, /r-snapshot-date\.txt/, `${script} no lee la fuente única`)
    assert.match(text, /packagemanager\.posit\.co/, `${script} no usa el snapshot de Posit`)
    assert.doesNotMatch(text, /cloud\.r-project\.org/, `${script} sigue leyendo el índice vivo`)
    assert.doesNotMatch(text, /\d{4}-\d{2}-\d{2}/, `${script} conserva una fecha inline`)
  }
})

test('workflows y stage macOS no permiten caché por prefijo ni copias opcionales del runtime R', () => {
  const quality = fs.readFileSync(path.join(REPO_ROOT, '.github/workflows/quality.yml'), 'utf8')
  const release = fs.readFileSync(path.join(REPO_ROOT, '.github/workflows/release.yml'), 'utf8')
  const macBuild = fs.readFileSync(path.join(REPO_ROOT, 'packaging/macos/build-dmg.sh'), 'utf8')
  assert.doesNotMatch(`${quality}\n${release}`, /restore-keys:/)
  assert.doesNotMatch(macBuild, /^.*r-packages.*\|\|\s*true.*$/m)
})

test('una carpeta sin sentinel con entradas ajenas se rechaza sin borrar nada', () => {
  for (const platform of ['windows', 'macos']) {
    const state = binaryFixture(platform)
    const foreignFile = path.join(state.cache, 'archivo-del-usuario.txt')
    const foreignDirectory = path.join(state.cache, 'directorio-del-usuario')
    fs.writeFileSync(foreignFile, 'conservar')
    fs.mkdirSync(foreignDirectory)
    fs.writeFileSync(path.join(foreignDirectory, 'contenido'), 'conservar')

    const result = runDownloader(platform, state)

    assert.notEqual(result.status, 0)
    assert.match(`${result.stdout}\n${result.stderr}`, /sin sentinel contiene entradas ajenas/)
    assert.equal(fs.readFileSync(foreignFile, 'utf8'), 'conservar')
    assert.equal(fs.readFileSync(path.join(foreignDirectory, 'contenido'), 'utf8'), 'conservar')
    assert.equal(fs.existsSync(path.join(state.cache, '.prosecnur-r-binary-cache')), false)
  }
})

test('los instaladores offline rechazan conjuntos extra y checksums distintos al manifest', () => {
  for (const platform of ['windows', 'macos']) {
    const state = binaryFixture(platform)
    let result = runDownloader(platform, state)
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)

    const extension = platform === 'windows' ? 'zip' : 'tgz'
    const extra = path.join(state.cache, `extra_9.9.9.${extension}`)
    fs.writeFileSync(extra, 'extra')
    result = runOfflineInstaller(platform, state)
    assert.notEqual(result.status, 0)
    assert.match(`${result.stdout}\n${result.stderr}`, /no coincide exactamente con manifest\.csv/)

    fs.rmSync(extra)
    fs.writeFileSync(path.join(state.cache, state.binaryName), 'binario alterado')
    result = runOfflineInstaller(platform, state)
    assert.notEqual(result.status, 0)
    assert.match(`${result.stdout}\n${result.stderr}`, /Checksum inválido en paquetes offline/)
  }
})

test('el launcher compara versiones R canónicas y acepta guiones del lock', () => {
  const launcher = fs.readFileSync(
    path.join(REPO_ROOT, 'launcher/install-r-deps.R'),
    'utf8'
  )
  assert.match(launcher, /canonical_package_version <- function/)
  assert.match(
    launcher,
    /expected_raw <- vapply\(lock\$Packages[\s\S]*?expected <- vapply\(expected_raw, canonical_package_version/
  )
  assert.doesNotMatch(
    launcher,
    /expected <- vapply\(lock\$Packages, `\[\[`, character\(1\), "Version"\)/
  )

  const lock = JSON.parse(
    fs.readFileSync(path.join(REPO_ROOT, 'api/renv.lock'), 'utf8')
  )
  const hyphenVersions = Object.values(lock.Packages)
    .map((record) => record.Version)
    .filter((version) => version.includes('-'))
  assert.equal(hyphenVersions.length, 16)

  const probe = spawnSync(
    'Rscript',
    [
      '-e',
      [
        'args <- commandArgs(trailingOnly = TRUE)',
        'canonical <- function(value) as.character(base::package_version(value))',
        'installed <- vapply(args, canonical, character(1))',
        'expected <- vapply(args, canonical, character(1))',
        'cat("RAW_MISMATCHES", sum(args != installed), "\\n")',
        'cat("CANONICAL_MISMATCHES", sum(expected != installed), "\\n")',
        'stopifnot(sum(args != installed) == length(args), sum(expected != installed) == 0L)'
      ].join('; '),
      ...hyphenVersions
    ],
    { encoding: 'utf8' }
  )
  assert.equal(probe.status, 0, `${probe.stdout}\n${probe.stderr}`)
  assert.match(probe.stdout, /RAW_MISMATCHES 16/)
  assert.match(probe.stdout, /CANONICAL_MISMATCHES 0/)
})
