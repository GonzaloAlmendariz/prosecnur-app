import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { X } from "../vendor/lucide-react";
import { PulsoButton } from "./PulsoButton";
import "./kit-chip-seleccion.css";

export type ChipSeleccionProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "onClick" | "aria-pressed" | "children" | "type" | "disabled" | "className" | "title" | "onChange"
> & {
  /** Texto del chip; si no cabe se corta con elipsis (y va completo en `title`). */
  etiqueta: string;
  /** Estado de selección; sale como `aria-pressed`. */
  activo: boolean;
  /** Se llama con el estado siguiente al pulsar el chip. */
  onAlternar: (siguiente: boolean) => void;
  /** Si se pasa, el chip lleva una X de quitar (botón quieto de 14). */
  onQuitar?: () => void;
  /** Nombre accesible de la X. Por defecto «Quitar <etiqueta>». */
  etiquetaQuitar?: string;
  /** Ícono opcional antes del texto (14 px del shim; se marca `aria-hidden`). */
  icono?: ReactNode;
  /**
   * W3 — cola del chip: la cifra o el n de la categoría («62%», «412»), en el tono suave, tras el texto. Forma parte
   * del nombre accesible («Sí 62%»).
   */
  cifra?: ReactNode;
  /** La cifra es la ANTERIOR mientras llega la nueva: va en el tono tenue de «anterior». */
  cifraAnterior?: boolean;
  /** `data-qa` del tramo de la cifra (para el QA y los tests de quien la monta). */
  cifraQa?: string;
  /**
   * W3 — chip de EXCLUIR: activo, el chip no se tiñe con el acento sino que se apaga (surface-3) y su texto se tacha;
   * lo marcado es lo que sale.
   */
  excluye?: boolean;
  /** W3 — categoría residual (No sabe, Otro, una pregunta que ya no se lee): borde discontinuo. */
  residual?: boolean;
  /**
   * W3 — bloqueado: no se puede alternar (el último que queda, uno que ya usa otra fila) pero SIGUE ENFOCABLE y se
   * lee: sale como `aria-disabled="true"`, no como `disabled`, y pulsarlo no llama a `onAlternar`. El porqué va en
   * `title`.
   */
  bloqueado?: boolean;
  /** W3 — el rótulo parte línea en lugar de cortarse con elipsis (rótulos largos de categorías; C4). */
  envuelve?: boolean;
  disabled?: boolean;
  /** Tooltip; por defecto la etiqueta. */
  title?: string;
  className?: string;
};

/**
 * **Chip de selección múltiple** (Excluir, Destacar…; contrato A del acabado de
 * Láminas). Botón conmutador con `aria-pressed`: 28 px de alto, radio
 * `--pulso-radius-chip`, y en activo el tinte del módulo
 * (`--module-accent-soft` + `--module-accent-border`). La X opcional es un
 * botón hermano (nunca anidado) PulsoButton `icon` `tone="quiet"`
 * `intent="remove"` con ícono de 14.
 *
 * W3: cola con la cifra o el n (`cifra`, con su tono de «anterior»), chip de
 * excluir (`excluye`: tachado y apagado), residual (`residual`: borde
 * discontinuo), bloqueado pero enfocable (`bloqueado`: `aria-disabled`) y
 * rótulo que parte línea (`envuelve`).
 *
 * Para elegir UN valor entre varios no es esto: es `GlidingRadioGroup`.
 * **Escape no es asunto del chip**: no abre ni cierra nada.
 *
 * El contenedor de varios chips los pone en `flex-wrap` con gap `--pulso-space-1`
 * y sin reservar alto vacío (contrato C5).
 */
export const ChipSeleccion = forwardRef<HTMLButtonElement, ChipSeleccionProps>(function ChipSeleccion(
  {
    etiqueta,
    activo,
    onAlternar,
    onQuitar,
    etiquetaQuitar,
    icono,
    cifra,
    cifraAnterior = false,
    cifraQa,
    excluye = false,
    residual = false,
    bloqueado = false,
    envuelve = false,
    disabled = false,
    title,
    className,
    ...rest
  },
  ref,
) {
  const hayCifra = cifra !== undefined && cifra !== null && cifra !== false;
  return (
    <span
      className={[
        "pulso-chip-seleccion",
        activo ? "is-activo" : null,
        disabled ? "is-deshabilitado" : null,
        bloqueado ? "is-bloqueado" : null,
        excluye ? "pulso-chip-seleccion--excluye" : null,
        residual ? "pulso-chip-seleccion--residual" : null,
        envuelve ? "pulso-chip-seleccion--envuelve" : null,
        onQuitar ? "pulso-chip-seleccion--con-quitar" : null,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <button
        {...rest}
        ref={ref}
        type="button"
        className="pulso-chip-seleccion__alternar"
        aria-pressed={activo}
        aria-disabled={bloqueado || undefined}
        disabled={disabled}
        title={title ?? etiqueta}
        onClick={() => {
          if (!bloqueado) onAlternar(!activo);
        }}
      >
        {icono ? (
          <span className="pulso-chip-seleccion__icono" aria-hidden="true">
            {icono}
          </span>
        ) : null}
        <span className="pulso-chip-seleccion__texto">{etiqueta}</span>
        {hayCifra ? (
          <>
            {" "}
            <span
              className={["pulso-chip-seleccion__cifra", cifraAnterior ? "is-anterior" : null].filter(Boolean).join(" ")}
              data-qa={cifraQa}
            >
              {cifra}
            </span>
          </>
        ) : null}
      </button>
      {onQuitar ? (
        <PulsoButton
          variant="icon"
          tone="quiet"
          intent="remove"
          size="sm"
          className="pulso-chip-seleccion__quitar"
          aria-label={etiquetaQuitar ?? `Quitar ${etiqueta}`}
          disabled={disabled}
          onClick={onQuitar}
        >
          <X aria-hidden="true" focusable="false" />
        </PulsoButton>
      ) : null}
    </span>
  );
});
