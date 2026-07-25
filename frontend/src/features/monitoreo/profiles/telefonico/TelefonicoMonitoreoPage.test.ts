import { describe, expect, test } from "vitest";
import {
  TELEFONICO_VISIBLE_ADVANCE_TABS,
  TELEFONICO_VISIBLE_PHONE_TABS,
  localTabsForTelefonicoView,
} from "./TelefonicoMonitoreoPage";
import { MONITOREO_MODOS } from "../../core/monitoreoRegistry";
import type { MonitoreoState } from "../../../../api/monitoreo";

// El perfil telefónico es un fork vivo del de acreditación (ver el comentario
// sobre `localTabsForTelefonicoView`): cada uno tiene su propio catálogo de
// pestañas por sección. Este test fija el catálogo telefónico para que una
// divergencia futura sea deliberada y no un efecto colateral de tocar
// acreditación — el gemelo está cubierto por AcreditacionMonitoreoPage.test.ts.
describe("localTabsForTelefonicoView — catálogo del perfil telefónico", () => {
  const telefonicoRoute = MONITOREO_MODOS.find((r) => r.family === "telefonico")!;
  const state = {
    monitoreo_profile: { family: "telefonico" },
    sources: [],
  } as unknown as MonitoreoState;
  const reports = {
    sheets: [
      {
        id: "monitoreo_telefonico",
        title: "Monitoreo telefónico",
        blocks: [
          {
            id: "resumen_telefonico",
            title: "Resumen",
            rows: [{ metrica: "Efectivas", valor: 141 }],
          },
          {
            id: "estatus_telefonico",
            title: "Estatus",
            rows: [{ estatus: "Efectivo", casos: 141 }],
          },
        ],
      },
    ],
  } as unknown as Parameters<typeof localTabsForTelefonicoView>[2];

  const keysFor = (
    view: Parameters<typeof localTabsForTelefonicoView>[0],
    reportsArg = reports,
  ) => localTabsForTelefonicoView(view, state, reportsArg, telefonicoRoute as never).map((t) => t.key);

  test("Fuentes omite Recopiladores: el paquete telefónico son Kobo, Sheets y corte", () => {
    expect(keysFor("fuentes")).toEqual(["survey", "sheets", "activas"]);
  });

  test("Modelo no expone la pestaña Resumen/Lectura que sí tiene acreditación", () => {
    expect(keysFor("modelo")).toEqual(["estructura", "estrategias"]);
  });

  test("Teléfono coincide con la lista blanca de pestañas visibles", () => {
    expect(keysFor("telefonico")).toEqual([...TELEFONICO_VISIBLE_PHONE_TABS]);
  });

  test("Avance coincide con la lista blanca de pestañas visibles", () => {
    expect(keysFor("avance")).toEqual([...TELEFONICO_VISIBLE_ADVANCE_TABS]);
  });

  test("Consultas muestra Efectivas Kobo y CodPulso, sin Salvedades cuando no hay casos con salvedad", () => {
    expect(keysFor("consultas")).toEqual(["plataforma", "cruces"]);
  });

  test("Consultas suma Salvedades solo cuando hay casos efectivos no identificables", () => {
    const reportsConSalvedad = {
      ...reports,
      internal_queries: {
        cases: [
          {
            response_id: "R-001",
            platform_state: "Completa",
            advancement: "effective",
            counts_in_advance: true,
            base_result: "Sin base",
          },
        ],
      },
    } as unknown as Parameters<typeof localTabsForTelefonicoView>[2];
    expect(keysFor("consultas", reportsConSalvedad)).toEqual(["plataforma", "cruces", "subsanacion"]);
  });

  // No se compara contra `localTabsForAcreditacionView` desde aquí: el guard
  // "telefonico no importa la UI de acreditacion" (profileImports.test.ts)
  // prohíbe el import cruzado, y es justamente la regla que hace del fork una
  // decisión y no un descuido. Cada perfil fija su catálogo en su propio test.
});
