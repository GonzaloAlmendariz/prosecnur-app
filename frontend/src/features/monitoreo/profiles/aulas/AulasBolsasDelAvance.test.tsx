import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AulasBolsasDelAvance } from "./AulasBolsasDelAvance";
import { AulasPestanaCuotas } from "./AulasPestanaCuotas";
import { avanceCuota, type TotalDeAvanceCuota } from "./avanceCuota";
import type { MonitoreoAulasDashboard, MonitoreoRow } from "../../../../api/monitoreo";

/**
 * **Las cuatro bolsas del avance, y que alguien las MONTE.**
 *
 * El defecto que trae estas pruebas, medido el 2026-09-17 sobre el simulacro de
 * CCSS con 64 respuestas: el motor publicaba `fuera_universo 3`, `huerfanas 1`,
 * `sin_eje 1` y `duplicadas 1`, el view-model las redactaba bien, y la pantalla
 * decía «Efectivas 58 de 400» sin una palabra de las seis restantes — porque
 * las notas estaban en `AulasAvanceCuota`, un componente que **nadie monta**
 * desde el 2026-09-09.
 *
 * De ahí que la segunda mitad del archivo renderice la PESTAÑA y no el
 * componente: una prueba del componente solo vuelve a pasar en verde el día que
 * el montaje se caiga otra vez.
 */

const TOTAL = (parches: Partial<TotalDeAvanceCuota> = {}): TotalDeAvanceCuota => ({
  etiqueta: "Cuota del estudio", cuota: 400, validas: 58, brecha: 342,
  avance: 14.5, avanceTexto: "14,5 %", relleno: 14.5, aria: "",
  notas: ["3 fuera de universo", "1 sin curso-horario del plan", "1 sin nivel",
          "1 persona que respondió dos veces"],
  fueraDeCelda: 6, descuadre: null, ...parches,
});

describe("AulasBolsasDelAvance", () => {
  it("dice cuántas llegaron y no entran, con el motivo de cada una", () => {
    const html = renderToStaticMarkup(<AulasBolsasDelAvance total={TOTAL()} />);
    expect(html).toContain("6");
    expect(html).toContain("no entran en ninguna meta");
    expect(html).toContain("3 fuera de universo");
    expect(html).toContain("1 sin nivel");
    expect(html).toContain("1 persona que respondió dos veces");
  });

  it("sin bolsas y sin descuadre no se monta", () => {
    // C3: el vacío de esta pieza es no existir. «0 sin nivel» es ruido, y con
    // el eje en facultad las dos bolsas de persona valen 0 siempre.
    expect(renderToStaticMarkup(
      <AulasBolsasDelAvance total={TOTAL({ notas: [], fueraDeCelda: 0 })} />,
    )).toBe("");
  });

  it("el descuadre habla aunque no haya bolsas, y con su rol", () => {
    // Al revés que las bolsas: callado si cuadra, ruidoso si no. Un bloque
    // cuyas partes no suman su total no se puede leer y nadie más lo dice.
    const html = renderToStaticMarkup(
      <AulasBolsasDelAvance total={TOTAL({
        notas: [], fueraDeCelda: 0, descuadre: "Las partes no suman las válidas: 8 contra 10",
      })} />,
    );
    expect(html).toContain('role="status"');
    expect(html).toContain("8 contra 10");
    expect(html).not.toContain("no entran en ninguna meta");
  });

  it("una sola bolsa concuerda en singular", () => {
    const html = renderToStaticMarkup(
      <AulasBolsasDelAvance total={TOTAL({ notas: ["1 sin nivel"], fueraDeCelda: 1 })} />,
    );
    expect(html).toContain("respuesta más llegó");
    expect(html).not.toContain("respuestas más llegaron");
  });
});

describe("las bolsas llegan a la pestaña que las pinta", () => {
  /**
   * El bloque del motor tal como llega en el simulacro de CCSS por nivel: eje
   * declarado, cuatro celdas y las cuatro bolsas con contenido.
   */
  const AVANCE = {
    schema: "monitoreo_aulas_avance_cuota_v1",
    fuente: "design_targets", vigencia: "vigente", motivo: "",
    tasa_esperada: 0.5, tasa_fuente: "tau_disenio",
    eje: { clave: "nivel", etiqueta: "Nivel", etiqueta_plural: "Niveles", etiqueta_sin: "Sin nivel" },
    facultades: [{ facultad: "6", faculty_key: "6", cuota: 120, respuestas_validas: 16, brecha: 104 }],
    total: {
      cuota: 400, respuestas_validas: 58, brecha: 342, avance_pct: 14.5,
      fuera_universo: 3, huerfanas: 1, sin_eje: 1, duplicadas: 1,
      invariante: { ok: true, suma: 64, total: 64, solapadas: 0 },
    },
  };

  const DASHBOARD = {
    avance_cuota: AVANCE,
    /**
     * **VACÍO a propósito.** CCSS no publica `proyeccion_metas`, así que el
     * panel «Metas por facultad y sexo» no se monta — y ahí fue donde puse las
     * bolsas la primera vez. Con el fixture trayendo proyección, la prueba
     * pasaba en verde sobre una pantalla que en el estudio real salía muda.
     */
    proyeccion_metas: null,
    avance_sexo_facultad: [{ facultad: "6", faculty_key: "6", sexo: "", cuota: 120, efectivas: 16 }],
    quotas_sex_faculty: [],
    aulas_por_facultad: [],
    reserva_dirigida: [],
  } as unknown as MonitoreoAulasDashboard;

  it("la pestaña «cuotas» las pinta bajo la cinta", () => {
    const html = renderToStaticMarkup(
      <AulasPestanaCuotas
        dashboard={DASHBOARD}
        pestana="cuotas"
        foco={null}
        facultadEnFoco={undefined}
        onFoco={() => {}}
        tabla={{} as never}
        diasDeCampoDelCorte={(_partes: ReadonlyArray<MonitoreoRow>) => 1}
      />,
    );
    expect(html).toContain("no entran en ninguna meta");
    expect(html).toContain("1 sin nivel");
    expect(html).toContain("1 persona que respondió dos veces");
  });

  it("y el view-model del motor produce las mismas seis", () => {
    // Cierra el circuito: lo que el motor publica, lo que el view-model
    // redacta y lo que la pestaña pinta son la misma cifra.
    expect(avanceCuota(AVANCE as never).total?.fueraDeCelda).toBe(6);
  });
});
