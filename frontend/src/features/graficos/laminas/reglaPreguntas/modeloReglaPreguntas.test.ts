// La regla de preguntas en la tarjeta (ADR 0135 §2 y §4): tipos por graficador, lectura, ajuste a mano y firma.
import { describe, expect, it } from "vitest";
import { normalizarConteoRegla } from "../../../../api/graficosRegla";
import {
  ajustadaAMano, alternarFila, campoCifra, conCifra, conTipo, filaBloqueada, firmaPedidoRegla, gruposDeLaLamina, jsonEstable, leerRegla,
  limpiarRegla, mismoConteo, reglaEfectiva, rotuloMetrica, rotuloTipo, textoConteo, tiposOfrecidos, valorCifra, volverALaRegla,
} from "./modeloReglaPreguntas";

describe("los tipos que ofrece cada graficador", () => {
  it("el panorama con un público no ofrece las reglas que comparan grupos; con dos, sí", () => {
    expect(gruposDeLaLamina("p_panorama", { vars: ["docentes$*"] })).toBe(1);
    expect(tiposOfrecidos("p_panorama", 1, null)).toEqual(["todas", "bajo_umbral", "a_mano"]);
    expect(gruposDeLaLamina("p_panorama", { vars: ["docentes$*", "estudiantes$*", "docentes$p3"] })).toBe(2);
    expect(tiposOfrecidos("p_panorama", 2, null)).toEqual(["todas", "comunes", "mayor_diferencia", "diferencia_minima", "bajo_umbral", "a_mano"]);
  });
  it("la brecha siempre compara; la divergente elige por Sin información, umbral o extremos", () => {
    expect(gruposDeLaLamina("p_dumbbell", {})).toBe(2);
    expect(tiposOfrecidos("p_dumbbell", 2, null)).toEqual(["mayor_diferencia", "diferencia_minima", "comunes", "a_mano"]);
    expect(tiposOfrecidos("p_barras_divergentes", 1, null)).toEqual(["mayor_sin_info", "bajo_umbral", "extremos", "todas", "a_mano"]);
  });
  it("el tipo guardado siempre se ve, aunque ya no aplique", () => {
    expect(tiposOfrecidos("p_panorama", 1, "mayor_diferencia")).toContain("mayor_diferencia");
    expect(tiposOfrecidos("p_otro", 1, null)).toEqual([]);
  });
  it("rótulos directos, sin punto medio ni rayas", () => {
    expect(rotuloTipo("todas", "p_panorama")).toBe("Todas las de escala");
    expect(rotuloTipo("todas", "p_dumbbell")).toBe("Todas");
    for (const t of tiposOfrecidos("p_panorama", 3, null)) expect(rotuloTipo(t, "p_panorama")).not.toMatch(/[·—–]/);
  });
});

describe("Fortalezas y alertas (p_fortalezas)", () => {
  it("sin regla rige la del constructor: las n más altas y las n más bajas", () => {
    expect(reglaEfectiva("p_fortalezas", { n: 4 }, undefined)).toEqual({ tipo: "extremos", n: 4 });
    expect(reglaEfectiva("p_fortalezas", {}, undefined)).toEqual({ tipo: "extremos", n: 5 });
    expect(reglaEfectiva("p_fortalezas", {}, { tipo: "bajo_umbral", umbral: 60 })).toEqual({ tipo: "bajo_umbral", umbral: 60 });
    expect(reglaEfectiva("p_panorama", { n: 4 }, undefined)).toBeNull();
  });
  it("un público: ofrece extremos primero y nada que compare grupos", () => {
    expect(tiposOfrecidos("p_fortalezas", gruposDeLaLamina("p_fortalezas", { vars: ["docentes$*"] }), null))
      .toEqual(["extremos", "bajo_umbral", "mayor_sin_info", "todas", "a_mano"]);
  });
});

describe("leer y escribir la regla", () => {
  it("sin tipo conocido no hay regla (el contrato de siempre: las vars declaradas)", () => {
    expect(leerRegla(undefined)).toBeNull();
    expect(leerRegla({ tipo: "otra" })).toBeNull();
    expect(leerRegla(["todas"])).toBeNull();
  });
  it("conserva sólo lo que el tipo usa y limpia las listas", () => {
    expect(leerRegla({ tipo: "mayor_diferencia", n: 13, umbral: 5, agregar: ["a", "a", " "], quitar: [] }))
      .toEqual({ tipo: "mayor_diferencia", n: 13, agregar: ["a"] });
    expect(leerRegla({ tipo: "bajo_umbral", umbral: 60, n: 3 })).toEqual({ tipo: "bajo_umbral", umbral: 60 });
  });
  it("cambiar de tipo deja la regla limpia y pone la cifra por defecto", () => {
    const r = { tipo: "mayor_diferencia" as const, n: 13, quitar: ["x"] };
    expect(conTipo(r, "diferencia_minima", [])).toEqual({ tipo: "diferencia_minima", umbral: 15 });
    expect(conTipo(r, "mayor_sin_info", [])).toEqual({ tipo: "mayor_sin_info", n: 13 });
    expect(conTipo(null, "bajo_umbral", [])).toEqual({ tipo: "bajo_umbral", umbral: 60 });
    expect(conTipo(null, "todas", [])).toEqual({ tipo: "todas" });
  });
  it("«Elegidas a mano» arranca con lo que la lámina muestra", () => {
    expect(conTipo({ tipo: "todas" }, "a_mano", ["p1", "p2"])).toEqual({ tipo: "a_mano", agregar: ["p1", "p2"] });
  });
  it("la cifra va a n o a umbral según el tipo; vacía vuelve al defecto", () => {
    expect(conCifra({ tipo: "mayor_diferencia", n: 13 }, 8)).toEqual({ tipo: "mayor_diferencia", n: 8 });
    expect(conCifra({ tipo: "bajo_umbral", umbral: 60 }, null)).toEqual({ tipo: "bajo_umbral", umbral: 60 });
    expect(conCifra({ tipo: "todas" }, 4)).toEqual({ tipo: "todas" });
    expect(valorCifra({ tipo: "extremos" })).toBe(10);
    expect(campoCifra("todas")).toBeNull();
    expect(campoCifra("extremos")?.rotulo).toBe("Cuántas de cada lado");
    expect(limpiarRegla({ tipo: "comunes", n: 3, umbral: 2 })).toEqual({ tipo: "comunes" });
  });
});

describe("el ajuste a mano por fila", () => {
  const base = { tipo: "mayor_diferencia" as const, n: 3 };
  it("apagar una elegida la quita; volver a encenderla deshace el quitado", () => {
    const sin = alternarFila(base, "p1", true);
    expect(sin).toEqual({ tipo: "mayor_diferencia", n: 3, quitar: ["p1"] });
    expect(alternarFila(sin, "p1", false)).toEqual(base);
  });
  it("encender una que no estaba la agrega; apagarla deshace el agregado", () => {
    const con = alternarFila(base, "p9", false);
    expect(con).toEqual({ tipo: "mayor_diferencia", n: 3, agregar: ["p9"] });
    expect(alternarFila(con, "p9", true)).toEqual(base);
    expect(ajustadaAMano(con)).toBe(true);
    expect(volverALaRegla({ ...con, quitar: ["p1"] })).toEqual(base);
  });
  it("en «Elegidas a mano» la lista es agregar y la última no se apaga", () => {
    const mano = { tipo: "a_mano" as const, agregar: ["p1", "p2"] };
    expect(alternarFila(mano, "p2", true)).toEqual({ tipo: "a_mano", agregar: ["p1"] });
    expect(alternarFila(mano, "p3", false)).toEqual({ tipo: "a_mano", agregar: ["p1", "p2", "p3"] });
    expect(filaBloqueada({ tipo: "a_mano", agregar: ["p1"] }, "p1", true)).toBe(true);
    expect(filaBloqueada(mano, "p1", true)).toBe(false);
    expect(ajustadaAMano(mano)).toBe(false);
  });
});

describe("conteo y firma", () => {
  it("«13 de 47» con el formato de conteo", () => {
    expect(textoConteo({ seleccionadas: Array.from({ length: 13 }, (_, i) => `p${i}`), total: 1047 })).toBe("13 de 1,047");
  });
  it("la métrica se rotula como la ordena el backend", () => {
    expect(rotuloMetrica("mayor_diferencia", 2)).toBe("Diferencia");
    expect(rotuloMetrica("mayor_sin_info", 1)).toBe("Sin información");
    expect(rotuloMetrica("todas", 1)).toBe("Valor");
  });
  it("la firma no cambia con el orden de las claves ni con un objeto nuevo igual", () => {
    const a = firmaPedidoRegla("p_panorama", { vars: ["d$*"], regla: { tipo: "todas", n: undefined } }, "active");
    const b = firmaPedidoRegla("p_panorama", { regla: { tipo: "todas" }, vars: ["d$*"] }, "active");
    expect(a).toBe(b);
    expect(firmaPedidoRegla("p_panorama", {}, "consolidated")).not.toBe(firmaPedidoRegla("p_panorama", {}, "active"));
    expect(JSON.parse(jsonEstable({ z: 1, a: [1, { y: 2, b: null }] }))).toEqual({ a: [1, { b: null, y: 2 }], z: 1 });
  });
  it("dos conteos iguales son el mismo; el normalizador cae a valores seguros", () => {
    const c = normalizarConteoRegla({ total: "47", seleccionadas: ["p1"], candidatas: [{ tema: "p1", metrica: 12.5, seleccionada: true }, { etiqueta: "sin tema" }], texto_regla: "Se muestra 1.", avisos: "Uno" });
    expect(c).toEqual({ total: 47, seleccionadas: ["p1"], candidatas: [{ tema: "p1", etiqueta: "p1", metrica: 12.5, seleccionada: true }], texto_regla: "Se muestra 1.", avisos: ["Uno"] });
    expect(mismoConteo(c, normalizarConteoRegla(JSON.parse(JSON.stringify({ ...c }))))).toBe(true);
    expect(mismoConteo(c, { ...c, total: 48 })).toBe(false);
    expect(normalizarConteoRegla(null)).toEqual({ total: 0, seleccionadas: [], candidatas: [], texto_regla: "", avisos: [] });
  });
});
