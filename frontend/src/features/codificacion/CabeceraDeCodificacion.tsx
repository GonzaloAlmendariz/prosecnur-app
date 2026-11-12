// La cabecera de una pestaña de Codificación: la del kit (`CabeceraDePestana`), con el antetítulo
// "Codificación", el nombre de la pestaña, su estado, sus cifras y su acción principal a la derecha.
// Reemplaza a la cabecera vieja con "pestaña n de m" (plan 4.7: "sin pestaña n de m").
//
// El nombre y el ícono salen del catálogo, como el riel, salvo Aplicar: el checklist del plan, fila 31,
// retira la varita y pide el ícono de base de datos en la cabecera y en el riel. El riel lo dibuja el
// catálogo de pestañas (`lib/navegacion/catalogos/procesamiento.ts`), que esta pestaña no edita.

import type { ReactNode } from "react";

import { CabeceraDePestana, type EstadoDePestana } from "../../components/procesamiento/CabeceraDePestana";
import type { CifraDePestana } from "../../components/procesamiento/CifrasDePestana";
import { PROCESAMIENTO_PESTANAS, type CodificacionTabId } from "../../lib/navegacion/catalogos/procesamiento";
import { Database } from "../../vendor/lucide-react";

export function CabeceraDeCodificacion({ pestana, estado = null, cifras = [], pendientes, acciones }: {
  pestana: CodificacionTabId;
  estado?: EstadoDePestana | null;
  cifras?: readonly CifraDePestana[];
  /** Las cifras del prototipo que el motor todavía no da, con su causa (queda en el marcado). */
  pendientes?: string;
  acciones?: ReactNode;
}) {
  const meta = PROCESAMIENTO_PESTANAS.codificacion.find((tab) => tab.key === pestana) ?? PROCESAMIENTO_PESTANAS.codificacion[0];
  return (
    <CabeceraDePestana
      seccion="Codificación"
      titulo={meta.label}
      icono={pestana === "adaptar" ? Database : meta.icon}
      estado={estado}
      cifras={cifras}
      ariaCifras={`Cifras de ${meta.label}`}
      cifrasPendientes={pendientes}
      acciones={acciones}
      className="pulso-codificacion-cabecera"
    />
  );
}
