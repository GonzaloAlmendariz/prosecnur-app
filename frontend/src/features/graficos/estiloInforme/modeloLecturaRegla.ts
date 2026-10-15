// «Cómo se lee» de cada regla (R8 del rediseño, 2026-10-15): lo que la regla produce en una lámina, calculado con los
// mismos criterios que el motor. Puro: el redondeo del ejemplo usa el método y los decimales de la regla del informe
// (estándar = cada cifra sola; reparto = restos mayores hasta cerrar 100) y la nota va según su modo, igual que
// `.calculos_nota_texto` y la decisión del graficador (basta una barra que no sume 100; con reparto, nunca).

import { palabraPorDefecto } from "./SufijosPorBase";
import { textoAutomatico, type ModoNota } from "./notaRedondeo";
import type { CasosJunto } from "./casosJunto";
import { ejemploTextoBase, METODO_REPARTO } from "./modeloEstiloInforme";

/** Lámina de ejemplo: «Servicios de tutoría» por público, tres respuestas, con conteos (no porcentajes inventados). */
export const EJEMPLO_REDONDEO: readonly { publico: string; conteos: readonly number[] }[] = [
  { publico: "Docentes", conteos: [17, 17, 18] },
  { publico: "Estudiantes", conteos: [61, 57, 54] },
  { publico: "Egresados", conteos: [45, 89, 44] },
];

const escala = (dec: number) => 10 ** dec;

/** Redondea los porcentajes de una barra como lo hace el motor con ese método y esos decimales. */
export function redondearBarra(conteos: readonly number[], metodo: string, decimales: number): number[] {
  const total = conteos.reduce((a, b) => a + b, 0);
  if (!total) return conteos.map(() => 0);
  const k = escala(decimales);
  const crudos = conteos.map((c) => (c / total) * 100 * k);
  if (metodo !== METODO_REPARTO) return crudos.map((v) => Math.round(v) / k);
  const pisos = crudos.map(Math.floor);
  let resto = 100 * k - pisos.reduce((a, b) => a + b, 0);
  const orden = crudos.map((v, i) => ({ i, frac: v - Math.floor(v) })).sort((a, b) => b.frac - a.frac);
  for (const { i } of orden) {
    if (resto <= 0) break;
    pisos[i] += 1;
    resto -= 1;
  }
  return pisos.map((v) => v / k);
}

export type FilaEjemplo = { publico: string; valores: number[]; suma: number; cierra: boolean };
export type EjemploRedondeo = { filas: FilaEjemplo[]; lleva: boolean; nota: string; motivo: string };

export function ejemploRedondeo(metodo: string, decimales: number, modo: ModoNota, textoPropio: string): EjemploRedondeo {
  const k = escala(decimales);
  const filas = EJEMPLO_REDONDEO.map(({ publico, conteos }) => {
    const valores = redondearBarra(conteos, metodo, decimales);
    const suma = Math.round(valores.reduce((a, b) => a + b, 0) * k) / k;
    return { publico, valores, suma, cierra: Math.abs(suma - 100) < 1e-9 };
  });
  const algunaNoCierra = filas.some((f) => !f.cierra);
  const lleva = modo === "siempre" || (modo === "si_no_cierra" && metodo !== METODO_REPARTO && algunaNoCierra);
  const motivo = lleva
    ? "Esta lámina lleva la nota."
    : modo === "nunca" ? "Sin nota: así lo pide la regla."
      : "Sin nota: todas sus barras suman 100 %.";
  return { filas, lleva, nota: textoPropio.trim() || textoAutomatico(metodo, decimales), motivo };
}

/** Una cifra con los decimales de la regla y punto decimal, como la rotulan los graficadores (es-PE). */
export function cifra(v: number, decimales: number): string {
  return v.toFixed(decimales);
}

export type Lectura = { grande: string; detalle: string };

export function lecturaCasos(c: CasosJunto, conReglaPropia: number): Lectura {
  const grande = c.cuando === "nunca" ? "43%" : "43% (12)";
  const detalle = c.cuando === "siempre" ? "Todos los porcentajes llevan sus casos"
    : c.cuando === "nunca" ? "Ningún porcentaje lleva sus casos"
      : `Un grupo de 12 casos lleva sus casos; uno de ${Math.max(c.umbral, 120)}, no`;
  const otros = conReglaPropia ? ` ${conReglaPropia === 1 ? "Un gráfico tiene" : `${conReglaPropia} gráficos tienen`} la suya.` : "";
  return { grande, detalle: `${detalle}.${otros}` };
}

/** Con varias bases, el texto de las dos primeras con su palabra; con una, el ejemplo de siempre. */
export function lecturaBase(formato: string, sufijo: string, bases: readonly string[], sufijosPorBase: Record<string, string>): Lectura {
  if (bases.length < 2) {
    return { grande: ejemploTextoBase(formato, sufijo), detalle: sufijo.trim() ? `Con 120 casos; «${sufijo.trim()}» después del número` : "Con 120 casos; sólo el número" };
  }
  const [a, b] = bases;
  const palabra = (base: string) => sufijosPorBase[base]?.trim() || palabraPorDefecto(base);
  const propias = bases.some((base) => sufijosPorBase[base]?.trim());
  const primera = ejemploTextoBase(formato, palabra(a), 52);
  return {
    grande: primera.replace(`52 ${palabra(a)}`, `52 ${palabra(a)} y 140 ${palabra(b)}`),
    detalle: propias ? "Una palabra elegida para cada base" : "El nombre de la base, sin guiones bajos",
  };
}

export function lecturaOtros(encendido: boolean): Lectura {
  return encendido
    ? { grande: "Lámina «Otros» después de su gráfico", detalle: "Lo que escribieron en «Otro, especifique», en el PPT y en el Word" }
    : { grande: "Sin lámina de «Otros»", detalle: "Las respuestas abiertas no salen en el informe" };
}
