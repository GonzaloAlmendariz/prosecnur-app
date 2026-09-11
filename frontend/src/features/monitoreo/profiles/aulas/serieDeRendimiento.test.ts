import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import type { MonitoreoRow } from "../../../../api/monitoreo";
import { PESO_DEL_PRIOR } from "./rendimientoPorFacultad";
import { serieDeRendimiento } from "./serieDeRendimiento";

const parte = (f: Partial<MonitoreoRow>) => f as MonitoreoRow;

describe("serieDeRendimiento", () => {
  it("mide lo que deja cada visita, no cuánto produjo la facultad", () => {
    // El caso que separa rendimiento de producción: Grande aplica 6 aulas y saca
    // 120; Chica aplica 2 y saca 44. Grande produce más y rinde menos.
    const partes = [
      ...Array.from({ length: 6 }, () => parte({ faculty: "Grande", applied_at: "2026-08-10", effective_surveys: 20 })),
      ...Array.from({ length: 2 }, () => parte({ faculty: "Chica", applied_at: "2026-08-10", effective_surveys: 22 })),
    ];
    const { facultades } = serieDeRendimiento(partes);
    const grande = facultades.find((f) => f.facultad === "Grande")!;
    const chica = facultades.find((f) => f.facultad === "Chica")!;
    expect(grande.efectivas).toBe(120);
    expect(chica.efectivas).toBe(44);
    expect(grande.observadoFinal).toBe(20);
    expect(chica.observadoFinal).toBe(22);
  });

  it("el esperado encoge hacia la media del estudio cuando hay poca evidencia", () => {
    // Una sola aula con 40 encuestas en un estudio cuya media es 20: el
    // observado dice 40 y el esperado NO, porque una observación no manda.
    const partes = [
      parte({ faculty: "Nueva", applied_at: "2026-08-10", effective_surveys: 40 }),
      ...Array.from({ length: 19 }, () => parte({ faculty: "Vieja", applied_at: "2026-08-10", effective_surveys: 19 })),
    ];
    const { facultades, mediaDelEstudio } = serieDeRendimiento(partes);
    const nueva = facultades.find((f) => f.facultad === "Nueva")!;
    expect(nueva.observadoFinal).toBe(40);
    expect(nueva.esperadoFinal).toBeLessThan(40);
    expect(nueva.esperadoFinal).toBeGreaterThan(mediaDelEstudio);
    // La fórmula, explícita: (40 + 5×media) / (1 + 5).
    const esperado = (40 + PESO_DEL_PRIOR * mediaDelEstudio) / (1 + PESO_DEL_PRIOR);
    expect(nueva.esperadoFinal).toBeCloseTo(Math.round(esperado * 10) / 10, 1);
  });

  it("con mucha evidencia el esperado se acerca a lo observado", () => {
    const muchas = Array.from({ length: 40 }, () => parte({ faculty: "Firme", applied_at: "2026-08-10", effective_surveys: 30 }));
    const otras = Array.from({ length: 40 }, () => parte({ faculty: "Otra", applied_at: "2026-08-10", effective_surveys: 10 }));
    const { facultades } = serieDeRendimiento([...muchas, ...otras]);
    const firme = facultades.find((f) => f.facultad === "Firme")!;
    expect(firme.observadoFinal).toBe(30);
    expect(Math.abs(firme.esperadoFinal - 30)).toBeLessThan(1.5);
  });

  it("el prior de cada día es la media HASTA ese día, no la final", () => {
    // Si usara la media final, el esperado del día 1 conocería el día 2 y la
    // línea de ayer cambiaría al llegar la de hoy.
    const partes = [
      parte({ faculty: "A", applied_at: "2026-08-10", effective_surveys: 10 }),
      parte({ faculty: "B", applied_at: "2026-08-11", effective_surveys: 40 }),
    ];
    const { facultades } = serieDeRendimiento(partes);
    const a = facultades.find((f) => f.facultad === "A")!;
    // Día 1: sólo existe A con 10, así que la media del estudio es 10 y el
    // esperado de A es exactamente 10 —no lo mueve el 40 que llega mañana—.
    expect(a.dias[0].esperado).toBe(10);
  });

  it("un día sin aulas no inventa un rendimiento de cero", () => {
    const partes = [
      parte({ faculty: "A", applied_at: "2026-08-10", effective_surveys: 20 }),
      parte({ faculty: "B", applied_at: "2026-08-11", effective_surveys: 20 }),
    ];
    const { facultades } = serieDeRendimiento(partes);
    const a = facultades.find((f) => f.facultad === "A")!;
    expect(a.dias).toHaveLength(2);
    expect(a.dias[1].aulas).toBe(0);
    // `null` y no 0: ese día no rindió cero, es que no fue a ninguna aula.
    expect(a.dias[1].porAula).toBeNull();
    // El acumulado, en cambio, no se pierde.
    expect(a.dias[1].aulasAcumuladas).toBe(1);
  });

  it("ordena por lo que decide mañana: el esperado", () => {
    const partes = [
      ...Array.from({ length: 10 }, () => parte({ faculty: "Baja", applied_at: "2026-08-10", effective_surveys: 8 })),
      ...Array.from({ length: 10 }, () => parte({ faculty: "Alta", applied_at: "2026-08-10", effective_surveys: 28 })),
    ];
    const { facultades } = serieDeRendimiento(partes);
    expect(facultades.map((f) => f.facultad)).toEqual(["Alta", "Baja"]);
  });

  it("una fila sin fecha no entra en la serie", () => {
    const { facultades, fechas } = serieDeRendimiento([
      parte({ faculty: "A", applied_at: "", effective_surveys: 99 }),
    ]);
    expect(fechas).toEqual([]);
    expect(facultades).toEqual([]);
  });
});

describe("los elegibles del pasado son el techo de cada día", () => {
  // «La barra representa cuánto se esperaba y la línea, a cuánto se llegó [...]
  // no sólo aplica al futuro, aplica también a lo que ya se aplicó en el pasado.»
  const plan = [
    parte({ operational_code: "A", eligible_n: 40 }),
    parte({ operational_code: "B", eligible_n: 60 }),
  ];

  it("suma los elegibles del plan por día", () => {
    const partes = [
      parte({ operational_code: "A", faculty: "Derecho", applied_at: "2026-08-10", effective_surveys: 20 }),
      parte({ operational_code: "B", faculty: "Derecho", applied_at: "2026-08-10", effective_surveys: 30 }),
    ];
    const { facultades } = serieDeRendimiento(partes, plan);
    expect(facultades[0].dias[0].elegibles).toBe(100);
    expect(facultades[0].dias[0].efectivas).toBe(50);
  });

  it("los elegibles salen del PLAN, no del parte", () => {
    // El parte no los trae; buscarlos ahí daría 0 y la barra desaparecería.
    const partes = [
      parte({ operational_code: "A", faculty: "Derecho", applied_at: "2026-08-10", effective_surveys: 20 }),
    ];
    expect(serieDeRendimiento(partes, plan).facultades[0].dias[0].elegibles).toBe(40);
    expect(serieDeRendimiento(partes, []).facultades[0].dias[0].elegibles).toBe(0);
  });

  it("sin plan no inventa un techo", () => {
    const partes = [parte({ operational_code: "Z", faculty: "Derecho", applied_at: "2026-08-10", effective_surveys: 9 })];
    expect(serieDeRendimiento(partes, plan).facultades[0].dias[0].elegibles).toBe(0);
  });

  describe("la vara del diseño", () => {
    const plan = (f: Partial<MonitoreoRow>) => f as MonitoreoRow;

    it("sólo cuenta las aulas cuya meta viene del diseño", () => {
      // **El defecto que este test cierra**: `expected_valid` colapsa tres cosas
      // —lo que el diseño computó, lo que alguien escribió a mano, y el propio
      // techo de elegibles cuando no había ninguna— y el motor lo dice en
      // `meta_origen`. Promediarlas juntas daría una vara que en parte es la
      // vara y en parte es el techo, y dibujarla pegada al techo se leería como
      // que el diseño esperaba el 100 %.
      const partes = [
        parte({ faculty: "F", applied_at: "2026-08-10", effective_surveys: 12, operational_code: "A" }),
        parte({ faculty: "F", applied_at: "2026-08-10", effective_surveys: 12, operational_code: "B" }),
      ];
      const planFilas = [
        plan({ operational_code: "A", eligible_n: 30, expected_valid: 18, meta_origen: "diseno" }),
        // Misma cifra, otro origen: es el techo, no una meta. No debe promediarse.
        plan({ operational_code: "B", eligible_n: 30, expected_valid: 30, meta_origen: "elegibles" }),
      ];
      const { facultades } = serieDeRendimiento(partes, planFilas);
      const dia = facultades[0]!.dias[0]!;
      expect(dia.aulas).toBe(2);
      expect(dia.aulasConDiseno).toBe(1);
      // 18, la del diseño. Si contara las dos daría 24 y la vara se iría al techo.
      expect(dia.esperadoPorAulaDelDiseno).toBe(18);
    });

    it("sin ninguna meta del diseño devuelve null, que es ausencia y no cero", () => {
      // Un cero diría que el diseño no pedía nada de esas aulas. Lo que pasa es
      // que el plan no lo dice, y eso se dibuja como ausencia.
      const partes = [parte({ faculty: "F", applied_at: "2026-08-10", effective_surveys: 12, operational_code: "A" })];
      const planFilas = [plan({ operational_code: "A", eligible_n: 30, expected_valid: 21, meta_origen: "declarada" })];
      const { facultades } = serieDeRendimiento(partes, planFilas);
      expect(facultades[0]!.dias[0]!.esperadoPorAulaDelDiseno).toBeNull();
      expect(facultades[0]!.dias[0]!.aulasConDiseno).toBe(0);
    });

    it("promedia sobre las aulas con vara, no sobre todas las del día", () => {
      // Tres aulas, dos con vara de 20 y 30. La vara del día es 25, no 16,7:
      // dividir entre las tres hundiría la altura sin que nada lo dijera.
      const partes = ["A", "B", "C"].map((c) =>
        parte({ faculty: "F", applied_at: "2026-08-10", effective_surveys: 10, operational_code: c }));
      const planFilas = [
        plan({ operational_code: "A", eligible_n: 40, expected_valid: 20, meta_origen: "diseno" }),
        plan({ operational_code: "B", eligible_n: 50, expected_valid: 30, meta_origen: "diseno" }),
        plan({ operational_code: "C", eligible_n: 40, expected_valid: 40, meta_origen: "elegibles" }),
      ];
      const { facultades } = serieDeRendimiento(partes, planFilas);
      const dia = facultades[0]!.dias[0]!;
      expect(dia.aulasConDiseno).toBe(2);
      expect(dia.esperadoPorAulaDelDiseno).toBe(25);
    });

    it("una meta del diseño en cero no cuenta como vara", () => {
      // Ocurre de verdad: una reserva que entra al plan sin que nadie le fije
      // cuántas válidas se le piden. Cero no es «el diseño pedía cero».
      const partes = [parte({ faculty: "F", applied_at: "2026-08-10", effective_surveys: 9, operational_code: "A" })];
      const planFilas = [plan({ operational_code: "A", eligible_n: 30, expected_valid: 0, meta_origen: "diseno" })];
      const { facultades } = serieDeRendimiento(partes, planFilas);
      expect(facultades[0]!.dias[0]!.esperadoPorAulaDelDiseno).toBeNull();
    });
  });
});

describe("«meta» nombra la cuota y sólo la cuota", () => {
  /**
   * **Encargo del 2026-08-30: la meta, lo diseñado y el rendimiento son tres
   * cantidades distintas y no pueden compartir palabra.**
   *
   * En este módulo `meta` llegó a nombrar dos: `expected_valid` —lo que se
   * espera de UN aula— y la cuota de una celda de sexo. En pantalla nunca
   * colisionaron, pero leyendo el código sí, y el defecto es de los que vuelven:
   * basta que alguien escriba `const metaX = fila.expected_valid`.
   *
   * El guard mira la fuente, no el resultado, porque el renombrado no cambia
   * ninguna cifra y ningún test de comportamiento podría verlo.
   */
  const fuente = () => readFileSync(new URL("./serieDeRendimiento.ts", import.meta.url), "utf8");

  it("no hay ninguna variable «meta…» que lea expected_valid", () => {
    const infractores = [...fuente().matchAll(/\b(meta[A-Za-z]*)\s*[=:][^;\n]*expected_valid/g)]
      .map((m) => m[1]);
    expect(
      infractores,
      "«meta» es la cuota. Lo que se espera de un aula es `esperado…`: " +
        infractores.join(", "),
    ).toEqual([]);
  });

  it("y el guard mide algo: reconoce el patrón cuando está", () => {
    // Control de fixture: sin esto, un regex roto daría siempre cero infractores
    // y el guard pasaría para siempre. Es la lección del ratchet de vocabulario.
    const muestra = "const metaPorCodigo = numero(fila.expected_valid);";
    expect([...muestra.matchAll(/\b(meta[A-Za-z]*)\s*[=:][^;\n]*expected_valid/g)]).toHaveLength(1);
  });
});

describe("la facultad sale del plan cuando el parte no la trae", () => {
  /**
   * Medido sobre HSVG26ULT2 el 2026-09-11: **cero de 57 partes traen
   * `faculty`**. Agrupando por la del parte, las quince facultades caían en un
   * único cubo «Sin facultad», y cualquier consumidor que buscara la suya por
   * nombre se iba de vacío — que es lo que le pasó a la serie por jornada del
   * ranking al estrenarse.
   *
   * Es el mismo defecto que vigila `elParteTraeSuFacultad`: el parte identifica
   * el curso-horario, y la facultad la declara el plan.
   */
  const parteSinFacultad = (codigo: string, fecha: string, efectivas: number) =>
    ({ operational_code: codigo, applied_at: fecha, effective_surveys: efectivas }) as unknown as MonitoreoRow;
  const aula = (codigo: string, facultad: string) =>
    ({ operational_code: codigo, faculty: facultad, eligible_n: 20, expected_valid: 10 }) as unknown as MonitoreoRow;

  it("agrupa por la facultad del plan y no en un cubo «Sin facultad»", () => {
    const s = serieDeRendimiento(
      [parteSinFacultad("CH 1", "2026-09-08", 5), parteSinFacultad("CH 9", "2026-09-08", 7)],
      [aula("CH 1", "DERECHO"), aula("CH 9", "LETRAS")],
    );
    const nombres = s.facultades.map((f) => f.facultad).sort();
    expect(nombres).toEqual(["DERECHO", "LETRAS"]);
    expect(nombres).not.toContain("Sin facultad");
  });

  it("la del parte manda si algún día la trae", () => {
    const conFacultad = { operational_code: "CH 1", applied_at: "2026-09-08",
      effective_surveys: 5, faculty: "ARTES" } as unknown as MonitoreoRow;
    const s = serieDeRendimiento([conFacultad], [aula("CH 1", "DERECHO")]);
    expect(s.facultades.map((f) => f.facultad)).toEqual(["ARTES"]);
  });

  it("sin plan y sin facultad en el parte sigue habiendo un cubo, y se llama por su nombre", () => {
    // No se inventa una facultad: «Sin facultad» es la verdad cuando nadie la
    // declara, y borrar la fila escondería partes que existen.
    const s = serieDeRendimiento([parteSinFacultad("CH 1", "2026-09-08", 5)], []);
    expect(s.facultades.map((f) => f.facultad)).toEqual(["Sin facultad"]);
  });
});
