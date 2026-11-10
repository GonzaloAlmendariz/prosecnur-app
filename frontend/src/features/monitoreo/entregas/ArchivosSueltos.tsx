// Los archivos que acompañan al entregable principal, al pie de su contenedor:
// botones neutros del mismo peso (nada resaltado ni subrayado), cada uno baja
// su archivo por el kit.

import { descargarDelServidor } from "../../../components/entregables/entregaArchivo";
import { PulsoButton } from "../../../components/PulsoButton";
import { Download } from "../../../vendor/lucide-react";
import type { ArchivoSuelto } from "./modeloEntrega";
import "./entregas.css";

export function ArchivosSueltos({ archivos, etiqueta }: { archivos: readonly ArchivoSuelto[]; etiqueta: string }) {
  if (!archivos.length) return null;
  return (
    <div className="mon-entrega-sueltos" role="group" aria-label={etiqueta}>
      {archivos.map((a) => (
        <PulsoButton
          key={a.clave}
          variant="secondary"
          size="sm"
          className="pulso-entregable-texto"
          title={a.nombre}
          onClick={() => descargarDelServidor(a.fileId, a.nombre)}
        >
          <Download size={12} aria-hidden="true" /> {a.rotulo}
        </PulsoButton>
      ))}
    </div>
  );
}
