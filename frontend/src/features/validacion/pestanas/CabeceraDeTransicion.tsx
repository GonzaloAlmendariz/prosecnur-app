/**
 * La cabecera de una pestaña de Validación mientras las pestañas se rehacen
 * (plan de fidelidad, rebanada V0). Antes la pintaba la página para las
 * cuatro; ahora cada pestaña monta la suya, con la forma común del kit
 * (`CabeceraDePestana`), para que cada rebanada posterior (V1 Reglas, V3
 * Hallazgos, V4 Cierre, V5 Explorar) cambie solo la de su pestaña.
 *
 * El nombre y el ícono salen del catálogo de pestañas, como el riel. El
 * estado, las cifras y las acciones los pone la pestaña con lo que ya sabe;
 * lo que todavía no puede decir va en `pendientes`, con su causa.
 */
import type { ReactNode } from "react";

import { CabeceraDePestana, type EstadoDePestana } from "../../../components/procesamiento/CabeceraDePestana";
import type { CifraDePestana } from "../../../components/procesamiento/CifrasDePestana";
import { PROCESAMIENTO_PESTANAS } from "../../../lib/navegacion/catalogos/procesamiento";
import type { ValidacionTabId } from "../types";

export default function CabeceraDeTransicion({ pestana, estado = null, cifras = [], pendientes, acciones }: {
  pestana: ValidacionTabId;
  estado?: EstadoDePestana | null;
  cifras?: readonly CifraDePestana[];
  pendientes?: string;
  acciones?: ReactNode;
}) {
  const meta = PROCESAMIENTO_PESTANAS.validacion.find((tab) => tab.key === pestana) ?? PROCESAMIENTO_PESTANAS.validacion[0];
  return (
    <CabeceraDePestana
      seccion="Validación"
      titulo={meta.label}
      icono={meta.icon}
      estado={estado}
      cifras={cifras}
      ariaCifras={`Cifras de ${meta.label}`}
      cifrasPendientes={pendientes}
      acciones={acciones}
      className="pulso-validacion-cabecera"
    />
  );
}
