// Mata: el 3 fijo del atajo, un límite que borra las opciones que van solas, «entre» invertido y un «or» que pierde
// su sentido al sumarle el límite.
import { describe, expect, test } from "vitest";
import { escribirCuantas, leerCuantas, mensajeCuantas, problemaCuantas, resumenCuantas } from "./cuantasOpcionesModelo";
import { escribirSolas, leerSolas } from "./opcionesSolasModelo";

describe("cuántas opciones puede marcar", () => {
  test("lee cada forma con su número", () => {
    expect(leerCuantas("count-selected(.) <= 5").limite).toEqual({ modo: "maximo", min: null, max: 5 });
    expect(leerCuantas("count-selected(.) >= 2").limite).toEqual({ modo: "alMenos", min: 2, max: null });
    expect(leerCuantas("count-selected(.) > 1").limite).toEqual({ modo: "alMenos", min: 2, max: null });
    expect(leerCuantas("count-selected(.) = 3").limite).toEqual({ modo: "exactamente", min: 3, max: 3 });
    expect(leerCuantas("count-selected(.) >= 2 and count-selected(.) <= 4").limite).toEqual({ modo: "entre", min: 2, max: 4 });
    expect(leerCuantas("").limite.modo).toBe("libre");
  });

  test("escribe con el número elegido y conserva las opciones que van solas", () => {
    const solas = escribirSolas("", ["99"]);
    const con = escribirCuantas(solas, { modo: "maximo", min: null, max: 4 });
    expect(con).toBe("not(selected(., '99') and count-selected(.) > 1) and count-selected(.) <= 4");
    expect(leerSolas(con).solas).toEqual(["99"]);
    expect(leerCuantas(con).limite).toEqual({ modo: "maximo", min: null, max: 4 });
    // Cambiar el límite reemplaza el anterior; quitarlo deja sólo lo demás.
    expect(escribirCuantas(con, { modo: "entre", min: 2, max: 3 })).toBe("not(selected(., '99') and count-selected(.) > 1) and count-selected(.) >= 2 and count-selected(.) <= 3");
    expect(escribirCuantas(con, { modo: "libre", min: null, max: null })).toBe("not(selected(., '99') and count-selected(.) > 1)");
  });

  test('un "or" dentro de not(…) no se envuelve otra vez', () => {
    const solas = escribirSolas("", ["98", "99"]);
    expect(escribirCuantas(solas, { modo: "maximo", min: null, max: 4 })).toBe(`${solas} and count-selected(.) <= 4`);
    expect(escribirSolas(`${solas} and count-selected(.) <= 4`, ["99"])).toBe("count-selected(.) <= 4 and not(selected(., '99') and count-selected(.) > 1)");
  });

  test('un "or" del resto queda entre paréntesis', () => {
    expect(escribirCuantas("selected(., 'a') or selected(., 'b')", { modo: "alMenos", min: 2, max: null }))
      .toBe("(selected(., 'a') or selected(., 'b')) and count-selected(.) >= 2");
  });

  test("avisa números imposibles", () => {
    expect(problemaCuantas({ modo: "entre", min: 4, max: 2 })).toMatch(/menor/);
    expect(problemaCuantas({ modo: "maximo", min: null, max: 0 })).toMatch(/1 o más/);
    expect(problemaCuantas({ modo: "alMenos", min: 7, max: null }, 5)).toBe("La pregunta tiene 5 opciones.");
    expect(problemaCuantas({ modo: "maximo", min: null, max: 2 }, 5)).toBeNull();
  });

  test("mensaje y resumen en castellano", () => {
    expect(mensajeCuantas({ modo: "exactamente", min: 1, max: 1 })).toBe("Marca exactamente 1 opción.");
    expect(mensajeCuantas({ modo: "entre", min: 2, max: 3 })).toBe("Marca entre 2 y 3 opciones.");
    expect(resumenCuantas({ modo: "maximo", min: null, max: 3 })).toBe("Máximo 3 opciones");
  });
});
