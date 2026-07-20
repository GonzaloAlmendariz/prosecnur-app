import { describe, expect, test } from "vitest";
import type { PreguntaAbierta } from "../../api/client";
import { filterRelationTargets } from "./RelationTargetDialog";

function pregunta(parent: string, parentLabel: string, sectionLabel: string): PreguntaAbierta {
  return {
    parent,
    parent_label: parentLabel,
    tipo: "text",
    subtipo: "text",
    modo_so: "",
    text_col: parent,
    parent_col: parent,
    list_norm: "",
    col_efectiva: parent,
    n_respuestas: 0,
    n_unicas: 0,
    n_codificadas: 0,
    status: "no-iniciado",
    habilitada: true,
    preview: [],
    section: sectionLabel,
    section_label: sectionLabel,
    q_order: null,
    candidatos_texto: [],
    pareja: null,
    marcada: false,
    marcada_auto: false,
  };
}

describe("filterRelationTargets", () => {
  const candidates = [
    pregunta("p_edad", "¿Cuál es tu edad?", "Datos personales"),
    pregunta("p_ocupacion", "Actividad principal", "Perfil laboral"),
    pregunta("p_comentario", "Comentario libre", "Cierre"),
  ];

  test("busca sin distinguir mayúsculas por código, etiqueta o sección", () => {
    expect(filterRelationTargets(candidates, " P_EDAD ")).toEqual([candidates[0]]);
    expect(filterRelationTargets(candidates, "actividad")).toEqual([candidates[1]]);
    expect(filterRelationTargets(candidates, "CIERRE")).toEqual([candidates[2]]);
  });

  test("conserva todos los candidatos sin consulta y devuelve vacío sin coincidencias", () => {
    expect(filterRelationTargets(candidates, "   ")).toBe(candidates);
    expect(filterRelationTargets(candidates, "sin coincidencia")).toEqual([]);
  });
});
