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
  /** Población objetivo (rangos de edad del estudio); sin ella se muestra la total. */
  poblacionObjetivo?: number | null;
  /** N asignado por las cuotas; null mientras no hay cuotas. */
  n: number | null;
  /** Margen total estimado como fracción (0,028 = ±2,8 %); null si no se conoce. */
  margen: number | null;
  /** Titulares y reemplazos sorteados; null mientras no hay sorteo. */
  titulares: number | null;
  reemplazos: number | null;
};

const entero = (n: number) => new Intl.NumberFormat("es-PE").format(n);
// 2.39 M · 839 mil · 950: el indicador es un vistazo, no una tabla.
const compacto = (n: number) =>
  n >= 1e6 ? `${new Intl.NumberFormat("es-PE", { maximumFractionDigits: 2 }).format(n / 1e6)} M` : n >= 1e4 ? `${new Intl.NumberFormat("es-PE", { maximumFractionDigits: 0 }).format(n / 1e3)} mil` : entero(n);
const margen = (m: number) => `±${new Intl.NumberFormat("es-PE", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(m * 100)} %`;

export function indicadoresDecididos(e: EntradaLoDecidido): IndicadorDecidido[] {
  const distritos = e.distritos === 1 ? "1 distrito" : `${entero(e.distritos)} distritos`;
  const muestra = e.n == null ? "Por definir" : e.margen == null ? `N ${entero(e.n)}` : `N ${entero(e.n)} · ${margen(e.margen)}`;
  const ump = e.titulares == null ? "Por sortear" : `${entero(e.titulares)} + ${entero(e.reemplazos ?? 0)} R`;
  const objetivo = e.poblacionObjetivo != null && e.poblacionObjetivo > 0;
  const poblacion = objetivo ? (e.poblacionObjetivo as number) : e.poblacion;
  // Mismo orden que el recorrido: Territorio → Población → Muestra → UMP (brecha B2).
  return [
    { id: "territorio", label: "Territorio", value: e.distritos ? distritos : "Por elegir", detalle: `Territorio: ${e.distritos ? distritos : "sin distritos confirmados"}`, prioridad: "alta", seccion: "territorio" },
    { id: "poblacion", label: "Población", value: poblacion ? compacto(poblacion) : "Por calcular", detalle: objetivo ? `Población objetivo: ${entero(poblacion)} personas` : `Población total de los distritos elegidos: ${entero(e.poblacion)} (la objetivo aparece al calcular la matriz)`, prioridad: "baja", seccion: "poblacion" },
    { id: "muestra", label: "Muestra", value: muestra, detalle: e.n == null ? "Muestra: el N aún no está definido" : `Muestra: ${muestra.replace("N ", "N = ")}`, prioridad: "alta", seccion: "muestra" },
    { id: "ump", label: "UMP", value: ump, detalle: e.titulares == null ? "UMP: aún no se sortean las manzanas" : `UMP: ${entero(e.titulares)} titulares y ${entero(e.reemplazos ?? 0)} reemplazos`, prioridad: "media", seccion: "manzanas" },
  ];
}
