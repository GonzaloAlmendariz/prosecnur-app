// Tipos de gráfico por familia (F6.2; dirección F6 §4.4 «¿Qué gráfico?»). La familia y la salida de cada graficador
// las declara el backend (`.GRAFICOS_SALIDA_EDITOR` en graficos_metadata.R) y llegan versionadas en el catálogo
// (iconos/catalogoTipos.generated.ts). El registro en vivo dice qué está disponible en esta sesión.

import type { GraficadorCategoria, GraficadorMetadata } from "../../../../api/graficos";
import { CATALOGO_GRAFICOS, type SalidaGrafico } from "../../iconos/catalogoTipos.generated";
import { esSlotCifra } from "../../iconos/composicion";

export type FamiliaGrafico = "categorias" | "escalas" | "numeros" | "comparar" | "dimensiones" | "territorio" | "texto";

/** Las siete familias del selector, en el orden de `.GRAFICOS_FAMILIAS_EDITOR`. */
export const FAMILIAS_GRAFICO: ReadonlyArray<{ id: FamiliaGrafico; label: string; descripcion: string }> = [
  { id: "categorias", label: "Categorías", descripcion: "Cuántos eligieron cada opción de una pregunta." },
  { id: "escalas", label: "Escalas", descripcion: "Preguntas de acuerdo, satisfacción o frecuencia." },
  { id: "numeros", label: "Números", descripcion: "Promedios, distribuciones y cifras destacadas." },
  { id: "comparar", label: "Comparar", descripcion: "Dos o más públicos o mediciones frente a frente." },
  { id: "dimensiones", label: "Dimensiones", descripcion: "Índices calculados en Analítica." },
  { id: "territorio", label: "Territorio", descripcion: "Resultados o cobertura sobre el mapa." },
  { id: "texto", label: "Texto", descripcion: "Respuestas abiertas." },
];

const POR_NOMBRE = new Map(CATALOGO_GRAFICOS.map((g) => [g.name, g]));

/** Graficadores que el registro tenga y el catálogo versionado todavía no: su familia sale de la categoría. */
const FAMILIA_POR_CATEGORIA: Record<GraficadorCategoria, FamiliaGrafico> = {
  distribution: "categorias",
  numeric: "numeros",
  comparison: "comparar",
  text: "texto",
  dimensions: "dimensiones",
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
  nativa: { corto: "Nativa", largo: "Sale como gráfico editable de PowerPoint, dibujado por el recetario." },
  marco: { corto: "En el marco", largo: "La lámina es la del recetario y el gráfico va dibujado adentro como imagen." },
  ruta_anterior: { corto: "Ruta anterior", largo: "No hay pieza del recetario para este gráfico: sale como imagen por la ruta anterior." },
};

/** Lo que se ofrece en la familia: lo que el registro no retira del selector, en su orden. */
export function graficosDeFamilia(graficadores: readonly GraficadorMetadata[], familia: FamiliaGrafico): GraficadorMetadata[] {
  return graficadores.filter((g) => g.en_selector !== false && POR_NOMBRE.get(g.name)?.en_selector !== false && familiaDe(g) === familia);
}

export type Encaje = { cabe: boolean; nota: string | null };

/** ¿El graficador va en esa ranura? Las ranuras de cifra reciben cifras; una cifra en una de gráfico sale por la ruta anterior. */
export function encajeEnRanura(graficador: string, slot: string | null): Encaje {
  if (!slot) return { cabe: true, nota: null };
  const cifra = graficador === "p_cifra";
  if (esSlotCifra(slot) && !cifra) {
    return { cabe: false, nota: "Esta ranura es de cifra: recibe una cifra destacada, no un gráfico." };
  }
  if (!esSlotCifra(slot) && cifra) {
    return { cabe: true, nota: "Va en las ranuras de cifra; en una ranura de gráfico sale por la ruta anterior." };
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
