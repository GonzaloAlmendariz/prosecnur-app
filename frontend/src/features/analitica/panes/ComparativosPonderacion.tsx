// Analítica › Comparativos: aviso previo de ponderación.
//
// Antes de generar, un aviso breve —no bloqueante— si alguna base trae columnas
// de peso sin declarar. Una base sin columnas de peso sale «sin ponderar» y no
// avisa. El estado de cada base se lee en «Columnas del comparativo»
// (`ComparativosColumnas.tsx`). La lógica vive en `ponderacionSerieModel.ts`.

import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight } from "../../../vendor/lucide-react";
import {
  DIRECCION_PONDERACION_SERIE,
  avisoAntesDeGenerar,
} from "../ponderacionSerieModel";
import type { LecturaPonderacionSerie } from "../usePonderacionDeLaSerie";

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
