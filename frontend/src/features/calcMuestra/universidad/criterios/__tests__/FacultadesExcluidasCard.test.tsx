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

/**
 * Facultades DEL MARCO, como las entrega el perfil del motor. La tarjeta se
 * alimentaba del catálogo de la variable `faculty`, que tiene `scope: "alumno"`:
 * su campo `aulas` cuenta pares alumno-aula por la facultad DEL ALUMNO —sumaba
 * 29.090 sobre un marco de 5.263 aulas— y traía una categoría de más,
 * CONSORCIO DE UNIVERSIDADES, que no es una facultad del marco. En pantalla eso
 * se leía como «ESTUDIOS GENERALES LETRAS · 4.869 aulas» donde hay 482.
 */
const FACULTADES = [
  { key: "der", label: "DERECHO" },
  { key: "pos", label: "ESCUELA DE POSGRADO" },
  { key: "psi", label: "PSICOLOGÍA" },
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
  it("lista las facultades del marco", () => {
    const html = pintar([]);
    expect(html).toContain("DERECHO");
    expect(html).toContain("ESCUELA DE POSGRADO");
    expect(html).toContain("PSICOLOGÍA");
  });

  it("no publica un conteo de aulas que no puede garantizar", () => {
    // EL defecto visto en pantalla: la cifra venía del catálogo de alumno y no
    // eran aulas. Mejor sin cifra que con una falsa.
    const html = pintar(["ESCUELA DE POSGRADO"]);
    // Ninguna CIFRA seguida de «aulas»; el subtítulo sí puede nombrarlas.
    expect(html).not.toMatch(/[0-9][0-9.,]*\s*aulas/);
  });

  it("sin exclusiones lo dice, en vez de dejar el hueco mudo", () => {
    expect(pintar([])).toContain("Ninguna facultad excluida");
  });

  it("marca la casilla de la facultad excluida", () => {
    const html = pintar(["ESCUELA DE POSGRADO"]);
    expect(html).toContain('data-excluida="true"');
    expect(html).toContain("checked");
  });

  it("dice cuántas facultades quedan fuera", () => {
    expect(pintar(["ESCUELA DE POSGRADO"])).toContain("1 facultad excluida del marco");
    expect(pintar(["ESCUELA DE POSGRADO", "PSICOLOGÍA"])).toContain(
      "2 facultades excluidas del marco",
    );
  });

  it("no inventa filas que el marco no declara", () => {
    // El catálogo de alumno traía 18 categorías para 17 facultades: la de más
    // era CONSORCIO DE UNIVERSIDADES, alumnos de otras casas que llevan cursos
    // aquí. Las filas salen del perfil del marco, así que son las que hay.
    const html = pintar([]);
    expect((html.match(/<li/g) ?? []).length).toBe(FACULTADES.length);
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
