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
  "src/lib/modulesNavigation.test.ts",             // el registro y las rutas no divergen
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
