// La memoria JSON del paquete de defensa: la arma el front (semilla, firma del
// marco y decision log), así que no tiene `file_id`. Se entrega como archivo
// local del kit (`ArchivoLocal`, ADR 0133): mismo contenedor que las otras dos
// piezas, «Descargado» al instante y sin «Guardar como…». Si el motor llega a
// registrarla, esta pieza pasa a pedirle el archivo como las demás.

import { ArchivoLocal } from "../../../components/entregables/archivoLocal";
import { nombreMemoriaDefensa } from "./modeloEntrega";

export function memoriaDefensaComoArchivo(memoria: unknown, fecha: Date = new Date()): ArchivoLocal {
  return new ArchivoLocal(new Blob([JSON.stringify(memoria, null, 2)], { type: "application/json" }), nombreMemoriaDefensa(fecha));
}
