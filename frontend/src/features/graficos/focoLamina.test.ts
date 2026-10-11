import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { focoDeId, parsearFocoHeredado, resolverFocoLamina } from "./focoLamina";

const plan = ["s-aaaa0001", "s-bbbb0002", "sug-0003-xyz12", "s-dddd0004"].map((id) => ({ id }));
const movido = [plan[0], plan[2], plan[1], plan[3]];

describe("resolverFocoLamina", () => {
  // Mata: resolver el id por posición (o la posición antes que el id): tras reordenar el enlace saltaría de lámina.
  it("un id sigue en su lámina tras reordenar", () => {
    expect(resolverFocoLamina("sug-0003-xyz12", plan)).toEqual({ id: "sug-0003-xyz12", posicion: 3, ranura: null, heredado: false });
    expect(resolverFocoLamina("sug-0003-xyz12", movido)).toEqual({ id: "sug-0003-xyz12", posicion: 2, ranura: null, heredado: false });
  });

  // Mata: perder la ranura del id o confundirla con parte del id.
  it("`<id>:gK` nombra la ranura K de esa lámina", () => {
    expect(resolverFocoLamina("s-bbbb0002:g2", movido)).toEqual({ id: "s-bbbb0002", posicion: 3, ranura: 2, heredado: false });
    expect(resolverFocoLamina("s-nada:g2", plan)).toBeNull();
  });

  // Mata: dejar de leer los enlaces guardados `l-NN`, o no marcarlos para reescribir.
  it("el heredado `l-NN[:gK]` se resuelve por la posición de ahora y se marca para reescribir", () => {
    expect(resolverFocoLamina("l-03", plan)).toEqual({ id: "sug-0003-xyz12", posicion: 3, ranura: null, heredado: true });
    expect(resolverFocoLamina("l-03:g2", movido)).toEqual({ id: "s-bbbb0002", posicion: 3, ranura: 2, heredado: true });
    expect(resolverFocoLamina("l-13", plan)).toBeNull();
  });

  // Mata: que un id con forma `l-NN` (planes viejos) se lea como posición.
  it("el id exacto gana a la forma heredada", () => {
    const raro = [{ id: "x" }, { id: "l-01" }];
    expect(resolverFocoLamina("l-01", raro)).toMatchObject({ id: "l-01", posicion: 2, heredado: false });
  });

  it("vacío, basura o id inexistente → null (quien llama cae a su lámina por defecto)", () => {
    expect(resolverFocoLamina(null, plan)).toBeNull();
    expect(resolverFocoLamina("  ", plan)).toBeNull();
    expect(resolverFocoLamina("s-inexistente", plan)).toBeNull();
    expect(resolverFocoLamina("l-0", plan)).toBeNull();
    expect(resolverFocoLamina("l-01", [])).toBeNull();
  });
});

describe("focoDeId y parsearFocoHeredado", () => {
  // Mata: volver a escribir la posición (`l-NN`) en navegación nueva.
  it("se escribe el id, con la ranura si la hay; nunca `l-NN`", () => {
    expect(focoDeId("s-aaaa0001")).toBe("s-aaaa0001");
    expect(focoDeId("s-aaaa0001", 2)).toBe("s-aaaa0001:g2");
    expect(focoDeId("s-aaaa0001", null)).toBe("s-aaaa0001");
    expect(focoDeId("s-aaaa0001", 2)).not.toMatch(/^l-\d/);
    expect(resolverFocoLamina(focoDeId("s-dddd0004", 3), movido)).toEqual({ id: "s-dddd0004", posicion: 4, ranura: 3, heredado: false });
  });

  it("lee l-NN y l-NN:gK y rechaza lo demás", () => {
    expect(parsearFocoHeredado("l-07")).toEqual({ posicion: 7, ranura: null });
    expect(parsearFocoHeredado("l-67:g2")).toEqual({ posicion: 67, ranura: 2 });
    expect(parsearFocoHeredado("p-14")).toBeNull();
    expect(parsearFocoHeredado("l-0")).toBeNull();
    expect(parsearFocoHeredado("slide-7")).toBeNull();
    expect(parsearFocoHeredado(null)).toBeNull();
  });
});

describe("una sola gramática de `foco` en Gráficos", () => {
  const dir = path.dirname(fileURLToPath(import.meta.url));
  const leer = (rel: string) => fs.readFileSync(path.join(dir, rel), "utf8");
  const productores = ["laminas/LaminasWorkbench.tsx", "vistaGeneral/VistaGeneral.tsx"];

  // Mata: que una pestaña vuelva a resolver el `foco` con su propia copia (o por posición) y diverjan.
  it("Láminas y Vista general resuelven y escriben con focoLamina.ts", () => {
    for (const rel of productores) {
      const src = leer(rel);
      expect(src, rel).toMatch(/from "\.\.\/focoLamina"/);
      expect(src, rel).toContain("resolverFocoLamina(");
      expect(src, rel).not.toMatch(/`l-\$\{|focoDeLamina|parsearFocoLamina|focoEnLaminas|resolverFocoVistaGeneral/);
    }
  });
});
