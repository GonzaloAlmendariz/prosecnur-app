/**
 * Gate 2 del ADR 0067 · paridad de cifras: cada número publicado por el modelo
 * coincide con el derivable de las filas persistidas de la corrida — el mismo
 * `selection_run_id` que Sustento y Titulares. Incluye la historia paso a paso
 * exacta con `discount_step` y el hueco declarado (no inventado) sin él.
 */
import { describe, expect, it } from "vitest";
import type { CalcMuestraAulasSelection } from "../../../../../../api/client";
import { vecinasMasCercanas } from "../escenas/goo";
import {
  RELATO_BOLAS_MAX,
  construirRelato,
  facultadesDelSorteo,
  focoDeFacultad,
  resolverFocoRelato,
  serieDeConvergencia,
  type RelatoEscenaCierre,
  type RelatoEscenaEstratos,
  type RelatoEscenaMarco,
  type RelatoEscenaProbabilidades,
  type RelatoEscenaSorteo,
  type RelatoEscenaTitulares,
} from "../relatoModel";
import {
  BOMBO_FRAME_ROWS,
  ESTRATOS_CALCULO,
  FRAME_SINTETICO,
  SELECTOR_FIELDS,
  bomboGrande,
  filaTitular,
  filasSeleccion,
  seleccionPostHoc,
  seleccionSinOrdenDeSorteo,
  seleccionSintetica,
} from "./relatoFixture";

function relatoCompleto(
  foco: string | null = null,
  frameRows: Array<Record<string, unknown>> = BOMBO_FRAME_ROWS,
) {
  const relato = construirRelato({
    selection: seleccionSintetica(),
    selectionRows: filasSeleccion(),
    frame: FRAME_SINTETICO,
    frameRows,
    estratosCalculo: ESTRATOS_CALCULO,
    selectorFields: SELECTOR_FIELDS,
    foco,
  });
  if (!relato) throw new Error("el fixture con titulares debe producir relato");
  return relato;
}

describe("construirRelato — orden y firma", () => {
  it("publica las seis escenas en el orden del motor (ADR 0058)", () => {
    const relato = relatoCompleto();
    expect(relato.escenas.map((escena) => escena.id)).toEqual([
      "marco",
      "estratos",
      "probabilidades",
      "sorteo",
      "titulares",
      "cierre",
    ]);
    expect(relato.runId).toBe("run-777");
    expect(relato.semilla).toBe("20260619");
  });

  it("sin selección persistida no hay relato: el vacío lo gobierna la etapa", () => {
    expect(
      construirRelato({
        selection: null,
        selectionRows: [],
        frame: FRAME_SINTETICO,
        frameRows: BOMBO_FRAME_ROWS,
        estratosCalculo: ESTRATOS_CALCULO,
        selectorFields: SELECTOR_FIELDS,
        foco: null,
      }),
    ).toBeNull();
  });
});

describe("E1 · el marco", () => {
  it("usa los números auditados del frame y los elegibles por facultad del cálculo", () => {
    const escena = relatoCompleto().escenas[0] as RelatoEscenaMarco;
    expect(escena.filasArchivo).toBe(29090);
    expect(escena.elegibles).toBe(21000);
    expect(escena.cursosHorario).toBe(890);
    expect(escena.porFacultad).toEqual([
      { facultad: "CIENCIAS E INGENIERIA", elegibles: 5200, enFoco: false },
      { facultad: "DERECHO", elegibles: 3100, enFoco: false },
    ]);
    expect(escena.huecos).toEqual([]);
  });
});

describe("E2 · estratos y cuotas", () => {
  it("agrega las filas M1 por estrato contra su stratum_eligible_n publicado", () => {
    const escena = relatoCompleto().escenas[1] as RelatoEscenaEstratos;
    expect(escena.cuotaTotal).toBe(2);
    expect(escena.variablesEstrato).toEqual(SELECTOR_FIELDS);
    expect(escena.estratos).toEqual([
      {
        estrato: "CIENCIAS E INGENIERIA · Mujer · G2",
        facultad: "CIENCIAS E INGENIERIA",
        cuota: 1,
        elegiblesEstrato: 120,
      },
      {
        estrato: "DERECHO · Hombre · G1",
        facultad: "DERECHO",
        cuota: 1,
        elegiblesEstrato: 60,
      },
    ]);
  });
});

describe("E3 · las probabilidades", () => {
  it("publica la π del sorteo ejecutado y declara la certeza como «sin sorteo»", () => {
    const escena = relatoCompleto().escenas[2] as RelatoEscenaProbabilidades;
    expect(escena.certezas).toBe(1);
    const porCode = new Map(escena.aulas.map((aula) => [aula.code, aula]));
    // La bola publica la π del sorteo ejecutado (`pi_final`, ADR 0066); las π
    // de diseño/MC referenciales siguen viviendo en Sustento, no en el goo.
    expect(porCode.get("CH 1")).toMatchObject({
      pi: 0.25,
      elegibles: 40,
      certeza: false,
    });
    expect(porCode.get("CH 2")).toMatchObject({ pi: 1, certeza: true });
    expect(escena.porFacultad).toEqual([
      { facultad: "CIENCIAS E INGENIERIA", aulas: 1, certezas: 0, piMin: 0.25, piMax: 0.25 },
      { facultad: "DERECHO", aulas: 1, certezas: 1, piMin: 1, piMax: 1 },
    ]);
    expect(escena.huecos).toEqual([]);
  });

  // Metáfora goo (dirección 2026-08-07): cada bola es un curso-horario real y
  // su tamaño son sus elegibles publicados — nunca un tamaño inventado.
  it("el bombo son las candidatas reales de aula_frame, ordenadas por tamaño publicado", () => {
    const escena = relatoCompleto().escenas[2] as RelatoEscenaProbabilidades;
    expect(escena.bomboConocido).toBe(true);
    expect(escena.masa).toEqual([]);
    expect(escena.bolas.map((bola) => `${bola.code}:${bola.elegibles}:${bola.seleccionada ? "sorteada" : "candidata"}`)).toEqual([
      "CH 1:40:sorteada",
      "CH-C:33:candidata",
      "CH 2:18:sorteada",
      "CH-D:12:candidata",
    ]);
    // Las candidatas no sorteadas no llevan π: la corrida no la publicó.
    expect(escena.bolas.find((bola) => bola.code === "CH-C")?.pi).toBeNull();
  });

  it("sin aula_frame NO fabrica bolas: sorteadas reales + masa auditada rotulada", () => {
    const escena = relatoCompleto(null, []).escenas[2] as RelatoEscenaProbabilidades;
    expect(escena.bomboConocido).toBe(false);
    expect(escena.bolas.every((bola) => bola.seleccionada)).toBe(true);
    expect(escena.bolas).toHaveLength(2);
    // 890 cursos-horario auditados − 2 sorteados: un hecho, no una invención.
    expect(escena.masa).toEqual([
      { facultad: "", aulas: 888, elegibles: null, sorteadas: 0 },
    ]);
    expect(escena.huecos.join(" ")).toContain("no conserva el bombo curso a curso");
  });

  it("una muestra mayor que el cap no desborda el bombo y declara las que faltan", () => {
    // El defecto que encontró el QA con el estudio real: el cap se aplicaba
    // solo a las candidatas y las sorteadas se concatenaban aparte, así que con
    // 196 titulares entraban 196 bolas en un viewBox de 0–100 —ilegibles—
    // aunque el cap declarado fuera 60. A n=30 no se ve nunca.
    const titulares = Array.from({ length: RELATO_BOLAS_MAX + 40 }, (_, i) =>
      filaTitular({
        classroom_id: `CH-${i}`,
        operational_code: `CH ${i}`,
        // Tamaño decreciente: fija qué bolas sobreviven al recorte.
        eligible_n: 500 - i,
        selection_slot_id: `slot-${i}`,
      }),
    );
    const relato = construirRelato({
      selection: seleccionSintetica(),
      selectionRows: titulares,
      frame: FRAME_SINTETICO,
      frameRows: BOMBO_FRAME_ROWS,
      estratosCalculo: ESTRATOS_CALCULO,
      selectorFields: SELECTOR_FIELDS,
      foco: null,
    });
    const escena = relato!.escenas[2] as RelatoEscenaProbabilidades;

    expect(escena.bolas.length).toBeLessThanOrEqual(RELATO_BOLAS_MAX);
    // Sobreviven las de mayor tamaño publicado, y son todas sorteadas: con la
    // muestra por encima del cap no queda cupo para candidatas.
    expect(escena.bolas.every((bola) => bola.seleccionada)).toBe(true);
    expect(escena.bolas[0]!.elegibles).toBe(500);

    // Y las 40 que no caben se declaran, diciendo que eran sorteadas: callarlo
    // haría creer que la muestra es del tamaño de lo que se ve.
    const sorteadasEnMasa = escena.masa.reduce((suma, item) => suma + item.sorteadas, 0);
    expect(sorteadasEnMasa).toBe(40);
    expect(escena.bolas.length + sorteadasEnMasa).toBe(titulares.length);
  });

  it("respeta el cap de bolas y agrega el resto como masa con sus elegibles sumados", () => {
    const escena = relatoCompleto(null, [...BOMBO_FRAME_ROWS, ...bomboGrande(70)])
      .escenas[2] as RelatoEscenaProbabilidades;
    expect(escena.bolas).toHaveLength(60);
    // 2 sorteadas + 72 candidatas − 58 visibles = 14 en la masa; las candidatas
    // grandes entran como bola, así que la masa junta a las más chicas.
    const masaTotal = escena.masa.reduce((total, item) => total + item.aulas, 0);
    expect(masaTotal).toBe(14);
    // Suma EXACTA de los eligible_n publicados de las aulas agregadas: las 13
    // candidatas más chicas del bombo grande (20..32) + CH-D (12) = 350.
    const elegiblesMasa = escena.masa.reduce((total, item) => total + (item.elegibles ?? 0), 0);
    expect(elegiblesMasa).toBe(350);
    expect(escena.bolas.length + masaTotal).toBe(74);
  });
});

describe("E4 · el sorteo", () => {
  it("con descuento secuencial la historia es EXACTA y el encogimiento son los netos", () => {
    const escena = relatoCompleto().escenas[3] as RelatoEscenaSorteo;
    expect(escena.modo).toBe("pasos");
    expect(escena.descuento).toBe("sequential");
    // Dirección goo: el encogimiento ES el dato — solo existe porque la
    // corrida publicó eligible_n_neto paso a paso.
    expect(escena.encoge).toBe(true);
    // El orden es el persistido (discount_step 1 → CH 2, 2 → CH 1), no el de
    // las filas ni uno estético; la certeza (π = 1) se ensambla rotulada.
    expect(escena.pasos).toEqual([
      {
        paso: 1,
        code: "CH 2",
        etiqueta: "Derecho Romano · M 10-12",
        facultad: "DERECHO",
        estrato: "DERECHO · Hombre · G1",
        bruto: 18,
        yaCubiertos: 0,
        neto: 18,
        certeza: true,
      },
      {
        paso: 2,
        code: "CH 1",
        etiqueta: "Cálculo 1 · L 8-10",
        facultad: "CIENCIAS E INGENIERIA",
        estrato: "CIENCIAS E INGENIERIA · Mujer · G2",
        bruto: 40,
        yaCubiertos: 5,
        neto: 35,
        certeza: false,
      },
    ]);
    expect(escena.ajustesTamano).toEqual([
      "Ajuste de tamaño divulgado: un estrato pidió más cursos-horario que sus elegibles.",
    ]);
    expect(escena.huecos).toEqual([]);
  });

  it("los tirantes atan cada bola a sus DOS vecinas más cercanas del layout", () => {
    // Topología determinista de la red (spec World of Goo destilada): la
    // paridad del tirante es solo geometría del layout YA calculado —
    // distancia euclidiana con desempate por índice, jamás un sorteo.
    const posiciones = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 0, y: 10 },
      { x: 20, y: 20 },
      { x: 6, y: 2 },
    ];
    expect(vecinasMasCercanas(4, posiciones)).toEqual([1, 0]);
    expect(vecinasMasCercanas(1, posiciones)).toEqual([0]);
    expect(vecinasMasCercanas(0, posiciones)).toEqual([]);
    // Empate exacto: gana el índice menor (determinismo, no azar).
    expect(
      vecinasMasCercanas(2, [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 2, y: 0 }]),
    ).toEqual([0, 1]);
  });

  it("el orden de aterrizaje del ensamblaje es EXACTAMENTE el orden publicado", () => {
    // Polish 2026-08-07: la bola k aterriza en la posición k del cluster; el
    // componente recorre `pasos` por índice, así que este array ES el orden de
    // aterrizaje. discount_step 1 → CH 2 primero, 2 → CH 1 después.
    const escena = relatoCompleto().escenas[3] as RelatoEscenaSorteo;
    expect(escena.pasos.map((paso) => `${paso.paso}:${paso.code}`)).toEqual([
      "1:CH 2",
      "2:CH 1",
    ]);
  });

  it("en post-hoc NO encoge (en la realidad no encogió): el traslape se anota", () => {
    // Dirección goo 2026-08-07: el default cube descuenta como auditoría
    // posterior; encoger sus bolas mostraría un sorteo que no ocurrió.
    const seleccion = seleccionPostHoc();
    const relato = construirRelato({
      selection: seleccion,
      selectionRows: seleccion.selection as Array<Record<string, unknown>>,
      frame: FRAME_SINTETICO,
      frameRows: BOMBO_FRAME_ROWS,
      estratosCalculo: ESTRATOS_CALCULO,
      selectorFields: SELECTOR_FIELDS,
      foco: null,
    });
    const escena = relato?.escenas[3] as RelatoEscenaSorteo;
    expect(escena.modo).toBe("pasos");
    expect(escena.descuento).toBe("post_hoc");
    expect(escena.encoge).toBe(false);
    // Los ya_cubiertos siguen publicados: son la anotación del ensamblaje.
    expect(escena.pasos.map((paso) => paso.yaCubiertos)).toEqual([0, 5]);
  });

  it("sin discount_step declara el hueco y agrega por estrato, sin inventar orden", () => {
    const seleccion = seleccionSinOrdenDeSorteo();
    const relato = construirRelato({
      selection: seleccion,
      selectionRows: seleccion.selection as Array<Record<string, unknown>>,
      frame: FRAME_SINTETICO,
      frameRows: BOMBO_FRAME_ROWS,
      estratosCalculo: ESTRATOS_CALCULO,
      selectorFields: SELECTOR_FIELDS,
      foco: null,
    });
    const escena = relato?.escenas[3] as RelatoEscenaSorteo;
    expect(escena.modo).toBe("agregado");
    expect(escena.pasos).toEqual([]);
    expect(escena.porEstrato.map((item) => `${item.estrato}:${item.cuota}`)).toEqual([
      "CIENCIAS E INGENIERIA · Mujer · G2:1",
      "DERECHO · Hombre · G1:1",
    ]);
    expect(escena.huecos.join(" ")).toContain("no registró el orden del sorteo");
    expect(relato?.huecosDeclarados.join(" ")).toContain("no registró el orden del sorteo");
  });
});

describe("E4 · el ensamblaje balanceado (iteración cube, dirección 2026-08-07)", () => {
  // Coreografía propia por método, empezando por cube: la escena muestra QUÉ
  // significa balancear — el perfil de la muestra convergiendo al del marco en
  // las variables que la corrida DECLARÓ. Los tests fijan la regla de verdad:
  // barras = conteos de filas publicadas; la cifra oficial es la de R.
  function escenaCube(over: Partial<CalcMuestraAulasSelection> = {}) {
    const seleccion = { ...seleccionPostHoc(), ...over };
    const relato = construirRelato({
      selection: seleccion,
      selectionRows: seleccion.selection as Array<Record<string, unknown>>,
      frame: FRAME_SINTETICO,
      frameRows: BOMBO_FRAME_ROWS,
      estratosCalculo: ESTRATOS_CALCULO,
      selectorFields: SELECTOR_FIELDS,
      foco: null,
    });
    return relato?.escenas[3] as RelatoEscenaSorteo;
  }

  it("gana su escena propia y declara el sorteo simultáneo", () => {
    const escena = escenaCube();
    expect(escena.titulo).toBe("El ensamblaje balanceado");
    // Cube resuelve de una vez: fingir secuencia sería un sorteo que no ocurrió.
    expect(escena.balance?.notaOrden).toContain("simultáneo");
    expect(escena.balance?.notaOrden).toContain("de lectura, no del sorteo");
  });

  it("las barras son composición EXACTA por conteo de filas publicadas", () => {
    const balance = escenaCube().balance;
    // El eco del selector viaja en la selección; se lee, no se asume.
    expect(balance?.declaradas).toEqual(["faculty", "size_group", "schedule"]);
    // schedule está declarada pero sin columna publicada: se declara, no se dibuja.
    expect(balance?.variables.map((item) => item.variable)).toEqual(["faculty", "size_group"]);
    expect(balance?.huecos.join(" ")).toContain("schedule");

    const facultad = balance?.variables[0];
    // Marco = candidatas de aula_frame (2/2); muestra = titulares M1 (1/1).
    expect(facultad?.categorias).toEqual([
      { categoria: "CIENCIAS E INGENIERIA", marcoN: 2, marcoPct: 0.5, muestraN: 1, muestraPct: 0.5 },
      { categoria: "DERECHO", marcoN: 2, marcoPct: 0.5, muestraN: 1, muestraPct: 0.5 },
    ]);
    const tamano = balance?.variables[1];
    expect(tamano?.categorias).toEqual([
      { categoria: "G1", marcoN: 2, marcoPct: 0.5, muestraN: 1, muestraPct: 0.5 },
      { categoria: "G2", marcoN: 1, marcoPct: 0.25, muestraN: 0, muestraPct: 0 },
      { categoria: "G3", marcoN: 1, marcoPct: 0.25, muestraN: 1, muestraPct: 0.5 },
    ]);
  });

  it("expone la métrica de R tal cual, sin recalcular nada en el cliente", () => {
    const balance = escenaCube().balance;
    // Regla I20: nada de Horvitz-Thompson ni ponderación por π aquí — la
    // cifra acreditada de parecido es la publicada por el motor.
    expect(balance?.score).toBe(87.4);
    expect(balance?.distancia).toBe(0.062);
  });

  it("la serie de convergencia es determinista y sigue el orden publicado", () => {
    const facultad = escenaCube().balance?.variables[0];
    expect(facultad?.porBola).toEqual(["CIENCIAS E INGENIERIA", "DERECHO"]);
    expect(serieDeConvergencia(facultad!)).toEqual([
      { "CIENCIAS E INGENIERIA": 1 },
      { "CIENCIAS E INGENIERIA": 1, DERECHO: 1 },
    ]);
  });

  it("local pivotal añade la dispersión como procedencia declarativa, sin métricas propias", () => {
    const escena = escenaCube({
      selector_engine: "local_pivotal_balanceado",
      selector_engine_used: "local_pivotal_balanceado",
    });
    expect(escena.balance?.dispersion).toEqual(["program", "level"]);
    // El motor no publica métrica por par: hueco declarado, no derivado.
    expect(escena.balance?.huecos.join(" ")).toContain("no publica métrica por par");
  });

  it("sin eco de balance_vars el hueco se declara, no se asume el default", () => {
    const escena = escenaCube({ selector: {} });
    expect(escena.balance?.variables).toEqual([]);
    expect(escena.balance?.huecos.join(" ")).toContain("selector.balance_vars");
  });

  it("la coreografía secuencial y la de pool quedan intactas (balance null)", () => {
    const escena = relatoCompleto().escenas[3] as RelatoEscenaSorteo;
    expect(escena.balance).toBeNull();
    expect(escena.titulo).toBe("El sorteo");
  });
});

describe("E5 · titulares y cadenas", () => {
  it("cuenta M1, reservas M2+ y bolsa extra con la profundidad publicada", () => {
    const escena = relatoCompleto().escenas[4] as RelatoEscenaTitulares;
    expect(escena.titulares).toBe(2);
    expect(escena.reservas).toBe(1);
    expect(escena.extras).toBe(1);
    expect(escena.porFacultad).toEqual([
      {
        facultad: "CIENCIAS E INGENIERIA",
        titulares: 1,
        reservas: 0,
        extras: 0,
        profundidadMax: 2,
      },
      { facultad: "DERECHO", titulares: 1, reservas: 1, extras: 1, profundidadMax: 3 },
    ]);
    expect(escena.estadosActivacion).toEqual([{ estado: "condicional", reservas: 1 }]);
  });

  it("cuelga cada cadena de su slot titular en el orden publicado", () => {
    // Dirección goo: la segunda pasada (olas M2+) se ensambla como cadena
    // colgante ligada por selection_slot_id, no por posición visual.
    const escena = relatoCompleto().escenas[4] as RelatoEscenaTitulares;
    expect(escena.slotsOcultos).toBe(0);
    expect(escena.slots).toEqual([
      {
        slot: "slot-1",
        titularCode: "CH 1",
        facultad: "CIENCIAS E INGENIERIA",
        elegibles: 40,
        reservas: [],
      },
      {
        slot: "slot-2",
        titularCode: "CH 2",
        facultad: "DERECHO",
        elegibles: 18,
        reservas: [{ code: "R 2.1", orden: 1, estado: "condicional" }],
      },
    ]);
  });
});

describe("E6 · el cierre", () => {
  it("firma con selection_run_id + semilla y muestra el peso 1/π publicado", () => {
    const escena = relatoCompleto().escenas[5] as RelatoEscenaCierre;
    expect(escena.runId).toBe("run-777");
    expect(escena.semilla).toBe("20260619");
    expect(escena.motor).toBe("sistematico_pps");
    expect(escena.frameHash).toBe("hash-abc");
    // El peso viene publicado en la fila (weight_classroom), no se calcula aquí.
    expect(escena.pesoEjemplo).toEqual({ code: "CH 1", pi: 0.25, peso: 4 });
    expect(escena.advertencias).toHaveLength(1);
  });
});

describe("el lente por facultad (foco)", () => {
  it("resuelve el slug canónico contra las facultades reales del sorteo", () => {
    const facultades = facultadesDelSorteo(filasSeleccion());
    expect(facultades).toEqual(["CIENCIAS E INGENIERIA", "DERECHO"]);
    expect(focoDeFacultad("CIENCIAS E INGENIERÍA")).toBe("ciencias-e-ingenieria");
    expect(resolverFocoRelato("derecho", facultades)).toBe("DERECHO");
    expect(resolverFocoRelato("DERECHO", facultades)).toBe("DERECHO");
  });

  it("filtra las escenas del sorteo a la facultad y conserva el paso ORIGINAL", () => {
    const relato = relatoCompleto("derecho");
    expect(relato.foco).toBe("DERECHO");
    const estratos = relato.escenas[1] as RelatoEscenaEstratos;
    expect(estratos.estratos.map((item) => item.facultad)).toEqual(["DERECHO"]);
    const sorteo = relato.escenas[3] as RelatoEscenaSorteo;
    expect(sorteo.pasos).toHaveLength(1);
    expect(sorteo.pasos[0].paso).toBe(1);
    const marco = relato.escenas[0] as RelatoEscenaMarco;
    expect(marco.porFacultad.find((item) => item.facultad === "DERECHO")?.enFoco).toBe(true);
  });

  it("un foco que no nombra ninguna facultad cae al estudio completo, no rompe", () => {
    const relato = relatoCompleto("facultad-inexistente");
    expect(relato.foco).toBeNull();
    expect((relato.escenas[4] as RelatoEscenaTitulares).titulares).toBe(2);
  });
});

describe("E4 · la cadena y su campo (dirección 2026-08-08)", () => {
  it("cada paso lleva su estrato, que es por donde se encadena", () => {
    const escena = relatoCompleto().escenas[3] as RelatoEscenaSorteo;
    // `discount_step` reinicia en cada estrato, así que el paso sin su estrato
    // no alcanza para encadenar: 1 y 1 de estratos distintos no son sucesivos.
    expect(escena.pasos.map((paso) => paso.estrato)).toEqual([
      "DERECHO · Hombre · G1",
      "CIENCIAS E INGENIERIA · Mujer · G2",
    ]);
  });

  it("el campo trae las candidatas NO sorteadas, para que la cadena no flote", () => {
    const escena = relatoCompleto().escenas[3] as RelatoEscenaSorteo;
    // Las sorteadas ya viajan como pasos; el campo es el resto del marco.
    expect(escena.campo.map((bola) => bola.code)).toEqual(["CH-C", "CH-D"]);
    expect(escena.campo.every((bola) => !bola.seleccionada)).toBe(true);
  });

  it("el campo respeta el cupo que deja la cadena", () => {
    // El cap es compartido: si la muestra ya lo llena, no queda fondo — y es
    // correcto, porque la cadena es la historia. Con 60 pasos el campo va
    // vacío aunque el marco tenga candidatas de sobra.
    const titulares = Array.from({ length: RELATO_BOLAS_MAX }, (_, i) =>
      filaTitular({
        classroom_id: `CH-${i}`,
        operational_code: `CH ${i}`,
        eligible_n: 500 - i,
        discount_step: i + 1,
        selection_slot_id: `slot-${i}`,
      }),
    );
    const relato = construirRelato({
      selection: seleccionSintetica(),
      selectionRows: titulares,
      frame: FRAME_SINTETICO,
      frameRows: bomboGrande(200),
      estratosCalculo: ESTRATOS_CALCULO,
      selectorFields: SELECTOR_FIELDS,
      foco: null,
    });
    const escena = relato!.escenas[3] as RelatoEscenaSorteo;
    expect(escena.pasos.length).toBe(RELATO_BOLAS_MAX);
    expect(escena.campo).toEqual([]);
  });

  it("sin marco en memoria el campo va vacío en vez de inventarse", () => {
    const escena = relatoCompleto(null, []).escenas[3] as RelatoEscenaSorteo;
    expect(escena.campo).toEqual([]);
    expect(escena.pasos.length).toBeGreaterThan(0);
  });
});
