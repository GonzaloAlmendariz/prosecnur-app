import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Dos superficies distintas no pueden llamarse igual.
 *
 * El panel de traza se llamaba «Aplicación por cursos-horario», que es también
 * el título del perfil entero en el registro Y el nombre de la hoja «Aulas
 * Aplicadas (Campo)» del libro. El mismo rótulo señalaba tres cosas: quien leía
 * «aplicación» no podía saber si le hablaban del módulo, de la preparación del
 * plan o de lo que pasó dentro del aula.
 *
 * El guard no fija el texto —renombrar sigue siendo libre— sino la propiedad:
 * cada panel tiene su nombre y ninguno usurpa el del perfil.
 */

const aqui = path.dirname(fileURLToPath(import.meta.url));

function fuente(nombre: string) {
  return fs.readFileSync(path.join(aqui, nombre), "utf8");
}

/** Los `<h3>` de texto literal de un componente. */
function titulos(tsx: string) {
  return [...tsx.matchAll(/<h3>([^<{]+)<\/h3>/g)].map((m) => m[1].trim());
}

const archivos = ["AulasMonitoreoPage.tsx", "RegistroDeCampo.tsx", "AulasOperationsPanel.tsx"];
const todos = archivos.flatMap((n) => titulos(fuente(n)));

describe("los títulos de panel del perfil de aulas", () => {
  it("son todos distintos entre sí", () => {
    const repetidos = todos.filter((t, i) => todos.indexOf(t) !== i);
    expect(todos.length).toBeGreaterThan(8);
    expect(repetidos, `títulos repetidos: ${repetidos.join(", ")}`).toEqual([]);
  });

  it("ninguno usurpa el nombre del perfil", () => {
    // Se lee del registro, no se copia: si mañana el perfil se renombra, el
    // guard sigue midiendo la propiedad y no un texto congelado.
    const registro = fs.readFileSync(path.join(aqui, "index.ts"), "utf8");
    const perfil = /label:\s*"([^"]+)"/.exec(registro)?.[1] ?? "";
    expect(perfil).not.toBe("");
    expect(todos, `un panel se llama igual que el perfil («${perfil}»)`).not.toContain(perfil);
  });

  it("los dos paneles que SÍ son hojas del libro las nombran", () => {
    // Agenda y registro no son vistas nuestras: son las dos hojas que el equipo
    // llena en Excel, traídas a la app. Que se llamen como la hoja es lo que
    // deja reconocerlas sin explicación.
    expect(todos).toContain("Aulas agendadas");
    expect(todos).toContain("Aulas aplicadas (campo)");
  });
});
