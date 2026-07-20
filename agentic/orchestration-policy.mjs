import { readFileSync } from 'node:fs'

const DEFAULT_LIMITS = Object.freeze({ maxWorkers: 3, maxWriters: 2 })
const GLOB_CHARS = ['*', '?', '{', '}', '[', ']']
const PROVIDERS = new Set(['claude', 'codex'])
const PROFILES = new Set(['read-only', 'reviewer', 'writer', 'gate'])
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/

function loadAgentProfiles() {
  const manifest = JSON.parse(readFileSync(new URL('./manifest.json', import.meta.url), 'utf8'))
  if (!Array.isArray(manifest.agents) || !manifest.agent_profiles ||
      typeof manifest.agent_profiles !== 'object' || Array.isArray(manifest.agent_profiles)) {
    throw new Error('agentic/manifest.json no declara agents y agent_profiles válidos')
  }
  const profiles = {}
  for (const agent of manifest.agents) {
    const profile = manifest.agent_profiles[agent]
    if (typeof agent !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(agent) ||
        Object.hasOwn(profiles, agent) || !PROFILES.has(profile)) {
      throw new Error(`agentic/manifest.json declara agente/perfil inválido: ${String(agent)}`)
    }
    profiles[agent] = profile
  }
  return Object.freeze(profiles)
}

const AGENT_PROFILES = loadAgentProfiles()

function canonicalOwnership(value) {
  const legacy = typeof value === 'string'
  const rawPath = legacy ? value : value?.path
  const kind = legacy
    ? (rawPath?.endsWith('/') ? 'tree' : 'file')
    : value?.kind

  if (!legacy && (!value || typeof value !== 'object' || Array.isArray(value))) {
    return { error: 'invalid_ownership_entry', value: String(value) }
  }
  if (!['file', 'tree'].includes(kind)) {
    return { error: 'invalid_ownership_kind', value: `${String(rawPath)}:${String(kind)}` }
  }
  if (typeof rawPath !== 'string' || !rawPath || rawPath !== rawPath.trim()) {
    return { error: 'invalid_ownership_path', value: String(rawPath) }
  }
  if (rawPath.includes('\\') || CONTROL_CHARS.test(rawPath)) {
    return { error: 'invalid_ownership_path', value: rawPath }
  }
  if (GLOB_CHARS.some((character) => rawPath.includes(character))) {
    return { error: 'unresolved_ownership_glob', value: rawPath }
  }

  const canonicalPath = legacy && kind === 'tree' ? rawPath.slice(0, -1) : rawPath
  if (!canonicalPath || canonicalPath.startsWith('/') || /^[A-Za-z]:/.test(canonicalPath)) {
    return { error: 'invalid_ownership_path', value: rawPath }
  }
  const segments = canonicalPath.split('/')
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) {
    return { error: 'invalid_ownership_path', value: rawPath }
  }
  if (!legacy && kind === 'file' && canonicalPath.endsWith('/')) {
    return { error: 'invalid_ownership_path', value: rawPath }
  }
  return { path: canonicalPath, kind }
}

function analyzeOwnership(lines) {
  const entries = []
  const unresolved = []
  const missing = []
  const invalidAgents = []
  const invalidProfiles = []
  const invalidOwnership = []
  const invalidOwnershipKinds = []
  const invalidOwnershipPaths = []
  for (const line of lines) {
    const agent = line?.agent
    if (typeof agent !== 'string' || !Object.hasOwn(AGENT_PROFILES, agent)) invalidAgents.push(String(agent))
    if (!PROFILES.has(line?.profile) || AGENT_PROFILES[agent] !== line?.profile) invalidProfiles.push(String(agent))
    if (line?.profile === 'writer' && (!Array.isArray(line.ownedFiles) || line.ownedFiles.length === 0)) {
      missing.push(line.agent)
    }
    if (line?.ownedFiles !== undefined && !Array.isArray(line.ownedFiles)) {
      invalidOwnership.push(String(agent))
      continue
    }
    for (const ownedFile of line?.ownedFiles ?? []) {
      const ownership = canonicalOwnership(ownedFile)
      if (ownership.error === 'unresolved_ownership_glob') unresolved.push(ownership.value)
      else if (ownership.error === 'invalid_ownership_kind') invalidOwnershipKinds.push(ownership.value)
      else if (ownership.error === 'invalid_ownership_path') invalidOwnershipPaths.push(ownership.value)
      else if (ownership.error) invalidOwnership.push(ownership.value)
      else entries.push({ agent, ...ownership })
    }
  }

  const conflicts = new Set()
  for (let left = 0; left < entries.length; left += 1) {
    for (let right = left + 1; right < entries.length; right += 1) {
      const a = entries[left]
      const b = entries[right]
      if (a.agent === b.agent) continue
      const same = a.path === b.path
      const aOwnsParent = a.kind === 'tree' && b.path.startsWith(`${a.path}/`)
      const bOwnsParent = b.kind === 'tree' && a.path.startsWith(`${b.path}/`)
      if (same || aOwnsParent || bOwnsParent) conflicts.add(a.path.length <= b.path.length ? a.path : b.path)
    }
  }
  return {
    conflicts: [...conflicts].sort(),
    unresolved: [...new Set(unresolved)].sort(),
    missing: [...new Set(missing)].sort(),
    invalidAgents: [...new Set(invalidAgents)].sort(),
    invalidProfiles: [...new Set(invalidProfiles)].sort(),
    invalidOwnership: [...new Set(invalidOwnership)].sort(),
    invalidOwnershipKinds: [...new Set(invalidOwnershipKinds)].sort(),
    invalidOwnershipPaths: [...new Set(invalidOwnershipPaths)].sort()
  }
}

function blocked(lines, reason, details = {}) {
  return {
    status: 'blocked', mode: 'serial', reason,
    conflicts: [], unresolved: [], workers: [], pending: lines,
    ...details
  }
}

export function selectWave(input, limits = DEFAULT_LIMITS) {
  const lines = input.lines ?? []
  const serialFlags = input.serialFlags ?? []
  if (!PROVIDERS.has(input.provider)) {
    return blocked(lines, 'invalid_provider', { invalidProvider: input.provider })
  }
  const ownership = analyzeOwnership(lines)
  if (ownership.invalidAgents.length) {
    return blocked(lines, 'invalid_agent', { invalidAgents: ownership.invalidAgents })
  }
  if (ownership.invalidProfiles.length) {
    return blocked(lines, 'invalid_profile', { invalidProfiles: ownership.invalidProfiles })
  }
  if (ownership.missing.length) {
    return blocked(lines, 'missing_ownership', { missingOwnership: ownership.missing })
  }
  if (ownership.invalidOwnership.length) {
    return blocked(lines, 'invalid_ownership_entry', { invalidOwnership: ownership.invalidOwnership })
  }
  if (ownership.invalidOwnershipKinds.length) {
    return blocked(lines, 'invalid_ownership_kind', { invalidOwnershipKinds: ownership.invalidOwnershipKinds })
  }
  if (ownership.invalidOwnershipPaths.length) {
    return blocked(lines, 'invalid_ownership_path', { invalidOwnershipPaths: ownership.invalidOwnershipPaths })
  }
  if (ownership.unresolved.length) {
    return blocked(lines, 'unresolved_ownership_glob', { unresolved: ownership.unresolved })
  }
  if (ownership.conflicts.length) {
    return blocked(lines, 'overlapping_ownership', { conflicts: ownership.conflicts })
  }
  if (serialFlags.length || lines.length < 2) {
    return {
      status: 'ready', mode: 'serial', reason: serialFlags[0] ?? 'single_line',
      conflicts: [], unresolved: [], workers: lines.slice(0, 1), pending: lines.slice(1)
    }
  }

  const workers = []
  const selected = new Set()
  let writers = 0
  for (const [index, line] of lines.entries()) {
    if (workers.length >= limits.maxWorkers) break
    if (line.profile === 'writer') {
      if (writers >= limits.maxWriters) continue
      writers += 1
    }
    workers.push(line)
    selected.add(index)
  }
  const pending = lines.filter((_, index) => !selected.has(index))
  const mechanism = input.provider === 'claude'
    ? (input.directCommunication ? 'agent-teams' : 'background-subagents')
    : 'subagents'
  return { status: 'ready', mode: 'parallel', mechanism, conflicts: [], unresolved: [], workers, pending }
}

export const planScenario = selectWave
