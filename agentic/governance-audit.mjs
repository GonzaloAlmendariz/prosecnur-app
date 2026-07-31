// Auditoría sustantiva del agentic OS.
//
// `--check` valida ESTRUCTURA: que los adaptadores estén sincronizados y que
// todo nombre declarado resuelva. Nunca comprueba si lo que el manifest AFIRMA
// sobre el repositorio sigue siendo verdad.
//
// Ese hueco tiene historia medida: `policy.frozen_growth_files` congelaba
// `MonitoreoPage.tsx` mucho después de que el archivo se borrara, mientras dos
// monolitos de perfil de ~20.000 líneas crecían sin gobierno y el CI seguía en
// verde. El sincronizador tocaba esa lista una sola vez, con `ensureArray`:
// comprobaba que la lista fuera una lista.
//
// Este módulo comprueba verdad, no forma. Es el equivalente, para el propio
// OS, de la regla que el OS le exige a la UI: verde por conformidad, nunca por
// ausencia.

import fs from 'node:fs'
import path from 'node:path'

// Prefijos con los que un documento de gobierno puede citar una ruta.
const PATH_PREFIXES = ['', 'frontend/', 'frontend/src/', 'frontend/src/features/', 'api/', 'docs/', 'scripts/']
const SOURCE_EXT = new Set(['.R', '.ts', '.tsx', '.css', '.mjs'])
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'out', 'coverage', 'worktrees', '.claude', 'tmp'])
const CITED_PATH = /`([A-Za-z0-9_./-]+\.(?:R|tsx?|mjs|css|json|md|ya?ml))`/g
const CITED_MAKE = /`make ([a-z0-9-]+)/g
const MAKE_TARGET = /^([a-zA-Z0-9_-]+):/gm
const NAVIGATION_GRAMMAR = ['modulo', 'modo', 'seccion', 'pestana', 'panel']
const REQUIRED_INSTRUCTION_ROOTS = ['CLAUDE.md', '.claude/skills', '.claude/agents']
const REQUIRED_NAVIGATION_PATHS = {
  manifest_path: 'frontend/src/lib/modules.ts',
  direction_path: 'frontend/src/lib/navegacion/direccion.ts'
}
const REQUIRED_FRONTEND_API = {
  directory: 'frontend/src/api',
  compatibility_barrel: 'frontend/src/api/client.ts'
}
const REQUIRED_EXTERNAL_SKILLS = ['emil-design-eng', 'govern-visual-harmony']
const REQUIRED_EXTERNAL_ROUTE = 'disenar'
const LEGACY_NAVIGATION_ALIASES = [
  'perfil', 'family', 'camino', 'ruta',
  'tab', 'vista', 'view',
  'stage', 'etapa',
  'mesa', 'desk', 'tipo',
  'step', 'paso', 'reporte'
]
const MAX_COMPATIBILITY_BARREL_LINES = 200

// Misma semántica que `wc -l`: la línea base es el número que ve una persona.
const countLines = (file) => {
  const content = fs.readFileSync(file, 'utf8')
  return content.split('\n').length - (content.endsWith('\n') ? 1 : 0)
}

function walkSources(root, dir, out) {
  let entries
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walkSources(root, full, out)
    } else if (entry.isFile() && SOURCE_EXT.has(path.extname(entry.name)) && !/\.test\.|\.spec\./.test(entry.name)) {
      out.push(path.relative(root, full).split(path.sep).join('/'))
    }
  }
  return out
}

function governanceDocs(root) {
  const docs = ['CLAUDE.md', 'AGENTS.md', 'docs/loops-reparacion.md']
  for (const [dir, file] of [['.claude/skills', 'SKILL.md'], ['.claude/agents', null]]) {
    const abs = path.join(root, dir)
    if (!fs.existsSync(abs)) continue
    for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
      if (file && entry.isDirectory()) docs.push(`${dir}/${entry.name}/${file}`)
      else if (!file && entry.isFile() && entry.name.endsWith('.md')) docs.push(`${dir}/${entry.name}`)
    }
  }
  return docs.filter((doc) => fs.existsSync(path.join(root, doc)))
}

const slash = (value) => value.split(path.sep).join('/')

function isSafeRelativePath(value) {
  if (typeof value !== 'string' || value.trim() !== value || value.length === 0 || path.isAbsolute(value)) return false
  const normalized = path.posix.normalize(value.replaceAll('\\', '/'))
  return normalized !== '..' && !normalized.startsWith('../')
}

function readText(file) {
  try {
    return fs.readFileSync(file, 'utf8')
  } catch {
    return null
  }
}

function extractConstBody(source, name, opener, closer) {
  const startPattern = new RegExp(`\\b${name}\\s*=\\s*\\${opener}`)
  const match = startPattern.exec(source)
  if (!match) return null
  const start = match.index + match[0].length
  const end = source.indexOf(closer, start)
  return end === -1 ? null : source.slice(start, end)
}

function stringLiterals(source) {
  return [...source.matchAll(/["'`]([^"'`]+)["'`]/g)].map(([, value]) => value)
}

function functionSection(source, name) {
  const startMatch = new RegExp(`\\bfunction\\s+${name}\\b`).exec(source)
  if (!startMatch) return null
  const start = startMatch.index
  const tail = source.slice(start + startMatch[0].length)
  const nextMatch = /\n\s*(?:export\s+)?function\s+[A-Za-z_$][\w$]*\b/.exec(tail)
  return nextMatch
    ? source.slice(start, start + startMatch[0].length + nextMatch.index)
    : source.slice(start)
}

function instructionDocs(repoRoot, roots, onError) {
  const docs = []
  const seen = new Set()

  const visit = (absolute, relative) => {
    let stat
    try {
      stat = fs.lstatSync(absolute)
    } catch {
      onError(`raíz de instrucciones inexistente: ${relative}`)
      return
    }
    if (stat.isSymbolicLink()) return
    if (stat.isFile()) {
      if (path.extname(absolute).toLowerCase() !== '.md') {
        onError(`raíz de instrucciones no es Markdown: ${relative}`)
        return
      }
      const normalized = slash(relative)
      if (!seen.has(normalized)) {
        seen.add(normalized)
        docs.push(normalized)
      }
      return
    }
    if (!stat.isDirectory()) {
      onError(`raíz de instrucciones no es archivo ni directorio: ${relative}`)
      return
    }
    const entries = fs.readdirSync(absolute, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name))
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue
      const childRelative = path.join(relative, entry.name)
      if (entry.isDirectory()) visit(path.join(absolute, entry.name), childRelative)
      else if (entry.isFile() && path.extname(entry.name).toLowerCase() === '.md') {
        visit(path.join(absolute, entry.name), childRelative)
      }
    }
  }

  for (const root of roots) visit(path.join(repoRoot, root), root)
  return docs
}

function lineOf(text, offset) {
  return text.slice(0, offset).split('\n').length
}

function validateSemanticContract(manifest, repoRoot, errors) {
  const semantic = manifest.policy?.semantic_contract
  const report = {
    configured: Boolean(semantic && typeof semantic === 'object' && !Array.isArray(semantic)),
    navigation: { status: 'error', version: null, grammar: [], manifestPath: null, directionPath: null },
    frontendApi: { status: 'error', directory: null, barrel: null, barrelLines: null, domainModules: [] },
    externalSkills: { status: 'error', allowed: [], declared: [], routeReferences: [] },
    instructions: { status: 'error', roots: [], scanned: 0, violations: [] }
  }
  const semanticError = (message) => errors.push(`contrato semántico: ${message}`)

  if (!report.configured) {
    semanticError('falta policy.semantic_contract — declara navegación, API frontend, skills externos e instrucciones canónicas')
    return report
  }

  // G. El manifiesto de navegación y la implementación de direcciones deben
  // describir la misma gramática v3. Los alias legacy pueden seguir leyéndose,
  // pero no sustituyen ninguno de los cinco nombres canónicos.
  const navigation = semantic.navigation
  let navigationShapeValid = true
  if (!navigation || typeof navigation !== 'object' || Array.isArray(navigation)) {
    semanticError('policy.semantic_contract.navigation debe ser un objeto')
    navigationShapeValid = false
  }
  const expectedVersion = navigation?.version
  const expectedGrammar = navigation?.grammar
  const manifestPath = navigation?.manifest_path
  const directionPath = navigation?.direction_path
  report.navigation.version = Number.isInteger(expectedVersion) ? expectedVersion : null
  report.navigation.grammar = Array.isArray(expectedGrammar) ? expectedGrammar : []
  report.navigation.manifestPath = typeof manifestPath === 'string' ? manifestPath : null
  report.navigation.directionPath = typeof directionPath === 'string' ? directionPath : null

  if (expectedVersion !== 3) {
    semanticError(`navigation.version debe ser 3; recibido ${JSON.stringify(expectedVersion)}`)
    navigationShapeValid = false
  }
  if (!Array.isArray(expectedGrammar) || expectedGrammar.length !== NAVIGATION_GRAMMAR.length ||
      expectedGrammar.some((level, index) => level !== NAVIGATION_GRAMMAR[index])) {
    semanticError(`navigation.grammar debe ser ${NAVIGATION_GRAMMAR.join(' → ')} en ese orden`)
    navigationShapeValid = false
  }
  for (const [field, value] of [['manifest_path', manifestPath], ['direction_path', directionPath]]) {
    if (!isSafeRelativePath(value)) {
      semanticError(`navigation.${field} debe ser una ruta relativa segura`)
      navigationShapeValid = false
    } else if (value !== REQUIRED_NAVIGATION_PATHS[field]) {
      semanticError(`navigation.${field} debe ser ${REQUIRED_NAVIGATION_PATHS[field]}; recibido ${value}`)
      navigationShapeValid = false
    }
  }

  let navigationSourceValid = navigationShapeValid
  if (isSafeRelativePath(manifestPath)) {
    const source = readText(path.join(repoRoot, manifestPath))
    if (source === null) {
      semanticError(`fuente de navegación inexistente: ${manifestPath}`)
      navigationSourceValid = false
    } else {
      const body = extractConstBody(source, 'PROSECNUR_NAVIGATION_CONTRACT', '{', '}')
      const sourceVersion = body?.match(/\bversion\s*:\s*(\d+)\b/)?.[1]
      const sourceGrammar = body?.match(/\bgrammar\s*:\s*["'`]([^"'`]+)["'`]/)?.[1]
      if (Number(sourceVersion) !== expectedVersion) {
        semanticError(`${manifestPath} debe exponer PROSECNUR_NAVIGATION_CONTRACT.version ${expectedVersion}; encontrado ${sourceVersion ?? 'ninguno'}`)
        navigationSourceValid = false
      }
      if (sourceGrammar !== expectedGrammar?.join('/')) {
        semanticError(`${manifestPath} debe exponer grammar "${expectedGrammar?.join('/') ?? NAVIGATION_GRAMMAR.join('/')}"; encontrado ${sourceGrammar ?? 'ninguno'}`)
        navigationSourceValid = false
      }
    }
  }

  if (isSafeRelativePath(directionPath)) {
    const source = readText(path.join(repoRoot, directionPath))
    if (source === null) {
      semanticError(`fuente de direcciones inexistente: ${directionPath}`)
      navigationSourceValid = false
    } else {
      const levelsBody = extractConstBody(source, 'NIVELES_DIRECCION', '[', ']')
      const levels = levelsBody ? stringLiterals(levelsBody) : []
      if (levels.length !== expectedGrammar?.length ||
          levels.some((level, index) => level !== expectedGrammar[index])) {
        semanticError(`${directionPath} debe declarar NIVELES_DIRECCION como ${expectedGrammar?.join(' → ') ?? NAVIGATION_GRAMMAR.join(' → ')}`)
        navigationSourceValid = false
      }
      const paramsBody = extractConstBody(source, 'PARAMS_DIRECCION', '{', '}')
      const serializer = functionSection(source, 'serializarDireccion')
      if (!serializer) {
        semanticError(`${directionPath} debe exponer serializarDireccion como escritor canónico`)
        navigationSourceValid = false
      }
      for (const level of NAVIGATION_GRAMMAR.slice(1)) {
        const canonicalParam = new RegExp(`\\b${level}\\s*:\\s*["'\`]${level}["'\`]`)
        if (!paramsBody || !canonicalParam.test(paramsBody)) {
          semanticError(`${directionPath} debe declarar PARAMS_DIRECCION.${level}="${level}"`)
          navigationSourceValid = false
        }
        const canonicalWrite = new RegExp(`params\\.set\\(\\s*PARAMS_DIRECCION\\.${level}\\b`)
        if (!serializer || !canonicalWrite.test(serializer)) {
          semanticError(`${directionPath} debe serializar ${level} mediante PARAMS_DIRECCION.${level}; los alias legacy son solo de lectura`)
          navigationSourceValid = false
        }
      }
      if (serializer) {
        const aliasAlternation = LEGACY_NAVIGATION_ALIASES.join('|')
        const legacyWrite = new RegExp(
          `\\bparams\\.(?:set|append)\\(\\s*["'\`](${aliasAlternation})["'\`]`,
          'g'
        )
        for (const match of serializer.matchAll(legacyWrite)) {
          semanticError(`${directionPath} serializa el alias legacy "${match[1]}" en serializarDireccion; los alias solo pueden leerse o eliminarse`)
          navigationSourceValid = false
        }
      }
    }
  }
  report.navigation.status = navigationSourceValid ? 'ok' : 'error'

  // H. `client.ts` ya no es el API: es una superficie de compatibilidad corta
  // que re-exporta módulos por dominio.
  const frontendApi = semantic.frontend_api
  let apiValid = true
  if (!frontendApi || typeof frontendApi !== 'object' || Array.isArray(frontendApi)) {
    semanticError('policy.semantic_contract.frontend_api debe ser un objeto')
    apiValid = false
  }
  const apiDirectory = frontendApi?.directory
  const compatibilityBarrel = frontendApi?.compatibility_barrel
  report.frontendApi.directory = typeof apiDirectory === 'string' ? apiDirectory : null
  report.frontendApi.barrel = typeof compatibilityBarrel === 'string' ? compatibilityBarrel : null
  for (const [field, value] of [['directory', apiDirectory], ['compatibility_barrel', compatibilityBarrel]]) {
    if (!isSafeRelativePath(value)) {
      semanticError(`frontend_api.${field} debe ser una ruta relativa segura`)
      apiValid = false
    } else if (value !== REQUIRED_FRONTEND_API[field]) {
      semanticError(`frontend_api.${field} debe ser ${REQUIRED_FRONTEND_API[field]}; recibido ${value}`)
      apiValid = false
    }
  }

  if (isSafeRelativePath(apiDirectory)) {
    const directoryAbs = path.join(repoRoot, apiDirectory)
    let stat
    try {
      stat = fs.statSync(directoryAbs)
    } catch {
      stat = null
    }
    if (!stat?.isDirectory()) {
      semanticError(`directorio API frontend inexistente: ${apiDirectory}`)
      apiValid = false
    } else {
      report.frontendApi.domainModules = fs.readdirSync(directoryAbs, { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith('.ts') &&
          !entry.name.endsWith('.test.ts') && !entry.name.endsWith('.spec.ts') &&
          slash(path.join(apiDirectory, entry.name)) !== compatibilityBarrel)
        .map((entry) => slash(path.join(apiDirectory, entry.name)))
        .sort()
      if (report.frontendApi.domainModules.length === 0) {
        semanticError(`${apiDirectory} no contiene módulos de dominio TypeScript fuera del barrel de compatibilidad`)
        apiValid = false
      }
    }
  }

  if (isSafeRelativePath(compatibilityBarrel)) {
    const barrel = readText(path.join(repoRoot, compatibilityBarrel))
    if (barrel === null) {
      semanticError(`barrel de compatibilidad inexistente: ${compatibilityBarrel}`)
      apiValid = false
    } else {
      const barrelLines = countLines(path.join(repoRoot, compatibilityBarrel))
      report.frontendApi.barrelLines = barrelLines
      if (barrelLines > MAX_COMPATIBILITY_BARREL_LINES) {
        semanticError(`${compatibilityBarrel} tiene ${barrelLines} líneas; el barrel de compatibilidad admite como máximo ${MAX_COMPATIBILITY_BARREL_LINES}`)
        apiValid = false
      }
      const barrelCode = barrel
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '')
      const reexports = [...barrelCode.matchAll(/^\s*export\s+(?:\*|\{[\s\S]*?\})\s+from\s+["'](\.[^"']+)["']/gm)]
      if (reexports.length === 0) {
        semanticError(`${compatibilityBarrel} debe re-exportar al menos un módulo de dominio`)
        apiValid = false
      }
      if (/(?:^|\n)\s*(?:export\s+)?(?:async\s+)?(?:function|class)\s+|(?:^|\n)\s*(?:export\s+)?const\s+\w+\s*=|\b(?:fetch|axios)\s*\(/m.test(barrelCode)) {
        semanticError(`${compatibilityBarrel} contiene implementación; debe seguir siendo solo una superficie de re-exportación compatible`)
        apiValid = false
      }
      for (const [, specifier] of reexports) {
        const target = path.resolve(path.dirname(path.join(repoRoot, compatibilityBarrel)), specifier)
        if (![`${target}.ts`, path.join(target, 'index.ts')].some(fs.existsSync)) {
          semanticError(`${compatibilityBarrel} re-exporta un módulo inexistente: ${specifier}`)
          apiValid = false
        }
      }
    }
  }
  report.frontendApi.status = apiValid ? 'ok' : 'error'

  // I. Los overlays de producto viven ya en el repositorio. Solo los skills
  // universales expresamente permitidos pueden ser dependencias externas.
  const externalPolicy = semantic.external_skills
  let externalValid = true
  if (!externalPolicy || typeof externalPolicy !== 'object' || Array.isArray(externalPolicy)) {
    semanticError('policy.semantic_contract.external_skills debe ser un objeto')
    externalValid = false
  }
  const allowed = externalPolicy?.allowed
  const externalRoute = externalPolicy?.route
  const forbiddenPrefixes = externalPolicy?.forbidden_prefixes
  if (!Array.isArray(allowed) || allowed.length === 0 ||
      allowed.some((item) => typeof item !== 'string' || item.length === 0) ||
      new Set(allowed).size !== allowed.length) {
    semanticError('external_skills.allowed debe ser una lista no vacía de nombres únicos')
    externalValid = false
  }
  if (!Array.isArray(forbiddenPrefixes) || forbiddenPrefixes.length === 0 ||
      forbiddenPrefixes.some((item) => typeof item !== 'string' || item.length === 0)) {
    semanticError('external_skills.forbidden_prefixes debe ser una lista no vacía de prefijos')
    externalValid = false
  }
  const safeAllowed = Array.isArray(allowed) ? allowed.filter((item) => typeof item === 'string') : []
  const safePrefixes = Array.isArray(forbiddenPrefixes) ? forbiddenPrefixes.filter((item) => typeof item === 'string') : []
  if (externalRoute !== REQUIRED_EXTERNAL_ROUTE) {
    semanticError(`external_skills.route debe ser ${REQUIRED_EXTERNAL_ROUTE}; recibido ${JSON.stringify(externalRoute)}`)
    externalValid = false
  }
  if (safeAllowed.length !== REQUIRED_EXTERNAL_SKILLS.length ||
      REQUIRED_EXTERNAL_SKILLS.some((name) => !safeAllowed.includes(name))) {
    semanticError(`external_skills.allowed debe contener exactamente ${REQUIRED_EXTERNAL_SKILLS.join(', ')}`)
    externalValid = false
  }
  const declared = Array.isArray(manifest.external_skills)
    ? manifest.external_skills.filter((item) => typeof item === 'string')
    : []
  report.externalSkills.allowed = safeAllowed
  report.externalSkills.declared = declared
  if (!Array.isArray(manifest.external_skills) ||
      manifest.external_skills.some((item) => typeof item !== 'string' || item.length === 0) ||
      new Set(manifest.external_skills).size !== manifest.external_skills.length) {
    semanticError('manifest.external_skills debe ser una lista de nombres únicos')
    externalValid = false
  }
  const allowedSet = new Set(safeAllowed)
  const declaredSet = new Set(declared)
  const missingExternal = safeAllowed.filter((name) => !declaredSet.has(name))
  const unexpectedExternal = declared.filter((name) => !allowedSet.has(name))
  if (missingExternal.length || unexpectedExternal.length || declaredSet.size !== declared.length) {
    semanticError(`manifest.external_skills debe coincidir con allowed; faltan [${missingExternal.join(', ')}], sobran [${unexpectedExternal.join(', ')}]`)
    externalValid = false
  }
  for (const name of new Set([...safeAllowed, ...declared])) {
    const prefix = safePrefixes.find((candidate) => name.startsWith(candidate))
    if (prefix) {
      semanticError(`skill externo prohibido por prefijo "${prefix}": ${name}; absorbe el overlay de producto en .claude/skills`)
      externalValid = false
    }
  }
  const routeReferences = []
  for (const [routeName, route] of Object.entries(manifest.routes ?? {})) {
    if (!Array.isArray(route.external)) {
      semanticError(`routes.${routeName}.external debe ser una lista`)
      externalValid = false
      continue
    }
    for (const name of route.external) {
      routeReferences.push({ route: routeName, skill: name })
      if (!allowedSet.has(name) || !declaredSet.has(name)) {
        semanticError(`routes.${routeName}.external usa "${name}" fuera del conjunto externo permitido y declarado`)
        externalValid = false
      }
      const prefix = safePrefixes.find((candidate) => typeof name === 'string' && name.startsWith(candidate))
      if (prefix) {
        semanticError(`routes.${routeName}.external conserva el overlay retirado "${name}" (prefijo prohibido "${prefix}")`)
        externalValid = false
      }
    }
  }
  const policyRoute = manifest.routes?.[REQUIRED_EXTERNAL_ROUTE]
  if (!policyRoute) {
    semanticError(`falta routes.${REQUIRED_EXTERNAL_ROUTE}, única ruta autorizada para skills externos`)
    externalValid = false
  } else {
    const routeExternal = Array.isArray(policyRoute.external) ? policyRoute.external : []
    if (routeExternal.length !== REQUIRED_EXTERNAL_SKILLS.length ||
        REQUIRED_EXTERNAL_SKILLS.some((name) => !routeExternal.includes(name))) {
      semanticError(`routes.${REQUIRED_EXTERNAL_ROUTE}.external debe contener exactamente ${REQUIRED_EXTERNAL_SKILLS.join(', ')}`)
      externalValid = false
    }
  }
  for (const [routeName, route] of Object.entries(manifest.routes ?? {})) {
    if (routeName === REQUIRED_EXTERNAL_ROUTE || !Array.isArray(route.external)) continue
    if (route.external.length > 0) {
      semanticError(`routes.${routeName}.external debe quedar vacío; los skills externos solo pertenecen a ${REQUIRED_EXTERNAL_ROUTE}`)
      externalValid = false
    }
  }
  report.externalSkills.routeReferences = routeReferences
  report.externalSkills.status = externalValid ? 'ok' : 'error'

  // J. Solo se escanean fuentes canónicas: no adaptadores generados ni
  // documentos históricos. Los fragmentos son literales deliberadamente
  // precisos para que una negación o una memoria histórica no dispare ruido.
  const instructions = semantic.instructions
  let instructionsValid = true
  if (!instructions || typeof instructions !== 'object' || Array.isArray(instructions)) {
    semanticError('policy.semantic_contract.instructions debe ser un objeto')
    instructionsValid = false
  }
  const roots = instructions?.roots
  const forbiddenFragments = instructions?.forbidden_fragments
  if (!Array.isArray(roots) || roots.length === 0 || roots.some((root) => !isSafeRelativePath(root))) {
    semanticError('instructions.roots debe ser una lista no vacía de rutas relativas seguras')
    instructionsValid = false
  }
  const safeRoots = Array.isArray(roots) ? roots.filter(isSafeRelativePath) : []
  if (safeRoots.length !== REQUIRED_INSTRUCTION_ROOTS.length ||
      new Set(safeRoots).size !== safeRoots.length ||
      REQUIRED_INSTRUCTION_ROOTS.some((required) => !safeRoots.includes(required))) {
    semanticError(`instructions.roots debe contener exactamente ${REQUIRED_INSTRUCTION_ROOTS.join(', ')}`)
    instructionsValid = false
  }
  if (!Array.isArray(forbiddenFragments) || forbiddenFragments.length === 0 ||
      forbiddenFragments.some((fragment) => typeof fragment !== 'string' || fragment.length === 0) ||
      new Set(forbiddenFragments).size !== forbiddenFragments?.length) {
    semanticError('instructions.forbidden_fragments debe ser una lista no vacía de strings literales únicos')
    instructionsValid = false
  }
  const safeFragments = Array.isArray(forbiddenFragments)
    ? forbiddenFragments.filter((fragment) => typeof fragment === 'string' && fragment.length > 0)
    : []
  report.instructions.roots = safeRoots
  const docs = instructionDocs(repoRoot, safeRoots, (message) => {
    semanticError(message)
    instructionsValid = false
  })
  report.instructions.scanned = docs.length
  for (const doc of docs) {
    const text = readText(path.join(repoRoot, doc))
    if (text === null) continue
    for (const fragment of safeFragments) {
      const offset = text.indexOf(fragment)
      if (offset === -1) continue
      const violation = { doc, line: lineOf(text, offset), fragment }
      report.instructions.violations.push(violation)
      semanticError(`fragmento obsoleto en ${doc}:${violation.line}: ${JSON.stringify(fragment)}`)
      instructionsValid = false
    }
  }
  report.instructions.status = instructionsValid ? 'ok' : 'error'

  return report
}

/**
 * @returns {{errors: string[], warnings: string[], report: object}}
 */
export function runGovernanceAudit(manifest, repoRoot) {
  const errors = []
  const warnings = []
  const report = {}
  const abs = (p) => path.join(repoRoot, p)
  const exists = (p) => fs.existsSync(abs(p))

  const policy = manifest.policy ?? {}
  const frozen = Array.isArray(policy.frozen_growth_files) ? policy.frozen_growth_files : []
  const baseline = policy.frozen_growth_baseline ?? {}
  const exempt = new Set(policy.frozen_growth_exempt ?? [])
  const threshold = Number.isInteger(policy.frozen_growth_threshold) ? policy.frozen_growth_threshold : null

  // A. Los archivos congelados existen y no crecieron sobre su línea base.
  const frozenReport = []
  for (const file of frozen) {
    if (!exists(file)) {
      errors.push(`congelado inexistente: ${file} — retíralo de policy.frozen_growth_files o corrige la ruta`)
      continue
    }
    const lines = countLines(abs(file))
    const max = baseline[file]
    if (!Number.isInteger(max)) {
      errors.push(`congelado sin línea base: ${file} — declara policy.frozen_growth_baseline["${file}"] = ${lines}`)
      frozenReport.push({ file, lines, baseline: null, delta: null })
      continue
    }
    const delta = lines - max
    frozenReport.push({ file, lines, baseline: max, delta })
    if (delta > 0) {
      errors.push(`archivo congelado creció: ${file} ${lines} líneas vs ${max} de línea base (+${delta}). Mueve la funcionalidad nueva a un archivo propio o sube la línea base deliberadamente`)
    }
  }
  report.frozen = frozenReport

  // B. Ningún monolito queda sin gobierno. Todo archivo sobre el umbral está
  //    congelado o exento con decisión explícita.
  if (threshold) {
    const governed = new Set([...frozen, ...exempt])
    const ungoverned = []
    for (const dir of ['api/R', 'frontend/src']) {
      if (!exists(dir)) continue
      for (const file of walkSources(repoRoot, abs(dir), [])) {
        if (governed.has(file)) continue
        const lines = countLines(abs(file))
        if (lines >= threshold) ungoverned.push({ file, lines })
      }
    }
    ungoverned.sort((a, b) => b.lines - a.lines)
    report.ungoverned = ungoverned
    for (const { file, lines } of ungoverned) {
      errors.push(`monolito sin gobierno: ${file} (${lines} líneas >= umbral ${threshold}) — añádelo a policy.frozen_growth_files con su línea base, o a policy.frozen_growth_exempt con razón`)
    }
  }

  // C. Nada declarado queda sin conectar a una ruta.
  const routes = Object.values(manifest.routes ?? {})
  const usedSkills = new Set(routes.flatMap((r) => r.skills ?? []))
  const usedAgents = new Set(routes.flatMap((r) => Object.values(r.pools ?? {}).flat()))
  const orphanSkills = (manifest.skills ?? []).filter((s) => !usedSkills.has(s))
  const orphanAgents = (manifest.agents ?? []).filter((a) => !usedAgents.has(a))
  report.orphans = { skills: orphanSkills, agents: orphanAgents }
  for (const s of orphanSkills) errors.push(`skill huérfano: ${s} está declarado y sincronizado pero ninguna ruta lo carga`)
  for (const a of orphanAgents) errors.push(`agente huérfano: ${a} está declarado pero ningún pool lo usa`)

  // D y E. Lo que los documentos de gobierno citan, existe.
  const docs = governanceDocs(repoRoot)
  const brokenPaths = []
  const citedTargets = new Set()
  for (const doc of docs) {
    const text = fs.readFileSync(abs(doc), 'utf8')
    for (const [, cited] of text.matchAll(CITED_PATH)) {
      if (!cited.includes('/')) continue
      if (!PATH_PREFIXES.some((prefix) => exists(prefix + cited))) brokenPaths.push({ doc, cited })
    }
    for (const [, target] of text.matchAll(CITED_MAKE)) citedTargets.add(target)
  }
  report.docs = { scanned: docs.length, brokenPaths }
  for (const { doc, cited } of brokenPaths) errors.push(`ruta inexistente citada en ${doc}: ${cited}`)

  const makefile = exists('Makefile') ? fs.readFileSync(abs('Makefile'), 'utf8') : ''
  const realTargets = new Set([...makefile.matchAll(MAKE_TARGET)].map(([, t]) => t))
  const brokenTargets = [...citedTargets].filter((t) => !realTargets.has(t)).sort()
  report.makeTargets = { cited: citedTargets.size, broken: brokenTargets }
  for (const t of brokenTargets) errors.push(`make target citado en documentación pero inexistente: make ${t}`)

  // F. Carga por ruta. Informativo: una rama muy por encima del resto es señal
  //    de solapamiento, no un fallo objetivo.
  const load = Object.entries(manifest.routes ?? {})
    .map(([name, r]) => ({ name, own: (r.skills ?? []).length, external: (r.external ?? []).length }))
    .map((r) => ({ ...r, total: r.own + r.external }))
    .sort((a, b) => b.total - a.total)
  report.load = load
  if (load.length > 1) {
    const median = load.map((r) => r.total).sort((a, b) => a - b)[Math.floor(load.length / 2)]
    for (const r of load) {
      if (r.total >= median * 2) warnings.push(`ruta sobrecargada: ${r.name} carga ${r.total} (${r.own} propios + ${r.external} externos) contra una mediana de ${median}; revisa solapamiento`)
    }
  }

  // G–J. Contratos semánticos de producto que una verificación puramente
  // estructural no puede inferir del manifest.
  report.semantic = validateSemanticContract(manifest, repoRoot, errors)

  return { errors, warnings, report }
}

export function formatAuditReport(report) {
  const lines = []
  if (report.frozen?.length) {
    lines.push('Archivos congelados:')
    for (const f of report.frozen) {
      const margin = f.delta === null ? 'sin línea base' : f.delta === 0 ? 'en su línea base' : `${f.delta > 0 ? '+' : ''}${f.delta}`
      lines.push(`  ${String(f.lines).padStart(6)}  ${f.file}  (${margin})`)
    }
  }
  if (report.ungoverned?.length) {
    lines.push('Monolitos sin gobierno:')
    for (const f of report.ungoverned) lines.push(`  ${String(f.lines).padStart(6)}  ${f.file}`)
  }
  lines.push(`Huérfanos: ${report.orphans.skills.length} skills, ${report.orphans.agents.length} agentes.`)
  lines.push(`Documentos de gobierno: ${report.docs.scanned} leídos, ${report.docs.brokenPaths.length} rutas rotas.`)
  lines.push(`Make targets citados: ${report.makeTargets.cited}, inexistentes: ${report.makeTargets.broken.length}.`)
  lines.push(`Carga por ruta: ${report.load.map((r) => `${r.name}=${r.total}`).join(', ')}.`)
  if (report.semantic) {
    const semantic = report.semantic
    lines.push(`Contrato semántico: navegación=${semantic.navigation.status}, API=${semantic.frontendApi.status}, externos=${semantic.externalSkills.status}, instrucciones=${semantic.instructions.status}.`)
    lines.push(`  Navegación: v${semantic.navigation.version ?? '?'} ${semantic.navigation.grammar.join(' → ') || 'sin gramática'}.`)
    lines.push(`  API frontend: ${semantic.frontendApi.domainModules.length} módulos; barrel ${semantic.frontendApi.barrelLines ?? '?'} líneas.`)
    lines.push(`  Skills externos: ${semantic.externalSkills.declared.join(', ') || 'ninguno'}; ${semantic.externalSkills.routeReferences.length} referencias de ruta.`)
    lines.push(`  Instrucciones canónicas: ${semantic.instructions.scanned} Markdown; ${semantic.instructions.violations.length} fragmentos obsoletos.`)
  }
  return lines.join('\n')
}
