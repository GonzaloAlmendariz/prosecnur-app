#!/usr/bin/env node
// ¿El build que sirve el backend es POSTERIOR al último cambio del frontend?
//
// **Por qué existe.** Mirar la app sin saber qué build sirve es mirar el
// pasado. Medido el 2026-09-12: el bundle era de las 04:07 y el arreglo de
// «Cursos-horario planificados» de las 04:19, así que la pantalla seguía
// enseñando el defecto y estuve a punto de reportarlo como vivo — el código
// llevaba doce minutos arreglado.
//
// Es primo de dos trampas ya conocidas del repo: el warm start que recicla un
// worktree viejo, y los dos backends sobre el mismo .pulso. La respuesta es la
// misma: antes de creerle a la pantalla, saber de cuándo es lo que enseña.
//
//   node scripts/build-al-dia.mjs

import { execSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import path from "node:path";

const raiz = new URL("..", import.meta.url).pathname;
const dirAssets = path.join(raiz, "api/inst/www/assets");

let ultimoBuild = 0;
try {
  for (const f of readdirSync(dirAssets)) {
    const m = statSync(path.join(dirAssets, f)).mtimeMs;
    if (m > ultimoBuild) ultimoBuild = m;
  }
} catch {
  console.log("No hay build en api/inst/www/assets: `make build` primero.");
  process.exit(1);
}

const iso = execSync(
  'git log -1 --format=%cI -- frontend/src frontend/package.json',
  { cwd: raiz },
).toString().trim();
const ultimoCambio = new Date(iso).getTime();

const hora = (ms) => new Date(ms).toLocaleTimeString("es-PE", { hour12: false });
const alDia = ultimoBuild >= ultimoCambio;

console.log(`build:  ${hora(ultimoBuild)}`);
console.log(`código: ${hora(ultimoCambio)}  (último commit de frontend/src)`);
console.log(
  alDia
    ? "\nAl día: lo que enseña la app es el código de ahora."
    : "\nDESFASADO: la app sirve un build ANTERIOR al último cambio.\n" +
      "Lo que veas en pantalla NO es el código de ahora. `make build` y recarga.",
);
process.exit(alDia ? 0 : 1);
