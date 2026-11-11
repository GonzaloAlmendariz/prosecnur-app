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
    for (const pestana of ["reglas", "hallazgos", "cierre", "explorar"]) {
      await pulsar(`#validacion-tab-${pestana}`);
      expect(document.querySelector(`#validacion-tab-${pestana}`)?.getAttribute("aria-selected")).toBe("true");
      expect(direccionActual()).toBe(`/validacion?pestana=${pestana}`);
      pasos.push(`<!-- dirección: ${direccionActual()} -->\n${mesa()}`);
    }
    fijarMesa("navegacion_recorrido", pasos);
  });

  escenario("navegacion_clave-con-guion", "la clave vieja reglas-custom, con guion, abre Reglas", async () => {
    await montar({ ...UNA_BASE, pestana: "reglas-custom", rutas: RUTAS });
    expect(document.querySelector("#validacion-tab-reglas")?.getAttribute("aria-selected")).toBe("true");
    fijarMesa("navegacion_clave-con-guion", [`<!-- dirección: ${direccionActual()} -->\n${mesa()}`]);
  });

  escenario("navegacion_clave-desconocida", "una pestaña que no existe cae en la primera", async () => {
    await montar({ ...UNA_BASE, pestana: "no-existe", rutas: RUTAS });
    fijarMesa("navegacion_clave-desconocida", [`<!-- dirección: ${direccionActual()} -->\n${mesa()}`]);
  });
});

// ADR 0142, rebanada V2 de P6: un enlace guardado con una clave vieja abre la
// pestaña donde quedó su contenido y la dirección no se reescribe al abrir.
describe("Validación, claves viejas que se leen como alias", () => {
  const casos = [
    ["navegacion_alias-instrumento", "/validacion?pestana=instrumento", "reglas"],
    ["navegacion_alias-reglas-custom", "/validacion?pestana=reglas_custom", "reglas"],
    ["navegacion_alias-limpieza", "/validacion?pestana=limpieza", "hallazgos"],
    // Plan de fidelidad, rebanada V0: el detalle de una regla del formulario pasa a
    // ser la ficha de Reglas (antes abría Hallazgos).
    ["navegacion_alias-panel-regla", "/validacion?pestana=instrumento&panel=regla&foco=R_REQ_EDAD", "reglas"],
  ] as const;
  for (const [nombre, entrada, destino] of casos) {
    escenario(nombre, `${entrada} abre ${destino} sin reescribir la dirección`, async () => {
      await montar({ ...UNA_BASE, entrada, rutas: RUTAS });
      expect(document.querySelector(`#validacion-tab-${destino}`)?.getAttribute("aria-selected")).toBe("true");
      expect(direccionActual()).toBe(entrada);
      fijarMesa(nombre, [`<!-- dirección: ${direccionActual()} -->\n${mesa()}`]);
    });
  }
});
