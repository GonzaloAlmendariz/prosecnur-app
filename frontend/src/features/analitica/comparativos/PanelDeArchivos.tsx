// "Archivos" (prototipo, columna derecha): los dos comparativos que salen de la
// pestaña, cada uno con su estado y su botón; bajo ellos, el contenedor del kit
// de entregables con la espera, el archivo listo o el fallo. El resumen de lo
// generado se abre en un panel aparte (`?panel=comparativo-resumen`).

import type { ReactNode } from "react";

import { PanelDeMesa } from "../../../components/procesamiento/PanelDeMesa";
import { PulsoButton } from "../../../components/PulsoButton";
import { formatoConteoDe } from "../../../lib/formatoNumero";
import { FileSpreadsheet, Folder } from "../../../vendor/lucide-react";
import type { ComparativoTipo } from "../../../api/analitica";
import type { EstadoDeArchivo } from "./modeloDeComparativos";

const NOMBRE: Record<ComparativoTipo, string> = {
  frecuencias: "Comparativo simple",
  cruces: "Comparativo de cruces",
};

function lineaDeEstado(e: EstadoDeArchivo): { texto: string; tono: "neutro" | "listo" | "aviso" } {
  if (e.tipo === "generando") return { texto: "Generando", tono: "neutro" };
  if (e.tipo === "generado") {
    const preguntas = formatoConteoDe(e.nPreguntas, "pregunta", "preguntas");
    const fuera = e.nOmitidas ? `, ${formatoConteoDe(e.nOmitidas, "fila", "filas")} fuera` : "";
    return { texto: `Generado con ${preguntas}${fuera}`, tono: e.nOmitidas ? "aviso" : "listo" };
  }
  if (e.tipo === "bloqueado") return { texto: e.motivo, tono: "aviso" };
  return { texto: "Listo para generar", tono: "neutro" };
}

function FilaDeArchivo({ tipo, estado, ocupado, onGenerar, onResumen }: {
  tipo: ComparativoTipo;
  estado: EstadoDeArchivo;
  ocupado: boolean;
  onGenerar: () => void;
  onResumen: () => void;
}) {
  const linea = lineaDeEstado(estado);
  const generado = estado.tipo === "generado";
  return (
    <li className="comparativos-archivo" data-qa-geometry-member>
      <span className="comparativos-archivo-tesela" aria-hidden="true">
        <FileSpreadsheet size={16} />
        <small>XLSX</small>
      </span>
      <span className="comparativos-archivo-texto">
        <b title={generado ? estado.filename : undefined}>{NOMBRE[tipo]}</b>
        <span className="comparativos-archivo-estado" data-tono={linea.tono}>{linea.texto}</span>
      </span>
      <span className="comparativos-archivo-acciones">
        {generado ? (
          <PulsoButton variant="ghost" size="sm" onClick={onResumen}>Resumen</PulsoButton>
        ) : null}
        <PulsoButton
          variant="secondary"
          size="sm"
          disabled={ocupado || estado.tipo === "bloqueado"}
          aria-busy={estado.tipo === "generando" || undefined}
          aria-label={`${generado ? "Volver a generar" : "Generar"} el ${NOMBRE[tipo].toLowerCase()}`}
          onClick={onGenerar}
        >
          {generado ? "Regenerar" : "Generar"}
        </PulsoButton>
      </span>
    </li>
  );
}

export function PanelDeArchivos({ estados, ocupado, aviso, contenedor, onGenerar, onResumen }: {
  estados: Record<ComparativoTipo, EstadoDeArchivo>;
  ocupado: boolean;
  /** El aviso de ponderación antes de generar. */
  aviso: ReactNode;
  /** El contenedor del kit de entregables, con su pie. */
  contenedor: ReactNode;
  onGenerar: (tipo: ComparativoTipo) => void;
  onResumen: () => void;
}) {
  return (
    <PanelDeMesa zona="archivos" titulo="Archivos" icono={<Folder size={16} aria-hidden="true" />}>
      <div className="comparativos-archivos-cuerpo">
        {aviso}
        <ul
          className="comparativos-archivos"
          aria-label="Archivos del comparativo"
          data-qa-geometry-group="analitica/comparativos-archivos"
          data-qa-geometry-contract="intrinsic"
        >
          {(["frecuencias", "cruces"] as const).map((tipo) => (
            <FilaDeArchivo
              key={tipo}
              tipo={tipo}
              estado={estados[tipo]}
              ocupado={ocupado}
              onGenerar={() => onGenerar(tipo)}
              onResumen={onResumen}
            />
          ))}
        </ul>
        {contenedor}
      </div>
    </PanelDeMesa>
  );
}
