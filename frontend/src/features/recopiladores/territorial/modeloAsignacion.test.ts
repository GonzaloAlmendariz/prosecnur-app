import { describe, expect, it } from "vitest";

import { normalizarAsignacionTerritorial, type AsignacionTerritorial } from "../../../api/materialTerritorial";
import { asignarColumna, borradorDe, codigoDeColumna, cuerpoDelBorrador, hayCambios, motivoDeBloqueo } from "./modeloAsignacion";

const leida = (extra: Record<string, unknown> = {}): AsignacionTerritorial =>
  normalizarAsignacionTerritorial({
    campaign_id: "territorial.principal",
    equipo: [{ codigo: "P844", nombre: "Encuestador Ejemplo Uno" }, { codigo: "P930", nombre: "Encuestadora Ejémplo Dos" }],
    asignacion: [
      { id_manzana: "a", label: "UMP 1", role: "titular", codigo: "P844", origen: "explicita" },
      { id_manzana: "r", label: "R 1", role: "reemplazo", codigo: "P844", origen: "heredada" },
    ],
    asignacion_revision: 2,
    sin_fuente: false,
    stale: false,
    desactualizada: false,
    huerfanas: 0,
    codigos_fuera_del_equipo: {},
    ...extra,
  });

describe("asignación por columna del calendario", () => {
  it("el borrador sólo lleva lo explícito: la herencia del reemplazo la resuelve el backend", () => {
    expect(borradorDe(leida())).toEqual({ a: "P844" });
  });
  it("una columna toma el código común, vacío si no hay y null si están mezcladas", () => {
    expect(codigoDeColumna(["a"], { a: "P844" })).toBe("P844");
    expect(codigoDeColumna(["b", "c"], { a: "P844" })).toBe("");
    expect(codigoDeColumna(["a", "b"], { a: "P844" })).toBeNull();
  });
  it('asignar la columna pisa todas sus UMP; "sin asignar" las quita', () => {
    const b = asignarColumna({ a: "P844", z: "P930" }, ["a", "b"], "P930");
    expect(b).toEqual({ a: "P930", b: "P930", z: "P930" });
    expect(asignarColumna(b, ["a", "b"], "")).toEqual({ z: "P930" });
    expect(cuerpoDelBorrador({ b: "P1", a: "P2" })).toEqual([{ id_manzana: "a", codigo: "P2" }, { id_manzana: "b", codigo: "P1" }]);
  });
  it("detecta cambios contra lo guardado", () => {
    expect(hayCambios({ a: "P844" }, leida())).toBe(false);
    expect(hayCambios({ a: "P930" }, leida())).toBe(true);
  });
  it("bloquea sin envío, con la foto desactualizada o sin lista de Monitoreo", () => {
    expect(motivoDeBloqueo(leida())).toBeNull();
    expect(motivoDeBloqueo(leida({ sin_fuente: true }))).toMatch(/vuelve a enviarla/);
    expect(motivoDeBloqueo(leida({ stale: true }))).toMatch(/reenvíala/);
    expect(motivoDeBloqueo(leida({ equipo: [] }))).toMatch(/Monitoreo/);
    expect(motivoDeBloqueo(leida({ code_format: "DNI", equipo: [] }))).toMatch(/identifica por DNI/);
  });
  it("normaliza escalares de R y descarta filas sin código o con rol desconocido", () => {
    const a = leida({ asignacion: [{ id_manzana: ["x"], role: "titular", codigo: "P1" }, { id_manzana: "y", role: "otro", codigo: "P2" }, { id_manzana: "z", role: "titular", codigo: "" }] });
    expect(a.asignacion.map((u) => u.id_manzana)).toEqual(["x"]);
    expect(a.revision).toBe(2);
    expect(a.codigos_fuera_del_equipo).toEqual([]);
  });
});
