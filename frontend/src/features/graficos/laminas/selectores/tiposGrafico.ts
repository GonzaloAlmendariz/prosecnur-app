// Tipos de gráfico por familia (F6.2; dirección F6 §4.4 «¿Qué gráfico?»). La familia y la salida de cada graficador
// las declara el backend (`.GRAFICOS_SALIDA_EDITOR` en graficos_metadata.R) y llegan versionadas en el catálogo
// (iconos/catalogoTipos.generated.ts). El registro en vivo dice qué está disponible en esta sesión.

import type { GraficadorCategoria, GraficadorMetadata, GraficadorRef } from "../../../../api/graficos";
import { CATALOGO_GRAFICOS, FAMILIAS_EDITOR, VARIANTES_GRAFICO, type SalidaGrafico, type VarianteGraficoCatalogo } from "../../iconos/catalogoTipos.generated";
import { esSlotCifra } from "../../iconos/composicion";
import { TIPOS_RETIRADOS_0137 } from "../../retirados";
import { aplicarVariante, varianteDeGrafico } from "../../catalogoGraficos";

export type FamiliaGrafico = "categorias" | "escalas" | "numeros" | "comparar" | "territorio" | "texto";

/** Lo que cada familia agrupa, en una línea. El id y el nombre los declara el catálogo (`familias_editor`). */
const DESCRIPCION_FAMILIA: Readonly<Record<FamiliaGrafico, string>> = {
  categorias: "Cuántos eligieron cada opción de una pregunta.",
  escalas: "Preguntas de acuerdo, satisfacción o frecuencia.",
  numeros: "Promedios, distribuciones y cifras destacadas.",
  comparar: "Dos o más públicos o mediciones frente a frente.",
  territorio: "Resultados o cobertura sobre el mapa.",
  texto: "Respuestas abiertas.",
};

const esIdFamilia = (v: string): v is FamiliaGrafico => v in DESCRIPCION_FAMILIA;

/** Las familias del selector, en el orden y con el nombre de `familias_editor` del catálogo (ADR 0139). */
export const FAMILIAS_GRAFICO: ReadonlyArray<{ id: FamiliaGrafico; label: string; descripcion: string }> = FAMILIAS_EDITOR
  .flatMap((f) => (esIdFamilia(f.id) ? [{ id: f.id, label: f.label, descripcion: DESCRIPCION_FAMILIA[f.id] }] : []));

const POR_NOMBRE = new Map(CATALOGO_GRAFICOS.map((g) => [g.name, g]));

/** Graficadores que el registro tenga y el catálogo versionado todavía no: su familia sale de la categoría. */
const FAMILIA_POR_CATEGORIA: Record<GraficadorCategoria, FamiliaGrafico> = {
  distribution: "categorias",
  numeric: "numeros",
  comparison: "comparar",
  text: "texto",
  // ADR 0137: ningún graficador declara ya la categoría de dimensiones; un registro anterior que la traiga compara.
  dimensions: "comparar",
  territory: "territorio",
  other: "categorias",
};

const esFamilia = (v: string): v is FamiliaGrafico => FAMILIAS_GRAFICO.some((f) => f.id === v);

export function familiaDe(graf: Pick<GraficadorMetadata, "name" | "categoria">): FamiliaGrafico {
  const f = POR_NOMBRE.get(graf.name)?.familia_editor;
  if (f && esFamilia(f)) return f;
  return FAMILIA_POR_CATEGORIA[graf.categoria ?? "other"];
}

export function salidaDe(nombre: string): SalidaGrafico {
  return POR_NOMBRE.get(nombre)?.salida ?? "nativa";
}

export const ETIQUETA_SALIDA: Record<SalidaGrafico, { corto: string; largo: string }> = {
  nativa: { corto: "Editable", largo: "Sale como gráfico editable de PowerPoint." },
  marco: { corto: "Imagen", largo: "El gráfico va como imagen dentro de la lámina." },
  ruta_anterior: { corto: "Imagen", largo: "Este gráfico sale como imagen y no se puede editar en PowerPoint." },
};

/** Lo que se ofrece en la familia: lo que el registro no retira del selector, en su orden. Un registro anterior al
 *  ADR 0137 fase 2 todavía trae los tipos retirados con `en_selector` intacto: se quitan por nombre. */
export function graficosDeFamilia(graficadores: readonly GraficadorMetadata[], familia: FamiliaGrafico): GraficadorMetadata[] {
  return graficadores.filter((g) => g.en_selector !== false && POR_NOMBRE.get(g.name)?.en_selector !== false
    && !TIPOS_RETIRADOS_0137.has(g.name) && familiaDe(g) === familia);
}

/**
 * Las familias que el selector muestra: las que tienen algún gráfico (C3: una familia vacía no ocupa una fila). Sin catálogo todavía (`cargado = false`) van todas, para no vaciar la columna
 * mientras carga.
 */
export function familiasVisibles(
  porFamilia: ReadonlyMap<FamiliaGrafico, readonly unknown[]>,
  cargado: boolean,
): ReadonlyArray<(typeof FAMILIAS_GRAFICO)[number]> {
  if (!cargado) return FAMILIAS_GRAFICO;
  const visibles = FAMILIAS_GRAFICO.filter((f) => (porFamilia.get(f.id)?.length ?? 0) > 0);
  return visibles.length ? visibles : FAMILIAS_GRAFICO;
}

/** La familia pedida si se muestra; si no (la de un tipo retirado), la primera que se muestra. */
export function familiaVisible(
  pedida: FamiliaGrafico,
  visibles: ReadonlyArray<{ id: FamiliaGrafico }>,
): FamiliaGrafico {
  return visibles.some((f) => f.id === pedida) ? pedida : visibles[0]?.id ?? pedida;
}

/** `corto`: el motivo en una línea de tarjeta cuando no cabe (ADR 0139, ítem 6: la tarjeta dice por qué). */
export type Encaje = { cabe: boolean; nota: string | null; corto?: string };

/** ¿El graficador va en esa ranura? Las ranuras de cifra reciben cifras; una cifra en una de gráfico sale por la ruta anterior. */
export function encajeEnRanura(graficador: string, slot: string | null): Encaje {
  if (!slot) return { cabe: true, nota: null };
  const cifra = graficador === "p_cifra";
  if (esSlotCifra(slot) && !cifra) {
    return { cabe: false, nota: "Esta ranura es de cifra: recibe una cifra destacada, no un gráfico.", corto: "Esta ranura recibe solo cifras" };
  }
  if (!esSlotCifra(slot) && cifra) {
    return { cabe: true, nota: "Va en las ranuras de cifra; en una ranura de gráfico sale como imagen." };
  }
  return { cabe: true, nota: null };
}

/** Familia con la que abre el selector: la del gráfico actual, o Números en una ranura de cifra. */
export function familiaInicial(
  actual: Pick<GraficadorMetadata, "name" | "categoria"> | null,
  slot: string | null,
): FamiliaGrafico {
  if (actual) return familiaDe(actual);
  return slot && esSlotCifra(slot) ? "numeros" : "categorias";
}

// ---------------------------------------------------------------------------
// Entradas del catálogo de gráficos (ADR 0139, decisión 2)
// ---------------------------------------------------------------------------

/** Una tarjeta de «¿Qué gráfico?»: un graficador o una de sus variantes, con el nombre con que el catálogo la vende. */
export type EntradaGrafico = {
  /** El graficador (`p_pie`) o el id de la variante (`p_dumbbell:contraste`). */
  id: string;
  meta: GraficadorMetadata;
  variante: VarianteGraficoCatalogo | null;
  descripcion: string;
};

const familiaDeVariante = (v: VarianteGraficoCatalogo, base: GraficadorMetadata): FamiliaGrafico =>
  esFamilia(v.familia) ? v.familia : familiaDe(base);

/**
 * Las entradas de la familia: cada graficador que se ofrece y, detrás, sus variantes de esa familia. Una variante cuya
 * familia no es la de su graficador va al final de la suya. Sin su graficador en el registro, la variante no se ofrece.
 */
export function entradasDeFamilia(graficadores: readonly GraficadorMetadata[], familia: FamiliaGrafico): EntradaGrafico[] {
  const ofrecidos = new Map(FAMILIAS_GRAFICO.flatMap((f) => graficosDeFamilia(graficadores, f.id)).map((g) => [g.name, g]));
  const deVariante = (v: VarianteGraficoCatalogo, base: GraficadorMetadata): EntradaGrafico =>
    ({ id: v.id, meta: base, variante: v, descripcion: v.descripcion });
  const out: EntradaGrafico[] = [];
  for (const g of graficosDeFamilia(graficadores, familia)) {
    out.push({ id: g.name, meta: g, variante: null, descripcion: g.descripcion });
    for (const v of VARIANTES_GRAFICO) {
      if (v.graficador === g.name && familiaDeVariante(v, g) === familia) out.push(deVariante(v, g));
    }
  }
  for (const v of VARIANTES_GRAFICO) {
    const base = ofrecidos.get(v.graficador);
    if (base && familiaDe(base) !== familia && familiaDeVariante(v, base) === familia) out.push(deVariante(v, base));
  }
  return out;
}

/**
 * El gráfico que queda en la ranura al usar la entrada, sobre `base` (el graficador con los args compatibles del
 * anterior). La variante escribe sus args fijos y borra los que quita. El tipo base desde una variante del mismo
 * graficador deja de ser variante: se borran el estilo y la regla del resumen (el motor vuelve a su estilo por defecto).
 */
export function graficoDeEntrada(entrada: Pick<EntradaGrafico, "variante">, base: GraficadorRef): GraficadorRef {
  const args = base.args ?? {};
  if (entrada.variante) return { graficador: base.graficador, args: aplicarVariante(args, entrada.variante) };
  if (!varianteDeGrafico(base.graficador, args)) return base;
  const sinResumen: Record<string, unknown> = { ...args };
  delete sinResumen.estilo;
  delete sinResumen.regla;
  return { graficador: base.graficador, args: sinResumen };
}
