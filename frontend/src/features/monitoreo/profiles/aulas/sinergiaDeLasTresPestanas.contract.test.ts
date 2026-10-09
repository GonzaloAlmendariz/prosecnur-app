import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { seguimientoDeRefuerzos } from "./seguimientoDeRefuerzos";
import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";

const dir = path.dirname(fileURLToPath(import.meta.url));
const fila = (p: Record<string, unknown>) => p as unknown as MonitoreoAulasPlanRow;

/**
 * **Reemplazos, Brechas y Refuerzos son tres puertas a la misma decisión.**
 *
 * Gonzalo, 2026-09-12: «hay una relación con la pestaña de reemplazos y la
 * pestaña de brechas… los tres tienen que hablar en sinergia. Si yo en brechas
 * establezco que una facultad le está yendo mal y le asigno un refuerzo, el
 * refuerzo también debería verse aquí, en la pestaña de refuerzos».
 *
 * Así está montado y así debe seguir:
 * - **Reemplazos** (`Cadena de reemplazos`) es de donde salen el reemplazo (A)
 *   y el **complemento (B)**.
 * - **Brechas** ofrece el **refuerzo (C)** al pie de la tabla, cuando la deuda
 *   es de la facultad y ninguna aula la explica.
 * - **Refuerzos** recoge B y C, porque las tres puertas llaman al MISMO hook
 *   contra el MISMO endpoint, que escribe el MISMO plan.
 *
 * Lo que rompía la sinergia no era la falta de conexión: era que el sello se
 * perdía al pasar por el Sheets y lo pedido desaparecía de Refuerzos.
 */
describe("las tres puertas llegan a la pestaña Refuerzos", () => {
  it("un complemento (B), pedido desde Reemplazos, se ve en Refuerzos", () => {
    const s = seguimientoDeRefuerzos([
      fila({ operational_code: "R 12.1", sample_status: "refuerzo_por_contactar", activation_origin: "complemento" }),
    ]);
    expect(s.pedidos.map((p) => p.codigo)).toEqual(["R 12.1"]);
    expect(s.pedidos[0]?.origen).toBe("complemento");
  });

  it("un refuerzo (C), pedido desde Brechas, se ve en Refuerzos", () => {
    const s = seguimientoDeRefuerzos([
      fila({ operational_code: "EXTRA 10", sample_status: "refuerzo_por_contactar", activation_origin: "refuerzo" }),
    ]);
    expect(s.pedidos.map((p) => p.codigo)).toEqual(["EXTRA 10"]);
    expect(s.pedidos[0]?.origen).toBe("refuerzo");
  });

  it("los dos conviven y el embudo los cuenta juntos", () => {
    const s = seguimientoDeRefuerzos([
      fila({ operational_code: "R 12.1", sample_status: "refuerzo_por_contactar", activation_origin: "complemento" }),
      fila({ operational_code: "EXTRA 10", sample_status: "refuerzo_por_contactar", activation_origin: "refuerzo" }),
      fila({ operational_code: "R 75.6", sample_status: "refuerzo_por_contactar", activation_origin: "" }),
    ]);
    expect(s.pedidos).toHaveLength(3);
    expect(s.cuenta.por_contactar).toBe(3);
  });

  it("Brechas sigue teniendo su puerta al refuerzo, y marca de verdad", () => {
    // El salto existe en el pie de la tabla de brechas y termina en `marcar(...)`,
    // no en un simple cambio de pestaña: si alguien lo convierte en navegación,
    // la decisión vuelve a perderse como antes de 2026-09-11.
    const seccion = readFileSync(path.join(dir, "AulasSeccionConsultas.tsx"), "utf8");
    expect(seccion).toContain("AulasLlamadaDeFacultad");
    expect(seccion).toMatch(/onElegir=\{\(fila\)\s*=>\s*\{\s*void marcar\(/);
  });

  it("las tres pestañas siguen declaradas en la misma sección", () => {
    const catalogo = readFileSync(
      path.resolve(dir, "../../../../lib/navegacion/catalogos/monitoreo.ts"), "utf8");
    for (const clave of ["reemplazos", "brechas", "refuerzos"]) {
      expect(catalogo).toContain(`pestana("aulas", "consultas", "${clave}"`);
    }
  });
});
