import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

// El panel «Aulas aplicadas (campo)» publica en su contador «196 cursos-horario ·
// 170 con parte en el libro», y sus 196 filas se veían todas «Planificada»:
// `operational_status` lo mueve esta misma pantalla al guardar, así que sobre un
// libro importado se queda en el estado con el que nacen.
//
// El conjunto de códigos con parte YA se construía —para contar— y la fila no lo
// consumía. Es C5 categoría 3: el dato existe y la superficie no lo enseña. Y es
// la lista donde se elige a qué aula entrar, así que la que más lo necesita.
//
// Medido tras el cambio: 170 filas con la marca y 26 sin, que es exactamente lo
// que dice el contador.

const fuente = fs.readFileSync(
  path.resolve(__dirname, "RegistroDeCampo.tsx"),
  "utf8",
);

describe("la fila enseña el hecho que el contador ya publica", () => {
  it("el conjunto de códigos con parte existe y no es privado del contador", () => {
    expect(fuente).toContain("const codigosConParte = useMemo(");
    // El contador se deriva de él, no al revés: si alguien vuelve a construir el
    // Set dentro del `useMemo` del conteo, la fila se queda otra vez sin dato.
    expect(fuente).toMatch(/const conRegistro = useMemo\([\s\S]{0,220}codigosConParte/);
  });

  it("la fila lo consume", () => {
    expect(fuente).toContain("codigosConParte.has(clave)");
  });

  it("no reescribe el estado declarado", () => {
    // La marca se añade AL LADO del chip de estado. Sobrescribir
    // `operational_status` con un estado derivado sería inventar un dato
    // operativo que nadie declaró.
    expect(fuente).toContain('const estado = String(row.operational_status ?? "planificada");');
    expect(fuente).toMatch(/registro-campo-parte[\s\S]{0,400}registro-campo-estado is-\$\{estado\}/);
  });
});
