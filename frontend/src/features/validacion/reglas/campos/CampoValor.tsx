/**
 * El valor de una condición: la opción (o las opciones) de una pregunta con
 * lista, un número, una fecha o un texto, según la pregunta y el operador.
 * Con `comparar`, el botón "Comparar con otra pregunta" cambia el valor por
 * otra pregunta del formulario (contrato M1).
 *
 * Era `GateValueControl` de `components/ReglaEditor.tsx`, con los controles
 * del kit en lugar de los nativos.
 */
import { useState } from "react";
import { PulsoButton } from "../../../../components/PulsoButton";
import { PulsoInput } from "../../../../components/PulsoInput";
import { PulsoSelect } from "../../../../components/PulsoSelect";
import { GitCompare } from "../../../../vendor/lucide-react";
import type { ExploradorVariable } from "../../types";
import { esOperadorSinValor, isListOperator, listText, paramList, parseListText } from "../modeloRegla";
import type { OperadorDeCondicion } from "../tiposDelMotor";
import { CampoPregunta } from "./CampoPregunta";
import { ListaDeOpciones } from "./ListaDeOpciones";
import { etiquetaDeOpcion, useOpcionesDeVariable } from "./opcionesDeVariable";
import { tieneOpciones } from "./tipoDeFicha";

export type Comparacion = {
  /** La otra pregunta, si la condición compara con ella. */
  comparada: string;
  /** Las preguntas con que se puede comparar. */
  variables: readonly ExploradorVariable[];
  onComparada: (variable: string) => void;
  /** Encender o apagar la comparación. */
  onAlternar: (encender: boolean) => void;
  /** Sin la comparación disponible para este operador, el botón se ve deshabilitado con su causa. */
  causaSinComparar?: string;
};

function ValorEnTexto({
  valor,
  esLista,
  tipo,
  ariaLabel,
  onCambio,
  cargando,
}: {
  valor: unknown;
  esLista: boolean;
  tipo: ExploradorVariable["tipo"] | undefined;
  ariaLabel: string;
  onCambio: (valor: string | string[]) => void;
  cargando: boolean;
}) {
  // Una lista se escribe separada por comas: el texto se guarda tal cual se
  // teclea y solo se interpreta al cambiar, para poder escribir la coma.
  const externo = esLista ? paramList(valor).join(", ") : typeof valor === "string" ? valor : paramList(valor)[0] ?? "";
  const [texto, setTexto] = useState(externo);
  // Si lo de afuera cambió por otra vía (otra pregunta, otro operador), manda
  // lo de afuera; si cambió porque se tecleó, se respeta lo tecleado.
  const [visto, setVisto] = useState(externo);
  if (externo !== visto) {
    setVisto(externo);
    const mismo = esLista ? listText(parseListText(texto)) === listText(valor) : texto === externo;
    if (!mismo) setTexto(externo);
  }
  return (
    <PulsoInput
      size="md"
      type={!esLista && tipo === "fecha" ? "date" : !esLista && tipo === "num" ? "number" : "text"}
      value={texto}
      placeholder={cargando ? "Cargando opciones" : esLista ? "Valores separados por coma" : "Valor"}
      aria-label={ariaLabel}
      onChange={(e) => {
        setTexto(e.target.value);
        onCambio(esLista ? parseListText(e.target.value) : e.target.value);
      }}
    />
  );
}

export function CampoValor({
  variable,
  op,
  valor,
  onCambio,
  ariaLabel,
  comparar,
}: {
  variable: ExploradorVariable | undefined;
  op: OperadorDeCondicion | "";
  valor: unknown;
  onCambio: (valor: string | string[]) => void;
  ariaLabel: string;
  comparar?: Comparacion;
}) {
  const conLista = tieneOpciones(variable?.tipo);
  const { options, loading } = useOpcionesDeVariable(conLista ? variable?.name : null);
  const esLista = op ? isListOperator(op) : false;
  const comparando = !!comparar?.comparada;
  // "Está vacía" y "tiene respuesta" no comparan con nada: no hay valor que pedir.
  if (!comparando && esOperadorSinValor(op)) return null;

  let control;
  if (comparando && comparar) {
    control = (
      <CampoPregunta
        variables={comparar.variables}
        valor={comparar.comparada}
        onCambio={comparar.onComparada}
        ariaLabel={`${ariaLabel}: otra pregunta`}
        comparada
      />
    );
  } else if (conLista && options.length > 0 && esLista) {
    control = <ListaDeOpciones opciones={options} valor={paramList(valor)} onCambio={onCambio} compacta ariaLabel={ariaLabel} />;
  } else if (conLista && options.length > 0) {
    const actual = typeof valor === "string" ? valor : paramList(valor)[0] ?? "";
    control = (
      <PulsoSelect
        value={actual}
        onValueChange={onCambio}
        placeholder="Elegir opción"
        ariaLabel={ariaLabel}
        options={options.map((o) => ({ value: o.code, label: etiquetaDeOpcion(o, o.code), textValue: `${o.code} ${o.label}` }))}
      />
    );
  } else {
    control = (
      <ValorEnTexto valor={valor} esLista={esLista} tipo={variable?.tipo} ariaLabel={ariaLabel} onCambio={onCambio} cargando={loading} />
    );
  }

  // Una lista de opciones no cabe en la celda del valor: baja a su propia línea.
  const conListaDeOpciones = !comparando && conLista && options.length > 0 && esLista;
  if (!comparar) return <div className="pulso-regla-valor" data-lista={conListaDeOpciones ? "" : undefined}>{control}</div>;
  const deshabilitado = !comparando && !!comparar.causaSinComparar;
  return (
    <div className="pulso-regla-valor" data-con-comparar="" data-lista={conListaDeOpciones ? "" : undefined}>
      {control}
      <PulsoButton
        variant="icon"
        size="sm"
        className="pulso-regla-comparar"
        aria-label="Comparar con otra pregunta"
        aria-pressed={comparando}
        title={deshabilitado ? comparar.causaSinComparar : "Comparar con otra pregunta"}
        disabled={deshabilitado}
        onClick={() => comparar.onAlternar(!comparando)}
      >
        <GitCompare size={14} aria-hidden="true" />
      </PulsoButton>
    </div>
  );
}
