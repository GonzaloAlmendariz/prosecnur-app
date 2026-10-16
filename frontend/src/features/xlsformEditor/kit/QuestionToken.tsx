import { TypeIcon } from "./TypeIcon";
import "./kit.css";

// Referencia a una pregunta dentro de una regla o fórmula: ícono del tipo + número + texto corto.
// Reemplaza al `${variable}` crudo en todo lo que lee una persona; el nombre XLSForm va en el title.

export type QuestionTokenProps = {
  baseType: string;
  label: string;
  hint?: string;
  variable?: string;
  selected?: boolean;
};

export function QuestionToken({ baseType, label, hint, variable, selected }: QuestionTokenProps) {
  return (
    <span className={selected ? "xfk-tok is-on" : "xfk-tok"} title={variable ? "$" + "{" + variable + "}" : undefined}>
      <TypeIcon baseType={baseType} size={12} />
      <b>{label}</b>
      {hint ? <i>{hint}</i> : null}
    </span>
  );
}
