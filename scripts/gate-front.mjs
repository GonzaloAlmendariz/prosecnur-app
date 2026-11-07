#!/usr/bin/env node
// El gate de un ÁREA del frontend: sus suites MÁS los contratos transversales.
//
// **Por qué existe.** La clase 6 del loop de robustez —un gate que no se
// corre— tenía su respuesta en R (`make gate-area`) y ninguna aquí. En el
// frontend pasa lo mismo: quien toca un componente corre las suites de su
// carpeta, y los contratos que escanean TODO el árbol —tokens huérfanos,
// estado que nadie pinta, guards que dejaron de guardar, CSS concatenable— se
// rompen desde otro archivo y no los corre nadie hasta el CI.
//
//   node scripts/gate-front.mjs monitoreo/profiles/aulas
//   node scripts/gate-front.mjs calcMuestra
//
// Sin argumento corre sólo los transversales. Devuelve código 1 si algo falla.

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

// Los que se corren SIEMPRE. Cada uno cae por un cambio hecho en otro sitio.
const TRANSVERSALES = [
  "src/app/tokensDefinidos.contract.test.ts",      // un var() que no resuelve
  "src/app/estadoQueNadieLee.contract.test.ts",    // un useState que nadie pinta
  "src/app/guardsQueGuardan.contract.test.ts",     // un guard que dejó de guardar
  "src/app/cssConcatenable.contract.test.ts",      // orden de cascada al concatenar
  "src/app/auditReadyRoutes.contract.test.ts",     // readiness de las rutas
  "src/app/readinessAnidada.contract.test.ts",     // un false terminal que cuelga el QA
  "src/app/chunksSinCiclos.contract.test.ts",      // dos chunks que se importan: TDZ sólo en el bundle
  "src/lib/modulesNavigation.test.ts",             // el registro y las rutas no divergen
  // Más contratos que escanean el árbol entero y ningún área corría (2026-11-01):
  // el rojo A02 de TabSemanticsAudit (9f80662fd) lo vio el Planner, no un gate.
  "src/app/TabSemanticsAudit.contract.test.ts",    // semántica de pestañas de todos los módulos
  "src/app/readinessQueSeDeclara.contract.test.ts", // una marca de readiness que no se declara
  "src/app/letraPorRol.contract.test.ts",          // font-size en px en los módulos sin dueño (L29)
  "src/app/pisoTipografico.contract.test.ts",      // letra bajo el piso de 10 px
  "src/app/movimiento.contract.test.ts",           // transiciones de layout y animaciones sin motivo
  "src/app/microinteracciones.contract.test.ts",   // presión con nombre (--mov-press), sin escalas sueltas
  "src/components/ModuleChrome.contract.test.ts",  // estados de navegación del chrome
  "src/components/toaster.contract.test.ts",       // avisos fuera del toaster
  "src/lib/teclado.contract.test.ts",              // atajos de teclado en conflicto
  // Ratchets del kit: escanean todo el árbol y CI los corre con `pnpm test`.
  // Fuera de aquí, un gate de área daba verde con una tabla a mano que el CI
  // sí rechazaba (revisión de la fase 3 del lienzo de Hojas de ruta, 2026-10-29).
  "src/components/tablasDelKit.contract.test.ts",  // una <table> a mano en vez de PulsoTable
  "src/components/inputsDelKit.contract.test.ts",  // una casilla o un input fuera del kit
  "src/components/dialogsDelKit.contract.test.ts", // un overlay que no es Dialog/Sideover
  "src/components/estadosDelKit.contract.test.ts", // un vacío o un error dibujado a mano
  "src/components/indicadorDelKit.contract.test.ts", // un segmentado que empata con el indicador del kit
  "src/components/puntoMedioDelKit.contract.test.ts", // un «·» que el kit, lib/ o app/ pintan en todos los módulos
  // En subcarpetas o con el helper `test/contractSourceScan`, y por eso fuera del barrido viejo de
  // gateFrontTransversales (2026-11-04): `lectoresDeDireccion` se rompió sin que un gate lo viera.
  "src/lib/navegacion/lectoresDeDireccion.contract.test.ts", // alguien nuevo lee la dirección a mano
  "src/lib/navegacion/panelesDeclarados.contract.test.ts",   // un panel montado que no se declara
  "src/lib/navegacion/aliasLegacyNoSeEscribe.contract.test.ts", // un alias viejo (tab, stage…) que se escribe
  "src/lib/navegacion/direccionesRenombradasNoSeEscriben.contract.test.ts", // una dirección renombrada que vuelve
  "src/components/GlidingTabList.contract.test.ts",           // un tablist fuera del GlidingTabList
  // La publicación monta sin Router: un hook de router en lo que alcanza lanza al montarse (7453e06dc).
  // Recorre el cierre de imports de PublicArtifactApp, así que se rompe desde cualquier componente que importe.
  "src/app/publicModeSinRouter.contract.test.tsx",
  // Descargas que Electron deniega (window.open), copiado sin copiarTexto y la clase `spin` que no existe:
  // se rompen desde cualquier feature (descargas unificadas, 2026-11-07).
  "src/lib/descargasContrato.contract.test.ts",
  // Un flujo que entrega su archivo por su cuenta (downloadUrl, diálogo de guardado) en vez del kit de entregables:
  // se rompe desde cualquier feature (ADR 0133, fase 4).
  "src/components/entregables/entregablesRatchet.contract.test.ts",
];

const area = process.argv[2] ?? "";
// El área es un feature (`monitoreo/profiles/aulas`) o, si no existe como tal,
// una carpeta de `src/` (`components`, `lib`): el kit compartido también tiene gate.
const FRONT = new URL("../frontend/", import.meta.url).pathname;
const rutaArea = existsSync(`${FRONT}src/features/${area}`) ? `src/features/${area}` : `src/${area}`;
const objetivos = area ? [rutaArea, ...TRANSVERSALES] : TRANSVERSALES;

console.log(
  `Gate del frontend${area ? ` · área «${area}»` : ""}: ` +
    `${objetivos.length} objetivos (${objetivos.length - TRANSVERSALES.length} del área + ` +
    `${TRANSVERSALES.length} transversales)\n`,
);

const r = spawnSync("pnpm", ["-C", "frontend", "exec", "vitest", "run", ...objetivos], {
  stdio: "inherit",
  cwd: new URL("..", import.meta.url).pathname,
});
process.exit(r.status ?? 1);
