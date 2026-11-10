// La acción de entrega de una fila de tabla en Material de campo (ADR 0133,
// fase 5; forma «fila» del censo de descargas). El disparador queda en su
// celda y sólo se deshabilita mientras se genera; debajo, en la misma celda,
// el contenedor del kit con su línea, el archivo y Abrir / Mostrar en la
// carpeta, o la causa del fallo con Reintentar.

import type { ReactNode } from "react";

import { ContenedorEntregable } from "../../../components/entregables/ContenedorEntregable";
import type { Articulo } from "../../../components/entregables/generacionModelo";
import { useGeneracion, type DescribirError } from "../../../components/entregables/useGeneracion";
import { PulsoButton } from "../../../components/PulsoButton";
import { MODULO_MATERIAL } from "./modeloEntrega";
import "../styles/entregas.css";

type Props = {
  /** Nombre del entregable mientras se genera y en el fallo. */
  titulo: string;
  formato?: string | null;
  articulo?: Articulo | null;
  generar: () => Promise<unknown>;
  ariaLabel: string;
  disabled?: boolean;
  title?: string;
  /** `icon`: sólo ícono (la lista de material generado); si no, botón de texto ghost. */
  icono?: boolean;
  describirError?: DescribirError;
  children: ReactNode;
};

export function GenerarEnFila({ titulo, formato = null, articulo = null, generar, ariaLabel, disabled = false, title, icono = false, describirError, children }: Props) {
  const gen = useGeneracion({ titulo, modulo: MODULO_MATERIAL, formato, articulo, describirError });
  const enCurso = gen.estado.fase === "en_curso";
  const alPulsar = () => { void gen.ejecutar(generar); };
  return (
    <div className="rec-entrega-celda">
      {icono ? (
        <PulsoButton variant="icon" size="sm" aria-label={ariaLabel} title={title ?? ariaLabel} disabled={disabled || enCurso} onClick={alPulsar}>
          {children}
        </PulsoButton>
      ) : (
        <PulsoButton variant="ghost" size="sm" aria-label={ariaLabel} title={title} disabled={disabled || enCurso} onClick={alPulsar}>
          {children}
        </PulsoButton>
      )}
      <ContenedorEntregable estado={gen.estado} forma="fila" onCerrar={gen.cerrar} />
    </div>
  );
}
