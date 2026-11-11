// Las categorías de una variable de cruce, para excluir las que no deben ser
// columna. Cada una es un chip de excluir del kit: marcado, sale tachado. Se
// leen los valores que la variable tiene en la base (lo mismo que compara la
// exclusión al generar) y se guardan tal cual en `cruces_vars[].excluidas`.

import { useCallback } from "react";

import { apiAnaliticaColumnValues } from "../../../api/analitica";
import { ChipSeleccion } from "../../../components/ChipSeleccion";
import { PulsoButton } from "../../../components/PulsoButton";
import { useSession } from "../../../lib/SessionContext";
import { RotateCw } from "../../../vendor/lucide-react";
import { claveDeLaBase } from "../ponderacion/useBaseDelCalculo";
import { useLecturaPorBase } from "../tablas/useLecturaPorBase";

export function CategoriasDeCruce({ variable, etiqueta, excluidas, etiquetas, onCambio }: {
  variable: string;
  /** La pregunta, para nombrar el grupo. */
  etiqueta: string;
  excluidas: readonly string[];
  /** El rótulo de cada categoría por su código, de las columnas de la vista previa; la base puede traer solo códigos. */
  etiquetas?: ReadonlyMap<string, string>;
  onCambio: (excluidas: string[]) => void;
}) {
  const sesion = useSession().state;
  const leer = useCallback(async () => (await apiAnaliticaColumnValues(variable)).values, [variable]);
  const valores = useLecturaPorBase(leer, JSON.stringify([claveDeLaBase(sesion?.active_base, sesion?.analitica_fuente, 0), variable]));
  const alternar = (valor: string) => onCambio(excluidas.includes(valor) ? excluidas.filter((x) => x !== valor) : [...excluidas, valor]);

  if (valores.fase === "error") {
    return (
      <div className="cruces-categorias-estado">
        <p className="tablas-nota">No se pudieron leer las categorías: {valores.causa || "el servidor no respondió."}</p>
        <PulsoButton variant="link" size="sm" onClick={valores.reintentar}>
          <RotateCw size={12} aria-hidden="true" /> Reintentar
        </PulsoButton>
      </div>
    );
  }
  if (valores.datos === null) return <p className="tablas-nota">Leyendo las categorías</p>;
  if (valores.datos.length === 0) return <p className="tablas-nota">Sin categorías en la base.</p>;
  return (
    <>
    <div className="cruces-categorias" data-qa-geometry-group="analitica/cruces-categorias" data-qa-geometry-contract="intrinsic" role="group" aria-label={`Categorías excluidas de ${etiqueta}`}>
      {valores.datos.map((v) => {
        // Se lee por su rótulo, emparejado por código; el código va en el title.
        const rotulo = v.label?.trim() || etiquetas?.get(v.value) || v.value;
        return (
          <ChipSeleccion
            key={v.value}
            etiqueta={rotulo}
            activo={excluidas.includes(v.value)}
            excluye
            envuelve
            title={`${excluidas.includes(v.value) ? "Volver a incluir" : "Excluir"} ${rotulo} (código ${v.value})`}
            onAlternar={() => alternar(v.value)}
          />
        );
      })}
    </div>
    {excluidas.length > 0 ? (
      <PulsoButton variant="link" size="sm" className="cruces-quitar-exclusiones" onClick={() => onCambio([])}>
        Quitar todas las exclusiones
      </PulsoButton>
    ) : null}
    </>
  );
}
