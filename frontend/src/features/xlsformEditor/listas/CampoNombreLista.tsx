import { useId } from "react";

/** Campo de nombre de lista con validación en vivo. */
export function CampoNombreLista({
  valor,
  error,
  etiqueta,
  onChange,
  onEnter,
  onEscape,
  reservarError = false,
  autoFocus = false,
}: {
  valor: string;
  error: string | null;
  etiqueta: string;
  onChange: (valor: string) => void;
  onEnter?: () => void;
  /** Reserva la línea del error aunque no haya error: el alto no salta (C2). */
  reservarError?: boolean;
  /** Escape cancela la edición sin cerrar el diálogo que la contiene. */
  onEscape?: () => void;
  autoFocus?: boolean;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div className="pulso-xf-listas-campo">
      <label htmlFor={id}>{etiqueta}</label>
      <input
        id={id}
        type="text"
        value={valor}
        spellCheck={false}
        autoComplete="off"
        autoFocus={autoFocus}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && onEnter) {
            event.preventDefault();
            onEnter();
          } else if (event.key === "Escape" && onEscape) {
            event.preventDefault();
            event.stopPropagation();
            onEscape();
          }
        }}
      />
      {error || reservarError ? (
        <p
          id={error ? errorId : undefined}
          className="pulso-xf-listas-error"
          role={error ? "alert" : undefined}
          title={error ?? undefined}
        >
          {error ?? ""}
        </p>
      ) : null}
    </div>
  );
}
