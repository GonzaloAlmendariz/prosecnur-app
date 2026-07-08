/**
 * Término estadístico inline: chip subrayado → popover con la definición llana,
 * la técnica y, si se pasa, el valor vivo del motor. Cada término del glosario
 * se explica UNA vez en la pestaña donde se decide; el resto de menciones usan
 * este chip para referenciarlo sin repetir texto.
 */
import type { ReactNode } from "react";
import { Popover } from "../../../../components/Popover";
import { GLOSARIO } from "../../didactica/referencia/corpus";
import "./ui.css";

export function TerminoChip({
  termino,
  valor,
  children,
  triggerClassName = "cmv2-uni-term",
}: {
  /** Prefijo del término en el GLOSARIO del corpus (ej. "deff", "salto k"). */
  termino: string;
  /** Valor vivo del motor para mostrar junto a la definición (ej. "deff = 2"). */
  valor?: string;
  children?: ReactNode;
  /** Clase del trigger; por defecto el chip subrayado inline. */
  triggerClassName?: string;
}) {
  const entry = GLOSARIO.find((g) => g.termino.toLowerCase().startsWith(termino.toLowerCase()));
  if (!entry) return <>{children ?? termino}</>;
  return (
    <Popover
      openOn="hover"
      ariaLabel={entry.termino}
      trigger={
        <button type="button" className={triggerClassName}>
          {children ?? termino}
        </button>
      }
    >
      <div className="cmv2-uni-term-pop">
        <strong>{entry.termino}</strong>
        <p>{entry.llano}</p>
        <p className="cmv2-uni-term-tec">{entry.tecnico}</p>
        {valor && (
          <span className="cmv2-uni-term-valor">
            en este estudio: <strong>{valor}</strong>
          </span>
        )}
      </div>
    </Popover>
  );
}
