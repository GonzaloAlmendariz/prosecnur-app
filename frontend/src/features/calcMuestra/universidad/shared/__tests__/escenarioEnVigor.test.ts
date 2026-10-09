/**
 * Las cifras son las de HSVG 2026 medidas el 2026-08-27 sobre el estado vivo:
 * componente Universidad 165 aulas, componente Facultades 174, corrida sellada
 * el 2026-08-26T14:28:33Z con 174 titulares que calzan con Facultades en las
 * quince facultades y con Universidad en nueve.
 */
import { describe, expect, it } from "vitest";
import type { CalcMuestraComponente, CalcMuestraWorkspace } from "../../../../../api/client";
import { declararEscenarioEscribe, escenarioEnVigor, titularesPorFacultad } from "../escenarioEnVigor";

/** [facultad, aulas en Universidad, aulas en Facultades] */
const HSVG2026: ReadonlyArray<readonly [string, number, number]> = [
  ["ARQUITECTURA Y URBANISMO", 8, 8],
  ["ARTE Y DISEÑO", 15, 15],
  ["ARTES ESCÉNICAS", 8, 8],
  ["CIENCIAS CONTABLES", 2, 3],
  ["CIENCIAS E INGENIERIA", 37, 37],
  ["CIENCIAS SOCIALES", 12, 12],
  ["CIENCIAS Y ARTES DE LA COMUN.", 7, 7],
  ["DERECHO", 16, 19],
  ["EDUCACION", 3, 3],
  ["ESTUDIOS GENERALES CIENCIAS", 22, 22],
  ["ESTUDIOS GENERALES LETRAS", 18, 20],
  ["GASTRONOMÍA, HOTELERÍA Y TURISMO", 3, 3],
  ["GESTIÓN Y ALTA DIRECCIÓN", 6, 7],
  ["LETRAS Y CIENCIAS HUMANAS", 3, 4],
  ["PSICOLOGÍA", 5, 6],
];

function componente(actorId: string, columna: 1 | 2): CalcMuestraComponente {
  return {
    id: `cmp-${actorId}`,
    actor_id: actorId,
    resultado: {
      aulas_por_estrato: HSVG2026.map(([estrato, uni, fac]) => ({
        estrato,
        N: 0,
        cuota: 0,
        avg_conglomerado: 0,
        tau: 0,
        aulas_base: columna === 1 ? uni : fac,
        aulas_reemplazo: 0,
        aulas_extra_operativas: 0,
        aulas_total: 0,
      })),
    },
  } as unknown as CalcMuestraComponente;
}

const COMPONENTES = [
  componente("estudiantes_universidad", 1),
  componente("estudiantes_facultad", 2),
];

/** La corrida sellada: 174 titulares repartidos como la columna Facultades. */
function sorteo(columna: 1 | 2 = 2) {
  const filas = HSVG2026.flatMap(([facultad, uni, fac]) =>
    Array.from({ length: columna === 1 ? uni : fac }, () => ({
      sample_role: "titular",
      faculty: facultad,
    })),
  );
  // Los reemplazos no cuentan como titulares y deben ser ignorados.
  filas.push({ sample_role: "chain_reserve", faculty: "DERECHO" });
  return { schema: "calc_muestra_aulas_selection_v1", selection: filas } as never;
}

function workspace(escenario?: "e1" | "e2"): CalcMuestraWorkspace {
  return {
    motor_recorrido: { decisiones: escenario ? { escenario } : {} },
  } as unknown as CalcMuestraWorkspace;
}

describe("escenarioEnVigor", () => {
  it("cuenta 174 titulares y descarta los reemplazos", () => {
    const mapa = titularesPorFacultad(sorteo());
    expect(mapa).not.toBeNull();
    expect([...mapa!.values()].reduce((a, n) => a + n, 0)).toBe(174);
    expect(mapa!.get("DERECHO")).toBe(19);
  });

  it("sin escenario declarado, el sorteo de HSVG 2026 delata e2 y no e1", () => {
    const vigor = escenarioEnVigor({
      workspace: workspace(),
      componentes: COMPONENTES,
      seleccion: sorteo(),
    });
    expect(vigor.escenario).toBe("e2");
    expect(vigor.origen).toBe("sorteo");
    expect(vigor.declarado).toBeNull();
    expect(vigor.titularesSorteados).toBe(174);
    expect(vigor.discrepa).toBe(false);
  });

  it("una decisión declarada manda sobre el sorteo, y la contradicción se publica", () => {
    const vigor = escenarioEnVigor({
      workspace: workspace("e1"),
      componentes: COMPONENTES,
      seleccion: sorteo(),
    });
    expect(vigor.escenario).toBe("e1");
    expect(vigor.origen).toBe("declarado");
    expect(vigor.delSorteo).toBe("e2");
    expect(vigor.discrepa).toBe(true);
  });

  it("sin corrida no se infiere nada: e1 por defecto y sin discrepancia", () => {
    const vigor = escenarioEnVigor({
      workspace: workspace(),
      componentes: COMPONENTES,
      seleccion: null,
    });
    expect(vigor.escenario).toBe("e1");
    expect(vigor.origen).toBe("defecto");
    expect(vigor.titularesSorteados).toBeNull();
  });

  it("si los dos componentes reparten igual, el sorteo no delata nada", () => {
    const gemelos = [
      componente("estudiantes_universidad", 2),
      componente("estudiantes_facultad", 2),
    ];
    const vigor = escenarioEnVigor({
      workspace: workspace(),
      componentes: gemelos,
      seleccion: sorteo(),
    });
    expect(vigor.origen).toBe("defecto");
    expect(vigor.delSorteo).toBeNull();
  });

  it("un calce parcial no cuenta: nueve de quince facultades no es evidencia", () => {
    // La corrida sigue a Universidad salvo en Derecho, que trae una aula de más.
    const casi = HSVG2026.flatMap(([facultad, uni]) =>
      Array.from({ length: facultad === "DERECHO" ? uni + 1 : uni }, () => ({
        sample_role: "titular",
        faculty: facultad,
      })),
    );
    const vigor = escenarioEnVigor({
      workspace: workspace(),
      componentes: COMPONENTES,
      seleccion: { schema: "v1", selection: casi } as never,
    });
    expect(vigor.origen).toBe("defecto");
    expect(vigor.delSorteo).toBeNull();
    expect(vigor.titularesSorteados).toBe(166);
  });
});

describe("declararEscenarioEscribe", () => {
  it("sin decision previa, cualquier clic se escribe aunque el sorteo diga otra cosa", () => {
    // El caso que dejo muerto el boton: la pantalla muestra e2 por inferencia
    // y el store responde e1 por defecto. Clickear e1 TIENE que escribirse.
    const vigor = escenarioEnVigor({
      workspace: workspace(),
      componentes: COMPONENTES,
      seleccion: sorteo(),
    });
    expect(vigor.escenario).toBe("e2");
    expect(declararEscenarioEscribe(vigor, "e1")).toBe(true);
    expect(declararEscenarioEscribe(vigor, "e2")).toBe(true);
  });

  it("con la decision ya declarada, reelegirla no escribe", () => {
    const vigor = escenarioEnVigor({
      workspace: workspace("e1"),
      componentes: COMPONENTES,
      seleccion: sorteo(),
    });
    expect(declararEscenarioEscribe(vigor, "e1")).toBe(false);
    expect(declararEscenarioEscribe(vigor, "e2")).toBe(true);
  });
});
