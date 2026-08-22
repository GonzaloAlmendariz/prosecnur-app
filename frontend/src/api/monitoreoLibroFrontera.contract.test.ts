// La otra mitad del guardián. En R, `test-router-monitoreo-emite-lo-que-importa.R`
// exige que el router emita lo que el importador calcula. Aquí se exige que el
// tipo del cliente NOMBRE lo que el router emite.
//
// Los dos juntos cubren la cadena entera, que es donde se perdieron tres datos:
//
//   motor → router      `fusion` se calculaba y el router no la devolvía
//   router → tipo       `reservas` se emitía y el tipo no lo declaraba
//   spec  → registro    `teacher_phone` se escribía y el lector no lo emitía
//
// Un tipo que no nombra un campo lo borra: `handle<T>()` no valida en runtime,
// pero nadie escribe código contra un campo que su tipo no tiene, así que el
// dato llega al navegador y muere ahí.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const raiz = resolve(__dirname, "../../..");

function cuerpoDelEndpoint(): string {
  const fuente = readFileSync(resolve(raiz, "api/R/router_monitoreo.R"), "utf-8").split("\n");
  const ini = fuente.findIndex((l) => l.includes("aulas/importar-libro"));
  expect(ini).toBeGreaterThan(-1);
  const resto = fuente.slice(ini + 1);
  const fin = resto.findIndex((l) => /^\s*plumber::pr_post\(/.test(l));
  return resto.slice(0, fin === -1 ? resto.length : fin).join("\n");
}

/** Los campos que el endpoint nombra en su `list(...)` de respuesta. */
function camposEmitidos(cuerpo: string): string[] {
  const lista = cuerpo.slice(cuerpo.lastIndexOf("list("));
  return [...lista.matchAll(/^\s{6,}([a-z_]+)\s*=/gm)].map((m) => m[1]);
}

describe("el cliente nombra lo que el router de importación emite", () => {
  it("declara cada campo de la respuesta", () => {
    const emitidos = camposEmitidos(cuerpoDelEndpoint());
    // Si esto baja de 4, el extractor dejó de encontrar el `list(...)` y el test
    // pasaría por vacío en vez de por conforme.
    expect(emitidos.length).toBeGreaterThanOrEqual(4);

    const cliente = readFileSync(resolve(raiz, "frontend/src/api/monitoreo.ts"), "utf-8");
    const desde = cliente.indexOf("export async function apiMonitoreoAulasImportarLibro");
    expect(desde).toBeGreaterThan(-1);
    const bloque = cliente.slice(desde, desde + 2200);

    // `ok` y `saved_project` son del sobre, no del importador.
    const sinTipar = emitidos
      .filter((campo) => !["ok", "saved_project"].includes(campo))
      .filter((campo) => !new RegExp(`\\b${campo}\\??:`).test(bloque));

    expect(sinTipar, `el router emite estos campos y el tipo del cliente no los nombra: ${sinTipar.join(", ")}`)
      .toEqual([]);
  });
});
