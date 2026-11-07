// El buscador del par de una fila (Cambiar o Buscar par): el PreguntaCombobox de Carga (ADR 0104, búsqueda por el texto
// que escribe el analista). Se abre solo al montarse, porque montarlo ya fue el clic en "Cambiar" o "Buscar par".

import { useEffect, useRef } from "react";
import type { VariableDeBase } from "../../../../api/equivalencias";
import { PreguntaCombobox } from "../../../carga/PreguntaCombobox";

type Props = {
  base: string;
  opciones: readonly VariableDeBase[];
  valor: string;
  contexto: string;
  tomadas: ReadonlySet<string>;
  onElegir: (variable: string) => void;
};

export function BuscarPar({ base, opciones, valor, contexto, tomadas, onElegir }: Props) {
  const caja = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    caja.current?.querySelector<HTMLButtonElement>("button[aria-haspopup='listbox']")?.click();
  }, []);
  return (
    <span ref={caja} className="pulso-f6-emp-buscar">
      <PreguntaCombobox base={base} opciones={opciones} valor={valor} onElegir={onElegir} contexto={contexto} tomadasEnOtraFila={tomadas} />
    </span>
  );
}
