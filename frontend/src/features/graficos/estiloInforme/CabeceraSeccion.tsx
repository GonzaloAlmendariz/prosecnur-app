// Cabecera común de cada sección de «Estilo del informe»: título, «Modificado» si algo difiere del default y «Volver al
// recetario» (borra las claves de la sección). El sello por ajuste lo pinta cada fila con `SelloProcedencia`.

import type { ReactNode } from "react";
import { PulsoButton } from "../../../components/PulsoButton";
import { RotateCcw } from "../../../vendor/lucide-react";
import { MarcaModificado } from "../estilo/SelloProcedencia";

export function CabeceraSeccion({
  id,
  titulo,
  modificado,
  etiquetaVolver,
  onVolver,
  extra,
}: {
  id: string;
  titulo: string;
  modificado: boolean;
  /** Nombre accesible del botón «Volver al recetario» (qué se devuelve). */
  etiquetaVolver?: string;
  onVolver?: () => void;
  extra?: ReactNode;
}) {
  return (
    <header className="pulso-f6-informe-cabecera">
      <h3 id={id}>{titulo}</h3>
      <MarcaModificado visible={modificado} />
      {extra}
      {modificado && onVolver ? (
        <PulsoButton variant="ghost" size="sm" onClick={onVolver} aria-label={etiquetaVolver ?? "Volver al recetario"}>
          <RotateCcw size={14} aria-hidden="true" />
          Volver al recetario
        </PulsoButton>
      ) : null}
    </header>
  );
}
