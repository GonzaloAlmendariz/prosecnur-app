/**
 * Las opciones de una pregunta de opción múltiple que participan en la regla:
 * con su lista, interruptores; sin ella, los códigos separados por coma. Era
 * `OptionCodesField` de `components/ReglaEditor.tsx`.
 */
import { useState } from "react";
import { PulsoInput } from "../../../../components/PulsoInput";
import { listText, parseListText } from "../modeloRegla";
import { ListaDeOpciones } from "./ListaDeOpciones";
import { useOpcionesDeVariable } from "./opcionesDeVariable";

export function CampoOpciones({
  variable,
  valor,
  onCambio,
  ariaLabel,
}: {
  variable: string | undefined;
  valor: string[];
  onCambio: (valor: string[]) => void;
  ariaLabel: string;
}) {
  const { options, loading } = useOpcionesDeVariable(variable);
  const [texto, setTexto] = useState(valor.join(", "));
  const clave = listText(valor);
  const [visto, setVisto] = useState(clave);
  if (visto !== clave) {
    setVisto(clave);
    if (listText(parseListText(texto)) !== clave) setTexto(valor.join(", "));
  }
  if (options.length > 0) {
    return <ListaDeOpciones opciones={options} valor={valor} onCambio={onCambio} ariaLabel={ariaLabel} />;
  }
  return (
    <PulsoInput
      value={texto}
      placeholder={loading ? "Cargando opciones" : "Códigos separados por coma"}
      aria-label={ariaLabel}
      onChange={(e) => {
        setTexto(e.target.value);
        onCambio(parseListText(e.target.value));
      }}
    />
  );
}
