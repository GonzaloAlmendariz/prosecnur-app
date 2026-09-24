import { ArrowRight, Calculator, CheckCircle2, CircleDot, Loader2, TriangleAlert, type LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";

import { useSeccion } from "../../../lib/navegacion/useDireccion";
import { accionVisible, type EstadoMesa, type TonoEstadoMesa } from "./bandaDisenoModelo";
import "./mesa.css";

const ICONO: Record<TonoEstadoMesa, LucideIcon> = {
  ok: CheckCircle2,
  alerta: TriangleAlert,
  pendiente: CircleDot,
};

/**
 * Estado de la mesa y la siguiente condición: qué falta (declarar el marco,
 * calcular, sortear) y el paso que lo resuelve. El texto vive en una región
 * `status`: cambiar de estado se anuncia sin robar el foco. Ir a otra sección
 * es navegación, así que es un enlace a su dirección, no un botón.
 */
export function SiguienteCondicion({
  estado,
  seccion,
  onCalcular,
  calculando = false,
}: {
  estado: EstadoMesa;
  seccion: string;
  onCalcular?: () => void;
  calculando?: boolean;
}) {
  const nav = useSeccion("calc-muestra");
  const accion = accionVisible(estado, seccion);
  const Icono = ICONO[estado.tono];

  return (
    <div className="cmg-siguiente" data-tono={estado.tono}>
      <p className="cmg-siguiente-estado" role="status">
        <span className="cmg-estado-chip" data-tono={estado.tono}>
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
      {accion?.tipo === "calcular" && (
        <button
          type="button"
          className="cmv2-ghost cmg-siguiente-accion"
          onClick={() => onCalcular?.()}
          disabled={!onCalcular || calculando}
          aria-busy={calculando || undefined}
        >
          {calculando
            ? <Loader2 size={14} className="pulso-spin" aria-hidden="true" />
            : <Calculator size={14} aria-hidden="true" />}
          {calculando ? "Calculando…" : accion.etiqueta}
        </button>
      )}
      {accion?.tipo === "seccion" && (
        <Link className="cmv2-ghost cmg-siguiente-accion" to={nav.hrefDe("seccion", accion.seccion)}>
          {accion.etiqueta}
          <ArrowRight size={14} aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}
