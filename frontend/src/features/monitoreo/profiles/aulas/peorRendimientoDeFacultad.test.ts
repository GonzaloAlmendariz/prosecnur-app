import { describe, expect, it } from "vitest";

import { MINIMO_PARA_COMPARAR, peorRendimiento } from "./peorRendimientoDeFacultad";
import type { MonitoreoAulasEfectividadSeguimiento, MonitoreoAulasPlanRow } from "../../../../api/monitoreo";

/**
 * «No hay contexto sobre cuáles son las facultades con peor tasa observada vs
 * tasa prevista o de diseño» (Gonzalo, 2026-09-11). Lo que se comprueba aquí es
 * que el orden sea el de la EFICIENCIA —observada sobre prevista— y no el de la
 * deuda, que ya tiene su propio ranking y responde otra pregunta.
 */
const bloque = {
  total: {},
  facultades: [
    // Rinde a la mitad de lo previsto con poco campo: la peor, y el ranking de
    // deuda apenas la vería.
    { facultad: "ARTES ESCÉNICAS", faculty_key: "artes", aulas_aplicadas: 4, tau_previsto: 0.74, tau_observado: 0.37 },
    // Debe mucho en bruto, pero rinde casi lo previsto: aquí falta terreno, no
    // método.
    { facultad: "CIENCIAS SOCIALES", faculty_key: "sociales", aulas_aplicadas: 20, tau_previsto: 0.55, tau_observado: 0.528 },
    { facultad: "DERECHO", faculty_key: "derecho", aulas_aplicadas: 6, tau_previsto: 0.60, tau_observado: 0.42 },
    { facultad: "GESTIÓN", faculty_key: "gestion", aulas_aplicadas: 5, tau_previsto: 0.50, tau_observado: 0.55 },
    // Bajo rendimiento pero por debajo del mínimo: no entra.
    { facultad: "EDUCACIÓN", faculty_key: "educacion", aulas_aplicadas: 2, tau_previsto: 0.62, tau_observado: 0.10 },
    // Sin campo: ni entra ni se cuenta como apartada, porque de ésa no se sabe.
    { facultad: "LETRAS", faculty_key: "letras", aulas_aplicadas: 0, tau_previsto: 0.62, tau_observado: null },
  ],
} as unknown as MonitoreoAulasEfectividadSeguimiento;

const porSexo = [
  { faculty_key: "artes", sexo: "F", diferencia: -4 },
  { faculty_key: "sociales", sexo: "F", diferencia: -30 },
];

const plan = [
  // Dos apoyos que ya rindieron en Artes: uno por respuestas y otro por estado.
  { faculty: "ARTES ESCÉNICAS", sample_role: "reemplazo", respuestas_validas: 12, operational_status: "programada" },
  { faculty: "ARTES ESCÉNICAS", sample_role: "extra", respuestas_validas: 0, operational_status: "aplicada" },
  // Un apoyo agendado que todavía no rindió: no cuenta.
  { faculty: "ARTES ESCÉNICAS", sample_role: "reemplazo", respuestas_validas: 0, operational_status: "programada" },
  // Un titular aplicado no es un apoyo.
  { faculty: "ARTES ESCÉNICAS", sample_role: "titular", respuestas_validas: 30, operational_status: "aplicada" },
  // Y el mismo nombre con otra grafía sigue siendo la misma facultad.
  { faculty: "artes escénicas ", sample_role: "reemplazo", respuestas_validas: 5, operational_status: "aplicada" },
] as unknown as MonitoreoAulasPlanRow[];

describe("las facultades que peor rinden frente a su previsión", () => {
  it("ordena por eficiencia, no por cuánto se debe", () => {
    const { peores } = peorRendimiento(bloque, porSexo, plan);
    // Ciencias Sociales debe 30 respuestas y rinde el 96 % de lo previsto:
    // en un ranking de deuda iría primera y aquí va última.
    expect(peores.map((f) => f.clave)).toEqual(["artes", "derecho", "sociales"]);
    expect(peores[0].razon).toBeCloseTo(0.5, 3);
  });

  it("no llena el tope con facultades que van por encima de lo previsto", () => {
    // Gestión rinde el 110 % de lo previsto. Con el corte real del 2026-09-11 el
    // «top 5» traía tres así, y el panel decía que se alejaban de su previsión.
    const { peores, porDebajo, comparables } = peorRendimiento(bloque, porSexo, plan);
    expect(peores.some((f) => f.clave === "gestion")).toBe(false);
    expect(peores.every((f) => f.razon < 1)).toBe(true);
    expect(porDebajo).toBe(3);
    expect(comparables).toBe(4);
  });

  it("cuenta los apoyos de todo el estudio, no sólo los de la lista", () => {
    // Sin esa cifra, una lista entera sin apoyos se lee como que el cruce con
    // el plan falla. En el corte real son 1 de 1 218 reservas.
    expect(peorRendimiento(bloque, porSexo, plan).apoyosEnElEstudio).toBe(3);
  });

  it("aparta las que no llegan al mínimo y dice cuántas son", () => {
    const { peores, comparables, apartadas } = peorRendimiento(bloque, porSexo, plan);
    // Educación rinde el 16 % de lo previsto y encabezaría el ranking con dos
    // cursos-horario: eso es ruido presentado como diagnóstico.
    expect(peores.some((f) => f.clave === "educacion")).toBe(false);
    expect(comparables).toBe(4);
    expect(apartadas).toBe(1);
    expect(MINIMO_PARA_COMPARAR).toBe(3);
  });

  it("no cuenta como apartada a la que todavía no tiene campo", () => {
    // Letras no se compara ni se aparta: no hay nada que medir en ella.
    const { apartadas } = peorRendimiento(bloque, porSexo, plan);
    expect(apartadas).toBe(1);
  });

  it("cuenta los apoyos que ya rindieron, y sólo ésos", () => {
    const artes = peorRendimiento(bloque, porSexo, plan).peores.find((f) => f.clave === "artes")!;
    // Dos por el plan con su grafía y uno con la otra; el agendado sin
    // respuestas y el titular quedan fuera.
    expect(artes.apoyosAplicados).toBe(3);
  });

  it("sin plan no inventa apoyos", () => {
    const artes = peorRendimiento(bloque, porSexo, undefined).peores.find((f) => f.clave === "artes")!;
    expect(artes.apoyosAplicados).toBe(0);
  });

  it("recorta al tope pedido pero devuelve la lista entera para situar a una", () => {
    const { peores, todas } = peorRendimiento(bloque, porSexo, plan, 2);
    expect(peores).toHaveLength(2);
    // Con el filtro puesto, la tarjeta necesita el puesto real de una facultad
    // que no está entre las peores.
    expect(todas.map((f) => f.clave)).toEqual(["artes", "derecho", "sociales", "gestion"]);
  });

  it("sin bloque devuelve vacío en vez de reventar", () => {
    expect(peorRendimiento(null, null, null)).toEqual({
      peores: [], comparables: 0, porDebajo: 0, apartadas: 0, apoyosEnElEstudio: 0, todas: [],
    });
  });
});
