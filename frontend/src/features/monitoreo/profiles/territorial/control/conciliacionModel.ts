import type {
  MonitoreoState,
  MonitoreoTerritorialDashboard,
  MonitoreoTerritorialPhase,
  MonitoreoTerritorialReconciliationBatchChange,
} from "../../../../../api/client";
import { nombreDeDistrito, numeroDeUmp } from "../rotulos";

/**
 * Control › Conciliación (territorial.md §3.13): dos paneles iguales.
 * Códigos: los que la base trae frente al padrón, los que no se reconocen y
 * las conciliaciones hechas («escrito → asignado»). UMP declarada: los valores
 * que cruzan con la ruta, los conciliados y los que no cruzan. Conciliar manda
 * un cambio por respuesta al lote del motor, que queda auditado.
 */

export type CodigoSinReconocer = { codigo: string; normalizado: string; casos: number; responseIds: Array<{ id: string; campo: string }> };
export type OpcionDelPadron = { codigo: string; nombre: string };
export type Conciliacion = { escrito: string; asignado: string };
export type UmpSinCruce = {
  valor: string;
  normalizado: string;
  casos: number;
  responseId: string;
  campo: string;
};
export type OpcionDeRuta = { idManzana: string; ump: string; distrito: string; ubigeo: string; rotulo: string };

export type ModeloConciliacion = {
  codigos: {
    disponible: boolean;
    enBase: number;
    reconocidos: number;
    conciliados: number;
    sinReconocer: CodigoSinReconocer[];
    conciliaciones: Conciliacion[];
  };
  padron: OpcionDelPadron[];
  umps: {
    disponible: boolean;
    valores: number;
    cruzan: number;
    conciliados: number;
    sinCruce: UmpSinCruce[];
    conciliaciones: Conciliacion[];
  };
  ruta: OpcionDeRuta[];
};

function n(valor: unknown): number {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : 0;
}

export function construirConciliacion(
  reports: MonitoreoTerritorialDashboard | null | undefined,
  state: MonitoreoState | null | undefined,
): ModeloConciliacion {
  const codigos = reports?.enumerator_code_summary;
  const respuestas = codigos?.unrecognized_responses ?? [];
  const sinReconocer: CodigoSinReconocer[] = (codigos?.unrecognized_codes ?? codigos?.top_unrecognized ?? []).map((item) => {
    const normalizado = String(item.normalized_code || item.code || "");
    return {
      codigo: String(item.raw_code || item.code || ""),
      normalizado,
      casos: Math.round(n(item.count)),
      responseIds: respuestas
        .filter((respuesta) => String(respuesta.normalized_code || respuesta.raw_code) === normalizado && respuesta.response_id)
        .map((respuesta) => ({ id: respuesta.response_id, campo: String(respuesta.response_id_field ?? "") })),
    };
  });
  const reconciliados = Math.round(n(codigos?.reconciled_code_count));

  const declaradas = reports?.ump_declared_summary;
  const filas = declaradas?.rows ?? [];
  const sinCruce: UmpSinCruce[] = filas
    .filter((fila) => fila.status === "review" || fila.status === "missing")
    .map((fila) => ({
      valor: String(fila.raw_ump ?? ""),
      normalizado: String(fila.normalized_ump ?? ""),
      casos: Math.round(n(fila.response_count)),
      responseId: String(fila.response_id ?? ""),
      campo: String(fila.response_id_field ?? ""),
    }));

  const padron = (state?.config?.territorial?.enumerator_roster?.assignments ?? [])
    .map((asignacion) => ({ codigo: String(asignacion.codigo_pulso ?? "").trim(), nombre: String(asignacion.nombre ?? "").trim() }))
    .filter((opcion) => opcion.codigo)
    .sort((a, b) => a.codigo.localeCompare(b.codigo, "es", { numeric: true }));

  return {
    codigos: {
      disponible: Boolean(codigos && Object.keys(codigos).length),
      enBase: Math.round(n(codigos?.response_code_count)),
      reconocidos: Math.max(0, Math.round(n(codigos?.recognized_code_count)) - reconciliados),
      conciliados: reconciliados,
      sinReconocer,
      conciliaciones: (codigos?.reconciliation_entries ?? []).map((entrada) => ({
        escrito: String(entrada.raw_code || entrada.normalized_code || ""),
        asignado: [entrada.assigned_code, entrada.assigned_name].filter(Boolean).join(" · "),
      })),
    },
    padron,
    umps: {
      disponible: filas.length > 0,
      valores: filas.length,
      cruzan: filas.filter((fila) => fila.status === "recognized" || fila.status === "reconciled").length,
      conciliados: filas.filter((fila) => fila.status === "reconciled").length,
      sinCruce,
      conciliaciones: filas
        .filter((fila) => fila.status === "reconciled")
        .map((fila) => ({ escrito: String(fila.raw_ump ?? ""), asignado: `UMP ${numeroDeUmp(fila.assigned_ump)}${fila.assigned_district ? `, ${nombreDeDistrito(fila.assigned_district)}` : ""}` })),
    },
    ruta: (declaradas?.route_options ?? []).map((opcion) => ({
      idManzana: String(opcion.id_manzana ?? ""),
      ump: numeroDeUmp(opcion.route_ump),
      distrito: nombreDeDistrito(opcion.distrito),
      ubigeo: String(opcion.ubigeo ?? ""),
      rotulo: `UMP ${numeroDeUmp(opcion.route_ump)} · ${nombreDeDistrito(opcion.distrito)}${opcion.manzana ? `, manzana ${opcion.manzana}` : ""}`,
    })).filter((opcion) => opcion.idManzana),
  };
}

/** Un cambio por respuesta: el código escrito pasa al del padrón. */
export function cambiosDeCodigo(
  codigo: CodigoSinReconocer,
  elegido: OpcionDelPadron,
  phase: MonitoreoTerritorialPhase,
): MonitoreoTerritorialReconciliationBatchChange[] {
  return codigo.responseIds.map((respuesta, indice) => ({
    client_id: `codigo-${codigo.normalizado}-${indice}`,
    kind: "code",
    reconciliation: {
      response_id: respuesta.id,
      response_id_field: respuesta.campo || undefined,
      raw_code: codigo.codigo,
      normalized_code: codigo.normalizado,
      assigned_code: elegido.codigo,
      assigned_name: elegido.nombre,
      phase,
      scope: "response",
      note: "Conciliado desde Control › Conciliación",
    },
  }));
}

/** El valor de UMP escrito pasa a una UMP de la ruta. */
export function cambioDeUmp(
  valor: UmpSinCruce,
  destino: OpcionDeRuta,
  phase: MonitoreoTerritorialPhase,
): MonitoreoTerritorialReconciliationBatchChange {
  return {
    client_id: `ump-${valor.normalizado || valor.valor}`,
    kind: "ump",
    reconciliation: {
      response_id: valor.responseId || undefined,
      response_id_field: valor.campo || undefined,
      raw_ump: valor.valor,
      assigned_block_id: destino.idManzana,
      assigned_ump: destino.ump,
      assigned_district: destino.distrito,
      assigned_ubigeo: destino.ubigeo,
      phase,
      scope: valor.responseId ? "response" : "ump_value",
      note: "Conciliado desde Control › Conciliación",
    },
  };
}
