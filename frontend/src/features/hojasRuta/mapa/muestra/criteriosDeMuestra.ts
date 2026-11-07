import { formatoDecimal } from "../../../../lib/formatoNumero";
/**
 * P7 de la paridad con la página clásica: la recomendación de DEFF según la concentración por manzana
 * («Lectura de Prosecnur») y la guía rápida de decisión (semáforos por supuesto). Los umbrales y los
 * textos son los de la clásica (HojasRutaPage.tsx en 2c641554b^), sin cambios de criterio.
 */

export type Tono = "ok" | "aviso" | "error";
export type Consejo = { id: string; etiqueta: string; valor: string; tono: Tono; texto: string };
export type RecomendacionDeff = { titulo: string; texto: string; deff: number };

export function recomendacionDeff(entrevistasPorManzana: number): RecomendacionDeff {
  const carga = Math.max(1, Math.round(entrevistasPorManzana || 1));
  if (carga <= 1) return { titulo: "Ajuste no necesario por concentración", texto: "Con 1 entrevista por manzana, la fórmula de conglomerados vuelve a DEFF 1 si no hay pesos desiguales relevantes.", deff: 1.0 };
  if (carga <= 3) return { titulo: "Ajuste ligero si esperas parecido territorial", texto: "Hay poca concentración por manzana. Usa 1.0 si el indicador no es territorial; considera 1.2 si esperas homogeneidad por zona o NSE.", deff: 1.2 };
  if (carga <= 8) return { titulo: "Conviene evaluar ajuste territorial", texto: "Varias entrevistas salen de la misma manzana. Si el indicador depende de acceso, NSE, seguridad, servicios o preferencias barriales, 1.2–1.5 es defendible.", deff: 1.5 };
  return { titulo: "Usa un escenario conservador salvo evidencia contraria", texto: "La muestra concentra bastante carga por manzana. Sin ICC previo, conviene planificar con 1.5–2.0 y documentar el supuesto.", deff: 2.0 };
}

const pct = (x: number) => `${formatoDecimal(x * 100, 1)} %`;

export function consejosDeMuestra(s: { margenTotal: number; p: number; deff: number; respuesta: number }): Consejo[] {
  return [
    {
      id: "margen",
      etiqueta: "Margen total",
      valor: `± ${pct(s.margenTotal)}`,
      tono: s.margenTotal <= 0.05 ? "ok" : s.margenTotal <= 0.08 ? "aviso" : "error",
      texto: s.margenTotal <= 0.05 ? "Buen estándar para reportar el estudio completo." : s.margenTotal <= 0.08 ? "Útil para lectura exploratoria; evita conclusiones muy finas." : "Estudio total amplio. Sube el N si necesitas comparar diferencias pequeñas.",
    },
    {
      id: "p",
      etiqueta: "Resultado esperado",
      valor: pct(s.p),
      tono: s.p >= 0.35 && s.p <= 0.65 ? "ok" : "aviso",
      texto: s.p >= 0.35 && s.p <= 0.65 ? "Rango conservador. Si no hay evidencia, 50 % protege mejor el cálculo." : "Úsalo si tienes evidencia previa; si no, vuelve a 50 % para no subestimar el N.",
    },
    {
      id: "deff",
      etiqueta: "Diseño de campo",
      valor: `DEFF ${formatoDecimal(s.deff, 2)}`,
      tono: s.deff < 1 ? "aviso" : "ok",
      texto: s.deff < 1 ? "Optimista para campo territorial. Déjalo así con razón clara." : s.deff < 1.3 ? "Cerca de muestra simple; razonable para selección dispersa." : s.deff < 1.8 ? "Conservador moderado, apropiado para PPS." : "Más conservador; protege cuando la muestra se concentra por manzanas.",
    },
    {
      id: "respuesta",
      etiqueta: "Respuesta esperada",
      valor: pct(s.respuesta),
      tono: s.respuesta >= 0.75 ? "ok" : s.respuesta >= 0.55 ? "aviso" : "error",
      texto: s.respuesta >= 0.75 ? "Carga de contactos manejable para planificar campo." : s.respuesta >= 0.55 ? "Planifica reemplazos: necesitarás más contactos por encuesta completa." : "Riesgo operativo alto. Las cuotas no cambian; los contactos sí crecen mucho.",
    },
  ];
}

/** Resumen metodológico breve: cuándo cambia el N y cuándo sólo el diagnóstico. */
export const CRITERIOS_ESTADISTICOS: readonly { titulo: string; texto: string }[] = [
  { titulo: "Margen de error", texto: "El margen total sirve para leer el estudio completo; el distrital, cada distrito por separado. Si lo vuelves requisito, puede elevar el N con la suma de mínimos por distrito." },
  { titulo: "DEFF sugerido, no forzado", texto: "1,0 para muestra simple o muy dispersa; 1,1–1,3 para concentración ligera; 1,5 para rutas o manzanas con concentración moderada; 2,0 o más sólo con alta concentración, pesos desiguales o evidencia previa." },
  { titulo: "FPC", texto: "La corrección por población finita puede bajar el N cuando el marco es pequeño respecto de la muestra. Con un marco grande casi no lo mueve." },
  { titulo: "Rutas completas", texto: "Después del cálculo estadístico, el N se redondea hacia arriba al múltiplo de entrevistas por manzana, para que todas las rutas tengan la misma carga." },
];
