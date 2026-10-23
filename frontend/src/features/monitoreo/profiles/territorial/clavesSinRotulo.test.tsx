/**
 * Ninguna clave del motor territorial llega a la pantalla sin rótulo.
 *
 * Mismo detector que el de Telefónico (`telefonico/clavesSinRotulo.test.tsx`):
 * renderiza las pestañas propias del modo con un corte de prueba y falla si un
 * nodo de texto es una clave conocida o tiene forma de clave (`snake_case`,
 * `kebab-case`, que también atrapa los tramos crudos «18-29»). El motor publica
 * además los distritos en mayúsculas sin tilde, así que esos se buscan aparte.
 */

import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import type { MonitoreoState, MonitoreoTerritorialDashboard } from "../../../../api/client";
import { describe, expect, it } from "vitest";
import { FaltantePorUmp } from "./avance/FaltantePorUmp";
import { ResumenTerritorial } from "./avance/Resumen";
import { MapaTab } from "./avance/MapaTab";
import { UmpsTab } from "./avance/UmpsTab";
import { AnulacionesTab } from "./control/AnulacionesTab";
import { BandejaTab } from "./control/BandejaTab";
import { ConciliacionTab } from "./control/ConciliacionTab";
import { OcurrenciasTab } from "./control/OcurrenciasTab";
import { ReportesTab } from "./control/ReportesTab";
import { SubsanacionesTab } from "./control/SubsanacionesTab";
import { EquipoTab } from "./control/EquipoTab";
import { SenalesTab } from "./control/SenalesTab";
import { CORTE_DE_CUOTAS } from "./avance/fixtures/corteDeCuotas";
import { CORTE_DE_RESUMEN } from "./avance/fixtures/corteDeResumen";

const CLAVES = [
  // Tipos de manzana y estados del motor de cuotas.
  "titular", "reemplazo", "complete", "exceeded", "pending", "subsanada", "eligible", "blocked",
  // Tramos con su forma cruda.
  "60+",
  // Estados de observación y motivos.
  "en_observacion", "sin_observacion", "gps_lejos", "gps_revision", "gps_sin_gps", "duracion_corta",
  // Distritos tal como los publica el motor.
  "SAN MARTIN DE PORRES", "SAN JUAN DE LURIGANCHO", "ATE", "CHORRILLOS",
];

const FORMA_DE_CLAVE = /^[a-z0-9]+([_-][a-z0-9]+)+$/;

function textosVisibles(html: string): string[] {
  return html
    .replace(/<code[^>]*>[\s\S]*?<\/code>/g, " ")
    .replace(/<!-- -->/g, "")
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/g, " ")
    .split(/<[^>]+>/)
    .map((texto) => texto.replace(/&quot;/g, "\"").replace(/&#x27;/g, "'").replace(/&amp;/g, "&").trim())
    .filter(Boolean);
}

function clavesCrudas(html: string): string[] {
  return textosVisibles(html).filter((texto) => CLAVES.includes(texto) || FORMA_DE_CLAVE.test(texto));
}

function pintar(nodo: ReactNode, ruta: string) {
  return renderToStaticMarkup(<MemoryRouter initialEntries={[ruta]}>{nodo}</MemoryRouter>);
}

const RUTA = "/monitoreo?modo=territorial&seccion=avance";

// Casos del corte de Validación para la ficha y la historia de la UMP 143.
const VALIDACION = {
  response_audit: [
    { response_id: "a", advance_block_id: "150135063000590", advance_block_manzana: "0590", advance_valid: true, validation_status: "validada", observation_status: "en_observacion", submission_date_iso: "2026-06-17", submission_hour: "10:15:00", sex: "Mujer", age: 34, distance_m: 40, responsible_display: "P132 · Aplicadora de Prueba" },
    { response_id: "b", advance_block_id: "150135063000590", advance_block_manzana: "0590", advance_valid: false, validation_status: "no_defendible", observation_status: "no_valida", submission_date_iso: "2026-06-18", submission_hour: "", sex: "", age: null, distance_m: null, responsible_display: "P132 · Aplicadora de Prueba" },
  ],
} as unknown as MonitoreoTerritorialDashboard;
// Corte de Consultas para Bandeja y Equipo, con claves como las publica el motor.
const CONSULTAS = {
  internal_queries: {
    review_cases: [
      { id: "g1", type: "gps", reason: "gps_no_defendible", district: "SAN MARTIN DE PORRES", ump: "UMP 145", manzana: "0200", responsible: "P222 · Aplicador", pulso_code: "P222", submission_date_iso: "2026-06-16", submission_hour: "11:30:00", geo_estado: "geo_no_defendible", distance_m: 628, duration_seconds: 895, response_id: "dcb2051a" },
      { id: "d1", type: "duration", reason: "duracion_corta", district: "ATE", ump: "12", responsible: "P222 · Aplicador", pulso_code: "P222", submission_date_iso: "2026-06-17", duration_seconds: 100, duration_operational_status: "muy_corto", response_id: "e1" },
    ],
  },
  production_annulments: {
    responsibles: [{ key: "p222_aplicador", label: "P222 · Aplicador", pulso_code: "P222", responses: 20, valid_responses: 18, umps: 3, districts: "ATE · SAN MARTIN DE PORRES", latest_activity: "2026-06-17", status: "activo" }],
    entries: [{ id: "a1", status: "active", scope: "response", response_id: "zz1", response_label: "Caso zz1", reason: "GPS fuera", created_at: "2026-06-26" }],
  },
} as unknown as MonitoreoTerritorialDashboard;
const AUDITORIA = {
  response_audit: [
    { distrito: "SAN MARTIN DE PORRES", pulso_code: "P222", geo_estado: "geo_no_defendible", distance_m: 628, duration_seconds: 895, duration_operational_status: "normal", submission_date_iso: "2026-06-16", advance_valid: true },
    { distrito: "ATE", pulso_code: "P222", geo_estado: "geo_sin_gps", distance_m: null, duration_seconds: 100, duration_operational_status: "muy_corto", submission_date_iso: "2026-06-17", advance_valid: true },
  ],
} as unknown as MonitoreoTerritorialDashboard;

// Correcciones: anulaciones con los nombres que publica el motor, conciliación
// con códigos y UMP sin cruzar, y el padrón (sin DNI en pantalla).
const CORRECCIONES = {
  ...CORTE_DE_CUOTAS,
  production_annulments: {
    summary: { annulled_responses: 2, affected_umps: 1 },
    rows: [{ district: "LOS OLIVOS" }, { district: "" }],
    entries: [{ id: "a1", status: "active", scope: "all_production", responsible_label: "P702 · Aplicador", reason: "Caso anulado", created_at: "2026-06-26T16:51:00", impact: { responses_excluded: 2, valid_responses_excluded: 1, umps_affected: 1 } }],
    affected_blocks: [{ block_id: "m1301", ump: "1301", manzana: "0900", district: "LOS OLIVOS", responses_annulled: 2, valid_annulled: 1 }],
  },
  enumerator_code_summary: {
    response_code_count: 3, recognized_code_count: 2, reconciled_code_count: 1,
    unrecognized_codes: [{ code: "109", raw_code: "109", normalized_code: "109", count: 1 }],
    unrecognized_responses: [{ row_index: 1, response_id: "r1", raw_code: "109", normalized_code: "109" }],
    reconciliation_entries: [{ raw_code: "P19", normalized_code: "P019", assigned_code: "P190", assigned_name: "Aplicador Uno" }],
  },
  ump_declared_summary: {
    rows: [{ raw_ump: "UMP 285", normalized_ump: "285", response_count: 1, route_match: false, status: "review" }, { raw_ump: "UMP 1", normalized_ump: "1", response_count: 8, route_match: true, status: "recognized" }],
    route_options: [{ route_ump: "UMP 28", id_manzana: "150103001000280", distrito: "ATE", ubigeo: "150103", manzana: "0280" }],
  },
  spatial_reconciliation: { candidates: [], patterns: [], metrics: { candidates: 0, patterns: 0, in_queue: 0 } },
} as unknown as MonitoreoTerritorialDashboard;
const ESTADO_CON_PADRON = {
  config: { territorial: { enumerator_roster: { assignments: [{ codigo_pulso: "P109", nombre: "Aplicador Tres", dni: "00000000" }] } } },
} as unknown as MonitoreoState;

// Ocurrencias de campo con claves de motivo como las publica el motor.
const OCURRENCIAS = {
  ...CORTE_DE_CUOTAS,
  field_occurrences: {
    summary: { total_records: 3, intentos: 200, efectivas: 30, no_efectivas: 170 },
    by_outcome: [{ key: "efectiva", label: "Efectiva", total: 30 }, { key: "no_contesta", label: "No contesta", total: 90 }, { key: "vivienda_desocupada", label: "Vivienda desocupada", total: 80 }],
    by_district: [{ distrito: "SAN MARTIN DE PORRES", intentos: 200, ump_reportadas: 2, efectivas: 30, outcomes: [{ key: "no_contesta", label: "No contesta", total: 90 }] }],
    by_day: [{ date: "2026-06-13", intentos: 200, efectivas: 30 }],
    by_ump: [{ ump: "UMP 143", has_report: true, reportes: 1, efectivas: 9, intentos: 100 }, { ump: "1437", has_report: true, reportes: 1, efectivas: 3, intentos: 9 }],
  },
} as unknown as MonitoreoTerritorialDashboard;

const CON_PARTE = {
  ...CORTE_DE_CUOTAS,
  field_occurrences: { by_ump: [{ ump: "UMP 143", has_report: true, reportes: 1, efectivas: 8, intentos: 20 }] },
} as unknown as MonitoreoTerritorialDashboard;

const PESTANAS: Array<[string, () => string]> = [
  ["Avance › Faltante por UMP", () => pintar(<FaltantePorUmp reports={CORTE_DE_CUOTAS} />, `${RUTA}&pestana=faltante`)],
  ["Avance › Faltante por UMP con el detalle abierto", () => pintar(<FaltantePorUmp reports={CORTE_DE_CUOTAS} />, `${RUTA}&pestana=faltante&foco=143`)],
  ["Avance › Faltante por UMP sin cuota", () => pintar(<FaltantePorUmp reports={null} />, `${RUTA}&pestana=faltante`)],
  ["Avance › Resumen", () => pintar(<ResumenTerritorial reports={CORTE_DE_RESUMEN} />, `${RUTA}&pestana=resumen`)],
  ["Avance › Resumen sin desglose de observación", () => pintar(
    <ResumenTerritorial reports={{ ...CORTE_DE_RESUMEN, response_audit: [] }} />,
    `${RUTA}&pestana=resumen`,
  )],
  ["Avance › UMP", () => pintar(<UmpsTab avance={CON_PARTE} validacion={VALIDACION} />, `${RUTA}&pestana=umps`)],
  ["Avance › UMP con la ficha y la historia de la 143", () => pintar(<UmpsTab avance={CON_PARTE} validacion={VALIDACION} />, `${RUTA}&pestana=umps&panel=ump&foco=143`)],
  // Sin cartografía (no hay API en el test) el mapa pinta su barra, su vacío y
  // el lateral: el texto de esas tres piezas es el que se revisa.
  ["Avance › Mapa", () => pintar(<MapaTab avance={CON_PARTE} validacion={VALIDACION} />, `${RUTA}&pestana=mapa`)],
  ["Avance › Mapa con la ficha de la 143", () => pintar(<MapaTab avance={CON_PARTE} validacion={VALIDACION} />, `${RUTA}&pestana=mapa&panel=ump&foco=143`)],
  ["Control › Señales", () => pintar(<SenalesTab reports={AUDITORIA} />, "/monitoreo?modo=territorial&seccion=control&pestana=senales")],
  ["Control › Bandeja", () => pintar(<BandejaTab consultas={CONSULTAS} phase="field" />, "/monitoreo?modo=territorial&seccion=control&pestana=bandeja")],
  ["Control › Bandeja filtrada por GPS lejos", () => pintar(<BandejaTab consultas={CONSULTAS} phase="field" />, "/monitoreo?modo=territorial&seccion=control&pestana=bandeja&foco=gps-lejos")],
  ["Control › Equipo", () => pintar(<EquipoTab consultas={CONSULTAS} validacion={AUDITORIA} phase="field" />, "/monitoreo?modo=territorial&seccion=control&pestana=equipo")],
  ["Control › Equipo con el inspector de P222", () => pintar(<EquipoTab consultas={CONSULTAS} validacion={AUDITORIA} phase="field" />, "/monitoreo?modo=territorial&seccion=control&pestana=equipo&panel=codigo&foco=P222")],
  ["Control › Subsanaciones", () => pintar(<SubsanacionesTab reports={CORTE_DE_CUOTAS} />, "/monitoreo?modo=territorial&seccion=control&pestana=subsanaciones&foco=143")],
  ["Control › Anulaciones", () => pintar(<AnulacionesTab reports={CORRECCIONES} phase="field" />, "/monitoreo?modo=territorial&seccion=control&pestana=anulaciones")],
  ["Control › Conciliación", () => pintar(
    <ConciliacionTab reports={CORRECCIONES} state={ESTADO_CON_PADRON} phase="field" onEspacial={() => undefined} />,
    "/monitoreo?modo=territorial&seccion=control&pestana=conciliacion",
  )],
  ["Control › Ocurrencias", () => pintar(<OcurrenciasTab reports={OCURRENCIAS} />, "/monitoreo?modo=territorial&seccion=control&pestana=ocurrencias")],
  ["Control › Reportes UMP con la 143 elegida", () => pintar(
    <ReportesTab ocurrencias={OCURRENCIAS} validacion={AUDITORIA} />,
    "/monitoreo?modo=territorial&seccion=control&pestana=reportes&foco=143",
  )],
  ["Avance › UMP sin ocurrencias ni casos", () => pintar(<UmpsTab avance={CORTE_DE_CUOTAS} validacion={null} />, `${RUTA}&pestana=umps&panel=ump&foco=143`)],
];

describe("Territorial: ninguna clave llega a la pantalla sin rótulo", () => {
  it.each(PESTANAS)("%s", (_nombre, render) => {
    const html = render();
    expect(textosVisibles(html).length).toBeGreaterThanOrEqual(3);
    expect(clavesCrudas(html)).toEqual([]);
  });

  it("el detalle abierto es el de la UMP enfocada", () => {
    const html = pintar(<FaltantePorUmp reports={CORTE_DE_CUOTAS} />, `${RUTA}&pestana=faltante&foco=143`);
    expect(html).toContain('id="mon-falt-detalle-143"');
  });

  it("Avance › UMP abre la ficha de la UMP enfocada y declara su readiness de detalle", () => {
    const html = pintar(<UmpsTab avance={CON_PARTE} validacion={VALIDACION} />, `${RUTA}&pestana=umps&panel=ump&foco=143`);
    expect(html).toContain('data-audit-ready="monitoreo-territorial-avance-umps-detalle"');
    expect(html).toContain("Historia de la UMP");
    const sinParte = pintar(<UmpsTab avance={CORTE_DE_CUOTAS} validacion={null} />, `${RUTA}&pestana=umps`);
    expect(sinParte).not.toContain("Sin parte");
    expect(sinParte).toContain('data-audit-ready="monitoreo-territorial-avance-umps"');
  });

  it("Avance › Mapa espera la cartografía antes de declararse lista, y sin UMP publica su vacío", () => {
    // Sin API la cartografía no llega: la marca queda en espera, nunca en
    // «sin cartografía» antes de haberla pedido.
    expect(pintar(<MapaTab avance={CON_PARTE} validacion={VALIDACION} />, `${RUTA}&pestana=mapa`)).toContain('data-audit-ready="false"');
    expect(pintar(<MapaTab avance={null} validacion={null} />, `${RUTA}&pestana=mapa`)).toContain('data-audit-ready="vacio:sin-cuota"');
  });

  it("el padrón se ofrece sin DNI", () => {
    const html = pintar(<ConciliacionTab reports={CORRECCIONES} state={ESTADO_CON_PADRON} phase="field" onEspacial={() => undefined} />, "/monitoreo");
    expect(html).toContain("P109 · Aplicador Tres");
    expect(html).not.toContain("00000000");
  });

  it("el vacío de Faltante publica su motivo a la readiness", () => {
    expect(pintar(<FaltantePorUmp reports={null} />, `${RUTA}&pestana=faltante`)).toContain('data-audit-ready="vacio:sin-cuota"');
  });

  it("el detector reconoce una clave cruda y un distrito sin rótulo", () => {
    expect(clavesCrudas("<td>18-29</td><td>SAN MARTIN DE PORRES</td><td>San Martín de Porres</td>")).toEqual(["18-29", "SAN MARTIN DE PORRES"]);
  });
});
