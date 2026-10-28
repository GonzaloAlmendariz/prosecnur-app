// «Vista para revisión» (L9) dentro de Exportar: elige de 1 a 6 campañas y arma
// un HTML con sus correos lado a lado, en computadora y en celular, para mandar
// a quien los aprueba. Para comparar dos propuestas se duplica la campaña.

import { useEffect, useId, useState } from "react";

import { downloadUrl } from "../../../api/core";
import {
  apiMailCampaigns,
  apiMailRevision,
  apiMailTextosWord,
  type MailCampaignSummary,
  type MailRevision,
  type MailRevisionEnvio,
} from "../../../api/materialMail";
import { PulsoButton } from "../../../components/PulsoButton";
import { Download, Eye, FileText } from "../../../vendor/lucide-react";
import "./correosExportar.css";

const MAX = 6;
// Los nombres de Gonzalo para los envíos: sin numerar los recordatorios.
const ENVIOS: readonly { valor: MailRevisionEnvio; rotulo: string }[] = [
  { valor: "primero", rotulo: "Primer correo" },
  { valor: "recordatorio", rotulo: "Recordatorio" },
  { valor: "ultimo", rotulo: "Último recordatorio" },
];

type Props = {
  /** La campaña abierta: entra marcada. */
  campana: string | null;
};

export function VistaParaRevision({ campana }: Props) {
  const id = useId();
  const [campanas, setCampanas] = useState<MailCampaignSummary[]>([]);
  const [elegidas, setElegidas] = useState<string[]>(campana ? [campana] : []);
  const [envio, setEnvio] = useState<MailRevisionEnvio>("primero");
  const [armando, setArmando] = useState(false);
  const [listo, setListo] = useState<MailRevision | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Textos en Word (L13): con las mismas campañas, en orden.
  const [armandoWord, setArmandoWord] = useState(false);
  const [word, setWord] = useState<MailRevision | null>(null);

  useEffect(() => {
    let vivo = true;
    apiMailCampaigns().then((p) => { if (vivo) setCampanas(p.campaigns); }, () => { if (vivo) setCampanas([]); });
    return () => { vivo = false; };
  }, []);

  const alternar = (cid: string) => {
    setListo(null);
    setWord(null);
    setElegidas((xs) => (xs.includes(cid) ? xs.filter((x) => x !== cid) : xs.length < MAX ? [...xs, cid] : xs));
  };
  const armar = async () => {
    setArmando(true); setError(null); setListo(null);
    try {
      setListo(await apiMailRevision({ campaign_ids: elegidas, titulo: "Correos para revisar", envio }));
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "No se pudo armar la vista.");
    } finally {
      setArmando(false);
    }
  };

  const armarWord = async () => {
    setArmandoWord(true); setError(null); setWord(null);
    try {
      setWord(await apiMailTextosWord({ campaign_ids: elegidas, titulo: "Textos de los correos" }));
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "No se pudo armar el Word.");
    } finally {
      setArmandoWord(false);
    }
  };

  return (
    <section className="rec-exp-revision" aria-labelledby={`${id}-titulo`}>
      <h3 id={`${id}-titulo`} className="rec-exp-revision-titulo"><Eye size={14} aria-hidden /> Vista para revisión</h3>
      <p className="rec-exp-revision-ayuda">Los correos lado a lado, en computadora y celular, en un solo archivo.</p>
      <ul className="rec-exp-revision-lista">
        {campanas.map((c) => {
          const marcada = elegidas.includes(c.campaign_id);
          return (
            <li key={c.campaign_id}>
              <label>
                <input
                  type="checkbox"
                  checked={marcada}
                  disabled={!marcada && elegidas.length >= MAX}
                  onChange={() => alternar(c.campaign_id)}
                />
                <span>{c.name}</span>
              </label>
            </li>
          );
        })}
      </ul>
      <fieldset className="rec-exp-revision-envio">
        <legend>Envío</legend>
        {ENVIOS.map((e) => (
          <label key={e.valor}>
            <input
              type="radio"
              name={`${id}-envio`}
              checked={envio === e.valor}
              onChange={() => { setEnvio(e.valor); setListo(null); }}
            />
            <span>{e.rotulo}</span>
          </label>
        ))}
      </fieldset>
      <div className="rec-exp-revision-acciones">
        <PulsoButton variant="secondary" size="sm" disabled={!elegidas.length || armando} onClick={() => { void armar(); }}>
          {armando ? "Armando…" : `Armar la vista (${elegidas.length})`}
        </PulsoButton>
        {listo ? (
          <a className="pulso-button pulso-button--secondary pulso-button--sm" href={downloadUrl(listo.file_id)} download={listo.filename}>
            <Download size={14} aria-hidden /> Descargar
          </a>
        ) : null}
      </div>
      <div className="rec-exp-revision-acciones">
        <PulsoButton variant="secondary" size="sm" disabled={!elegidas.length || armandoWord} onClick={() => { void armarWord(); }}>
          <FileText size={14} aria-hidden /> {armandoWord ? "Armando…" : "Textos en Word"}
        </PulsoButton>
        {word ? (
          <a className="pulso-button pulso-button--secondary pulso-button--sm" href={downloadUrl(word.file_id)} download={word.filename}>
            <Download size={14} aria-hidden /> Descargar Word
          </a>
        ) : null}
      </div>
      {error ? <p className="rec-exp-revision-error" role="alert">{error}</p> : null}
    </section>
  );
}
