import { describe, expect, it } from "vitest";
import { aperturaDelCenso } from "./aperturaDelCenso";

describe("Ponderación: apertura de las metas del censo", () => {
  it("se abre solo mientras un estudio territorial no trae metas del censo", () => {
    expect(aperturaDelCenso(null, true, 0)).toEqual({ elegido: true, abierto: true, montado: true });
  });

  it("con metas del censo ya puestas espera al botón y no se monta", () => {
    expect(aperturaDelCenso(null, true, 2)).toEqual({ elegido: null, abierto: false, montado: false });
  });

  it("aplicar el primer margen no lo cierra: la apertura quedó fijada", () => {
    const antes = aperturaDelCenso(null, true, 0);
    // "Usar como metas" sube el conteo de metas del censo de 0 a 1.
    expect(aperturaDelCenso(antes.elegido, true, 1)).toEqual({ elegido: true, abierto: true, montado: true });
  });

  it("cerrado con el botón sigue montado, y reabrirlo no depende de las metas", () => {
    expect(aperturaDelCenso(false, true, 0)).toEqual({ elegido: false, abierto: false, montado: true });
    expect(aperturaDelCenso(false, true, 3)).toEqual({ elegido: false, abierto: false, montado: true });
    expect(aperturaDelCenso(true, true, 3)).toEqual({ elegido: true, abierto: true, montado: true });
  });

  it("si la población no es un territorio no se ofrece ni se abre", () => {
    expect(aperturaDelCenso(null, false, 0)).toEqual({ elegido: null, abierto: false, montado: false });
    expect(aperturaDelCenso(true, false, 0)).toMatchObject({ abierto: false, montado: false });
  });
});
