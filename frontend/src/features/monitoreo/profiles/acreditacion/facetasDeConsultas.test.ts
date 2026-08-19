import { describe, expect, test } from "vitest";
import fs from "node:fs";
import path from "node:path";
import type { MonitoreoInternalQueryCase } from "../../../../api/client";
import { acreditacionRowsForConsultaTab } from "./AcreditacionMonitoreoPage";

// Las cápsulas de filtro de «Consultas» se contaban sobre el corte entero y la
// tabla muestra sólo las filas de SU pestaña. En acrconta cada faceta sumaba
// 810 —488 respuestas de plataforma + 322 casos del universo que nunca
// respondieron— bajo un encabezado que declara «488 filas».
//
// El síntoma medible: «Registros en plataforma» ofrecía «Sin respuesta (322)»
// y, al elegirlo, la tabla decía «0 filas» con su estado vacío. La opción
// prometía 322 filas que esa pestaña no puede mostrar: viven en «Estado de la
// base». Y «Correo (404)» eran 82 respuestas reales más los 322 del universo,
// que no llegaron por correo ni por nada.
//
// Tras contarlas sobre las filas de la pestaña: 16+73+202+197 = 488 en actor,
// 437+39+12 = 488 en respuesta, 212+11+265 = 488 en cruce, 82+78+197+131 = 488
// en canal.

const fuente = fs.readFileSync(
  path.resolve(__dirname, "AcreditacionMonitoreoPage.tsx"),
  "utf8",
);

const caso = (parcial: Partial<MonitoreoInternalQueryCase>) => ({
  actor: "Estudiantes",
  ...parcial,
}) as MonitoreoInternalQueryCase;

describe("la pestaña de plataforma sólo contiene respuestas de plataforma", () => {
  test("un caso del universo sin respuesta no es una fila de plataforma", () => {
    const casos = [
      caso({ response_id: "r-1" }),
      caso({ response_id: "" }),
      caso({}),
    ];
    expect(acreditacionRowsForConsultaTab(casos, "plataforma")).toHaveLength(1);
    // La premisa del defecto: el corte entero SÍ los trae, y por eso contarlos
    // ahí inflaba las facetas.
    expect(acreditacionRowsForConsultaTab(casos, "base")).toHaveLength(3);
  });
});

describe("las facetas se cuentan sobre las filas de la pestaña", () => {
  test("existe una base de facetas derivada de la pestaña activa", () => {
    expect(fuente).toMatch(
      /const facetCases = useMemo\(\(\) => acreditacionRowsForConsultaTab\(explorerCases, activeTab\)/,
    );
  });

  test.each([
    "actorFacetCases",
    "dateFacetCases",
    "channelFacetCases",
    "sourceFacetCases",
    "collectorFacetCases",
    "responseFacetCases",
    "crossingFacetCases",
  ])("%s filtra sobre facetCases y no sobre el corte entero", (nombre) => {
    const linea = fuente.split("\n").find((l) => l.includes(`const ${nombre} = useMemo`));
    expect(linea).toBeDefined();
    expect(linea).toContain("facetCases.filter");
    expect(linea).not.toContain("explorerCases.filter");
  });

  test("se comprobaron las siete facetas que dibuja el panel", () => {
    // Si alguien añade una octava cápsula contándola sobre `explorerCases`, la
    // lista de arriba no la mira. Este conteo la delata.
    const facetas = fuente.match(/const \w+FacetCases = useMemo/g) ?? [];
    expect(facetas.length).toBe(7);
  });
});
