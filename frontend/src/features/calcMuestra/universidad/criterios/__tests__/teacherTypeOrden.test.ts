import { describe, expect, it } from "vitest";
import type { CriterioVariable } from "../../../../../api/client";
import {
  moverTeacherTypeOrden,
  teacherTypeCategoriasCatalogo,
  teacherTypeOrdenDisplay,
} from "../teacherTypeOrdenModel";

const jerarquico: CriterioVariable = {
  id: "teacher_type",
  scope: "aula",
  label: "Tipo de docente",
  kind: "hierarchical",
  mappedColumn: "condicion_docente",
  groups: [
    {
      key: "ordinario",
      label: "DOCENTE ORDINARIO",
      aulas: 40,
      children: [
        { key: "ordinario_principal", label: "ORDINARIO PRINCIPAL", aulas: 20 },
        { key: "ordinario_asociado", label: "ORDINARIO ASOCIADO", aulas: 20 },
      ],
    },
    {
      key: "contratado",
      label: "DOCENTE CONTRATADO",
      aulas: 15,
      children: [{ key: "contratado", label: "CONTRATADO", aulas: 15 }],
    },
    {
      key: "jefe_practica",
      label: "JEFE DE PRACTICA",
      aulas: 5,
      children: [{ key: "jefe_practica", label: "JEFE DE PRACTICA", aulas: 5 }],
    },
  ],
};

const plano: CriterioVariable = {
  id: "teacher_type",
  scope: "aula",
  label: "Tipo de docente",
  kind: "flat",
  categories: [
    { key: "contratado", label: "CONTRATADO", aulas: 30 },
    { key: "ordinario", label: "ORDINARIO", aulas: 20 },
  ],
};

describe("teacherTypeCategoriasCatalogo", () => {
  it("aplana grupos jerárquicos a sus hojas preservando el orden del catálogo", () => {
    const cats = teacherTypeCategoriasCatalogo(jerarquico);
    expect(cats.map((c) => c.key)).toEqual([
      "ordinario_principal",
      "ordinario_asociado",
      "contratado",
      "jefe_practica",
    ]);
    expect(cats[0]).toMatchObject({ label: "ORDINARIO PRINCIPAL", group: "DOCENTE ORDINARIO" });
  });

  it("usa las categorías planas cuando no hay jerarquía", () => {
    expect(teacherTypeCategoriasCatalogo(plano).map((c) => c.key)).toEqual(["contratado", "ordinario"]);
  });

  it("dedup por clave y descarta claves vacías", () => {
    const conDuplicado: CriterioVariable = {
      ...plano,
      categories: [
        { key: "contratado", label: "CONTRATADO", aulas: 30 },
        { key: "", label: "vacio", aulas: 1 },
        { key: "contratado", label: "CONTRATADO (dup)", aulas: 5 },
      ],
    };
    expect(teacherTypeCategoriasCatalogo(conDuplicado).map((c) => c.key)).toEqual(["contratado"]);
  });

  it("devuelve [] sin variable", () => {
    expect(teacherTypeCategoriasCatalogo(null)).toEqual([]);
    expect(teacherTypeCategoriasCatalogo(undefined)).toEqual([]);
  });
});

describe("teacherTypeOrdenDisplay", () => {
  const cats = teacherTypeCategoriasCatalogo(jerarquico);

  it("sin orden guardado respeta el orden del catálogo", () => {
    expect(teacherTypeOrdenDisplay(cats, undefined).map((c) => c.key)).toEqual([
      "ordinario_principal",
      "ordinario_asociado",
      "contratado",
      "jefe_practica",
    ]);
  });

  it("aplica el orden guardado y anexa las categorías nuevas del catálogo al final", () => {
    const orden = teacherTypeOrdenDisplay(cats, ["contratado", "ordinario_asociado"]).map((c) => c.key);
    expect(orden).toEqual(["contratado", "ordinario_asociado", "ordinario_principal", "jefe_practica"]);
  });

  it("descarta claves guardadas que ya no existen en el catálogo", () => {
    const orden = teacherTypeOrdenDisplay(cats, ["fantasma", "contratado"]).map((c) => c.key);
    expect(orden).toEqual([
      "contratado",
      "ordinario_principal",
      "ordinario_asociado",
      "jefe_practica",
    ]);
  });
});

describe("moverTeacherTypeOrden", () => {
  const keys = ["a", "b", "c"];

  it("sube un elemento", () => {
    expect(moverTeacherTypeOrden(keys, 1, -1)).toEqual(["b", "a", "c"]);
  });

  it("baja un elemento", () => {
    expect(moverTeacherTypeOrden(keys, 1, 1)).toEqual(["a", "c", "b"]);
  });

  it("no cambia nada fuera de rango y conserva la identidad referencial", () => {
    expect(moverTeacherTypeOrden(keys, 0, -1)).toBe(keys);
    expect(moverTeacherTypeOrden(keys, 2, 1)).toBe(keys);
  });
});
