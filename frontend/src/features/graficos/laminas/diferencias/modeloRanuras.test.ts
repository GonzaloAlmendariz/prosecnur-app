// Mata: una lámina de varios gráficos que sólo muestra la primera ranura, un inspector que pinta las diferencias de otro
// gráfico, una ranura en error sin su motivo, la cabecera que aparece con una sola ranura (debe verse como antes) y una
// revisión del informe cuyas filas no cuadran con el `resumen` por ranura.
import { describe, expect, it } from "vitest";
import { normalizeDiferenciasLamina } from "../../../../api/graficosDiferencias";
import { avisoDeRanura, bloqueConPares, bloquesDeLamina, filasPorRanura, ranuraDelGrafico } from "./modeloRanuras";

const par = { fila: "Sí", a: "A", b: "B", dif: 20, p_ajustado: 0.001, veredicto: "marcada" };
const ranura = (extra: Record<string, unknown>) => ({ estado: "con_marcas", cruce: "sexo", pares: [par], ...extra });
const nombres: Record<string, string> = { p_barras_agrupadas: "Barras agrupadas", p_barras_apiladas: "Barras apiladas" };
const posiciones: Record<string, number> = { grafico_1: 1, grafico_2: 2, grafico_4: 4 };
const nombreDe = (r: { graficador: string; ranura: string }) => ({ nombre: nombres[r.graficador] ?? "", posicion: posiciones[r.ranura] ?? null });

const CUATRO = normalizeDiferenciasLamina({
  slide_id: "s4", titulo: "Cuatro gráficos", ...ranura({}),
  ranuras: [
    ranura({ ranura: "grafico_1", indice: 1, graficador: "p_barras_agrupadas", base: "estudiantes" }),
    ranura({ ranura: "grafico_2", indice: 2, graficador: "p_barras_apiladas", base: "estudiantes", estado: "abstencion", pares: [], motivo: "Es una escala sin Top Two Box declarado." }),
    ranura({ ranura: "grafico_4", indice: 6, graficador: "p_barras_agrupadas", base: "docentes", estado: "error", pares: [], error: { code: "E_SIG_PRUEBA_FALLO", message: "La prueba no pudo ejecutarse en esta lámina." } }),
  ],
});

describe("bloquesDeLamina", () => {
  it("un bloque por ranura con cruce; con bases distintas la cabecera dice la base", () => {
    const b = bloquesDeLamina(CUATRO, nombreDe);
    expect(b.map((x) => x.titulo)).toEqual([
      "Gráfico 1: Barras agrupadas, base Estudiantes",
      "Gráfico 2: Barras apiladas, base Estudiantes",
      "Gráfico 4: Barras agrupadas, base Docentes",
    ]);
    expect(b.every((x) => x.conCabecera)).toBe(true);
  });

  it("la ranura enfocada va primero; el resto conserva el orden del payload", () => {
    expect(bloquesDeLamina(CUATRO, nombreDe, "grafico_4").map((x) => x.clave)).toEqual(["grafico_4", "grafico_1", "grafico_2"]);
    expect(bloquesDeLamina(CUATRO, nombreDe, "no_existe").map((x) => x.clave)).toEqual(["grafico_1", "grafico_2", "grafico_4"]);
  });

  it("error y abstención dicen por qué en una línea; la que comparó no lleva aviso", () => {
    const [uno, dos, cuatro] = bloquesDeLamina(CUATRO, nombreDe);
    expect(uno.aviso).toBeNull();
    expect(dos.aviso).toBe("Es una escala sin Top Two Box declarado.");
    expect(cuatro.aviso).toBe("La prueba no pudo ejecutarse en esta lámina.");
    expect(avisoDeRanura({ estado: "sin_cruce", motivo: null, nota: "", error: null })).toMatch(/dos grupos/);
  });

  it("con una sola ranura no hay cabecera: se ve como antes", () => {
    const una = bloquesDeLamina(normalizeDiferenciasLamina({ slide_id: "s1", ...ranura({}) }), nombreDe);
    expect(una).toHaveLength(1);
    expect(una[0]).toMatchObject({ conCabecera: false, titulo: "" });
  });

  it("«Gráfico N» es la posición entre los gráficos de la lámina, no el índice del payload (que cuenta el título)", () => {
    expect(bloquesDeLamina(CUATRO, nombreDe).at(-1)?.titulo).toMatch(/^Gráfico 4:/);
  });

  it("misma base en todas: la cabecera no repite la base", () => {
    const l = normalizeDiferenciasLamina({
      slide_id: "s2", ...ranura({}),
      ranuras: [ranura({ ranura: "a", indice: 1, graficador: "p_barras_agrupadas", base: "e" }), ranura({ ranura: "b", indice: 2, graficador: "x", base: "e" })],
    });
    expect(bloquesDeLamina(l, nombreDe).map((x) => x.titulo)).toEqual(["Gráfico 1: Barras agrupadas", "Gráfico 2"]);
  });

  it("el par se detalla en la ranura elegida si tiene pares; si no, en la primera que los tenga", () => {
    const b = bloquesDeLamina(CUATRO, nombreDe);
    expect(bloqueConPares(b, "grafico_2")?.clave).toBe("grafico_1");
    expect(bloqueConPares(b, null)?.clave).toBe("grafico_1");
  });
});

describe("ranuraDelGrafico (inspector)", () => {
  it("cada tarjeta ve sólo su ranura, nunca la de otro gráfico", () => {
    expect(ranuraDelGrafico(CUATRO, "grafico_4")?.estado).toBe("error");
    expect(ranuraDelGrafico(CUATRO, "grafico_3")).toBeNull();
  });
  it("backend sin `ranuras`: la única ranura vale para el gráfico", () => {
    const l = normalizeDiferenciasLamina({ slide_id: "s1", ...ranura({}) });
    expect(ranuraDelGrafico(l, "grafico")?.estado).toBe("con_marcas");
  });
});

describe("filasPorRanura (revisión del informe)", () => {
  it("una fila por ranura con clave única y el nombre del gráfico", () => {
    const filas = filasPorRanura([CUATRO], nombreDe, () => ({ posicion: 7, titulo: "Del plan" }));
    expect(filas.map((f) => f.clave)).toEqual(["s4:grafico_1", "s4:grafico_2", "s4:grafico_4"]);
    expect(filas.every((f) => f.posicion === 7 && f.titulo === "Cuatro gráficos")).toBe(true);
    expect(filas[2].grafico).toBe("Gráfico 4: Barras agrupadas, base Docentes");
  });
});
