import assert from 'node:assert/strict'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const script = path.join(REPO, 'scripts', 'vaults-check.mjs')

function escribir(raiz, relativo, contenido) {
  const archivo = path.join(raiz, relativo)
  mkdirSync(path.dirname(archivo), { recursive: true })
  writeFileSync(archivo, contenido, 'utf8')
  return archivo
}

function contratoFixture(cambiosPestana = {}) {
  return [
    {
      slug: 'alpha',
      title: 'Alpha',
      to: '/alpha',
      landingKind: 'document',
      modos: [
        {
          id: 'operacion',
          label: 'Operación',
          sections: [
            {
              id: 'captura',
              label: 'Captura',
              to: '/alpha?modo=operacion&seccion=captura',
              tabs: [
                {
                  id: 'detalle',
                  label: 'Detalle',
                  to: '/alpha?modo=operacion&seccion=captura&pestana=detalle',
                  direccionPublicada: true,
                  ...cambiosPestana,
                },
              ],
            },
          ],
        },
      ],
    },
    {
      slug: 'beta',
      title: 'Beta',
      to: '/beta',
      landingKind: 'document',
      sections: [],
    },
  ]
}

function crearRepoEfimero(t, contrato = contratoFixture()) {
  const raiz = mkdtempSync(path.join(os.tmpdir(), 'vaults-check-test-'))
  t.after(() => rmSync(raiz, { recursive: true, force: true }))

  mkdirSync(path.join(raiz, 'scripts'), { recursive: true })
  copyFileSync(script, path.join(raiz, 'scripts', 'vaults-check.mjs'))
  escribir(
    raiz,
    'frontend/node_modules/vite/package.json',
    JSON.stringify({ type: 'module' }),
  )
  escribir(
    raiz,
    'frontend/node_modules/vite/dist/node/index.js',
    [
      `const contrato = ${JSON.stringify(contrato)}`,
      'export async function createServer() {',
      '  return {',
      '    async ssrLoadModule() { return { PROSECNUR_MODULES: contrato } },',
      '    async close() {},',
      '  }',
      '}',
      '',
    ].join('\n'),
  )
  escribir(
    raiz,
    'agentic/manifest.json',
    JSON.stringify({
      skills: [],
      agents: [],
      routes: {},
      documentation: {
        skill_navigation_roots: {},
        agent_navigation_roots: {},
        agentic_index_dir: 'docs/sistema/agentic',
      },
    }),
  )
  return raiz
}

function ejecutarVaults(raiz, argumentos) {
  const resultado = spawnSync(
    process.execPath,
    [path.join(raiz, 'scripts', 'vaults-check.mjs'), ...argumentos],
    {
      cwd: raiz,
      encoding: 'utf8',
      maxBuffer: 2 * 1024 * 1024,
      timeout: 10_000,
    },
  )
  assert.equal(resultado.signal, null, `vaults-check terminó por señal ${resultado.signal}`)
  assert.equal(resultado.error, undefined)
  return resultado
}

function ejecutarJson(raiz) {
  const resultado = ejecutarVaults(raiz, ['--json'])
  assert.equal(resultado.status, 0, resultado.stderr)
  assert.equal(resultado.stderr, '')
  return JSON.parse(resultado.stdout)
}

function escribirNotaEstructural(raiz, rutaApp) {
  const relativo = 'Obsidian_Prosecnur/Prosecnur/nota.md'
  escribir(
    raiz,
    relativo,
    [
      '---',
      'tipo: pestana',
      'tags:',
      '  - pestana',
      'nodo: alpha/operacion/captura/detalle',
      `ruta_app: ${JSON.stringify(rutaApp)}`,
      'documentacion: borrador',
      '---',
      '',
      '# Nota de detalle',
      '',
    ].join('\n'),
  )
  return relativo
}

const run = spawnSync(process.execPath, [script, '--json', '--check'], {
  cwd: REPO,
  encoding: 'utf8',
  timeout: 60_000,
})

let report = null
try {
  report = JSON.parse(run.stdout)
} catch {
  // El primer test conserva stdout/stderr completos en el mensaje de fallo.
}

test('vaults-check es silencioso, serializable y bloqueante', () => {
  assert.equal(run.signal, null, `vaults-check terminó por señal ${run.signal}`)
  assert.equal(run.error, undefined)
  assert.equal(run.stderr, '', `vaults-check escribió en stderr:\n${run.stderr}`)
  assert.ok(report, `salida no JSON:\n${run.stdout}`)

  const bloqueantes = report.hallazgos
    .filter((hallazgo) => hallazgo.gravedad === 'bloqueante')
    .slice(0, 12)
    .map((hallazgo) => `${hallazgo.codigo} ${hallazgo.sujeto}: ${hallazgo.detalle}`)
    .join('\n')
  assert.equal(run.status, 0, bloqueantes)
  assert.equal(report.hallazgos.some((hallazgo) => hallazgo.gravedad === 'bloqueante'), false)
})

test('la convergencia tiene cobertura real y no verde por ausencia', () => {
  assert.ok(report.resumen.nodosContrato > 0)
  assert.ok(report.resumen.notasProducto > 0)
  assert.equal(Object.keys(report.contrato).length, report.resumen.nodosContrato)
  assert.equal(Object.keys(report.coberturaPorClave).length, report.resumen.nodosContrato)
  assert.equal(report.resumen.anclasBoceto, 1)
  assert.equal(report.resumen.anclasPromovidas, 1)
  assert.equal(report.resumen.entradasAgentic, 29)
  assert.equal(report.resumen.ramasAgentic, 8)

  const codigosCerrados = new Set(['V1b', 'V3', 'V4', 'V5', 'V8', 'V9', 'V10', 'C3', 'G1'])
  assert.deepEqual(
    report.hallazgos.filter((hallazgo) => codigosCerrados.has(hallazgo.codigo)),
    [],
  )

  const noPublicadas = Object.entries(report.contrato)
    .filter(([, nodo]) => nodo.direccionPublicada === false)
    .map(([clave]) => clave)
    .sort()
  assert.deepEqual(noPublicadas, [
    'dashboard/dashboard/base_datos',
    'dashboard/dashboard/dimensiones',
    'dashboard/dashboard/relaciones',
    'dashboard/dashboard/resumen',
    'procesamiento/validacion/explorar',
    'procesamiento/validacion/instrumento',
    'procesamiento/validacion/limpieza',
    'procesamiento/validacion/reglas_custom',
  ])
})

test('el índice de direcciones es íntegramente generado', () => {
  const dir = path.join(REPO, 'docs', 'sistema', 'direcciones')
  const archivos = readdirSync(dir).filter((nombre) => nombre.endsWith('.md')).sort()
  assert.deepEqual(archivos, [
    'README.md',
    'calc-muestra.md',
    'dashboard.md',
    'diseno-estudio.md',
    'editor-xlsform.md',
    'hojas-ruta.md',
    'monitoreo.md',
    'procesamiento.md',
    'recopiladores.md',
  ])
  for (const archivo of archivos) {
    assert.match(
      readFileSync(path.join(dir, archivo), 'utf8'),
      /^<!-- GENERATED BY scripts\/vaults-check\.mjs; DO NOT EDIT -->/,
      archivo,
    )
  }
})

test('nodo válido exige ruta_app propia o de un ancestro publicado', (t) => {
  const casos = [
    { nombre: 'vacía', ruta: '', codigos: ['V1'] },
    { nombre: 'desconocida', ruta: '/fantasma', codigos: ['V1'] },
    { nombre: 'otra rama', ruta: '/beta', codigos: ['V1'] },
    {
      nombre: 'propia',
      ruta: '/alpha?modo=operacion&seccion=captura&pestana=detalle',
      codigos: [],
    },
    { nombre: 'ancestro sección', ruta: '/alpha?modo=operacion&seccion=captura', codigos: [] },
    { nombre: 'ancestro modo', ruta: '/alpha?modo=operacion', codigos: [] },
    { nombre: 'ancestro módulo', ruta: '/alpha', codigos: [] },
  ]

  const observados = casos.map(({ nombre, ruta }) => {
    const raiz = crearRepoEfimero(t)
    const relativo = escribirNotaEstructural(raiz, ruta)
    const informe = ejecutarJson(raiz)
    const codigos = informe.hallazgos
      .filter((hallazgo) => hallazgo.sujeto === relativo && hallazgo.gravedad === 'bloqueante')
      .map((hallazgo) => hallazgo.codigo)
      .sort()
    return { nombre, codigos }
  })

  assert.deepEqual(
    observados,
    casos.map(({ nombre, codigos }) => ({ nombre, codigos })),
  )
})

test('el sello de cada ancestro incorpora label, to y publicación del descendiente', (t) => {
  const raizBase = crearRepoEfimero(t)
  const base = ejecutarJson(raizBase).contrato
  const ancestros = ['alpha', 'alpha/operacion', 'alpha/operacion/captura']
  const descendiente = 'alpha/operacion/captura/detalle'
  const variantes = [
    { campo: 'label', cambios: { label: 'Detalle renombrado' } },
    { campo: 'to', cambios: { to: '/alpha?modo=operacion&seccion=captura&pestana=otro' } },
    { campo: 'direccionPublicada', cambios: { direccionPublicada: false } },
  ]

  const observados = variantes.map(({ campo, cambios }) => {
    const raiz = crearRepoEfimero(t, contratoFixture(cambios))
    const mutado = ejecutarJson(raiz).contrato
    return {
      campo,
      descendienteCambio: mutado[descendiente].sello !== base[descendiente].sello,
      ancestrosSinCambio: ancestros.filter(
        (clave) => mutado[clave].sello === base[clave].sello,
      ),
    }
  })

  assert.deepEqual(
    observados,
    variantes.map(({ campo }) => ({ campo, descendienteCambio: true, ancestrosSinCambio: [] })),
  )
})

test('solo el sentinel exacto al inicio autoriza sobrescribir o podar un índice', (t) => {
  const fraseHeredada = 'Documento generado por `scripts/vaults-check.mjs --generar`. No editar a mano'
  const sentinel = '<!-- GENERATED BY scripts/vaults-check.mjs; DO NOT EDIT -->\n'

  const raizSobrescritura = crearRepoEfimero(t)
  const manualEsperado = `# Manual\n\nCita heredada: ${fraseHeredada}.\n`
  const archivoEsperado = escribir(
    raizSobrescritura,
    'docs/sistema/direcciones/alpha.md',
    manualEsperado,
  )
  const sobrescritura = ejecutarVaults(raizSobrescritura, ['--generar'])

  const raizPoda = crearRepoEfimero(t)
  const manualExtra = `# Manual extra\n\nCita heredada: ${fraseHeredada}.\n`
  const archivoExtra = escribir(
    raizPoda,
    'docs/sistema/direcciones/manual-extra.md',
    manualExtra,
  )
  const poda = ejecutarVaults(raizPoda, ['--generar'])

  const raizGenerada = crearRepoEfimero(t)
  const generadoEsperado = escribir(
    raizGenerada,
    'docs/sistema/direcciones/alpha.md',
    `${sentinel}contenido obsoleto\n`,
  )
  const generadoExtra = escribir(
    raizGenerada,
    'docs/sistema/direcciones/obsoleto.md',
    `${sentinel}contenido obsoleto\n`,
  )
  const generacion = ejecutarVaults(raizGenerada, ['--generar'])

  assert.deepEqual(
    {
      colisionSobrescritura: {
        fallo: sobrescritura.status !== 0,
        preservado: readFileSync(archivoEsperado, 'utf8') === manualEsperado,
        mensaje: /colisiona con un archivo manual; se preservó/.test(sobrescritura.stderr),
      },
      colisionPoda: {
        fallo: poda.status !== 0,
        preservado: existsSync(archivoExtra) && readFileSync(archivoExtra, 'utf8') === manualExtra,
        mensaje: /es manual; no se puede podar/.test(poda.stderr),
      },
      sentinelExacto: {
        exito: generacion.status === 0,
        sobrescrito: readFileSync(generadoEsperado, 'utf8') !== `${sentinel}contenido obsoleto\n`,
        podado: !existsSync(generadoExtra),
      },
    },
    {
      colisionSobrescritura: { fallo: true, preservado: true, mensaje: true },
      colisionPoda: { fallo: true, preservado: true, mensaje: true },
      sentinelExacto: { exito: true, sobrescrito: true, podado: true },
    },
  )
})
