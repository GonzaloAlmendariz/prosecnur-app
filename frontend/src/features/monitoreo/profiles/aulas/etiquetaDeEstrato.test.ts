import { describe, expect, it } from "vitest";

import { etiquetaDeEstrato, segmentoDeEstrato } from "./etiquetaDeEstrato";

describe("el estrato se lee sin descifrar códigos", () => {
  it("traduce el tramo de tamaño a su rango real", () => {
    // «G3» estaba en el eje del gráfico de brecha por estrato, sin leyenda ni
    // nota: nadie que no haya leído `calc_muestra_aulas.R` puede saber que son
    // aulas de 31 a 40 alumnos.
    expect(segmentoDeEstrato("G1")).toBe("hasta 20 alumnos");
    expect(segmentoDeEstrato("G2")).toBe("21-30 alumnos");
    expect(segmentoDeEstrato("G3")).toBe("31-40 alumnos");
    expect(segmentoDeEstrato("G4")).toBe("41 alumnos o más");
  });

  it("la F del estrato NO se traduce como «mujeres»", () => {
    // El segmento es `sex_top_1`, el sexo más frecuente del aula. En el mismo
    // perfil, las celdas de cuota sí llaman F a las mujeres: si aquí se
    // tradujera igual, la misma palabra tendría dos denominadores en una
    // pantalla y el estrato diría algo que no es.
    expect(segmentoDeEstrato("F")).toBe("mayoría mujeres");
    expect(segmentoDeEstrato("M")).toBe("mayoría hombres");
    expect(segmentoDeEstrato("F")).not.toBe("Mujeres");
  });

  it("compone la clave entera y respeta la facultad", () => {
    expect(etiquetaDeEstrato("GESTIÓN Y ALTA DIRECCIÓN / F / G3"))
      .toBe("GESTIÓN Y ALTA DIRECCIÓN · mayoría mujeres · 31-40 alumnos");
  });

  it("un segmento que no reconoce lo deja pasar, no lo borra", () => {
    // Una lista cerrada que se traga lo que no entiende deja el estrato mudo y
    // nadie se entera: el defecto se ve como un hueco, no como un error.
    expect(etiquetaDeEstrato("DERECHO / F / G9")).toBe("DERECHO · mayoría mujeres · G9");
    expect(etiquetaDeEstrato("global")).toBe("global");
  });

  it("una clave vacía no inventa un estrato", () => {
    expect(etiquetaDeEstrato("")).toBe("");
  });
});
