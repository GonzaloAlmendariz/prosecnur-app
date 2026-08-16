import { describe, expect, it } from "vitest";

import { estadisticoConglomeradoDe } from "../estadisticoConglomerado";
import type { ResumenEstAula } from "../../../dominio";

describe("estadisticoConglomeradoDe", () => {
  it("traduce el nombre cruzado en vez de pasarlo tal cual", () => {
    // LA trampa: el Recorrido dice `min_mediana_media` y el motor espera
    // `min_media_mediana`. Con las palabras en ese orden, `calc_enum` del motor
    // no reconoce el valor, cae a la media y nadie se entera.
    expect(estadisticoConglomeradoDe("min_mediana_media")).toBe("min_media_mediana");
    expect(estadisticoConglomeradoDe("min_mediana_media")).not.toBe("min_mediana_media");
  });

  it("los dos que sí coinciden pasan intactos", () => {
    expect(estadisticoConglomeradoDe("media")).toBe("media");
    expect(estadisticoConglomeradoDe("mediana")).toBe("mediana");
  });

  it("el bootstrap cae al mínimo, que es a donde ya degrada el Recorrido", () => {
    // El motor no calcula la cota inferior del intervalo. Traducirlo a la media
    // sería lo contrario de lo que el Recorrido pretende con esa opción —una
    // cifra conservadora—, así que se elige el más conservador de los tres.
    expect(estadisticoConglomeradoDe("li_bootstrap")).toBe("min_media_mediana");
  });

  it("cubre todos los resúmenes del Recorrido y sólo devuelve valores del motor", () => {
    // Si mañana el Recorrido gana una opción, el switch deja de compilar; este
    // test vigila lo otro: que ninguna salida se escape del enum del motor.
    const todos: ResumenEstAula[] = ["min_mediana_media", "media", "mediana", "li_bootstrap"];
    const validos = new Set(["media", "mediana", "min_media_mediana"]);
    for (const resumen of todos) {
      expect(validos.has(estadisticoConglomeradoDe(resumen))).toBe(true);
    }
  });
});
