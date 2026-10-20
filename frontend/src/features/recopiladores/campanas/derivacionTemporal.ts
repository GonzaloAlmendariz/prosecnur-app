// derivacionTemporal.ts — **RESPALDO TEMPORAL**: la lista de campañas cuando el
// backend responde 404 de RUTA a `GET /api/recopiladores/campaigns` (ADR 0111 §5).
// La fuente es el registro del backend (ff91e3baf); esto sólo cubre un backend
// anterior —un `.pulso` abierto con una app vieja embebida— y se borra cuando
// ninguna versión soportada lo necesite.
//
// Es el ÚNICO sitio que sabe derivar el registro en el cliente:
// `useRegistroDeCampanas` lo llama sólo cuando `apiMaterialCampanas()` devuelve
// `null`. Reproduce la misma proyección que hace el backend, sin escribir nada:
//
// - `aulas.principal` si el `/state` trae plan;
// - `correo.<campaign_id>` por cada campaña de `GET mail-campaigns`;
// - `tipos`: aulas mientras no haya otra, territorial deshabilitada con su
//   motivo, correo hasta el límite de campañas.
//
// Lo que no se puede derivar no se inventa: `created_at` de las campañas de
// correo y `last_export_at` de sus envíos quedan en `null`, y nada se archiva
// (archivar exige el registro del backend).

import type { MailCampaignSummary } from "../../../api/materialMail";
import type { CampanaMaterial, RegistroDeCampanas } from "../../../api/materialCampanas";
import { MATERIAL_CAMPANAS_SCHEMA } from "../../../api/materialCampanas";
import type { CollectionStatePayload } from "../../../api/recopiladores";
import { LIMITE_CAMPANAS } from "../correos/modeloCampanas";
import { ID_CAMPANA_AULAS, MOTIVO_TERRITORIAL, NOMBRE_CAMPANA_AULAS, campanaDeCorreo } from "./modeloRegistro";

/** Marca que la UI muestra mientras la lista sale de esta derivación. */
export const REGISTRO_DERIVADO_EN_EL_CLIENTE = true;

export const MOTIVO_AULAS_UNICA = "El proyecto ya tiene su campaña de aulas.";

function campanaDeAulas(payload: CollectionStatePayload): CampanaMaterial | null {
  const plan = payload.state?.plan;
  if (!plan) return null;
  const units = plan.units ?? [];
  const titulares = units.filter((u) => (u.role ?? "") === "titular");
  const base = titulares.length ? titulares : units;
  const conAcceso = new Set((payload.state.deployment?.bindings ?? []).map((b) => b.unit_id));
  return {
    id: ID_CAMPANA_AULAS,
    tipo: "aulas",
    name: NOMBRE_CAMPANA_AULAS,
    actor: "",
    created_at: null,
    archived: false,
    persisted: false,
    ref: "principal",
    estado: {
      tipo: "aulas",
      unidades: units.length,
      titulares: titulares.length,
      con_enlace: base.filter((u) => conAcceso.has(u.unit_id)).length,
      deployment_status: payload.state.deployment?.status ?? "",
      plan_desfasado: payload.source_vigente?.desfasado === true,
    },
  };
}

export function registroDerivado(entrada: {
  estado: CollectionStatePayload | null;
  correos: readonly MailCampaignSummary[];
  revisionDeCorreos: number | null;
}): RegistroDeCampanas {
  const aulas = entrada.estado ? campanaDeAulas(entrada.estado) : null;
  const correos = entrada.correos.map(campanaDeCorreo);
  const lleno = entrada.correos.length >= LIMITE_CAMPANAS;
  return {
    schema: MATERIAL_CAMPANAS_SCHEMA,
    registry_revision: null,
    state_revision: entrada.estado?.state?.state_revision ?? entrada.revisionDeCorreos,
    campaigns: [...(aulas ? [aulas] : []), ...correos],
    tipos: [
      { tipo: "aulas", disponible: !aulas, motivo: aulas ? MOTIVO_AULAS_UNICA : null },
      { tipo: "territorial", disponible: false, motivo: MOTIVO_TERRITORIAL },
      {
        tipo: "correo",
        disponible: !lleno,
        motivo: lleno ? `Un proyecto admite hasta ${LIMITE_CAMPANAS} campañas de correo.` : null,
      },
    ],
  };
}
