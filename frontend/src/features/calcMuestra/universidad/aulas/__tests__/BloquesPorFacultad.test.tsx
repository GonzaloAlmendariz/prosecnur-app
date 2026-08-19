/**
 * Los tres bloques que R derivaba y nadie pintaba: margen de aulas por facultad,
 * balance de sexo por facultad y el aviso de decisión sin firmar.
 *
 * Cada uno tiene su test de componente Y su test de MONTAJE. El montaje no es
 * redundante: con la tarjeta de salud desmontada, los 1.413 tests de calcMuestra
 * seguían en verde. Un test del componente suelto no protege que alguien lo
 * pinte.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  normalizeCalcMuestraSexoPorFacultad,
  type CalcMuestraAulasEstrato,
  type CalcMuestraComponente,
} from "../../../../../api/client";
import { CalculoCursosHorarioFacultadTab } from "../../calculo/CalculoCursosHorarioFacultadTab";
import { SinDecisionAlumnosChAviso } from "../../calculo/SinDecisionAlumnosChAviso";
import { AulasSeleccionTab } from "../AulasSeleccionTab";
import { MargenPorFacultadCard } from "../MargenPorFacultadCard";
import { DocenteUnicoAviso } from "../DocenteUnicoAviso";
import { SexoPorFacultadCard } from "../SexoPorFacultadCard";

/** Cifras reales del proyecto: Letras y C. Humanas requiere 16 y tiene 16. */
const FILAS = [
  {
    estrato: "LETRAS Y CIENCIAS HUMANAS", N: 225, cuota: 26, avg_conglomerado: 16,
    tau: 0.53, aulas_base: 16, aulas_reemplazo: 0, aulas_total: 16, tipo_aula: "G1",
    precision_e: null,
    margen: {
      aulas_disponibles: 16, aulas_requeridas: 16, aulas_sobrantes: 0,
      reservas_sostenibles: 0, reservas_pedidas: 11, estado: "sin_reservas",
      aviso: "LETRAS Y CIENCIAS HUMANAS necesita 16 de sus 16 aulas: todas son titulares y no queda ninguna para reemplazar a la que se caiga en campo.",
    },
  },
  {
    estrato: "CIENCIAS E INGENIERIA", N: 4512, cuota: 530, avg_conglomerado: 32,
    tau: 0.53, aulas_base: 49, aulas_reemplazo: 0, aulas_total: 49, tipo_aula: "G3",
    precision_e: null,
    margen: {
      aulas_disponibles: 592, aulas_requeridas: 49, aulas_sobrantes: 543,
      reservas_sostenibles: 11, reservas_pedidas: 11, estado: "holgado", aviso: "",
    },
  },
] as unknown as CalcMuestraAulasEstrato[];

const SEXO_CRUDO = {
  schema: "calc_muestra_aulas_sexo_por_facultad_v1",
  base: "titulares",
  tolerancia: 0.025,
  filas: [
    {
      faculty_key: "arte_y_diseno", facultad: "ARTE Y DISEÑO", aulas_titulares: 2,
      marco_prop_mujeres: 0.76, titulares_prop_mujeres: 0.62, brecha_pp: -14.3,
      estado: "medido",
      aviso: "ARTE Y DISEÑO: sus 2 aulas titulares ofrecen 62% de mujeres y la cuota de esta facultad pide 76% — 14 puntos por debajo.",
    },
    {
      faculty_key: "derecho", facultad: "DERECHO", aulas_titulares: 4,
      marco_prop_mujeres: 0.65, titulares_prop_mujeres: 0.65, brecha_pp: 0.2,
      estado: "medido", aviso: "",
    },
  ],
};

describe("margen de aulas por facultad", () => {
  it("dice cuántas tiene contra cuántas necesita, y cuántas reservas sostiene", () => {
    const html = renderToStaticMarkup(<MargenPorFacultadCard filas={FILAS} />);
    expect(html).toContain("LETRAS Y CIENCIAS HUMANAS");
    expect(html).toContain("todas son titulares");
    expect(html).toContain("no queda ninguna para reemplazar");
    // La cifra que lo justifica, no sólo el estado.
    // Gonzalo: «nunca ha habido un requerimiento de 11 reservas a más». El
    // techo de la cadena se declara como capacidad, jamás como meta.
    expect(html).toContain("admite hasta 11 posiciones por titular; no es una meta");
    expect(html).not.toContain("El diseño pide");
  });

  it("pone primero la facultad sin margen, no la holgada", () => {
    const html = renderToStaticMarkup(<MargenPorFacultadCard filas={FILAS} />);
    expect(html.indexOf("LETRAS Y CIENCIAS HUMANAS")).toBeLessThan(
      html.indexOf("CIENCIAS E INGENIERIA"),
    );
  });

  it("CONTROL: sin bloque `margen` no dibuja nada", () => {
    const sinMargen = [{ ...FILAS[0], margen: undefined }] as unknown as CalcMuestraAulasEstrato[];
    expect(renderToStaticMarkup(<MargenPorFacultadCard filas={sinMargen} />)).toBe("");
    expect(renderToStaticMarkup(<MargenPorFacultadCard filas={null} />)).toBe("");
  });
});

describe("balance de sexo por facultad", () => {
  it("enfrenta lo que la cuota pide con lo que las aulas ofrecen", () => {
    const html = renderToStaticMarkup(
      <SexoPorFacultadCard balance={normalizeCalcMuestraSexoPorFacultad(SEXO_CRUDO)} />,
    );
    expect(html).toContain("ARTE Y DISEÑO");
    expect(html).toContain("76 %");
    expect(html).toContain("62 %");
    expect(html).toContain("-14.3 pp");
    // Dice sobre qué se midió: contar las reservas daría una composición que
    // nadie va a encuestar.
    expect(html).toContain("aulas titulares");
  });

  it("sólo marca la fila que tiene aviso", () => {
    const html = renderToStaticMarkup(
      <SexoPorFacultadCard balance={normalizeCalcMuestraSexoPorFacultad(SEXO_CRUDO)} />,
    );
    expect(html).toContain('data-aviso="true"');
    expect(html).toContain('data-aviso="false"');
    expect(html).toContain("1</strong> de 2 se");
  });

  it("el normalizador descarta una fila sin facultad y no inventa el bloque", () => {
    expect(normalizeCalcMuestraSexoPorFacultad({ filas: [{ brecha_pp: 3 }] })).toBeNull();
    expect(normalizeCalcMuestraSexoPorFacultad(null)).toBeNull();
  });
});

describe("aviso de decisión de alumnos por CH sin firmar", () => {
  const conSinDecision = [
    { ...FILAS[0], alumnos_por_ch: { estado: "sin_decision", referencia: "promedio_global", aviso: "Las aulas de esta facultad se calcularon con el promedio global." } },
  ] as unknown as CalcMuestraAulasEstrato[];

  it("dice cuántas facultades salieron del promedio global y dónde firmar", () => {
    const html = renderToStaticMarkup(<SinDecisionAlumnosChAviso filas={conSinDecision} />);
    expect(html).toContain("promedio global");
    expect(html).toContain("Alumnos por CH");
  });

  it("CONTROL: con la decisión firmada no aparece", () => {
    expect(renderToStaticMarkup(<SinDecisionAlumnosChAviso filas={FILAS} />)).toBe("");
    expect(renderToStaticMarkup(<SinDecisionAlumnosChAviso filas={null} />)).toBe("");
  });
});

describe("montaje: el aviso vive en la pestaña de Cálculo", () => {
  // Un test del componente suelto no protege que alguien lo pinte.
  function tab(filas: unknown): string {
    const comp = {
      id: "c1", label: "Universidad",
      resultado: { aulas_por_estrato: filas },
    } as unknown as CalcMuestraComponente;
    return renderToStaticMarkup(
      <CalculoCursosHorarioFacultadTab
        componentes={[comp, comp]}
        currentFrameHash="h1"
        escenario="e1"
        onEscenario={() => {}}
      />,
    );
  }

  it("el aviso aparece en la pestaña", () => {
    const html = tab([
      { ...FILAS[0], alumnos_por_ch: { estado: "sin_decision", referencia: "promedio_global", aviso: "Se calcularon con el promedio global." } },
    ]);
    expect(html).toContain("cmv2-sindecision-aviso");
    expect(html).toContain("promedio global");
  });

  it("CONTROL: con la decisión firmada la pestaña no lo pinta", () => {
    expect(tab(FILAS)).not.toContain("cmv2-sindecision-aviso");
  });
});

describe("montaje: margen y sexo viven en la pestaña de Selección", () => {
  // Sin esto el mutante sobrevive: con las dos tarjetas desmontadas, los 1.425
  // tests de calcMuestra seguían verdes.
  function tabSeleccion(
    margenFilas: CalcMuestraAulasEstrato[] | null,
    sexo: unknown,
  ): string {
    // El modelo mínimo que la pestaña desestructura; con menos revienta en un
    // `.filter` y el test diría «no se pinta» por la razón equivocada.
    const model = {
      config: {}, selection: null, selectionRows: [], coverageRows: [],
      visibleProfiles: [], m1Rows: [], reserveRows: [], replacementSimulation: null,
      recommendedMethodId: null, engineOption: { label: "cube_balanceado" },
      targetForDisplay: 0, m1ForDisplay: 0, facultades: [],
      frameReady: false, comparison: null, simulationRows: [], rows: [],
      marcoDesactualizado: false, methods: [], stored: null, frameRows: [],
      extraRows: [], profiles: [], objetivo: null,
    } as unknown as Parameters<typeof AulasSeleccionTab>[0]["model"];
    return renderToStaticMarkup(
      <AulasSeleccionTab
        workspace={{ aulas_config: {} } as unknown as Parameters<typeof AulasSeleccionTab>[0]["workspace"]}
        model={model}
        busy={null}
        onSelectMethod={() => {}}
        onSimulateReplacements={() => {}}
        margenFilas={margenFilas}
        sexoBalance={normalizeCalcMuestraSexoPorFacultad(sexo)}
      />,
    );
  }

  it("las dos tarjetas aparecen en la pestaña", () => {
    const html = tabSeleccion(FILAS, SEXO_CRUDO);
    expect(html).toContain("cmv2-margen-card");
    expect(html).toContain("cmv2-sexo-card");
    expect(html).toContain("LETRAS Y CIENCIAS HUMANAS");
    expect(html).toContain("ARTE Y DISEÑO");
  });

  it("CONTROL: sin los bloques la pestaña no las pinta", () => {
    const html = tabSeleccion(null, null);
    expect(html).not.toContain("cmv2-margen-card");
    expect(html).not.toContain("cmv2-sexo-card");
  });
});

describe("DocenteUnicoAviso (EF2)", () => {
  it("lista cada intercambio con saliente → entrante y su celda", () => {
    const html = renderToStaticMarkup(
      <DocenteUnicoAviso registro={{
        activo: true,
        ajustes: [{
          docente: "ATOCHE DIAZ, WILMER JHONNY",
          stratum: "CIENCIAS E INGENIERIA / M / G2",
          saliente: "1ind59_0831",
          entrante: "1civ44_1001",
          intercambiado_con_ola: true,
        }],
        no_reparables: [],
      }} />,
    );
    expect(html).toContain("1 intercambio registrado");
    expect(html).toContain("ATOCHE DIAZ");
    expect(html).toContain("1ind59_0831");
    expect(html).toContain("1civ44_1001");
    expect(html).toContain("con ola");
  });

  it("el no-reparable se declara, nunca se calla", () => {
    const html = renderToStaticMarkup(
      <DocenteUnicoAviso registro={{
        activo: true,
        ajustes: [],
        no_reparables: [{ docente: "PEREZ", stratum: "FAC1 / F / G1", classroom_id: "A2" }],
      }} />,
    );
    expect(html).toContain("se conserva repetido");
    expect(html).toContain("PEREZ");
  });

  it("sin registro o sin ajustes no pinta nada: un aviso sobre nada es ruido", () => {
    expect(renderToStaticMarkup(<DocenteUnicoAviso registro={undefined} />)).toBe("");
    expect(renderToStaticMarkup(
      <DocenteUnicoAviso registro={{ activo: true, ajustes: [], no_reparables: [] }} />,
    )).toBe("");
  });
});
