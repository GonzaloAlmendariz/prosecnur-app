import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const aqui = path.dirname(fileURLToPath(import.meta.url));

/**
 * **Una clase que ningún CSS importado define se pinta sin estilo.**
 *
 * `recopiladores.css` es un marcador de compatibilidad: su cabecera dice que
 * las reglas viven en `./styles/` y que las nuevas no vuelvan ahí. Nadie lo
 * importa. Pero `.rec-plan-desfase` se quedó dentro, y su componente
 * —`PlanSection.tsx`, que importa `./styles/plan.css`— pintaba el aviso de plan
 * desfasado como texto corrido, sin borde ni fondo de advertencia. Es el aviso
 * que evita imprimir 2.616 fichas de una corrida equivocada. Su hermana
 * `.rec-plan-desfase-coste` no tenía regla en ningún sitio.
 *
 * No es un defecto de CSS: es un dato que no llega a pantalla, la misma familia
 * que un campo que el backend publica y nadie consume.
 */
const leer = (rel: string) => fs.readFileSync(path.join(aqui, rel), "utf8");

const componentes = fs.readdirSync(aqui).filter((f) => f.endsWith(".tsx") && !f.includes(".test."));
const hojasImportadas = new Set<string>();
for (const c of componentes) {
  for (const m of leer(c).matchAll(/import\s+"\.\/(styles\/[\w-]+\.css|[\w-]+\.css)"/g)) {
    hojasImportadas.add(m[1]);
  }
}
/**
 * Sin comentarios: un `/* … .rec-plan-desfase … *\/` que EXPLICA la clase
 * contiene su nombre, y buscarlo a secas da por definida una regla que no
 * existe. Se comprobó: quitando la regla de `plan.css` y dejando su comentario,
 * este test seguía en verde. Un guardián que se cree lo que dice un comentario
 * no guarda nada.
 */
const sinComentarios = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");
const cssImportado = sinComentarios([...hojasImportadas].map(leer).join("\n"));

describe("las clases rec-* del feature tienen estilo en un CSS importado", () => {
  it("ninguna clase usada en un componente se queda sin regla", () => {
    const usadas = new Set<string>();
    for (const c of componentes) {
      for (const m of leer(c).matchAll(/className="([^"{]+)"/g)) {
        for (const clase of m[1].split(/\s+/)) if (clase.startsWith("rec-")) usadas.add(clase);
      }
    }
    expect(usadas.size).toBeGreaterThan(20);
    const huerfanas = [...usadas].filter((clase) => !cssImportado.includes(`.${clase}`)).sort();
    expect(huerfanas, `sin regla en ningún CSS importado: ${huerfanas.join(", ")}`).toEqual([]);
  });

  it("y el marcador de compatibilidad sigue sin reglas dentro", () => {
    // Si vuelven a caer reglas ahí, no llegan a pantalla y nadie se entera.
    const marcador = sinComentarios(leer("recopiladores.css"));
    expect(marcador).not.toMatch(/^\s*\.[\w-]+\s*\{/m);
  });
});
