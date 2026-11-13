import { describe, expect, it } from "vitest";
import { plantillaPorId } from "./catalogoPlantillas";
import { avisoDeReemplazo, laminasDeEjemplo, rasgosDePlantilla, seleccionSinLeer } from "./modeloAdelanto";

const tipos = (id: string) => laminasDeEjemplo(plantillaPorId(id)!).map((l) => l.tipo);

describe("adelanto de la plantilla", () => {
  it("la territorial suma el mapa de cobertura y la en blanco sólo portada e índice", () => {
    expect(tipos("acnur")).toEqual(["portada", "indice", "seccion", "pregunta"]);
    expect(tipos("acnur-territorial")).toEqual(["portada", "indice", "mapa", "seccion", "pregunta"]);
    expect(tipos("blanco")).toEqual(["portada", "indice"]);
  });

  it("el estilo sale del perfil que declara la plantilla", () => {
    const estilo = (id: string) => rasgosDePlantilla(plantillaPorId(id)!).find((r) => r.clave === "estilo")?.valor;
    expect(estilo("acnur")).toBe("ACNUR");
    expect(estilo("pulso")).toBe("Pulso");
    expect(estilo("blanco")).toBeUndefined();
  });

  it("sin leer, la selección se dice con concordancia y el reemplazo sólo con láminas", () => {
    expect(seleccionSinLeer(0)).toBe("Entran todas las preguntas del cuestionario.");
    expect(seleccionSinLeer(1)).toBe("1 pregunta queda fuera del informe.");
    expect(seleccionSinLeer(3)).toBe("3 preguntas quedan fuera del informe.");
    expect(avisoDeReemplazo(0)).toBe("");
    expect(avisoDeReemplazo(1)).toBe(
      "El proyecto ya tiene un informe de 1 lámina. Reemplazarlo la borra; el informe aparte sale como un PowerPoint nuevo y la deja como está.",
    );
    expect(avisoDeReemplazo(1524)).toBe(
      "El proyecto ya tiene un informe de 1,524 láminas. Reemplazarlo las borra; el informe aparte sale como un PowerPoint nuevo y las deja como están.",
    );
  });
});
