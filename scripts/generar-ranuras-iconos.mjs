#!/usr/bin/env node
// Copia las ranuras de `ppt.tipos_lamina` del estándar (api/inst/estandar/estandar_pulso.json) a
// frontend/src/features/graficos/iconos/ranurasEstandar.generated.ts. Los íconos de lámina se dibujan desde ese
// archivo (F6.1b): si el estándar mueve una ranura, el ícono se mueve con él. El contrato
// iconos/iconosTipo.contract.test.ts falla si el generado se desvía del estándar.
//
// Uso: node scripts/generar-ranuras-iconos.mjs           (escribe)
//      node scripts/generar-ranuras-iconos.mjs --check   (sale con 1 si el generado no está al día)
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const FUENTE = "api/inst/estandar/estandar_pulso.json";
const DESTINO = "frontend/src/features/graficos/iconos/ranurasEstandar.generated.ts";

export function generarRanuras(estandar) {
  const tipos = estandar?.ppt?.tipos_lamina;
  if (!Array.isArray(tipos) || tipos.length === 0) {
    throw new Error(`${FUENTE}: ppt.tipos_lamina vacío o ausente`);
  }
  const lineas = tipos.map((t) => {
    const ranuras = t.ranuras
      .map((r) => `{ tipo: ${JSON.stringify(r.tipo)}, x: ${r.x}, y: ${r.y}, w: ${r.w}, h: ${r.h} }`)
      .join(",\n      ");
    return `  ${JSON.stringify(t.id)}: {\n    nombre: ${JSON.stringify(t.nombre)},\n    ranuras: [\n      ${ranuras},\n    ],\n  },`;
  });
  return [
    `// GENERADO por scripts/generar-ranuras-iconos.mjs desde ${FUENTE}. No editar a mano.`,
    "// Ranuras en pulgadas de la lámina 13,333 × 7,5, tal cual las declara el estándar.",
    "",
    'export type TipoRanuraEstandar = "grafico" | "texto" | "cifras";',
    "",
    "export type RanuraEstandar = { tipo: TipoRanuraEstandar; x: number; y: number; w: number; h: number };",
    "",
    "export const RANURAS_ESTANDAR: Readonly<Record<string, { nombre: string; ranuras: readonly RanuraEstandar[] }>> = {",
    ...lineas,
    "};",
    "",
  ].join("\n");
}

const esPrincipal = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (esPrincipal) {
  const estandar = JSON.parse(readFileSync(join(RAIZ, FUENTE), "utf8"));
  const texto = generarRanuras(estandar);
  const destino = join(RAIZ, DESTINO);
  if (process.argv.includes("--check")) {
    let actual = "";
    try { actual = readFileSync(destino, "utf8"); } catch { actual = ""; }
    if (actual !== texto) {
      console.error(`${DESTINO} no está al día con ${FUENTE}: corre node scripts/generar-ranuras-iconos.mjs`);
      process.exit(1);
    }
    console.log(`${DESTINO} al día (${estandar.ppt.tipos_lamina.length} tipos de lámina)`);
  } else {
    writeFileSync(destino, texto);
    console.log(`${DESTINO} escrito (${estandar.ppt.tipos_lamina.length} tipos de lámina)`);
  }
}
