import { apiCodifAplicar } from "../../../api/dashboard";
import { PulsoButton } from "../../../components/PulsoButton";
import { formatoConteo } from "../../../lib/formatoNumero";
import { Play } from "../../../vendor/lucide-react";
import { aplicarCodificacion, selectAplicarEntrada, useAplicarAvisosStore } from "../aplicarAvisosStore";

/** "Aplicar 3 preguntas": lo que hace el botón y sobre cuántas, como en el prototipo. */
export function rotuloDeAplicar(nPreguntas: number): string {
  if (nPreguntas <= 0) return "Aplicar";
  return nPreguntas === 1 ? "Aplicar 1 pregunta" : `Aplicar ${formatoConteo(nPreguntas)} preguntas`;
}

/**
 * La acción principal de Aplicar, en la cabecera de la pestaña (prototipo, `tabHeading` de Aplicar).
 * Lanza la misma aplicación que antes vivía al pie del panel; el avance y el resultado siguen en el cuerpo
 * del panel, que toma el foco al pulsar (`onPulsado`). Con la base marcada "ya viene codificada" no hay
 * botón: el pie dice por qué.
 */
export function BotonAplicar({ clave, nPreguntas, yaCodificada, onPulsado }: {
  clave: string;
  nPreguntas: number;
  yaCodificada: boolean;
  onPulsado: () => void;
}) {
  const { aplicando, jobId } = useAplicarAvisosStore(selectAplicarEntrada(clave));
  if (yaCodificada && !aplicando && !jobId) return null;
  const motivo = aplicando
    ? "La codificación se está aplicando."
    : jobId
      ? "La aplicación ya está en curso."
      : nPreguntas === 0
        ? "No hay preguntas con códigos por aplicar."
        : "";
  return (
    <PulsoButton
      variant="primary"
      size="sm"
      onClick={() => {
        onPulsado();
        void aplicarCodificacion(clave, apiCodifAplicar);
      }}
      disabled={aplicando || !!jobId || nPreguntas === 0}
      aria-busy={aplicando || undefined}
      title={motivo || undefined}
      data-testid="codificacion-adaptar-boton"
    >
      <Play size={14} aria-hidden="true" /> {rotuloDeAplicar(nPreguntas)}
    </PulsoButton>
  );
}
