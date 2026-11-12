// @vitest-environment happy-dom
/**
 * Caracterización de Validación: grupo "explorar" (pestaña "Explorar
 * respuestas"). Ver arnes.tsx.
 *
 * La rebanada V1 no parte Explorar; estas huellas fijan su estado de entrada
 * para que la partición de las otras pestañas no la toque por accidente. La
 * V5 le pone la cabecera del prototipo y el panel "Reglas sobre esta
 * pregunta", que lee el catálogo de reglas (un pedido más por base).
 */
import { describe, expect } from "vitest";
import { Fallo, cuerposEnviados, direccionActual, escenario, fijar, montar, prepararGrupo, pulsar } from "./arnes";
import { useValidacionStore } from "../store";
import { DOS_BASES, RUTAS_EXPLORAR, UNA_BASE, catalogoDeReglas, limpieza, rutaCatalogo, rutasLimpieza } from "./escenarios";

prepararGrupo("explorar");

const RUTAS = [
  ...RUTAS_EXPLORAR,
  ...rutasLimpieza(limpieza({ auditoria: false })),
  rutaCatalogo(catalogoDeReglas({ plan: true, auditoria: true })),
];

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

  escenario("explorar_pregunta-en-la-direccion", "la pregunta se lee del foco y se escribe al elegir otra", async () => {
    await montar({ ...UNA_BASE, entrada: "/validacion?pestana=explorar&foco=sexo", rutas: RUTAS });
    expect(cuerposEnviados().map((c) => JSON.parse(c.split("\n")[1] ?? "{}").var)).toEqual(["sexo"]);
    await pulsar(".vx-pregunta-fila", "Servicios recibidos");
    expect(direccionActual()).toBe("/validacion?pestana=explorar&foco=q7");
    fijar("explorar_pregunta-en-la-direccion");
  });

  escenario("explorar_enlace-por-el-store", "el enlace viejo por el store pasa al foco aunque la base se conozca después", async () => {
    useValidacionStore.getState().setPrefill("explorar", { var: "q7" });
    await montar({ ...UNA_BASE, pestana: "explorar", rutas: RUTAS });
    expect(direccionActual()).toBe("/validacion?pestana=explorar&foco=q7");
    expect(cuerposEnviados().map((c) => JSON.parse(c.split("\n")[1] ?? "{}").var)).toEqual(["q7"]);
    fijar("explorar_enlace-por-el-store");
  });

  escenario("explorar_nueva-regla-sobre-pregunta", "las reglas de la pregunta abren su ficha en Reglas o una regla nueva sobre ella", async () => {
    await montar({ ...UNA_BASE, pestana: "explorar", rutas: RUTAS });
    // La regla con casos por decidir va primero y lleva a su ficha, en su familia.
    await pulsar(".vx-reglas-lista button", "Abrir");
    expect(direccionActual()).toBe("/validacion?pestana=reglas&foco=R_REQ_EDAD&familia=obligatoria");
    await montar({ ...UNA_BASE, pestana: "explorar", rutas: RUTAS });
    await pulsar(".pulso-panel-de-mesa--reglas-pregunta .pulso-panel-de-mesa-pie button", "Nueva regla sobre esta pregunta");
    expect(direccionActual()).toBe("/validacion?pestana=reglas&panel=regla&foco=nueva&pregunta=edad");
    fijar("explorar_nueva-regla-sobre-pregunta");
  });
});
