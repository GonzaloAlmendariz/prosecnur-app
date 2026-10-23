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
import type { MonitoreoTerritorialDashboard } from "../../../../api/client";
import { describe, expect, it } from "vitest";
import { FaltantePorUmp } from "./avance/FaltantePorUmp";
import { ResumenTerritorial } from "./avance/Resumen";
import { MapaTab } from "./avance/MapaTab";
import { UmpsTab } from "./avance/UmpsTab";
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

  it("el vacío de Faltante publica su motivo a la readiness", () => {
    expect(pintar(<FaltantePorUmp reports={null} />, `${RUTA}&pestana=faltante`)).toContain('data-audit-ready="vacio:sin-cuota"');
  });

  it("el detector reconoce una clave cruda y un distrito sin rótulo", () => {
    expect(clavesCrudas("<td>18-29</td><td>SAN MARTIN DE PORRES</td><td>San Martín de Porres</td>")).toEqual(["18-29", "SAN MARTIN DE PORRES"]);
  });
});
