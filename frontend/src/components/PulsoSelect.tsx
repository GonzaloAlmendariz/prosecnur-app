import { useRef, useState, type CSSProperties, type ReactNode } from "react";
import * as Select from "@radix-ui/react-select";
import { Check, ChevronDown } from "../vendor/lucide-react";
import { joinDescribedBy, usePulsoFieldControl } from "./PulsoField";
import "./kit-inputs.css";

export type PulsoSelectSize = "md" | "sm";

export type PulsoSelectOption = {
  /** Valor no vacío: Radix reserva la cadena vacía para «sin selección». */
  value: string;
  label: ReactNode;
  /** Texto para la búsqueda por tecleo cuando `label` no es texto plano. */
  textValue?: string;
  disabled?: boolean;
};

export type PulsoSelectProps = {
  value: string | undefined;
  onValueChange: (value: string) => void;
  options: PulsoSelectOption[];
  placeholder?: ReactNode;
  /** `md` = 36 px · `sm` = 30 px. */
  size?: PulsoSelectSize;
  disabled?: boolean;
  invalid?: boolean;
  id?: string;
  name?: string;
  /** Nombre accesible si el select no vive dentro de un `PulsoField`. */
  ariaLabel?: string;
  className?: string;
  /** Ids extra de `aria-describedby`. */
  describedBy?: string;
};

/** Variables del acento de módulo que el portal pierde al salir del árbol. */
export const MODULE_ACCENT_VARS = [
  "--module-accent",
  "--module-accent-soft",
  "--module-accent-border",
] as const;

/**
 * Copia el acento del módulo que ve el disparador para inyectarlo en el
 * contenido del portal: el portal cuelga de `document.body`, fuera del frame
 * que declara `--module-accent`, y sin esto el menú saldría con el azul base.
 */
export function moduleAccentStyle(read: (name: string) => string): CSSProperties {
  const style: Record<string, string> = {};
  for (const name of MODULE_ACCENT_VARS) {
    const value = read(name).trim();
    if (value) style[name] = value;
  }
  return style as CSSProperties;
}

/**
 * **El select del kit** (L26), sobre `@radix-ui/react-select`: teclado
 * (flechas, Home/End, Enter/Espacio), búsqueda por tecleo y portal que hereda
 * el acento del módulo. Mismas alturas, radio y foco que `PulsoInput`.
 * Dentro de un `PulsoField` toma el id del label y su `aria-describedby`.
 */
export function PulsoSelect({
  value,
  onValueChange,
  options,
  placeholder,
  size = "md",
  disabled = false,
  invalid = false,
  id,
  name,
  ariaLabel,
  className,
  describedBy,
}: PulsoSelectProps) {
  const field = usePulsoFieldControl();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [accent, setAccent] = useState<CSSProperties>({});
  const isInvalid = invalid || Boolean(field?.invalid);
  const selected = options.find((option) => option.value === value);

  function handleOpenChange(open: boolean) {
    if (!open || !triggerRef.current || typeof window === "undefined") return;
    const computed = window.getComputedStyle(triggerRef.current);
    setAccent(moduleAccentStyle((varName) => computed.getPropertyValue(varName)));
  }

  return (
    <Select.Root
      value={value}
      onValueChange={onValueChange}
      onOpenChange={handleOpenChange}
      disabled={disabled}
      name={name}
    >
      <Select.Trigger
        ref={triggerRef}
        id={id ?? field?.controlId}
        aria-label={ariaLabel}
        aria-describedby={joinDescribedBy(field?.describedBy, describedBy)}
        aria-invalid={isInvalid ? true : undefined}
        className={[
          "pulso-select-trigger",
          size === "sm" ? "pulso-select-trigger--sm" : null,
          className,
        ].filter(Boolean).join(" ")}
      >
        {/* El texto elegido se pinta explícito: Radix lo copia del ítem recién
            montado el menú, y así el primer pintado ya muestra el valor. */}
        <Select.Value placeholder={placeholder}>
          {selected ? selected.label : undefined}
        </Select.Value>
        <Select.Icon className="pulso-select-icon">
          <ChevronDown size={size === "sm" ? 14 : 15} aria-hidden="true" />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          className="pulso-select-content"
          position="popper"
          sideOffset={4}
          style={accent}
        >
          <Select.Viewport className="pulso-select-viewport">
            {options.map((option) => (
              <Select.Item
                key={option.value}
                value={option.value}
                disabled={option.disabled}
                textValue={option.textValue}
                className="pulso-select-item"
              >
                <Select.ItemText>{option.label}</Select.ItemText>
                <Select.ItemIndicator className="pulso-select-item-indicator">
                  <Check size={13} aria-hidden="true" />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
