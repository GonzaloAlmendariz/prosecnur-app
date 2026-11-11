// @vitest-environment happy-dom
/**
 * Caracterización de Carga: grupo "respuestas" (antes "datos"). Ver arnes.tsx.
 * Los escenarios que entraban por `pestana=datos` siguen como alias.
 */
import { describe } from "vitest";
import {
  VARIAS_SEPARADAS,
  base,
  escenario,
  escenariosDeAlias,
  escenariosDeMatriz,
  estado,
  estudio,
  fijar,
  montar,
  prepararGrupo,
} from "./arnes";

prepararGrupo("respuestas");

escenariosDeMatriz("respuestas");
escenariosDeAlias("datos", "respuestas");

describe("CargaPage, varias bases: Respuestas", () => {
  escenario("varias_separadas_respuestas_base-sin-respuestas", "Respuestas con una base hija de un grupo repetido y una base sin respuestas", async () => {
    const bases = [
      base("hogares"),
      base("miembros", { source_kind: "kobo_repeat", parent_base: "hogares", repeat_group: "miembros", n_filas: 900 }),
      base("pendiente", { data_file_id: "", n_filas: null, n_columnas: null }),
    ];
    await montar({
      estado: estado({
        has_estudio: true,
        estudio_processing_mode: "multibase",
        estudio_topology_declared: "separate",
        n_bases: 3,
        bases_nombres: bases.map((b) => b.nombre),
        active_base: "pendiente",
      }),
      estudio: estudio(bases, { active_base: "pendiente" }),
      pestana: "respuestas",
    });
    fijar("varias_separadas_respuestas_base-sin-respuestas");
  });

  escenario("varias_separadas_respuestas_con-selector", "Respuestas con dos bases cargadas: selector de base y hoja", async () => {
    await montar({ ...VARIAS_SEPARADAS, pestana: "respuestas" });
    fijar("varias_separadas_respuestas_con-selector");
  });

  escenario("varias_una-sola_respuestas", "una sola base declarada como separada: Respuestas sin selector", async () => {
    await montar({
      estado: estado({
        has_estudio: true,
        estudio_processing_mode: "multibase",
        estudio_topology_declared: "separate",
        n_bases: 1,
        bases_nombres: ["docentes"],
        active_base: "docentes",
      }),
      estudio: estudio([base("docentes")]),
      pestana: "respuestas",
    });
    fijar("varias_una-sola_respuestas");
  });
});
