import {
  createContext,
  useContext,
  useId,
  type ReactNode,
} from "react";
import { CircleAlert } from "../vendor/lucide-react";
import "./kit-inputs.css";

/**
 * Lo que un `PulsoField` le pasa a su control: el id al que apunta el label,
 * el id de la línea de ayuda o de error y si el campo está en error.
 */
export type PulsoFieldControl = {
  controlId: string;
  describedBy?: string;
  invalid: boolean;
};

const PulsoFieldContext = createContext<PulsoFieldControl | null>(null);

/**
 * Para los controles del kit (`PulsoInput`, `PulsoSelect`, `PulsoSwitch`):
 * devuelve la conexión con el campo que los envuelve, o `null` si van sueltos.
 */
export function usePulsoFieldControl(): PulsoFieldControl | null {
  return useContext(PulsoFieldContext);
}

/** Une ids de `aria-describedby` sin dejar huecos ni duplicados. */
export function joinDescribedBy(...ids: Array<string | undefined | null | false>): string | undefined {
  const unique = Array.from(new Set(ids.filter((id): id is string => Boolean(id))));
  return unique.length ? unique.join(" ") : undefined;
}

export type PulsoFieldProps = {
  /** Rótulo visible del campo. */
  label: ReactNode;
  /** Texto chico junto al rótulo («opcional», «12 de 12»). */
  labelDetail?: ReactNode;
  /** Ayuda bajo el control. Desaparece cuando hay `error`. */
  hint?: ReactNode;
  /** Error bajo el control: REEMPLAZA al hint y marca el control `aria-invalid`. */
  error?: ReactNode;
  /**
   * `group` para campos cuyo control es un conjunto (switch-chips, lista de
   * switches): el rótulo nombra el grupo con `aria-labelledby` en vez de
   * apuntar con `for` a un único control.
   */
  group?: boolean;
  /** Rótulo, control y ayuda en una sola fila. */
  inline?: boolean;
  /** Id del control; si falta se genera. */
  id?: string;
  /**
   * C1: marca el campo como miembro explícito (`data-qa-geometry-member`) del
   * grupo geométrico que lo contiene, cuando el campo no es hijo directo del
   * grupo. Dos `PulsoField` hermanos van SIEMPRE dentro de un
   * `PulsoFieldRow`, que declara el grupo (lo vigila `inputsDelKit`).
   */
  geometryMember?: boolean;
  className?: string;
  children: ReactNode;
};

/**
 * **El campo del kit**: label + control + hint + error (L26, spec §5.2).
 *
 * - El label se asocia por id (`htmlFor`) con el control hijo, que lee el id
 *   desde contexto: no hay que repetirlo a mano.
 * - El error REEMPLAZA al hint, nunca se apilan; el control apunta a la línea
 *   visible con `aria-describedby` y queda `aria-invalid`.
 * - Con `group` el rótulo nombra al conjunto (`role="group"`).
 */
export function PulsoField({
  label,
  labelDetail,
  hint,
  error,
  group = false,
  inline = false,
  id,
  className,
  geometryMember = false,
  children,
}: PulsoFieldProps) {
  const autoId = useId();
  const controlId = id ?? `pulso-field-${autoId}`;
  const labelId = `${controlId}-label`;
  const messageId = `${controlId}-message`;
  const hasError = error !== undefined && error !== null && error !== false && error !== "";
  const hasHint = !hasError && hint !== undefined && hint !== null && hint !== false && hint !== "";
  const describedBy = hasError || hasHint ? messageId : undefined;

  const classes = [
    "pulso-field",
    hasError ? "is-error" : null,
    inline ? "is-inline" : null,
    className,
  ].filter(Boolean).join(" ");
  const memberAttr = geometryMember ? { "data-qa-geometry-member": "" } : {};

  const labelContent = (
    <>
      {label}
      {labelDetail ? <small>{labelDetail}</small> : null}
    </>
  );

  const message = hasError ? (
    <span id={messageId} className="pulso-field-error">
      <CircleAlert size={12} aria-hidden="true" />
      {error}
    </span>
  ) : hasHint ? (
    <span id={messageId} className="pulso-field-hint">
      {hint}
    </span>
  ) : null;

  return (
    // En modo grupo cada miembro tiene su propio nombre: no se reparte un id
    // único entre varios controles, la descripción va en el contenedor.
    <PulsoFieldContext.Provider value={group ? null : { controlId, describedBy, invalid: hasError }}>
      {group ? (
        <div
          className={classes}
          {...memberAttr}
          role="group"
          aria-labelledby={labelId}
          aria-describedby={describedBy}
        >
          <span id={labelId} className="pulso-field-label">{labelContent}</span>
          {children}
          {message}
        </div>
      ) : (
        <div className={classes} {...memberAttr}>
          <label id={labelId} htmlFor={controlId} className="pulso-field-label">{labelContent}</label>
          {children}
          {message}
        </div>
      )}
    </PulsoFieldContext.Provider>
  );
}

/**
 * Fila de campos (filtros, formularios densos): los `PulsoField` se alinean
 * por la base y envuelven a la línea siguiente cuando el ancho no alcanza.
 */
export function PulsoFieldRow({
  children,
  className,
  role,
  ariaLabel,
  geometryGroup,
}: {
  children: ReactNode;
  className?: string;
  /** p. ej. `search` para una barra de filtros; `group` para un rango. */
  role?: "search" | "group" | "toolbar";
  ariaLabel?: string;
  /**
   * C1 del Contrato de Superficie: nombre del grupo geométrico. Los campos de
   * una fila son hermanos de capacidad distinta (un buscador, un select, un
   * switch), así que el contrato es `intrinsic`.
   */
  geometryGroup: string;
}) {
  return (
    <div
      className={["pulso-field-row", className].filter(Boolean).join(" ")}
      role={role}
      aria-label={ariaLabel}
      data-qa-geometry-group={geometryGroup}
      data-qa-geometry-contract="intrinsic"
    >
      {children}
    </div>
  );
}
