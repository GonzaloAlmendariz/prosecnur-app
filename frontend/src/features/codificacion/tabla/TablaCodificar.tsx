import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useReducer, useRef, useState, type KeyboardEvent } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { Grupo, RespuestaUnica } from "../../../api/codificacion";
import { EstadoVacio } from "../../../components/EstadoVacio";
import { PULSO_TABLE_UMBRAL_VIRTUAL } from "../../../components/PulsoTable";
import { formatoConteo } from "../../../lib/formatoNumero";
import { ArrowDown, ArrowUp, Inbox, Search } from "../../../vendor/lucide-react";
import { BuscadorRespuestas } from "./BuscadorRespuestas";
import { CampoCodigo } from "./CampoCodigo";
import { FilaCodificar } from "./FilaCodificar";
import { ListaCodigos, idDeOpcion } from "./ListaCodigos";
import {
  EDITOR_INICIAL,
  campoDeLaFila,
  claveActivaVigente,
  codigosDeTabla,
  elementosDeTabla,
  filaSiguienteSinCodigo,
  filaVecina,
  filasDeTabla,
  intencionDeTecla,
  opcionesDeLista,
  reducirEditor,
  type ElementoTabla,
  type TramosDeRespuestas,
} from "./tablaCodificarModelo";
import { useVistaCodificar } from "./vistaCodificarStore";
// Los botones de orden de la cabecera son los del kit (`.pulso-table-orden`).
import "../../../components/kit-table.css";
import "./tablaCodificar.css";

export type TablaCodificarProps = {
  /** Nombre de la pregunta, para los nombres accesibles. */
  pregunta: string;
  /** Todas las respuestas de la pregunta: de aquí salen los casos de cada código, se busque lo que se busque. */
  respuestas: readonly RespuestaUnica[];
  /** Las respuestas a la vista (ya filtradas por la búsqueda), con las no respuestas aparte. */
  tramos: TramosDeRespuestas;
  grupos: readonly Grupo[];
  busqueda: string;
  onBuscar: (texto: string) => void;
  /** La pregunta admite más de un código por respuesta. Lo decide quien monta la tabla. */
  permiteVarios: boolean;
  onAsignar: (clave: string, grupoId: string) => void;
  onQuitar: (clave: string, grupoId: string) => void;
  /** Crea un código con ese nombre y se lo asigna a la respuesta. */
  onCrear: (clave: string, nombre: string) => void;
};

/** Alto de la cabecera mientras no se mide (`--pulso-control-height-lg`). */
const ALTO_CABECERA = 36;
/** Alto de partida de una fila para la lista virtual; cada fila se mide al pintarse. */
const ALTO_FILA_ESTIMADO = 45;

function claveDeElemento(elemento: ElementoTabla | undefined, indice: number): string | number {
  if (!elemento) return indice;
  return elemento.tipo === "fila" ? `fila:${elemento.fila.clave}` : "tramo";
}

/**
 * Vista de tabla de Codificar: una fila por texto distinto, con sus veces y la celda del código, pensada
 * para recorrer muchas respuestas con el teclado. No guarda nada: pide a quien la monta que asigne, quite
 * o cree, que es quien conoce los grupos y los guarda.
 */
export function TablaCodificar({
  pregunta,
  respuestas,
  tramos,
  grupos,
  busqueda,
  onBuscar,
  permiteVarios,
  onAsignar,
  onQuitar,
  onCrear,
}: TablaCodificarProps) {
  const orden = useVistaCodificar((s) => s.orden);
  const elegirOrden = useVistaCodificar((s) => s.elegirOrden);

  const codigos = useMemo(() => codigosDeTabla(grupos, respuestas), [grupos, respuestas]);
  const filas = useMemo(() => filasDeTabla(tramos, grupos, codigos, orden), [tramos, grupos, codigos, orden]);
  const elementos = useMemo(() => elementosDeTabla(filas), [filas]);

  const [editor, despachar] = useReducer(reducirEditor, EDITOR_INICIAL);
  // La fila activa no salta sola: mientras siga a la vista vale la última que lo fue, aunque otra fila
  // pierda su código y pase a ser "la primera sin código".
  const ultimaActiva = useRef<string | null>(null);
  const claveActiva = claveActivaVigente(filas, editor.activa, ultimaActiva.current);
  ultimaActiva.current = claveActiva;
  const filaActiva = useMemo(() => filas.find((f) => f.clave === claveActiva) ?? null, [filas, claveActiva]);
  const { texto, abierta } = campoDeLaFila(editor, claveActiva);
  const opciones = useMemo(
    () => (filaActiva && abierta ? opcionesDeLista(codigos, filaActiva, texto) : []),
    [codigos, filaActiva, abierta, texto],
  );
  const cursor = opciones.length ? Math.min(editor.cursor, opciones.length - 1) : 0;

  const idBase = useId();
  const listaId = `${idBase}-lista`;
  const ayudaId = `${idBase}-teclas`;

  const marco = useRef<HTMLDivElement | null>(null);
  const cabecera = useRef<HTMLDivElement | null>(null);
  const campo = useRef<HTMLInputElement | null>(null);
  // Solo una acción del analista (flechas, Enter, clic) lleva el foco y el desplazamiento a la fila
  // activa. Al montar la tabla no se mueve nada: el foco sigue donde estaba.
  const enfocarPendiente = useRef(false);
  const desplazarPendiente = useRef(false);

  const [altoCabecera, setAltoCabecera] = useState(ALTO_CABECERA);
  useLayoutEffect(() => {
    const alto = cabecera.current?.offsetHeight ?? 0;
    if (alto > 0 && alto !== altoCabecera) setAltoCabecera(alto);
  });

  // Con muchas filas solo se pintan las visibles, desde el mismo umbral que la tabla del kit. Las filas
  // miden distinto (el texto parte línea, una celda lleva varios códigos), así que cada una se mide.
  const virtualiza = elementos.length > PULSO_TABLE_UMBRAL_VIRTUAL;
  const claveDeIndice = useCallback((indice: number) => claveDeElemento(elementos[indice], indice), [elementos]);
  const virtualizador = useVirtualizer({
    count: virtualiza ? elementos.length : 0,
    getScrollElement: () => marco.current,
    estimateSize: () => ALTO_FILA_ESTIMADO,
    overscan: 8,
    scrollMargin: altoCabecera,
    scrollPaddingStart: altoCabecera,
    getItemKey: claveDeIndice,
  });
  const items = virtualiza ? virtualizador.getVirtualItems() : [];
  const relleno =
    virtualiza && items.length
      ? {
          arriba: Math.max(0, items[0].start - altoCabecera),
          abajo: Math.max(0, virtualizador.getTotalSize() - (items[items.length - 1].end - altoCabecera)),
        }
      : { arriba: 0, abajo: 0 };
  const pintados = virtualiza
    ? items.map((item) => ({ elemento: elementos[item.index], indice: item.index }))
    : elementos.map((elemento, indice) => ({ elemento, indice }));

  useEffect(() => {
    if (!desplazarPendiente.current || claveActiva === null) return;
    desplazarPendiente.current = false;
    if (virtualiza) {
      const indice = elementos.findIndex((e) => e.tipo === "fila" && e.fila.clave === claveActiva);
      if (indice >= 0) virtualizador.scrollToIndex(indice, { align: "auto" });
      return;
    }
    // Se mueve solo el marco de la tabla; `scrollIntoView` arrastraría también a la página.
    const caja = marco.current;
    const fila = caja?.querySelector<HTMLElement>("[data-activa]");
    if (!caja || !fila) return;
    const c = caja.getBoundingClientRect();
    const r = fila.getBoundingClientRect();
    const techo = c.top + altoCabecera;
    if (r.top < techo) caja.scrollTop -= techo - r.top;
    else if (r.bottom > c.bottom) caja.scrollTop += r.bottom - c.bottom;
  }, [claveActiva, elementos, virtualiza, virtualizador, altoCabecera]);

  const fijarCampo = useCallback((elemento: HTMLInputElement | null) => {
    campo.current = elemento;
    if (elemento && enfocarPendiente.current) {
      enfocarPendiente.current = false;
      elemento.focus({ preventScroll: true });
    }
  }, []);

  const activar = useCallback((clave: string) => {
    if (clave === ultimaActiva.current && campo.current) {
      campo.current.focus({ preventScroll: true });
      return;
    }
    enfocarPendiente.current = true;
    desplazarPendiente.current = true;
    despachar({ tipo: "activar", clave });
  }, []);

  const cerrar = useCallback(() => despachar({ tipo: "cerrar" }), []);

  function moverFila(paso: 1 | -1) {
    const vecina = filaVecina(filas, claveActiva, paso);
    if (vecina !== null && vecina !== claveActiva) activar(vecina);
  }

  function elegir(indice: number, avanza: boolean) {
    const opcion = opciones[indice];
    if (!opcion || !filaActiva) return;
    if (opcion.tipo === "crear") onCrear(filaActiva.clave, opcion.nombre);
    else onAsignar(filaActiva.clave, opcion.codigo.id);
    const siguiente = avanza ? filaSiguienteSinCodigo(filas, filaActiva.clave) : null;
    if (siguiente) activar(siguiente);
    // Se queda en la fila con el campo vacío: para sumar otro código o porque no quedan filas sin código.
    else despachar({ tipo: "activar", clave: filaActiva.clave });
  }

  function alTeclear(evento: KeyboardEvent<HTMLInputElement>) {
    if (!filaActiva || evento.nativeEvent.isComposing) return;
    const intencion = intencionDeTecla(
      { key: evento.key, shiftKey: evento.shiftKey, altKey: evento.altKey, repeat: evento.repeat },
      { abierta, nOpciones: opciones.length, texto, permiteVarios, nCodigos: filaActiva.codigos.length },
    );
    if (!intencion) return;
    evento.preventDefault();
    switch (intencion.tipo) {
      case "mover-fila":
        moverFila(intencion.paso);
        break;
      case "mover-cursor":
        despachar({ tipo: "cursor", indice: (cursor + intencion.paso + opciones.length) % opciones.length });
        break;
      case "asignar":
        elegir(cursor, intencion.avanza);
        break;
      case "abrir":
        despachar({ tipo: "abrir", clave: filaActiva.clave });
        break;
      case "cerrar":
        cerrar();
        break;
      case "limpiar":
        despachar({ tipo: "activar", clave: filaActiva.clave });
        break;
      case "quitar-ultimo":
        onQuitar(filaActiva.clave, filaActiva.codigos[filaActiva.codigos.length - 1].id);
        break;
    }
  }

  const marcador =
    filaActiva && filaActiva.codigos.length > 0
      ? permiteVarios
        ? "Sumar otro código"
        : "Cambiar el código"
      : "Número o nombre";

  return (
    <div className="pulso-ct">
      <BuscadorRespuestas valor={busqueda} onCambiar={onBuscar} etiqueta={`Buscar respuestas de ${pregunta}`} />

      <div ref={marco} className="pulso-cv2-resp-list pulso-ct-marco">
        {filas.length === 0 ? (
          busqueda.trim() ? (
            <EstadoVacio icono={<Search size={16} />} titulo="No hay respuestas que coincidan" />
          ) : (
            <EstadoVacio icono={<Inbox size={16} />} titulo="Esta pregunta no tiene respuestas" />
          )
        ) : (
          <div
            role="table"
            className="pulso-ct-tabla"
            aria-label={`Respuestas de ${pregunta} y sus códigos`}
            aria-rowcount={elementos.length + 1}
          >
            <div ref={cabecera} role="rowgroup" className="pulso-ct-cab">
              <div role="row" aria-rowindex={1} className="pulso-ct-cab-fila">
                {/* El orden se elige en la cabecera, como en las tablas del kit: por texto o por veces. */}
                <div role="columnheader" className="pulso-ct-c-resp" aria-sort={orden === "alfabetico" ? "ascending" : undefined}>
                  <button type="button" className="pulso-table-orden" title="Ordenar alfabéticamente" onClick={() => elegirOrden("alfabetico")}>
                    Respuesta
                    {orden === "alfabetico" ? <ArrowUp size={11} aria-hidden="true" /> : null}
                  </button>
                </div>
                <div role="columnheader" className="pulso-ct-c-veces" aria-sort={orden === "frecuencia" ? "descending" : undefined}>
                  <button type="button" className="pulso-table-orden" title="Ordenar de más a menos repetidas" onClick={() => elegirOrden("frecuencia")}>
                    Veces
                    {orden === "frecuencia" ? <ArrowDown size={11} aria-hidden="true" /> : null}
                  </button>
                </div>
                <div role="columnheader" className="pulso-ct-c-cod">Código</div>
              </div>
            </div>
            {/* C1: las filas miden lo que su texto y sus códigos; el marco de arriba es el dueño del desplazamiento. */}
            <div
              role="rowgroup"
              className="pulso-ct-cuerpo"
              data-qa-geometry-group="codificacion/respuestas-tabla"
              data-qa-geometry-contract="intrinsic"
            >
              {relleno.arriba > 0 ? <div aria-hidden="true" style={{ height: relleno.arriba }} /> : null}
              {pintados.map(({ elemento, indice }) =>
                elemento.tipo === "tramo" ? (
                  <div
                    key="tramo"
                    ref={virtualiza ? virtualizador.measureElement : undefined}
                    role="row"
                    aria-rowindex={indice + 2}
                    data-index={indice}
                  >
                    <div role="cell" aria-colspan={3} className="pulso-cv2-resp-tramo">
                      <span className="pulso-cv2-resp-tramo-titulo">No responden</span>
                      <span className="pulso-cv2-resp-tramo-n">
                        {formatoConteo(elemento.n)} {elemento.n === 1 ? "respuesta" : "respuestas"} como "No", "." o "Ninguno"
                      </span>
                    </div>
                  </div>
                ) : (
                  <FilaCodificar
                    key={elemento.fila.clave}
                    fila={elemento.fila}
                    indice={indice}
                    activa={elemento.fila.clave === claveActiva}
                    onActivar={activar}
                    onQuitar={onQuitar}
                    alMontar={virtualiza ? virtualizador.measureElement : undefined}
                    campo={
                      elemento.fila.clave === claveActiva ? (
                        <CampoCodigo
                          ref={fijarCampo}
                          respuesta={elemento.fila.texto}
                          texto={texto}
                          abierta={abierta}
                          listaId={opciones.length ? listaId : undefined}
                          opcionActiva={opciones.length ? idDeOpcion(listaId, cursor) : undefined}
                          ayudaId={ayudaId}
                          marcador={marcador}
                          onEscribir={(valor) => despachar({ tipo: "escribir", clave: elemento.fila.clave, texto: valor })}
                          onTecla={alTeclear}
                          onAbrir={() => despachar({ tipo: "abrir", clave: elemento.fila.clave })}
                          onCerrar={cerrar}
                        />
                      ) : undefined
                    }
                  />
                ),
              )}
              {relleno.abajo > 0 ? <div aria-hidden="true" style={{ height: relleno.abajo }} /> : null}
            </div>
          </div>
        )}
      </div>

      <p id={ayudaId} className="pulso-ct-teclas">
        <span>
          <kbd>
            <ArrowUp size={11} aria-hidden="true" />
            <span className="pulso-sr-only">Flecha arriba</span>
          </kbd>
          <kbd>
            <ArrowDown size={11} aria-hidden="true" />
            <span className="pulso-sr-only">Flecha abajo</span>
          </kbd>
          Moverse
        </span>
        <span>
          <kbd>Enter</kbd>
          Asignar
        </span>
        {permiteVarios ? (
          <span>
            <kbd>Mayús</kbd>
            <kbd>Enter</kbd>
            Otro código
          </span>
        ) : null}
      </p>

      {abierta && filaActiva ? (
        <ListaCodigos
          id={listaId}
          ancla={campo}
          opciones={opciones}
          cursor={cursor}
          consulta={texto}
          etiqueta={`Códigos para "${filaActiva.texto}"`}
          onCursor={(indice) => despachar({ tipo: "cursor", indice })}
          onElegir={(indice, conMayus) => elegir(indice, !(conMayus && permiteVarios))}
          onCerrar={cerrar}
        />
      ) : null}
    </div>
  );
}
