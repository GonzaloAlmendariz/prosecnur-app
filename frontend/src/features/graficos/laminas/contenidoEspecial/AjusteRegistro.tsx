// Un ajuste de lámina con su control según el registro: lista de opciones, número acotado, interruptor o lista de
// preguntas. Lo comparten los bloques de ajustes de «Hallazgos clave» y «Resumen de diferencias»; los args con editor
// propio (capítulos, cruces con su nombre) los pinta cada bloque.

import { useId } from "react";
import type { ArgMetadata } from "../../../../api/graficos";
import { Switch } from "../../../../components/Switch";
import { ListaPreguntas } from "../ListaPreguntas";
import { NumeroAcotado } from "../NumeroAcotado";
import "../datosGrafico.css";

type Props = {
  arg: ArgMetadata;
  /** Lo escrito en la lámina. */
  valor: unknown;
  /** Lo que rige: lo escrito o el valor por defecto del registro. */
  efectivo: unknown;
  onCambio: (v: unknown) => void;
};

/** ¿AjusteRegistro sabe pintar este tipo? */
export const TIPOS_AJUSTE_REGISTRO: ReadonlySet<string> = new Set(["choice", "number", "bool", "variables_list"]);

export function AjusteRegistro({ arg: a, valor, efectivo, onCambio }: Props) {
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
    default:
      return null;
  }
}
