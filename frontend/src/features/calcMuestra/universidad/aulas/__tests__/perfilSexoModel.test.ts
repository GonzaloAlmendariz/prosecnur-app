import { describe, expect, it } from "vitest";
import { construirPerfilSexo } from "../perfilSexoModel";

const aula = (faculty: string, f: number | null, m: number | null) => ({
  faculty,
  ...(f != null ? { sex_top_1: "F", sex_top_1_n: f } : {}),
  ...(m != null ? { sex_top_2: "M", sex_top_2_n: m } : {}),
});

describe("construirPerfilSexo", () => {
  it("suma F/M de los titulares por facultad y trae la referencia del marco", () => {
    const perfil = construirPerfilSexo(
      [aula("DERECHO", 20, 10), aula("DERECHO", 5, 15), aula("GESTIÓN", 8, 2)],
      [aula("DERECHO", 100, 100), aula("GESTIÓN", 30, 10)],
    );
    const derecho = perfil!.filas.find((f) => f.facultad === "DERECHO")!;
    expect(derecho).toMatchObject({ mujeres: 25, hombres: 25, titulares: 2, refMujeres: 0.5 });
    expect(perfil!.filas.find((f) => f.facultad === "GESTIÓN")).toMatchObject({
      mujeres: 8, hombres: 2, refMujeres: 0.75,
    });
    expect(perfil!.totales).toMatchObject({ mujeres: 33, hombres: 27, aulasSinSexo: 0 });
  });

  it("un aula sin sexo declarado no suma a nadie y SE CUENTA", () => {
    const perfil = construirPerfilSexo(
      [aula("DERECHO", 20, 10), { faculty: "DERECHO" }],
      [],
    );
    const derecho = perfil!.filas[0]!;
    expect(derecho).toMatchObject({ mujeres: 20, hombres: 10, aulasSinSexo: 1, titulares: 2 });
    // Sin marco, la referencia queda null — nunca un 0 que parezca medido.
    expect(derecho.refMujeres).toBeNull();
  });

  it("sin titulares devuelve null", () => {
    expect(construirPerfilSexo(null, [])).toBeNull();
    expect(construirPerfilSexo([], [])).toBeNull();
  });
});
