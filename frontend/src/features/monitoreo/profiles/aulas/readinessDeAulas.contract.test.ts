import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * La marca de readiness no puede encenderse mientras la vista carga.
 *
 * Guard escrito después de ver a `ui-quick-check` —el gate visual canónico de
 * la casa— devolver `ok=true issues=0` sobre una captura que decía «Preparando
 * vista · Leyendo caché local del proyecto», con CONTROLES 0, ALERTAS 0 y
 * REPRESENTATIVIDAD S/D. La página emitía `data-audit-ready="monitoreo-aulas"`
 * fija desde el primer render, así que `window.__pulsoNav.listo()` respondía
 * que sí y el runner capturaba la pantalla de carga como si fuera la vista.
 *
 * No es un defecto de un panel: invalida el gate visual del perfil entero, que
 * es la herramienta con la que se aprueba todo lo demás.
 *
 * Es un guard de fuente y no de render a propósito: montar la página completa
 * para leer un atributo cuesta más que leerlo, y el contrato que hay que fijar
 * es justo el del atributo.
 */

const page = readFileSync(path.join(__dirname, "AulasMonitoreoPage.tsx"), "utf8");

describe("readiness del perfil de aulas", () => {
  it("la marca depende de `loading`", () => {
    expect(page).toContain('data-audit-ready={loading ? "false" : "monitoreo-aulas"}');
    // El control: la forma vieja no puede volver por un merge distraído.
    expect(page).not.toContain('data-audit-ready="monitoreo-aulas"');
  });

  it("sigue habiendo una sola marca en la página", () => {
    // Dos marcas y `estadoListo()` lee la primera del documento, que puede ser
    // la de un panel montado antes que la de la página.
    expect(page.match(/data-audit-ready=/g)?.length).toBe(1);
  });
});
