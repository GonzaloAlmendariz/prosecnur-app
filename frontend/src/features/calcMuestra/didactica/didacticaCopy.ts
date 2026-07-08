/**
 * Copys en lenguaje llano del recorrido "Muestra de aulas".
 *
 * El contenido metodológico profundo vive en `referencia/corpus.ts` (destilado
 * de los estudios de referencia); aquí van los textos cortos de orientación
 * que la UI muestra siempre: qué hace cada paso y cómo leer cada término.
 */
export type PasoId = "definicion" | "marco" | "calculo" | "aulas" | "salidas";

export type PasoMeta = {
  id: PasoId;
  orden: number;
  etiqueta: string;
  /** 1-2 frases: qué hacemos aquí y por qué, para no técnicos. */
  llano: string;
  /** pasoId del corpus (RESPALDOS usa "aplicacion" para salidas). */
  respaldoId: "definicion" | "marco" | "calculo" | "aulas" | "aplicacion";
};

export const PASOS: PasoMeta[] = [
  {
    id: "definicion",
    orden: 1,
    etiqueta: "Definición",
    llano:
      "Aquí acordamos qué información necesitamos de la universidad y por qué: la base de matriculados dice quiénes son los estudiantes, y la de curso-horario dice en qué salones podemos encontrarlos.",
    respaldoId: "definicion",
  },
  {
    id: "marco",
    orden: 2,
    etiqueta: "Marco institucional",
    llano:
      "La base cruda trae de todo: posgrado, cursos virtuales, alumnos retirados. En este paso la depuramos con filtros claros hasta quedarnos solo con la población que el estudio realmente quiere representar.",
    respaldoId: "marco",
  },
  {
    id: "calculo",
    orden: 3,
    etiqueta: "Cálculo",
    llano:
      "Con la población ya definida, calculamos a cuántos estudiantes necesitamos encuestar para que el resultado sea confiable. Puedes mover los parámetros y ver cómo cambia el tamaño; la cifra final siempre la valida la calculadora.",
    respaldoId: "calculo",
  },
  {
    id: "aulas",
    orden: 4,
    etiqueta: "Aulas y selección",
    llano:
      "No encuestamos alumno por alumno: sorteamos salones completos. Aquí el laboratorio elige qué aulas entran, con qué probabilidad, y qué aulas de reserva usar si una falla — todo con reglas auditables, no a dedo.",
    respaldoId: "aulas",
  },
  {
    id: "salidas",
    orden: 5,
    etiqueta: "Salida",
    llano:
      "El diseño se convierte en entregables defendibles: el reporte metodológico con la memoria de cálculo completa y el anexo con las aulas seleccionadas, sus probabilidades y sus reemplazos. Cualquier revisor puede auditar cada decisión.",
    respaldoId: "aplicacion",
  },
];

export function pasoMeta(id: string): PasoMeta {
  return PASOS.find((p) => p.id === id) ?? PASOS[0];
}

// Los términos de la fórmula de Cochran ya no se describen aquí: la pestaña
// Parámetros (universidad/calculo) los explica con FormulaLatex + TerminoChip
// directamente desde el GLOSARIO del corpus.

export const BADGE_COPY = {
  validado: "cifra validada",
  preview: "vista previa · calculando…",
  error: "sin conexión con la calculadora",
} as const;
