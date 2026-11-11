// @vitest-environment happy-dom
/**
 * Caracterización de Validación: grupo "explorar" (pestaña "Explorar
 * respuestas"). Ver arnes.tsx.
 *
 * La rebanada V1 no parte Explorar; estas huellas fijan su estado de entrada
 * para que la partición de las otras pestañas no la toque por accidente.
 */
import { describe } from "vitest";
import { Fallo, escenario, fijar, montar, prepararGrupo } from "./arnes";
import { DOS_BASES, RUTAS_EXPLORAR, UNA_BASE, limpieza, rutasLimpieza } from "./escenarios";

prepararGrupo("explorar");

const RUTAS = [...RUTAS_EXPLORAR, ...rutasLimpieza(limpieza({ auditoria: false }))];

describe("Validación, Explorar respuestas", () => {
  escenario("explorar_una-base", "una base: inventario y la primera pregunta", async () => {
    await montar({ ...UNA_BASE, pestana: "explorar", rutas: RUTAS });
    fijar("explorar_una-base");
  });

  escenario("explorar_sin-pestana", "sin pestaña en la dirección abre Explorar", async () => {
    await montar({ ...UNA_BASE, rutas: RUTAS });
    fijar("explorar_sin-pestana");
  });

  escenario("explorar_dos-bases", "dos bases: la base activa viaja en cada pedido", async () => {
    await montar({ ...DOS_BASES, pestana: "explorar", rutas: RUTAS });
    fijar("explorar_dos-bases");
  });

  escenario("explorar_sin-datos", "el backend dice que aún no hay base: estado inicial, no avería", async () => {
    await montar({
      ...UNA_BASE,
      pestana: "explorar",
      rutas: [
        ["GET", /^\/api\/validacion\/v2\/explorar\/variables/, new Fallo("E_NO_DATA_INST", "No hay data o instrumento cargado para esta base.", 409)],
        ...RUTAS,
      ],
    });
    fijar("explorar_sin-datos");
  });
});
