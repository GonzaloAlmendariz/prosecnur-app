// Qué cifras se leen en la tabla del centro: casos, porcentaje o los dos. Con
// pesos la cifra de casos es una suma de pesos y se llama "N ponderado"
// (regla de la base sin ponderar): el conmutador no la llama "Casos".

import { Segmentado, type OpcionDeSegmentado } from "../ponderacion/Segmentado";
import { useVistaDeTablas, type ModoDeCifras, type PestanaDeTablas } from "./vistaDeTablasStore";

/** El orden del prototipo: Frecuencias empieza por los casos; Cruces, por el porcentaje. */
export function opcionesDeCifras(pestana: PestanaDeTablas, ponderado: boolean): OpcionDeSegmentado<ModoDeCifras>[] {
  const casos = { valor: "casos" as const, rotulo: ponderado ? "N ponderado" : "Casos" };
  const porcentaje = { valor: "porcentaje" as const, rotulo: "Porcentaje" };
  const ambos = { valor: "ambos" as const, rotulo: "Ambos" };
  return pestana === "frecuencias" ? [casos, porcentaje, ambos] : [porcentaje, casos, ambos];
}

export function ConmutadorDeCifras({ pestana, ponderado }: { pestana: PestanaDeTablas; ponderado: boolean }) {
  const modo = useVistaDeTablas((s) => s.cifras[pestana]);
  const elegir = useVistaDeTablas((s) => s.elegirCifras);
  return (
    <div className="tablas-conmutador">
      <Segmentado
        etiqueta="Cifras de la tabla"
        valor={modo}
        opciones={opcionesDeCifras(pestana, ponderado)}
        onCambio={(m) => elegir(pestana, m)}
      />
    </div>
  );
}
