import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

function copy(source, target) {
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.cpSync(source, target, { recursive: true })
}

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'prosecnur-agentic-'))
  for (const item of [
    'agentic/manifest.json',
    'agentic/sync-agentic-os.mjs',
    '.claude/agents',
    '.claude/skills',
    '.claude/settings.json',
    '.claude/workflows',
    '.codex/config.toml',
    'AGENTS.md',
    'CLAUDE.md',
    'docs/loops-reparacion.md'
  ]) copy(path.join(repoRoot, item), path.join(root, item))
  return root
}

function run(root, ...args) {
  return spawnSync(process.execPath, ['agentic/sync-agentic-os.mjs', ...args, '--platform=none'], {
    cwd: root,
    encoding: 'utf8'
  })
}

function runWithHome(root, home, ...args) {
  return spawnSync(process.execPath, ['agentic/sync-agentic-os.mjs', ...args], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, HOME: home, USERPROFILE: home }
  })
}

function readManifest(root) {
  return JSON.parse(fs.readFileSync(path.join(root, 'agentic/manifest.json'), 'utf8'))
}

function writeManifest(root, manifest) {
  fs.writeFileSync(path.join(root, 'agentic/manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
}

function generatedAgents(root) {
  return fs.readdirSync(path.join(root, '.codex/agents')).filter((name) => name.endsWith('.toml')).sort()
}

function generatedAgenticDocs(root, kind) {
  return fs.readdirSync(path.join(root, 'docs/sistema/agentic', kind)).filter((name) => name.endsWith('.md')).sort()
}

test('genera adaptadores y el grafo agentic exacto; check es reproducible', () => {
  const root = fixture()
  const write = run(root, '--write')
  assert.equal(write.status, 0, write.stderr)
  assert.equal(generatedAgents(root).length, 13)
  assert.equal(generatedAgenticDocs(root, 'skills').length, 16)
  assert.equal(generatedAgenticDocs(root, 'agentes').length, 13)
  assert.equal(generatedAgenticDocs(root, 'ramas').length, 8)
  assert.ok(fs.existsSync(path.join(root, 'docs/sistema/agentic/README.md')))
  assert.equal(run(root, '--check').status, 0)
})

test('platform=all comprueba Claude y Codex por separado', (t) => {
  const root = fixture()
  assert.equal(run(root, '--write').status, 0)
  const externalSkills = readManifest(root).external_skills

  for (const presentPlatform of ['claude', 'codex']) {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), `prosecnur-agentic-home-${presentPlatform}-`))
    t.after(() => fs.rmSync(home, { recursive: true, force: true }))
    const skillsRoot = presentPlatform === 'claude'
      ? path.join(home, '.claude/skills')
      : path.join(home, '.agents/skills')
    for (const name of externalSkills) {
      const skillFile = path.join(skillsRoot, name, 'SKILL.md')
      fs.mkdirSync(path.dirname(skillFile), { recursive: true })
      fs.writeFileSync(skillFile, `---\nname: ${name}\ndescription: fixture\n---\n`)
    }

    const missingPlatform = presentPlatform === 'claude' ? 'codex' : 'claude'
    const warning = runWithHome(root, home, '--check', '--platform=all')
    assert.equal(warning.status, 0, warning.stderr)
    assert.match(warning.stderr, new RegExp(`skill externo no disponible para ${missingPlatform}:`))
    assert.doesNotMatch(warning.stderr, new RegExp(`skill externo no disponible para ${presentPlatform}:`))

    const strict = runWithHome(root, home, '--check', '--platform=all', '--strict-external')
    assert.notEqual(strict.status, 0)
    assert.match(strict.stderr, new RegExp(`skill externo no disponible para ${missingPlatform}:`))
    assert.doesNotMatch(strict.stderr, new RegExp(`skill externo no disponible para ${presentPlatform}:`))
  }
})

test('alta y baja canónica generan y podan solo adaptadores marcados', () => {
  const root = fixture()
  assert.equal(run(root, '--write').status, 0)
  const manifest = readManifest(root)
  manifest.skills.push('skill-fixture')
  manifest.agents.push('agente-fixture')
  manifest.agent_profiles['agente-fixture'] = 'read-only'
  manifest.documentation.skill_navigation_roots['skill-fixture'] = []
  manifest.documentation.agent_navigation_roots['agente-fixture'] = []
  writeManifest(root, manifest)

  const skillDir = path.join(root, '.claude/skills/skill-fixture')
  fs.mkdirSync(skillDir, { recursive: true })
  fs.writeFileSync(path.join(skillDir, 'SKILL.md'), '---\nname: skill-fixture\ndescription: Skill temporal de prueba.\n---\n\n# Fixture\n')
  fs.writeFileSync(path.join(root, '.claude/agents/agente-fixture.md'), '---\nname: agente-fixture\ndescription: Agente temporal de prueba.\nprofile: read-only\ntools: Read, Glob, Grep, Bash\ndisallowedTools: Write, Edit, NotebookEdit, Agent, Task\npermissionMode: plan\nbackground: true\n---\n\nSolo lectura.\n')

  assert.equal(run(root, '--write').status, 0)
  assert.ok(fs.existsSync(path.join(root, '.agents/skills/skill-fixture/SKILL.md')))
  assert.ok(fs.existsSync(path.join(root, '.codex/agents/agente-fixture.toml')))

  fs.rmSync(skillDir, { recursive: true })
  fs.rmSync(path.join(root, '.claude/agents/agente-fixture.md'))
  manifest.skills = manifest.skills.filter((name) => name !== 'skill-fixture')
  manifest.agents = manifest.agents.filter((name) => name !== 'agente-fixture')
  delete manifest.agent_profiles['agente-fixture']
  delete manifest.documentation.skill_navigation_roots['skill-fixture']
  delete manifest.documentation.agent_navigation_roots['agente-fixture']
  writeManifest(root, manifest)
  assert.equal(run(root, '--write').status, 0)
  assert.equal(fs.existsSync(path.join(root, '.agents/skills/skill-fixture/SKILL.md')), false)
  assert.equal(fs.existsSync(path.join(root, '.codex/agents/agente-fixture.toml')), false)
  assert.equal(fs.existsSync(path.join(root, 'docs/sistema/agentic/skills/skill-fixture.md')), false)
  assert.equal(fs.existsSync(path.join(root, 'docs/sistema/agentic/agentes/agente-fixture.md')), false)
})

test('detecta deriva generada y preserva colisiones manuales', () => {
  const root = fixture()
  assert.equal(run(root, '--write').status, 0)
  const adapter = path.join(root, '.codex/agents/backend-r.toml')
  fs.appendFileSync(adapter, '# deriva\n')
  const drift = run(root, '--check')
  assert.notEqual(drift.status, 0)
  assert.match(drift.stderr, /desincronizado/)

  fs.writeFileSync(adapter, 'manual note: GENERATED BY agentic/sync-agentic-os.mjs; DO NOT EDIT; KEEP ME\n')
  const collision = run(root, '--write')
  assert.notEqual(collision.status, 0)
  assert.match(collision.stderr, /colisiona con un archivo manual/)
  assert.match(fs.readFileSync(adapter, 'utf8'), /KEEP ME/)
})

test('preserva y denuncia adaptadores extra no marcados', () => {
  const root = fixture()
  assert.equal(run(root, '--write').status, 0)
  const manual = path.join(root, '.agents/skills/manual/notes.md')
  fs.mkdirSync(path.dirname(manual), { recursive: true })
  fs.writeFileSync(manual, 'contenido manual\n')
  const result = run(root, '--write')
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /adaptador manual u obsoleto/)
  assert.equal(fs.readFileSync(manual, 'utf8'), 'contenido manual\n')
})

test('detecta deriva y colisión manual en el índice agentic generado', () => {
  const root = fixture()
  assert.equal(run(root, '--write').status, 0)
  const generated = path.join(root, 'docs/sistema/agentic/skills/scope-lock.md')
  fs.appendFileSync(generated, '\nderiva\n')
  const drift = run(root, '--check')
  assert.notEqual(drift.status, 0)
  assert.match(drift.stderr, /scope-lock\.md está desincronizado/)

  fs.writeFileSync(generated, '# Nota manual\n')
  const collision = run(root, '--write')
  assert.notEqual(collision.status, 0)
  assert.match(collision.stderr, /scope-lock\.md colisiona con un archivo manual/)
  assert.equal(fs.readFileSync(generated, 'utf8'), '# Nota manual\n')
})

test('no acepta un marcador generado incrustado en un adaptador stale manual', () => {
  const root = fixture()
  assert.equal(run(root, '--write').status, 0)
  const manual = path.join(root, '.codex/agents/obsolete.toml')
  fs.writeFileSync(manual, 'name = "manual"\n# nota GENERATED BY agentic/sync-agentic-os.mjs; DO NOT EDIT\n')
  const result = run(root, '--write')
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /adaptador manual u obsoleto/)
  assert.match(fs.readFileSync(manual, 'utf8'), /name = "manual"/)
})

test('rechaza symlink en la raíz de adaptadores sin escribir fuera del repo', () => {
  const root = fixture()
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'prosecnur-agentic-outside-'))
  fs.mkdirSync(path.join(root, '.codex'), { recursive: true })
  fs.symlinkSync(outside, path.join(root, '.codex/agents'), 'dir')
  const result = run(root, '--write')
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /contiene symlink/)
  assert.deepEqual(fs.readdirSync(outside), [])
})

test('rechaza symlink intermedio sin escribir fuera del repo', () => {
  const root = fixture()
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'prosecnur-agentic-outside-'))
  fs.mkdirSync(path.join(root, '.agents/skills'), { recursive: true })
  fs.symlinkSync(outside, path.join(root, '.agents/skills/auditoria-deuda'), 'dir')
  const result = run(root, '--write')
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /contiene symlink/)
  assert.deepEqual(fs.readdirSync(outside), [])
})

test('reporta secciones obligatorias ausentes sin excepción ni mutación', () => {
  for (const section of ['canonical', 'providers', 'adapters', 'profiles', 'agent_profiles', 'documentation', 'orchestration', 'routes', 'policy']) {
    const root = fixture()
    const manifest = readManifest(root)
    delete manifest[section]
    writeManifest(root, manifest)
    const result = run(root, '--write')
    assert.notEqual(result.status, 0, section)
    assert.match(result.stderr, new RegExp(`no declara ${section}`))
    assert.doesNotMatch(result.stderr, /TypeError/)
    assert.equal(fs.existsSync(path.join(root, '.codex/agents')), false)
  }
})

test('exige scope documental explícito y exhaustivo para skills y agentes', () => {
  for (const [key, name] of [
    ['skill_navigation_roots', 'scope-lock'],
    ['agent_navigation_roots', 'frontend-react'],
  ]) {
    const root = fixture()
    const manifest = readManifest(root)
    delete manifest.documentation[key][name]
    writeManifest(root, manifest)
    const result = run(root, '--write')
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, new RegExp(`documentation\\.${key} omite: ${name}`))
  }
})

test('rechaza deriva de invariantes de orquestación y perfiles', () => {
  const mutations = [
    [manifest => { manifest.orchestration.strategy = 'manual' }, /strategy debe ser adaptive-waves/],
    [manifest => { manifest.orchestration.retry_limit = 2 }, /retry_limit debe ser 1/],
    [manifest => { manifest.orchestration.fallback = 'ignore' }, /fallback debe ser sequential/],
    [manifest => { manifest.orchestration.serial_conditions.pop() }, /serial_conditions omite external_service/],
    [manifest => { manifest.providers.codex.multi_agent = false }, /multi_agent debe ser true/],
    [manifest => { manifest.providers.codex.config = '.codex/otro.toml' }, /providers.codex.config debe ser .codex\/config.toml/],
    [manifest => { manifest.providers.claude.teammate_mode = 'tmux' }, /teammate_mode debe ser in-process/],
    [manifest => { manifest.providers.claude.agent_teams_env = 'OTRA' }, /agent_teams_env inválido/],
    [manifest => { manifest.profiles['read-only'].codex_sandbox = 'workspace-write' }, /read-only debe usar codex_sandbox=read-only/],
    [manifest => { manifest.profiles.reviewer.may_edit_product = true }, /reviewer debe usar may_edit_product=false/]
  ]
  for (const [mutate, expected] of mutations) {
    const root = fixture()
    const manifest = readManifest(root)
    mutate(manifest)
    writeManifest(root, manifest)
    const result = run(root, '--write')
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, expected)
  }
})

test('rechaza referencias a agentes inexistentes', () => {
  const root = fixture()
  const manifest = readManifest(root)
  manifest.routes.construir.pools.discovery[0] = 'fantasma'
  writeManifest(root, manifest)
  const result = run(root, '--write')
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /agente inexistente: fantasma/)
})

test('rechaza rutas de código sin verificador', () => {
  const root = fixture()
  const manifest = readManifest(root)
  manifest.routes.construir.pools.gate = []
  writeManifest(root, manifest)
  const result = run(root, '--write')
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /omite gate final verificador/)
})

test('rechaza degradar una ruta mutante a code_change=false', () => {
  const root = fixture()
  const manifest = readManifest(root)
  manifest.routes.construir.code_change = false
  manifest.routes.construir.pools.gate = []
  writeManifest(root, manifest)
  const result = run(root, '--write')
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /construir.code_change debe ser true/)
  assert.equal(fs.existsSync(path.join(root, '.codex/agents')), false)
})

test('rechaza concurrencia que no reserve un hilo para el lead', () => {
  const root = fixture()
  const manifest = readManifest(root)
  manifest.providers.codex.total_threads = 3
  writeManifest(root, manifest)
  const result = run(root, '--write')
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /lead \+ max_parallel_workers/)
})

test('rechaza ampliar coherentemente los límites contractuales 3/2', () => {
  const root = fixture()
  const manifest = readManifest(root)
  manifest.orchestration.max_parallel_workers = 4
  manifest.orchestration.max_parallel_writers = 4
  manifest.providers.codex.total_threads = 5
  writeManifest(root, manifest)
  const configPath = path.join(root, '.codex/config.toml')
  const config = fs.readFileSync(configPath, 'utf8').replace('max_threads = 4', 'max_threads = 5')
  fs.writeFileSync(configPath, config)
  const result = run(root, '--write')
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /max_parallel_workers debe ser 3/)
  assert.match(result.stderr, /max_parallel_writers debe ser 2/)
  assert.equal(fs.existsSync(path.join(root, '.codex/agents')), false)
})

test('convierte perfiles read-only a sandbox Codex read-only', () => {
  const root = fixture()
  assert.equal(run(root, '--write').status, 0)
  const adapter = fs.readFileSync(path.join(root, '.codex/agents/diagnosticador-regresiones.toml'), 'utf8')
  assert.match(adapter, /^sandbox_mode = "read-only"$/m)
})

test('rechaza herramientas de edición en un agente read-only', () => {
  const root = fixture()
  const agent = path.join(root, '.claude/agents/diagnosticador-regresiones.md')
  const content = fs.readFileSync(agent, 'utf8').replace('tools: Read, Glob, Grep, Bash', 'tools: Read, Glob, Grep, Bash, Edit')
  fs.writeFileSync(agent, content)
  const result = run(root, '--write')
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /herramientas de edición: Edit/)
})

test('exige prohibiciones explícitas de edición en todo agente no-writer', () => {
  const root = fixture()
  const agent = path.join(root, '.claude/agents/qa-visual-desktop.md')
  const content = fs.readFileSync(agent, 'utf8').replace('Write, Edit, NotebookEdit, Agent, Task', 'Write, NotebookEdit, Agent, Task')
  fs.writeFileSync(agent, content)
  const result = run(root, '--write')
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /perfil reviewer debe prohibir Edit/)
})

test('rechaza configuración híbrida de Claude ausente o inválida', () => {
  const root = fixture()
  const settingsPath = path.join(root, '.claude/settings.json')
  const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'))
  delete settings.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS
  settings.teammateMode = 'tmux'
  fs.writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`)
  const result = run(root, '--write')
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /no habilita Agent Teams/)
  assert.match(result.stderr, /teammateMode=in-process/)
})
