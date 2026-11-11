import { describe, expect, it } from "vitest";
import { normalizarEstructuraDelInforme, type EstructuraDelInforme } from "../../../api/graficosEstructura";
import {
  conExclusion,
  conGrafico,
  conPlantillaGuardada,
  conPlantillaReusada,
  conSeleccion,
  estadoSeccion,
  exclusionesDe,
  graficosDe,
  laminasDeSeccion,
  plantillasGuardadasDe,
  preguntasVisibles,
  resumenInforme,
  sinPlantillaGuardada,
} from "./modeloPlantillas";
import { PLANTILLAS_INFORME, plantillaInicial } from "./catalogoPlantillas";

const estructura: EstructuraDelInforme = normalizarEstructuraDelInforme({
  perfil: "acnur_kobo_cruncher_plus",
  laminas_fijas: 3,
  secciones: [
    { titulo: "Consentimiento", preguntas: { ref: "consent", etiqueta: "¿Acepta?", tipo: "Sí / No", laminas: 1, dentro: true, grafico: "torta", graficos_posibles: ["barras", "torta", "barras_verticales"], por_registro: false } },
    {
      titulo: "Salud",
      preguntas: [
        { ref: "motivo", etiqueta: "Motivo de la atención", tipo: "Opción múltiple", laminas: 2, dentro: true, grafico: "barras_ordenadas", graficos_posibles: ["barras_ordenadas", "barras"], por_registro: false },
        { ref: "S1$sexo", etiqueta: "Sexo del miembro", tipo: "Opción única", laminas: 1, dentro: true, grafico: "dona", graficos_posibles: ["barras", "barras_ordenadas"], por_registro: true },
      ],
    },
    { titulo: "Vacía", preguntas: {} },
  ],
  avisos: "Un aviso",
});

describe("normalizarEstructuraDelInforme", () => {
  it("lleva a arreglos lo que R manda como escalar o como {} y descarta las secciones vacías", () => {
    expect(estructura.secciones.map((s) => s.titulo)).toEqual(["Consentimiento", "Salud"]);
    expect(estructura.secciones[0].preguntas).toHaveLength(1);
    expect(estructura.secciones[0].preguntas[0].graficosPosibles).toEqual(["barras", "torta", "barras_verticales"]);
    expect(estructura.secciones[0].preguntas[0].grafico).toBe("torta");
    expect(estructura.avisos).toEqual(["Un aviso"]);
  });
  it("un gráfico que la pregunta no admite cae al primero posible", () => {
    const sexo = estructura.secciones[1].preguntas[1];
    expect(sexo.grafico).toBe("barras");
    expect(sexo.porRegistro).toBe(true);
  });
});

describe("selección sobre la estructura", () => {
  it("las exclusiones de scope_rules mandan sobre lo que traía la estructura", () => {
    const reglas = conExclusion({}, ["consent"], true);
    const secciones = conSeleccion(estructura, exclusionesDe(reglas), graficosDe(reglas));
    expect(estadoSeccion(secciones[0])).toBe("ninguna");
    expect(laminasDeSeccion(secciones[0])).toBe(0);
    expect(laminasDeSeccion(secciones[1])).toBe(4);   // 2 + 1 láminas de preguntas y su separador
    expect(resumenInforme(secciones, estructura.laminasFijas)).toEqual({ laminas: 7, secciones: 1, preguntas: 2, fuera: 1 });
  });
  it("apagar una sección entera y volver a encenderla", () => {
    const refs = estructura.secciones[1].preguntas.map((q) => q.ref);
    const fuera = conExclusion({ coverage_exclusions: ["otra"] }, refs, true);
    expect(exclusionesDe(fuera)).toEqual(new Set(["otra", "motivo", "S1$sexo"]));
    const dentro = conExclusion(fuera, refs, false);
    expect(exclusionesDe(dentro)).toEqual(new Set(["otra"]));
  });
  it("una sección con parte de sus preguntas fuera queda en estado mixto", () => {
    const secciones = conSeleccion(estructura, new Set(["motivo"]), {});
    expect(estadoSeccion(secciones[1])).toBe("algunas");
  });
  it("torta y columnas se guardan; una clave desconocida se descarta al leer", () => {
    expect(graficosDe({ grafico_por_pregunta: { a: "torta", b: "barras_verticales", c: "dona" } })).toEqual({ a: "torta", b: "barras_verticales" });
  });
  it("el gráfico por defecto no se guarda; uno distinto sí", () => {
    let r = conGrafico({}, "motivo", "barras", "barras_ordenadas");
    expect(graficosDe(r)).toEqual({ motivo: "barras" });
    r = conGrafico(r, "motivo", "barras_ordenadas", "barras_ordenadas");
    expect(graficosDe(r)).toEqual({});
  });
  it("busca sin tildes ni mayúsculas y filtra por dentro o fuera", () => {
    const secciones = conSeleccion(estructura, new Set(["S1$sexo"]), {});
    expect(preguntasVisibles(secciones[1], "todas", "ATENCION").map((q) => q.ref)).toEqual(["motivo"]);
    expect(preguntasVisibles(secciones[1], "fuera", "").map((q) => q.ref)).toEqual(["S1$sexo"]);
    expect(preguntasVisibles(secciones[1], "dentro", "").map((q) => q.ref)).toEqual(["motivo"]);
  });
});

describe("plantillas guardadas", () => {
  it("guardar conserva exclusiones y gráficos; reusar los restituye; el mismo nombre reemplaza", () => {
    let r = conGrafico(conExclusion({}, ["consent"], true), "motivo", "barras", "barras_ordenadas");
    r = conPlantillaGuardada(r, "RMS cliente", "acnur", "p1");
    r = conPlantillaGuardada(r, "rms cliente", "acnur", "p2");
    const guardadas = plantillasGuardadasDe(r);
    expect(guardadas).toHaveLength(1);
    expect(guardadas[0]).toMatchObject({ id: "p2", base: "acnur", exclusiones: ["consent"], graficos: { motivo: "barras" } });
    const limpia = conPlantillaReusada({ coverage_exclusions: [], plantillas_guardadas: r.plantillas_guardadas }, guardadas[0]);
    expect(exclusionesDe(limpia)).toEqual(new Set(["consent"]));
    expect(limpia.plantilla_elegida).toBe("acnur");
    expect(plantillasGuardadasDe(sinPlantillaGuardada(r, "p2"))).toEqual([]);
  });
});

describe("catálogo de plantillas", () => {
  it("parte de la plantilla elegida; sin elección, ACNUR en un proyecto ACNUR y Pulso en otro", () => {
    expect(plantillaInicial("blanco", "").id).toBe("blanco");
    expect(plantillaInicial(undefined, "RMS ACNUR 2026").id).toBe("acnur");
    expect(plantillaInicial("no-existe", "Acreditación").id).toBe("pulso");
  });
  it("las de ACNUR piden el perfil ACNUR y la territorial pide territorio", () => {
    const acnur = PLANTILLAS_INFORME.filter((p) => p.id.startsWith("acnur"));
    expect(acnur.every((p) => p.config.profile_id === "acnur_kobo_cruncher_plus")).toBe(true);
    expect(acnur.find((p) => p.id === "acnur-territorial")?.requiereTerritorio).toBe(true);
  });
});
