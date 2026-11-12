// La cabecera de Analítica › Comparativos (prototipo, `tabHeading` de "Analítica,
// Comparativos"): antetítulo, título del catálogo, el estado del archivo, las
// cifras de la serie y, a la derecha, generar el Excel.

import type { ReactNode } from "react";

import { CabeceraDePestana, type EstadoDePestana } from "../../../components/procesamiento/CabeceraDePestana";
import type { CifraDePestana } from "../../../components/procesamiento/CifrasDePestana";
import { PROCESAMIENTO_PESTANAS } from "../../../lib/navegacion/catalogos/procesamiento";

export function CabeceraDeComparativos({ cifras, estado, acciones }: {
  cifras: CifraDePestana[];
  estado: EstadoDePestana | null;
  acciones?: ReactNode;
}) {
  const meta = PROCESAMIENTO_PESTANAS.analitica.find((p) => p.key === "comparativos") ?? PROCESAMIENTO_PESTANAS.analitica[0];
  return (
    <CabeceraDePestana
      seccion="Analítica"
      titulo={meta.label}
      icono={meta.icon}
      estado={estado}
      cifras={cifras}
      ariaCifras="Cifras del comparativo"
      className="comparativos-cabecera"
      acciones={acciones}
    />
  );
}
