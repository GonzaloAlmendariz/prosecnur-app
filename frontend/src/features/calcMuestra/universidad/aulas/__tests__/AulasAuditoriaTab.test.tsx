import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type {
  CalcMuestraAulasFrame,
  CalcMuestraAulasSelection,
} from "../../../../../api/client";
import { AulasAuditoriaTab } from "../AulasAuditoriaTab";
import type { ClassroomLabModel } from "../aulasParts";

vi.mock("../../../didactica/PasoDidactico", () => ({
  RespaldoMetodologico: ({ paso }: { paso: string }) => (
    <div data-respaldo-metodologico={paso} />
  ),
}));

vi.mock("../../ui", () => {
  let fila = 0;
  return {
    CifraFila: ({ children }: { children: ReactNode }) => (
      <section data-cifra-fila={`fila-${++fila}`}>{children}</section>
    ),
    CifraMotor: ({
      label,
      value,
      monospace,
    }: {
      label: string;
      value: string;
      monospace?: boolean;
    }) => (
      <span
        data-cifra-label={label}
        data-cifra-value={value}
        data-cifra-monospace={monospace ? "true" : "false"}
      >
        {label}: {value}
      </span>
    ),
    FormulaLatex: ({ caption }: { caption: string }) => <div>{caption}</div>,
  };
});

vi.mock("../aulasParts", () => ({
  ClassroomMethodSources: () => null,
  ClassroomOperationalHandoffPanel: () => null,
  ClassroomRiskList: () => null,
  ProfileBalanceChart: () => null,
  classroomMethodLabel: (value: string) => value || "método pendiente",
  classroomProbabilitySourceLabel: () => "Diseño probabilístico base",
}));

function modelConFirmas(
  frameHash?: string,
  selectionHash?: string,
  frameGeneratedAt?: string,
): ClassroomLabModel {
  const frame = {
    ...(frameHash ? { frame_hash: frameHash } : {}),
    ...(frameGeneratedAt ? { generated_at: frameGeneratedAt } : {}),
  } as CalcMuestraAulasFrame;
  const selection = selectionHash
    ? ({ frame_hash: selectionHash } as CalcMuestraAulasSelection)
    : ({} as CalcMuestraAulasSelection);

  return {
    frame,
    selection,
    comparison: null,
    config: { semilla: 17, simulation_runs: 0 },
    topGaps: [],
    probabilityRows: [],
    weightStability: null,
    replacementSimulation: null,
    m1Rows: [],
    recommendedMethodId: "pps_systematic",
  } as unknown as ClassroomLabModel;
}

function render(
  frameHash?: string,
  selectionHash?: string,
  frameGeneratedAt?: string,
) {
  return renderToStaticMarkup(
    <AulasAuditoriaTab
      model={modelConFirmas(frameHash, selectionHash, frameGeneratedAt)}
    />,
  );
}

function etiquetasPorFila(html: string): string[][] {
  return Array.from(
    html.matchAll(/<section data-cifra-fila="[^"]+">([\s\S]*?)<\/section>/g),
    ([, contenido]) => Array.from(
      contenido.matchAll(/data-cifra-label="([^"]+)"/g),
      ([, label]) => label,
    ),
  );
}

function etiquetasPorMonospace(html: string, monospace: boolean): string[] {
  return Array.from(
    html.matchAll(
      /<span data-cifra-label="([^"]+)"[^>]*data-cifra-monospace="(true|false)"/g,
    ),
    ([, label, activo]) => ({ label, activo: activo === "true" }),
  )
    .filter((cifra) => cifra.activo === monospace)
    .map((cifra) => cifra.label);
}

describe("AulasAuditoriaTab — vigencia de la selección", () => {
  it("alerta cuando la firma del marco actual difiere de la usada al seleccionar", () => {
    const html = render("marco-actual-123", "marco-seleccion-456");

    expect(html).toContain("El marco cambió después de la selección.");
    expect(html).toContain("marco-actu");
    expect(html).toContain("marco-sele");
  });

  it("separa la firma seleccionada, la firma actual y la fecha del marco actual", () => {
    const html = render(
      "marco-actu",
      "seleccion1",
      "2026-08-01T14:35:00Z",
    );

    expect(html).toContain(
      'data-cifra-label="Firma usada por la selección" data-cifra-value="seleccion1"',
    );
    expect(html).toContain(
      'data-cifra-label="Firma del marco actual" data-cifra-value="marco-actu"',
    );
    expect(html).toContain(
      'data-cifra-label="Marco actual generado" data-cifra-value="2026-08-01 14:35"',
    );
  });

  it("agrupa la evidencia de versión aparte de identidad y ejecución", () => {
    const html = render(
      "marco-actu",
      "seleccion1",
      "2026-08-01T14:35:00Z",
    );

    expect(etiquetasPorFila(html)).toEqual([
      ["Semilla", "Método usado"],
      [
        "Firma usada por la selección",
        "Firma del marco actual",
        "Marco actual generado",
      ],
      ["Probabilidad reportada", "Corrida de selección", "Corridas MC"],
    ]);
  });

  it("declara tipografía monoespaciada por significado y no por posición", () => {
    const html = render(
      "marco-actu",
      "seleccion1",
      "2026-08-01T14:35:00Z",
    );

    expect(etiquetasPorMonospace(html, true)).toEqual([
      "Semilla",
      "Firma usada por la selección",
      "Firma del marco actual",
      "Corrida de selección",
    ]);
    expect(etiquetasPorMonospace(html, false)).toEqual([
      "Método usado",
      "Marco actual generado",
      "Probabilidad reportada",
      "Corridas MC",
    ]);
  });

  it("en un frame legacy no atribuye su fecha actual a la firma histórica de selección", () => {
    const html = render(
      undefined,
      "seleccion1",
      "2026-08-01T09:20:00Z",
    );

    expect(html).toContain(
      'data-cifra-label="Firma usada por la selección" data-cifra-value="seleccion1"',
    );
    expect(html).toContain(
      'data-cifra-label="Marco actual generado" data-cifra-value="2026-08-01 09:20"',
    );
    expect(html).not.toContain('data-cifra-label="Firma del marco"');
    expect(html).not.toContain('data-cifra-label="Generado"');
  });

  it("no alerta cuando ambas firmas coinciden", () => {
    expect(render("misma-firma", "misma-firma")).not.toContain(
      "El marco cambió después de la selección.",
    );
  });

  it.each([
    [undefined, "firma-seleccion"],
    ["firma-marco", undefined],
    [undefined, undefined],
  ])("no inventa obsolescencia si alguna firma está ausente", (frameHash, selectionHash) => {
    expect(render(frameHash, selectionHash)).not.toContain(
      "El marco cambió después de la selección.",
    );
  });

  it("conserva el respaldo metodológico del paso aulas en Sustento", () => {
    expect(render("misma-firma", "misma-firma")).toContain(
      'data-respaldo-metodologico="aulas"',
    );
  });

  // F22 · Prueba del hueco: se declara una vez, no dos.
  // Sin comparación vigente, el aviso de etapa y la caja «Sustento en
  // construcción» decían lo mismo a 96 px de distancia. El aviso manda porque
  // nombra la condición y lleva a resolverla; la caja solo se repetía.
  it("no repite el hueco cuando el aviso de etapa ya lo declara", () => {
    const html = render("misma-firma", "misma-firma");
    const tieneAviso = html.includes("cmv2-aulas-stage-notice");
    expect(tieneAviso).toBe(true);
    expect(html).not.toContain("Sustento en construcción");
    // Y la salida sigue estando: quitar el duplicado no puede quitar el camino.
    // La salida no siempre es un botón —`missing-frame` la da en su copy, que
    // manda a Marco → Cursos-horario—, así que se exige el destino, no el
    // control.
    const copy = html.slice(html.indexOf("cmv2-aulas-stage-copy"));
    expect(copy.slice(0, 400)).toMatch(/Marco|Método|Compara|Selecci/);
  });
});
