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
    riesgo: "holgado",
    cuota: 363,
    conseguido: 216,
    proyectado: 270,
    proyectado_optimista: 274,
    proyectado_pesimista: 266,
    margen_restante: -93,
    residual: 1.115,
    residual_k: 16,
    residual_base: "propia",
    reservas_libres: 4,
    banco_disponible: 6,
    reservas_necesarias: 0,
    reservas_de_cadena: 0,
    reservas_de_banco: 0,
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
      disparador: "el margen restante: conseguido + aforo pendiente x tau observada, contra la cuota del diseno",
      guarda: "la banda al 95 % acota la proyeccion; riesgo firme es que ni su extremo optimista cierre la cuota",
      senal: "la banda tambien dice si tau difiere de lo supuesto, que es otra pregunta",
      no_cubre: "Por qué cambió el rendimiento.",
    },
    total: {
      tau_previsto: 0.53, tau_observado: 0.51,
      banda_bajo: 0.48, banda_alto: 0.54,
      aulas_aplicadas: 68, elegibles_aplicados: 2000, efectivas: 1020,
      facultades_bajo_su_tau: 0, facultades_en_riesgo: 0, alumnos_en_riesgo: 0,
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

  it("dice el supuesto y lo observado en PORCENTAJE, que es como lo lee quien no diseñó la muestra", () => {
    const html = sinSeparador(render(bloque()));
    // 0,53 se publica como «53,0 %»: «0.530» no significa nada fuera del equipo.
    expect(html).toContain("53|0 %");
    expect(html).toContain("51|0 %");
    expect(html).toContain("68");
    // El numerador se DECLARA, y sin jerga: es lo único que distingue esta tasa
    // de las otras dos que el mismo perfil publica.
    expect(html).toContain("plataforma");
    expect(html).not.toContain("numerador:");
  });

  it("es una tabla de verdad, con encabezados nombrados y sin aria-hidden", () => {
    // El encabezado anterior era un `li` con `aria-hidden`, así que un lector de
    // pantalla recibía cinco columnas de números sin un solo nombre.
    const html = render(bloque());
    expect(html).toContain("<table");
    expect(html).toContain('scope="col"');
    expect(html).toContain('scope="row"');
    expect(html).toContain("<caption");
    expect(html).not.toContain('aria-hidden="true"><span>Facultad');
  });

  it("la barra tiene alternativa textual: su lectura no depende de verla", () => {
    const html = render(bloque({
      facultades: [fac({ tau_previsto: 0.5, tau_observado: 0.3, banda_bajo: 0.26, banda_alto: 0.34, senal: "bajo" })],
    }));
    expect(html).toContain('role="img"');
    expect(html).toContain("aria-label");
    expect(sinSeparador(html)).toContain("por debajo de lo previsto");
  });

  it("el veredicto va en PALABRA además de en color", () => {
    // Quien no distingue los tonos —o proyecta, o imprime— recibía el estado
    // sólo por el borde de color de la fila.
    expect(render(bloque({ facultades: [fac({ riesgo: "riesgo_firme" })] }))).toContain("No cierra");
    expect(render(bloque({ facultades: [fac({ riesgo: "holgado" })] }))).toContain("Cubierta");
    expect(render(bloque({ facultades: [fac({ riesgo: "ajustado" })] }))).toContain("Justo");
  });

  it("la leyenda de la barra es visual y vive junto a la tabla, no sólo en el pie", () => {
    const html = render(bloque());
    expect(html).toContain("aulas-tau-muestra-vara");
    expect(html).toContain("aulas-tau-muestra-banda");
    expect(html).toContain("lo previsto");
  });

  it("cuando ninguna facultad se queda corta lo dice, en vez de callar y parecer vacía", () => {
    const html = render(bloque());
    expect(html).toContain("Ninguna facultad se queda corta");
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

  it("cuando el MARGEN no cierra, la fila se marca y dice cuántas reservas cierran", () => {
    const html = render(bloque({
      total: { ...bloque().total, facultades_bajo_su_tau: 1, facultades_en_riesgo: 1, alumnos_en_riesgo: 160 },
      facultades: [fac({
        tau_observado: 0.3, tau_previsto: 0.5, banda_bajo: 0.26, banda_alto: 0.34,
        senal: "bajo", riesgo: "riesgo_firme", margen_restante: -160,
        reservas_libres: 6, banco_disponible: 0, reservas_necesarias: 4,
        reservas_de_cadena: 4, reservas_de_banco: 0, reservas_alcanzan: true,
      })],
    }));
    expect(html).toContain("es-bajo");
    expect(html).toContain("4 de 6");
    expect(html).toContain("160");
    expect(html).toContain("alumnos en riesgo");
  });

  it("rendir bajo la τ prevista NO pinta la fila si la cuota igual se cierra", () => {
    // El caso normal: en la selección 2026 el margen mediano es +49,2 % de la
    // cuota. Pintarlo de rojo mandaría a gastar reservas que no hacen falta.
    const html = render(bloque({
      total: { ...bloque().total, facultades_bajo_su_tau: 1, facultades_en_riesgo: 0 },
      facultades: [fac({ senal: "bajo", riesgo: "holgado", margen_restante: 120 })],
    }));
    expect(html).not.toContain("es-bajo");
    expect(html).toContain("Ninguna facultad se queda corta");
    // Y aun así se dice que rinde por debajo: el dato no se esconde.
    expect(html).toContain("por debajo de lo previsto");
  });

  it("con una sola aula aplicada la barra se rellena pero sin margen de error", () => {
    // El relleno se dibuja igual —es lo que va rindiendo— pero el bigote no,
    // porque con una observación no hay dispersión que medir.
    const html = render(bloque({
      facultades: [fac({
        aulas_aplicadas: 1, tau_observado: 0.1, tau_previsto: 0.5,
        banda_bajo: null, banda_alto: null, senal: "sin_banda", riesgo: "holgado",
      })],
    }));
    expect(html).toContain("aulas-tau-relleno");
    expect(html).not.toContain("aulas-tau-bigote");
    expect(html).not.toContain("es-bajo");
  });

  it("la barra va de 0 a 100 y se rellena con lo que se viene rindiendo", () => {
    // 0,30 se dibuja como 30 % del ancho, no como una fracción de una escala
    // recortada al máximo observado: sin extremos conocidos la barra no dice
    // qué es «lleno».
    const html = render(bloque({
      facultades: [fac({ tau_observado: 0.3, tau_previsto: 0.5, banda_bajo: 0.26, banda_alto: 0.34 })],
    }));
    expect(html).toContain("width:30%");
    expect(html).toContain("left:50%");   // la marca, en lo previsto
  });

  it("el relleno es verde cuando llega a la marca y rojo cuando se queda corto", () => {
    const corto = render(bloque({ facultades: [fac({ tau_observado: 0.3, tau_previsto: 0.5 })] }));
    const pasa = render(bloque({ facultades: [fac({ tau_observado: 0.7, tau_previsto: 0.5 })] }));
    expect(corto).toContain("es-peor");
    expect(corto).not.toContain("es-mejor");
    expect(pasa).toContain("es-mejor");
    expect(pasa).not.toContain("es-peor");
  });

  // --- el residual sin base no se lee como medición ---------------------------

  it("una facultad cuyo residual no tiene base histórica propia lo declara en su fila", () => {
    const conBase = render(bloque({ facultades: [fac({ residual_base: "propia" })] }));
    const sinBase = render(bloque({ facultades: [fac({ residual_base: "sin_base" })] }));
    expect(conBase).not.toContain("sin base histórica propia");
    expect(sinBase).toContain("sin base histórica propia");
  });

  // --- no recalcula ----------------------------------------------------------

  it("el margen que muestra es el del bloque, con su signo, y no una resta propia", () => {
    // Si la vista recompusiera el margen desde τ y elegibles daría −80; el
    // bloque dice −160 y es el bloque quien manda.
    const html = render(bloque({
      facultades: [fac({
        tau_observado: 0.3, tau_previsto: 0.5, elegibles_aplicados: 400,
        senal: "bajo", riesgo: "riesgo", banda_bajo: 0.26, banda_alto: 0.34,
        margen_restante: -160, alumnos_cierre: -80,
      })],
    }));
    expect(html).toContain("−160");
    expect(html).not.toContain("−80");
  });

  it("el pie dice que el margen se proyecta a lo que se viene rindiendo, no a lo previsto", () => {
    const html = render(bloque());
    expect(html).toContain("responda igual que lo aplicado hasta ahora");
    expect(html).toContain("No es la");
  });
});
