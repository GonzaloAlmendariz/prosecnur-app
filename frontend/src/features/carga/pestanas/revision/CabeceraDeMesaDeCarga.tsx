// La cabecera de las pestañas de Carga rehechas con el kit de Procesamiento
// (Revisión, Formulario y Respuestas; prototipo `tabHeading`): la tesela con el
// ícono de la pestaña en el riel, "Carga" como antetítulo, el título, el estado
// en palabra y las cifras como número sobre su rótulo, con las acciones al
// extremo derecho. El rótulo y el ícono salen del riel, así que no se repiten
// aquí; fuera de la mesa de Carga (una prueba aislada) se usa el título dado.

import type { ReactNode } from "react";
import { CabeceraDePestana, type EstadoDePestana } from "../../../../components/procesamiento/CabeceraDePestana";
import type { CifraDePestana } from "../../../../components/procesamiento/CifrasDePestana";
import { ClipboardList } from "../../../../vendor/lucide-react";
import { cargaWorkspaceItems, type CargaWorkspaceTab } from "../../CargaWorkspaceModel";
import { useCabeceraDeCarga } from "../bases/contextoDeCabecera";

export function CabeceraDeMesaDeCarga({
  pestana,
  titulo,
  estado,
  cifras,
  pendientes,
  acciones,
}: {
  pestana: CargaWorkspaceTab;
  titulo: string;
  estado?: EstadoDePestana | null;
  cifras: readonly CifraDePestana[];
  /** Las cifras del prototipo que el motor no publica, con su causa (hueco declarado). */
  pendientes?: string;
  acciones?: ReactNode;
}) {
  const mesa = useCabeceraDeCarga();
  const item = mesa ? cargaWorkspaceItems(mesa.contexto).find((i) => i.key === pestana) : undefined;
  return (
    <CabeceraDePestana
      seccion="Carga"
      titulo={item?.label ?? titulo}
      icono={item?.icon ?? ClipboardList}
      estado={estado}
      cifras={cifras}
      ariaCifras={`Cifras de ${item?.label ?? titulo}`}
      cifrasPendientes={pendientes}
      acciones={acciones}
      className="pulso-carga-cabecera-kit"
    />
  );
}
