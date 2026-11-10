// Guarda del push de un tag de release (la llama guardas.mjs).
//
// El push de un tag `vX.Y.Z` dispara Release, que corre el gate de Quality
// entero salvo que ese commit ya lo tenga en verde. El skill /publicar pide
// "Quality verde en el mismo SHA" antes del tag, y aun así 14 de 19 corridas de
// tag se lanzaron sin esperarlo: el gate corrió dos veces, falló dos veces por
// lo mismo y el tag se movió 14 veces en 10 versiones
// (docs/qa/diagnostico-ciclo-release-2026-11-10.md).
//
// Decisiones:
// - Quality verde en el commit que se empuja: pasa.
// - Quality en curso o en rojo en ese commit: se bloquea. Pushear el tag no
//   aporta nada que el run de main no vaya a decir.
// - Sin corrida, corrida cancelada, o sin poder saberlo (sin red, `gh` caído,
//   tag en una variable, todos los tags de golpe, `gh release create`): se
//   pregunta al usuario. Es la salida para el reuso por ancestro del ADR 0059
//   y para un GitHub que no responde; la decide el dueño, no el agente.
//
// Es una guarda contra el descuido, no contra quien quiera rodearla: no ve un
// push escondido en `bash -c`, `eval`, `xargs`, un alias de git ni una
// expansión de llaves (`v0.9.{5,6}`).

import { execFileSync } from 'node:child_process'

const TAG_DE_RELEASE = /^v\d+\.\d+\.\d+[\w.+-]*$/u
/** git acepta prefijos no ambiguos: `--tag`, `--follow-tag`, `--mirro`. */
const esPrefijoDe = (flag, minimo) => (a) => a.length >= minimo && flag.startsWith(a)
const EMPUJA_TODOS = [esPrefijoDe('--tags', 5), esPrefijoDe('--follow-tags', 5), esPrefijoDe('--mirror', 4)]
const esSimulacro = (a) => a === '-n' || (a.length >= 4 && '--dry-run'.startsWith(a))
/** El hook tiene 15 s (.claude/settings.json): la guarda entera se queda en 12. */
const PRESUPUESTO_MS = 12000
const TOPE_POR_CONSULTA_MS = 6000

/**
 * Lo que un `git push` ya partido en [sub, ...args] empuja como tag de release.
 * Cada entrada es { tag, origen }: `origen` es la referencia cuyo commit llega
 * al remoto, que en `HEAD:refs/tags/v1.2.3` es `HEAD` y no el tag local. Mover
 * un tag es justo ese caso, y mirar el tag local consultaba el commit viejo.
 * Un borrado (`:v1.2.3`, `--delete`) y un simulacro (`--dry-run`) no publican nada.
 */
export function tagsEmpujados(partes) {
  const [sub, ...resto] = partes ?? []
  const nada = { tags: [], todos: false }
  if (sub !== 'push') return nada
  // Un `#` suelto abre un comentario: lo que sigue no son argumentos.
  const corte = resto.findIndex((a) => a.startsWith('#'))
  const args = corte < 0 ? resto : resto.slice(0, corte)
  if (args.some((a) => a === '--delete' || a === '-d' || esSimulacro(a))) return nada
  const tags = []
  let todos = args.some((a) => EMPUJA_TODOS.some((es) => es(a)))
  for (const arg of args) {
    if (arg.startsWith('-')) continue
    if (arg.includes('*') && /refs\/tags|^\+?v/u.test(arg)) {
      todos = true
      continue
    }
    const [origen, destino] = arg.replace(/^\+/u, '').split(':')
    if (!origen) continue
    const nombre = (destino ?? origen).replace(/^refs\/tags\//u, '')
    if (!TAG_DE_RELEASE.test(nombre) || tags.some((t) => t.tag === nombre)) continue
    tags.push({ tag: nombre, origen: destino === undefined ? `refs/tags/${nombre}` : origen })
  }
  return { tags, todos }
}

/** Resume las corridas de Quality de un commit en un solo estado. */
export function estadoDeQuality(corridas) {
  if (!Array.isArray(corridas) || corridas.length === 0) return 'sin-corrida'
  if (corridas.some((c) => c.conclusion === 'success')) return 'verde'
  if (corridas.some((c) => c.status && c.status !== 'completed')) return 'en-curso'
  // Un push en ráfaga a main cancela la corrida anterior: eso no es un rojo.
  if (corridas.some((c) => c.conclusion === 'failure' || c.conclusion === 'timed_out')) return 'rojo'
  return 'cancelada'
}

export const sondasDeTagReales = {
  /** El commit al que apunta una referencia en este checkout, o null si no resuelve. */
  commitDe(ref, cwd) {
    try {
      return execFileSync('git', ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], { cwd, encoding: 'utf8', timeout: 2000 }).trim() || null
    } catch {
      return null
    }
  },
  /** Una rama puede llamarse `v2.0.0-migracion`: empujarla no publica nada. */
  esRama(nombre, cwd) {
    try {
      execFileSync('git', ['show-ref', '--verify', '--quiet', `refs/heads/${nombre}`], { cwd, timeout: 2000 })
      return true
    } catch {
      return false
    }
  },
  /** 'verde' | 'en-curso' | 'rojo' | 'cancelada' | 'sin-corrida' | 'desconocido'. */
  quality(sha, cwd, topeMs = TOPE_POR_CONSULTA_MS) {
    try {
      const salida = execFileSync('gh', ['run', 'list', '--workflow', 'quality.yml', '--commit', sha, '--limit', '20', '--json', 'status,conclusion'], { cwd, encoding: 'utf8', timeout: topeMs, stdio: ['ignore', 'pipe', 'ignore'] })
      return estadoDeQuality(JSON.parse(salida))
    } catch {
      return 'desconocido'
    }
  },
}

const ask = (motivo) => ({ decision: 'ask', motivo })
const deny = (motivo) => ({ decision: 'deny', motivo })

/** Devuelve { decision, motivo } o null. `partes` es [sub, ...args] de un comando git. */
export function revisarPushDeTag(partes, cwd, sondas = sondasDeTagReales, ahora = Date.now) {
  const { tags, todos } = tagsEmpujados(partes)
  if (todos) {
    return ask('Este push empuja todos los tags, incluidos los de release, y cada tag `vX.Y.Z` dispara una corrida de Release. Nombra el tag que quieres publicar; así se puede comprobar que su commit tiene Quality en verde.')
  }
  const limite = ahora() + PRESUPUESTO_MS
  for (const { tag, origen } of tags) {
    const sha = sondas.commitDe(origen, cwd)
    if (!sha) {
      if (origen === `refs/tags/${tag}` && sondas.esRama(tag, cwd)) continue
      return ask(`No se pudo resolver en este checkout el commit que se empuja como ${tag}, así que no se sabe si tiene Quality en verde. Empujarlo dispara una corrida de Release: requiere el sí del usuario.`)
    }
    const corto = sha.slice(0, 9)
    const restante = limite - ahora()
    const estado = restante < 1000 ? 'desconocido' : sondas.quality(sha, cwd, Math.min(TOPE_POR_CONSULTA_MS, restante))
    if (estado === 'verde') continue
    if (estado === 'en-curso') {
      return deny(`Quality todavía está corriendo sobre ${corto} (tag ${tag}). Espera a que termine en verde y empuja el tag después: Release reutiliza ese gate y tarda unos 20 minutos en vez de 50 o más. Si termina en rojo, el arreglo va a main sin mover el tag.`)
    }
    if (estado === 'rojo') {
      return deny(`Quality está en rojo sobre ${corto} (tag ${tag}). Una corrida de Release sobre ese commit fallaría por lo mismo. Arregla en main, espera el verde y pon el tag sobre ese commit.`)
    }
    if (estado === 'cancelada') {
      return ask(`La corrida de Quality de ${corto} (tag ${tag}) se canceló antes de terminar, así que ese commit no tiene un verde propio y Release correría el gate completo. Requiere el sí del usuario.`)
    }
    if (estado === 'sin-corrida') {
      return ask(`El commit ${corto} (tag ${tag}) no tiene ninguna corrida de Quality: o no está en GitHub, o el corte se apoya en el reuso por ancestro del ADR 0059. Sin un verde propio, Release corre el gate completo. Requiere el sí del usuario.`)
    }
    return ask(`No se pudo consultar en GitHub el estado de Quality de ${corto} (tag ${tag}). Empujar el tag dispara una corrida de Release: requiere el sí del usuario.`)
  }
  return null
}

const NOMBRA_UN_TAG = /(?:^|[^a-z])tags?(?:[^a-z]|$)|version|describe|\$\{?V\b|v\d+\.\d+\.\d+/iu

/**
 * Lo que la guarda no puede leer y aun así puede publicar un tag. Recibe el
 * comando con las comillas de un solo token ya quitadas.
 * - Un `git push` cuyo destino sale de una variable o de una sustitución, en un
 *   comando que habla de tags o de versiones.
 * - `gh release create`, que crea el tag en el remoto sin pasar por git.
 */
export function revisarPublicacionOpaca(comando) {
  for (const tramo of comando.split(/&&|\|\||[;\n|]/u)) {
    if (/(?:^|\s)gh\s+release\s+create\b/u.test(tramo)) {
      return ask('`gh release create` crea el tag en GitHub y dispara una corrida de Release sin pasar por la comprobación de Quality. En este repositorio el release lo publica el workflow a partir del tag. Requiere el sí del usuario.')
    }
    const push = tramo.match(/(?:^|[\s(])git\s+(?:-\S+\s+(?:\S+\s+)?)*push\b(.*)$/u)
    if (push && /[$`]/u.test(push[1]) && NOMBRA_UN_TAG.test(comando) && !/\s(?:-n|--dry-run|--delete|-d)(?:\s|$)/u.test(push[1])) {
      return ask('Este `git push` toma lo que empuja de una variable o de una sustitución, y el comando habla de tags o de versiones: no se puede comprobar si publica un tag de release ni sobre qué commit. Escribe el tag literal, o confirma con el usuario.')
    }
  }
  return null
}
