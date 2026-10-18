// Contrato entre la página y la ficha del Constructor: lo que la ficha lee y lo que puede pedir.

import type { LogicScope } from "../../logic";
import type { EditorFormulariosPestanaId } from "../../shell/pestanaEditor";
import type { BuilderDiagnostic, BuilderNode, BuilderStructure, CatalogSummary, ChoiceItem, XlsformEditorSheet, XlsformEditorWorkbook } from "../../types";

export type AccionesFicha = {
  campo: (field: string, value: string) => void;
  tipo: (base: string) => void;
  obligatoria: (si: boolean) => void;
  asignarLista: (lista: string) => void;
  crearLista: () => void;
  duplicar: () => void;
  moverASeccion: (seccionFila: number | null) => void;
  mover: (dir: "up" | "down") => void;
  eliminar: () => void;
  alternarRepeticion: () => void;
  seleccionarFila: (rowIndex: number) => void;
  irPestana: (pestana: EditorFormulariosPestanaId, foco: string | null) => void;
  ajuste: (field: string, value: string) => void;
  editarFormulario: (mutar: (draft: XlsformEditorWorkbook) => void) => void;
  puedeSubir: boolean;
  puedeBajar: boolean;
};

export type DatosFicha = {
  node: BuilderNode;
  structure: BuilderStructure | null;
  survey: XlsformEditorSheet | null;
  scope: LogicScope;
  requiredRaw?: string;
  choices: ChoiceItem[];
  catalogs: CatalogSummary[];
  usosPorLista: ReadonlyMap<string, number>;
  avisos: readonly BuilderDiagnostic[];
  acciones: AccionesFicha;
};
