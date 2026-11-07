import { describe, expect, test } from "vitest";
import { pestanaPedidaNoDisponible } from "./pestanaNoDisponible";

const CATALOGO = [
  { key: "datos", label: "Datos" },
  { key: "multibase", label: "Multibase" },
  { key: "comparativos", label: "Comparativos" },
];
const UNA_BASE = CATALOGO.filter((p) => p.key === "datos");

describe("pestaña pedida que el estudio no ofrece (L10)", () => {
  test("una pestaña del catálogo que este estudio no tiene se detecta con su nombre", () => {
    expect(pestanaPedidaNoDisponible("multibase", CATALOGO, UNA_BASE)?.label).toBe("Multibase");
  });
  test("una pestaña disponible, una inventada o ninguna no piden corrección", () => {
    expect(pestanaPedidaNoDisponible("datos", CATALOGO, UNA_BASE)).toBeNull();
    expect(pestanaPedidaNoDisponible("inventada", CATALOGO, UNA_BASE)).toBeNull();
    expect(pestanaPedidaNoDisponible(null, CATALOGO, UNA_BASE)).toBeNull();
  });
});
