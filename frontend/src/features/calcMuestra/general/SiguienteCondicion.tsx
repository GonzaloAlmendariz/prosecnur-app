import { ArrowRight, CheckCircle2, CircleDot, TriangleAlert, type LucideIcon } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

import { useValorSwap } from "../universidad/ui/useValorSwap";
import type { EstadoMesa, TonoEstadoMesa } from "./bandaDisenoModelo";
import { enlaceSiguiente, searchConSeccionYPestana } from "./modeloPestanas";
import type { ModoMesa } from "./secciones";
import "../universidad/ui/ui.css";
import "./mesa.css";
import "./movimiento.css";

const ICONO: Record<TonoEstadoMesa, LucideIcon> = {
  ok: CheckCircle2,
  alerta: TriangleAlert,
  pendiente: CircleDot,
};

/**
 * Estado de la mesa y la siguiente condición: qué falta (declarar el marco,
 * calcular, sortear) y dónde se resuelve. El texto vive en una región
 * `status`: cambiar de estado se anuncia sin robar el foco.
 *
 * Nunca ejecuta (E15 · P4): Calcular vive en Método › Parámetros y Sortear en
 * Selección › Sorteo, como en aulas cada pestaña tiene su acción. Lo que hay
 * aquí es un ENLACE a la dirección de esa pestaña; si ya se está en ella, no
 * se pinta.
 */
export function SiguienteCondicion({
  modo,
  estado,
  seccion,
  pestana = null,
}: {
  modo: ModoMesa;
  estado: EstadoMesa;
  seccion: string;
  pestana?: string | null;
}) {
  const location = useLocation();
  const enlace = enlaceSiguiente(modo, estado.accion, { seccion, pestana });
  const Icono = ICONO[estado.tono];
  // El chip cruza texto y tono cuando la mesa cambia de estado (E16 · M7);
  // mientras lee, no hay estado del que cruzar (AD5-E15).
  const cambiando = useValorSwap(estado.clave === "leyendo" ? null : estado.etiqueta);

  return (
    <div className="cmg-siguiente" data-tono={estado.tono}>
      <p className="cmg-siguiente-estado" role="status">
        <span className="cmg-estado-chip cmv2-uni-swap" data-tono={estado.tono} data-cambiando={cambiando || undefined}>
          <Icono size={13} aria-hidden="true" />
          {estado.etiqueta}
        </span>
        {estado.siguiente && (
          <span className="cmg-siguiente-texto" title={estado.siguiente}>
            {estado.tono !== "ok" && <span className="cmg-siguiente-rotulo">Siguiente</span>}
            {/* En compacto se recorta a una línea: el texto entero sigue en el
                DOM (lo lee el lector de pantalla) y en `title` (C4). */}
            <span className="cmg-siguiente-valor">{estado.siguiente}</span>
          </span>
        )}
      </p>
      {enlace && (
        <Link
          className="cmv2-ghost cmg-siguiente-accion"
          to={`${location.pathname}${searchConSeccionYPestana(location.search, enlace.seccion, enlace.pestana)}`}
        >
          {enlace.etiqueta}
          <ArrowRight size={14} aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}
