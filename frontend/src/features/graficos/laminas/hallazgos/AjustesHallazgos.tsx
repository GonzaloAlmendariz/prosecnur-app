// Ajustes de «Hallazgos clave» (`p_slide_hallazgos`) en Inspector › Lámina: el modo y, en el resumen ejecutivo, la
// selección, los topes, «También», los cruces y los capítulos. Se pintan los argumentos del registro que no son texto
// (los textos van en «Textos»), en su orden y según su `depende`. Cada cambio es un `updateSlidePayload`.

import { useId } from "react";
import { useLocation } from "react-router-dom";
import { History } from "../../../../vendor/lucide-react";
import type { ArgMetadata, Slide } from "../../../../api/graficos";
import { Switch } from "../../../../components/Switch";
import { useSession } from "../../../../lib/SessionContext";
import { argAplica } from "../../argDependencias";
import { useGraficosReportScope } from "../../reportScope";
import { usePlanStore } from "../../store";
import { ListaPreguntas } from "../ListaPreguntas";
import { NumeroAcotado } from "../NumeroAcotado";
import { varCalificada } from "../ordenCategorias";
import { CapitulosHallazgos } from "./CapitulosHallazgos";
import { MODOS_RESUMEN } from "./modeloCapitulosHallazgos";
import "../datosGrafico.css";
import "./hallazgos.css";

/** El valor que rige: el escrito en la lámina o, si no hay, el del registro. */
export function valorEfectivo(payload: Record<string, unknown>, arg: Pick<ArgMetadata, "name" | "default">): unknown {
  const v = payload[arg.name];
  return v === undefined || v === null || v === "" ? arg.default : v;
}

/** Los ajustes que aplican al modo y la selección en vigor, en el orden del registro. */
export function ajustesQueAplican(args: readonly ArgMetadata[], payload: Record<string, unknown>): ArgMetadata[] {
  const efectivos: Record<string, unknown> = { ...payload };
  for (const a of args) efectivos[a.name] = valorEfectivo(payload, a);
  return args.filter((a) => argAplica(a, efectivos));
}

export function AjustesHallazgos({ slide, args }: { slide: Slide; args: readonly ArgMetadata[] }) {
  const idTitulo = useId();
  const updatePayload = usePlanStore((s) => s.updateSlidePayload);
  const scope = useGraficosReportScope(useLocation().search);
  const baseActiva = useSession().state?.active_base;
  const payload = slide.payload as Record<string, unknown>;
  const porNombre = new Map(args.map((a) => [a.name, a]));
  const texto = (n: string) => { const a = porNombre.get(n); return a ? String(valorEfectivo(payload, a) ?? "") : ""; };
  const modo = texto("modo") || "cifras";
  const automatica = texto("seleccion") === "auto";
  const set = (name: string, v: unknown) => updatePayload(slide.id, { [name]: v });

  return (
    <section className="pulso-f6-especial pulso-f6-hallazgos-ajustes" aria-labelledby={idTitulo}
      data-qa-geometry-group="graficos/f6-hallazgos-ajustes" data-qa-geometry-contract="intrinsic">
      <h3 id={idTitulo} className="pulso-f6-subtitulo">Hallazgos</h3>
      <div className="pulso-f6-datos" data-qa-geometry-group="graficos/f6-hallazgos-datos" data-qa-geometry-contract="intrinsic">
        {ajustesQueAplican(args, payload).map((a) => (
          <Ajuste key={a.name} arg={a} valor={payload[a.name]} efectivo={valorEfectivo(payload, a)} modo={modo} automatica={automatica}
            calificar={(ref) => varCalificada(ref, baseActiva, scope)} scope={scope} onCambio={(v) => set(a.name, v)} />
        ))}
      </div>
      {!MODOS_RESUMEN.has(modo) && (
        <p className="pulso-f6-pendiente">
          <History size={14} aria-hidden="true" />
          <span>Cifras destacadas: en este modo todavía se escriben en el plan.</span>
        </p>
      )}
    </section>
  );
}

function Ajuste({ arg: a, valor, efectivo, modo, automatica, calificar, scope, onCambio }: {
  arg: ArgMetadata;
  valor: unknown;
  efectivo: unknown;
  modo: string;
  automatica: boolean;
  calificar: (ref: string) => string;
  scope: "active" | "consolidated";
  onCambio: (v: unknown) => void;
}) {
  const id = useId();
  const idAyuda = `${id}-ayuda`;
  const ayuda = a.descripcion ? <span id={idAyuda} className="pulso-f6-dato-ayuda">{a.descripcion}</span> : null;
  const describe = a.descripcion ? idAyuda : undefined;
  switch (a.tipo_input) {
    case "choice": {
      const opciones = a.choices ?? [];
      return (
        <div className="pulso-f6-dato is-apilado" data-campo={a.name}>
          <label className="pulso-f6-dato-rotulo" htmlFor={id}>{a.label}</label>
          <select id={id} className="pulso-f6-input" value={String(efectivo ?? "")} aria-describedby={describe}
            onChange={(e) => onCambio(e.target.value)}>
            {opciones.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {ayuda}
        </div>
      );
    }
    case "number":
      return (
        <div className="pulso-f6-dato" data-campo={a.name}>
          <label className="pulso-f6-dato-rotulo" htmlFor={id}>{a.label}</label>
          <NumeroAcotado id={id} rotulo={a.label} arg={a} valor={valor ?? a.default} describe={describe}
            placeholder={typeof a.default === "number" ? String(a.default) : ""} onCambio={onCambio} />
          {ayuda}
        </div>
      );
    case "bool":
      return (
        <div className="pulso-f6-dato" data-campo={a.name}>
          <span className="pulso-f6-dato-rotulo" id={`${id}-rotulo`}>{a.label}</span>
          <Switch checked={efectivo !== false} ariaLabel={a.label} onToggle={() => onCambio(efectivo === false)} />
          {ayuda}
        </div>
      );
    case "variables_list":
      return (
        <div className="pulso-f6-dato is-apilado" data-campo={a.name}>
          <span className="pulso-f6-dato-rotulo">{a.label}</span>
          <div className="pulso-f6-dato-control" role="group" aria-label={a.label}>
            <ListaPreguntas valor={valor} describe={describe} onCambio={(v) => onCambio(Array.isArray(v) && v.length ? v : null)} />
          </div>
          {ayuda}
        </div>
      );
    case "hallazgos_capitulos":
      return (
        <div className="pulso-f6-dato is-apilado" data-campo={a.name}>
          <CapitulosHallazgos valor={valor} modo={modo} automatica={automatica} calificar={calificar} scope={scope}
            onCambio={onCambio} />
        </div>
      );
    default:
      return null;
  }
}
