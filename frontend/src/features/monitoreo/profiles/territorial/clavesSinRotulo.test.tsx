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
import { describe, expect, it } from "vitest";
import { FaltantePorUmp } from "./avance/FaltantePorUmp";
import { ResumenTerritorial } from "./avance/Resumen";
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

const PESTANAS: Array<[string, () => string]> = [
  ["Avance › Faltante por UMP", () => pintar(<FaltantePorUmp reports={CORTE_DE_CUOTAS} />, `${RUTA}&pestana=faltante`)],
  ["Avance › Faltante por UMP con el detalle abierto", () => pintar(<FaltantePorUmp reports={CORTE_DE_CUOTAS} />, `${RUTA}&pestana=faltante&foco=143`)],
  ["Avance › Faltante por UMP sin cuota", () => pintar(<FaltantePorUmp reports={null} />, `${RUTA}&pestana=faltante`)],
  ["Avance › Resumen", () => pintar(<ResumenTerritorial reports={CORTE_DE_RESUMEN} />, `${RUTA}&pestana=resumen`)],
  ["Avance › Resumen sin desglose de observación", () => pintar(
    <ResumenTerritorial reports={{ ...CORTE_DE_RESUMEN, response_audit: [] }} />,
    `${RUTA}&pestana=resumen`,
  )],
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

  it("el vacío de Faltante publica su motivo a la readiness", () => {
    expect(pintar(<FaltantePorUmp reports={null} />, `${RUTA}&pestana=faltante`)).toContain('data-audit-ready="vacio:sin-cuota"');
  });

  it("el detector reconoce una clave cruda y un distrito sin rótulo", () => {
    expect(clavesCrudas("<td>18-29</td><td>SAN MARTIN DE PORRES</td><td>San Martín de Porres</td>")).toEqual(["18-29", "SAN MARTIN DE PORRES"]);
  });
});
