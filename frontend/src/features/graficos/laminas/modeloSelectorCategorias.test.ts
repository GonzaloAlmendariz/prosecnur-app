import { describe, expect, it } from "vitest";
import { fichaBloqueada, GRUPO, marcadas, NIVEL, RESPUESTA, resumenFichas, trasPulsar } from "./modeloSelectorCategorias";

const NIVELES = ["6", "7", "8", "9"];

describe("«Niveles que se muestran» (H9): nada guardado es todos", () => {
  it("arranca con todas las fichas marcadas y «Todos (N)»", () => {
    expect([...marcadas(new Set(), NIVELES, true)]).toEqual(NIVELES);
    expect(resumenFichas(0, 4, "elegir", NIVEL, true)).toBe("Todos (4)");
  });

  it("quitar una ficha saca ese nivel", () => {
    expect(trasPulsar("7", new Set(), NIVELES, "elegir", true)).toEqual(["6", "8", "9"]);
    expect(resumenFichas(3, 4, "elegir", NIVEL, true)).toBe("3 de 4 niveles");
  });

  it("volver a marcar todas guarda la lista vacía, la forma de «todos»", () => {
    expect(trasPulsar("7", new Set(["6", "8", "9"]), NIVELES, "elegir", true)).toEqual([]);
  });

  it("la última marcada no se quita: quedaría «ninguno», que el motor leería como todos", () => {
    expect(fichaBloqueada("8", marcadas(new Set(["8"]), NIVELES, true), true)).toBe(true);
    expect(trasPulsar("8", new Set(["8"]), NIVELES, "elegir", true)).toEqual(["8"]);
    expect(fichaBloqueada("8", marcadas(new Set(["8", "9"]), NIVELES, true), true)).toBe(false);
  });
});

describe("elegir y excluir: concordancia con el sustantivo", () => {
  it("elegir sin `vacioEsTodos` sigue siendo «lo marcado es lo que cuenta»", () => {
    expect(trasPulsar("1", new Set(), ["1", "2"], "elegir")).toEqual(["1"]);
    expect(resumenFichas(0, 2, "elegir", RESPUESTA)).toBe("Ninguna respuesta elegida");
    expect(resumenFichas(0, 2, "elegir", NIVEL)).toBe("Ningún nivel elegido");
    expect(resumenFichas(1, 2, "elegir", NIVEL)).toBe("Uno elegido");
    expect(resumenFichas(2, 3, "elegir", RESPUESTA)).toBe("2 elegidas");
  });

  it("excluir", () => {
    expect(resumenFichas(0, 3, "excluir", RESPUESTA)).toBe("Se muestran todas");
    expect(resumenFichas(0, 3, "excluir", GRUPO)).toBe("Se muestran todos");
    expect(resumenFichas(1, 3, "excluir", RESPUESTA)).toBe("Una excluida");
    expect(resumenFichas(2, 3, "excluir", GRUPO)).toBe("2 excluidos");
  });

  it("«una»: marcar otra cambia la elegida; pulsar la elegida la quita", () => {
    expect(trasPulsar("2", new Set(["1"]), ["1", "2"], "una")).toEqual(["2"]);
    expect(trasPulsar("1", new Set(["1"]), ["1", "2"], "una")).toEqual([]);
  });
});
