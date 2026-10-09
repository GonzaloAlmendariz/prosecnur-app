import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { parteContraPlataforma } from "./parteContraPlataforma";
import { AulasParteContraPlataforma } from "./AulasParteContraPlataforma";

const parte = (operational_code: string, effective_surveys: number) => ({ operational_code, effective_surveys });
const aula = (operational_code: string, respuestas_validas: number, faculty = "Derecho") =>
  ({ operational_code, respuestas_validas, faculty });

describe("parteContraPlataforma", () => {
  it("unos pocos descuadres son casos que mirar", () => {
    const r = parteContraPlataforma(
      [parte("A", 20), parte("B", 18), parte("C", 15)],
      [aula("A", 20), aula("B", 12), aula("C", 15)],
    );
    expect(r.comparables).toBe(3);
    expect(r.descuadran).toBe(1);
    expect(r.casos[0]).toMatchObject({ codigo: "B", declaradas: 18, enPlataforma: 12, diferencia: 6 });
    expect(r.fuentesSinCorrespondencia).toBe(false);
  });

  it("cuando descuadra CASI TODO, no es el campo: es el mapeo", () => {
    // El caso que este módulo encontró nada más nacer: en el fixture de QA las
    // respuestas y los partes se siembran sin correspondencia, y 151 de 152
    // aulas «descuadran». Listarlas sería acusar al equipo de un error de
    // configuración.
    const partes = Array.from({ length: 25 }, (_, i) => parte(`CH ${i}`, 20));
    const agenda = Array.from({ length: 25 }, (_, i) => aula(`CH ${i}`, 4));
    const r = parteContraPlataforma(partes, agenda);
    expect(r.descuadran).toBe(25);
    expect(r.fuentesSinCorrespondencia).toBe(true);
  });

  it("con pocas aulas, descuadrar todo NO delata el mapeo", () => {
    // Tres de tres es una proporción del 100 % que no significa nada: el
    // umbral pide casos, no sólo porcentaje.
    const r = parteContraPlataforma(
      [parte("A", 20), parte("B", 18), parte("C", 15)],
      [aula("A", 1), aula("B", 2), aula("C", 3)],
    );
    expect(r.descuadran).toBe(3);
    expect(r.fuentesSinCorrespondencia).toBe(false);
  });

  it("un aula sin la otra fuente no es un descuadre", () => {
    // Sin parte no hay nada que comparar, y contarlo como diferencia inflaría
    // el hallazgo con huecos.
    const r = parteContraPlataforma([parte("A", 20)], [aula("A", 20), aula("B", 30)]);
    expect(r.comparables).toBe(1);
    expect(r.descuadran).toBe(0);
  });

  it("ordena por la separación más grande, caiga del lado que caiga", () => {
    const r = parteContraPlataforma(
      [parte("A", 20), parte("B", 5), parte("C", 12)],
      [aula("A", 18), aula("B", 30), aula("C", 12)],
    );
    expect(r.casos.map((c) => c.codigo)).toEqual(["B", "A"]);
    expect(r.casos[0].diferencia).toBe(-25);
  });

  // ── Dos partes del mismo curso-horario ──────────────────────────────────
  //
  // El lado de plataforma siempre fue por código; el del parte se comparaba
  // fila a fila. Un curso-horario con dos partes —dos sesiones, o el libro
  // partido en dos filas— se comparaba DOS VECES contra el mismo total, así
  // que descuadraba dos veces aunque la suma cuadrara exacta.

  it("dos partes del mismo curso-horario se suman antes de comparar", () => {
    const r = parteContraPlataforma(
      [parte("A", 20), parte("A", 18)],
      [aula("A", 38)],
    );
    // Un curso-horario, no dos filas.
    expect(r.comparables).toBe(1);
    // Y la suma cuadra: 20 + 18 = 38. Antes daba 2 descuadres de un cruce perfecto.
    expect(r.descuadran).toBe(0);
    expect(r.conVariosPartes).toBe(1);
  });

  it("si la suma NO cuadra, el descuadre es uno solo y por el total", () => {
    const r = parteContraPlataforma(
      [parte("A", 20), parte("A", 18)],
      [aula("A", 30)],
    );
    expect(r.descuadran).toBe(1);
    expect(r.casos[0]).toMatchObject({ codigo: "A", declaradas: 38, enPlataforma: 30, diferencia: 8 });
  });

  it("sin partes repetidos no declara agrupación", () => {
    const r = parteContraPlataforma([parte("A", 20)], [aula("A", 20)]);
    expect(r.conVariosPartes).toBe(0);
  });

  it("los partes repetidos no inflan la sospecha del mapeo", () => {
    // 20 cursos-horario que cuadran, cada uno partido en dos filas. Fila a fila
    // eran 40 comparables y 40 descuadres: el panel habría acusado al mapeo de
    // estar roto en un operativo que cuadra perfecto.
    const partes = Array.from({ length: 20 }, (_, i) => [
      parte(`C${i}`, 10), parte(`C${i}`, 10),
    ]).flat();
    const agenda = Array.from({ length: 20 }, (_, i) => aula(`C${i}`, 20));
    const r = parteContraPlataforma(partes, agenda);
    expect(r.comparables).toBe(20);
    expect(r.descuadran).toBe(0);
    expect(r.fuentesSinCorrespondencia).toBe(false);
  });

  // ── El filtro se descuenta antes de acusar a la atribución ──────────────
  //
  // Medido (docs/qa/checklist-tres-fuentes-monitoreo-2026-08-27.md:183-213):
  // el panel comparaba `effective_surveys` contra `respuestas_validas` —el
  // POST-filtro— y con filtros declarados concluyó «descuadran 74 de 78 → la
  // atribución está rota». El filtro descartaba respuestas en EXACTAMENTE esas
  // 74; la atribución estaba perfecta y el panel mandó a cazar un problema
  // inexistente.
  //
  // La regla: antes de acusar a la atribución hay que descontar lo que el
  // filtro explica. Si parte − plataforma ≈ descartadas por el filtro, no hay
  // descuadre que reportar; y si sobra diferencia después de descontarlo, ÉSA
  // es la que apunta a la atribución. La fila de agenda YA trae el crudo:
  // `responses_total` (todas las atribuidas al aula) y `filter_rejected`,
  // publicados por la whitelist del motor (monitoreo_aulas_universitarias.R).

  describe("el filtro se descuenta antes de acusar a la atribución", () => {
    const cruda = (
      operational_code: string,
      o: { total?: number; validas: number; rejected?: number },
      faculty = "Derecho",
    ) => ({
      operational_code,
      faculty,
      ...(o.total !== undefined ? { responses_total: o.total } : {}),
      respuestas_validas: o.validas,
      ...(o.rejected !== undefined ? { filter_rejected: o.rejected } : {}),
    });

    it("lo que el filtro descarta no es descuadre, y el resultado dice cuántas explicó", () => {
      // Parte 20, llegaron 20, el filtro dejó 15: las 5 que faltan las explica
      // el filtro, no la atribución. Residual 0 → nada que listar.
      const r = parteContraPlataforma(
        [parte("A", 20)],
        [cruda("A", { total: 20, validas: 15 })],
      );
      expect(r.descuadran).toBe(0);
      expect(r.explicadasPorFiltro).toBe(1);
    });

    it("la diferencia listada es la RESIDUAL, no residual + descartadas", () => {
      // Parte 20, llegaron 12 (el filtro dejó 5). El descuadre que apunta a la
      // atribución es 8 —contra el crudo—, no 15 —contra el post-filtro—.
      const r = parteContraPlataforma(
        [parte("A", 20)],
        [cruda("A", { total: 12, validas: 5 })],
      );
      expect(r.descuadran).toBe(1);
      expect(r.casos[0].diferencia).toBe(8);
      // Los dos números que el panel enseña («parte X · plataforma Y») tienen
      // que restar a la diferencia listada, o el lector no puede reconstruirla.
      expect(r.casos[0].declaradas - r.casos[0].enPlataforma).toBe(8);
    });

    it("74 de 78 explicadas por el filtro NO disparan la alarma de mapeo", () => {
      // El caso medido, literal: 74 cursos-horario cuya diferencia la explica
      // el filtro y 4 que cuadran del todo. Hoy la alarma dispara (74/78 ≥ 90 %)
      // y manda a revisar la columna en Fuentes con la atribución perfecta.
      // La sospecha del mapeo se evalúa sobre los descuadres RESIDUALES.
      const partes = Array.from({ length: 78 }, (_, i) => parte(`CH ${i}`, 20));
      const agenda = Array.from({ length: 78 }, (_, i) =>
        i < 74
          ? cruda(`CH ${i}`, { total: 20, validas: 15 })
          : cruda(`CH ${i}`, { total: 20, validas: 20 }),
      );
      const r = parteContraPlataforma(partes, agenda);
      // La alarma primero: es el defecto medido. Hoy sale `true` y el panel
      // dice «revisa qué columna identifica el curso-horario, en Fuentes».
      expect(r.fuentesSinCorrespondencia).toBe(false);
      expect(r.descuadran).toBe(0);
      expect(r.explicadasPorFiltro).toBe(74);
      expect(r.sinCrudo).toBe(false);
    });

    it("sin responses_total, filter_rejected reconstruye el crudo", () => {
      // La whitelist puede traer el rechazo sin el total: válidas + rechazadas
      // ES el crudo, y con él la cuenta se descuenta igual.
      const r = parteContraPlataforma(
        [parte("A", 20)],
        [cruda("A", { validas: 15, rejected: 5 })],
      );
      expect(r.descuadran).toBe(0);
      expect(r.explicadasPorFiltro).toBe(1);
      expect(r.sinCrudo).toBe(false);
    });

    it("sin ningún crudo compara contra válidas, como hoy, y LO DECLARA", () => {
      // Payloads viejos sin `responses_total` ni `filter_rejected`: la única
      // comparación posible es contra el post-filtro. Se mantiene, pero el
      // resultado lo declara para que el panel pueda decir su limitación.
      const r = parteContraPlataforma([parte("A", 20)], [aula("A", 15)]);
      expect(r.descuadran).toBe(1);
      expect(r.casos[0].diferencia).toBe(5);
      expect(r.sinCrudo).toBe(true);
    });

    it("con el crudo presente, cuadrar sigue cuadrando", () => {
      // declaradas == responses_total == válidas: ni descuadre ni nada que el
      // filtro tenga que explicar.
      const r = parteContraPlataforma(
        [parte("A", 20)],
        [cruda("A", { total: 20, validas: 20 })],
      );
      expect(r.descuadran).toBe(0);
      expect(r.explicadasPorFiltro).toBe(0);
    });
  });
});

// ── El panel declara la agrupación ────────────────────────────────────────
// Un campo que nadie consume no arregla nada: si el cruce agrupó partes, el
// lector tiene que verlo, porque «los 20 cuadran» significa otra cosa cuando
// detrás hay 40 partes.
describe("AulasParteContraPlataforma declara los partes agrupados", () => {
  const render = (partes: ReturnType<typeof parte>[], agenda: ReturnType<typeof aula>[]) =>
    renderToStaticMarkup(<AulasParteContraPlataforma partes={partes} agenda={agenda} />);

  it("con partes agrupados lo dice; sin ellos no ensucia el texto", () => {
    const con = render([parte("A", 10), parte("A", 10)], [aula("A", 20)]);
    expect(con).toContain("1 de ellos suman más de un parte de campo");

    const sin = render([parte("A", 20)], [aula("A", 20)]);
    expect(sin).not.toContain("parte de campo");
  });

  it("nombra la población por lo que es: cursos-horario, no aulas", () => {
    // Los dos lados del cruce son por curso-horario; «aulas» era la palabra de
    // otra población del mismo perfil.
    const html = render([parte("A", 20)], [aula("A", 20)]);
    expect(html).toContain("cursos-horario comparables");
    expect(html).not.toContain("aulas comparables");
  });
});

/**
 * S8: el panel avisa arriba de la lista cuando el parte está lejos de la
 * plataforma, con las dos cuentas y la salida.
 */
describe("AulasParteContraPlataforma · el aviso de los que están lejos", () => {
  const agenda = [
    { operational_code: "CH 76", respuestas_validas: 38, responses_total: 38, faculty: "Letras" },
    { operational_code: "CH 43", respuestas_validas: 16, responses_total: 16, faculty: "Letras" },
  ];
  it("nombra al lejos y no al que difiere en 1", () => {
    const html = renderToStaticMarkup(
      <AulasParteContraPlataforma
        partes={[{ operational_code: "CH 76", effective_surveys: 23 }, { operational_code: "CH 43", effective_surveys: 17 }]}
        agenda={agenda}
      />,
    );
    expect(html).toContain("1 curso-horario con el parte lejos de la plataforma: CH 76 (parte 23, plataforma 38)");
    expect(html).toContain("collectorID");
    expect(html).toContain('data-tono="atencion"');
  });
  it("con diferencias chicas no pinta el aviso", () => {
    const html = renderToStaticMarkup(
      <AulasParteContraPlataforma
        partes={[{ operational_code: "CH 43", effective_surveys: 17 }]}
        agenda={agenda}
      />,
    );
    expect(html).not.toContain("lejos de la plataforma");
  });
});
