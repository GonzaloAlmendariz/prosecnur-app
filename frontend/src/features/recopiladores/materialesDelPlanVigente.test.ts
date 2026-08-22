// Qué defiende este archivo: que un material generado con un plan anterior no se
// vea igual que uno bueno.
//
// El motor ya declaraba `stale` cuando cambia la huella del plan, pero sólo para
// el deployment. Las fichas QR ya generadas se listaban con nombre, páginas y
// checksum, y nada decía de qué sorteo salieron — aunque cada recibo guarda su
// `plan_fingerprint` desde el principio. Se descargan y se llevan a campo con
// los cursos-horario del sorteo anterior, y un papel impreso ya no avisa de nada.
import { describe, expect, it } from "vitest";
import { contarDesfasados, juzgarMaterialesDelPlan } from "./materialesDelPlanVigente";

const material = (receipt_id: string, plan_fingerprint?: string | null) =>
  ({ receipt_id, plan_fingerprint });

describe("juzgarMaterialesDelPlan", () => {
  it("marca el material que salió de otro plan", () => {
    const r = juzgarMaterialesDelPlan(
      [material("a", "sha256:viejo"), material("b", "sha256:vigente")],
      "sha256:vigente",
    );
    expect(r.map((x) => x.desfasado)).toEqual([true, false]);
  });

  it("sin huella vigente no juzga a nadie", () => {
    // Un proyecto que todavía no tiene plan no vuelve obsoletos sus materiales:
    // simplemente no hay con qué comparar.
    expect(contarDesfasados([material("a", "sha256:x")], "")).toBe(0);
    expect(contarDesfasados([material("a", "sha256:x")], null)).toBe(0);
    expect(contarDesfasados([material("a", "sha256:x")], undefined)).toBe(0);
  });

  it("un material sin huella tampoco se marca", () => {
    // Un recibo anterior a que se guardara la procedencia es falta de dato, no
    // prueba de desfase. Marcarlo sería acusar por no saber.
    expect(contarDesfasados([material("a", null), material("b")], "sha256:vigente")).toBe(0);
  });

  it("no se deja engañar por espacios", () => {
    expect(contarDesfasados([material("a", " sha256:vigente ")], "sha256:vigente")).toBe(0);
  });

  it("conserva el material entero, no sólo su id", () => {
    // El consumidor pinta la fila completa desde este resultado.
    const [primero] = juzgarMaterialesDelPlan([material("a", "sha256:v")], "sha256:v");
    expect(primero.material.receipt_id).toBe("a");
  });

  it("una lista vacía no cuenta desfasados", () => {
    expect(contarDesfasados([], "sha256:vigente")).toBe(0);
  });
});
