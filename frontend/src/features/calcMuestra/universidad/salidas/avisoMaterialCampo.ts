// Entrega › Pase a Monitoreo: qué tiene Material de campo de esta selección.
//
// Cálculo de muestra no leía nada de Material de campo: enlazaba «Preparar
// fichas QR» y ahí acababa. Si el plan de Material de campo venía de otro
// sorteo, nadie lo veía desde aquí. Este aviso lee SÓLO
// `GET /api/recopiladores/origen?nivel=resumen` —sin listas— y nunca `/state`,
// que es el contrato interno del otro módulo.
//
// La vigencia es UNA, por huella de datos, en los dos niveles: `estado`/`stale`
// dicen si Material de campo coincide con lo que la selección daría hoy. El
// sorteo (`sorteo_vigente.desfasado`) sólo elige cómo se dice: otro sorteo, o
// el mismo con datos distintos. Antes se decidía por sorteo y un aula cambiada
// en la misma corrida salía como «fichas listas» mientras Origen decía «la
// fuente cambió».

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

function unidadesDelPlan(origen: CollectionOrigen): string {
  return `${n(origen.plan.unidades)} ${origen.plan.unidades === 1 ? "unidad" : "unidades"}`;
}

const REVISAR = { label: "Revisar diferencias", to: DIRECCION_ORIGEN };
const ABRIR = { label: "Abrir Material de campo", to: DIRECCION_ORIGEN };

/** «… plan del sorteo del 1/8 (2.468 unidades); esta selección es del 21/8.» */
function deOtroSorteo(origen: CollectionOrigen): string {
  const delPlan = fechaDelSorteo(origen.plan.fecha || origen.plan.run_id, false);
  const vigente = fechaDelSorteo(
    origen.sorteo_vigente?.fecha || origen.sorteo_vigente?.run_id || origen.fuente.fecha || origen.fuente.run_id,
    false,
  );
  return delPlan && vigente
    ? `Material de campo tiene un plan del sorteo del ${delPlan} (${unidadesDelPlan(origen)}); esta selección es del ${vigente}.`
    : `Material de campo tiene un plan de otro sorteo (${unidadesDelPlan(origen)}).`;
}

/**
 * `null` = no hay nada que decir (sin plan en Material de campo).
 *
 * @param seleccionLista si la selección de esta pestaña está completa. Sin
 *   ella sólo se avisa lo que está mal —un plan desfasado sigue siendo un
 *   plan desfasado—; «N fichas listas» no se afirma de una selección a medias.
 */
export function avisoMaterialCampo(
  origen: CollectionOrigen | null,
  seleccionLista = true,
): AvisoMaterialCampo | null {
  if (!origen || !origen.plan.existe) return null;
  const otroSorteo = origen.sorteo_vigente?.desfasado === true;

  if (origen.estado === "cambio" || origen.stale) {
    return {
      tono: "warn",
      texto: otroSorteo
        ? deOtroSorteo(origen)
        : "Material de campo tiene datos distintos de esta selección.",
      enlace: REVISAR,
    };
  }

  if (origen.estado === "sin_fuente") {
    // No hubo comparación. Si el plan es de otro sorteo, eso sí se sabe.
    if (otroSorteo) return { tono: "warn", texto: deOtroSorteo(origen), enlace: REVISAR };
    if (origen.fuente.error_id) {
      return {
        tono: "warn",
        texto: `No se pudo comparar el plan de Material de campo (${unidadesDelPlan(origen)}) con esta selección.`,
        enlace: ABRIR,
      };
    }
    return null;
  }

  // Al día por huella. Sin selección lista no se celebra nada.
  if (!seleccionLista) return null;
  // Una ficha por unidad: «fichas listas» son las unidades del plan que tienen
  // ficha (`fichas_cobertura`), no los juegos generados ni las afectadas.
  const fichas = origen.resumen.fichas_cobertura.unidades_cubiertas;
  const entregadas = origen.resumen.entregado ? ", entregadas a Monitoreo" : "";
  if (otroSorteo) {
    // Mismas unidades y datos, otra corrida: está al día, y se dice por qué.
    return {
      tono: "info",
      texto: fichas > 0
        ? `Material de campo: ${n(fichas)} ${fichas === 1 ? "ficha lista" : "fichas listas"}${entregadas}; su plan es de otro sorteo con las mismas unidades.`
        : "Material de campo tiene un plan de otro sorteo con las mismas unidades; aún sin fichas.",
      enlace: ABRIR,
    };
  }
  return {
    tono: "info",
    texto: fichas > 0
      ? `Material de campo: ${n(fichas)} ${fichas === 1 ? "ficha lista" : "fichas listas"} de este sorteo${entregadas}.`
      : "Material de campo tiene un plan de este mismo sorteo; aún sin fichas.",
    enlace: ABRIR,
  };
}

/**
 * Lee el resumen una vez por montaje, esté o no lista la selección: un plan
 * de otro sorteo se avisa igual. Un error no se pinta aquí: el aviso es de
 * otro módulo y su ausencia no bloquea nada de Cálculo de muestra.
 */
export function useAvisoMaterialCampo(seleccionLista: boolean): AvisoMaterialCampo | null {
  const [origen, setOrigen] = useState<CollectionOrigen | null>(null);
  useEffect(() => {
    let vigente = true;
    apiRecopiladoresOrigen("resumen")
      .then((respuesta) => { if (vigente) setOrigen(respuesta); })
      .catch(() => { if (vigente) setOrigen(null); });
    return () => { vigente = false; };
  }, [seleccionLista]);
  return avisoMaterialCampo(origen, seleccionLista);
}
