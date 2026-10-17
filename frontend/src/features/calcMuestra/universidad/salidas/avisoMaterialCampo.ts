// Entrega › Pase a Monitoreo: qué tiene Material de campo de esta selección.
//
// Cálculo de muestra no leía nada de Material de campo: enlazaba «Preparar
// fichas QR» y ahí acababa. Si el plan de Material de campo venía de otro
// sorteo, nadie lo veía desde aquí. Este aviso lee SÓLO
// `GET /api/recopiladores/origen?nivel=resumen` —barato, no arma unidades— y
// nunca `/state`, que es el contrato interno del otro módulo.
//
// El resumen decide por CORRIDA, no por datos: detecta que el plan es de otro
// sorteo, no que un aula cambió dentro del mismo. El texto no promete más.

import { useEffect, useState } from "react";

import { apiRecopiladoresOrigen, type CollectionOrigen } from "../../../../api/recopiladores";
import { DIRECCION_ORIGEN, fechaDelSorteo } from "../../../recopiladores/origen";

export type AvisoMaterialCampo = {
  tono: "warn" | "info";
  texto: string;
  enlace: { label: string; to: string };
};

function n(valor: number): string {
  return valor.toLocaleString("es-PE");
}

/** `null` = no hay nada que decir (sin plan en Material de campo). */
export function avisoMaterialCampo(origen: CollectionOrigen | null): AvisoMaterialCampo | null {
  if (!origen || !origen.plan.existe) return null;
  const desfasado = origen.stale || origen.sorteo_vigente?.desfasado === true;

  if (desfasado) {
    const delPlan = fechaDelSorteo(origen.plan.fecha || origen.plan.run_id, false);
    const vigente = fechaDelSorteo(
      origen.sorteo_vigente?.fecha || origen.sorteo_vigente?.run_id || origen.fuente.fecha || origen.fuente.run_id,
      false,
    );
    const unidades = `${n(origen.plan.unidades)} ${origen.plan.unidades === 1 ? "unidad" : "unidades"}`;
    const texto = delPlan && vigente
      ? `Material de campo tiene un plan del sorteo del ${delPlan} (${unidades}); esta selección es del ${vigente}.`
      : `Material de campo tiene un plan de otro sorteo (${unidades}).`;
    return { tono: "warn", texto, enlace: { label: "Revisar diferencias", to: DIRECCION_ORIGEN } };
  }

  // Una ficha por unidad: en `nivel=resumen` el backend cuenta en
  // `unidades_con_ficha` las unidades cubiertas; `fichas` son juegos generados.
  const fichas = origen.resumen.afectadas.unidades_con_ficha;
  const texto = fichas > 0
    ? `Material de campo: ${n(fichas)} ${fichas === 1 ? "ficha lista" : "fichas listas"} de este sorteo${origen.resumen.entregado ? ", entregadas a Monitoreo" : ""}.`
    : "Material de campo tiene un plan de este mismo sorteo; aún sin fichas.";
  return { tono: "info", texto, enlace: { label: "Abrir Material de campo", to: DIRECCION_ORIGEN } };
}

/**
 * Lee el resumen una vez por montaje. Un error no se pinta aquí: el aviso es
 * de otro módulo y su ausencia no bloquea nada de Cálculo de muestra.
 */
export function useAvisoMaterialCampo(activo: boolean): AvisoMaterialCampo | null {
  const [origen, setOrigen] = useState<CollectionOrigen | null>(null);
  useEffect(() => {
    if (!activo) return undefined;
    let vigente = true;
    apiRecopiladoresOrigen("resumen")
      .then((respuesta) => { if (vigente) setOrigen(respuesta); })
      .catch(() => { if (vigente) setOrigen(null); });
    return () => { vigente = false; };
  }, [activo]);
  return activo ? avisoMaterialCampo(origen) : null;
}
