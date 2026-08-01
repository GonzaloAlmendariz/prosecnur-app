/**
 * Métrica con procedencia integrada: cifra grande + badge de origen
 * (motor R validado / vista previa) + tono semántico opcional. Estandariza
 * los tiles numéricos del desk para que ningún número aparezca sin origen.
 */
import { BadgeMotor } from "../../didactica/PasoDidactico";
import { useValorSwap } from "./useValorSwap";
import "./ui.css";

export function CifraMotor({
  label,
  value,
  detalle,
  origen,
  hero,
  tono,
  monospace,
}: {
  label: string;
  value: string;
  detalle?: string;
  /** Omitir para cifras descriptivas (conteos de UI) que no requieren badge. */
  origen?: "motor" | "preview";
  hero?: boolean;
  tono?: "ok" | "alerta";
  monospace?: boolean;
}) {
  const cambiando = useValorSwap(value);
  return (
    <div
      className="cmv2-uni-cifra"
      data-hero={hero || undefined}
      data-tono={tono}
      data-monospace={monospace || undefined}
    >
      <span className="cmv2-uni-cifra-label">{label}</span>
      <span className="cmv2-uni-cifra-valor cmv2-uni-swap" data-cambiando={cambiando || undefined}>
        {value}
      </span>
      {(detalle || origen) && (
        <span className="cmv2-uni-cifra-detalle">
          {detalle}
          {detalle && origen ? " · " : ""}
          {origen && <BadgeMotor estado={origen === "motor" ? "validado" : "preview"} />}
        </span>
      )}
    </div>
  );
}

/** Fila responsiva de CifraMotor. */
export function CifraFila({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="cmv2-uni-cifra-fila"
      data-qa-geometry-group="calc-muestra/cifra-fila"
      data-qa-geometry-contract="equal"
    >
      {children}
    </div>
  );
}
