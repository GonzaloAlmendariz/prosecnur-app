import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

// Vara V2 del GOAL de UI: todo estado que el motor distingue, la interfaz lo
// distingue. `statusTone` distingue cuatro —muted (sin meta), complete,
// steady (≥70% del objetivo) y low (<70%)— y la tarjeta de actor del panel
// Modelo los reducía a tres, mandando `steady` y `low` al mismo `is-base`, que
// además no tenía ninguna regla CSS. Al 95% y al 20% de la meta la tarjeta se
// veía idéntica, mientras la misma data se pinta con sus cuatro colores en
// `mon-actor-card` tres mil líneas más abajo.

const profilesDir = path.dirname(fileURLToPath(import.meta.url));
const css = fs.readFileSync(path.join(profilesDir, "profilePage.css"), "utf8");

const PERFILES = [
  "telefonico/TelefonicoMonitoreoPage.tsx",
  "acreditacion/AcreditacionMonitoreoPage.tsx",
] as const;

const TONOS = ["muted", "complete", "steady", "low"] as const;

function acento(tono: string): string | null {
  const m = css.match(
    new RegExp(`\\.mon-acr-model-actor\\.is-${tono}\\s*\\{([^}]*)\\}`),
  );
  if (!m) return null;
  return m[1].match(/--model-accent:\s*([^;]+);/)?.[1].trim() ?? null;
}

describe("Tarjeta de actor del panel Modelo: un tono por estado", () => {
  test("los cuatro estados tienen regla propia", () => {
    for (const tono of TONOS) {
      expect(acento(tono), `falta .mon-acr-model-actor.is-${tono}`).not.toBeNull();
    }
  });

  test("ningún par de estados comparte acento", () => {
    const acentos = TONOS.map((t) => acento(t));
    // El control: si `steady` y `low` volvieran a colapsar —o si alguien les
    // diera el mismo color— este set bajaría de cuatro.
    expect(new Set(acentos).size).toBe(TONOS.length);
  });

  test("«requiere impulso» no se pinta con el acento de «en ruta»", () => {
    expect(acento("low")).not.toBe(acento("steady"));
    expect(acento("low")).not.toBe(acento("complete"));
  });

  test("los perfiles pasan el tono canónico en vez de recalcularlo", () => {
    for (const perfil of PERFILES) {
      const src = fs.readFileSync(path.join(profilesDir, perfil), "utf8");
      // La forma vieja: un ternario local que reducía cuatro valores a tres.
      expect(src, perfil).not.toMatch(
        /const statusTone = card\.meta == null \? "warning"/,
      );
      expect(src, perfil).toContain("const statusTone = card.statusTone;");
    }
  });

  test("no queda un `is-base` sin estilo al que caerse", () => {
    // Era el destino silencioso de `steady` y `low`: una clase que nadie
    // define y que por eso no cambia nada.
    expect(css).not.toContain(".mon-acr-model-actor.is-base");
    for (const perfil of PERFILES) {
      const src = fs.readFileSync(path.join(profilesDir, perfil), "utf8");
      expect(src, perfil).not.toContain('mon-acr-model-actor is-base');
    }
  });
});
