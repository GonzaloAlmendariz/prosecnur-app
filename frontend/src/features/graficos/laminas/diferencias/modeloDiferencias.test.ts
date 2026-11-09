// Mata: un paso a paso libre que vuelve por la puerta de atrás (un valor guardado raro que se pierde), un estado del
// inspector mal derivado, la nota sin su cápsula, el filtro «Para revisar» que deja fuera un error y un CSV mal citado.
import { describe, expect, it } from "vitest";
import { normalizeDiferenciasLamina, REGLA_DIFERENCIAS_POR_DEFECTO, type ReglaDiferencias } from "../../../../api/graficosDiferencias";
import {
  claveDiferencias,
  condicionesPar,
  conteosLamina,
  csvRevision,
  descripcionComparacion,
  estadoInspector,
  estadoRevision,
  filtrarRevision,
  formatoP,
  frasePar,
  opcionesAlfa,
  opcionesUmbral,
  parInicial,
  notaBasesChicas,
  partirNota,
  queRevisar,
  resumenRegla,
} from "./modeloDiferencias";

const REGLA: ReglaDiferencias = { ...REGLA_DIFERENCIAS_POR_DEFECTO, prueba: "rao_scott", correccion: "bh_informe", conglomerado: "seccion" };

const lamina = (extra: Record<string, unknown> = {}) => normalizeDiferenciasLamina({
  slide_id: "s1", titulo: "Pregunta uno", estado: "con_marcas", cruce: "grupo", variable: "p1",
  grupos: [
    { letra: "A", etiqueta: "Norte", n: 120, conglomerados: 12, comparable: true },
    { letra: "B", etiqueta: "Sur", n: 95, conglomerados: 10, comparable: true },
  ],
  pares: [
    { fila: "Sí", a: "B", b: "A", p_a: 40, p_b: 22, dif: 18, p_ajustado: 0.0004, veredicto: "marcada", redaccion: "Sur dice sí con más frecuencia." },
    { fila: "No", a: "A", b: "B", p_a: 30, p_b: 25, dif: 5, p_ajustado: 0.3, veredicto: "bajo_umbral", redaccion: "" },
    { fila: "Tal vez", a: "A", b: "B", p_a: 35, p_b: 22, dif: 13, p_ajustado: 0.03, veredicto: "fragil", redaccion: "Norte dice tal vez algo más." },
  ],
  ...extra,
});

describe("opciones cerradas", () => {
  it("el nivel en sus tres valores, y el guardado raro se agrega", () => {
    expect(opcionesAlfa(0.05).map((o) => o.rotulo)).toEqual(["p < 0.10", "p < 0.05", "p < 0.01"]);
    expect(opcionesAlfa(0.02).map((o) => o.valor)).toEqual([0.1, 0.05, 0.02, 0.01]);
    expect(opcionesUmbral(10).map((o) => o.valor)).toEqual([0, 5, 10, 15]);
  });
  it("la regla en una línea", () => {
    expect(resumenRegla(REGLA)).toBe("Rao-Scott por seccion, BH, p < 0.05, 10 pts, n ≥ 30");
    expect(resumenRegla(REGLA_DIFERENCIAS_POR_DEFECTO)).toBe("Prueba z, Bonferroni, p < 0.05, 10 pts, n ≥ 30");
  });
});

describe("estado del inspector", () => {
  const listo = { estado: "listo" as const, datos: { lamina: lamina() } };
  it("sin cruce manda sobre todo; apagado no pide", () => {
    expect(estadoInspector({ tieneCruce: false, encendido: true, carga: listo })).toBe("sin_cruce");
    expect(estadoInspector({ tieneCruce: true, encendido: false, carga: listo })).toBe("apagado");
  });
  it("sin datos calcula; con error de llamada, error; con datos, el de la lámina", () => {
    expect(estadoInspector({ tieneCruce: true, encendido: true, carga: undefined })).toBe("calculando");
    expect(estadoInspector({ tieneCruce: true, encendido: true, carga: { estado: "cargando" } })).toBe("calculando");
    expect(estadoInspector({ tieneCruce: true, encendido: true, carga: { estado: "error", code: "E_X", message: "m", error_id: null } })).toBe("error");
    expect(estadoInspector({ tieneCruce: true, encendido: true, carga: listo })).toBe("con_marcas");
    expect(estadoInspector({ tieneCruce: true, encendido: true, carga: { estado: "listo", datos: { lamina: lamina({ estado: "abstencion" }) } } })).toBe("abstencion");
  });
});

describe("una lámina", () => {
  it("cuenta marcadas (firmes + frágiles), frágiles y bajo el umbral", () => {
    expect(conteosLamina(lamina())).toEqual({ marcadas: 2, fragiles: 1, bajoUmbral: 1, noComparables: 0 });
  });
  it("describe la comparación con sus bases", () => {
    expect(descripcionComparacion(lamina(), "Zona")).toBe("Compara los 2 grupos de Zona entre sí (bases 120 y 95).");
  });
  it("el par inicial es la primera marcada; la frase y las condiciones", () => {
    const l = lamina();
    expect(parInicial(l.pares)).toBe(0);
    expect(frasePar(l.pares[0], l.grupos)).toBe("Sur (40%) supera a Norte (22%) por 18 puntos.");
    expect(condicionesPar(l.pares[1], l.grupos, REGLA).map((c) => c.cumple)).toEqual([true, false, false]);
    expect(condicionesPar(l.pares[0], l.grupos, REGLA).every((c) => c.cumple)).toBe(true);
  });
  it("frente al resto se nombra «el resto»", () => {
    const l = lamina({ pares: [{ fila: "Sí", a: "A", b: "resto", p_a: 50, p_b: 30, dif: 20, veredicto: "marcada" }] });
    expect(frasePar(l.pares[0], l.grupos)).toBe("Norte (50%) supera al resto (30%) por 20 puntos.");
  });
  it("formato del p ajustado", () => {
    expect([formatoP(0.0004), formatoP(0.031), formatoP(null)]).toEqual(["< 0.001", "0.031", "—"]);
  });
});

describe("la nota", () => {
  it("los grupos chicos se nombran por lo que se ve, con la base mínima de la regla", () => {
    expect(notaBasesChicas(30)).toBe("Los grupos con menos de 30 casos se muestran como referencia y no se comparan.");
    expect(notaBasesChicas(50)).toContain("menos de 50 casos");
  });
  it("parte la cápsula del texto, con y sin corchetes; la frágil es △", () => {
    expect(partirNota("▲A  Mayor que el grupo de esa letra.\n[△A]  Frágil: igual.\nLos grupos con menos de 30 casos se muestran como referencia y no se comparan.")).toEqual([
      { capsula: { letras: "A", fragil: false }, texto: "Mayor que el grupo de esa letra." },
      { capsula: { letras: "A", fragil: true }, texto: "Frágil: igual." },
      { capsula: null, texto: "Los grupos con menos de 30 casos se muestran como referencia y no se comparan." },
    ]);
  });
});

describe("revisión en lote", () => {
  const laminas = [
    lamina(),
    lamina({ slide_id: "s2", estado: "ninguna", pares: [], revisar: ["sin_diferencias"] }),
    lamina({ slide_id: "s3", estado: "error", pares: [], error: { code: "E_SIG_PRUEBA_FALLO", message: "falló", error_id: "x1" } }),
  ];
  it("«Para revisar» incluye los errores aunque no traigan código; «Marcadas» sólo las con cápsula", () => {
    expect(filtrarRevision(laminas, "revisar").map((l) => l.slide_id)).toEqual(["s2", "s3"]);
    expect(filtrarRevision(laminas, "marcadas").map((l) => l.slide_id)).toEqual(["s1"]);
    expect(filtrarRevision(laminas, "todas")).toHaveLength(3);
  });
  it("estado y qué revisar por lámina", () => {
    expect(estadoRevision(laminas[0])).toEqual({ rotulo: "2 marcadas", tono: "marcada" });
    expect(estadoRevision(laminas[1]).rotulo).toBe("Ninguna");
    expect(estadoRevision(laminas[2]).tono).toBe("peligro");
    expect(queRevisar(laminas[2])).toEqual(["falló"]);
  });
  it("CSV con cabecera y comillas donde hace falta", () => {
    const csv = csvRevision([{ lamina: lamina({ titulo: "Con, coma" }), posicion: 4, titulo: "Con, coma" }]).split("\n");
    expect(csv[0]).toBe("Lámina,Título,Variable,Cruce,Estado,Marcadas,Frágiles,Bajo el umbral,Qué revisar");
    expect(csv[1]).toBe('4,"Con, coma",p1,grupo,2 marcadas,2,1,1,');
  });
});

describe("huella de la lámina", () => {
  it("cambia con el cruce o el interruptor, no con otros args", () => {
    const base = { graficador: "p_barras_agrupadas", args: { var: "p1", cruces: "g", orden: "x" } };
    const k = claveDiferencias([base]);
    expect(claveDiferencias([{ ...base, args: { ...base.args, orden: "y" } }])).toBe(k);
    expect(claveDiferencias([{ ...base, args: { ...base.args, cruces: "h" } }])).not.toBe(k);
    expect(claveDiferencias([{ ...base, args: { ...base.args, mostrar_significancia: true } }])).not.toBe(k);
  });
});

describe("R11-10: la tabla del «Por qué» nombra el par", () => {
  it("las dos etiquetas de grupo, con mayúscula; frente al resto, «el resto»", async () => {
    const { parDeGrupos } = await import("./modeloDiferencias");
    const grupos = [
      { letra: "A", codigo: "1", etiqueta: "24 a 35 años", n: 30, conglomerados: null, comparable: true, motivo: null },
      { letra: "B", codigo: "2", etiqueta: "36 a 45 años", n: 35, conglomerados: null, comparable: true, motivo: null },
    ];
    expect(parDeGrupos({ a: "B", b: "A" }, grupos)).toBe("36 a 45 años y 24 a 35 años");
    expect(parDeGrupos({ a: "A", b: "resto" }, grupos)).toBe("24 a 35 años y el resto");
  });
});
