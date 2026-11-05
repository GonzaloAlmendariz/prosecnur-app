import type { HojasRutaIntegratedConfig } from "../../../../api/hojasRuta";
import { formatoConteo } from "../../../../lib/formatoNumero";
import { usaBase2025 } from "../muestra/desdeConfig";
import { METODOS } from "../manzanas/ManzanasPaneles";
import { ESTRATOS, estratoDe, RUTAS_MINIMAS_CIUDAD } from "../muestra/EstratoMuestral";

/** Los ocho grupos de «Ajustes del diseño», en el orden de la maqueta aprobada. El id es la dirección (`foco`). */
export type GrupoAjustesId = "tamano" | "reparto" | "visitas" | "cuotas" | "marco" | "sorteo" | "recorrido" | "fase";

export type GrupoAjustes = { id: GrupoAjustesId; nombre: string; descripcion: string; claves: readonly string[] };

export const GRUPOS_AJUSTES: readonly GrupoAjustes[] = [
  { id: "tamano", nombre: "Tamaño y precisión", descripcion: "Encuestas, margen y supuestos.", claves: ["n", "margen", "confianza", "deff", "efecto de diseño", "icc", "encuestas por ruta", "respuesta"] },
  { id: "reparto", nombre: "Reparto y estrato", descripcion: "Población del reparto y estrato del sorteo.", claves: ["censo", "2025", "2017", "provincia", "distrito", "asignación"] },
  { id: "visitas", nombre: "Visitas mínimas", descripcion: "Rutas mínimas por ciudad visitada.", claves: ["mínimo", "fija", "aleatoria", "ciudad"] },
  { id: "cuotas", nombre: "Cuotas y edades", descripcion: "Rangos de edad, sexo y qué se exige en campo.", claves: ["edad", "rango", "sexo", "meta", "referencia"] },
  { id: "marco", nombre: "Marco elegible", descripcion: "Qué manzanas pueden salir sorteadas.", claves: ["viviendas", "mínimo", "áreas excluidas", "marco"] },
  { id: "sorteo", nombre: "Sorteo de manzanas", descripcion: "Método, medida y semilla.", claves: ["pps", "sistemático", "conglomerado", "semilla", "viviendas", "población"] },
  { id: "recorrido", nombre: "Recorrido y reemplazos", descripcion: "Esquina, salto y reemplazos por titular.", claves: ["esquina", "salto", "reemplazo", "zona"] },
  { id: "fase", nombre: "Fase y piloto", descripcion: "Piloto y campo real.", claves: ["piloto", "campo", "fase", "bloqueado"] },
];

export const esGrupoAjustes = (v: string | null | undefined): v is GrupoAjustesId => GRUPOS_AJUSTES.some((g) => g.id === v);

const sinTildes = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Los grupos cuyo nombre, descripción o palabras clave contienen la búsqueda (sin tildes ni mayúsculas). */
export function filtrarGrupos(busqueda: string, grupos: readonly GrupoAjustes[] = GRUPOS_AJUSTES): GrupoAjustes[] {
  const q = sinTildes(busqueda.trim());
  if (!q) return [...grupos];
  return grupos.filter((g) => [g.nombre, g.descripcion, ...g.claves].some((t) => sinTildes(t).includes(q)));
}


/** El valor vigente de cada grupo en una línea, para la navegación lateral y el botón «Diseño». */
export function resumenGrupo(id: GrupoAjustesId, c: HojasRutaIntegratedConfig, extra: { n?: number | null; fase?: string } = {}): string {
  const s = c.sample_size;
  switch (id) {
    case "tamano": {
      const n = extra.n ?? c.n_objetivo;
      // Sin el margen objetivo: junto al margen logrado del pie, «±5 %» y «±2.8 pp» se leían como contradicción.
      return `${formatoConteo(n)} encuestas, ${c.entrevistas_por_manzana} por ruta`;
    }
    case "reparto":
      return `${ESTRATOS.find(([m]) => m === estratoDe(s))?.[1] ?? "Por distrito"}, ${usaBase2025(s) ? "CPV 2025" : "CPV 2017"}`;
    case "visitas":
      // Con estrato por distrito (o N por distrito) todas las ciudades son fijas y el mínimo no actúa: decirlo.
      return c.sample_size_mode === "external_district" || estratoDe(s) === "distrito" ? "Sin efecto con estrato por distrito" : `${s.rutas_minimas_ciudad ?? RUTAS_MINIMAS_CIUDAD} rutas por ciudad como mínimo`;
    case "cuotas":
      return `${c.age_ranges.length} rango${c.age_ranges.length === 1 ? "" : "s"} de edad${c.subquota_var === "sexo" ? ", por sexo" : ""}`;
    case "marco": {
      const m = c.marco_elegible;
      if (!m?.declarado) return "Sin declarar";
      const a = m.areas_excluidas.length;
      return `Mínimo ${m.minimo_viviendas} vivienda${m.minimo_viviendas === 1 ? "" : "s"}${a ? `, ${a} área${a === 1 ? "" : "s"} excluida${a === 1 ? "" : "s"}` : ""}`;
    }
    case "sorteo":
      return `${METODOS.find((m) => m.id === c.sampling_method)?.titulo ?? c.sampling_method}, semilla ${c.seed}`;
    case "recorrido":
      return `${c.replacements_per_titular} reemplazo${c.replacements_per_titular === 1 ? "" : "s"} por titular`;
    case "fase":
      return extra.fase === "pilot" ? "Piloto" : "Campo real";
  }
}
