// El modo del archivo de Cruces: Estándar (porcentajes por categoría) o
// Dimensiones (promedios de 0 a 100 de los índices). Dimensiones pide haberlas
// generado. Hoy el archivo sale en Estándar aunque se elija Dimensiones (la
// generación no recibe el modo guardado): la vista lo dice bajo el control, sin
// esconderlo.

import { useId } from "react";

import { GlidingRadioGroup } from "../../../components/GlidingRadioGroup";
import type { CrucesConfig } from "../store";

type Modo = CrucesConfig["modo"];
type OpcionDeModo = { valor: Modo; rotulo: string; ayuda: string };

const OPCIONES: readonly OpcionDeModo[] = [
  { valor: "estandar", rotulo: "Estándar", ayuda: "Porcentajes por categoría" },
  { valor: "dimensiones", rotulo: "Dimensiones", ayuda: "Promedios de 0 a 100 de los índices" },
];

export function ModoDelArchivo({ modo, dimensionesListas, etiquetadoPor, onCambio }: {
  modo: Modo;
  /** Las dimensiones ya se generaron (`analitica_dim_ok`). */
  dimensionesListas: boolean;
  etiquetadoPor: string;
  onCambio: (modo: Modo) => void;
}) {
  const nota = useId();
  const deshabilitada = (o: OpcionDeModo) => o.valor === "dimensiones" && !dimensionesListas;
  return (
    <>
      <GlidingRadioGroup<OpcionDeModo, Modo>
        className="analitica-segmented"
        aria-labelledby={etiquetadoPor}
        aria-describedby={nota}
        value={modo}
        options={OPCIONES}
        getOptionValue={(o) => o.valor}
        onValueChange={(valor) => { if (!deshabilitada(OPCIONES.find((o) => o.valor === valor) ?? OPCIONES[0])) onCambio(valor); }}
        getOptionProps={(o, { checked }) => ({
          className: checked ? "is-on" : undefined,
          disabled: deshabilitada(o),
          title: deshabilitada(o) ? "Genera las dimensiones en la pestaña Dimensiones." : o.ayuda,
        })}
      >
        {(o) => o.rotulo}
      </GlidingRadioGroup>
      <p id={nota} className="tablas-nota">
        {modo === "dimensiones"
          ? "El archivo sale en modo Estándar: la generación todavía no aplica Dimensiones."
          : dimensionesListas
            ? "Dimensiones todavía no cambia el archivo: sale en modo Estándar."
            : "Dimensiones se habilita al generar las dimensiones en su pestaña."}
      </p>
    </>
  );
}
