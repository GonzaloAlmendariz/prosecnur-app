// @vitest-environment happy-dom
/** Caracterización de Carga: grupo "hidratacion". Ver arnes.tsx. */
import { describe } from "vitest";
import {
  EN_VUELO,
  Fallo,
  VARIAS_SEPARADAS,
  escenario,
  fijar,
  montar,
  prepararGrupo,
} from "./arnes";

prepararGrupo("hidratacion");

describe("CargaPage, mientras se hidrata", () => {
  for (const pestana of ["plan", "fuentes"]) {
    escenario(`hidratando_sin-sesion_${pestana}`, `sin estado de sesión: ${pestana}`, async () => {
      await montar({ estado: null, pestana });
      fijar(`hidratando_sin-sesion_${pestana}`);
    });
  }

  escenario("hidratando_error-de-sesion", "la sesión falló", async () => {
    await montar({ estado: null, pestana: "plan", errorSesion: "No se pudo leer la sesión" });
    fijar("hidratando_error-de-sesion");
  });

  for (const pestana of ["plan", "revision"]) {
    escenario(`hidratando_estudio-en-vuelo_${pestana}`, `varias bases, estudio en vuelo: ${pestana}`, async () => {
      await montar({ estado: VARIAS_SEPARADAS.estado, estudio: EN_VUELO, pestana });
      fijar(`hidratando_estudio-en-vuelo_${pestana}`);
    });
  }

  escenario("hidratando_error-de-estudio", "varias bases, la lectura del estudio falló", async () => {
    await montar({ estado: VARIAS_SEPARADAS.estado, estudio: new Fallo("E_PRUEBA", "No se pudo leer el estudio"), pestana: "fuentes" });
    fijar("hidratando_error-de-estudio");
  });
});
