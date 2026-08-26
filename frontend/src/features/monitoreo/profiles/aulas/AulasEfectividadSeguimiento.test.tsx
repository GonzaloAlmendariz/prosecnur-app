import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type {
  MonitoreoAulasEfectividadFacultad,
  MonitoreoAulasEfectividadSeguimiento,
} from "../../../../api/monitoreo";
import { AulasEfectividadSeguimiento } from "./AulasEfectividadSeguimiento";

/**
 * La superficie que contrasta la τ del diseño con la del campo (ADR 0082).
 *
 * Lo que estas pruebas sujetan es lo que la pantalla PROMETE, no cómo se ve:
 *
 * 1. **Declara qué mide antes de la primera cifra** (C1). Sin eso, «0,51» junto
 *    a «0,53» son dos números sin pregunta — y en este perfil conviven tres
 *    tasas de la misma forma con numeradores distintos.
 * 2. **Contiene sus dos vacíos y los distingue** (C3). «No hay diseño» y «no
 *    hay campo» se arreglan de maneras distintas.
 * 3. **Sólo pinta lo que la BANDA sostiene.** Una diferencia puntual que la
 *    banda cruza no autoriza a gastar reservas, y la pantalla no puede sugerir
 *    lo contrario.
 * 4. **No recalcula.** Todos los números salen del bloque: si la vista los
 *    recompusiera, acabaría discrepando del motor, que es exactamente cómo
 *    nacieron las tres tasas homónimas que este ADR vino a separar.
 */

function fac(sobre: Partial<MonitoreoAulasEfectividadFacultad> = {}): MonitoreoAulasEfectividadFacultad {
  return {
    facultad: "Derecho",
    faculty_key: "derecho",
    tau_previsto: 0.562,
    tau_observado: 0.54,
    banda_bajo: 0.5,
    banda_alto: 0.58,
    aulas_aplicadas: 16,
    elegibles_aplicados: 400,
    elegibles_pendientes: 100,
    efectivas: 216,
    alumnos_corte: -8.8,
    alumnos_cierre: -11,
    senal: "conforme",
    residual: 1.115,
    residual_k: 16,
    residual_base: "propia",
    reservas_libres: 4,
    reservas_necesarias: 0,
    reservas_alcanzan: true,
    sin_cubrir: null,
    estado: "ok",
    ...sobre,
  };
}

function bloque(sobre: Partial<MonitoreoAulasEfectividadSeguimiento> = {}): MonitoreoAulasEfectividadSeguimiento {
  return {
    schema: "monitoreo_aulas_efectividad_seguimiento_v1",
    generado_en: "2026-08-26T12:00:00Z",
    fuente: "design_targets",
    vigencia: "vigente",
    motivo: "",
    criterio: {
      numerador: "efectiva de plataforma (respuesta que pasa los filtros declarados)",
      denominador: "elegibles de las aulas aplicadas al corte",
      senal: "la banda al 95 % excluye la τ prevista; el punto solo no señala",
      no_cubre: "Por qué cambió el rendimiento.",
    },
    total: {
      tau_previsto: 0.53, tau_observado: 0.51,
      banda_bajo: 0.48, banda_alto: 0.54,
      aulas_aplicadas: 68, elegibles_aplicados: 2000, efectivas: 1020,
      facultades_senaladas: 0, alumnos_en_riesgo: 0,
    },
    facultades: [fac()],
    ...sobre,
  };
}

const render = (b: MonitoreoAulasEfectividadSeguimiento | null) =>
  renderToStaticMarkup(<AulasEfectividadSeguimiento bloque={b} />);

/**
 * El separador decimal se normaliza antes de comparar.
 *
 * El runner corre sobre un Node SIN ICU completo, así que `toLocaleString("es-PE")`
 * degrada a la convención inglesa y una τ sale «0.530» donde la app la pinta
 * «0,530». Afirmar la coma aquí daría un rojo del ENTORNO y no del producto; y
 * afirmar el punto congelaría en la suite lo contrario de lo que se ve en
 * pantalla. Lo que estas pruebas sujetan es que la cifra sea la del bloque, no
 * qué carácter la separa — de eso responde el runtime.
 */
const sinSeparador = (html: string) => html.replace(/(\d)[.,](\d)/g, "$1|$2");

describe("la τ del diseño contra la del campo", () => {
  // --- C1: declara qué mide ---------------------------------------------------

  it("dice el supuesto y lo observado antes de cualquier tabla, y de dónde sale el numerador", () => {
    const html = sinSeparador(render(bloque()));
    expect(html).toContain("0|530");
    expect(html).toContain("0|510");
    expect(html).toContain("68");
    // El numerador se DECLARA: es lo único que distingue esta tasa de las otras
    // dos que el mismo perfil publica.
    expect(html).toContain("plataforma");
  });

  it("cuando nadie rinde por debajo lo dice, en vez de callar y parecer vacía", () => {
    const html = render(bloque());
    expect(html).toContain("Ninguna facultad rinde por debajo");
  });

  // --- C3: dos vacíos, y se distinguen ---------------------------------------

  it("sin bloque no finge una tabla", () => {
    expect(render(null)).toContain("todavía no publica el seguimiento");
  });

  it("sin diseño y sin campo dan mensajes DISTINTOS: se arreglan de formas distintas", () => {
    const sinDiseno = render(bloque({ vigencia: "sin_diseno", facultades: [] }));
    const sinCampo = render(bloque({ vigencia: "vigente", facultades: [] }));
    expect(sinDiseno).toContain("no trae la tasa de efectividad");
    expect(sinCampo).toContain("Todavía no hay aulas aplicadas");
    expect(sinDiseno).not.toEqual(sinCampo);
  });

  // --- la señal la dispara la banda ------------------------------------------

  it("una diferencia que la banda no sostiene no pinta la fila ni pide reservas", () => {
    // Observada 0,48 contra 0,50 prevista, con la banda cruzando la vara.
    const html = render(bloque({
      facultades: [fac({
        tau_observado: 0.48, tau_previsto: 0.5, banda_bajo: 0.44, banda_alto: 0.56,
        senal: "conforme", alumnos_cierre: -10,
      })],
    }));
    expect(html).not.toContain("es-bajo");
    // Los alumnos siguen visibles —el dato no se esconde— pero atenuados: se
    // ven, no gritan.
    expect(html).toContain("es-debil");
  });

  it("cuando la banda excluye la vara, la fila se marca y dice cuántas reservas cierran", () => {
    const html = render(bloque({
      total: { ...bloque().total, facultades_senaladas: 1, alumnos_en_riesgo: 160 },
      facultades: [fac({
        tau_observado: 0.3, tau_previsto: 0.5, banda_bajo: 0.26, banda_alto: 0.34,
        senal: "bajo", alumnos_cierre: -160, reservas_libres: 6, reservas_necesarias: 4,
        reservas_alcanzan: true,
      })],
    }));
    expect(html).toContain("es-bajo");
    expect(html).toContain("4 de 6");
    expect(html).toContain("160");
    expect(html).toContain("alumnos en riesgo");
  });

  it("con una sola aula aplicada no hay banda que dibujar y el punto queda atenuado", () => {
    const html = render(bloque({
      facultades: [fac({
        aulas_aplicadas: 1, tau_observado: 0.1, banda_bajo: null, banda_alto: null,
        senal: "sin_banda", alumnos_cierre: null,
      })],
    }));
    expect(html).toContain("aulas-tau-punto");
    expect(html).not.toContain("aulas-tau-banda");
    expect(html).not.toContain("es-bajo");
  });

  // --- el residual sin base no se lee como medición ---------------------------

  it("una facultad cuyo residual no tiene base histórica propia lo declara en su fila", () => {
    const conBase = render(bloque({ facultades: [fac({ residual_base: "propia" })] }));
    const sinBase = render(bloque({ facultades: [fac({ residual_base: "sin_base" })] }));
    expect(conBase).not.toContain("sin base histórica propia");
    expect(sinBase).toContain("sin base histórica propia");
  });

  // --- no recalcula ----------------------------------------------------------

  it("los alumnos que muestra son los del bloque, con su signo, y no una resta propia", () => {
    // Si la vista recompusiera el déficit desde τ y elegibles daría −80; el
    // bloque dice −160 y es el bloque quien manda.
    const html = render(bloque({
      facultades: [fac({
        tau_observado: 0.3, tau_previsto: 0.5, elegibles_aplicados: 400,
        senal: "bajo", banda_bajo: 0.26, banda_alto: 0.34, alumnos_cierre: -160,
      })],
    }));
    expect(html).toContain("−160");
    expect(html).not.toContain("−80");
  });

  it("el pie separa estos alumnos de la brecha contra la cuota, que es otro número", () => {
    const html = render(bloque());
    expect(html).toContain("no");
    expect(html).toContain("la brecha contra la cuota");
  });
});
