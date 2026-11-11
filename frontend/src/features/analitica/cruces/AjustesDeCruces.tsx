// Columna derecha de Cruces, "Ajustes del archivo", en el orden del prototipo:
// las variables de cruce (chips con sus columnas, su orden y sus categorías
// excluidas), el orden de las filas, la significancia (las letras y la regla
// aplicada), los nombres de sección, las notas al pie y, al final, de qué datos
// sale y la plantilla de Analítica. Todo a la vista, en secciones separadas
// por una línea; el cuerpo del panel es el dueño del scroll.
//
// El modo Estándar o Dimensiones no está aquí: hoy el archivo sale en Estándar
// aunque se elija Dimensiones (la generación no recibe el modo guardado). Su
// valor sigue en la config y el aviso del motor lo dice en el pie de la tabla.

import { useId, type ReactNode } from "react";

import type { CrucesPreviewRegla, VariableInstrumento } from "../../../api/analitica";
import { SlidersHorizontal } from "../../../vendor/lucide-react";
import { InterruptorOpcion } from "../InterruptorOpcion";
import { NotasPieEditor } from "../panes/NotasPieEditor";
import { Segmentado } from "../ponderacion/Segmentado";
import type { CruceVarConfig, CrucesConfig } from "../store";
import { OPCIONES_DE_ORDEN } from "../tablas/cifrasDeFrecuencias";
import { PanelDeZona } from "../tablas/PanelDeZona";
import { SeccionDeAjustes } from "../tablas/SeccionDeAjustes";
import { ReglaDeLetras } from "./ReglaDeLetras";
import { VariablesACruzar } from "./VariablesACruzar";

import "./cruces.css";

export function AjustesDeCruces({
  cruces, cruzables, columnas, preguntasDeCruce, etiquetasDeCategorias, conTabla, regla, ponderado, leyendo, datos, onCambio, onAgregar, onQuitar, onExcluidas,
}: {
  cruces: CrucesConfig;
  cruzables: readonly VariableInstrumento[];
  /** Las columnas que cada variable de cruce tiene en el archivo, según la vista previa. */
  columnas: ReadonlyMap<string, number>;
  /** La pregunta de cada variable de cruce según la vista previa. */
  preguntasDeCruce: ReadonlyMap<string, string>;
  /** Por variable de cruce, el rótulo de cada categoría por su código. */
  etiquetasDeCategorias: ReadonlyMap<string, ReadonlyMap<string, string>>;
  /** Las variables que llevan tabla: las candidatas a una base propia en las notas. */
  conTabla: VariableInstrumento[];
  /** La regla que las letras usaron, según la vista previa. */
  regla: CrucesPreviewRegla | null;
  ponderado: boolean;
  /** La vista previa todavía no llegó. */
  leyendo: boolean;
  /** De qué datos sale el archivo y la plantilla de Analítica (la barra de fuente del módulo). */
  datos?: ReactNode;
  onCambio: (cambio: Partial<CrucesConfig>) => void;
  onAgregar: (variable: string) => void;
  onQuitar: (variable: string) => void;
  onExcluidas: (variable: string, excluidas: string[]) => void;
}) {
  const idOrden = useId();
  return (
    <PanelDeZona
      zona="ajustes"
      titulo="Ajustes del archivo"
      icono={<SlidersHorizontal size={16} aria-hidden="true" />}
      grupo="analitica/cruces-ajustes"
    >
      <SeccionDeAjustes titulo="Variables de cruce">
        <VariablesACruzar
          elegidas={cruces.cruces_vars}
          cruzables={cruzables}
          columnas={columnas}
          preguntasDeCruce={preguntasDeCruce}
          etiquetasDeCategorias={etiquetasDeCategorias}
          onAgregar={onAgregar}
          onQuitar={onQuitar}
          onExcluidas={onExcluidas}
          onOrdenar={(ordenadas: CruceVarConfig[]) => onCambio({ cruces_vars: ordenadas })}
        />
      </SeccionDeAjustes>

      <SeccionDeAjustes titulo="Orden de las filas" idDelTitulo={idOrden}>
        <Segmentado
          etiquetadoPor={idOrden}
          valor={cruces.orden}
          opciones={OPCIONES_DE_ORDEN}
          onCambio={(orden) => onCambio({ orden })}
        />
        <p className="tablas-nota">Las listas ordinales conservan su orden.</p>
      </SeccionDeAjustes>

      <SeccionDeAjustes titulo="Significancia">
        <div className="tablas-interruptores">
          <InterruptorOpcion
            variante="linea"
            checked={cruces.show_sig}
            onToggle={() => onCambio({ show_sig: !cruces.show_sig })}
            titulo="Letras de diferencias"
            descripcion="Compara las columnas de cada variable de cruce"
          />
        </div>
        {cruces.show_sig ? <ReglaDeLetras regla={regla} ponderado={ponderado} leyendo={leyendo} /> : null}
      </SeccionDeAjustes>

      <SeccionDeAjustes titulo="Filas" tituloVisible={false}>
        <div className="tablas-interruptores">
          <InterruptorOpcion
            variante="linea"
            checked={cruces.incluir_secciones}
            onToggle={() => onCambio({ incluir_secciones: !cruces.incluir_secciones })}
            titulo="Nombres de sección"
            descripcion="Una fila separadora por sección"
          />
        </div>
        {/* "Todas las opciones" es de Frecuencias: el archivo de cruces trae siempre todas las categorías del
            formulario (CONTRATO_CRUCES_PREVIEW: "en la app nunca se omiten aunque no tengan casos"). */}
        <p className="tablas-nota">Las tablas cruzadas traen todas las opciones del formulario, también las que nadie eligió.</p>
      </SeccionDeAjustes>

      {/* Sin plegable: las notas son parte del trabajo y van a la vista. */}
      <SeccionDeAjustes titulo="Notas al pie">
        <NotasPieEditor variante="cruces" variables={conTabla} crucesVars={cruces.cruces_vars.map((c) => c.name)} abierta />
      </SeccionDeAjustes>

      {datos ? (
        <SeccionDeAjustes titulo="Datos y plantilla">
          <div className="tablas-datos">{datos}</div>
        </SeccionDeAjustes>
      ) : null}
    </PanelDeZona>
  );
}
