import { describe, expect, it } from "vitest";
import { MOTIVOS_DE_REEMPLAZO, aulasMotivoLabel } from "./aulasPresentation";
import { fuenteDelMotor } from "./fuenteDelMotor.testutil";

/**
 * **Tercera lista del perfil que vivía en dos sitios sin que nada los atara.**
 *
 * `MOTIVOS_DE_REEMPLAZO` alimenta el select del registro de campo y el rótulo de
 * la tabla de cadenas; sus claves son las de `monitoreo_aulas_motivos_reemplazo()`
 * en R, que es quien valida lo que se guarda. El propio comentario del frontend
 * lo dice —«si el motor añade uno, aquí sale su clave cruda y se ve que falta el
 * rótulo»—, y eso es cierto pero se ve TARDE: cuando alguien mira esa tabla.
 *
 * Las otras dos ya están atadas —los tramos de cobertura y los estados
 * dormidos—, y este perfil ya pagó el precio de no hacerlo: la jerga
 * `docente_no_autoriza` llegó a la pantalla en crudo porque la lista tenía dos
 * dueños.
 *
 * Se lee el R en vez de copiar las claves: copiarlas sería crear la tercera.
 */
const R = new URL("../../../../../../api/R/monitoreo_aulas_universitarias.R", import.meta.url);

function motivosDelMotor(): string[] {
  const fuente = fuenteDelMotor(R);
  const m = fuente.match(/monitoreo_aulas_motivos_reemplazo\s*<-\s*function\(\)\s*\{\s*c\(([^)]*)\)/);
  if (!m) throw new Error("no se encontró monitoreo_aulas_motivos_reemplazo() en el motor");
  return [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
}

describe("los motivos de reemplazo son los del motor", () => {
  it("la lista del motor se lee y trae lo que debe: sin esto el test no probaría nada", () => {
    const motor = motivosDelMotor();
    expect(motor.length).toBeGreaterThan(5);
    expect(motor).toContain("docente_no_autoriza");
  });

  it("frontend y motor declaran exactamente las mismas claves", () => {
    expect([...MOTIVOS_DE_REEMPLAZO.map((m) => m.value)].sort()).toEqual([...motivosDelMotor()].sort());
  });

  it("cada clave del motor tiene rótulo, y ninguno es la clave cruda", () => {
    for (const clave of motivosDelMotor()) {
      const rotulo = aulasMotivoLabel(clave);
      expect(rotulo, `«${clave}» sin rótulo`).toBeTruthy();
      expect(rotulo, `«${clave}» sale en crudo`).not.toBe(clave);
      expect(rotulo).not.toMatch(/_/);
    }
  });

  it("una clave que el motor no declara no revienta: sale legible, no en crudo", () => {
    // Es el caso que el comentario describe: el motor añade uno y aquí aún no
    // está. Debe verse algo que un humano pueda leer.
    expect(aulasMotivoLabel("motivo_inventado")).not.toMatch(/_/);
    expect(aulasMotivoLabel("")).toBe("");
    expect(aulasMotivoLabel(null)).toBe("");
  });
});
