import { useId, type ChangeEvent, type SyntheticEvent } from "react";

import type { MailProblem } from "../../../api/materialMail";

type Props = {
  label: string;
  valor: string;
  onCambio: (valor: string) => void;
  /** Avisa dónde está el cursor, para insertar un `{{campo}}` ahí. */
  onCursor?: (cursor: number | null) => void;
  multilinea?: boolean;
  filas?: number;
  ayuda?: string;
  problemas?: readonly MailProblem[];
  placeholder?: string;
  maximo?: number;
  mono?: boolean;
};

/** Texto del correo: una caja con rótulo, su ayuda y los problemas del contrato. */
export function CampoDeTexto({
  label,
  valor,
  onCambio,
  onCursor,
  multilinea,
  filas = 4,
  ayuda,
  problemas,
  placeholder,
  maximo,
  mono,
}: Props) {
  const id = useId();
  const ayudaId = `${id}-ayuda`;
  const errorId = `${id}-error`;
  const conError = Boolean(problemas?.length);
  const cursor = (event: SyntheticEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    onCursor?.(event.currentTarget.selectionStart);
  };
  const props = {
    id,
    value: valor,
    placeholder,
    className: `rec-mail-input${mono ? " is-mono" : ""}${conError ? " is-error" : ""}`,
    "aria-invalid": conError || undefined,
    "aria-describedby": [ayuda || maximo ? ayudaId : "", conError ? errorId : ""].filter(Boolean).join(" ") || undefined,
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      onCambio(event.target.value);
      onCursor?.(event.target.selectionStart);
    },
    onFocus: cursor,
    onSelect: cursor,
    onKeyUp: cursor,
    onClick: cursor,
  };
  return (
    <div className="rec-mail-campo-texto">
      <label htmlFor={id} className="rec-mail-campo-rotulo">
        <span>{label}</span>
        {maximo ? (
          <span className={`rec-mail-contador${valor.length > maximo ? " is-excedido" : ""}`} id={ayudaId}>
            {valor.length.toLocaleString("es-PE")} / {maximo.toLocaleString("es-PE")}
          </span>
        ) : null}
      </label>
      {multilinea ? <textarea {...props} rows={filas} /> : <input {...props} type="text" />}
      {ayuda && !maximo ? <span className="rec-mail-ayuda" id={ayudaId}>{ayuda}</span> : null}
      {ayuda && maximo ? <span className="rec-mail-ayuda">{ayuda}</span> : null}
      {conError ? (
        <ul className="rec-mail-problemas" id={errorId}>
          {problemas!.map((p, i) => <li key={`${p.path}-${i}`}>{p.detail}</li>)}
        </ul>
      ) : null}
    </div>
  );
}
