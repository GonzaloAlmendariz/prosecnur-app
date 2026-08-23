// Los cuatro subtítulos de Recopiladores hablaban en lenguaje de implementación:
// «inspecciona un target existente y prepara accesos sin crear recursos
// remotos», «renderiza con el compilador autoritativo del backend», «cierra el
// deployment con un recibo idempotente». Quien prepara una salida a campo no
// sabe qué es un recibo idempotente, y el módulo entero se lee como si no fuera
// para él.
//
// La lista de jerga no es una opinión: son términos de arquitectura que sólo
// significan algo dentro del código.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const fuente = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "RecopiladoresShell.tsx"),
  "utf8",
);
const copy = (fuente.match(/const SECTION_COPY[\s\S]*?\n\};/) ?? [])[0] ?? "";
const leads = [...copy.matchAll(/lead:\s*"([^"]+)"/g)].map((m) => m[1]);

describe("las secciones se explican en el idioma de quien las usa", () => {
  it("hay un subtítulo por sección", () => {
    expect(leads).toHaveLength(4);
  });

  it("ninguno usa jerga de arquitectura", () => {
    const jerga = [
      "target", "deployment", "idempotente", "compilador", "backend",
      "recursos remotos", "receta semántica", "autoritativo",
    ];
    const conJerga = leads.flatMap((lead) =>
      jerga.filter((t) => lead.toLowerCase().includes(t)).map((t) => `«${t}» en «${lead}»`));
    expect(conJerga).toEqual([]);
  });

  it("las garantías técnicas siguen dichas, en castellano", () => {
    // No se pierden: que Accesos no toca la plataforma y que la entrega se puede
    // repetir sin duplicar eran promesas reales del motor.
    expect(leads.join(" ")).toContain("sin tocar nada en la plataforma");
    expect(leads.join(" ")).toContain("Repetirla no duplica nada");
  });

  it("cada uno dice qué se hace ahí, no cómo está hecho", () => {
    expect(leads[0]).toContain("aulas que entran a campo");
    expect(leads[1]).toContain("enlace por el que responde cada aula");
    expect(leads[2]).toContain("se imprimen y se llevan al aula");
    expect(leads[3]).toContain("deja constancia");
  });
});
