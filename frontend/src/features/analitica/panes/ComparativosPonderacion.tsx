// Analítica › Comparativos: cómo pondera cada base de la serie.
//
// Una línea con el estado de cada base y el enlace a Ponderación, y antes de
// generar un aviso breve —no bloqueante— si alguna base trae columnas de peso
// sin declarar. Una base sin columnas de peso sale «sin ponderar» y no avisa.
// La lógica vive en `ponderacionSerieModel.ts`.

import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight, Scale } from "../../../vendor/lucide-react";
import {
  DIRECCION_PONDERACION_SERIE,
  avisoAntesDeGenerar,
  clasePonderacion,
  explicacionPonderacion,
  textoPonderacion,
  type PonderacionEnSerie,
} from "../ponderacionSerieModel";
import type { LecturaPonderacionSerie } from "../usePonderacionDeLaSerie";

export function PonderacionDeLaSerieLinea({ lectura }: { lectura: LecturaPonderacionSerie }) {
  return (
    <div className="pulso-comparativos-ponderacion" role="group" aria-labelledby="comparativos-ponderacion-titulo">
      <span id="comparativos-ponderacion-titulo" className="pulso-comparativos-ponderacion-titulo">
        <Scale size={13} aria-hidden="true" />
        Ponderación
      </span>
      {lectura.tipo === "cargando" ? (
        <span className="pulso-comparativos-ponderacion-base">Leyendo…</span>
      ) : (
        <ul className="pulso-comparativos-ponderacion-lista">
          {lectura.serie.map((s) => <BasePonderada key={s.base} s={s} />)}
        </ul>
      )}
      <Link className="pulso-comparativos-ponderacion-enlace" to={DIRECCION_PONDERACION_SERIE}>
        Ir a Ponderación <ArrowRight size={13} aria-hidden="true" />
      </Link>
    </div>
  );
}

function BasePonderada({ s }: { s: PonderacionEnSerie }) {
  return (
    <li
      className={`pulso-comparativos-ponderacion-base ${clasePonderacion(s.ponderacion)}`}
      title={explicacionPonderacion(s.ponderacion)}
    >
      <strong>{s.base}</strong> {textoPonderacion(s.ponderacion)}
    </li>
  );
}

export function AvisoPonderacionSerie({ lectura }: { lectura: LecturaPonderacionSerie }) {
  if (lectura.tipo !== "listo") return null;
  const aviso = avisoAntesDeGenerar(lectura.serie);
  if (!aviso) return null;
  return (
    <p className="pulso-comparativos-ponderacion-aviso" role="status">
      <AlertTriangle size={13} aria-hidden="true" />
      <span>
        {aviso}{" "}
        <Link className="pulso-comparativos-ponderacion-enlace" to={DIRECCION_PONDERACION_SERIE}>
          Declarar en Ponderación <ArrowRight size={13} aria-hidden="true" />
        </Link>
      </span>
    </p>
  );
}
