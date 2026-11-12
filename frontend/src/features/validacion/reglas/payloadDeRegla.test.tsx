// @vitest-environment happy-dom
/**
 * Huella de lo que guarda el editor de reglas propias, un escenario por tipo.
 *
 * Monta `ReglaEditor` con una regla inicial válida de cada tipo, la guarda sin
 * tocar nada y fija, en claro, el valor que entrega a `onSubmit`: es el cuerpo
 * exacto del POST o PUT de `/reglas_custom`. Desde la rebanada V2 del plan de
 * fidelidad `ReglaEditor` es el panel de regla (antes, un asistente de tres
 * pasos que se recorría con "Siguiente"): el `guardado` de cada huella es el
 * mismo que con el asistente; el marcado cambió con el panel. Usa el arnés de
 * la caracterización (`../caracterizacion/arnes.tsx`).
 */
import { afterAll, beforeAll, describe, expect } from "vitest";
import { ESPERA_DEL_CONTEO_MS, fijarEsperaDelConteoParaPruebas } from "./panel/conteoPrevio";
import type { ReglaCustom } from "../types";
import ReglaEditor from "../components/ReglaEditor";
import { escenario, fijarGuardado, montarSuelto, prepararGrupo, pulsar } from "../caracterizacion/arnes";
import { INVENTARIO, RUTAS_EXPLORAR, reglaPropia } from "../caracterizacion/escenarios";

prepararGrupo("payloadDeRegla");

// El conteo previo del panel de regla no es lo que se mide aquí: se aleja, para
// que la huella no dependa de lo cargada que esté la máquina (lo mide reglasPanel).
beforeAll(() => {
  fijarEsperaDelConteoParaPruebas(60_000);
});
afterAll(() => {
  fijarEsperaDelConteoParaPruebas(ESPERA_DEL_CONTEO_MS);
});

type Caso = [nombre: string, inicial: ReglaCustom];

const CASOS: Caso[] = [
  ["no-nulo", reglaPropia("RC_101", { tipo: "no_nulo", nombre: "", mensaje: "", params: {}, planned_action_type: undefined, recommended_scope: undefined })],
  ["rango-num", reglaPropia("RC_102")],
  ["rango-fecha", reglaPropia("RC_103", { tipo: "rango_fecha", variables: ["fecha"], params: { min: "2026-01-05", max: "2026-03-31" } })],
  ["outliers-iqr", reglaPropia("RC_104", { tipo: "outliers_iqr", params: { k: 1.5 }, planned_action_type: undefined, recommended_scope: undefined })],
  ["outliers-z", reglaPropia("RC_105", { tipo: "outliers_z", params: { k: "3" } })],
  ["duplicados", reglaPropia("RC_106", { tipo: "duplicados", variables: ["sexo", "edad"], params: {}, planned_action_type: undefined, recommended_scope: undefined })],
  ["fuera-catalogo", reglaPropia("RC_107", { tipo: "fuera_catalogo", variables: ["sexo"], params: { valores: ["1", "2"] } })],
  ["coherencia-2v", reglaPropia("RC_108", {
    tipo: "coherencia_2v",
    variables: ["sexo", "edad"],
    params: { op_x: "==", valor_x: "1", op_y: "not_in", valor_y: ["4", "5"] },
    hallazgo_kind: "caso_validar",
    severidad: "advertencia",
    gate_conditions: [{ variable: "q7", op: "contains_any", value: ["1", "2"] }],
  })],
  ["sm-jerarquia", reglaPropia("RC_109", {
    tipo: "select_multiple_hierarchy",
    variables: ["q7"],
    params: { hierarchy_rows: [{ trigger: "3", required: ["1", "2", "3"] }] },
    planned_action_type: undefined,
    recommended_scope: undefined,
  })],
  ["sm-exclusiva", reglaPropia("RC_110", { tipo: "select_multiple_exclusive", variables: ["q7"], params: { exclusive_codes: "9\n8" } })],
  ["sm-cantidad", reglaPropia("RC_111", { tipo: "select_multiple_cardinality", variables: ["q7"], params: { min: "1", max: "3" } })],
  ["sm-seleccion", reglaPropia("RC_112", {
    tipo: "select_multiple_selection",
    variables: ["q7"],
    params: { op: "contains_all", codes: "1, 2" },
    gate_conditions: [{ variable: "edad", op: ">=", value: "18" }, { variable: "sexo", op: "in", value: ["1"] }],
  })],
  ["inactiva-sin-nombre", reglaPropia("RC_113", { activa: false, nombre: "", mensaje: "", hallazgo_kind: undefined, severidad: "info" })],
];

describe("ReglaEditor: lo que entrega a onSubmit, por tipo", () => {
  for (const [nombre, inicial] of CASOS) {
    escenario(`regla_${nombre}`, `${inicial.tipo}: abre la regla y la guarda sin cambios`, async () => {
      const enviados: string[] = [];
      await montarSuelto(
        <ReglaEditor
          inv={INVENTARIO}
          baseNombre="default"
          inicial={inicial}
          onSubmit={async (payload) => {
            enviados.push(JSON.stringify(payload, null, 2));
          }}
          onCancel={() => undefined}
        />,
        { rutas: RUTAS_EXPLORAR },
      );
      await pulsar(".pulso-dialog__actions button", "Guardar");
      expect(enviados, "el panel no entregó el cuerpo: la regla no validó").toHaveLength(1);
      fijarGuardado(`regla_${nombre}`, enviados);
    });
  }
});
