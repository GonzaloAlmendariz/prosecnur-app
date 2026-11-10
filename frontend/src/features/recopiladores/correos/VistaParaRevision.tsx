// «Vista para revisión» (L9) dentro de Exportar: elige de 1 a 6 campañas y arma
// un HTML con sus correos lado a lado, en computadora y en celular, para mandar
// a quien los aprueba. Para comparar dos propuestas se duplica la campaña.
//
// El HTML y el Word se esperan y se entregan en el contenedor anclado a
// «Exportar» (ADR 0133): pedirlos cierra el menú y el botón sólo se deshabilita.

import { useEffect, useId, useState } from "react";

import {
  apiMailCampaigns,
  apiMailRevision,
  apiMailTextosWord,
  type MailCampaignSummary,
  type MailRevisionEnvio,
} from "../../../api/materialMail";
import type { Generacion } from "../../../components/entregables/useGeneracion";
import { PulsoButton } from "../../../components/PulsoButton";
import { PulsoSwitch } from "../../../components/PulsoSwitch";
import { Eye, FileText } from "../../../vendor/lucide-react";
import { archivoParaElKit } from "../entregas/modeloEntrega";
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
  /** La generación del menú «Exportar» (una a la vez, anclada a su disparador). */
  generacion: Pick<Generacion, "estado" | "ejecutar">;
  /** Cierra el menú: el resultado queda en el contenedor anclado. */
  onPedir: () => void;
};

export function VistaParaRevision({ campana, generacion, onPedir }: Props) {
  const id = useId();
  const [campanas, setCampanas] = useState<MailCampaignSummary[]>([]);
  const [elegidas, setElegidas] = useState<string[]>(campana ? [campana] : []);
  const [envio, setEnvio] = useState<MailRevisionEnvio>("primero");
  const enCurso = generacion.estado.fase === "en_curso";

  useEffect(() => {
    let vivo = true;
    apiMailCampaigns().then((p) => { if (vivo) setCampanas(p.campaigns); }, () => { if (vivo) setCampanas([]); });
    return () => { vivo = false; };
  }, []);

  const alternar = (cid: string) => {
    setElegidas((xs) => (xs.includes(cid) ? xs.filter((x) => x !== cid) : xs.length < MAX ? [...xs, cid] : xs));
  };
  const armar = () => {
    onPedir();
    void generacion.ejecutar(
      async () => archivoParaElKit(await apiMailRevision({ campaign_ids: elegidas, titulo: "Correos para revisar", envio })),
      { titulo: "Correos para revisar", formato: "html", articulo: "los" },
    );
  };

  // Textos en Word (L13): con las mismas campañas, en orden.
  const armarWord = () => {
    onPedir();
    void generacion.ejecutar(
      async () => archivoParaElKit(await apiMailTextosWord({ campaign_ids: elegidas, titulo: "Textos de los correos" })),
      { titulo: "Textos de los correos", formato: "docx", articulo: "los" },
    );
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
              <PulsoSwitch
                size="sm"
                label={c.name}
                checked={marcada}
                disabled={!marcada && elegidas.length >= MAX}
                onCheckedChange={() => alternar(c.campaign_id)}
              />
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
              onChange={() => setEnvio(e.valor)}
            />
            <span>{e.rotulo}</span>
          </label>
        ))}
      </fieldset>
      <div className="rec-exp-revision-acciones">
        <PulsoButton variant="secondary" size="sm" disabled={!elegidas.length || enCurso} onClick={armar}>
          {`Armar la vista (${elegidas.length})`}
        </PulsoButton>
      </div>
      <div className="rec-exp-revision-acciones">
        <PulsoButton variant="secondary" size="sm" disabled={!elegidas.length || enCurso} onClick={armarWord}>
          <FileText size={14} aria-hidden /> Textos en Word
        </PulsoButton>
      </div>
    </section>
  );
}
