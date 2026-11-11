// Zona derecha de Cruces: lo que se decide sobre el archivo. De arriba abajo,
// las variables a cruzar con sus categorías excluidas, el modo, el orden de
// las filas, los nombres de sección, las letras de diferencias con la regla
// aplicada y las notas al pie. Todo a la vista, en secciones separadas por una
// línea; el cuerpo del panel es el dueño del scroll.

import { useId } from "react";

import type { CrucesPreviewRegla, VariableInstrumento } from "../../../api/analitica";
import { SlidersHorizontal } from "../../../vendor/lucide-react";
import { InterruptorOpcion } from "../InterruptorOpcion";
import { NotasPieEditor } from "../panes/NotasPieEditor";
import { Segmentado } from "../ponderacion/Segmentado";
import type { CrucesConfig } from "../store";
import { OPCIONES_DE_ORDEN } from "../tablas/cifrasDeFrecuencias";
import { PanelDeZona } from "../tablas/PanelDeZona";
import { SeccionDeAjustes } from "../tablas/SeccionDeAjustes";
import { ModoDelArchivo } from "./ModoDelArchivo";
import { ReglaDeLetras } from "./ReglaDeLetras";
import { VariablesACruzar } from "./VariablesACruzar";

import "./cruces.css";

export function AjustesDeCruces({
  cruces, cruzables, etiquetasDeCategorias, conTabla, dimensionesListas, regla, ponderado, leyendo, onCambio, onAgregar, onQuitar, onExcluidas,
}: {
  cruces: CrucesConfig;
  cruzables: readonly VariableInstrumento[];
  /** Por variable de cruce, el rótulo de cada categoría por su código. */
  etiquetasDeCategorias: ReadonlyMap<string, ReadonlyMap<string, string>>;
  /** Las variables que llevan tabla: las candidatas a una base propia en las notas. */
  conTabla: VariableInstrumento[];
  dimensionesListas: boolean;
  /** La regla que las letras usaron, según la vista previa. */
  regla: CrucesPreviewRegla | null;
  ponderado: boolean;
  /** La vista previa todavía no llegó. */
  leyendo: boolean;
  onCambio: (cambio: Partial<CrucesConfig>) => void;
  onAgregar: (variable: string) => void;
  onQuitar: (variable: string) => void;
  onExcluidas: (variable: string, excluidas: string[]) => void;
}) {
  const idModo = useId();
  const idOrden = useId();
  return (
    <PanelDeZona
      zona="ajustes"
      titulo="Ajustes del archivo"
      icono={<SlidersHorizontal size={16} aria-hidden="true" />}
      grupo="analitica/cruces-ajustes"
    >
      <SeccionDeAjustes titulo="Variables a cruzar">
        <VariablesACruzar
          elegidas={cruces.cruces_vars}
          cruzables={cruzables}
          etiquetasDeCategorias={etiquetasDeCategorias}
          onAgregar={onAgregar}
          onQuitar={onQuitar}
          onExcluidas={onExcluidas}
        />
      </SeccionDeAjustes>

      <SeccionDeAjustes titulo="Modo" idDelTitulo={idModo}>
        <ModoDelArchivo
          modo={cruces.modo}
          dimensionesListas={dimensionesListas}
          etiquetadoPor={idModo}
          onCambio={(modo) => onCambio({ modo })}
        />
      </SeccionDeAjustes>

      <SeccionDeAjustes titulo="Orden de las filas" idDelTitulo={idOrden}>
        <Segmentado
          etiquetadoPor={idOrden}
          valor={cruces.orden}
          opciones={OPCIONES_DE_ORDEN}
          onCambio={(orden) => onCambio({ orden })}
        />
        <p className="tablas-nota">Las listas ordinales conservan el orden del formulario.</p>
      </SeccionDeAjustes>

      <SeccionDeAjustes titulo="Filas">
        <div className="tablas-interruptores">
          <InterruptorOpcion
            variante="linea"
            checked={cruces.incluir_secciones}
            onToggle={() => onCambio({ incluir_secciones: !cruces.incluir_secciones })}
            titulo="Nombres de sección"
            descripcion="Una fila separadora por sección."
          />
        </div>
      </SeccionDeAjustes>

      <SeccionDeAjustes titulo="Diferencias significativas">
        <div className="tablas-interruptores">
          <InterruptorOpcion
            variante="linea"
            checked={cruces.show_sig}
            onToggle={() => onCambio({ show_sig: !cruces.show_sig })}
            titulo="Letras de diferencias"
            descripcion="Compara las columnas de cada variable de cruce."
          />
        </div>
        {cruces.show_sig ? <ReglaDeLetras regla={regla} ponderado={ponderado} leyendo={leyendo} /> : null}
      </SeccionDeAjustes>

      {/* Sin plegable: las notas son parte del trabajo y van a la vista. */}
      <SeccionDeAjustes titulo="Notas al pie">
        <NotasPieEditor variante="cruces" variables={conTabla} crucesVars={cruces.cruces_vars.map((c) => c.name)} abierta />
      </SeccionDeAjustes>
    </PanelDeZona>
  );
}
