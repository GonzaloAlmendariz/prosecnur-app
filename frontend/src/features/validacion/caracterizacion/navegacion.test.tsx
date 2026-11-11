// @vitest-environment happy-dom
/**
 * Caracterización de Validación: grupo "navegacion". Ver arnes.tsx.
 *
 * Mide solo el riel de pestañas y la cabecera tras cada paso del recorrido (no
 * el cuerpo ni los pedidos), para que rediseñar una pestaña no ponga en rojo
 * estas huellas. Es el único grupo que fija el riel.
 */
import { describe, expect } from "vitest";
import { direccionActual, escenario, fijarMesa, mesa, montar, prepararGrupo, pulsar } from "./arnes";
import {
  RUTAS_EXPLORAR,
  REGLAS_PROPIAS,
  UNA_BASE,
  limpieza,
  rutasInstrumento,
  rutasLimpieza,
  rutasReglasPropias,
} from "./escenarios";

prepararGrupo("navegacion");

const RUTAS = [
  ...rutasInstrumento(true, true),
  ...rutasReglasPropias(REGLAS_PROPIAS),
  ...rutasLimpieza(limpieza({ auditoria: false })),
  ...RUTAS_EXPLORAR,
];

describe("Validación, navegación entre pestañas", () => {
  escenario("navegacion_recorrido", "recorre las cuatro pestañas desde el riel; la dirección las nombra", async () => {
    await montar({ ...UNA_BASE, pestana: "explorar", rutas: RUTAS });
    const pasos = [mesa()];
    for (const pestana of ["instrumento", "reglas_custom", "limpieza", "explorar"]) {
      await pulsar(`#validacion-tab-${pestana}`);
      expect(document.querySelector(`#validacion-tab-${pestana}`)?.getAttribute("aria-selected")).toBe("true");
      pasos.push(`<!-- dirección: ${direccionActual()} -->\n${mesa()}`);
    }
    fijarMesa("navegacion_recorrido", pasos);
  });

  escenario("navegacion_clave-con-guion", "reglas-custom con guion abre Criterios de revisión", async () => {
    await montar({ ...UNA_BASE, pestana: "reglas-custom", rutas: RUTAS });
    fijarMesa("navegacion_clave-con-guion", [`<!-- dirección: ${direccionActual()} -->\n${mesa()}`]);
  });

  escenario("navegacion_clave-desconocida", "una pestaña que no existe cae en la primera", async () => {
    await montar({ ...UNA_BASE, pestana: "no-existe", rutas: RUTAS });
    fijarMesa("navegacion_clave-desconocida", [`<!-- dirección: ${direccionActual()} -->\n${mesa()}`]);
  });
});
