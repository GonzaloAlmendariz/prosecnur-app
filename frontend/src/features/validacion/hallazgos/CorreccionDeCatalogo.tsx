/**
 * Corrección de un caso de "Combinación fuera de catálogo" en la ficha del
 * caso: la propuesta del motor con su causa (o "A investigar") y, debajo, el
 * selector del catálogo para buscar el lugar a mano. Elegir arma la corrección
 * de las columnas del lugar para esta encuesta y la deja a la espera de
 * confirmación; solo al confirmar se registra una decisión `set_value` de un
 * caso por columna. Nada se aplica solo.
 */
import { useState } from "react";
import { Panel } from "../../../components/Panel";
import { PulsoButton } from "../../../components/PulsoButton";
import { apiV2LimpiezaDecisionSave } from "../../../api/validacion";
import type { HallazgoDelCaso } from "../../../api/validacionAuditoria";
import { SelectorDeUbigeo, type ApiDelSelector } from "../catalogo/SelectorDeUbigeo";
import { buildDecisionPayload, inferSourceType } from "../limpieza/modeloLimpieza";
import type { LugarACorregir } from "../catalogo/correccionDeCatalogo";
import {
  decisionesDeCorreccion,
  lugarDeCandidato,
  lugarDelSelector,
  propuestaEnPalabras,
  rotuloDeColumna,
  type CorreccionGuardada,
} from "./correccionDelCaso";

type Pendiente = { lugar: LugarACorregir; origen: "candidato" | "selector" };

export function CorreccionDeCatalogo({
  hallazgo,
  idCaso,
  baseNombre,
  onGuardada,
  guardarDecision = apiV2LimpiezaDecisionSave,
  apiSelector,
  guardadas = [],
  valorActual,
}: {
  hallazgo: HallazgoDelCaso;
  idCaso: string;
  baseNombre: string | null;
  /** Después de guardar: quien monta vuelve a leer la cola. */
  onGuardada?: () => void;
  /** Lo que el caso ya tiene corregido para esta regla (decisiones listas): se dice en lugar de proponer de nuevo. */
  guardadas?: readonly CorreccionGuardada[];
  /** El valor que la base trae hoy en una columna del caso, para decir "de RINAC a Rimac"; `null` si no se conoce. */
  valorActual?: (columna: string) => string | null;
  /** Para pruebas. */
  guardarDecision?: typeof apiV2LimpiezaDecisionSave;
  apiSelector?: ApiDelSelector;
}) {
  const [pendiente, setPendiente] = useState<Pendiente | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [guardadasAhora, setGuardadas] = useState<number | null>(null);

  const candidatos = hallazgo.esperado?.candidatos ?? [];
  const formas = pendiente
    ? decisionesDeCorreccion({ lugar: pendiente.lugar, roles: hallazgo.roles, idCaso, origen: pendiente.origen })
    : [];

  const elegir = (p: Pendiente) => {
    setPendiente(p);
    setGuardadas(null);
    setError("");
  };

  const confirmar = async () => {
    setGuardando(true);
    setError("");
    try {
      for (const form of formas) {
        const cuerpo = buildDecisionPayload({
          form,
          status: "ready",
          sourceId: hallazgo.id_regla,
          sourceType: inferSourceType(hallazgo.id_regla),
        });
        await guardarDecision(cuerpo, baseNombre);
      }
      setGuardadas(formas.length);
      setPendiente(null);
      onGuardada?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Panel noPadding className="pulso-hz-caso-caja" title="Corrección del lugar">
      <div className="pulso-hz-correccion">
        {guardadas.length ? (
          <div className="pulso-hz-correccion-guardada" role="group" aria-label="Corrección guardada">
            <span className="pulso-hz-correccion-rotulo">Corregido en esta encuesta</span>
            <ul>
              {guardadas.map((g) => (
                <li key={g.columna} title={g.columna}><span className="pulso-hz-correccion-papel">{rotuloDeColumna(g.columna, hallazgo.roles)}</span><b>{g.valor}</b></li>
              ))}
            </ul>
            <p>Se aplica al cerrar la base.</p>
          </div>
        ) : candidatos.length ? (
          <ul className="pulso-hz-correccion-propuestas" aria-label="Propuestas del catálogo">
            {candidatos.map((c, k) => (
              <li key={`${c.rol}-${c.valor}-${k}`}>
                <span>{propuestaEnPalabras(c)}</span>
                <PulsoButton variant="secondary" size="sm" onClick={() => elegir({ lugar: lugarDeCandidato(c), origen: "candidato" })}>
                  Usar propuesta
                </PulsoButton>
              </li>
            ))}
          </ul>
        ) : (
          <p className="pulso-hz-correccion-investigar">A investigar</p>
        )}
        {pendiente ? (
          <div className="pulso-hz-correccion-confirmar" role="group" aria-label="Confirmar la corrección">
            {formas.length ? (
              <>
                <span className="pulso-hz-correccion-rotulo">Se reemplaza en esta encuesta</span>
                <ul>
                  {formas.map((f) => {
                    const antes = valorActual?.(f.target_variable) ?? null;
                    return (
                      <li key={f.target_variable} title={f.target_variable}>
                        <span className="pulso-hz-correccion-papel">{rotuloDeColumna(f.target_variable, hallazgo.roles)}</span>
                        <span>{antes && antes !== f.set_value ? `de ${antes} a ` : null}<b>{f.set_value}</b></span>
                      </li>
                    );
                  })}
                </ul>
              </>
            ) : (
              <p>La regla no tiene columnas para este lugar.</p>
            )}
            <div className="pulso-hz-correccion-acciones">
              <PulsoButton variant="primary" size="md" disabled={guardando || !formas.length} onClick={() => void confirmar()}>
                Confirmar corrección
              </PulsoButton>
              <PulsoButton variant="secondary" size="md" disabled={guardando} onClick={() => setPendiente(null)}>Cancelar</PulsoButton>
            </div>
          </div>
        ) : null}
        <div className="pulso-hz-correccion-buscar">
          <span className="pulso-hz-correccion-rotulo">Buscar otro lugar</span>
          <SelectorDeUbigeo
            alElegir={(l) => elegir({ lugar: lugarDelSelector(l), origen: "selector" })}
            ariaLabel="Buscar un lugar del catálogo para corregir el caso"
            api={apiSelector}
          />
        </div>
        {guardadasAhora !== null && !guardadas.length ? (
          <p className="pulso-hz-correccion-ok" role="status">
            {guardadasAhora === 1 ? "Corrección guardada en 1 columna." : `Corrección guardada en ${guardadasAhora} columnas.`}
          </p>
        ) : null}
        {error ? <p className="pulso-hz-aviso" data-tono="aviso" role="alert">{error}</p> : null}
      </div>
    </Panel>
  );
}
