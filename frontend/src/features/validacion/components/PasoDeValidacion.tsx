import { useId, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { EstadoChip } from "../../../components/EstadoChip";
import { Panel } from "../../../components/Panel";
import { formatoConteo } from "../../../lib/formatoNumero";

/**
 * Un paso de Reglas del formulario (Plan, Auditoría, Resultados) como `Panel` del kit (P2 de la pasada
 * de formato, 4 nov 2026; revisable por Gonzalo). El número de paso va de antetítulo porque la
 * secuencia es información; el estado, como `EstadoChip`. Reemplaza a `StepHeader`, que dibujaba un
 * círculo con el número, el título en negrita y una píldora monoespaciada con el conteo.
 */
export function PasoDeValidacion({
  paso,
  de,
  titulo,
  detalle,
  listo,
  conteo,
  rotuloConteo,
  className,
  children,
  ...rest
}: {
  paso: number;
  de: number;
  titulo: string;
  detalle?: ReactNode;
  listo: boolean;
  conteo?: number | null;
  rotuloConteo?: string;
  className?: string;
  children: ReactNode;
} & Omit<ComponentPropsWithoutRef<"section">, "title" | "className" | "children">) {
  const id = useId();
  const estado = listo
    ? conteo != null && rotuloConteo
      ? `${formatoConteo(conteo)} ${rotuloConteo}`
      : "Listo"
    : "Pendiente";
  return (
    <Panel
      {...rest}
      className={["pulso-validacion-paso", className].filter(Boolean).join(" ")}
      eyebrow={`Paso ${paso} de ${de}`}
      aria-labelledby={id}
      title={<span id={id}>{titulo}</span>}
      hint={detalle}
      actions={<EstadoChip tone={listo ? "success" : "neutral"} label={estado} />}
    >
      {children}
    </Panel>
  );
}
