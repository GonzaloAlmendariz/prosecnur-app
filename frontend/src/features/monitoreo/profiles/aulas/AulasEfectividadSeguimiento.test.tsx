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
    expect(render(bloque({ facultades: [fac({ riesgo: "holgado" })] }))).toContain("Cuota cubierta");
    expect(render(bloque({ facultades: [fac({ riesgo: "ajustado" })] }))).toContain("Justa");
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
    expect(sinCampo).toContain("Todavía no hay cursos-horario aplicados");
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

  it("el pie dice que los alumnos se proyectan a lo que se viene respondiendo", () => {
    const html = render(bloque());
    expect(html).toContain("respondan igual que los de hasta ahora");
    // Y separa las dos columnas de alumnos, que son dos preguntas: lo que falta
    // HOY contra la tasa prevista, y lo que faltará AL CERRAR contra la cuota.
    // Que tengan signos distintos no es una contradicción.
    expect(html).toContain("Hasta ahora");
    expect(html).toContain("Al cerrar");
    expect(html).toContain("no es una contradicción");
    expect(html).toContain("compró cursos-horario de más");
  });

  it("las DOS tasas se leen como número, no sólo la observada", () => {
    // «no se sabe cuánta es la efectividad esperada y cuál es la efectividad que
    // va ahora»: lo esperado era sólo una marca en la barra. Una barra ilustra
    // una comparación, no la sustituye.
    const html = sinSeparador(render(bloque({
      facultades: [fac({ tau_previsto: 0.5, tau_observado: 0.3 })],
    })));
    expect(html).toContain("50|0 %");   // se esperaba
    expect(html).toContain("30|0 %");   // tasa observada
    expect(html).toContain("Tasa prevista");
    expect(html).toContain("Tasa observada");
  });

  it("los alumnos van en personas enteras y por el lado cauto", () => {
    // «en términos numéricos no podemos estar 3.4 alumnos por encima». Y la
    // cautela cambia de lado con el signo: lo que sobra se promete de menos, lo
    // que falta no se subestima.
    const sobra = render(bloque({ facultades: [fac({ margen_restante: 3.4 })] }));
    expect(sobra).toContain("+3");
    expect(sobra).not.toContain("3,4");
    expect(sobra).not.toContain("3.4");
    const falta = render(bloque({
      facultades: [fac({ riesgo: "riesgo", margen_restante: -22.4 })],
    }));
    expect(falta).toContain("−23");     // no −22: faltar 22,4 no se dice «faltan 22»
  });

  it("el margen de error se dice en puntos, no se dibuja sobre la barra", () => {
    const html = render(bloque({
      facultades: [fac({ tau_observado: 0.5, banda_bajo: 0.44, banda_alto: 0.56 })],
    }));
    expect(html).toContain("± 6 pts");
    expect(html).not.toContain("aulas-tau-bigote");
  });
});

describe("los dos riesgos no se dicen igual", () => {
  it("«riesgo» y «riesgo_firme» llevan palabras distintas", () => {
    // En el simulacro de campo malo conviven 11 `riesgo_firme` y 1 `riesgo`, y
    // los doce salían como «No cierra»: Artes Escénicas con 1 alumno de déficit
    // junto a Ciencias e Ingeniería con 188. `riesgo_firme` es «no cierra ni en
    // el mejor escenario del dato»; `riesgo` es «la central no cierra, la banda
    // todavía alcanza». Son decisiones distintas.
    const firme = render(bloque({ facultades: [fac({ riesgo: "riesgo_firme" })] }));
    const blando = render(bloque({ facultades: [fac({ riesgo: "riesgo" })] }));
    expect(firme).toContain("No cierra");
    expect(blando).toContain("Puede no cerrar");
    expect(blando).not.toContain(">No cierra<");
  });

  it("la escalera tiene los cuatro peldaños", () => {
    const palabras = (["holgado", "ajustado", "riesgo", "riesgo_firme"] as const)
      .map((r) => render(bloque({ facultades: [fac({ riesgo: r })] })));
    expect(palabras[0]).toContain("Cuota cubierta");
    expect(palabras[1]).toContain("Justa");
    expect(palabras[2]).toContain("Puede no cerrar");
    expect(palabras[3]).toContain("No cierra");
  });
});

describe("que el respaldo no baste se dice", () => {
  it("no lista recursos como si cubrieran cuando no cubren", () => {
    // El caso caía en `disponibles()`, que dice «49 en cadena» sin añadir que
    // activando las 49 el hueco sigue abierto. Quien lee la fila entiende lo
    // contrario de lo que pasa.
    const html = render(bloque({
      facultades: [fac({
        riesgo: "riesgo_firme", margen_restante: -300,
        reservas_alcanzan: false, reservas_libres: 40, banco_disponible: 9,
        reservas_necesarias: null, sin_cubrir: 120,
      })],
    }));
    expect(html).toContain("no alcanzan las 49 que quedan");
    expect(html).toContain("quedarían 120");
  });

  it("sin nada que activar lo dice sin inventar una cifra", () => {
    const html = render(bloque({
      facultades: [fac({
        riesgo: "riesgo_firme", margen_restante: -50,
        reservas_alcanzan: false, reservas_libres: 0, banco_disponible: 0,
        reservas_necesarias: null, sin_cubrir: 50,
      })],
    }));
    expect(html).toContain("sin respaldo que activar");
  });

  it("cuando SÍ alcanzan se conserva el texto de siempre", () => {
    const html = render(bloque({
      facultades: [fac({
        riesgo: "riesgo_firme", margen_restante: -188,
        reservas_alcanzan: true, reservas_necesarias: 14,
        reservas_libres: 64, banco_disponible: 247,
      })],
    }));
    expect(html).toContain("hacen falta 14 de 311");
  });
});

describe("la frase del veredicto concuerda", () => {
  const leer = (extra: Record<string, unknown>) => {
    const html = render(bloque({ facultades: [fac({ riesgo: "riesgo", reservas_alcanzan: true, ...extra })] }));
    return (html.match(/title="([^"]*)"/g) || []).join(" ");
  };

  it("con UNA aula y UN alumno no dice «los 1 que faltan»", () => {
    // Salía «1 aula cierra de su cadena los 1 que faltan». Nadie lo vio porque
    // la función que la produce estaba muerta; el archivo ya advertía que una
    // cifra mal concordada delata que nadie miró la fila de un solo elemento.
    const t = leer({ reservas_necesarias: 1, margen_restante: -1, reservas_de_cadena: 1, reservas_de_banco: 0 });
    expect(t).toContain("1 curso-horario de su cadena cierra el 1 que falta");
    expect(t).not.toContain("los 1 que faltan");
  });

  it("en plural mantiene el plural", () => {
    const t = leer({ reservas_necesarias: 14, margen_restante: -188, reservas_de_cadena: 14, reservas_de_banco: 0 });
    expect(t).toContain("14 cursos-horario de su cadena cierran los 188 que faltan");
  });

  it("mezclando cadena y banco, el origen va junto al sujeto", () => {
    const t = leer({ reservas_necesarias: 9, margen_restante: -40, reservas_de_cadena: 5, reservas_de_banco: 4 });
    expect(t).toContain("9 cursos-horario (5 de cadena y 4 de banco) cierran los 40 que faltan");
  });
});

describe("la columna de respaldo concuerda con su cifra", () => {
  /**
   * «hacen falta 1 de 118», visto a 1440 en ESTUDIOS GENERALES CIENCIAS.
   *
   * Es la misma reparación que `disponibles()` ya llevaba escrita en este
   * archivo —«1 libres» se leyó en pantalla, y por eso ese helper existe— y
   * esta rama se quedó fuera: una capa aprendió la regla y la de al lado no.
   * Sólo se ve en la fila en riesgo cuyas reservas alcanzan, que es además la
   * más fácil de cerrar.
   */
  const conNecesarias = (n: number) => render(bloque({
    facultades: [fac({
      riesgo: "riesgo", reservas_necesarias: n,
      reservas_libres: 118, banco_disponible: 0, reservas_alcanzan: true,
    })],
  }));

  it("con una sola reserva necesaria dice «hace falta 1»", () => {
    const html = conNecesarias(1);
    expect(html).toContain("hace falta 1 de 118");
    expect(html).not.toContain("hacen falta 1");
  });

  it("con varias mantiene el plural", () => {
    expect(conNecesarias(4)).toContain("hacen falta 4 de 118");
  });
});

/**
 * **El grano que la τ general esconde.**
 *
 * Gonzalo, 2026-09-10: «ese valor no debería estar en términos generales sino en
 * términos de sexo; a ese gráfico le falta granularidad: tiene la tasa general
 * pero también necesitamos la tasa por sexo y por facultad, y el superávit o
 * déficit de alumnos por sexo y por facultad».
 *
 * La razón de fondo es la misma que sostiene toda la brecha del ADR 0079: la
 * cuota se fija por facultad Y sexo, y un hombre de más no cubre a una mujer que
 * falta. Una facultad puede ir conforme en su τ y estar corta en una celda.
 */
describe("las dos celdas de sexo de cada facultad", () => {
  const celdas = [
    { faculty_key: "derecho", sexo: "F" as const, elegibles: 70, esperadas: 35,
      efectivas: 23, tasa_prevista: 0.5, tasa_observada: 0.3286, diferencia: -12 },
    { faculty_key: "derecho", sexo: "M" as const, elegibles: 30, esperadas: 15,
      efectivas: 18, tasa_prevista: 0.5, tasa_observada: 0.6, diferencia: 3 },
  ];

  it("enseña la observada sobre la prevista y la diferencia en personas", () => {
    const html = renderToStaticMarkup(
      <AulasEfectividadSeguimiento bloque={bloque()} porSexo={celdas} />,
    );
    expect(html).toContain("Mujeres");
    expect(html).toContain("Hombres");
    // La observada es de cada celda; la prevista, la de la FILA.
    expect(html).toContain("32.9 %");
    expect(html).toContain("60.0 %");
  });

  /**
   * **Las dos celdas tienen que sumar lo que dice «Hasta ahora».**
   *
   * Gonzalo, sobre Artes Escénicas: «¿por qué las mujeres salen como menos 1 y
   * hombres menos 2, pero en "hasta ahora" sale que faltan 10?». No sumaban
   * porque el total usaba la τ que el DISEÑO le puso a la facultad y cada celda
   * la que el libro reparte por composición del aula: dos previstos para el
   * mismo hecho. Con la τ de la fila aplicada a los elegibles de cada sexo,
   * suman por construcción.
   */
  it("las dos celdas suman la diferencia de la fila", () => {
    const tau = 0.5;
    const filaConTau = { ...bloque().facultades[0], tau_previsto: tau };
    const b = { ...bloque(), facultades: [filaConTau] } as MonitoreoAulasEfectividadSeguimiento;
    // 70 elegibles de mujeres y 30 de hombres = los 100 de la fila.
    const dos = [
      { ...celdas[0], elegibles: 70, efectivas: 28 },
      { ...celdas[1], elegibles: 30, efectivas: 20 },
    ];
    const html = renderToStaticMarkup(<AulasEfectividadSeguimiento bloque={b} porSexo={dos} />);
    // Mujeres: 28 − 0,5×70 = −7. Hombres: 20 − 0,5×30 = +5. Suma: −2.
    expect(html).toContain("−7");
    expect(html).toContain("+5");
    // Y ese −2 es exactamente lo que sale de aplicar la misma τ al total:
    // 48 − 0,5×100 = −2.
    expect((28 - tau * 70) + (20 - tau * 30)).toBe(48 - tau * 100);
  });

  it("sin el bloque por sexo la tabla se pinta igual que antes", () => {
    const html = renderToStaticMarkup(<AulasEfectividadSeguimiento bloque={bloque()} />);
    expect(html).not.toContain("Mujeres");
    expect(html).toContain("Tasa prevista");
  });

  it("una celda sin elegibles no se dibuja: no hay tasa que enseñar", () => {
    const html = renderToStaticMarkup(
      <AulasEfectividadSeguimiento
        bloque={bloque()}
        porSexo={[{ ...celdas[0], elegibles: 0 }, celdas[1]]}
      />,
    );
    expect(html).not.toContain("Mujeres");
    expect(html).toContain("Hombres");
  });
});

/**
 * **Una tasa por encima del 100 % es un hecho, no un error de cuenta.**
 *
 * Visto el 2026-09-10 en ARTE Y DISEÑO: 19 respuestas de hombres sobre 16
 * hombres elegibles. Las cifras cuadran con la fila general —76 + 16 = 92
 * elegibles y 65 + 19 = 84 efectivas—, así que la partición es correcta y lo
 * que no encaja es el padrón del aula con quien acabó respondiendo.
 */
describe("cuando llegan más respuestas de un sexo que elegibles", () => {
  const conImposible = [
    { faculty_key: "derecho", sexo: "M" as const, elegibles: 16, esperadas: 10,
      efectivas: 19, tasa_prevista: 0.6257, tasa_observada: 1.1875, diferencia: 9 },
  ];

  it("la cifra se publica tal cual, sin capar al 100 %", () => {
    const html = renderToStaticMarkup(
      <AulasEfectividadSeguimiento bloque={bloque()} porSexo={conImposible} />,
    );
    // Capar borraría justo la señal: un marco desfasado o un sexo declarado
    // distinto al del registro.
    expect(html).toContain("118.8 %");
    expect(html).not.toContain("100.0 %");
  });

  it("y se marca con la explicación de qué no encaja", () => {
    const html = renderToStaticMarkup(
      <AulasEfectividadSeguimiento bloque={bloque()} porSexo={conImposible} />,
    );
    expect(html).toContain("es-imposible");
    expect(html).toContain("el padrón del aula declara");
  });

  it("una tasa normal no lleva marca", () => {
    const normal = [{ ...conImposible[0], efectivas: 8, tasa_observada: 0.5 }];
    const html = renderToStaticMarkup(
      <AulasEfectividadSeguimiento bloque={bloque()} porSexo={normal} />,
    );
    expect(html).not.toContain("es-imposible");
  });
});
