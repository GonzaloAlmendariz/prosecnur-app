import { FileSpreadsheet } from "../../../vendor/lucide-react";
import type { EstudioBase, Pregunta, Seccion } from "../../../api/client";
import { EstadoVacio } from "../../../components/EstadoVacio";
import { CargaStructureWorkbench } from "../CargaStructureWorkbench";
import { EsquemaBaseSelector } from "../EsquemaBaseSelector";

export type PestanaEstructuraProps = {
  /** Con varias bases se elige de cuál base se muestra el esquema. */
  varias: boolean;
  hayEstructura: boolean;
  estructura: { secciones: Seccion[]; preguntas: Pregunta[] } | null;
  bases: Record<string, EstudioBase> | null;
  baseDelEsquema: string;
  onCambiarBaseDelEsquema: (nombre: string) => void;
};

/** Estructura del formulario: secciones, preguntas y reglas de la base elegida. */
export function PestanaEstructura({
  varias,
  hayEstructura,
  estructura,
  bases,
  baseDelEsquema,
  onCambiarBaseDelEsquema,
}: PestanaEstructuraProps) {
  if (hayEstructura && estructura) {
    return (
      <CargaStructureWorkbench
        estructura={estructura}
        schemaSelector={varias && bases ? (
          <EsquemaBaseSelector
            bases={bases}
            value={baseDelEsquema}
            onChange={onCambiarBaseDelEsquema}
          />
        ) : undefined}
      />
    );
  }
  return (
    <EstadoVacio
      tamano="normal"
      icono={<FileSpreadsheet size={18} />}
      titulo="Aún no hay estructura para revisar"
      descripcion={varias
        ? "Agrega una base con instrumento desde Fuentes para inspeccionar secciones, preguntas y reglas."
        : "Agrega un formulario desde Fuentes para inspeccionar secciones, preguntas y reglas."}
    />
  );
}
