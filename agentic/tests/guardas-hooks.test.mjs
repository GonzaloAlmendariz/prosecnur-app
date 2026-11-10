import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

import { decidir, revisarAdaptador, revisarGit, revisarInstalacionR } from '../hooks/guardas.mjs'

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const sinR = { instalacionEnCurso: () => null, lock: () => null, backendDelUsuarioEnUso: () => false }
const bash = (command, cwd = raiz) => decidir({ tool_name: 'Bash', tool_input: { command }, cwd }, sinR)

test('bloquea agregar todo, commit -a y stash sin rutas', () => {
  for (const comando of [
    'git add -A',
    'git add --all',
    'git add .',
    'git add -u',
    'cd frontend && git add -A && git commit -m "x"',
    'git -C /repo add -A',
    'git commit -a -m "x"',
    'git commit -am "x"',
    'git commit --all',
    'git stash',
    'git stash -q',
    'git stash push -m "wip"',
    'git stash -u',
    'node x.mjs; git stash -q 2>/dev/null; true',
    // Formas que la primera versión dejaba pasar (verificador, 2026-11-10).
    '(cd api && git add -A)',
    '(git add -A)',
    'echo $(git add -A)',
    'x=$(git stash)',
    'echo `git stash`',
    'git add \\\n  -A',
    'git add -A>/dev/null',
    'git add -A&',
    'git --git-dir .git add -A',
    `echo 'a "b' ; git add -A ; echo 'c" d'`,
    'wc -l <<< git\ngit add -A',
    'git stash -m pop',
    'git add --al',
    'git add *',
    'git add :/',
    'git commit -m x .',
  ]) {
    assert.equal(revisarGit(comando)?.decision, 'deny', comando)
  }
})

test('deja pasar el git que no arrastra trabajo ajeno', () => {
  for (const comando of [
    'git add -- CLAUDE.md AGENTS.md',
    'git add scripts/revisar-redaccion.mjs',
    'git commit -m "docs: una regla"',
    'git commit --amend --no-edit',
    'git commit -m "fix: ya no usa git add -A ni git stash"',
    'git stash list',
    'git stash show -p',
    'git stash pop',
    'git stash push -- CLAUDE.md',
    'git add -p',
    'git add ./archivo.md',
    'git add .gitignore',
    'git commit -S -m x',
    'git commit -m x -- archivo.md',
    'git log --all',
    'git branch -a',
    'git restore --staged .',
    'git status --short',
    'git diff --stat',
    'grep -rn "git add -A" docs/',
    `git commit -m "$(cat <<'EOF'\ndocs: prohíbe git add -A\n\ngit stash\nEOF\n)"`,
  ]) {
    assert.equal(revisarGit(comando), null, comando)
  }
})

test('en un worktree propio git queda libre', () => {
  const cwd = path.join(raiz, '.claude', 'worktrees', 'agente-1')
  assert.equal(bash('git add -A', cwd), null)
  assert.equal(bash('git add -A')?.decision, 'deny')
  // Desde el worktree no se alcanza el árbol compartido con -C ni con cd.
  assert.equal(bash(`git -C ${raiz} add -A`, cwd)?.decision, 'deny')
  assert.equal(bash(`cd ${raiz} && git add -A`, cwd)?.decision, 'deny')
})

test('R CMD INSTALL se bloquea solo si hay otra instalación o un lock', () => {
  const comando = 'R CMD INSTALL --no-docs --library="$(Rscript -e \'cat(.libPaths()[1])\')" api'
  assert.equal(revisarInstalacionR(comando, sinR), null)
  assert.equal(revisarInstalacionR(comando, { ...sinR, instalacionEnCurso: () => '123 R CMD INSTALL api' })?.decision, 'deny')
  assert.equal(revisarInstalacionR(comando, { ...sinR, lock: () => '/lib/00LOCK-api' })?.decision, 'deny')
  assert.equal(revisarInstalacionR('echo "no corras R CMD INSTALL a la vez"', { ...sinR, lock: () => '/lib/00LOCK-api' }), null)
  assert.equal(revisarInstalacionR('Rscript -e "1"', { ...sinR, lock: () => '/lib/00LOCK-api' }), null)
  // Con el backend del usuario en uso se pregunta; sin él, se instala sin preguntar.
  assert.equal(revisarInstalacionR(comando, { ...sinR, backendDelUsuarioEnUso: () => true })?.decision, 'ask')
  assert.equal(revisarInstalacionR(comando, { ...sinR, lock: () => '/lib/00LOCK-api', backendDelUsuarioEnUso: () => true })?.decision, 'deny')
})

test('los adaptadores generados no se editan a mano', () => {
  assert.equal(revisarAdaptador(path.join(raiz, '.codex/agents/backend-r.toml'), raiz)?.decision, 'deny')
  assert.equal(revisarAdaptador('.agents/skills/ver-ui/SKILL.md', raiz)?.decision, 'deny')
  assert.equal(revisarAdaptador(path.join(raiz, '.claude/agents/backend-r.md'), raiz), null)
  assert.equal(revisarAdaptador(path.join(raiz, 'docs/.agents-notas.md'), raiz), null)
  assert.equal(revisarAdaptador('/otro/repo/.codex/x.toml', raiz), null)
  assert.equal(revisarAdaptador(path.join(raiz, '.CODEX/x.toml'), raiz)?.decision, 'deny')
  assert.equal(decidir({ tool_name: 'Edit', tool_input: { file_path: path.join(raiz, '.codex/agents/x.toml') }, cwd: raiz })?.decision, 'deny')
})

test('escribir en un Sheets pide confirmación; leerlo no', () => {
  assert.equal(decidir({ tool_name: 'mcp__abc-123__update_values', tool_input: {} })?.decision, 'ask')
  assert.equal(decidir({ tool_name: 'mcp__abc-123__get_values', tool_input: {} }), null)
  assert.equal(bash('curl -s -X POST http://127.0.0.1:8787/api/monitoreo/aulas/publicar-libro')?.decision, 'ask')
  assert.equal(bash('grep -rn "publicar-libro" api/R'), null)
  assert.equal(bash('http POST :8787/api/monitoreo/aulas/publicar-marcas')?.decision, 'ask')
  assert.equal(bash('curl -X POST "http://127.0.0.1:8787/api/monitoreo/sheets/publish"')?.decision, 'ask')
  assert.equal(bash('curl :8787/api/health; grep -rn "publicar-libro" api/R'), null)
  assert.equal(bash('git commit -m "fix: el curl de publicar-libro ya no duplica"'), null)
  assert.equal(bash('curl :8787/api/monitoreo/aulas/sync-estado'), null)
})

test('una entrada rara no bloquea ni revienta', () => {
  assert.equal(decidir({}), null)
  assert.equal(decidir({ tool_name: 'Read', tool_input: { file_path: '.codex/x' } }), null)
  assert.equal(bash(''), null)
})

test('el script emite el JSON de PreToolUse y calla cuando no hay nada que decir', () => {
  const correr = (entrada) => execFileSync('node', [path.join(raiz, 'agentic/hooks/guardas.mjs')], { input: entrada, encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: raiz } })
  const salida = JSON.parse(correr(JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'git add -A' }, cwd: raiz })))
  assert.equal(salida.hookSpecificOutput.hookEventName, 'PreToolUse')
  assert.equal(salida.hookSpecificOutput.permissionDecision, 'deny')
  assert.equal(correr(JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'ls' }, cwd: raiz })), '')
  assert.equal(correr('esto no es json'), '')
})

test('settings.json registra las tres guardas apuntando al script', () => {
  const settings = JSON.parse(readFileSync(path.join(raiz, '.claude/settings.json'), 'utf8'))
  const pre = settings.hooks?.PreToolUse ?? []
  const matchers = pre.map((h) => h.matcher)
  assert.ok(matchers.includes('Bash'))
  assert.ok(matchers.some((m) => m.includes('Edit') && m.includes('Write')))
  assert.ok(matchers.some((m) => m.startsWith('mcp__')))
  for (const h of pre) assert.match(h.hooks[0].command, /agentic\/hooks\/guardas\.mjs/u)
  assert.ok(settings.hooks.Stop?.length, 'el hook Stop previo se conserva')
})
