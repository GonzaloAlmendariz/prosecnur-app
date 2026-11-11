import { describe, expect, it } from "vitest";

import type { EstudioBase, EstudioPayload } from "../../../api/estudio";
import { basesDelEstudio, fasesDeBase, origenDeBase } from "./basesDelEstudioModel";

function base(parcial: Partial<EstudioBase> & { nombre: string }): EstudioBase {
  return {
    xlsform_file_id: "x",
    data_file_id: "d",
    data_ext: "xlsx",
    n_filas: null,
    n_columnas: null,
    added_at: "2026-11-01",
    ...parcial,
  };
}

function estudio(bases: EstudioBase[], activa?: string): EstudioPayload {
  return {
    nombre: "Estudio",
    active_base: activa ?? null,
    n_bases: bases.length,
    bases: Object.fromEntries(bases.map((b) => [b.nombre, b])),
    max_bases: 16,
  };
}

describe("origenDeBase", () => {
  it.each<[EstudioBase["source_kind"], string]>([
    ["surveymonkey", "SurveyMonkey"],
    ["surveymonkey_workbook", "SurveyMonkey"],
    ["surveymonkey_sav_bundle", "SurveyMonkey"],
    ["kobo", "Kobo"],
    ["kobo_api", "Kobo"],
    ["kobo_repeat", "Grupo repetido"],
    ["xlsx_repeat", "Grupo repetido"],
    ["monitoreo_kobo", "Monitoreo"],
    ["manual", "Archivo"],
    ["existing_project", "Archivo"],
    ["", "Archivo"],
    [null, "Archivo"],
    ["NA", "Archivo"],
  ])("%s se muestra como %s", (tipo, esperado) => {
    expect(origenDeBase(base({ nombre: "b", source_kind: tipo }))).toBe(esperado);
  });

  it("nunca muestra el identificador interno", () => {
    expect(origenDeBase(base({ nombre: "b", source_kind: "kobo_repeat" }))).not.toMatch(/_/);
  });

  it("un tipo que no conoce lo dice, no lo pasa por archivo", () => {
    expect(origenDeBase(base({ nombre: "b", source_kind: "otra_plataforma" }))).toBe("Otro origen");
  });

  it("una base con madre es un grupo repetido aunque su tipo no lo diga", () => {
    expect(origenDeBase(base({ nombre: "h", source_kind: "kobo", parent_base: "m" }))).toBe("Grupo repetido");
  });
});

describe("fasesDeBase", () => {
  const estados = (status: EstudioBase["status"]) => fasesDeBase(status)?.map((f) => f.estado);

  it("sin estado del motor no inventa fases", () => {
    expect(fasesDeBase(null)).toBeNull();
    expect(fasesDeBase(undefined)).toBeNull();
  });

  it("una base recién cargada sólo tiene la carga", () => {
    expect(estados({ imported: true })).toEqual(["Cargada", "Por iniciar", "Por iniciar", "Por iniciar", "Sin informe"]);
  });

  it("sin formulario o sin respuestas la carga está incompleta", () => {
    expect(fasesDeBase({ imported: false })?.[0]).toMatchObject({ fase: "carga", estado: "Incompleta", tono: "warn" });
  });

  it("un booleano del motor dice que la fase tiene trabajo, no que terminó", () => {
    const fases = fasesDeBase({ imported: true, validacion: true, codificacion: true, analitica: true, graficos: true });
    expect(fases?.map((f) => f.estado)).toEqual(["Cargada", "Iniciada", "Iniciada", "Iniciada", "Con informe"]);
    // Ningún rótulo promete lo que el motor no sabe.
    expect(fases?.some((f) => /al día|lista|completa|cerrada/i.test(f.estado))).toBe(false);
  });

  it("la codificación adaptada se distingue de la iniciada", () => {
    expect(estados({ imported: true, codificacion: true, codificacion_adaptada: true })?.[2]).toBe("Aplicada");
    expect(estados({ imported: true, codificacion: true, codificacion_adaptada: false })?.[2]).toBe("Iniciada");
  });

  it("cada fase lleva su nombre y un detalle que explica el estado", () => {
    const fases = fasesDeBase({ imported: true }) ?? [];
    expect(fases.map((f) => f.nombre)).toEqual(["Carga", "Validación", "Codificación", "Analítica", "Gráficos"]);
    expect(fases.every((f) => f.detalle.length > 0)).toBe(true);
  });
});

describe("basesDelEstudio", () => {
  it("con una base la devuelve activa, con su tamaño y su origen", () => {
    const r = basesDelEstudio(
      estudio([base({ nombre: "default", n_filas: 293, n_columnas: 61, status: { imported: true } })]),
    );
    expect(r.nBases).toBe(1);
    expect(r.nGruposRepetidos).toBe(0);
    expect(r.filas).toHaveLength(1);
    expect(r.filas[0]).toMatchObject({
      nombre: "default",
      etiqueta: "Base única",
      activa: true,
      origen: "Archivo",
      filas: 293,
      columnas: 61,
      madre: null,
    });
  });

  it("marca activa sólo la base que el estudio declara", () => {
    const r = basesDelEstudio(
      estudio([base({ nombre: "docentes" }), base({ nombre: "egresados" }), base({ nombre: "estudiantes" })], "egresados"),
    );
    expect(r.filas.map((f) => [f.nombre, f.activa])).toEqual([
      ["docentes", false],
      ["egresados", true],
      ["estudiantes", false],
    ]);
  });

  it("usa el alias de la fuente antes que el nombre interno", () => {
    const r = basesDelEstudio(
      estudio([base({ nombre: "b1", source_alias: "Docentes", source_title: "Encuesta a docentes 2026" })]),
    );
    expect(r.filas[0].etiqueta).toBe("Docentes");
  });

  it("anida cada grupo repetido bajo su madre y no lo cuenta como base", () => {
    const r = basesDelEstudio(
      estudio(
        [
          base({ nombre: "hogares", source_kind: "kobo_api", source_alias: "Hogares" }),
          base({ nombre: "otra", source_kind: "manual" }),
          base({ nombre: "miembros", source_kind: "kobo_repeat", parent_base: "hogares" }),
        ],
        "hogares",
      ),
    );
    expect(r.filas.map((f) => f.nombre)).toEqual(["hogares", "miembros", "otra"]);
    expect(r.filas[1]).toMatchObject({ origen: "Grupo repetido", madre: "Hogares" });
    expect(r.nBases).toBe(2);
    expect(r.nGruposRepetidos).toBe(1);
  });

  it("un grupo repetido sin madre en el estudio no se pierde: queda al final", () => {
    const r = basesDelEstudio(
      estudio([
        base({ nombre: "suelta", source_kind: "kobo_repeat", parent_base: "no_existe" }),
        base({ nombre: "principal" }),
      ]),
    );
    expect(r.filas.map((f) => f.nombre)).toEqual(["principal", "suelta"]);
    expect(r.filas[1].madre).toBeNull();
  });

  it("no convierte en cero un tamaño que el motor no envió", () => {
    const r = basesDelEstudio(estudio([base({ nombre: "b" })]));
    expect(r.filas[0].filas).toBeNull();
    expect(r.filas[0].columnas).toBeNull();
  });

  it("sin bases devuelve una lista vacía", () => {
    expect(basesDelEstudio(estudio([]))).toEqual({ filas: [], nBases: 0, nGruposRepetidos: 0 });
  });
});
