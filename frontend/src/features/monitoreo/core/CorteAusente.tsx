// El vacío de una sección que todavía no tiene corte.
//
// Antes las cuatro secciones que dependen del corte —Modelo, Llamadas,
// Consultas y Avance— caían en el mismo panel genérico: «Resumen pendiente ·
// Todavia no hay reporte local preparado para esta vista». Dice que no hay
// nada, no dice por qué ni deja salir. Mientras Fuentes estuvo tapada por el
// mismo guardia daba igual, porque nadie llegaba a verlo; ahora es la primera
// pantalla real de un estudio nuevo.
//
// Lo que ocupa ese hueco es el dato de ESTE proyecto —cuántas fuentes hay
// conectadas de las que el modo exige— y la puerta a donde se arregla. Las
// cifras son las mismas variables que pinta el chrome del módulo, no un
// recuento paralelo: dos superficies contando distinto lo mismo es exactamente
// el defecto que este vacío vendría a explicar.

import { PlugZap, RefreshCw } from "../../../vendor/lucide-react";
import { VacioConSalida } from "./VacioConSalida";

export function CorteAusente({
  fuentesActivas,
  fuentesRequeridas,
  onIrAFuentes,
}: {
  fuentesActivas: number;
  fuentesRequeridas: number;
  onIrAFuentes?: () => void;
}) {
  // Sin cardinalidad declarada, cero conectadas es «faltan»: el modo que no
  // exige un número fijo tampoco puede dar por completo un paquete vacío.
  const faltanFuentes = fuentesRequeridas > 0 ? fuentesActivas < fuentesRequeridas : true;
  return (
    <VacioConSalida
      icon={faltanFuentes ? PlugZap : RefreshCw}
      titulo={faltanFuentes ? "Faltan fuentes por conectar" : "Falta sincronizar"}
      dato={fuentesRequeridas > 0
        ? `${fuentesActivas} de ${fuentesRequeridas} fuentes conectadas`
        : "Sin fuentes conectadas"}
      accion={onIrAFuentes ? { label: "Ir a Fuentes", onClick: onIrAFuentes } : undefined}
    />
  );
}
