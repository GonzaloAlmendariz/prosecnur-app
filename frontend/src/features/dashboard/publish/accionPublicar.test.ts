import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { DashboardLastDeploy } from "../../../api/dashboard";
import { accionPublicar, MOTIVO_SIN_FUENTE } from "./accionPublicar";

const aqui = path.dirname(fileURLToPath(import.meta.url));

describe("el botón Publicar del tablero", () => {
  it("sin base elegida queda deshabilitado y dice por qué", () => {
    expect(accionPublicar({ tieneFuente: false })).toEqual({ label: "Publicar", disabled: true, title: MOTIVO_SIN_FUENTE });
  });

  it("sin base tampoco re-publica, aunque haya un deploy anterior", () => {
    const previo = { repo_id: "pulso/tablero" } as DashboardLastDeploy;
    expect(accionPublicar({ tieneFuente: false, lastDeploy: previo })).toMatchObject({ disabled: true, title: MOTIVO_SIN_FUENTE });
  });

  it("con base publica, y re-publica al destino anterior", () => {
    expect(accionPublicar({ tieneFuente: true })).toMatchObject({ disabled: false, label: "Publicar" });
    const previo = { repo_id: "pulso/tablero" } as DashboardLastDeploy;
    expect(accionPublicar({ tieneFuente: true, lastDeploy: previo })).toEqual({
      label: "Re-publicar",
      disabled: false,
      title: "Re-publicar a pulso/tablero",
    });
  });

  it("el motivo es el mismo que devuelve el backend al negarse", () => {
    const r = readFileSync(path.resolve(aqui, "../../../../../api/R/dashboard_publish_fuente.R"), "utf8");
    expect(r).toContain(`"${MOTIVO_SIN_FUENTE}"`);
  });

  it("la página usa esta acción para el botón", () => {
    const pagina = readFileSync(path.resolve(aqui, "../DashboardPage.tsx"), "utf8");
    expect(pagina).toMatch(/\.\.\.accionPublicar\(\{ tieneFuente: hasDashboardSource/);
  });
});
