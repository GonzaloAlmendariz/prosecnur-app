// Codificar, la mesa de una pregunta (etapa P3c del rediseño de Procesamiento).
//
// Este archivo compone: una cabecera de una fila (cifras y herramientas) y dos paneles que llegan al pie,
// las respuestas a la izquierda (en tarjetas o en tabla) y los códigos a la derecha. Las piezas, los
// modelos y la hoja viven en `codificar/`; la tabla, en `tabla/`. Aquí se decide qué le pasa a los
// códigos con cada gesto y todo cambio pasa por `mesa.cambiar`, que lo guarda y lo deja deshacer.

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import type { Grupo } from "../../api/client";
import type { ModuloSugerible, PropuestaModulo } from "../../api/codificacion";
import { Alert } from "../../components/Alert";
import { Panel } from "../../components/Panel";
import { PulsoButton } from "../../components/PulsoButton";
import { ErrorBlock } from "../../components/States";
import { formatoConteo } from "../../lib/formatoNumero";
import { conModificador } from "../../lib/teclado";
import { avanceDeRespuestas } from "./avanceRespuestas";
import { ESTILO_DE_LA_CAPA_DEL_FANTASMA, anunciosDeRespuestas, fantasmaDentroDeLaVentana } from "./codificar/arrastreDeRespuestas";
import { asignarVarias, crearCodigoCon, destinoDeSuelta, quitarUltimoCodigo, siguienteCodigo } from "./codificar/asignacionEnLote";
import { BarraDeCodificar } from "./codificar/BarraDeCodificar";
import { CargaDeCodificar } from "./codificar/CargaDeCodificar";
import { FantasmaRespuestas } from "./codificar/FantasmaRespuestas";
import { claveDeArrastre } from "./codificar/FilaRespuesta";
import { FiltroDeRespuestas } from "./codificar/FiltroDeRespuestas";
import { useFiltroRespuestas } from "./codificar/filtroRespuestasStore";
import { ListaRespuestas } from "./codificar/ListaRespuestas";
import { avisosDelLote, buscarRespuestas, cifrasDeCasos, filasDeRespuestas, filtrarPorCodigo, sumarCasosConTexto, tarjetasDeCodigos } from "./codificar/modeloDeCodificar";
import { BotonModuloSugerido, propuestasPorConfirmar } from "./codificar/ModuloSugerido";
import { PanelCodigos } from "./codificar/PanelCodigos";
import {
  SELECCION_VACIA,
  reconciliarSeleccion,
  respuestasLevantadas,
  seleccionar,
  seleccionarTodo,
  seleccionTrasAsignar,
  soltarSeleccion,
} from "./codificar/seleccionRespuestas";
import { SinRespuestas, type MotivoSinRespuestas } from "./codificar/SinRespuestas";
import { useGruposDeCodificacion } from "./codificar/useGruposDeCodificacion";
import "./codificar/codificar.css";
import "./codificar/lista.css";
import "./codificar/codigos.css";
import "./codificar/ventanas.css";
import { clavesNoRespuesta, separarNoRespuestas } from "./noRespuestas";
import "./noRespuestas.css";
import { PalabrasBoton, PalabrasPanel } from "./PalabrasPanel";
import { colisionDePreguntas } from "./preguntas/arrastre";
import { SugerenciaModuloFila } from "./SugerenciaModuloFila";
import { SugerenciasModuloBanda, type UltimaConfirmacion } from "./SugerenciasModuloBanda";
import {
  confirmarSugerencias,
  deshacerConfirmacion,
  quitarSugerencia,
  rotuloDePropuesta,
  sugerenciasPorRespuesta,
  type EntradaSugerida,
  type RegistroConfirmacion,
} from "./sugerenciasModulo";
import { quitarCodigo } from "./tabla/asignacionCodigos";
import { BuscadorRespuestas } from "./tabla/BuscadorRespuestas";
import { TablaCodificar } from "./tabla/TablaCodificar";
import { codigosDeTabla } from "./tabla/tablaCodificarModelo";
import { useVistaCodificar } from "./tabla/vistaCodificarStore";
import { useSugerenciasModulo } from "./useSugerenciasModulo";

type Props = {
  parent: string;
};

const SIN_RESPUESTAS: never[] = [];

export function RespuestasCodificador({ parent }: Props) {
  const [liveMsg, setLiveMsg] = useState("");
  const anunciar = useCallback((mensaje: string) => {
    setLiveMsg(mensaje);
    window.setTimeout(() => setLiveMsg(""), 1200);
  }, []);
  const mesa = useGruposDeCodificacion(parent, anunciar);
  const { carga, grupos } = mesa;
  const respuestas = carga?.respuestas ?? null;
  const tipo = carga?.tipo ?? "";
  const colEfectiva = carga?.colEfectiva ?? "";
  // La única regla de cuándo una respuesta admite varios códigos: una múltiple con su opción "Otros".
  const esSM = tipo === "select_multiple" && !!carga?.smOtros;

  // Tarjetas o tabla, y todas o por codificar: se recuerdan entre preguntas (este componente se vuelve a montar con cada una).
  const vista = useVistaCodificar((s) => s.vista);
  const elegirVista = useVistaCodificar((s) => s.elegirVista);
  const filtro = useFiltroRespuestas((s) => s.filtro);
  const elegirFiltro = useFiltroRespuestas((s) => s.elegirFiltro);

  const [query, setQuery] = useState("");
  const [seleccionElegida, setSeleccion] = useState(SELECCION_VACIA);
  // Las respuestas que se arrastran, y las que esperan el nombre del código nuevo (`null` con el formulario cerrado).
  const [lote, setLote] = useState<{ levantadas: string[]; paraNuevo: string[] | null }>({ levantadas: [], paraNuevo: null });
  // TXT-3: la propuesta de módulo (solo texto abierto), su fila a pedido y la última confirmación por módulo.
  const [modulo, setModulo] = useState<{ abierto: boolean; version: number; ultima: { registro: RegistroConfirmacion; aviso: UltimaConfirmacion } | null }>({
    abierto: false,
    version: 0,
    ultima: null,
  });
  const idModulo = `${useId()}-modulo`;
  // TXT-6/7: guardar el diccionario de la pregunta (panel "Palabras") vuelve a pedir la propuesta.
  const alGuardarDiccionario = useCallback(() => setModulo((m) => ({ ...m, version: m.version + 1 })), []);
  const sugerencias = useSugerenciasModulo(colEfectiva, tipo === "text" && !!respuestas, modulo.version);
  const mapaSugerencias = useMemo(
    () => (sugerencias.fase === "lista" && respuestas ? sugerenciasPorRespuesta(sugerencias.datos, respuestas) : new Map<string, EntradaSugerida>()),
    [sugerencias, respuestas],
  );

  // Las respuestas a la vista: lo buscado, lo que falta si así se pidió, y las no respuestas al final (TXT-12).
  const tramos = useMemo(() => {
    const todas = respuestas ?? SIN_RESPUESTAS;
    const visibles = filtrarPorCodigo(buscarRespuestas(todas, query), grupos, filtro);
    const claves = sugerencias.fase === "lista" ? clavesNoRespuesta(sugerencias.datos, todas) : new Set<string>();
    return separarNoRespuestas(visibles, claves);
  }, [respuestas, query, grupos, filtro, sugerencias]);

  // Con código y pendientes salen de la misma lista (regla en avanceRespuestas.ts): un código guardado
  // para un texto que la base ya no trae no cuenta.
  const avance = useMemo(() => avanceDeRespuestas(respuestas, grupos), [respuestas, grupos]);
  const casos = useMemo(
    () => (esSM && respuestas ? cifrasDeCasos(respuestas, grupos, carga?.smOtros?.n_otros_marcados) : []),
    [esSM, respuestas, grupos, carga],
  );
  const codigos = useMemo(() => codigosDeTabla(grupos, respuestas ?? SIN_RESPUESTAS), [grupos, respuestas]);
  // La base de la barra de proporción de cada código: los casos que escribieron algo en la pregunta.
  const casosConTexto = useMemo(() => sumarCasosConTexto(respuestas ?? SIN_RESPUESTAS), [respuestas]);
  const filas = useMemo(() => filasDeRespuestas(tramos, grupos, codigos), [tramos, grupos, codigos]);
  const tarjetas = useMemo(() => tarjetasDeCodigos(grupos, respuestas ?? SIN_RESPUESTAS), [grupos, respuestas]);
  const orden = useMemo(() => filas.map((f) => f.clave), [filas]);
  const seleccion = useMemo(() => reconciliarSeleccion(seleccionElegida, orden), [seleccionElegida, orden]);
  const enJuego = lote.levantadas.length ? lote.levantadas : seleccion.claves;
  const avisos = useMemo(() => avisosDelLote(codigos, respuestas ?? SIN_RESPUESTAS, enJuego), [codigos, respuestas, enJuego]);

  const sensores = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const rotuloDeCodigo = (grupoId: string) => codigos.find((c) => c.id === grupoId)?.rotulo ?? "";
  const anuncios = anunciosDeRespuestas(
    (zona) => {
      const destino = destinoDeSuelta(zona);
      return destino?.tipo === "codigo" ? `el código ${rotuloDeCodigo(destino.grupoId)}` : "un código nuevo";
    },
    () => lote.levantadas.length,
  );

  // Cmd o Ctrl y Z deshace el último paso, esté donde esté el foco; un campo de texto o un diálogo abierto
  // deshacen lo suyo. (El selector busca diálogos, no dibuja uno: va sin comillas para no contarse como tal.)
  const deshacer = mesa.deshacer;
  useEffect(() => {
    function alTeclear(evento: KeyboardEvent) {
      if (!conModificador(evento) || evento.shiftKey || evento.altKey || evento.key.toLowerCase() !== "z") return;
      const origen = evento.target instanceof HTMLElement ? evento.target : null;
      if (origen && (origen.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(origen.tagName) || origen.closest("[role=dialog]"))) return;
      if (deshacer()) evento.preventDefault();
    }
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [deshacer]);

  function textoDe(clave: string): string {
    return filas.find((f) => f.clave === clave)?.texto ?? tarjetas.flatMap((t) => t.respuestas).find((r) => r.clave === clave)?.texto ?? clave;
  }
  /** `"Iglesia"` para una respuesta, `3 respuestas` para varias. */
  function nombreDelLote(claves: readonly string[]): string {
    return claves.length === 1 ? `"${textoDe(claves[0])}"` : `${formatoConteo(claves.length)} respuestas`;
  }

  // Con `esSM` el código se suma; sin él, la respuesta sale de donde esté (regla en tabla/asignacionCodigos.ts).
  function asignar(claves: readonly string[], grupoId: string, despues: "siguiente" | "quedarse" | "soltar") {
    const rotulo = rotuloDeCodigo(grupoId);
    if (!rotulo || claves.length === 0) return;
    const paso = `${nombreDelLote(claves)} ${claves.length === 1 ? "asignada" : "asignadas"} al código ${rotulo}`;
    const resultado = mesa.cambiar((gs) => asignarVarias(gs, claves, grupoId, esSM), paso);
    anunciar(`${paso}.`);
    if (despues === "soltar") setSeleccion((s) => soltarSeleccion(s));
    else if (despues === "siguiente") {
      const asignadas = new Set(resultado.flatMap((g) => g.respuestas));
      setSeleccion(seleccionTrasAsignar(claves, orden, (clave) => asignadas.has(clave)));
    }
  }

  function quitarDeCodigo(clave: string, grupoId: string) {
    const paso = `"${textoDe(clave)}" sin el código ${rotuloDeCodigo(grupoId)}`;
    mesa.cambiar((gs) => quitarCodigo(gs, clave, grupoId), paso);
    anunciar(`${paso}.`);
  }

  function quitarUltimo(claves: readonly string[]) {
    const paso = `código quitado a ${nombreDelLote(claves)}`;
    mesa.cambiar((gs) => quitarUltimoCodigo(gs, claves), paso);
    anunciar(`Se quitó el código a ${nombreDelLote(claves)}.`);
  }

  function crearCon(claves: readonly string[], nombre: string, despues: "siguiente" | "quedarse" | "soltar") {
    const id = `g_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const numero = siguienteCodigo(grupos);
    const paso = claves.length ? `código ${numero}. ${nombre} creado con ${nombreDelLote(claves)}` : `código ${numero}. ${nombre} creado`;
    const resultado = mesa.cambiar((gs) => crearCodigoCon(gs, claves, nombre, esSM, id).grupos, paso);
    anunciar(`Se creó el código ${numero}. ${nombre}.`);
    setLote((l) => ({ ...l, paraNuevo: null }));
    if (despues === "soltar") setSeleccion((s) => soltarSeleccion(s));
    else if (despues === "siguiente" && claves.length) {
      const asignadas = new Set(resultado.flatMap((g) => g.respuestas));
      setSeleccion(seleccionTrasAsignar(claves, orden, (clave) => asignadas.has(clave)));
    }
  }

  function cambiarGrupo(id: string, cambio: Partial<Grupo>) {
    mesa.cambiar((gs) => gs.map((g) => (g.id === id ? { ...g, ...cambio } : g)), "código editado");
  }

  function eliminarGrupo(id: string) {
    const rotulo = rotuloDeCodigo(id);
    mesa.cambiar((gs) => gs.filter((g) => g.id !== id), `código ${rotulo} eliminado`);
    anunciar(`Se eliminó el código ${rotulo}.`);
  }

  // El orden se guarda y es el del archivo de salida.
  function moverGrupo(id: string, hacia: "arriba" | "abajo") {
    mesa.cambiar((gs) => {
      const i = gs.findIndex((g) => g.id === id);
      const j = hacia === "arriba" ? i - 1 : i + 1;
      if (i < 0 || j < 0 || j >= gs.length) return gs;
      const lista = [...gs];
      [lista[i], lista[j]] = [lista[j], lista[i]];
      return lista;
    }, "código movido");
  }

  function confirmarPropuesta(entrada: EntradaSugerida, p: PropuestaModulo) {
    const r = rotuloDePropuesta(p);
    const paso = `"${textoDe(entrada.clave)}" confirmada en ${r.corto}`;
    mesa.cambiar((gs) => confirmarSugerencias(gs, { codigo: p.codigo, etiqueta: r.grupo }, [entrada]).grupos, paso);
    anunciar(`${paso}.`);
  }

  function quitarPropuesta(entrada: EntradaSugerida, p: PropuestaModulo) {
    const r = rotuloDePropuesta(p);
    const paso = `"${textoDe(entrada.clave)}" quitada de ${r.corto}`;
    mesa.cambiar((gs) => quitarSugerencia(gs, p.codigo, entrada.clave), paso);
    anunciar(`${paso}.`);
  }

  function confirmarModulo(m: ModuloSugerible, entradas: EntradaSugerida[]) {
    if (!entradas.length) return;
    const r = rotuloDePropuesta(m);
    const cuantas = entradas.length === 1 ? "1 respuesta" : `${formatoConteo(entradas.length)} respuestas`;
    const salida = confirmarSugerencias(grupos, { codigo: m.codigo, etiqueta: r.grupo }, entradas);
    mesa.cambiar(() => salida.grupos, `${cuantas} confirmadas en ${r.corto}`);
    setModulo((actual) => ({ ...actual, ultima: { registro: salida.registro, aviso: { modulo: r.corto, n: entradas.length } } }));
    anunciar(`${entradas.length === 1 ? "Se confirmó 1 respuesta" : `Se confirmaron ${formatoConteo(entradas.length)} respuestas`} en ${r.corto}.`);
  }

  function deshacerMasiva() {
    const ultima = modulo.ultima;
    if (!ultima) return;
    mesa.cambiar((gs) => deshacerConfirmacion(gs, ultima.registro), `confirmación en ${ultima.aviso.modulo} retirada`);
    anunciar(`Se deshizo la confirmación en ${ultima.aviso.modulo}.`);
    setModulo((actual) => ({ ...actual, ultima: null }));
  }

  function alLevantar(evento: DragStartEvent) {
    const clave = claveDeArrastre(evento.active.id);
    const levantadas = respuestasLevantadas(seleccion, clave);
    if (!seleccion.claves.includes(clave)) setSeleccion(seleccionar(seleccion, clave, "unica", orden));
    setLote((l) => ({ ...l, levantadas }));
  }

  function alSoltar(evento: DragEndEvent) {
    const levantadas = respuestasLevantadas(seleccion, claveDeArrastre(evento.active.id));
    const destino = destinoDeSuelta(evento.over?.id);
    setLote((l) => ({ levantadas: [], paraNuevo: destino?.tipo === "nuevo" ? levantadas : l.paraNuevo }));
    if (destino?.tipo === "codigo") asignar(levantadas, destino.grupoId, "soltar");
  }

  if (mesa.errorDeCarga) {
    return (
      <ErrorBlock
        label="No se pudieron cargar las respuestas"
        detail={mesa.errorDeCarga}
        queda="Los códigos guardados siguen como estaban"
        acciones={<PulsoButton variant="secondary" size="sm" onClick={mesa.reintentarCarga}>Reintentar</PulsoButton>}
      />
    );
  }
  if (!respuestas) return <CargaDeCodificar rotulo="Cargando respuestas" />;
  // En texto abierto se espera también la propuesta de módulo (o su error): la mesa se monta una vez y con sus chips.
  if (tipo === "text" && (sugerencias.fase === "cargando" || sugerencias.fase === "apagado")) return <CargaDeCodificar rotulo="Leyendo los módulos del formulario" />;

  const vacio: MotivoSinRespuestas | null =
    filas.length > 0 ? null : respuestas.length === 0 ? "sin-respuestas" : query.trim() ? "sin-coincidencias" : filtro === "sin-codigo" ? "todas-con-codigo" : "sin-respuestas";
  const verTodas = () => {
    elegirFiltro("todas");
    setQuery("");
  };
  const todasElegidas = orden.length > 0 && seleccion.claves.length === orden.length;
  const primeraLevantada = lote.levantadas[0];

  return (
    <DndContext
      sensors={sensores}
      collisionDetection={colisionDePreguntas}
      accessibility={{ announcements: anuncios }}
      onDragStart={alLevantar}
      onDragEnd={alSoltar}
      onDragCancel={() => setLote((l) => ({ ...l, levantadas: [] }))}
    >
      <div className="pulso-codificacion-respuestas pulso-cv2-rc pulso-cc-mesa" data-audit-ready="codificacion-codificar">
        <BarraDeCodificar
          avance={avance}
          casos={casos}
          guardado={mesa.guardado}
          ultimoPaso={mesa.ultimoPaso}
          onDeshacer={deshacer}
          vista={vista}
          onVista={elegirVista}
        >
          {tipo === "text" && sugerencias.fase === "lista" ? (
            <BotonModuloSugerido
              abierto={modulo.abierto}
              controla={idModulo}
              porConfirmar={propuestasPorConfirmar(mapaSugerencias, grupos)}
              onAlternar={() => setModulo((m) => ({ ...m, abierto: !m.abierto }))}
            />
          ) : null}
          {tipo === "text" && colEfectiva ? (
            <>
              <PalabrasBoton />
              <PalabrasPanel variable={colEfectiva} onGuardado={alGuardarDiccionario} />
            </>
          ) : null}
        </BarraDeCodificar>
        <div className="pulso-sr-only" aria-live="polite" aria-atomic="true">
          {liveMsg}
        </div>

        {mesa.guardado === "error" ? (
          <Alert kind="error" acciones={<PulsoButton variant="secondary" size="sm" onClick={mesa.reintentarGuardado}>Reintentar</PulsoButton>}>
            No se pudo guardar la codificación: {mesa.errorDeGuardado}
          </Alert>
        ) : null}
        {tipo === "text" && sugerencias.fase === "lista" && modulo.abierto ? (
          <div id={idModulo} className="pulso-cc-modulo">
            <SugerenciasModuloBanda
              datos={sugerencias.datos}
              mapa={mapaSugerencias}
              grupos={grupos}
              ultima={modulo.ultima?.aviso ?? null}
              onConfirmarModulo={confirmarModulo}
              onDeshacer={deshacerMasiva}
            />
          </div>
        ) : null}
        {tipo === "text" && sugerencias.fase === "error" ? (
          <p className="pulso-cv2-modsug-banda-vacia pulso-cc-nota" role="note">No se pudo proponer un módulo para estos comentarios: {sugerencias.mensaje}</p>
        ) : null}

        <div className={`pulso-cv2-split pulso-cc-split${vista === "tabla" ? " pulso-ct-split" : ""}`}>
          <Panel noPadding className="pulso-cc-panel pulso-cc-respuestas pulso-cv2-col" aria-label="Respuestas">
            <div className="pulso-cc-panel-cab">
              {vista === "tarjetas" ? (
                <input
                  type="checkbox"
                  className="pulso-cc-todas"
                  checked={todasElegidas}
                  disabled={orden.length === 0}
                  ref={(casilla) => {
                    if (casilla) casilla.indeterminate = seleccion.claves.length > 0 && !todasElegidas;
                  }}
                  onChange={() => setSeleccion(todasElegidas ? soltarSeleccion(seleccion) : seleccionarTodo(orden, seleccion))}
                  aria-label="Seleccionar todas las respuestas a la vista"
                  title="Seleccionar todas"
                />
              ) : null}
              <h3 className="pulso-cc-panel-titulo">Respuestas</h3>
              <FiltroDeRespuestas filtro={filtro} pendientes={avance.pendientes} onElegir={elegirFiltro} />
              <BuscadorRespuestas valor={query} onCambiar={setQuery} etiqueta={`Buscar respuestas de ${parent}`} placeholder="Buscar" />
            </div>
            {vacio ? (
              <SinRespuestas motivo={vacio} onVerTodas={verTodas} />
            ) : vista === "tabla" ? (
              <TablaCodificar
                pregunta={parent}
                respuestas={respuestas}
                tramos={tramos}
                grupos={grupos}
                busqueda={query}
                onBuscar={setQuery}
                buscadorPropio={false}
                permiteVarios={esSM}
                onAsignar={(clave, grupoId) => asignar([clave], grupoId, "quedarse")}
                onQuitar={quitarDeCodigo}
                onCrear={(clave, nombre) => crearCon([clave], nombre, "quedarse")}
              />
            ) : (
              <ListaRespuestas
                pregunta={parent}
                respuestas={respuestas}
                filas={filas}
                codigos={codigos}
                permiteVarios={esSM}
                seleccion={seleccion}
                onSeleccion={setSeleccion}
                levantadas={lote.levantadas}
                extraDeFila={mapaSugerencias.size > 0 ? (clave) => {
                  const entrada = mapaSugerencias.get(clave);
                  // Sin propuesta no hay nada que decir: la ausencia no lleva rótulo ("Sin módulo claro" se retiró).
                  if (!entrada?.propuestas.length) return null;
                  return (
                    <SugerenciaModuloFila
                      entrada={entrada}
                      grupos={grupos}
                      onConfirmar={(p) => { if (entrada) confirmarPropuesta(entrada, p); }}
                      onQuitar={(p) => { if (entrada) quitarPropuesta(entrada, p); }}
                    />
                  );
                } : undefined}
                onAsignar={(claves, grupoId, quedarse) => asignar(claves, grupoId, quedarse ? "quedarse" : "siguiente")}
                onCrear={(claves, nombre) => crearCon(claves, nombre, "siguiente")}
                onQuitarCodigo={quitarDeCodigo}
                onQuitarUltimo={quitarUltimo}
              />
            )}
          </Panel>

          <PanelCodigos
            tarjetas={tarjetas}
            grupos={grupos}
            respuestas={respuestas}
            casosConTexto={casosConTexto}
            permiteVarios={esSM}
            arrastrando={lote.levantadas.length > 0}
            avisos={avisos}
            siguiente={siguienteCodigo(grupos)}
            pendientesDeNuevo={lote.paraNuevo ? lote.paraNuevo.length : null}
            onAbrirNuevo={() => setLote((l) => ({ ...l, paraNuevo: l.paraNuevo ?? [] }))}
            onCrear={(nombre) => crearCon(lote.paraNuevo ?? [], nombre, "soltar")}
            onCancelarNuevo={() => setLote((l) => ({ ...l, paraNuevo: null }))}
            onCambiar={cambiarGrupo}
            onEliminar={eliminarGrupo}
            onMover={moverGrupo}
            onQuitarRespuesta={quitarDeCodigo}
            onAgregarRespuesta={(clave, grupoId) => asignar([clave], grupoId, "quedarse")}
          />
        </div>
      </div>

      {/* El fantasma se porta a document.body: un ancestro con transform haría de bloque contenedor de su
          position: fixed y lo separaría del cursor. El portal conserva el contexto del arrastre. */}
      {createPortal(
        <DragOverlay dropAnimation={null} modifiers={[fantasmaDentroDeLaVentana]} style={ESTILO_DE_LA_CAPA_DEL_FANTASMA}>
          {primeraLevantada ? <FantasmaRespuestas texto={textoDe(primeraLevantada)} cuantas={lote.levantadas.length} /> : null}
        </DragOverlay>,
        document.body,
      )}
    </DndContext>
  );
}
