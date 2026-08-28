import { FlaskConical } from "../../vendor/lucide-react";
import { PulsoButton } from "../../components/PulsoButton";

type Props = {
  codigo: string;
  onCodigo: (valor: string) => void;
  onGenerar: () => void;
  /** Motivo compartido con los tres botones de formato: sin accesos preparados
      no hay enlace que meter en el QR. `null` cuando no hay bloqueo. */
  motivoBloqueo: string | null;
  /** Hay accesos preparados de los que copiar el enlace. */
  listo: boolean;
  /** Ya hay un render en curso. */
  ocupado: boolean;
};

/**
 * La ficha que NO va a un aula.
 *
 * Antes de imprimir el lote hay que escanear una hoja y comprobar tres cosas:
 * que el QR abre, que la respuesta llega con su `collectorID` y que al terminar
 * redirige. Y en la capacitación el equipo necesita practicar sin que sus
 * respuestas entren al estudio. Las dos cosas son la misma pieza: el **mismo
 * enlace** del operativo con un colector inventado.
 *
 * Vive en su propio archivo y no dentro de `MaterialsSection`, que ya pasa de
 * las 700 líneas y corta en una rama de carga: aquí se puede renderizar y mirar
 * el markup de verdad, en vez de comprobar por grep que el control está escrito.
 *
 * Va separado de los tres botones de formato por una hairline a propósito. No es
 * un formato más del paquete: es una hoja que no se reparte, y si pareciera
 * parte del lote alguien la imprimiría con él.
 */
export function FichaPruebaControl({
  codigo, onCodigo, onGenerar, motivoBloqueo, listo, ocupado,
}: Props) {
  const sinCodigo = !codigo.trim();
  return (
    <label className="rec-prueba-campo">Ficha de prueba
      <span className="rec-prueba-fila">
        <input
          value={codigo}
          onChange={(event) => onCodigo(event.target.value)}
          placeholder="PRUEBA_2026"
          aria-label="Código de la ficha de prueba"
          spellCheck={false}
        />
        <PulsoButton
          variant="secondary"
          title={motivoBloqueo ?? (sinCodigo ? "Escribe un código para la ficha" : undefined)}
          onClick={onGenerar}
          disabled={!listo || ocupado || sinCodigo}
        >
          <FlaskConical size={15} /> Generar
        </PulsoButton>
      </span>
      <small>
        Un colector aparte —<code>PRUEBA_2026</code>, <code>CAPACITACION</code>,{" "}
        <code>prueba_interna</code>— con el mismo enlace del operativo. No entra al plan.
      </small>
    </label>
  );
}
