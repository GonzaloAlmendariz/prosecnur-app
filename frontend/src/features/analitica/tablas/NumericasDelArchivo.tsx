// Variables con resumen numérico: el archivo las resume con media, desviación
// y percentiles en vez de tabularlas. Solo entran las que se declaran aquí o en
// la definición global; no hay detección automática.

import { useMemo, useState } from "react";

import type { VariableInstrumento } from "../../../api/analitica";
import { ChipControl, CLASE_CHIP_CON_CONTROLES } from "../../../components/ChipConControles";
import { EstadoVacio } from "../../../components/EstadoVacio";
import { PulsoButton } from "../../../components/PulsoButton";
import { Hash, Plus, X } from "../../../vendor/lucide-react";
import { VariableSelect } from "../VariableSelect";

/** Cuántas variables numéricas del formulario se ofrecen sin abrir el selector. */
const SUGERIDAS_A_LA_VISTA = 4;

export function NumericasDelArchivo({ numericas, variables, onAgregar, onQuitar }: {
  numericas: readonly string[];
  variables: readonly VariableInstrumento[];
  onAgregar: (variable: string) => void;
  onQuitar: (variable: string) => void;
}) {
  const [eligiendo, setEligiendo] = useState(false);
  const porNombre = useMemo(() => new Map(variables.map((v) => [v.name, v])), [variables]);
  const disponibles = useMemo(
    () => variables.filter((v) => Boolean(v.numerica) && !numericas.includes(v.name)),
    [variables, numericas],
  );
  const sugeridas = disponibles.slice(0, SUGERIDAS_A_LA_VISTA);

  return (
    <div className="tablas-numericas">
      {numericas.length === 0 ? (
        <EstadoVacio
          icono={<Hash size={15} />}
          titulo="Sin resumen numérico"
          descripcion="Marca edades, ingresos o puntajes para resumirlos aparte."
        />
      ) : (
        <ul className="tablas-numericas-lista" aria-label="Variables con resumen numérico">
          {numericas.map((nombre) => {
            const etiqueta = porNombre.get(nombre)?.label?.trim() || nombre;
            return (
              <li key={nombre} className={`${CLASE_CHIP_CON_CONTROLES} tablas-numerica`}>
                <span className="tablas-numerica-etiqueta" title={etiqueta}>{etiqueta}</span>
                {etiqueta !== nombre ? <code className="tablas-codigo">{nombre}</code> : null}
                <ChipControl aria-label={`Quitar ${etiqueta}`} onClick={() => onQuitar(nombre)}>
                  <X size={12} aria-hidden="true" />
                </ChipControl>
              </li>
            );
          })}
        </ul>
      )}

      {eligiendo ? (
        <div className="tablas-agregar-selector">
          <VariableSelect
            variables={disponibles}
            value=""
            placeholder="Variable numérica"
            onChange={(nombre) => { if (nombre) onAgregar(nombre); setEligiendo(false); }}
          />
          <PulsoButton variant="secondary" onClick={() => setEligiendo(false)}>Cancelar</PulsoButton>
        </div>
      ) : (
        <PulsoButton variant="secondary" className="tablas-agregar" onClick={() => setEligiendo(true)}>
          <Plus size={14} aria-hidden="true" /> Añadir variable numérica
        </PulsoButton>
      )}

      {!eligiendo && sugeridas.length > 0 ? (
        <div className="tablas-sugeridas" role="group" aria-label="Variables numéricas del formulario">
          <span className="tablas-sugeridas-rotulo">Numéricas del formulario</span>
          {sugeridas.map((v) => (
            <PulsoButton
              key={v.name}
              variant="ghost"
              size="sm"
              title={`Añadir ${v.name}`}
              onClick={() => onAgregar(v.name)}
            >
              <Plus size={12} aria-hidden="true" /> {v.label?.trim() || v.name}
            </PulsoButton>
          ))}
        </div>
      ) : null}

    </div>
  );
}
