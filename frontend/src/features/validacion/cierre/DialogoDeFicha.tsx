/**
 * La lista para la ficha física (`panel=ficha`, ítem 18): una fila por caso
 * marcado, por número de encuesta, con la pregunta, el valor de la base y el
 * motivo. Es el diálogo del kit abierto por la dirección; "Descargar CSV" baja
 * la misma lista.
 */
import { useMemo } from "react";
import { Download } from "../../../vendor/lucide-react";
import { ContenedorEntregable } from "../../../components/entregables/ContenedorEntregable";
import type { Generacion } from "../../../components/entregables/useGeneracion";
import { Dialog } from "../../../components/Dialog";
import { PulsoButton } from "../../../components/PulsoButton";
import { PulsoTable, type PulsoTableColumna } from "../../../components/PulsoTable";
import { formatoConteo } from "../../../lib/formatoNumero";
import { PANEL_FICHA_VALIDACION } from "../panelesValidacion";
import { ROTULO_LISTA_DE_FICHA, type FilaDeFicha } from "../hallazgos/fichaFisica";

export function DialogoDeFicha({ filas, descarga, onDescargar }: {
  filas: readonly FilaDeFicha[];
  descarga: Generacion;
  onDescargar: () => void;
}) {
  const conNota = filas.some((f) => f.nota !== "");
  // Los anchos suman menos que el cuerpo del diálogo (940): la tabla no se desplaza en horizontal y Motivo y Nota
  // se leen casi enteros; el texto completo de cada celda va en su título.
  const columnas = useMemo<PulsoTableColumna<FilaDeFicha>[]>(() => [
    { id: "encuesta", encabezado: "N.º de encuesta", ancho: conNota ? 112 : 120, celda: (f) => f.encuesta, valor: (f) => f.encuesta },
    { id: "pregunta", encabezado: "Pregunta", ancho: conNota ? 150 : 190, celda: (f) => f.pregunta, valor: (f) => f.pregunta },
    { id: "valor", encabezado: "Valor en la base", ancho: conNota ? 130 : 160, celda: (f) => f.valor, valor: (f) => f.valor },
    { id: "motivo", encabezado: "Motivo", ancho: conNota ? 258 : 440, celda: (f) => f.motivo, valor: (f) => f.motivo },
    ...(conNota ? [{ id: "nota", encabezado: "Nota", ancho: 250, celda: (f: FilaDeFicha) => f.nota, valor: (f: FilaDeFicha) => f.nota }] : []),
  ], [conNota]);
  const enCurso = descarga.estado.fase === "en_curso";
  return (
    <Dialog
      panel={PANEL_FICHA_VALIDACION}
      size="lg"
      alto="fijo"
      title={ROTULO_LISTA_DE_FICHA}
      subtitle={`${formatoConteo(filas.length)} ${filas.length === 1 ? "caso" : "casos"}, por número de encuesta`}
      footer={(
        <>
          <ContenedorEntregable estado={descarga.estado} forma="bloque" onCerrar={descarga.cerrar} />
          <PulsoButton variant="primary" disabled={enCurso || filas.length === 0} onClick={onDescargar}>
            <Download size={14} aria-hidden="true" />
            Descargar CSV
          </PulsoButton>
        </>
      )}
    >
      <PulsoTable
        columnas={columnas}
        filas={filas}
        idDeFila={(f) => `${f.hallazgoId}|${f.caso}`}
        ariaLabel={ROTULO_LISTA_DE_FICHA}
        densidad="compacta"
        altoMaximo={100_000}
        vacio="Ningún caso está marcado."
      />
    </Dialog>
  );
}
