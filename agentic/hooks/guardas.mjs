#!/usr/bin/env node
// Guardas PreToolUse del proyecto (registradas en .claude/settings.json).
//
// Cada una existe porque la regla en prosa no frenó el error:
// - Árbol compartido: ocho memorias entre 2026-07-30 y 2026-11-04 por un
//   `git add -A`, un `commit -a` o un `stash` que se llevó trabajo de otra sesión.
// - `R CMD INSTALL`: seis memorias; dos instalaciones a la vez dejan la librería
//   vacía y la app del usuario cae con "failed to fetch".
// - Adaptadores generados (`.codex/`, `.agents/`): se regeneran con
//   `node agentic/sync-agentic-os.mjs --write`; una edición manual se pierde.
// - Sheets del equipo: hay personas trabajando en vivo sobre esas hojas.
// - Tag de release: 14 de 19 tags se empujaron sin esperar el Quality verde de
//   su commit (guarda-tag-release.mjs).
//
// Decisiones: "deny" bloquea y le explica al agente qué hacer; "ask" deja la
// decisión al usuario; sin salida, la llamada sigue su curso normal.
// Ante cualquier error propio la guarda no bloquea: un hook roto no puede
// detener todas las sesiones.

import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { revisarPublicacionOpaca, revisarPushDeTag, sondasDeTagReales } from './guarda-tag-release.mjs'

const deny = (motivo) => ({ decision: 'deny', motivo })
const ask = (motivo) => ({ decision: 'ask', motivo })

/**
 * Quita cuerpos de heredoc y cadenas entre comillas: ahí vive texto, no comandos.
 * Las dos clases de comillas van en UNA pasada: en dos, una comilla doble dentro
 * de comillas simples se tragaba el comando real que venía después.
 */
export function soloComandos(comando) {
  return comando
    .replace(/\\\r?\n/gu, ' ')
    .replace(/(?<!<)<<(?!<)-?\s*(['"]?)(\w+)\1[\s\S]*?\n\s*\2\b/gu, ' ')
    .replace(/"(?:[^"\\]|\\.)*"|'[^']*'/gu, (m) => (m[0] === '"' ? '""' : "''"))
}

/**
 * Parte en comandos simples. Paréntesis, llaves, `$(`, acentos graves, `&` y
 * redirecciones cuentan como separadores: `(cd api && git add -A)` y
 * `git add -A>/dev/null` dejaban el flag pegado a la puntuación y pasaban.
 */
function segmentos(comando) {
  return soloComandos(comando)
    .replace(/\$\(|[(){}`]/gu, ' ; ')
    .replace(/\d*[<>]+&?\d*/gu, ' ; ')
    .split(/[;|&\n]+/u)
    .map((s) => s.trim())
    .filter(Boolean)
}

/** Devuelve [subcomando, ...args] si el segmento invoca git; null si no. */
function git(segmento) {
  const tokens = segmento.split(/\s+/u)
  let i = tokens.findIndex((t) => t === 'git' || t.endsWith('/git'))
  if (i < 0) return null
  i += 1
  while (i < tokens.length && tokens[i].startsWith('-')) i += CON_VALOR.has(tokens[i]) ? 2 : 1
  return tokens.slice(i)
}

const CON_VALOR = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--exec-path', '--super-prefix'])
/** `--al` y `--all` son el mismo flag: git acepta prefijos no ambiguos. */
const esAll = (a) => a.length >= 4 && '--all'.startsWith(a)

const STASH_INOCUOS = new Set(['list', 'show', 'pop', 'apply', 'drop', 'branch', 'clear', 'create', 'store'])

export function revisarGit(comando) {
  for (const segmento of segmentos(comando)) {
    const partes = git(segmento)
    if (!partes?.length) continue
    const [sub, ...args] = partes
    if (sub === 'add' && args.some((a) => esAll(a) || (a.length >= 4 && '--update'.startsWith(a)) || a === '.' || a === './' || a === '*' || a === ':/' || /^-[a-zA-Z]*[Au][a-zA-Z]*$/u.test(a))) {
      return deny('Árbol compartido con otras sesiones: no se agrega todo de golpe. Usa `git add -- <archivo> <archivo>` con los archivos de tu unidad, por nombre.')
    }
    if (sub === 'commit' && args.some((a) => esAll(a) || a === '.' || a === './' || /^-[a-zA-Z]*a[a-zA-Z]*$/u.test(a))) {
      return deny('Árbol compartido con otras sesiones: `git commit -a` se lleva cambios ajenos. Agrega tus archivos por nombre con `git add -- <archivo>` y commitea sin `-a`.')
    }
    if (sub === 'stash') {
      // El valor de -m no es una acción: `git stash -m pop` es un push.
      const accion = args.find((a, i) => !a.startsWith('-') && args[i - 1] !== '-m' && args[i - 1] !== '--message')
      const conRutas = args.includes('--') && args.indexOf('--') < args.length - 1
      if (!(accion && STASH_INOCUOS.has(accion)) && !conRutas) {
        return deny('Árbol compartido con otras sesiones: un `git stash` sin rutas secuestra el trabajo sin commitear de las demás. Si de verdad lo necesitas, `git stash push -- <tus archivos>`; para comparar contra HEAD usa `git show HEAD:<archivo>` o un worktree.')
      }
    }
  }
  return null
}

/** El push de un tag `vX.Y.Z` exige Quality verde en el commit que se empuja (guarda-tag-release.mjs). */
export function revisarTagDeRelease(comando, cwd, sondasDeTag = sondasDeTagReales) {
  const traducir = (r) => (r ? (r.decision === 'deny' ? deny(r.motivo) : ask(r.motivo)) : null)
  // `soloComandos` vacía las comillas, y un tag, un refspec o una variable pueden
  // venir entre ellas: se quitan las que envuelven un solo token. Un mensaje de
  // commit lleva espacios y sigue siendo texto.
  const sinComillas = comando.replace(/(["'])([^"'\s;|&()<>]+)\1/gu, '$2')
  const opaca = revisarPublicacionOpaca(soloComandos(sinComillas))
  if (opaca) return traducir(opaca)
  const preparado = sinComillas
    // `v0.9.6^{}` es el commit del tag: las llaves partirían el comando en `segmentos`.
    .replace(/\^\{\w*\}/gu, '')
    // Un tag pegado a una redirección (`v0.9.6>/dev/null`) perdía su último dígito,
    // que `segmentos` toma por un descriptor de archivo.
    .replace(/(v\d+\.\d+\.\d+[\w.+-]*)(?=[<>])/gu, '$1 ')
  for (const segmento of segmentos(preparado)) {
    const partes = git(segmento)
    const resultado = partes?.length ? revisarPushDeTag(partes, cwd, sondasDeTag) : null
    if (resultado) return traducir(resultado)
  }
  return null
}

export function revisarInstalacionR(comando, sondas = sondasReales) {
  if (!/\bR\s+CMD\s+INSTALL\b/u.test(soloComandos(comando))) return null
  const enCurso = sondas.instalacionEnCurso()
  if (enCurso) return deny(`Ya hay un \`R CMD INSTALL\` corriendo (${enCurso}). Dos instalaciones a la vez dejan la librería vacía y tumban la app. Espera a que termine; no lo mates.`)
  const lock = sondas.lock()
  if (lock) return deny(`Existe ${lock}: una instalación anterior quedó a medias o sigue en curso. Comprueba con \`pgrep -fl "R CMD INSTALL"\`; si no hay ninguna, avisa al usuario antes de borrar el lock.`)
  // Decisión del dueño (2026-11-10): se le pregunta solo si está activo. Su
  // backend escucha en 8787; mientras dure la instalación su app no responde.
  if (sondas.backendDelUsuarioEnUso()) return ask('El backend del usuario está escuchando en el puerto 8787. Instalar el paquete deja su app sin responder varios minutos: requiere su visto bueno.')
  return null
}

const sondasReales = {
  instalacionEnCurso() {
    try {
      const salida = execFileSync('pgrep', ['-fl', 'R CMD INSTALL|R_INSTALL_PKG|tools:::.install_packages'], { encoding: 'utf8' }).trim()
      return salida ? salida.split('\n')[0].slice(0, 80) : null
    } catch {
      return null // pgrep sale con 1 cuando no encuentra nada
    }
  },
  backendDelUsuarioEnUso() {
    try {
      return execFileSync('lsof', ['-nP', '-iTCP:8787', '-sTCP:LISTEN', '-t'], { encoding: 'utf8', timeout: 5000 }).trim().length > 0
    } catch {
      return false // lsof sale con 1 cuando nadie escucha
    }
  },
  lock() {
    try {
      const lib = execFileSync('Rscript', ['-e', 'cat(.libPaths()[1])'], { encoding: 'utf8', timeout: 8000 }).trim()
      const hallado = lib && existsSync(lib) ? readdirSync(lib).find((n) => n.startsWith('00LOCK')) : null
      return hallado ? path.join(lib, hallado) : null
    } catch {
      return null
    }
  },
}

const PUBLICA_EN_SHEETS = /publicar-libro|publicar-distribucion|publicar-marcas|aulas\/sync(?![\w-])|sheets\/publish|publication\/sheets|ronda\/publicar/u
const CLIENTE_HTTP = /(?:^|[\s"'(])(?:curl|wget|http|https|httr2?|fetch|requests\.post)\b/u

/** Lee el comando crudo (la URL suele ir entre comillas), pero por tramo: un commit que la menciona no cuenta. */
export function revisarPublicacion(comando) {
  const publica = comando
    .split(/&&|\|\||[;\n]/u)
    .some((tramo) => PUBLICA_EN_SHEETS.test(tramo) && CLIENTE_HTTP.test(tramo) && !/^\s*(?:git|grep|rg|echo)\b/u.test(tramo))
  if (!publica) return null
  return ask('Esta llamada publica o sincroniza contra un Sheets del equipo, donde hay personas trabajando en vivo. Requiere el sí del usuario para esta operación.')
}

const GENERADOS = ['.codex', '.agents']

export function revisarAdaptador(rutaArchivo, raiz) {
  if (!rutaArchivo) return null
  const relativa = path.relative(raiz, path.resolve(raiz, rutaArchivo))
  if (relativa.startsWith('..')) return null
  const primero = relativa.split(path.sep)[0]
  // macOS no distingue mayúsculas en el volumen por defecto: `.CODEX/` es el mismo directorio.
  if (!GENERADOS.includes(primero.toLowerCase())) return null
  return deny(`\`${primero}/\` contiene adaptadores generados. Edita la fuente canónica en \`.claude/agents/\` o \`.claude/skills/\` y ejecuta \`node agentic/sync-agentic-os.mjs --write\`.`)
}

const ESCRIBE_EN_SHEETS = /^mcp__.+__(?:update_values|append_values|batch_clear_values|update_formulas|insert_dimension|update_spreadsheet|copy_sheet_to_another_spreadsheet)$/u

export function decidir(entrada, sondas = sondasReales, sondasDeTag = sondasDeTagReales) {
  const herramienta = entrada?.tool_name ?? ''
  const datos = entrada?.tool_input ?? {}
  const cwd = entrada?.cwd ?? process.cwd()
  const raiz = process.env.CLAUDE_PROJECT_DIR || cwd

  if (herramienta === 'Bash') {
    const comando = String(datos.command ?? '')
    // Un worktree propio no se comparte con otras sesiones: ahí git queda libre,
    // salvo que el comando salga de él con `-C`, `--git-dir`, `--work-tree` o un `cd`.
    const saleDelWorktree = /(?:^|\s)(?:-C|--git-dir|--work-tree)(?:\s|=)|(?:^|[\s;&(])cd\s/u.test(soloComandos(comando))
    const enWorktree = typeof cwd === 'string' && cwd.includes(`${path.sep}.claude${path.sep}worktrees${path.sep}`) && !saleDelWorktree
    // Los tags son del repositorio, no del worktree: esta guarda no se relaja ahí.
    return (enWorktree ? null : revisarGit(comando)) ?? revisarTagDeRelease(comando, cwd, sondasDeTag) ?? revisarInstalacionR(comando, sondas) ?? revisarPublicacion(comando)
  }
  if (herramienta === 'Edit' || herramienta === 'Write' || herramienta === 'NotebookEdit') {
    return revisarAdaptador(datos.file_path ?? datos.notebook_path, raiz)
  }
  if (ESCRIBE_EN_SHEETS.test(herramienta)) {
    return ask('Escribir en un Sheets es publicar: puede haber alguien trabajando en vivo sobre esa hoja. Requiere el sí del usuario para esta operación.')
  }
  return null
}

function main() {
  let resultado = null
  try {
    resultado = decidir(JSON.parse(readFileSync(0, 'utf8') || '{}'))
  } catch {
    resultado = null
  }
  if (!resultado) return
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: resultado.decision,
      permissionDecisionReason: resultado.motivo,
    },
  }))
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main()
