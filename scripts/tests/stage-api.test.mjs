// api/ entra a los instaladores por lista permitida (scripts/stage-api.sh): lo versionado más el build del front.
// Se siembra un api/ con la basura que de verdad hay en un árbol de trabajo y se comprueba que nada de ella viaja.

import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const SCRIPT = path.join(ROOT, 'scripts', 'stage-api.sh')
const leer = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')

const NECESARIOS = ['DESCRIPTION', 'NAMESPACE', 'R/motor.R', 'inst/catalogos/c.json', 'inst/samples/demo.xlsx',
  'inst/reference_projects/acnur/acnur.pulso']
const BUILD_FRONT = ['inst/www/index.html', 'inst/www/assets/app.js']
const BASURA_VERSIONABLE = ['outputs/auditoria/discarded.csv', 'tests/testthat/test-x.R', 'man/motor.Rd',
  'inst/plantillas/plantilla.pptx.bak', 'inst/samples/demo.xlsx.bak_edad_fix', 'Rplots.pdf', 'R/.Rhistory']
const SIN_VERSIONAR = ['R/borrador.R', 'inst/hojas_ruta/x.geojson.gz.properties']

function escribir(base, rel) {
  const ruta = path.join(base, rel)
  fs.mkdirSync(path.dirname(ruta), { recursive: true })
  fs.writeFileSync(ruta, 'x')
}

function arbol({ conGit }) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'stage-api-'))
  const api = path.join(tmp, 'api')
  for (const rel of [...NECESARIOS, ...BUILD_FRONT, ...BASURA_VERSIONABLE, ...SIN_VERSIONAR]) escribir(api, rel)
  if (conGit) {
    const git = (...args) => execFileSync('git', ['-C', tmp, ...args], { stdio: 'ignore' })
    git('init', '-q')
    // Aun versionada, la basura no viaja; el build del front no está en git y sí viaja.
    git('add', '--', ...[...NECESARIOS, ...BASURA_VERSIONABLE].map((r) => `api/${r}`))
  }
  return { tmp, api }
}

function copiados(dst) {
  const out = []
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name)
      if (e.isDirectory()) walk(p)
      else out.push(path.relative(dst, p).split(path.sep).join('/'))
    }
  }
  walk(dst)
  return out.sort()
}

function correr(api, dst) {
  return spawnSync('bash', [SCRIPT, api, dst], { encoding: 'utf8' })
}

test('en un repo git viaja lo versionado y el build del front, nada más', (t) => {
  const { tmp, api } = arbol({ conGit: true })
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }))
  const dst = path.join(tmp, 'staging', 'api')
  const r = correr(api, dst)
  assert.equal(r.status, 0, r.stderr)
  assert.deepEqual(copiados(dst), [...NECESARIOS, ...BUILD_FRONT].sort())
})

test('fuera de git cae a la lista negra, avisa y la basura tampoco viaja', (t) => {
  const { tmp, api } = arbol({ conGit: false })
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }))
  const dst = path.join(tmp, 'staging', 'api')
  const r = correr(api, dst)
  assert.equal(r.status, 0, r.stderr)
  assert.match(r.stderr, /no está en un repo git/)
  // Sin git no se distingue un borrador de lo versionado: sólo se le escapan los sin versionar.
  assert.deepEqual(copiados(dst), [...NECESARIOS, ...BUILD_FRONT, ...SIN_VERSIONAR].sort())
})

test('sin el build del front no se empaqueta', (t) => {
  const { tmp, api } = arbol({ conGit: true })
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }))
  fs.rmSync(path.join(api, 'inst', 'www'), { recursive: true })
  const r = correr(api, path.join(tmp, 'staging', 'api'))
  assert.notEqual(r.status, 0)
  assert.match(r.stderr, /make build/)
})

test('los builds copian api/ con stage-api.sh y el de macOS filtra la misma basura', () => {
  const win = leer('packaging/windows/build-self-contained.sh')
  assert.match(win, /scripts\/stage-api\.sh" api "\$STAGING\/Internals\/api"/)
  assert.doesNotMatch(win, /COPY_TREE" api /)
  const make = leer('Makefile')
  assert.doesNotMatch(make, /copy-tree\.sh api /)
  assert.equal((make.match(/scripts\/stage-api\.sh api /g) || []).length, 2)
  // electron-builder copia api/ por su cuenta (extraResources): su filtro excluye lo mismo.
  const pkg = JSON.parse(leer('desktop/package.json'))
  const api = pkg.build.extraResources.find((r) => r.from === '../api')
  for (const patron of ['!tests', '!outputs', '!man', '!**/.Rhistory', '!**/Rplots.pdf', '!**/*.bak', '!**/*.bak_*']) {
    assert.ok(api.filter.includes(patron), `falta ${patron} en el filtro de api/ de electron-builder`)
  }
})
