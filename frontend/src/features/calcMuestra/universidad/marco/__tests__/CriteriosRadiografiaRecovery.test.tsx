import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type {
  CalcMuestraAulasFrame,
  CalcMuestraAulasCriteriosRadiografia,
  CalcMuestraWorkspaceAulasConfig,
  CriteriosCatalogo,
  CriteriosSeleccionMarco,
} from "../../../../../api/client";
import { CriteriosRadiografiaConsola } from "../CriteriosRadiografiaConsola";
import { CriteriosRadiografiaRecovery } from "../CriteriosRadiografiaRecovery";

const catalogo: CriteriosCatalogo = {
  schema: "calc_muestra_criterios_catalogo_v1",
  variables: [{
    id: "faculty",
    scope: "alumno",
    kind: "flat",
    label: "Facultad",
    mappedColumn: "FACULTAD",
  }],
};

const config = {} as CalcMuestraWorkspaceAulasConfig;
const borrador = { byVariable: {} } as CriteriosSeleccionMarco;

function frame(overrides: Partial<CalcMuestraAulasFrame> = {}): CalcMuestraAulasFrame {
  return {
    schema: "calc_muestra_aulas_frame_v1",
    generated_at: "2026-08-02T00:00:00Z",
    input_mode: "base_madre",
    config: {},
    frame_hash: "legacy-frame",
    aula_frame: [{ classroom_id: "CH-1", included: true }],
    audit: [],
    warnings: [],
    ...overrides,
  } as CalcMuestraAulasFrame;
}

describe("CriteriosRadiografiaRecovery", () => {
  it("reemplaza los seis pasos vacíos de un frame legacy por una recuperación accionable", () => {
    const html = renderToStaticMarkup(
      <CriteriosRadiografiaConsola
        catalogo={catalogo}
        radiografia={null}
        scope="alumno"
        i18bSource={{ frame: frame(), config, borrador, previewEnabled: false }}
        onReconstruir={() => {}}
        puedeReconstruir
      />,
    );

    expect(html).toContain("Radiografía por facultad pendiente");
    expect(html).toContain("Actualizar radiografía por facultad");
    expect(html.match(/Actualizar radiografía por facultad/g)).toHaveLength(1);
    expect(html).toContain('data-recovery="criterios-radiografia"');
    expect(html).not.toContain(">Dato<");
    expect(html).not.toContain("Sin dato");
    expect(html).not.toContain("cmv2-crc-card-strip");
  });

  it("conserva el fail-closed cuando el sibling existe pero es inválido", () => {
    const html = renderToStaticMarkup(
      <CriteriosRadiografiaConsola
        catalogo={catalogo}
        radiografia={null}
        scope="alumno"
        i18bSource={{
          frame: frame({ criterios_radiografia: { schema: "contrato_desconocido" } as never }),
          config,
          borrador,
          previewEnabled: false,
        }}
        onReconstruir={() => {}}
        puedeReconstruir
      />,
    );

    // ADR 0057 · Los estados de error se explican en palabras del estudio: son
    // los que aparecen cuando algo falta, y ahí el usuario menos puede
    // permitirse descifrar «contrato», «gate» o «contrafactual». La garantía de
    // que no se rellenan ceros se conserva íntegra.
    expect(html).toContain("No verificable");
    // El detalle completo vive en el descriptor del estado; aquí basta la etiqueta.
    expect(html).toContain("El sibling de radiografía está presente");
    expect(html).not.toContain("Radiografía por facultad pendiente");
  });

  it("recupera un contrato v1 válido en vez de publicarlo como radiografía vigente", () => {
    const v1 = {
      schema: "calc_muestra_aulas_criterios_radiografia_v1",
      owner: "calc_muestra_aulas_frame_v1.aula_frame",
      frame_hash: "legacy-frame",
      momento: "marco_ejecutado",
      grano: "session_type_x_facultad_efectiva",
      unidad: "curso_horario_unico",
      filas: [],
    } satisfies CalcMuestraAulasCriteriosRadiografia;
    const html = renderToStaticMarkup(
      <CriteriosRadiografiaConsola
        catalogo={catalogo}
        radiografia={v1}
        rawPresent
        scope="alumno"
        i18bSource={{ frame: frame({ criterios_radiografia: v1 }), config, borrador, previewEnabled: false }}
        onReconstruir={() => {}}
        puedeReconstruir
      />,
    );

    expect(html).toContain("Radiografía por facultad pendiente");
    expect(html).not.toContain("cmv2-crc-card-strip");
  });

  it("mantiene la recuperación bloqueada cuando el guard de confirmación no autoriza recalcular", () => {
    const html = renderToStaticMarkup(
      <CriteriosRadiografiaConsola
        catalogo={catalogo}
        radiografia={null}
        scope="alumno"
        i18bSource={{ frame: frame(), config, borrador, previewEnabled: true }}
        onReconstruir={() => {}}
        puedeReconstruir={false}
      />,
    );

    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>[^]*Actualizar radiografía por facultad/);
  });

  it("publica un v2 válido sin señal como estado analítico honesto, no como legacy", () => {
    const v2 = {
      schema: "calc_muestra_aulas_criterios_radiografia_v2",
      owner: "calc_muestra_aulas_frame_v1.criterios_radiografia",
      frame_hash: "frame-v2",
      momento: "marco_ejecutado",
      grano: "criterio_x_facultad_x_segmento",
      unidad: "curso_horario_unico",
      filas_owner: "calc_muestra_aulas_frame_v1.aula_frame",
      filas_grano: "session_type_x_facultad_efectiva",
      filas: [],
      criterios: [{
        id: "faculty",
        card_id: "faculty",
        label: "Facultad",
        scope: "alumno",
        family: "student_flat",
        owner: "calc_muestra_aulas_construir_v1.filas_alumno",
        kind: "flat",
        grain: "alumno_x_curso_horario_x_facultad",
        unit: "alumno_unico_por_curso_horario",
        gate: "poblacion",
        status: "sin_senal",
        effective_layer: "marco",
        overlap: false,
        faculty_dimension: "alumno",
        rows: [],
      }],
    } satisfies CalcMuestraAulasCriteriosRadiografia;
    const html = renderToStaticMarkup(
      <CriteriosRadiografiaConsola catalogo={catalogo} radiografia={v2} rawPresent scope="alumno" />,
    );

    expect(html).toContain("Sin dato");
    expect(html).toContain("cmv2-crc-card-strip");
    expect(html).not.toContain("Radiografía por facultad pendiente");
  });
});

describe("cuando todavía no hay criterios declarados", () => {
  /**
   * Medido en el recorrido de un usuario nuevo: con el marco recién construido
   * y sin criterios, la tarjeta decía «Actualízalo con el motor R» y su botón
   * reconstruía el marco entero (~40 s, dos veces) sin poder resolverlo nunca
   * — la radiografía solo se calcula con una suite de criterios ACTIVA
   * (calc_muestra_aulas_criterios.R: `if (n_aulas && suite_activa)`). Un botón
   * que promete lo que no puede cumplir es peor que no ofrecer ninguno.
   */
  it("dice que faltan criterios y no ofrece el botón de actualizar", () => {
    const html = renderToStaticMarkup(
      <CriteriosRadiografiaRecovery
        scope="alumno"
        sinCriteriosDeclarados
        onActualizar={() => {}}
        puedeActualizar
      />,
    );

    expect(html).toContain("declara");
    expect(html).not.toContain("Actualizar radiografía por facultad");
  });

  it("con criterios declarados mantiene la vía de actualizar", () => {
    const html = renderToStaticMarkup(
      <CriteriosRadiografiaRecovery scope="alumno" onActualizar={() => {}} puedeActualizar />,
    );

    expect(html).toContain("Actualizar radiografía por facultad");
  });
});
