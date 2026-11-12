/**
 * La cabecera del hallazgo abierto (prototipo `cabHall`, `vistas.js:158`): la
 * frase de la regla en su tarjeta (clase, origen y "Ver la regla") y, al lado,
 * la cifra con su base y su proporción.
 *
 * La frase es la única narrativa de la regla (catálogo M3, la misma de Reglas).
 * Debajo va el "Detalle" que el equipo escribió en la regla, si lo escribió.
 * La base es la de la última auditoría de la regla ("de 72 que respondieron la
 * pregunta"); si el motor no la publica, la cifra va sola, sin proporción.
 */
import { CifraHallazgo } from "../../../components/procesamiento/CifraHallazgo";
import { FraseRegla } from "../../../components/procesamiento/FraseRegla";
import { PulsoButton } from "../../../components/PulsoButton";
import { formatoConteo } from "../../../lib/formatoNumero";
import type { NarrativaDeRegla } from "../../../api/validacionAuditoria";
import { FraseDelHallazgo } from "./FraseDelHallazgo";
import { rotuloDeClase, type CifraDelHallazgo } from "./modeloHallazgos";

export function CabeceraDelHallazgo({
  narrativa,
  nombre,
  origen,
  n,
  unidad,
  cifra,
  onVerRegla,
}: {
  narrativa: NarrativaDeRegla;
  nombre: string;
  origen: string;
  n: number;
  unidad: "casos" | "respuestas";
  cifra: CifraDelHallazgo | null;
  onVerRegla: () => void;
}) {
  const clase = narrativa.clase === "caso_a_revisar" ? "revisar" : "inconsistencia";
  const singular = unidad === "respuestas" ? "respuesta marcada" : "caso marcado";
  const plural = unidad === "respuestas" ? "respuestas marcadas" : "casos marcados";
  return (
    <div className="pulso-hz-cabecera" data-qa-geometry-group="validacion/hallazgos-cabecera" data-qa-geometry-contract="intrinsic">
      <div className="pulso-hz-cabecera-texto">
        <FraseRegla
          tamano="compacto"
          className="pulso-hz-frase"
          tipo={(
            <>
              <span className="pulso-rl-clase" data-clase={clase}>{rotuloDeClase(narrativa.clase)}</span>
              <span className="pulso-hz-origen">{origen}</span>
            </>
          )}
          accion={<PulsoButton variant="link" size="sm" onClick={onVerRegla}>Ver la regla</PulsoButton>}
        >
          {narrativa.frase.length ? <FraseDelHallazgo piezas={narrativa.frase} /> : nombre}
        </FraseRegla>
        {narrativa.detalle ? (
          <p className="pulso-hz-detalle">
            <span className="pulso-hz-detalle-rotulo">Detalle de la regla:</span> {narrativa.detalle}
          </p>
        ) : null}
      </div>
      {cifra ? (
        <CifraHallazgo
          className="pulso-hz-cifra"
          cifra={cifra.cifra}
          base={cifra.base}
          proporcion={cifra.proporcion}
          tono={narrativa.clase === "caso_a_revisar" ? "aviso" : "inconsistencia"}
        />
      ) : (
        <div className="pulso-hz-cifra pulso-hz-cifra--sola">
          <strong>{formatoConteo(n)}</strong>
          <span>{n === 1 ? singular : plural}</span>
        </div>
      )}
    </div>
  );
}
