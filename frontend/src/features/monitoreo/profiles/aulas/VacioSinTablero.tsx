// El vacío de cursos-horario cuando todavía no hay tablero.
//
// Decía «Resumen pendiente · Todavía no hay un panel local preparado para
// cursos-horario»: la misma frase muda que los otros dos perfiles tenían y que
// no dice en qué punto está el estudio ni por dónde se sale. Aquí no había
// candado —Fuentes se monta antes del guardia, con sus operaciones—, pero el
// vacío tampoco clasificaba.
//
// El modo tiene dos pendientes distintos y se leen distinto: sin plan importado
// no hay nada que sincronizar, y con el plan puesto lo que falta es el corte de
// campo. La copia sale de la que ya usaba el propio botón de avance —«Primero
// importa el plan desde el cálculo de muestra»—, que decía lo correcto en un
// `title` que sólo se ve al pasar por encima.

import { CalendarRange, RefreshCw } from "../../../../vendor/lucide-react";
import { contar } from "../../fuentes/vocabulario";
import { VacioConSalida } from "../../core/VacioConSalida";
import { fmt } from "./kpisDeAulas";

export function VacioSinTablero({
  planImportado,
  fuentesActivas,
  fuentesDeclaradas,
  onIrAFuentes,
}: {
  planImportado: boolean;
  fuentesActivas: number;
  fuentesDeclaradas: number;
  onIrAFuentes?: () => void;
}) {
  return (
    <VacioConSalida
      icon={planImportado ? RefreshCw : CalendarRange}
      titulo={planImportado ? "Falta sincronizar el campo" : "Falta importar el plan"}
      dato={planImportado
        ? `${fmt(fuentesActivas)} de ${contar(fuentesDeclaradas, "fuente activa", "fuentes activas")}`
        : "El plan de cursos-horario sale del cálculo de muestra"}
      accion={onIrAFuentes ? { label: "Ir a Fuentes", onClick: onIrAFuentes } : undefined}
    />
  );
}
