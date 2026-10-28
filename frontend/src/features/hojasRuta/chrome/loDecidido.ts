import type { ChromeIndicatorPrioridad } from "../../../components/ChromeIndicator";
import type { HojasRutaStage } from "../store";

// La zona de contexto de la command bar dice lo DECIDIDO, no el estado del
// marco: «Base: Cargada» era siempre igual y no ayudaba a nadie. Cada
// indicador nombra una decisión del recorrido y abre la sección donde se toma.

export type IndicadorDecidido = {
  id: "territorio" | "muestra" | "ump" | "poblacion";
  label: string;
  value: string;
  detalle: string;
  prioridad: ChromeIndicatorPrioridad;
  seccion: HojasRutaStage;
};

export type EntradaLoDecidido = {
  distritos: number;
  poblacion: number;
  /** N asignado por las cuotas; null mientras no hay cuotas. */
  n: number | null;
  /** Margen total estimado como fracción (0,028 = ±2,8 %); null si no se conoce. */
  margen: number | null;
  /** Titulares y reemplazos sorteados; null mientras no hay sorteo. */
  titulares: number | null;
  reemplazos: number | null;
};

const entero = (n: number) => new Intl.NumberFormat("es-PE").format(n);
const margen = (m: number) => `±${new Intl.NumberFormat("es-PE", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(m * 100)} %`;

export function indicadoresDecididos(e: EntradaLoDecidido): IndicadorDecidido[] {
  const distritos = e.distritos === 1 ? "1 distrito" : `${entero(e.distritos)} distritos`;
  const muestra = e.n == null ? "Por definir" : e.margen == null ? `N ${entero(e.n)}` : `N ${entero(e.n)} · ${margen(e.margen)}`;
  const ump = e.titulares == null ? "Por sortear" : `${entero(e.titulares)} + ${entero(e.reemplazos ?? 0)}`;
  return [
    { id: "territorio", label: "Territorio", value: e.distritos ? distritos : "Por elegir", detalle: `Territorio: ${e.distritos ? distritos : "sin distritos confirmados"}`, prioridad: "alta", seccion: "territorio" },
    { id: "muestra", label: "Muestra", value: muestra, detalle: e.n == null ? "Muestra: el N aún no está definido" : `Muestra: ${muestra.replace("N ", "N = ")}`, prioridad: "alta", seccion: "muestra" },
    { id: "ump", label: "UMP", value: ump, detalle: e.titulares == null ? "UMP: aún no se sortean las manzanas" : `UMP: ${entero(e.titulares)} titulares y ${entero(e.reemplazos ?? 0)} reemplazos`, prioridad: "media", seccion: "manzanas" },
    { id: "poblacion", label: "Población", value: entero(e.poblacion), detalle: `Población de los distritos elegidos: ${entero(e.poblacion)}`, prioridad: "baja", seccion: "poblacion" },
  ];
}
