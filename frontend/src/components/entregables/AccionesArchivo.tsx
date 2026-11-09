// Acciones sobre un archivo ya entregado. Todas del mismo peso, íconos neutros
// del kit (PulsoButton `icon`): Abrir, Mostrar en la carpeta y Más («Guardar
// como…», «Copiar ruta»). Sin puente de escritorio (navegador) no hay Abrir ni
// carpeta: se ofrece descargar otra vez.

import { useState } from "react";
import { Download, ExternalLink, FolderOpen, MoreHorizontal } from "../../vendor/lucide-react";
import { Popover } from "../Popover";
import { PulsoButton } from "../PulsoButton";
import {
  abrirEntregable, copiarRuta, descargarDelServidor, guardarComo, hayGuardarComo, hayPuenteDeArchivos, mostrarEntregable,
} from "./entregaArchivo";
import { carpetaDeRuta } from "./generacionModelo";
import type { ArchivoEntregable } from "./tipos";

export function AccionesArchivo({ archivo, rutaDescargada = null, compacta = false }: {
  archivo: ArchivoEntregable;
  rutaDescargada?: string | null;
  /** En la fila de una tabla: solo Abrir y Mostrar en la carpeta (o Descargar). */
  compacta?: boolean;
}) {
  const [cierres, setCierres] = useState(0);
  const ruta = archivo.guardadoEn ?? rutaDescargada ?? null;
  const puente = hayPuenteDeArchivos();
  const conRuta = puente && ruta !== null;
  const guardarOtro = hayGuardarComo();
  const opcionesMas = [
    guardarOtro ? { id: "guardar", rotulo: "Guardar como…", hacer: () => guardarComo(archivo.fileId, archivo.nombre, ruta ? carpetaDeRuta(ruta) : null) } : null,
    ruta ? { id: "copiar", rotulo: "Copiar ruta", hacer: () => copiarRuta(ruta) } : null,
  ].filter((o): o is { id: string; rotulo: string; hacer: () => Promise<void> } => o !== null);
  const descargar = () => descargarDelServidor(archivo.fileId, archivo.nombre);
  const rotuloDescargar = archivo.guardadoEn ? "Descargar" : "Descargar otra vez";

  return (
    <div className="pulso-entregable-acciones" role="group" aria-label={`Acciones de ${archivo.nombre}`}>
      {conRuta ? (
        <>
          <PulsoButton variant="icon" tone="framed" size="sm" aria-label="Abrir" title="Abrir" onClick={() => void abrirEntregable(ruta)}>
            <ExternalLink size={15} aria-hidden="true" />
          </PulsoButton>
          <PulsoButton variant="icon" tone="framed" size="sm" aria-label="Mostrar en la carpeta" title="Mostrar en la carpeta" onClick={() => void mostrarEntregable(ruta)}>
            <FolderOpen size={15} aria-hidden="true" />
          </PulsoButton>
        </>
      ) : compacta ? (
        <PulsoButton variant="icon" tone="framed" size="sm" aria-label={rotuloDescargar} title={rotuloDescargar} onClick={descargar}>
          <Download size={15} aria-hidden="true" />
        </PulsoButton>
      ) : (
        <PulsoButton variant="secondary" size="sm" className="pulso-entregable-texto" onClick={descargar}>
          {rotuloDescargar}
        </PulsoButton>
      )}
      {!compacta && opcionesMas.length > 0 && (
        <Popover
          side="bottom"
          align="end"
          maxWidth={220}
          ariaLabel={`Más acciones de ${archivo.nombre}`}
          cerrarAlCambiar={cierres}
          trigger={
            <PulsoButton variant="icon" tone="framed" size="sm" aria-label="Más" title={opcionesMas.map((o) => o.rotulo).join(", ")}>
              <MoreHorizontal size={15} aria-hidden="true" />
            </PulsoButton>
          }
        >
          <div className="pulso-entregable-menu">
            {opcionesMas.map((opcion) => (
              <button
                key={opcion.id}
                type="button"
                className="pulso-entregable-menu-item"
                onClick={() => {
                  setCierres((n) => n + 1);
                  void opcion.hacer();
                }}
              >
                {opcion.rotulo}
              </button>
            ))}
          </div>
        </Popover>
      )}
    </div>
  );
}
