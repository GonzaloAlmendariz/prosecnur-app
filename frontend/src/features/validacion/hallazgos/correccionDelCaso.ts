/**
 * Corrección de un caso de "Combinación fuera de catálogo": del candidato del
 * motor o del lugar elegido en el selector a una decisión `set_value` de un
 * solo caso por columna de papel. Solo arma; guardar lo decide la persona.
 */
import type { CandidatoDeCatalogo } from "../../../api/validacionAuditoria";
import type { LugarDelCatalogo, PapelDeCatalogo } from "../../../api/catalogoUbigeo";
import { correccionDeLugar, type ColumnasPorPapel, type LugarACorregir } from "../catalogo/correccionDeCatalogo";
import { emptyEditorForm, type EditorForm } from "../limpieza/modeloLimpieza";
import type { LimpiezaDecision } from "../types";

const ROTULO_DEL_PAPEL: Readonly<Record<string, string>> = {
  departamento: "Departamento",
  provincia: "Provincia",
  distrito: "Distrito",
  ubigeo: "Ubigeo",
};

export function propuestaEnPalabras(c: CandidatoDeCatalogo): string {
  const rotulo = ROTULO_DEL_PAPEL[c.rol ?? ""] ?? "Lugar";
  const causa = c.causa ? ` (${c.causa})` : "";
  return `Propuesta: ${rotulo} ${c.valor ?? ""}${causa}`;
}

export function columnasDeRoles(roles: Partial<Record<PapelDeCatalogo, string>> | undefined): ColumnasPorPapel {
  return {
    departamento: roles?.departamento ?? null,
    provincia: roles?.provincia ?? null,
    distrito: roles?.distrito ?? null,
    ubigeo: roles?.ubigeo ?? null,
  };
}

export function lugarDeCandidato(c: CandidatoDeCatalogo): LugarACorregir {
  return { ...c.entidad };
}

export function lugarDelSelector(l: LugarDelCatalogo): LugarACorregir {
  return { departamento: l.departamento, provincia: l.provincia, distrito: l.distrito, ubigeo: l.ubigeo };
}

export function decisionesDeCorreccion({
  lugar,
  roles,
  idCaso,
  origen,
}: {
  lugar: LugarACorregir;
  roles: Partial<Record<PapelDeCatalogo, string>> | undefined;
  idCaso: string;
  origen: "candidato" | "selector";
}): EditorForm[] {
  const rationale = origen === "candidato"
    ? "Corregido con la propuesta del catálogo de ubigeos."
    : "Corregido con un lugar elegido del catálogo de ubigeos.";
  return correccionDeLugar(lugar, columnasDeRoles(roles)).map(({ columna, valor }) => ({
    ...emptyEditorForm(),
    action_type: "set_value" as const,
    target_variable: columna,
    set_value: valor,
    scope_mode: "single" as const,
    use_all_cases: false,
    target_case_ids: [idCaso],
    rationale,
  }));
}

export type CorreccionGuardada = { columna: string; valor: string };

/**
 * Lo que el caso ya tiene corregido para esta regla: una decisión lista
 * `set_value` por columna. La base no cambia hasta cerrar, así que la ficha lo
 * dice desde las decisiones y no desde el valor de la base.
 */
export function correccionesGuardadas(decisiones: readonly LimpiezaDecision[], idRegla: string, idCaso: string): CorreccionGuardada[] {
  return decisiones
    .filter((d) => d.status === "ready" && d.action_type === "set_value" && d.source_id === idRegla && d.target_case_ids.includes(idCaso) && !!d.target_variable)
    .map((d) => ({ columna: d.target_variable as string, valor: String(d.action_params?.value ?? "") }));
}

/** "Distrito" de la columna que ocupa ese papel en la regla; la columna misma si no es de ninguno. */
export function rotuloDeColumna(columna: string, roles: Partial<Record<PapelDeCatalogo, string>> | undefined): string {
  const papel = (Object.keys(ROTULO_DEL_PAPEL) as PapelDeCatalogo[]).find((p) => roles?.[p] === columna);
  return papel ? ROTULO_DEL_PAPEL[papel] : columna;
}
