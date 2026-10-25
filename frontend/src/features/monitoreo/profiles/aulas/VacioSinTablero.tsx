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

import { AlertCircle, CalendarRange, RefreshCw } from "../../../../vendor/lucide-react";
import { contar } from "../../fuentes/vocabulario";
import { VacioConSalida } from "../../core/VacioConSalida";
import { fmt } from "./kpisDeAulas";

export function VacioSinTablero({
  planImportado,
  fuentesActivas,
  fuentesDeclaradas,
  onIrAFuentes,
  lecturaFallida = false,
  onReintentar,
}: {
  planImportado: boolean;
  fuentesActivas: number;
  fuentesDeclaradas: number;
  onIrAFuentes?: () => void;
  /**
   * La lectura del estado falló y no hay estado anterior (Meta B, L21). Sin
   * esto el vacío decía «Falta importar el plan» debajo del error: con el
   * estado en `null`, `planImportado` es `false` por no haber leído nada, no
   * porque el plan falte.
   */
  lecturaFallida?: boolean;
  onReintentar?: () => void;
}) {
  if (lecturaFallida) {
    return (
      <VacioConSalida
        icon={AlertCircle}
        titulo="No se pudo leer el monitoreo"
        dato="Sin esa lectura no se sabe si falta el plan o el corte de campo."
        accion={onReintentar ? { label: "Reintentar", onClick: onReintentar } : undefined}
      />
    );
  }
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
