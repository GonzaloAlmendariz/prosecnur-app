// Equivalencias entre públicos (ADR 0062).
//
// Declara qué pregunta de un público es la misma que la de otro. Sin esa tabla,
// comparar públicos depende de la memoria del analista frente a un selector que
// muestra la misma etiqueta ("Servicio de salud") para tres preguntas distintas,
// y el error no da ninguna señal.
//
// ADR 0104: la matriz se arma aquí, por la persona, fila por fila. La mesa
// (cabecera, tabla e inspector) vive en `pestanas/equivalencias/` con la forma
// del prototipo "carga-equivalencias"; el estado, en `useMatrizDeEquivalencias`.
// Este archivo solo decide entre el esqueleto y la mesa y monta los paneles
// direccionables.

import { ArmonizacionFilaEditor } from "./ArmonizacionFilaEditor";
import { ImportarBloquesDialog } from "./ImportarBloquesDialog";
import { IndicadorCompuestoEditor } from "./IndicadorCompuestoEditor";
import { EquivalenciasEsqueleto } from "./EquivalenciasEsqueleto";
import { MapaBasesPanel } from "./MapaBasesPanel";
import { SegmentosPanel } from "./segmentos/SegmentosPanel";
import { MesaDeEquivalencias } from "./pestanas/equivalencias/MesaDeEquivalencias";
import { useMatrizDeEquivalencias } from "./pestanas/equivalencias/useMatrizDeEquivalencias";
// Las clases `pulso-equiv-*` y `pulso-armon-*` que usan los paneles (armonización, orden de la serie, celdas del compuesto).
import "./EquivalenciasPanel.css";

export type EquivalenciasPanelProps = {
  /**
   * Reporta cuántas preguntas hay declaradas, no cuántas veces se importó.
   * `"error"`: no se pudo leer, y la pestaña no debe seguir diciendo
   * "Revisando" ni afirmar "Pendiente".
   */
  onDeclaradas?: (n: number | "error") => void;
};

export function EquivalenciasPanel({ onDeclaradas }: EquivalenciasPanelProps) {
  const matriz = useMatrizDeEquivalencias(onDeclaradas);
  const { estado, cargando, filas, variablesPorBase, bases, basesDeTabla, basesDeSerie } = matriz;

  // Overlays direccionables: van en portal, fuera de la geometría de la
  // superficie. Se montan también durante la lectura, para que un enlace a
  // `panel=armonizacion` muestre su propio estado de carga desde el principio.
  const overlays = (
    <>
      <ArmonizacionFilaEditor
        estado={estado}
        cargandoEstado={cargando}
        variablesPorBase={variablesPorBase}
        filasEditor={filas}
        onGuardado={matriz.onArmonizacionGuardada}
      />
      <MapaBasesPanel
        cargando={cargando}
        bases={basesDeTabla}
        filas={filas}
        variablesPorBase={variablesPorBase}
        onAnadir={matriz.onAnadirDesdeMapa}
      />
      <SegmentosPanel ordenBases={basesDeSerie} />
      <ImportarBloquesDialog bases={bases} onAplicado={matriz.onBloquesAplicados} />
      <IndicadorCompuestoEditor
        estado={estado}
        cargandoEstado={cargando}
        bases={basesDeTabla}
        variablesPorBase={variablesPorBase}
        onGuardado={matriz.onCompuestoGuardado}
      />
    </>
  );

  // P-A8: la lectura inicial trae la declaración Y el catálogo de variables.
  // Hasta que llegan las dos, la superficie es su esqueleto y su readiness es `false`.
  if (cargando) {
    return (
      <>
        <EquivalenciasEsqueleto />
        {overlays}
      </>
    );
  }

  // Terminal: la lectura terminó, con datos, vacía o con error a la vista.
  // C1: la mesa del kit declara sus grupos (`carga/equivalencias-mesa`, filtros y ficha).
  return (
    <section className="pulso-carga-mesa-kit pulso-equiv-raiz" aria-label="Equivalencias entre bases" data-audit-ready="true">
      <MesaDeEquivalencias matriz={matriz} />
      {overlays}
    </section>
  );
}
