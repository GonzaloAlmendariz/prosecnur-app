// «Usa estos códigos internos y no se ve nada amigable» —Gonzalo.
//
// La tabla pone delante las columnas preferidas y RELLENA el resto con lo que
// traiga el payload, en su orden. En Agenda las preferidas son el ciclo de
// contacto —a quién llamo, por qué medio, cuándo, cuántas veces—, que está vacío
// hasta que el equipo sale a campo; al no tener dato desaparecen, y el hueco se
// llenaba con `sel_aulas_20260822204345_bf10d14c`, `slot_001` y la secuencia
// operativa. Cuanto menos trabajo de campo hay, más metadatos enseñaba la tabla.
//
// La lista vive sin exportar en el módulo; se lee del fuente para no abrir su
// superficie pública sólo por un test, igual que `COLUMNAS_DE_PORCENTAJE`.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const fuente = fs.readFileSync(path.join(aqui, "AulasMonitoreoPage.tsx"), "utf8");

const listaDe = (nombre: string) => {
  const bloque = (fuente.match(new RegExp(`const ${nombre} = new Set\\(\\[([\\s\\S]*?)\\]\\)`)) ?? [])[1] ?? "";
  return [...bloque.matchAll(/"(\w+)"/g)].map((m) => m[1]);
};

const infraestructura = listaDe("COLUMNAS_DE_INFRAESTRUCTURA");

describe("las columnas de infraestructura no rellenan la tabla", () => {
  it("se encontró la lista", () => {
    expect(infraestructura.length).toBeGreaterThan(6);
  });

  it("están las que aparecían en la Agenda del estudio real", () => {
    // Vistas en pantalla con el proyecto abierto: la corrida entera, la ranura
    // del sorteo y la secuencia, en una tabla cuyo trabajo es agendar.
    for (const campo of ["selection_run_id", "selection_slot_id", "operational_sequence"]) {
      expect(infraestructura, `falta ${campo}`).toContain(campo);
    }
  });

  it("los códigos legibles NO se excluyen", () => {
    // «CH 1» y «R 1.2» dicen de qué cadena es la fila: son lo contrario de un
    // dato interno, y esconderlos habría sido pasarse de largo.
    for (const campo of ["operational_code", "titular_operational_code", "replacement_chain_code"]) {
      expect(infraestructura, `${campo} no debería excluirse`).not.toContain(campo);
    }
  });

  it("ninguna tabla del perfil pide una columna de infraestructura", () => {
    // Una preferida declarada gana sobre la exclusión —si una tabla necesita ver
    // la corrida, la enseña—, así que la lista sólo es efectiva si nadie las pide
    // de propio. Esto lo comprueba.
    const preferidas = [...fuente.matchAll(/preferredColumns=\{\[([\s\S]*?)\]\}/g)]
      .flatMap((m) => [...m[1].matchAll(/"(\w+)"/g)].map((x) => x[1]));
    expect(preferidas.length).toBeGreaterThan(10);
    const pedidas = preferidas.filter((c) => infraestructura.includes(c));
    expect(pedidas, `tablas que piden infraestructura: ${pedidas.join(", ")}`).toEqual([]);
  });
});
