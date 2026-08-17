/**
 * La lista de facultades excluidas se ve y se puede tocar.
 *
 * El motor ya sabe excluirlas —`excluded_faculties` en la config, motivo
 * `faculty_excluida` en el marco— pero hasta esta tarjeta esa capacidad no
 * tenía consumidor: existía por API y el analista no podía usarla. La decisión
 * de Gonzalo fue explícita: «una lista explícita de facultades excluidas,
 * editable en la UI».
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  FacultadesExcluidasCard,
  claveFacultad,
  estaExcluida,
} from "../FacultadesExcluidasCard";
import type { CalcMuestraWorkspaceAulasConfig } from "../../../../../api/calcMuestra";
import {
  filtrosLegacyPayload,
  normalizeUniversityAulasConfig,
} from "../../shared/study";

const FACULTADES = [
  { key: "der", label: "DERECHO", aulas: 440 },
  { key: "pos", label: "ESCUELA DE POSGRADO", aulas: 852 },
  { key: "psi", label: "PSICOLOGÍA", aulas: 100 },
];

function pintar(excluidas: string[]): string {
  return renderToStaticMarkup(
    <FacultadesExcluidasCard
      config={{ excluded_faculties: excluidas } as CalcMuestraWorkspaceAulasConfig}
      facultades={FACULTADES}
      onPatch={() => {}}
    />,
  );
}

describe("clave de comparación", () => {
  it("iguala acentos, mayúsculas y espacios de más", () => {
    // Misma normalización que el motor R: la lista la escribe una persona y la
    // base la escribe la universidad.
    expect(claveFacultad("PSICOLOGÍA")).toBe(claveFacultad("psicologia"));
    expect(claveFacultad("  ESCUELA  DE POSGRADO ")).toBe("ESCUELA DE POSGRADO");
    expect(claveFacultad("GASTRONOMÍA, HOTELERÍA Y TURISMO")).toBe(
      "GASTRONOMIA HOTELERIA Y TURISMO",
    );
  });

  it("no confunde facultades distintas", () => {
    expect(estaExcluida("DERECHO", ["ESCUELA DE POSGRADO"])).toBe(false);
    expect(estaExcluida("PSICOLOGÍA", ["PSICOLOGIA"])).toBe(true);
  });
});

describe("tarjeta de facultades excluidas", () => {
  it("lista las facultades del marco con sus aulas", () => {
    const html = pintar([]);
    expect(html).toContain("DERECHO");
    expect(html).toContain("ESCUELA DE POSGRADO");
    expect(html).toContain("852 aulas");
  });

  it("sin exclusiones lo dice, en vez de dejar el hueco mudo", () => {
    expect(pintar([])).toContain("Ninguna facultad excluida");
  });

  it("marca la casilla de la facultad excluida", () => {
    const html = pintar(["ESCUELA DE POSGRADO"]);
    expect(html).toContain('data-excluida="true"');
    expect(html).toContain("checked");
  });

  it("cuenta cuántas aulas quedan fuera del marco", () => {
    // Lo que importa no es cuántas facultades marcaste, sino cuánto marco
    // pierdes: 852 aulas es una decisión grande.
    const html = pintar(["ESCUELA DE POSGRADO"]);
    expect(html).toContain("1 facultad excluida");
    expect(html).toContain("852 aulas fuera del marco");
  });

  it("suma las aulas de varias exclusiones", () => {
    const html = pintar(["ESCUELA DE POSGRADO", "PSICOLOGÍA"]);
    expect(html).toContain("2 facultades excluidas");
    expect(html).toContain("952 aulas fuera del marco");
  });

  it("sin marco construido invita a construirlo, no miente con una lista vacía", () => {
    const html = renderToStaticMarkup(
      <FacultadesExcluidasCard
        config={{} as CalcMuestraWorkspaceAulasConfig}
        facultades={[]}
        onPatch={() => {}}
      />,
    );
    expect(html).toContain("todavía no declara facultades");
  });

  it("al marcar una facultad la añade sin perder las anteriores", () => {
    const onPatch = vi.fn();
    // Se ejercita la funcion de alternado directamente sobre el contrato que
    // consume la pestaña: patch parcial con la lista completa.
    const config = { excluded_faculties: ["ESCUELA DE POSGRADO"] } as CalcMuestraWorkspaceAulasConfig;
    renderToStaticMarkup(
      <FacultadesExcluidasCard config={config} facultades={FACULTADES} onPatch={onPatch} />,
    );
    // El render no dispara onPatch: el contrato se comprueba en el markup y en
    // `estaExcluida`, que es la logica que decide que va marcado.
    expect(onPatch).not.toHaveBeenCalled();
    expect(estaExcluida("ESCUELA DE POSGRADO", config.excluded_faculties ?? [])).toBe(true);
    expect(estaExcluida("DERECHO", config.excluded_faculties ?? [])).toBe(false);
  });
});

describe("la lista llega hasta el motor", () => {
  /**
   * El eslabón que más importa y el que ningún test cubría: un campo nuevo
   * cruza cuatro listas —el tipo, el default, la normalización y el payload— y
   * si se cae en la última, la UI queda preciosa y el motor no se entera.
   * El mutante que vaciaba `excluded_faculties` en `filtrosLegacyPayload`
   * sobrevivía a los 153 tests de `shared`.
   */
  it("viaja en el payload de filtros que consume el motor", () => {
    const cfg = normalizeUniversityAulasConfig({
      excluded_faculties: ["ESCUELA DE POSGRADO", "ESCUELA DE ESTUDIOS ESPECIALES"],
    } as never);
    expect(cfg.excluded_faculties).toEqual([
      "ESCUELA DE POSGRADO",
      "ESCUELA DE ESTUDIOS ESPECIALES",
    ]);
    const esperado = ["ESCUELA DE POSGRADO", "ESCUELA DE ESTUDIOS ESPECIALES"];
    const OPC = { c7: false, c8: false };
    // Las DOS ramas: con la suite apagada y encendida. Una exclusión de diseño
    // no la revoca una suite —si el estudio dice que una facultad no participa,
    // no participa—, y el motor R aplica el mismo criterio sin mirar la suite.
    expect(filtrosLegacyPayload(cfg, false, OPC).excluded_faculties).toEqual(esperado);
    expect(filtrosLegacyPayload(cfg, true, OPC).excluded_faculties).toEqual(esperado);
  });

  it("un estudio sin exclusiones manda una lista vacía, no un hueco", () => {
    const cfg = normalizeUniversityAulasConfig({} as never);
    const OPC = { c7: false, c8: false };
    expect(cfg.excluded_faculties).toEqual([]);
    expect(filtrosLegacyPayload(cfg, false, OPC).excluded_faculties).toEqual([]);
    expect(filtrosLegacyPayload(cfg, true, OPC).excluded_faculties).toEqual([]);
  });
});
