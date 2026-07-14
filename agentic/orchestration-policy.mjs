import path from 'node:path'

const DEFAULT_LIMITS = Object.freeze({ maxWorkers: 3, maxWriters: 2 })
const GLOB_CHARS = ['*', '?', '{', '[']
const PROFILES = new Set(['read-only', 'reviewer', 'writer', 'gate'])

function canonicalOwnership(value) {
  const portable = value.replaceAll('\\', '/')
  const normalized = path.posix.normalize(portable).replace(/^\.\//, '').toLowerCase()
  const isDirectory = portable.endsWith('/') || path.posix.extname(normalized) === ''
  return { path: isDirectory && !normalized.endsWith('/') ? `${normalized}/` : normalized, isDirectory }
}

function analyzeOwnership(lines) {
  const entries = []
  const unresolved = []
  const missing = []
  const invalidProfiles = []
  for (const line of lines) {
    if (!PROFILES.has(line.profile)) invalidProfiles.push(line.agent)
    if (line.profile === 'writer' && (!Array.isArray(line.ownedFiles) || line.ownedFiles.length === 0)) {
      missing.push(line.agent)
    }
    for (const ownedFile of Array.isArray(line.ownedFiles) ? line.ownedFiles : []) {
      if (typeof ownedFile !== 'string' || !ownedFile.trim()) {
        missing.push(line.agent)
        continue
      }
      if (GLOB_CHARS.some((character) => ownedFile.includes(character))) {
        unresolved.push(ownedFile)
        continue
      }
      entries.push({ agent: line.agent, ...canonicalOwnership(ownedFile) })
    }
  }

  const conflicts = new Set()
  for (let left = 0; left < entries.length; left += 1) {
    for (let right = left + 1; right < entries.length; right += 1) {
      const a = entries[left]
      const b = entries[right]
      if (a.agent === b.agent) continue
      const same = a.path === b.path
      const aOwnsParent = a.isDirectory && b.path.startsWith(a.path)
      const bOwnsParent = b.isDirectory && a.path.startsWith(b.path)
      if (same || aOwnsParent || bOwnsParent) conflicts.add(a.path.length <= b.path.length ? a.path : b.path)
    }
  }
  return {
    conflicts: [...conflicts].sort(),
    unresolved: [...new Set(unresolved)].sort(),
    missing: [...new Set(missing)].sort(),
    invalidProfiles: [...new Set(invalidProfiles)].sort()
  }
}

export function selectWave(input, limits = DEFAULT_LIMITS) {
  const lines = input.lines ?? []
  const serialFlags = input.serialFlags ?? []
  const ownership = analyzeOwnership(lines)
  if (ownership.invalidProfiles.length) {
    return {
      status: 'blocked', mode: 'serial', reason: 'invalid_profile',
      conflicts: [], unresolved: [], invalidProfiles: ownership.invalidProfiles,
      workers: [], pending: lines
    }
  }
  if (ownership.missing.length) {
    return {
      status: 'blocked', mode: 'serial', reason: 'missing_ownership',
      conflicts: [], unresolved: [], missingOwnership: ownership.missing,
      workers: [], pending: lines
    }
  }
  if (ownership.unresolved.length) {
    return {
      status: 'blocked', mode: 'serial', reason: 'unresolved_ownership_glob',
      conflicts: [], unresolved: ownership.unresolved, workers: [], pending: lines
    }
  }
  if (ownership.conflicts.length) {
    return {
      status: 'blocked', mode: 'serial', reason: 'overlapping_ownership',
      conflicts: ownership.conflicts, unresolved: [], workers: [], pending: lines
    }
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
