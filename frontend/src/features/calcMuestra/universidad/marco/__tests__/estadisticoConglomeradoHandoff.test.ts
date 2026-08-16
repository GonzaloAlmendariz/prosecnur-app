/**
 * El estadístico elegido en el Recorrido tiene que salir en el payload que va a
 * R, no quedarse en la pantalla. La traducción del nombre cruzado ya está
 * cubierta aparte; aquí se comprueba lo otro, que es donde un cableado se queda
 * a medias: que alguien lo consume.
 */
import { describe, expect, it } from "vitest";

import {
  prepareUniversityStudyForCalculation,
  universityComponents,
  universityDefaultWorkspace,
} from "../../shared/study";
import type { CalcMuestraEstudio } from "../../../../../api/client";

function estudio(): CalcMuestraEstudio {
  const componentes = universityComponents([]);
  return {
    titulo: "HSVG",
    macro_familia: "opinion_universitaria",
    componentes,
    workspace: universityDefaultWorkspace(),
  } as unknown as CalcMuestraEstudio;
}

describe("el estadístico del Recorrido llega a los parámetros del motor", () => {
  it("escribe estadistico_conglomerado en los dos componentes", () => {
    const preparado = prepareUniversityStudyForCalculation(
      estudio(),
      universityDefaultWorkspace(),
      "min_mediana_media",
    );
    expect(preparado.componentes).toHaveLength(2);
    for (const comp of preparado.componentes) {
      // Con el nombre del motor, no con el del Recorrido: si viajara
      // `min_mediana_media`, `calc_enum` lo descartaría y volvería a la media.
      expect(comp.parametros.estadistico_conglomerado).toBe("min_media_mediana");
    }
  });

  it("respeta la opción que el usuario elija, no una fija", () => {
    for (const [elegido, esperado] of [
      ["media", "media"],
      ["mediana", "mediana"],
      ["li_bootstrap", "min_media_mediana"],
    ] as const) {
      const preparado = prepareUniversityStudyForCalculation(
        estudio(),
        universityDefaultWorkspace(),
        elegido,
      );
      expect(preparado.componentes[0].parametros.estadistico_conglomerado).toBe(esperado);
    }
  });

  it("sin resumen no inventa un estadístico", () => {
    // Los llamadores que no conocen el Recorrido dejan el parámetro como esté;
    // escribir uno por defecto sería decidir por ellos.
    const antes = estudio().componentes[0].parametros.estadistico_conglomerado;
    const preparado = prepareUniversityStudyForCalculation(estudio(), universityDefaultWorkspace());
    expect(preparado.componentes[0].parametros.estadistico_conglomerado).toBe(antes);
  });

  it("no pisa el resto de los parámetros", () => {
    const base = estudio();
    const preparado = prepareUniversityStudyForCalculation(
      base,
      universityDefaultWorkspace(),
      "mediana",
    );
    const original = universityComponents(base.componentes)[0].parametros;
    expect(preparado.componentes[0].parametros.deff).toBe(original.deff);
    expect(preparado.componentes[0].parametros.p).toBe(original.p);
    expect(preparado.componentes[0].parametros.oversample_pct).toBe(original.oversample_pct);
  });
});
