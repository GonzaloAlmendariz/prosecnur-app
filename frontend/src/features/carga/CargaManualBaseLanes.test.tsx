import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CargaManualBaseLanes } from "./CargaManualBaseLanes";
import type { EstudioBase } from "../../api/client";

const componentPath = fileURLToPath(new URL("./CargaManualBaseLanes.tsx", import.meta.url));
const source = fs.existsSync(componentPath) ? fs.readFileSync(componentPath, "utf8") : "";

function base(nombre: string): EstudioBase {
  return { nombre, n_filas: 52, n_columnas: 112 } as EstudioBase;
}

function renderLanes({
  plannedInputCount,
  bases,
  disabled = false,
}: {
  plannedInputCount: number;
  bases: EstudioBase[];
  disabled?: boolean;
}) {
  return renderToStaticMarkup(
    <CargaManualBaseLanes
      plannedInputCount={plannedInputCount}
      bases={bases}
      disabled={disabled}
      onChanged={async () => {}}
    />,
  );
}

// Un `lane-index` por carril renderizado, ocupado o libre.
function countLanes(markup: string) {
  return markup.split("pulso-carga-manual-lane-index").length - 1;
}

describe("carriles manuales por entrada planificada", () => {
  it("renderiza un carril estable por plannedInputCount", () => {
    expect(source).toContain("plannedInputCount");
    expect(source).toMatch(/Array\.from\([\s\S]*plannedInputCount/iu);
    expect(source).toMatch(/carril|entrada|base/iu);
  });

  it("no reintroduce plannedBaseCount como estado paralelo", () => {
    expect(source).not.toContain("plannedBaseCount");
  });

  // Regresión: un proyecto reabierto con sus bases ya materializadas quedaba sin
  // ningún destino nuevo, porque `plannedInputCount` es efímero (default 1) y no
  // se deriva del .pulso. Con una base cargada, la superficie mostraba un único
  // carril ocupado y no había forma de agregar la siguiente.
  it("deja un carril libre detrás de las bases ya materializadas", () => {
    const markup = renderLanes({ plannedInputCount: 1, bases: [base("default")] });
    expect(countLanes(markup)).toBe(2);
    expect(markup).toContain("Crear esta base");
  });

  it("respeta un plan mayor que las bases materializadas", () => {
    const markup = renderLanes({ plannedInputCount: 4, bases: [base("default")] });
    expect(countLanes(markup)).toBe(4);
  });

  it("conserva el carril libre mientras una carga está en curso", () => {
    const markup = renderLanes({ plannedInputCount: 1, bases: [base("default")], disabled: true });
    expect(countLanes(markup)).toBe(2);
  });
});
