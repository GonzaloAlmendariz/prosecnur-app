// Codificación, Preguntas (etapa P3a del rediseño de Procesamiento).
//
// Una lista de unidades a todo el ancho (un par enlazado o una pregunta suelta) y, a la derecha, el
// inspector de la unidad seleccionada. Este archivo solo compone: las piezas, el modelo y la hoja viven
// en `preguntas/`. Emparejar se hace arrastrando una suelta sobre otra o con "Emparejar con" del inspector.

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import type { PreguntaAbierta } from "../../api/codificacion";
import { Alert } from "../../components/Alert";
import { Panel } from "../../components/Panel";
import { PulsoButton } from "../../components/PulsoButton";
import { ErrorBlock } from "../../components/States";
import { Switch } from "../../components/Switch";
import { decisionDePregunta } from "./decisionCodificacion";
import { GruposTrasDesemparejar } from "./GruposTrasDesemparejar";
import { PairingDialog } from "./PairingDialog";
import { RelationDialog } from "./RelationDialog";
import { anunciosDeArrastre, colisionDePreguntas, fantasmaJuntoAlCursor, instruccionesDeArrastre } from "./preguntas/arrastre";
import { BarraPreguntas } from "./preguntas/BarraPreguntas";
import { CargaPreguntas } from "./preguntas/CargaPreguntas";
import { DecisionNoCodificar } from "./preguntas/DecisionNoCodificar";
import { FantasmaArrastre } from "./preguntas/FantasmaArrastre";
import { InspectorUnidad } from "./preguntas/InspectorUnidad";
import { ListaUnidades } from "./preguntas/ListaUnidades";
import { admiteIncluir, contarFiltros, filtroVigente, seccionesVisibles, selectorDeEmparejar, type Unidad } from "./preguntas/modeloUnidades";
import { SelectorDePareja } from "./preguntas/SelectorDePareja";
import { usePreguntasCodificacion } from "./preguntas/usePreguntasCodificacion";
import { useVistaPreguntas } from "./preguntas/vistaPreguntasStore";
import "./preguntas/preguntas.css";

export { defaultModoSoForQuickAdopt, modoSoOptionsForDisplay } from "./preguntas/modeloUnidades";

export function PreguntasLanding() {
  const mesa = usePreguntasCodificacion();
  const { filtro: filtroElegido, consulta, seleccion, elegirFiltro, buscar, seleccionar } = useVistaPreguntas();
  const [levantadaId, setLevantadaId] = useState<string | null>(null);

  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const { unidades } = mesa;
  const conteos = useMemo(() => contarFiltros(unidades), [unidades]);
  // Una base sin ninguna unidad con texto se muestra en "Todas" en vez de abrir en un vacío.
  const filtro = filtroVigente(filtroElegido, conteos);
  const secciones = useMemo(() => seccionesVisibles(unidades, filtro, consulta), [unidades, filtro, consulta]);
  const seleccionada = useMemo(() => unidades.find((u) => u.id === seleccion) ?? null, [unidades, seleccion]);
  const levantada = useMemo(() => unidades.find((u) => u.id === levantadaId) ?? null, [unidades, levantadaId]);

  if (mesa.errorDeCarga) return <ErrorBlock label="No se pudieron cargar las preguntas" detail={mesa.errorDeCarga} />;
  if (!mesa.preguntas) return <CargaPreguntas />;

  function alLevantar(evento: DragStartEvent) {
    setLevantadaId(String(evento.active.id));
  }

  function alSoltar(evento: DragEndEvent) {
    setLevantadaId(null);
    if (evento.over) mesa.soltar(String(evento.active.id), String(evento.over.id));
  }

  /** Sin arrastrar: una cerrada elige su columna de texto; cualquier otra, la pregunta con la que va. */
  function emparejar(unidad: Unidad) {
    if (selectorDeEmparejar(unidad) === "columna") mesa.abrirEmparejar(unidad.principal);
    else mesa.abrirBuscarPareja(unidad.principal);
  }

  return (
    <DndContext
      sensors={sensores}
      collisionDetection={colisionDePreguntas}
      accessibility={{ announcements: anunciosDeArrastre, screenReaderInstructions: instruccionesDeArrastre }}
      onDragStart={alLevantar}
      onDragEnd={alSoltar}
      onDragCancel={() => setLevantadaId(null)}
    >
      <div className="pulso-preg" data-audit-ready="codificacion-organizar">
        {mesa.errorDeAccion ? (
          <div role="alert">
            <Alert
              kind="error"
              acciones={<PulsoButton variant="ghost" size="sm" onClick={mesa.descartarError}>Cerrar</PulsoButton>}
            >
              {mesa.errorDeAccion}
            </Alert>
          </div>
        ) : null}

        <GruposTrasDesemparejar pendiente={mesa.gruposPendientes} onListo={mesa.resolverGrupos} />

        <div className="pulso-preg-mesa">
          <Panel noPadding className="pulso-preg-lista" aria-label="Preguntas del formulario">
            <BarraPreguntas filtro={filtro} conteos={conteos} consulta={consulta} onFiltro={elegirFiltro} onBuscar={buscar} />
            <ListaUnidades
              secciones={secciones}
              hayUnidades={unidades.length > 0}
              buscando={consulta.trim() !== ""}
              seleccion={seleccion}
              ocupada={mesa.ocupada}
              recienUnida={mesa.recienUnida}
              levantada={levantada}
              onSeleccionar={seleccionar}
              onEmparejar={emparejar}
              onVerTodas={() => {
                elegirFiltro("todas");
                buscar("");
              }}
            />
          </Panel>

          <InspectorUnidad
            unidad={seleccionada}
            ocupada={seleccionada !== null && mesa.ocupada === seleccionada.id}
            incluir={
              seleccionada && admiteIncluir(seleccionada) ? (
                <IncluirEnCodificacion
                  p={seleccionada.principal}
                  busy={mesa.ocupada === seleccionada.id}
                  onIncluir={mesa.incluir}
                  onNoCategorizar={mesa.noCategorizar}
                />
              ) : null
            }
            onEmparejar={emparejar}
            onCambiar={(unidad) => mesa.abrirEmparejar(unidad.principal)}
            onDesemparejar={mesa.desemparejar}
            onElegirModo={mesa.elegirModo}
            onElegirOtros={mesa.elegirOpcionOtros}
          />
        </div>

        <div aria-live="polite" aria-atomic="true" className="pulso-sr-only">{mesa.anuncio}</div>

        {mesa.emparejando ? (
          <PairingDialog
            pregunta={mesa.emparejando}
            onConfirm={mesa.confirmarEmparejamiento}
            onCancel={() => mesa.abrirEmparejar(null)}
          />
        ) : null}

        {mesa.relacion ? (
          <RelationDialog
            source={mesa.relacion.source}
            target={mesa.relacion.target}
            onConfirm={mesa.confirmarRelacion}
            onCancel={mesa.cerrarRelacion}
          />
        ) : null}

        {mesa.buscandoPareja ? (
          <SelectorDePareja
            origen={mesa.buscandoPareja}
            candidatas={mesa.candidatos}
            onCancelar={() => mesa.abrirBuscarPareja(null)}
            onElegir={mesa.elegirPareja}
          />
        ) : null}
      </div>

      {/* El fantasma se porta a document.body: un ancestro con transform (la animación de entrada de la
          ruta) haría de bloque contenedor de su position: fixed y lo separaría del cursor. El portal
          conserva el contexto del arrastre. */}
      {createPortal(
        <DragOverlay dropAnimation={null} modifiers={[fantasmaJuntoAlCursor]}>
          {levantada ? <FantasmaArrastre pregunta={levantada.principal} /> : null}
        </DragOverlay>,
        document.body,
      )}
    </DndContext>
  );
}

/**
 * "Incluir en codificación" queda puesto en la pregunta: interruptor, no casilla, y el rótulo no cambia
 * con el estado. Una pareja entra siempre, así que su interruptor va encendido y fijo. Debajo va la
 * decisión de no codificarla (ADR 0078), que no es lo mismo: queda registrada con su motivo y no borra
 * la intención, mientras que apagar el interruptor la saca de la codificación sin dejar rastro.
 */
export function IncluirEnCodificacion({ p, busy, onIncluir, onNoCategorizar }: {
  p: PreguntaAbierta;
  busy: boolean;
  onIncluir: (parent: string, marcada: boolean) => void;
  onNoCategorizar: (parent: string, motivo: string, revertir?: boolean) => void;
}) {
  const fija = p.marcada_auto;
  const incluida = fija || p.marcada;
  const decision = decisionDePregunta(p);
  const noSeCodifica = (
    <DecisionNoCodificar
      key={p.parent}
      decision={decision}
      motivo={p.no_categorizar?.motivo}
      busy={busy}
      onRegistrar={(motivo) => onNoCategorizar(p.parent, motivo)}
      onRevertir={() => onNoCategorizar(p.parent, "", true)}
    />
  );
  // Con la decisión de no codificarla ya registrada, el interruptor encendido la contradiría: no se muestra.
  if (decision === "no_categorizar") return <div className="pulso-preg-incluir">{noSeCodifica}</div>;
  return (
    <div className="pulso-preg-incluir">
      <label className="pulso-preg-incluir-fila" data-incluida={incluida ? "" : undefined}>
        <Switch
          className="pulso-codificacion-switch"
          checked={incluida}
          disabled={busy || fija}
          onToggle={() => onIncluir(p.parent, !p.marcada)}
          ariaLabel={`Incluir ${p.parent} en el flujo de codificación`}
        />
        Incluir en codificación
      </label>
      {fija ? <p className="pulso-preg-insp-ayuda">Se incluye mientras esté emparejada.</p> : null}
      {incluida ? noSeCodifica : null}
    </div>
  );
}
