// Una variable en la lista de Analítica › Datos (prototipo, fila de "Variables
// de la base"): si entra a los entregables, su código, la etiqueta que llevan
// los entregables, su tipo, con cuánto dato llegó y cuántas opciones tiene. Las
// etiquetas se editan en el inspector; la fila dice si alguna falta confirmar.

import type { DataReviewVariable } from "../../../api/analitica";
import { FichaPregunta } from "../../../components/procesamiento/FichaPregunta";
import { Switch } from "../../../components/Switch";
import { formatoConteo } from "../../../lib/formatoNumero";
import { describirCobertura } from "../coberturaVariable";
import { CodigoConCortes } from "./CodigoConCortes";
import { casosDeLaVariable, proporcionConDato, tipoDeVariable } from "./modeloDeVariables";

export type FilaDeVariableProps = {
  variable: DataReviewVariable;
  etiqueta: string;
  incluida: boolean;
  /** La sección está oculta: la variable no se puede incluir. */
  bloqueada: boolean;
  porConfirmar: boolean;
  /** Opciones con detalles de redacción. */
  detalles: number;
  /** Sus opciones llegan en columnas propias (una múltiple). */
  repartida: boolean;
  /** La base de "Con dato" cuando va en el encabezado; si no, la fila dice la suya. */
  baseComun: number | null;
  elegida: boolean;
  onIncluir: (name: string) => void;
  onElegir: (name: string) => void;
};

function ConDato({ variable, repartida, baseComun }: Pick<FilaDeVariableProps, "variable" | "repartida" | "baseComun">) {
  const cobertura = describirCobertura(variable, repartida);
  if (cobertura.estado === "expandida") return <span className="datos-con-dato-texto">En sus opciones</span>;
  if (cobertura.estado === "ausente") return <span className="datos-con-dato-texto" data-tono="aviso">No llegó en la base</span>;
  const casos = casosDeLaVariable(variable);
  const conDato = Math.max(0, variable.n_non_missing ?? 0);
  return (
    <span className="datos-con-dato" data-tono={cobertura.estado === "vacia" ? "aviso" : undefined} title={`${formatoConteo(conDato)} de ${formatoConteo(casos)} casos con dato`}>
      <span className="datos-barra" aria-hidden="true"><i style={{ inlineSize: `${proporcionConDato(variable)}%` }} /></span>
      <em>{formatoConteo(conDato)}{baseComun === null ? <small> de {formatoConteo(casos)}</small> : null}</em>
    </span>
  );
}

export function FilaDeVariable(props: FilaDeVariableProps) {
  const { variable, etiqueta, incluida, bloqueada, porConfirmar, detalles, elegida } = props;
  const tipo = tipoDeVariable(variable);
  const cobertura = describirCobertura(variable, props.repartida);
  const notas = [
    porConfirmar ? { clave: "confirmar", texto: "Etiqueta por confirmar", tono: "aviso" } : null,
    !etiqueta.trim() ? { clave: "vacia", texto: "Sin etiqueta", tono: "aviso" } : null,
    cobertura.estado === "vacia" ? { clave: "cobertura", texto: "Llegó sin ningún dato", tono: "aviso" } : null,
    detalles > 0 ? { clave: "detalles", texto: `${formatoConteo(detalles)} ${detalles === 1 ? "opción" : "opciones"} con detalles de redacción`, tono: "neutro" } : null,
  ].filter((n): n is { clave: string; texto: string; tono: string } => n !== null);
  const opciones = variable.opciones.length;

  return (
    <div
      role="row"
      className="datos-fila"
      data-elegida={elegida ? "" : undefined}
      data-fuera={incluida ? undefined : ""}
      onClick={() => props.onElegir(variable.name)}
    >
      <span role="cell" className="datos-celda-entra" onClick={(e) => e.stopPropagation()}>
        <Switch
          checked={incluida}
          disabled={bloqueada}
          ariaLabel={bloqueada ? `${variable.name}: su sección está oculta` : `Incluir ${variable.name} en los entregables`}
          className="analitica-interruptor"
          onToggle={() => props.onIncluir(variable.name)}
        />
      </span>
      <span role="cell" className="datos-celda-codigo">
        <button
          type="button"
          className="datos-codigo"
          aria-pressed={elegida}
          aria-label={`${variable.name}, ${etiqueta || "sin etiqueta"}: abrir sus etiquetas`}
          onClick={(e) => {
            e.stopPropagation();
            props.onElegir(variable.name);
          }}
        >
          <code><CodigoConCortes nombre={variable.name} /></code>
        </button>
      </span>
      <span role="cell" className="datos-celda-etiqueta">
        <b>{etiqueta || variable.name}</b>
        {notas.length > 0 ? (
          <span className="datos-notas">
            {notas.map((n) => <span key={n.clave} className="datos-nota" data-tono={n.tono}>{n.texto}</span>)}
          </span>
        ) : null}
      </span>
      <span role="cell" className="datos-celda-tipo">
        {tipo.tono
          ? <FichaPregunta tipo={tipo.tono} etiqueta={tipo.nombre} />
          : <span className="datos-tipo-neutro">{tipo.nombre}</span>}
      </span>
      <span role="cell" className="datos-celda-dato">
        <ConDato variable={variable} repartida={props.repartida} baseComun={props.baseComun} />
      </span>
      <span role="cell" className="datos-celda-opciones">{opciones > 0 ? formatoConteo(opciones) : ""}</span>
    </div>
  );
}
