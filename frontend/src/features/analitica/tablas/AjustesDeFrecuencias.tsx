// Columna derecha de Frecuencias, "Ajustes del archivo": lo que se decide
// sobre el archivo, en el orden del prototipo. El orden de las respuestas, las
// variables que se resumen en vez de tabularse, las filas opcionales, las notas
// al pie y, al final, de qué datos sale y la plantilla de Analítica. Todo a la
// vista, en secciones separadas por una línea; el cuerpo del panel es el dueño
// del scroll.

import { useId, type ReactNode } from "react";

import type { VariableInstrumento } from "../../../api/analitica";
import { PulsoButton } from "../../../components/PulsoButton";
import { SlidersHorizontal } from "../../../vendor/lucide-react";
import { InterruptorOpcion } from "../InterruptorOpcion";
import { NotasPieEditor } from "../panes/NotasPieEditor";
import { Segmentado } from "../ponderacion/Segmentado";
import type { FrecuenciasConfig } from "../store";
import { OPCIONES_DE_ORDEN } from "./cifrasDeFrecuencias";
import { NumericasDelArchivo } from "./NumericasDelArchivo";
import { PanelDeZona } from "./PanelDeZona";
import { SeccionDeAjustes } from "./SeccionDeAjustes";

export function AjustesDeFrecuencias({ frecuencias, numericas, variables, conTabla, datos, onCambio }: {
  frecuencias: FrecuenciasConfig;
  /** Las variables con resumen numérico vigentes: las de esta pestaña o, sin ellas, las globales. */
  numericas: readonly string[];
  variables: readonly VariableInstrumento[];
  /** Las variables que llevan tabla: las candidatas a una base propia en las notas. */
  conTabla: VariableInstrumento[];
  /** De qué datos sale el archivo y la plantilla de Analítica (la barra de fuente del módulo). */
  datos?: ReactNode;
  onCambio: (cambio: Partial<FrecuenciasConfig>) => void;
}) {
  const idOrden = useId();
  return (
    <PanelDeZona
      zona="ajustes"
      titulo="Ajustes del archivo"
      icono={<SlidersHorizontal size={16} aria-hidden="true" />}
      grupo="analitica/frecuencias-ajustes"
    >
      <SeccionDeAjustes titulo="Orden de las respuestas" idDelTitulo={idOrden}>
        <Segmentado
          etiquetadoPor={idOrden}
          valor={frecuencias.orden}
          opciones={OPCIONES_DE_ORDEN}
          onCambio={(orden) => onCambio({ orden })}
        />
        <p className="tablas-nota">Las listas ordinales conservan su orden.</p>
      </SeccionDeAjustes>

      <SeccionDeAjustes
        titulo="Con resumen numérico"
        accion={numericas.length > 1 ? (
          <PulsoButton variant="link" size="sm" onClick={() => onCambio({ numericas_override: [] })}>
            Quitar todas
          </PulsoButton>
        ) : undefined}
      >
        <NumericasDelArchivo
          numericas={numericas}
          variables={variables}
          onAgregar={(v) => { if (!numericas.includes(v)) onCambio({ numericas_override: [...numericas, v] }); }}
          onQuitar={(v) => onCambio({ numericas_override: numericas.filter((x) => x !== v) })}
        />
      </SeccionDeAjustes>

      <SeccionDeAjustes titulo="Filas" tituloVisible={false}>
        <div className="tablas-interruptores">
          <InterruptorOpcion
            variante="linea"
            checked={frecuencias.mostrar_todo}
            onToggle={() => onCambio({ mostrar_todo: !frecuencias.mostrar_todo })}
            titulo="Todas las opciones"
            descripcion="Incluye las que nadie eligió"
          />
          <InterruptorOpcion
            variante="linea"
            checked={frecuencias.incluir_secciones}
            onToggle={() => onCambio({ incluir_secciones: !frecuencias.incluir_secciones })}
            titulo="Nombres de sección"
            descripcion="Una fila separadora por sección"
          />
        </div>
      </SeccionDeAjustes>

      {/* Sin plegable: las notas son parte del trabajo y van a la vista. */}
      <SeccionDeAjustes titulo="Notas al pie">
        <NotasPieEditor variante="frecuencias" variables={conTabla} abierta />
      </SeccionDeAjustes>

      {datos ? (
        <SeccionDeAjustes titulo="Datos y plantilla">
          <div className="tablas-datos">{datos}</div>
        </SeccionDeAjustes>
      ) : null}
    </PanelDeZona>
  );
}
