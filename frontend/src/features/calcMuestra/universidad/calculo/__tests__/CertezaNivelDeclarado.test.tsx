/**
 * La columna de probabilidad se marca contra el nivel DECLARADO, no contra 0,95.
 *
 * El nivel de certeza lo fija el estudio y la cabecera del panel ya lo muestra
 * —«Titulares para 90%»—, pero la celda de probabilidad comparaba contra un 0,95
 * escrito a mano. Con un nivel más exigente, filas que NO lo alcanzan salían sin
 * marcar; con uno más laxo, filas conformes salían marcadas. Es el mismo defecto
 * que ya se corrigió en el semáforo de reservas: pintar contra una constante
 * propia en vez de contra lo declarado.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CertezaCoberturaPanel } from "../CertezaCoberturaPanel";
import type { CertezaVista } from "../certezaCoberturaModel";

function vista(nivelPct: number, prob: number): CertezaVista {
  const fila = {
    key: "F1", label: "DERECHO", cuota: 100, disponibles: 40,
    aulas_formula: 5, probabilidad_formula: prob, aulas_certeza: 7,
    brecha: 2, estado: "corta", cotaSuperior: false,
  };
  return {
    certeza: { nivel: nivelPct } as CertezaVista["certeza"],
    filas: [fila], criticos: [], nivelPct,
    aulasFormula: 5, aulasCerteza: 7, brecha: 2,
    hayCotaSuperior: false, vigente: true,
  } as unknown as CertezaVista;
}

function pintar(nivelPct: number, prob: number): string {
  return renderToStaticMarkup(
    <CertezaCoberturaPanel
      filasResultado={[]}
      vista={vista(nivelPct, prob)}
      busy={false}
      onMedir={() => {}}
    />,
  );
}

describe("marca de probabilidad baja", () => {
  it("con nivel 0,95 se comporta como siempre", () => {
    expect(pintar(0.95, 0.62)).toContain('data-bajo=""');
    expect(pintar(0.95, 0.97)).not.toContain('data-bajo=""');
  });

  it("con un nivel más exigente, una probabilidad que antes pasaba se marca", () => {
    // EL caso: 0,97 cumple el 95% pero NO el 99% que el estudio declaró.
    expect(pintar(0.99, 0.97)).toContain('data-bajo=""');
  });

  it("con un nivel más laxo, una probabilidad conforme deja de marcarse", () => {
    // 0,80 no llega al 95% de fábrica pero sí al 75% declarado: marcarla diría
    // que incumple un objetivo que nadie fijó.
    expect(pintar(0.75, 0.8)).not.toContain('data-bajo=""');
  });
});
