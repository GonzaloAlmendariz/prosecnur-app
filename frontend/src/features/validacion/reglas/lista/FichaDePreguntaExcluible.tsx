/**
 * Ficha de una pregunta en la familia "Fuera de la auditoría" (D-F7c): sus
 * reglas, los casos que marcaron en la última auditoría y, si está fuera, el
 * motivo y la fecha en que se decidió.
 */
import { PanelDeMesa } from "../../../../components/procesamiento/PanelDeMesa";
import { PulsoButton } from "../../../../components/PulsoButton";
import { formatoConteo } from "../../../../lib/formatoNumero";
import { fechaCortaDeAuditoria } from "./modeloCatalogo";
import type { PreguntaExcluible } from "./ListaFueraDeAuditoria";

export function FichaDePreguntaExcluible({
  pregunta,
  motivo,
  ocupada,
  onExcluir,
}: {
  pregunta: PreguntaExcluible;
  motivo: { motivo: string; decidido_en: string } | null;
  ocupada: boolean;
  onExcluir: (excluir: boolean) => void;
}) {
  const fecha = motivo ? fechaCortaDeAuditoria(motivo.decidido_en) : null;
  return (
    <PanelDeMesa
      zona="ficha"
      titulo={pregunta.label || pregunta.variable}
      etiquetaCuerpo={`Ficha de ${pregunta.variable}`}
      pie={(
        <PulsoButton variant="secondary" size="lg" disabled={ocupada} onClick={() => onExcluir(!pregunta.excluida)}>
          {pregunta.excluida ? "Devolver a la auditoría" : "Dejar fuera de la auditoría"}
        </PulsoButton>
      )}
    >
      <div className="pulso-rl-ficha">
        <dl className="pulso-rl-hechos">
          <div>
            <dt>Pregunta</dt>
            <dd><code className="pulso-rl-codigo">{pregunta.variable}</code></dd>
          </div>
          <div>
            <dt>Reglas</dt>
            <dd>{formatoConteo(pregunta.n_reglas)}</dd>
          </div>
          <div>
            <dt>Reglas con casos</dt>
            <dd>{formatoConteo(pregunta.n_reglas_con_casos)}</dd>
          </div>
          <div>
            <dt>Estado</dt>
            <dd>{pregunta.excluida ? "Fuera de la auditoría" : "Se audita"}</dd>
          </div>
        </dl>
        {pregunta.excluida ? (
          <section className="pulso-rl-ficha-seccion">
            <h4 className="pulso-rl-seccion-rotulo">Motivo</h4>
            <p className="pulso-rl-ficha-texto">
              {motivo?.motivo ?? "Sin motivo registrado."}
              {fecha ? ` Decidido el ${fecha}.` : ""}
            </p>
          </section>
        ) : null}
      </div>
    </PanelDeMesa>
  );
}
