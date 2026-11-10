#!/usr/bin/env node
// Pre-flight rápido: lo que en el CI da rojo antes del primer minuto y en
// local tarda segundos (docs/qa/diagnostico-ciclo-release-2026-11-10.md).
//
// 12 de los 43 runs fallidos medidos cayeron por la gobernanza documental o por
// un contrato de scripts. Los dos gates estaban descritos en los skills, pero
// como una lista en prosa mezclada con la suite de R, que tarda cerca de una
// hora: se omitía entera. Este comando corre solo la parte barata.
//
// Uso:
//   node scripts/preflight-rapido.mjs           todos los pasos
//   node scripts/preflight-rapido.mjs --lista   imprime los pasos y sale
//
// Corre TODOS los pasos aunque uno falle: el objetivo es ver todos los rojos de
// una vez, no el primero. Sale con 1 si alguno falló.
//
// No reemplaza al gate completo (typecheck, vitest, build, suite de R, contratos
// de UI con Chromium): es lo que se corre antes de cada push.
//
// `ci` es el texto literal del `run:` de quality.yml que el paso espeja.
// scripts/tests/preflightRapido.test.mjs falla si quality.yml gana un paso en el
// job agentic-os o en el job frontend que no esté aquí ni en la lista de
// excluidos con motivo, o si un `ci` deja de existir en el workflow.

import { spawnSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** La misma exclusión que el job `frontend`: esos contratos exigen R o Chromium. */
export const EXCLUIDOS_DE_SCRIPTS = /check-r-lock|ui-quick-check-|visual-qa-readiness/u

const pruebas = (dir, excluir) =>
  readdirSync(path.join(RAIZ, dir))
    .filter((n) => n.endsWith('.test.mjs') && !(excluir && excluir.test(n)))
    .sort()
    .map((n) => `${dir}/${n}`)

export const PASOS = [
  {
    nombre: 'Agentic OS, tests del sincronizador',
    ci: 'node --test agentic/tests/*.test.mjs',
    args: () => ['--test', ...pruebas('agentic/tests')],
  },
  {
    nombre: 'Agentic OS, adaptadores generados',
    ci: 'node agentic/sync-agentic-os.mjs --check --platform=none',
    args: () => ['agentic/sync-agentic-os.mjs', '--check', '--platform=none'],
  },
  {
    nombre: 'Agentic OS, auditoría de gobierno',
    ci: 'node agentic/sync-agentic-os.mjs --audit --platform=none',
    args: () => ['agentic/sync-agentic-os.mjs', '--audit', '--platform=none'],
  },
  {
    nombre: 'Lock de R',
    ci: 'node scripts/check-r-lock.mjs',
    args: () => ['scripts/check-r-lock.mjs'],
  },
  {
    nombre: 'Gobernanza documental',
    ci: 'node scripts/check-docs-governance.mjs',
    args: () => ['scripts/check-docs-governance.mjs'],
  },
  {
    nombre: 'Contrato de release (preview)',
    ci: 'node scripts/release-contract.mjs preview',
    args: () => ['scripts/release-contract.mjs', 'preview'],
  },
  {
    nombre: 'Tests del ciclo de vida de desktop',
    ci: 'pnpm -C desktop test',
    comando: 'pnpm',
    args: () => ['-C', 'desktop', 'test'],
  },
  {
    nombre: 'Contratos de scripts',
    ci: "node --test $(ls scripts/tests/*.test.mjs | grep -vE 'check-r-lock|ui-quick-check-|visual-qa-readiness')",
    args: () => ['--test', ...pruebas('scripts/tests', EXCLUIDOS_DE_SCRIPTS)],
  },
  {
    nombre: 'Baseline de deuda técnica',
    ci: 'node scripts/debt-audit.mjs --check',
    args: () => ['scripts/debt-audit.mjs', '--check'],
  },
]

/**
 * Pasos de los jobs espejados que el pre-flight NO corre, con su motivo. Un
 * `run:` nuevo en agentic-os o en frontend tiene que caer en PASOS o aquí: el
 * contrato falla si no está en ninguna de las dos listas.
 */
export const FUERA_DEL_PREFLIGHT = {
  'pnpm -C frontend install --frozen-lockfile': 'instala dependencias; tarda y toca node_modules',
  'pnpm -C desktop install --frozen-lockfile': 'instala dependencias; tarda y toca node_modules',
  'pnpm -C frontend exec tsc --noEmit --pretty false': 'typecheck: minutos, no segundos',
  'pnpm -C frontend test': 'vitest completo: minutos, no segundos',
  'pnpm -C frontend exec vite build --outDir /tmp/prosecnur-vite-build --emptyOutDir': 'build de producción: minutos y mucha memoria',
  'pnpm -C frontend audit --audit-level=high': 'depende del servicio de advisories; va en el gate completo',
  'pnpm -C desktop audit --audit-level=high': 'depende del servicio de advisories; va en el gate completo',
}

const LINEAS_DE_UN_ROJO = 40

function correr(paso) {
  const inicio = Date.now()
  const r = spawnSync(paso.comando ?? process.execPath, paso.args(), { cwd: RAIZ, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  return {
    paso,
    ok: r.status === 0,
    estado: r.status,
    segundos: (Date.now() - inicio) / 1000,
    salida: `${r.stdout ?? ''}${r.stderr ?? ''}${r.error ? `\n${r.error.message}` : ''}`,
  }
}

function main() {
  if (process.argv.includes('--lista')) {
    for (const p of PASOS) console.log(`${p.nombre}: ${p.ci}`)
    return
  }
  const resultados = PASOS.map((paso) => {
    const r = correr(paso)
    console.log(`${r.ok ? 'OK   ' : 'ROJO '} ${r.segundos.toFixed(1).padStart(6)} s  ${paso.nombre}`)
    return r
  })
  const rojos = resultados.filter((r) => !r.ok)
  for (const r of rojos) {
    const lineas = r.salida.trimEnd().split('\n')
    console.log(`\n== ${r.paso.nombre} (sale con ${r.estado}) ==`)
    console.log(`   ${r.paso.ci}`)
    if (lineas.length > LINEAS_DE_UN_ROJO) console.log(`   (últimas ${LINEAS_DE_UN_ROJO} de ${lineas.length} líneas; corre el comando para verlas todas)`)
    console.log(lineas.slice(-LINEAS_DE_UN_ROJO).join('\n'))
  }
  const total = resultados.reduce((s, r) => s + r.segundos, 0)
  console.log(`\n${rojos.length ? `${rojos.length} de ${PASOS.length} pasos en rojo` : `${PASOS.length} pasos en verde`}, ${total.toFixed(1)} s.`)
  if (rojos.length) process.exitCode = 1
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main()
