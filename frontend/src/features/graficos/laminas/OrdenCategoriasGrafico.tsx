// Fila «Orden» de la tarjeta de un gráfico categórico, agrupado, de torta o de dona (D8; contrato
// docs/qa/contrato-orden-categorias-f6-2026-10-10.md). Recetario por defecto —y dice qué modo aplica—, Frecuencia,
// Instrumento o Personalizado (lista arrastrable con ratón y con teclado; la clave es el código, se ve la etiqueta) e
// «Invertir». Persiste en `args.orden_categorias` del gráfico. Encima de la lista, los avisos que el backend da de la
// pregunta (decisión 4, §7): se ramifica por `codigo`, nunca por el texto.

import { useId, useRef, useState, type DragEvent, type KeyboardEvent } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, GripVertical, Info, Loader2, RefreshCw } from "../../../vendor/lucide-react";
import { Switch } from "../../../components/Switch";
import type { GraficosCategorias } from "../../../api/graficos";
import {
  ATRIBUTO_ACCION_ORDEN,
  categoriasSinRespuestas,
  enfocarTrasMover,
  leerAvisosOrden,
  leerOrden,
  listaDesdeMostrado,
  listaPersonalizada,
  ordenMostrado,
  mover,
  NO_SE_DIBUJA,
  ordenAGuardar,
  rotuloRecetario,
  tieneOrdenHeredado,
  type ModoOrden,
  type NotaOrden,
  type OrdenCategorias,
} from "./ordenCategorias";
import { useCategoriasGrafico } from "./useCategoriasGrafico";
import "./ordenCategorias.css";

type Props = {
  /** Calificada `base$var` (`varCalificada`). */
  variable: string;
  /** Id del graficador: con él el backend avisa si el orden no aplica (escalas). */
  graficador: string;
  args: Readonly<Record<string, unknown>>;
  scope: "active" | "consolidated";
  onCambio: (orden: OrdenCategorias | null) => void;
};

export function OrdenCategoriasGrafico({ variable, graficador, args, scope, onCambio }: Props) {
  const id = useId();
  const estado = useCategoriasGrafico(variable, scope, graficador);
  const orden = leerOrden(args);
  const heredado = tieneOrdenHeredado(args);
  const datos = estado.fase === "lista" ? estado.datos : null;
  const { notas, escala } = leerAvisosOrden(datos);
  const escalaId = `${id}-escala`;

  const guardar = (o: OrdenCategorias) => onCambio(ordenAGuardar(o));
  const cambiarModo = (modo: ModoOrden) => {
    if (modo === "personalizado" && datos) guardar({ ...orden, modo, lista: listaPersonalizada(orden.lista, datos) });
    else guardar({ ...orden, modo });
  };

  return (
    <div className="pulso-f6-dato is-apilado pulso-f6-orden" data-qa-geometry-group="graficos/f6-orden" data-qa-geometry-contract="intrinsic">
      <div className="pulso-f6-orden-cabeza">
        <label className="pulso-f6-dato-rotulo" htmlFor={`${id}-modo`}>Orden</label>
        <select
          id={`${id}-modo`}
          className="pulso-f6-input pulso-f6-dato-select"
          value={orden.modo}
          disabled={escala !== null}
          aria-describedby={escala ? escalaId : undefined}
          onChange={(e) => cambiarModo(e.target.value as ModoOrden)}
        >
          <option value="recetario">{rotuloRecetario(datos, heredado)}</option>
          <option value="frecuencia">Frecuencia</option>
          <option value="instrumento">Instrumento</option>
          <option value="personalizado" disabled={!datos}>Personalizado</option>
        </select>
      </div>
      {/* El Switch compartido no acepta aria-describedby: la nota se enlaza al grupo que lo contiene. */}
      <div
        className="pulso-f6-orden-invertir"
        role="group"
        aria-labelledby={`${id}-inv`}
        aria-describedby={escala ? escalaId : undefined}
      >
        <span className="pulso-f6-dato-rotulo" id={`${id}-inv`}>Invertir</span>
        <Switch
          checked={orden.invertir}
          ariaLabel="Invertir el orden"
          disabled={escala !== null}
          onToggle={() => guardar({ ...orden, invertir: !orden.invertir })}
        />
      </div>
      {escala && <NotaAviso nota={escala} id={escalaId} />}
      {orden.modo === "recetario" && heredado && (
        <span className="pulso-f6-dato-ayuda">Este gráfico trae un orden elegido antes; manda mientras no elijas otro modo.</span>
      )}
      <EstadoDatos estado={estado} />
      {notas.length > 0 && (
        <ul className="pulso-f6-orden-avisos" aria-label="Avisos de la pregunta">
          {notas.map((n, i) => <li key={`${n.codigo}-${i}`}><NotaAviso nota={n} /></li>)}
        </ul>
      )}
      {orden.modo === "personalizado" && datos && !escala && (
        <ListaOrden
          datos={datos}
          lista={ordenMostrado(orden.lista, datos, orden.invertir)}
          invertido={orden.invertir}
          onLista={(mostrado) => guardar({ ...orden, lista: listaDesdeMostrado(mostrado, orden.invertir) })}
        />
      )}
    </div>
  );
}

function NotaAviso({ nota, id }: { nota: NotaOrden; id?: string }) {
  const Icono = nota.destacada ? AlertTriangle : Info;
  return (
    <span id={id} className={`pulso-f6-orden-aviso${nota.destacada ? " is-destacado" : ""}`} data-aviso={nota.codigo}>
      <Icono size={13} aria-hidden="true" className="pulso-f6-orden-aviso-icono" />
      <span>{nota.texto}</span>
    </span>
  );
}

function EstadoDatos({ estado }: { estado: ReturnType<typeof useCategoriasGrafico> }) {
  if (estado.fase === "cargando") {
    return (
      <span className="pulso-f6-orden-estado" role="status">
        <Loader2 size={13} className="pulso-spin" aria-hidden="true" /> Leyendo las categorías de la pregunta…
      </span>
    );
  }
  if (estado.fase === "sin_lista") {
    return <span className="pulso-f6-orden-estado" role="status">Esta pregunta no tiene lista de opciones: no hay categorías que ordenar.</span>;
  }
  if (estado.fase === "error") {
    return (
      <span className="pulso-f6-orden-estado is-error" role="alert">
        <AlertTriangle size={13} aria-hidden="true" />
        <span>No se pudieron leer las categorías: {estado.mensaje}</span>
        <button type="button" className="pulso-f6-texto-boton" onClick={estado.reintentar}>
          <RefreshCw size={12} aria-hidden="true" /> Reintentar
        </button>
      </span>
    );
  }
  return null;
}

function ListaOrden({ datos, lista, invertido, onLista }: { datos: GraficosCategorias; lista: string[]; invertido: boolean; onLista: (l: string[]) => void }) {
  const etiqueta = new Map(datos.categorias.map((c) => [c.codigo, c.etiqueta]));
  const sinRespuestas = categoriasSinRespuestas(datos);
  const items = useRef(new Map<string, HTMLLIElement>());
  const [arrastrado, setArrastrado] = useState<number | null>(null);
  const [anuncio, setAnuncio] = useState("");
  const ayudaId = useId();

  // `enfocar`: «item» devuelve el foco a la categoría (Alt+↑/↓); «subir»/«bajar» lo deja en ese botón de la fila movida
  // (o en el opuesto si quedó disabled en el borde, `botonTrasMover`): un disabled tiraba el foco a BODY.
  const moverA = (desde: number, hasta: number, enfocar: "item" | "subir" | "bajar" | null) => {
    if (hasta < 0 || hasta >= lista.length || desde === hasta) return;
    const codigo = lista[desde];
    onLista(mover(lista, desde, hasta));
    setAnuncio(`«${etiqueta.get(codigo) ?? codigo}» en la posición ${hasta + 1} de ${lista.length}.`);
    if (!enfocar) return;
    requestAnimationFrame(() => {
      const item = items.current.get(codigo);
      if (!item) return;
      if (enfocar === "item") item.focus();
      else enfocarTrasMover(item, enfocar, hasta, lista.length);
    });
  };
  const onTecla = (i: number) => (e: KeyboardEvent<HTMLLIElement>) => {
    if (e.target !== e.currentTarget || !e.altKey || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
    // Alt+↑/↓ es también «mover la lámina» del editor (useShortcutsV2): sobre una categoría mueve la categoría.
    e.preventDefault();
    e.stopPropagation();
    moverA(i, e.key === "ArrowUp" ? i - 1 : i + 1, "item");
  };
  const onDrop = (i: number) => (e: DragEvent<HTMLLIElement>) => {
    e.preventDefault();
    if (arrastrado !== null) moverA(arrastrado, i, null);
    setArrastrado(null);
  };

  return (
    <>
      <span className="pulso-f6-dato-ayuda" id={ayudaId}>
        {invertido ? "Se muestra invertida, tal como se dibuja. " : ""}Arrastra o usa Alt + ↑/↓ sobre una categoría para moverla.
      </span>
      <ol className="pulso-f6-orden-lista" aria-label="Orden personalizado de las categorías" aria-describedby={ayudaId}
        data-qa-geometry-group="graficos/f6-orden-lista" data-qa-geometry-contract="intrinsic">
        {lista.map((codigo, i) => {
          const texto = etiqueta.get(codigo) ?? codigo;
          const vacia = sinRespuestas.has(codigo);
          return (
            <li
              key={codigo}
              ref={(el) => { if (el) items.current.set(codigo, el); else items.current.delete(codigo); }}
              className={`pulso-f6-orden-item${arrastrado === i ? " is-arrastrado" : ""}${vacia ? " is-sin-respuestas" : ""}`}
              tabIndex={0}
              draggable
              aria-label={`${i + 1}. ${texto}${vacia ? `. ${NO_SE_DIBUJA}` : ""}`}
              onKeyDown={onTecla(i)}
              onDragStart={(e) => { setArrastrado(i); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", codigo); }}
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
              onDrop={onDrop(i)}
              onDragEnd={() => setArrastrado(null)}
            >
              <GripVertical size={14} aria-hidden="true" className="pulso-f6-orden-asa" />
              <span className="pulso-f6-orden-posicion" aria-hidden="true">{i + 1}</span>
              <span className="pulso-f6-orden-etiqueta">
                {texto}
                {vacia && <span className="pulso-f6-orden-sin-respuestas" aria-hidden="true">{NO_SE_DIBUJA}</span>}
              </span>
              <button type="button" className="pulso-f6-icono-boton" {...{ [ATRIBUTO_ACCION_ORDEN]: "subir" }} aria-label={`Subir «${texto}»`} disabled={i === 0} onClick={() => moverA(i, i - 1, "subir")}>
                <ArrowUp size={14} aria-hidden="true" />
              </button>
              <button type="button" className="pulso-f6-icono-boton" {...{ [ATRIBUTO_ACCION_ORDEN]: "bajar" }} aria-label={`Bajar «${texto}»`} disabled={i === lista.length - 1} onClick={() => moverA(i, i + 1, "bajar")}>
                <ArrowDown size={14} aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ol>
      <span className="pulso-sr-only" aria-live="polite">{anuncio}</span>
    </>
  );
}
