import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { RespuestaUnica } from "../../../api/codificacion";
import { PULSO_TABLE_UMBRAL_VIRTUAL } from "../../../components/PulsoTable";
import { formatoConteo } from "../../../lib/formatoNumero";
import { conModificador } from "../../../lib/teclado";
import type { CodigoTabla } from "../tabla/tablaCodificarModelo";
import type { AsignarACodigoRef } from "./AsignarACodigo";
import { BarraDeSeleccion } from "./BarraDeSeleccion";
import { FilaRespuesta } from "./FilaRespuesta";
import { marcasDelLote, type FilaDeRespuesta } from "./modeloDeCodificar";
import {
  moverCursor,
  seleccionar,
  seleccionarTodo,
  soltarSeleccion,
  type ModoDeSeleccion,
  type SeleccionRespuestas,
} from "./seleccionRespuestas";
import { ESPERA_DE_SEGUNDA_CIFRA_MS, intencionDeLista, resolverCodigoTecleado } from "./teclasDeCodificar";
import { AyudaDeTeclas } from "./AyudaDeTeclas";

export type ListaRespuestasProps = {
  /** Nombre de la pregunta, para los nombres accesibles. */
  pregunta: string;
  /** Todas las respuestas de la pregunta: de aquí salen las marcas previas del lote seleccionado. */
  respuestas: readonly RespuestaUnica[];
  /** Las filas a la vista, ya buscadas y filtradas, con las no respuestas al final. */
  filas: readonly FilaDeRespuesta[];
  codigos: readonly CodigoTabla[];
  /** La pregunta admite más de un código por respuesta. Lo decide quien monta la lista. */
  permiteVarios: boolean;
  seleccion: SeleccionRespuestas;
  onSeleccion: (seleccion: SeleccionRespuestas) => void;
  /** Las respuestas que se están arrastrando. */
  levantadas: readonly string[];
  /** Lo que la mesa agrega a cada fila (la propuesta de módulo de un texto abierto). */
  extraDeFila?: (clave: string) => ReactNode;
  /** `quedarse` deja la selección donde está, para sumar otro código a las mismas respuestas. */
  onAsignar: (claves: string[], grupoId: string, quedarse: boolean) => void;
  onCrear: (claves: string[], nombre: string) => void;
  onQuitarCodigo: (clave: string, grupoId: string) => void;
  onQuitarUltimo: (claves: string[]) => void;
};

/** Alto de partida de una fila para la lista virtual; cada fila se mide al pintarse. */
const ALTO_FILA_ESTIMADO = 40;

type Elemento = { tipo: "fila"; fila: FilaDeRespuesta } | { tipo: "tramo"; n: number };

/**
 * La lista de respuestas de la vista de tarjetas: dueña de su desplazamiento y de su vacío. El tabulador
 * entra a una sola fila; las flechas mueven la selección, el número de un código la asigna y Supr le
 * quita el código. No guarda nada: pide a quien la monta que asigne, quite o cree.
 */
export function ListaRespuestas({
  pregunta,
  respuestas,
  filas,
  codigos,
  permiteVarios,
  seleccion,
  onSeleccion,
  levantadas,
  extraDeFila,
  onAsignar,
  onCrear,
  onQuitarCodigo,
  onQuitarUltimo,
}: ListaRespuestasProps) {
  const orden = useMemo(() => filas.map((f) => f.clave), [filas]);
  const elegidas = useMemo(() => new Set(seleccion.claves), [seleccion.claves]);
  const enArrastre = useMemo(() => new Set(levantadas), [levantadas]);
  const elementos = useMemo<Elemento[]>(() => {
    const lista: Elemento[] = [];
    const noResponden = filas.filter((f) => f.noResponde).length;
    let separado = false;
    for (const fila of filas) {
      if (fila.noResponde && !separado) {
        lista.push({ tipo: "tramo", n: noResponden });
        separado = true;
      }
      lista.push({ tipo: "fila", fila });
    }
    return lista;
  }, [filas]);

  const marco = useRef<HTMLDivElement | null>(null);
  const barra = useRef<AsignarACodigoRef | null>(null);
  const ayudaId = `${useId()}-teclas`;
  // Solo una acción del analista lleva el foco y el desplazamiento a la fila del cursor.
  const enfocarPendiente = useRef(false);

  // Las cifras del número de código que se están escribiendo, y si el código se suma sin soltar la selección.
  const [cifras, setCifras] = useState("");
  const [aviso, setAviso] = useState("");
  const espera = useRef<number | null>(null);
  const quedarse = useRef(false);
  const cancelarEspera = useCallback(() => {
    if (espera.current !== null) window.clearTimeout(espera.current);
    espera.current = null;
  }, []);
  useEffect(() => cancelarEspera, [cancelarEspera]);
  useEffect(() => {
    if (!aviso) return undefined;
    const reloj = window.setTimeout(() => setAviso(""), 2400);
    return () => window.clearTimeout(reloj);
  }, [aviso]);

  // Con muchas filas solo se pintan las visibles, desde el mismo umbral que la tabla del kit.
  const virtualiza = elementos.length > PULSO_TABLE_UMBRAL_VIRTUAL;
  const claveDeIndice = useCallback(
    (indice: number) => {
      const e = elementos[indice];
      return !e ? indice : e.tipo === "fila" ? `fila:${e.fila.clave}` : "tramo";
    },
    [elementos],
  );
  const virtualizador = useVirtualizer({
    count: virtualiza ? elementos.length : 0,
    getScrollElement: () => marco.current,
    estimateSize: () => ALTO_FILA_ESTIMADO,
    overscan: 8,
    getItemKey: claveDeIndice,
  });
  const items = virtualiza ? virtualizador.getVirtualItems() : [];
  const relleno =
    virtualiza && items.length
      ? { arriba: items[0].start, abajo: Math.max(0, virtualizador.getTotalSize() - items[items.length - 1].end) }
      : { arriba: 0, abajo: 0 };
  const pintados = virtualiza
    ? items.map((item) => ({ elemento: elementos[item.index], indice: item.index }))
    : elementos.map((elemento, indice) => ({ elemento, indice }));

  // La fila del tabulador: la del cursor o, si no está a la vista, la primera.
  const tabulable = seleccion.cursor !== null && orden.includes(seleccion.cursor) ? seleccion.cursor : orden[0] ?? null;

  useEffect(() => {
    if (!enfocarPendiente.current) return;
    const clave = tabulable;
    if (clave === null) {
      enfocarPendiente.current = false;
      return;
    }
    const caja = marco.current;
    const boton = caja?.querySelector<HTMLElement>(`[data-fila-respuesta="${CSS.escape(clave)}"]`);
    if (!caja || !boton) {
      // Fila fuera de lo pintado: se desplaza hasta ella y el foco llega en el siguiente pintado.
      const indice = elementos.findIndex((e) => e.tipo === "fila" && e.fila.clave === clave);
      if (virtualiza && indice >= 0) virtualizador.scrollToIndex(indice, { align: "auto" });
      else enfocarPendiente.current = false;
      return;
    }
    enfocarPendiente.current = false;
    boton.focus({ preventScroll: true });
    // Se mueve solo el marco de la lista; `scrollIntoView` arrastraría también a la página.
    const fila = boton.closest<HTMLElement>(".pulso-cc-fila") ?? boton;
    const c = caja.getBoundingClientRect();
    const r = fila.getBoundingClientRect();
    if (r.top < c.top) caja.scrollTop -= c.top - r.top;
    else if (r.bottom > c.bottom) caja.scrollTop += r.bottom - c.bottom;
  });

  const pulsar = useCallback(
    (clave: string, modo: ModoDeSeleccion) => {
      // Un clic en cualquier punto de la fila deja el foco en ella: las teclas actúan sobre lo elegido.
      enfocarPendiente.current = true;
      onSeleccion(seleccionar(seleccion, clave, modo, orden));
    },
    [onSeleccion, seleccion, orden],
  );

  function asignar(grupoId: string, seQueda: boolean) {
    if (seleccion.claves.length === 0) return;
    enfocarPendiente.current = true;
    onAsignar(seleccion.claves, grupoId, seQueda);
  }

  function confirmarCifras(escritas: string) {
    cancelarEspera();
    setCifras("");
    const resolucion = resolverCodigoTecleado(escritas, codigos, true);
    if (resolucion.tipo === "asignar") asignar(resolucion.grupoId, quedarse.current);
    else setAviso(`Ningún código lleva el número ${escritas}`);
  }

  function teclearCifra(cifra: string, seQueda: boolean) {
    cancelarEspera();
    const escritas = `${cifras}${cifra}`;
    quedarse.current = seQueda;
    const resolucion = resolverCodigoTecleado(escritas, codigos);
    if (resolucion.tipo === "asignar") {
      setCifras("");
      setAviso("");
      asignar(resolucion.grupoId, seQueda);
    } else if (resolucion.tipo === "esperar") {
      setCifras(escritas);
      setAviso("");
      espera.current = window.setTimeout(() => confirmarCifras(escritas), ESPERA_DE_SEGUNDA_CIFRA_MS);
    } else {
      setCifras("");
      setAviso(`Ningún código lleva el número ${escritas}`);
    }
  }

  function alTeclear(evento: KeyboardEvent<HTMLUListElement>) {
    // Solo desde el botón de una fila: dentro de una insignia o de una propuesta, las teclas son suyas.
    if (!(evento.target as HTMLElement).closest("[data-fila-respuesta]")) return;
    const intencion = intencionDeLista(
      { key: evento.key, code: evento.code, shiftKey: evento.shiftKey, altKey: evento.altKey, modificador: conModificador(evento), repeat: evento.repeat },
      { cifras, seleccionadas: seleccion.claves.length },
    );
    if (!intencion) return;
    evento.preventDefault();
    switch (intencion.tipo) {
      case "cifra":
        teclearCifra(intencion.cifra, intencion.quedarse && permiteVarios);
        break;
      case "confirmar-cifras":
        confirmarCifras(cifras);
        break;
      case "descartar-cifras":
        cancelarEspera();
        setCifras("");
        break;
      case "mover":
        enfocarPendiente.current = true;
        onSeleccion(moverCursor(seleccion, intencion.destino, orden, intencion.extender));
        break;
      case "alternar":
        if (tabulable !== null) onSeleccion(seleccionar(seleccion, tabulable, "alternar", orden));
        break;
      case "abrir-lista":
        barra.current?.enfocar();
        break;
      case "quitar-codigo":
        onQuitarUltimo(seleccion.claves);
        break;
      case "soltar":
        onSeleccion(soltarSeleccion(seleccion));
        break;
      case "todo":
        onSeleccion(seleccionarTodo(orden, seleccion));
        break;
    }
  }

  const lote = useMemo(() => marcasDelLote(respuestas, seleccion.claves), [respuestas, seleccion.claves]);
  const filasElegidas = useMemo(() => filas.filter((f) => elegidas.has(f.clave)), [filas, elegidas]);
  const comunes = useMemo(() => {
    if (filasElegidas.length === 0) return [];
    return filasElegidas[0].codigos.filter((c) => filasElegidas.every((f) => f.codigos.some((x) => x.id === c.id)));
  }, [filasElegidas]);
  const hayBarra = seleccion.claves.length > 0 && levantadas.length === 0;

  return (
    <div className="pulso-cc-lista" data-con-barra={hayBarra ? "" : undefined}>
      <div
        ref={marco}
        className="pulso-cc-lista-marco"
        // C1: las filas miden lo que su texto y sus códigos; este marco es el dueño del desplazamiento y del vacío.
        data-qa-geometry-group="codificacion/respuestas"
        data-qa-geometry-contract="intrinsic"
        data-qa-geometry-capacity="owned"
      >
        <ul
          className="pulso-cc-filas"
          // C1: las filas de la lista, de alto propio (una respuesta larga parte en renglones).
          data-qa-geometry-group="codificacion/respuestas-filas"
          data-qa-geometry-contract="intrinsic"
          aria-label={`Respuestas de ${pregunta}`}
          aria-describedby={ayudaId}
          onKeyDown={alTeclear}
        >
          {relleno.arriba > 0 ? <li aria-hidden="true" style={{ height: relleno.arriba }} /> : null}
          {pintados.map(({ elemento, indice }) =>
            elemento.tipo === "tramo" ? (
              <li
                key="tramo"
                ref={virtualiza ? virtualizador.measureElement : undefined}
                data-index={indice}
                className="pulso-cv2-resp-tramo"
                data-qa-geometry-member="no-respuestas"
              >
                <span className="pulso-cv2-resp-tramo-titulo">No responden</span>
                <span className="pulso-cv2-resp-tramo-n">
                  {formatoConteo(elemento.n)} {elemento.n === 1 ? "respuesta" : "respuestas"} como "No", "." o "Ninguno"
                </span>
              </li>
            ) : (
              <FilaRespuesta
                key={elemento.fila.clave}
                fila={elemento.fila}
                indice={indice}
                seleccionada={elegidas.has(elemento.fila.clave)}
                tabulable={elemento.fila.clave === tabulable}
                levantada={enArrastre.has(elemento.fila.clave)}
                extra={extraDeFila?.(elemento.fila.clave)}
                onPulsar={pulsar}
                onQuitar={onQuitarCodigo}
                alMontar={virtualiza ? virtualizador.measureElement : undefined}
              />
            ),
          )}
          {relleno.abajo > 0 ? <li aria-hidden="true" style={{ height: relleno.abajo }} /> : null}
        </ul>
      </div>

      {hayBarra ? (
        <BarraDeSeleccion
          ref={barra}
          seleccionadas={seleccion.claves.length}
          conCodigo={filasElegidas.filter((f) => f.codigos.length > 0).length}
          cifras={cifras}
          aviso={aviso}
          codigos={codigos}
          comunes={comunes}
          marcas={lote.marcas}
          veces={lote.veces}
          onAsignar={(grupoId) => asignar(grupoId, false)}
          onCrear={(nombre) => {
            enfocarPendiente.current = true;
            onCrear(seleccion.claves, nombre);
          }}
          onQuitar={() => onQuitarUltimo(seleccion.claves)}
          onSoltar={() => onSeleccion(soltarSeleccion(seleccion))}
          onSalir={() => {
            enfocarPendiente.current = true;
            onSeleccion({ ...seleccion });
          }}
        />
      ) : null}

      <AyudaDeTeclas id={ayudaId} permiteVarios={permiteVarios} />
    </div>
  );
}
