/**
 * V3/V5 del goal loop de Selección: un rótulo constante se escribe una vez.
 *
 * El caso que abrió esta línea: «Ajuste frente al marco» en el estudio real
 * traía doce filas y las doce empezaban con la palabra «Facultad» en negrita,
 * que es la dimensión —constante— y no lo que identifica a la fila.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { CalcMuestraAulasProfileDistribution } from "../../../../../api/client";
import { ProfileBalanceChart } from "../ClassroomMethodPanels";

const fila = (
  category: string,
  extra: Partial<CalcMuestraAulasProfileDistribution> = {},
): CalcMuestraAulasProfileDistribution => ({
  dimension: "faculty",
  label: "Facultad",
  category,
  frame_prop: 0.038,
  selected_prop: 0.036,
  tolerance: 0.025,
  within_tolerance: true,
  ...extra,
});

const contar = (html: string, aguja: string) => html.split(aguja).length - 1;

describe("ProfileBalanceChart · la dimensión se dice una vez", () => {
  it("doce facultades traen un solo rótulo «Facultad»", () => {
    const rows = ["ARQUITECTURA", "ARTE", "DERECHO", "EDUCACION"].map((c) => fila(c));
    const html = renderToStaticMarkup(<ProfileBalanceChart rows={rows} />);
    expect(contar(html, "Facultad")).toBe(1);
    expect(html).toContain('class="cmv2-profile-dimension"');
    // Y cada fila conserva su identidad: la categoría es la que va en negrita.
    for (const c of ["ARQUITECTURA", "ARTE", "DERECHO", "EDUCACION"]) {
      expect(html).toContain(`<strong>${c}</strong>`);
    }
  });

  it("dos dimensiones distintas abren dos grupos", () => {
    const rows = [
      fila("ARQUITECTURA"),
      fila("DERECHO"),
      fila("MAÑANA", { dimension: "shift", label: "Turno" }),
    ];
    const html = renderToStaticMarkup(<ProfileBalanceChart rows={rows} />);
    expect(contar(html, "cmv2-profile-dimension")).toBe(2);
    expect(contar(html, ">Facultad<")).toBe(1);
    expect(contar(html, ">Turno<")).toBe(1);
  });

  it("marco y muestra se leen, no solo se escuchan", () => {
    // Antes vivían únicamente en el aria-label de la barra.
    const html = renderToStaticMarkup(
      <ProfileBalanceChart rows={[fila("DERECHO", { frame_prop: 0.08, selected_prop: 0.11 })]} />,
    );
    expect(html).toContain("marco 8.0% · muestra 11.0%");
    expect(html).toContain("3.0% de brecha");
  });

  it("sin filas utilizables cae al vacío declarado (C3)", () => {
    const html = renderToStaticMarkup(<ProfileBalanceChart rows={[]} />);
    expect(html).toContain("Sin perfil calculado");
    expect(html).not.toContain("cmv2-profile-dimension");
  });
});
