import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

import { barridoDelResponsable, totalDeAsignadas } from "./barridoDelResponsable";

const dir = path.dirname(fileURLToPath(import.meta.url));

const fila = (assigned: number | null, pending: number, swept: number | null = null) =>
  ({ assigned, pending, swept });

describe("sin «Casos asignados» no se inventa un denominador", () => {
  test("la ausencia se declara: null, y NO los pendientes", () => {
    // El defecto exacto: `row.assigned ?? row.pending` hacía que un responsable
    // con 2 casos por barrer apareciera con «2 personas asignadas».
    const b = barridoDelResponsable(fila(null, 2));
    expect(b.asignadas).toBeNull();
    expect(b.barridos).toBeNull();
    expect(b.pctBarrido).toBeNull();
    expect(b.pctPendiente).toBeNull();
  });

  test("los pendientes sí se conocen y se siguen diciendo", () => {
    expect(barridoDelResponsable(fila(null, 2)).pendientes).toBe(2);
  });

  test("con la columna, barridos y porcentajes salen del denominador real", () => {
    const b = barridoDelResponsable(fila(100, 2));
    expect(b).toMatchObject({ asignadas: 100, barridos: 98, pendientes: 2 });
    expect(b.pctBarrido).toBe(98);
    expect(b.pctPendiente).toBe(2);
  });

  test("un «Casos barridos» declarado manda sobre la resta", () => {
    expect(barridoDelResponsable(fila(100, 2, 90)).barridos).toBe(90);
  });

  test("cero asignados no da «0 %»: da que no hay porcentaje", () => {
    // Dividir entre cero salía como 0 %, que se lee «no ha barrido nada»
    // cuando lo cierto es que no tiene nada que barrer.
    const b = barridoDelResponsable(fila(0, 0));
    expect(b.asignadas).toBe(0);
    expect(b.pctBarrido).toBeNull();
    expect(b.pctPendiente).toBeNull();
  });

  test("un asignado no numérico cuenta como ausente, no como cero", () => {
    expect(barridoDelResponsable(fila(Number.NaN, 5)).asignadas).toBeNull();
  });
});

describe("el total de la cabecera no contradice a la lista", () => {
  test("si nadie trae el dato, el total es «no se sabe», no cero", () => {
    // `rows.reduce((s, r) => s + (r.assigned ?? 0), 0)` anunciaba «0 personas
    // asignadas» encima de una lista con números en cada fila.
    const t = totalDeAsignadas([fila(null, 3), fila(null, 5)]);
    expect(t.valor).toBeNull();
    expect(t.sinDato).toBe(2);
  });

  test("si sólo algunos lo traen, suma ésos y dice cuántos faltan", () => {
    const t = totalDeAsignadas([fila(100, 2), fila(null, 5), fila(40, 1)]);
    expect(t).toEqual({ valor: 140, sinDato: 1 });
  });

  test("con todos los datos no hay nada que declarar", () => {
    expect(totalDeAsignadas([fila(10, 1), fila(20, 2)])).toEqual({ valor: 30, sinDato: 0 });
  });
});

describe("los dos perfiles que pintan este panel usan el mismo lector", () => {
  // Guard de la clase 11 acotado al defecto medido. No se ancla en el nombre de
  // una variable —un guard de regex muere al renombrar el símbolo que lo
  // ancla—, sino en el hecho: estos archivos no vuelven a resolver la ausencia
  // de «Casos asignados» por su cuenta, y para eso tienen que importar el
  // lector. El defecto vivía DUPLICADO en los dos, así que se exige en los dos.
  const perfiles = [
    "acreditacion/AcreditacionMonitoreoPage.tsx",
    "telefonico/TelefonicoMonitoreoPage.tsx",
  ];

  test.each(perfiles)("%s importa barridoDelResponsable", (relativo) => {
    const fuente = readFileSync(path.join(dir, relativo), "utf8");
    expect(fuente).toContain("barridoDelResponsable");
    // La cabecera es la otra mitad del defecto: sin esto seguiría sumando `?? 0`.
    expect(fuente).toContain("totalDeAsignadas");
  });

  test.each(perfiles)("%s ya no resuelve los asignados con los pendientes", (relativo) => {
    const fuente = readFileSync(path.join(dir, relativo), "utf8");
    const culpables = [...fuente.matchAll(/\.assigned\s*\?\?\s*([^,;)\]\n]+)/g)]
      .map((m) => m[1].trim())
      // Sólo el respaldo por pendientes. Un `?? 0` para ORDENAR una lista no
      // publica ninguna cifra y no es este defecto; incluirlo llenaba el guard
      // de falsos positivos, que es como un guard se acaba ignorando.
      .filter((respaldo) => /\bpending\b/.test(respaldo));
    expect(
      culpables,
      "«Casos asignados» es opcional: sin la columna no hay asignadas ni porcentaje. " +
        "Sustituirla por los pendientes (o por cero en la cabecera) publica dos cifras " +
        "que se contradicen en la misma pantalla. Usa barridoDelResponsable/totalDeAsignadas.",
    ).toEqual([]);
  });
});
