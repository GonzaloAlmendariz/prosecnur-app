// El vacío propio (C3) de un módulo cuyo modo depende del tipo del estudio y
// el estudio todavía no lo declaró (ADR 0124). Lo usan Cálculo de muestra y
// Monitoreo en lugar de su selector de camino.

import { Link } from "react-router-dom";

import { useRutaFichaDelEstudio } from "./useRutaFichaDelEstudio";
import "./estudio.css";

type Props = {
  /** Qué necesita el módulo, en una frase: «Cálculo de muestra abre en el modo del tipo». */
  detalle?: string;
};

export function PerfilNoDeclarado({ detalle }: Props) {
  const ficha = useRutaFichaDelEstudio();
  return (
    <div className="estudio-vacio-modulo" role="status" data-audit-ready="perfil-no-declarado">
      <strong>El estudio todavía no declara su tipo</strong>
      {detalle ? <p>{detalle}</p> : null}
      <Link className="pulso-button pulso-button--primary pulso-button--sm" to={ficha}>
        Declarar el tipo del estudio
      </Link>
    </div>
  );
}
