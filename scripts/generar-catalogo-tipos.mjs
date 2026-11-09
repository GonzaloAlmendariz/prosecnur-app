#!/usr/bin/env node
// Copia el catálogo de tipos (api/inst/catalogos/graficos_tipos.json, a su vez generado de api/R/graficos_metadata.R)
// a frontend/src/features/graficos/iconos/catalogoTipos.generated.ts (ADR 0139, decisión 4: una sola fuente). De ahí
// salen los nombres legibles de cada tipo de gráfico, las familias del selector, las ranuras de cada tipo de lámina y las
// variantes del catálogo de gráficos. El contrato iconos/generados.contract.test.ts falla si el generado se desvía.
//
// Uso: node scripts/generar-catalogo-tipos.mjs           (escribe)
//      node scripts/generar-catalogo-tipos.mjs --check   (sale con 1 si el generado no está al día)
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const FUENTE = "api/inst/catalogos/graficos_tipos.json";
const DESTINO = "frontend/src/features/graficos/iconos/catalogoTipos.generated.ts";

const j = (v) => JSON.stringify(v);

function lamina(s) {
  const ranuras = s.ranuras.length
    ? `[\n${s.ranuras.map((r) => `      { name: ${j(r.name)}, role: ${j(r.role)}, label: ${j(r.label)} },`).join("\n")}\n    ]`
    : "[]";
  return `  { name: ${j(s.name)}, titulo_humano: ${j(s.titulo_humano)}, categoria: ${j(s.categoria)}, estandar: ${j(s.estandar)}, en_selector: ${j(s.en_selector)},\n    ranuras: ${ranuras} },`;
}

function grafico(g) {
  const u = g.usa;
  return `  { name: ${j(g.name)}, titulo_humano: ${j(g.titulo_humano)}, familia_editor: ${j(g.familia_editor)}, salida: ${j(g.salida)}, en_selector: ${j(g.en_selector)},\n`
    + `    usa: { pregunta: ${j(u.pregunta)}, publicos: ${j(u.publicos)}, padron: ${j(u.padron)}, cruce: ${j(u.cruce)} } },`;
}

function variante(v) {
  const fijos = Object.entries(v.args_fijos).map(([k, x]) => `${j(k)}: ${j(x)}`).join(", ");
  return `  { id: ${j(v.id)}, graficador: ${j(v.graficador)}, nombre: ${j(v.nombre)}, familia: ${j(v.familia)}, icono: ${j(v.icono)},\n`
    + `    descripcion: ${j(v.descripcion)},\n`
    + `    args_fijos: { ${fijos} }, args_quitar: ${j(v.args_quitar)} },`;
}

export function generarCatalogo(c) {
  for (const k of ["slides", "graficadores", "familias_editor", "variantes"]) {
    if (!Array.isArray(c?.[k]) || c[k].length === 0) throw new Error(`${FUENTE}: \`${k}\` vacío o ausente`);
  }
  return [
    `// GENERADO por scripts/generar-catalogo-tipos.mjs desde ${FUENTE} (a su vez generado de api/R/graficos_metadata.R).`,
    "// No editar a mano: generados.contract.test.ts falla si se desvía del JSON y muestra el valor esperado.",
    "",
    'export type SalidaGrafico = "nativa" | "marco" | "ruta_anterior";',
    "",
    "/** Una ranura de un tipo de lámina: `chart` recibe un tipo de gráfico; `icon`, un ícono subido. */",
    'export type RanuraCatalogo = { name: string; role: "chart" | "icon"; label: string };',
    "",
    "export type TipoLaminaCatalogo = {",
    "  name: string; titulo_humano: string; categoria: string; estandar: string | null; en_selector: boolean;",
    "  ranuras: readonly RanuraCatalogo[];",
    "};",
    "/** Qué datos usa un tipo de gráfico (api/R/graficos_tipos_usa.R): los tipos de pregunta que acepta (el principal",
    " *  primero), cuántos públicos, si pide padrón y si abre por los grupos de otra variable. «cualquiera» = no pide un tipo",
    " *  de pregunta, y va solo en el arreglo. */",
    'export type PreguntaQueUsa = "escala" | "opcion_unica" | "multiple" | "numerica" | "abierta" | "cualquiera";',
    'export type PublicosQueUsa = "uno" | "varios" | "uno_o_varios";',
    "export type UsaGrafico = { pregunta: PreguntaQueUsa[]; publicos: PublicosQueUsa; padron: boolean; cruce: boolean };",
    "",
    "export type TipoGraficoCatalogo = {",
    "  name: string; titulo_humano: string; familia_editor: string; salida: SalidaGrafico; en_selector: boolean; usa: UsaGrafico;",
    "};",
    "",
    "export type FamiliaEditorCatalogo = { id: string; label: string };",
    "",
    "/** Variante del catálogo de gráficos (ADR 0139): un graficador con args fijos. Un `null` en `args_fijos` deja el",
    " *  argumento nulo; `args_quitar` son los argumentos que se borran al aplicarla. */",
    "export type VarianteGraficoCatalogo = {",
    "  id: string; graficador: string; nombre: string; familia: string; icono: string; descripcion: string;",
    "  args_fijos: Readonly<Record<string, unknown>>; args_quitar: readonly string[];",
    "};",
    "",
    "export const CATALOGO_LAMINAS: readonly TipoLaminaCatalogo[] = [",
    ...c.slides.map(lamina),
    "];",
    "",
    "export const CATALOGO_GRAFICOS: readonly TipoGraficoCatalogo[] = [",
    ...c.graficadores.map(grafico),
    "];",
    "",
    "export const FAMILIAS_EDITOR: readonly FamiliaEditorCatalogo[] = [",
    ...c.familias_editor.map((f) => `  { id: ${j(f.id)}, label: ${j(f.label)} },`),
    "];",
    "",
    "export const VARIANTES_GRAFICO: readonly VarianteGraficoCatalogo[] = [",
    ...c.variantes.map(variante),
    "];",
    "",
  ].join("\n");
}

const esPrincipal = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (esPrincipal) {
  const catalogo = JSON.parse(readFileSync(join(RAIZ, FUENTE), "utf8"));
  const texto = generarCatalogo(catalogo);
  const destino = join(RAIZ, DESTINO);
  const resumen = `${catalogo.slides.length} láminas, ${catalogo.graficadores.length} gráficos, ${catalogo.variantes.length} variantes`;
  if (process.argv.includes("--check")) {
    let actual = "";
    try { actual = readFileSync(destino, "utf8"); } catch { actual = ""; }
    if (actual !== texto) {
      console.error(`${DESTINO} no está al día con ${FUENTE}: corre node scripts/generar-catalogo-tipos.mjs`);
      process.exit(1);
    }
    console.log(`${DESTINO} al día (${resumen})`);
  } else {
    writeFileSync(destino, texto);
    console.log(`${DESTINO} escrito (${resumen})`);
  }
}
