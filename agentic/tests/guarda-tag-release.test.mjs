import assert from 'node:assert/strict'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

import { estadoDeQuality, revisarPublicacionOpaca, revisarPushDeTag, tagsEmpujados } from '../hooks/guarda-tag-release.mjs'
import { decidir, revisarTagDeRelease } from '../hooks/guardas.mjs'

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const sinR = { instalacionEnCurso: () => null, lock: () => null, backendDelUsuarioEnUso: () => false }
const SHA = 'a'.repeat(40)
const con = (estado, commit = SHA) => ({ commitDe: () => commit, esRama: () => false, quality: () => estado })
/** Sondas que revientan si alguien las consulta: prueban que un push sin tag no toca git ni la red. */
const prohibidas = {
  commitDe: () => assert.fail('no debía resolver ninguna referencia'),
  esRama: () => assert.fail('no debía mirar las ramas'),
  quality: () => assert.fail('no debía consultar GitHub'),
}
const bash = (command, sondasDeTag, cwd = raiz) => decidir({ tool_name: 'Bash', tool_input: { command }, cwd }, sinR, sondasDeTag)

test('reconoce el tag de release en las formas de git push', () => {
  const tags = (comando) => tagsEmpujados(comando.split(' ').slice(1)).tags.map((t) => t.tag)
  assert.deepEqual(tags('git push origin v0.9.6'), ['v0.9.6'])
  assert.deepEqual(tags('git push origin refs/tags/v0.9.6'), ['v0.9.6'])
  assert.deepEqual(tags('git push --force origin +v0.9.6'), ['v0.9.6'])
  assert.deepEqual(tags('git push origin tag v0.9.6'), ['v0.9.6'])
  assert.deepEqual(tags('git push origin HEAD:refs/tags/v1.0.0'), ['v1.0.0'])
  assert.deepEqual(tags('git push origin main v0.9.6 v0.9.7'), ['v0.9.6', 'v0.9.7'])
  assert.deepEqual(tags('git push origin v1.0.0-rc.1'), ['v1.0.0-rc.1'])
  assert.deepEqual(tags('git push origin v0.9.6+build'), ['v0.9.6+build'])
  // No son tags de release, o no publican nada.
  assert.deepEqual(tags('git push origin main'), [])
  assert.deepEqual(tags('git push origin vista-nueva'), [])
  assert.deepEqual(tags('git push origin respaldo/2026-08-27/main'), [])
  assert.deepEqual(tags('git push origin :v0.9.6'), [])
  assert.deepEqual(tags('git push --delete origin v0.9.6'), [])
  assert.deepEqual(tags('git push origin v0.9.6 --dry-run'), [])
  assert.deepEqual(tags('git push -n origin v0.9.6'), [])
  assert.deepEqual(tags('git push origin main # luego el tag v0.9.6'), [])
  assert.deepEqual(tags('git tag v0.9.6'), [])
})

test('consulta el commit que se empuja, no el tag local, cuando el refspec trae origen', () => {
  const origen = (comando) => tagsEmpujados(comando.split(' ').slice(1)).tags[0]?.origen
  assert.equal(origen('git push origin v0.9.6'), 'refs/tags/v0.9.6')
  assert.equal(origen('git push origin +HEAD:refs/tags/v0.9.6'), 'HEAD')
  assert.equal(origen('git push -f origin abc1234:refs/tags/v0.9.6'), 'abc1234')
  assert.equal(origen('git push origin refs/tags/v0.9.6:refs/tags/v0.9.6'), 'refs/tags/v0.9.6')
  // Mover el tag: el commit viejo del tag está verde y el que se empuja, rojo.
  const sondas = { commitDe: (ref) => (ref === 'HEAD' ? 'c'.repeat(40) : 'b'.repeat(40)), esRama: () => false, quality: (sha) => (sha.startsWith('b') ? 'verde' : 'rojo') }
  assert.equal(revisarTagDeRelease('git push origin v0.9.6', raiz, sondas), null)
  assert.equal(revisarTagDeRelease('git push -f origin +HEAD:refs/tags/v0.9.6', raiz, sondas)?.decision, 'deny')
})

test('todos los tags de golpe, con el flag entero, abreviado o por comodín', () => {
  for (const args of [['--tags'], ['--tag'], ['origin', 'main', '--follow-tags'], ['--follow-tag'], ['--mirror'], ['--mirro'], ['origin', 'refs/tags/*'], ['origin', 'refs/tags/*:refs/tags/*'], ['origin', 'refs/tags/v*'], ['origin', 'v0.9.*']]) {
    assert.equal(tagsEmpujados(['push', ...args]).todos, true, args.join(' '))
    assert.equal(revisarPushDeTag(['push', ...args], raiz, prohibidas)?.decision, 'ask', args.join(' '))
  }
  for (const args of [['origin', 'main'], ['--force', 'origin', 'main'], ['-u', 'origin', 'feat/*'], ['--tags', '--dry-run']]) {
    assert.equal(tagsEmpujados(['push', ...args]).todos, false, args.join(' '))
  }
})

test('resume las corridas de Quality de un commit', () => {
  assert.equal(estadoDeQuality([]), 'sin-corrida')
  assert.equal(estadoDeQuality(null), 'sin-corrida')
  assert.equal(estadoDeQuality([{ status: 'completed', conclusion: 'success' }]), 'verde')
  // Un verde anterior del mismo commit vale aunque un reintento haya fallado: el SHA fija el árbol.
  assert.equal(estadoDeQuality([{ status: 'completed', conclusion: 'failure' }, { status: 'completed', conclusion: 'success' }]), 'verde')
  assert.equal(estadoDeQuality([{ status: 'in_progress', conclusion: '' }]), 'en-curso')
  assert.equal(estadoDeQuality([{ status: 'queued', conclusion: null }, { status: 'completed', conclusion: 'cancelled' }]), 'en-curso')
  assert.equal(estadoDeQuality([{ status: 'completed', conclusion: 'failure' }]), 'rojo')
  assert.equal(estadoDeQuality([{ status: 'completed', conclusion: 'timed_out' }, { status: 'completed', conclusion: 'cancelled' }]), 'rojo')
  // Un push en ráfaga cancela la corrida anterior: no es un rojo.
  assert.equal(estadoDeQuality([{ status: 'completed', conclusion: 'cancelled' }]), 'cancelada')
})

test('con Quality verde el tag pasa; en curso o en rojo se bloquea', () => {
  assert.equal(bash('git push origin v0.9.6', con('verde')), null)
  assert.equal(bash('git push origin v0.9.6', con('en-curso'))?.decision, 'deny')
  assert.equal(bash('git push origin v0.9.6', con('rojo'))?.decision, 'deny')
  assert.match(bash('git push origin v0.9.6', con('rojo')).motivo, /aaaaaaaaa.*v0\.9\.6/u)
})

test('sin corrida, cancelada, sin red o sin poder resolver el commit decide el usuario', () => {
  assert.equal(bash('git push origin v0.9.6', con('sin-corrida'))?.decision, 'ask')
  assert.equal(bash('git push origin v0.9.6', con('cancelada'))?.decision, 'ask')
  assert.equal(bash('git push origin v0.9.6', con('desconocido'))?.decision, 'ask')
  assert.equal(bash('git push origin v0.9.6', con('verde', null))?.decision, 'ask')
  assert.equal(bash('git push --tags', prohibidas)?.decision, 'ask')
})

test('una rama con nombre de versión no es un tag', () => {
  const rama = { commitDe: () => null, esRama: (n) => n === 'v2.0.0-migracion', quality: () => assert.fail('no debía consultar GitHub') }
  assert.equal(bash('git push origin v2.0.0-migracion', rama), null)
  assert.equal(bash('git push origin v2.0.1-otra', rama)?.decision, 'ask')
})

test('alcanza el push compuesto, entre comillas, con ^{}, con -C y dentro de un worktree', () => {
  for (const comando of [
    'git push origin main && git push origin v0.9.6',
    'git tag v0.9.6 && git push origin v0.9.6',
    '(cd api && git push origin v0.9.6)',
    'git -C /repo push origin v0.9.6',
    'git push origin "v0.9.6"',
    "git push origin 'refs/tags/v0.9.6'",
    'git push origin "refs/tags/v0.9.6:refs/tags/v0.9.6"',
    'git push origin "HEAD:refs/tags/v1.2.3"',
    "git push origin 'main:refs/tags/v0.9.6'",
    'git push origin v0.9.6^{}:refs/tags/v0.9.6',
    'git push origin v0.9.6^{commit}:refs/tags/v0.9.6',
    'git push origin main v0.9.6>/dev/null',
    'git push origin v0.9.6 2>&1 | tail',
  ]) {
    assert.equal(revisarTagDeRelease(comando, raiz, con('rojo'))?.decision, 'deny', comando)
  }
  const worktree = path.join(raiz, '.claude', 'worktrees', 'agente-1')
  assert.equal(bash('git push origin v0.9.6', con('rojo'), worktree)?.decision, 'deny')
})

test('un tag que sale de una variable, y gh release create, los decide el usuario', () => {
  for (const comando of [
    'git push origin $TAG',
    'git push origin "$TAG"',
    'git push origin "v$V"',
    'git push origin v$V',
    'git push origin "v${VERSION}"',
    'git push origin refs/tags/$TAG',
    'TAG=v0.9.6; git push origin $TAG',
    'for t in v0.9.6; do git push origin $t; done',
    'git push origin $(git describe --tags --abbrev=0)',
    'gh release create v0.9.6',
    'gh release create v0.9.6 --target main --notes-file .github/RELEASE_NOTES.md',
  ]) {
    assert.equal(bash(comando, prohibidas)?.decision, 'ask', comando)
  }
  assert.equal(revisarPublicacionOpaca('gh release view v0.9.6'), null)
})

test('basta un tag sin verde para frenar un push de varios', () => {
  const sondas = { commitDe: (ref) => (ref.endsWith('v0.9.6') ? 'b'.repeat(40) : 'c'.repeat(40)), esRama: () => false, quality: (sha) => (sha.startsWith('b') ? 'verde' : 'rojo') }
  assert.equal(revisarPushDeTag(['push', 'origin', 'v0.9.6'], raiz, sondas), null)
  assert.equal(revisarPushDeTag(['push', 'origin', 'v0.9.6', 'v0.9.7'], raiz, sondas)?.decision, 'deny')
})

test('la guarda entera cabe en el timeout del hook aunque GitHub tarde', () => {
  // Reloj falso: cada consulta consume lo que se le concede. Con dos tags, la
  // segunda consulta recibe lo que queda del presupuesto, no otros 6 s.
  let t = 0
  const topes = []
  const lenta = { commitDe: () => SHA, esRama: () => false, quality: (_sha, _cwd, tope) => { topes.push(tope); t += tope; return 'verde' } }
  assert.equal(revisarPushDeTag(['push', 'origin', 'v0.9.5', 'v0.9.6', 'v0.9.7'], raiz, lenta, () => t)?.decision, 'ask')
  assert.deepEqual(topes, [6000, 6000])
  assert.ok(t <= 12000, `la guarda consumió ${t} ms`)
})

test('un push sin tag de release, y lo que solo lo menciona, no consulta nada', () => {
  for (const comando of [
    'git push',
    'git push origin main',
    'git push -u origin feat/vista-nueva',
    'git push -u origin $(git branch --show-current)',
    'git push origin "$RAMA" && echo stage listo',
    'git push origin :v0.9.6',
    'git push --delete origin v0.9.6',
    'git push origin v0.9.6 --dry-run',
    'git push origin main # luego el tag v0.9.6',
    'git tag v0.9.6',
    'git tag -a v0.9.6 -m "corte 0.9.6"',
    'git fetch origin tag v0.9.6',
    'git log v0.9.5..v0.9.6',
    'git commit -m "release: prepara corte v0.9.6 y hace git push origin $TAG"',
    'echo "git push origin v0.9.6"',
    'gh run list --workflow release.yml --branch v0.9.6',
    'gh release view v0.9.6',
    'grep -rn "gh release create" docs/',
    'grep -rn "git push origin v0.9.6" docs/',
  ]) {
    assert.equal(bash(comando, prohibidas), null, comando)
  }
})
