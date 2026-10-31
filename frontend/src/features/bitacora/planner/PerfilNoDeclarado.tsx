// El vacío propio (C3) de un módulo cuyo modo depende del perfil de recojo y
// el estudio todavía no lo declaró (ADR 0122 §4). Lo usan Cálculo de muestra,
// Material de campo y Monitoreo en la fase P2, en lugar de su selector de camino.

import { Link } from "react-router-dom";

import "./planner.css";

type Props = {
  /** Qué necesita el módulo, en una frase: «Cálculo de muestra abre en el modo del perfil». */
  detalle?: string;
};

export const RUTA_PERFILES_DEL_PLANNER = "/planner?seccion=estudio&pestana=perfiles";

export function PerfilNoDeclarado({ detalle }: Props) {
  return (
    <div className="planner-vacio-modulo" role="status" data-audit-ready="perfil-no-declarado">
      <strong>El estudio todavía no declara cómo se recoge</strong>
      {detalle ? <p>{detalle}</p> : null}
      <Link className="plan-button plan-button--primary" to={RUTA_PERFILES_DEL_PLANNER}>
        Declarar el perfil en el Planner
      </Link>
    </div>
  );
}
