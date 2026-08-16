import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

// Vara V3 en Recopiladores: una operación que no hace nada se ve.
//
// El motor declara `noop` en siete puntos —guardar un plan idéntico, preparar
// un deployment que ya estaba, sembrar cuando ya hay estado— y el campo llegaba
// tipado y normalizado hasta el shell sin que ningún componente lo leyera.
// Guardar y que no pase nada se veía exactamente igual que guardar.
//
// La trampa que hace frágil este arreglo: `collection_state_get` también
// devuelve `noop: true` —leer nunca cambia nada— así que leer el campo en la
// carga mostraría el aviso siempre. Por eso vive en el embudo de mutaciones y
// no en el estado.

const aqui = path.dirname(fileURLToPath(import.meta.url));
const shell = fs.readFileSync(path.join(aqui, "RecopiladoresShell.tsx"), "utf8");
const css = fs.readFileSync(path.join(aqui, "styles/recopiladores-shell.css"), "utf8");

describe("Recopiladores: el guardado que no cambió nada lo dice", () => {
  test("las mutaciones pasan por un embudo que lee `noop`", () => {
    expect(shell).toMatch(/const aplicarMutacion = useCallback\(/);
    expect(shell).toMatch(/setSinCambios\(next\.noop === true\)/);
  });

  test("las cuatro secciones que mutan usan ese embudo y no el setter crudo", () => {
    // El control: si una sección volviera a `onState={setPayload}`, su
    // guardado silencioso dejaría de avisar sin que nada más se rompa.
    const conOnState = shell.match(/onState=\{[a-zA-Z]+\}/g) ?? [];
    expect(conOnState.length).toBeGreaterThanOrEqual(3);
    expect(conOnState.every((m) => m.includes("aplicarMutacion"))).toBe(true);
  });

  test("la carga no enciende el aviso", () => {
    // `collection_state_get` devuelve `noop: true` siempre. Si el refresh no
    // lo apagara, el aviso aparecería en cada entrada al módulo.
    const refresh = shell.slice(shell.indexOf("const refresh = useCallback"));
    expect(refresh.slice(0, 400)).toMatch(/setSinCambios\(false\)/);
  });

  test("el aviso existe con su estilo y no se disfraza de error", () => {
    expect(shell).toContain('data-testid="recopiladores-sin-cambios"');
    expect(shell).toContain("No había nada que guardar");
    // Guardar dos veces lo mismo es legítimo: es aviso, no error.
    const regla = css.slice(css.indexOf(".rec-sin-cambios {"));
    expect(regla.slice(0, 400)).toMatch(/--pulso-warn-bg/);
    expect(regla.slice(0, 400)).not.toMatch(/--pulso-danger/);
  });
});
