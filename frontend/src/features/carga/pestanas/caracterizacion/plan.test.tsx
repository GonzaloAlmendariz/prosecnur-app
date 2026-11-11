// @vitest-environment happy-dom
/** Caracterización de Carga: grupo "plan". Ver arnes.tsx. */
import { describe } from "vitest";
import { useCargaStore } from "../../store";
import {
  UNA_BASE_VACIA,
  escenario,
  escenariosDeMatriz,
  fijar,
  montar,
  prepararGrupo,
} from "./arnes";

prepararGrupo("plan");

escenariosDeMatriz("plan");

describe("CargaPage, una base: Plan", () => {
  escenario("una-base_plan_plan-de-varias-bases", "con varias bases declaradas en Plan: Plan", async () => {
    useCargaStore.getState().setTopologyIntent("integrated");
    await montar({ estado: UNA_BASE_VACIA, pestana: "plan" });
    fijar("una-base_plan_plan-de-varias-bases");
  });
});

