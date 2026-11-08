// Fila «Orden» de la tarjeta de un gráfico categórico, agrupado, de torta o de dona (D8; contrato
// docs/qa/contrato-orden-categorias-f6-2026-10-10.md). Persiste en `args.orden_categorias` del gráfico. Encima de la
// lista, los avisos que el backend da de la pregunta (decisión 4, §7): se ramifica por `codigo`, nunca por el texto.
//
// Ítem 3 de la oleada del inspector (2026-11-08): el modo es un segmentado Recetario / Frecuencia / Instrumento y la
// lista está siempre a la vista, en el orden en que se dibuja (ordenVisible.ts). Al pasar el cursor (o el foco) por un
// segmento, la lista muestra ese orden sin guardarlo, y las filas se deslizan a su lugar (useReordenAnimado). Arrastrar
// o mover cualquier fila pasa a «A mano» partiendo del orden visible; ese cuarto segmento sólo aparece mientras rige.
// «Invertir» sigue siendo un interruptor.
//
// Oleada I2, ítem 3: cada fila lleva su % en la lámina, leído del detalle del motor (cifrasInspector/); sin detalle, sin
// cifra. El % no cambia al reordenar: es de la categoría, no de su lugar.

import { useId, useRef, useState, type DragEvent, type FocusEvent, type KeyboardEvent, type MouseEvent } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, GripVertical, Info, RefreshCw } from "../../../vendor/lucide-react";
import { Switch } from "../../../components/Switch";
import { AyudaGlobo } from "./AyudaGlobo";
import type { GraficosCategorias } from "../../../api/graficos";
import {
  ATRIBUTO_ACCION_ORDEN,
  categoriasSinRespuestas,
  enfocarTrasMover,
  leerAvisosOrden,
  leerOrden,
  listaDesdeMostrado,
  mover,
  NO_SE_DIBUJA,
  ordenAGuardar,
  ordenHeredado,
  rotuloFrecuencia,
  rotuloRecetario,
  tieneOrdenHeredado,
  type ModoOrden,
  type NotaOrden,
  type OrdenCategorias,
} from "./ordenCategorias";
import { MODOS_FIJOS, ordenVisible, type ModoFijo } from "./ordenVisible";
import { useReordenAnimado } from "./useReordenAnimado";
import { useCategoriasGrafico } from "./useCategoriasGrafico";
import { rotuloVisible } from "./rotuloCortoDeLista";
import { useRotulosCortos } from "./useRotulosCortos";
import { Segmentado } from "../subpestanas/Segmentado";
import "./ordenCategorias.css";
import { useDetalleCifras, type EstadoDetalle } from "./cifrasInspector/useDetalleCifras";
import { pctDe } from "./cifrasInspector/modeloCifras";
import "./cifrasInspector/cifrasInspector.css";
import { CargaDeBloque } from "../../../components/CargaDeBloque";
import { formatoConteo } from "../../../lib/formatoNumero";

type Props = {
  /** Calificada `base$var` (`varCalificada`). */
  variable: string;
  /** Id del graficador: con él el backend avisa si el orden no aplica (escalas). */
  graficador: string;
  args: Readonly<Record<string, unknown>>;
  scope: "active" | "consolidated";
  onCambio: (orden: OrdenCategorias | null) => void;
};

const ROTULO_MODO: Readonly<Record<ModoOrden, string>> = {
  recetario: "Recetario", frecuencia: "Frecuencia", instrumento: "Instrumento", personalizado: "A mano",
};

/** Qué orden dibuja cada modo, con palabras: el estado bajo el segmentado (y lo que dice la vista previa). */
function ordenDicho(modo: ModoOrden, datos: GraficosCategorias | null, heredado: string | boolean | null, invertir: boolean): string {
  if (modo === "recetario") return rotuloRecetario(datos, heredado);
  if (modo === "frecuencia") return rotuloFrecuencia(invertir);
  if (modo === "instrumento") return invertir ? "Como el instrumento, invertido" : "Como el instrumento";
  return invertir ? "A mano, invertido" : "A mano";
}

export function OrdenCategoriasGrafico({ variable, graficador, args, scope, onCambio }: Props) {
  const id = useId();
  const estado = useCategoriasGrafico(variable, scope, graficador);
  const cifras = useDetalleCifras(graficador, scope, [{ clave: "actual", args }]).actual;
  const orden = leerOrden(args);
  const heredado = tieneOrdenHeredado(args);
  // U4: el orden elegido antes, con palabras («De mayor a menor»); elegir otro modo lo reemplaza y el valor anterior
  // queda guardado: volver a «elegido antes» lo recupera.
  const nombreHeredado = ordenHeredado(args);
  const datos = estado.fase === "lista" ? estado.datos : null;
  const { notas, escala } = leerAvisosOrden(datos);
  const escalaId = `${id}-escala`;
  // El modo bajo el cursor o el foco: la lista lo muestra, nunca se guarda.
  const [vista, setVista] = useState<ModoFijo | null>(null);
  const vistaActiva = vista !== null && vista !== orden.modo ? vista : null;

  const guardar = (o: OrdenCategorias) => onCambio(ordenAGuardar(o));
  const modos: ModoOrden[] = orden.modo === "personalizado" ? [...MODOS_FIJOS, "personalizado"] : [...MODOS_FIJOS];
  const modoBajo = (e: MouseEvent<HTMLElement> | FocusEvent<HTMLElement>): ModoFijo | null => {
    const radio = (e.target as HTMLElement).closest?.("[role=radio]");
    const i = radio ? [...(radio.parentElement?.children ?? [])].indexOf(radio) : -1;
    const m = modos[i];
    return m && m !== "personalizado" ? m : null;
  };
  const lista = datos && !escala ? ordenVisible(orden, datos, args, vistaActiva) : null;
  const dicho = ordenDicho(vistaActiva ?? orden.modo, datos, vistaActiva ? null : nombreHeredado ?? heredado, orden.invertir);

  return (
    <div className="pulso-f6-dato is-apilado pulso-f6-orden" data-qa-geometry-group="graficos/f6-orden" data-qa-geometry-contract="intrinsic">
      <div className="pulso-f6-orden-cabeza">
        <span className="pulso-f6-dato-rotulo" id={`${id}-modo`}>
          Orden
          {/* ADR 0135 §8: cómo se mueve una categoría va en el «?» del rótulo; la lista lo nombra en aria-describedby. */}
          {datos && !escala && <AyudaGlobo id={`${id}-mover`} rotulo="Orden" detalle={AYUDA_MOVER} />}
        </span>
        {/* Deshabilitado como grupo (fieldset): el segmentado compartido no tiene estado deshabilitado propio. */}
        <fieldset className="pulso-f6-orden-modos" disabled={escala !== null} aria-describedby={escala ? escalaId : undefined}
          onMouseOver={(e) => setVista(modoBajo(e))} onMouseLeave={() => setVista(null)}
          onFocus={(e) => setVista(modoBajo(e))} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setVista(null); }}>
          <Segmentado etiqueta="Orden" valor={orden.modo} opciones={modos.map((m) => ({ clave: m, rotulo: ROTULO_MODO[m] }))}
            onCambiar={(m) => { setVista(null); guardar({ ...orden, modo: m }); }} />
        </fieldset>
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
      {!escala && (
        <span className={`pulso-f6-dato-ayuda pulso-f6-orden-dicho${vistaActiva ? " is-vista" : ""}`} data-qa="orden-dicho">
          {vistaActiva ? `Vista previa: ${dicho}` : dicho}
        </span>
      )}
      {orden.modo === "recetario" && heredado && !vistaActiva && (
        <span className="pulso-f6-dato-ayuda" data-qa="orden-heredado" role="note">
          {nombreHeredado ? `Este gráfico trae el orden «${nombreHeredado}», elegido antes` : "Este gráfico trae un orden elegido antes"}; manda
          mientras no elijas otro.
        </span>
      )}
      <EstadoDatos estado={estado} />
      {notas.length > 0 && (
        <ul className="pulso-f6-orden-avisos" aria-label="Avisos de la pregunta">
          {notas.map((n, i) => <li key={`${n.codigo}-${i}`}><NotaAviso nota={n} /></li>)}
        </ul>
      )}
      {datos && lista && (
        <ListaOrden
          datos={datos}
          lista={lista}
          // R6-5: la nota de «A mano» invertida queda montada durante la vista previa (la lista no sube 18 px).
          invertido={orden.invertir && orden.modo === "personalizado"}
          vista={!!vistaActiva}
          ayudaId={`${id}-mover`}
          cifras={cifras}
          // Mover cualquier fila pasa a «A mano» desde el orden que se ve: se guarda tal como queda dibujado.
          onLista={(mostrado) => guardar({ ...orden, modo: "personalizado", lista: listaDesdeMostrado(mostrado, orden.invertir) })}
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
    return <CargaDeBloque label="Leyendo las categorías de la pregunta…" />;
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

export const AYUDA_MOVER = "Arrastra o usa Alt + ↑/↓ sobre una categoría para moverla.";

function ListaOrden({ datos, lista, invertido, vista, ayudaId, cifras, onLista }: {
  datos: GraficosCategorias; lista: string[]; invertido: boolean; vista: boolean; ayudaId: string; cifras?: EstadoDetalle;
  onLista: (l: string[]) => void;
}) {
  // U14: con el rótulo corto del estudio la lista dice lo que dirá la lámina; el completo queda en el title.
  const cortos = useRotulosCortos();
  const completa = new Map(datos.categorias.map((c) => [c.codigo, c.etiqueta]));
  const etiqueta = new Map(datos.categorias.map((c) => [c.codigo, rotuloVisible(cortos, c.etiqueta).texto]));
  const sinRespuestas = categoriasSinRespuestas(datos);
  const items = useRef(new Map<string, HTMLLIElement>());
  const [arrastrado, setArrastrado] = useState<number | null>(null);
  const [anuncio, setAnuncio] = useState("");
  useReordenAnimado(items, lista);

  // `enfocar`: «item» devuelve el foco a la categoría (Alt+↑/↓); «subir»/«bajar» lo deja en ese botón de la fila movida
  // (o en el opuesto si quedó disabled en el borde, `botonTrasMover`): un disabled tiraba el foco a BODY.
  const moverA = (desde: number, hasta: number, enfocar: "item" | "subir" | "bajar" | null) => {
    if (hasta < 0 || hasta >= lista.length || desde === hasta) return;
    const codigo = lista[desde];
    onLista(mover(lista, desde, hasta));
    setAnuncio(`“${etiqueta.get(codigo) ?? codigo}” en la posición ${hasta + 1} de ${formatoConteo(lista.length)}.`);
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
      {invertido && <span className="pulso-f6-dato-ayuda" role="note">Se muestra invertida, tal como se dibuja.</span>}
      <ol className={`pulso-f6-orden-lista${vista ? " is-vista" : ""}`} aria-label="Orden de las categorías" aria-describedby={ayudaId}
        data-qa-geometry-group="graficos/f6-orden-lista" data-qa-geometry-contract="intrinsic">
        {lista.map((codigo, i) => {
          const texto = etiqueta.get(codigo) ?? codigo;
          const larga = completa.get(codigo);
          const vacia = sinRespuestas.has(codigo);
          const pct = pctDe(cifras?.detalle ?? null, [larga, texto, codigo]);
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
              <span className="pulso-f6-orden-etiqueta" title={larga && larga !== texto ? larga : undefined}>
                {texto}
                {vacia && <span className="pulso-f6-orden-sin-respuestas" aria-hidden="true">{NO_SE_DIBUJA}</span>}
              </span>
              {pct && <span className={`pulso-f6-cifra-pct${cifras?.vigente ? "" : " is-anterior"}`} data-qa="cifra-orden">{pct}</span>}
              <button type="button" className="pulso-f6-icono-boton" {...{ [ATRIBUTO_ACCION_ORDEN]: "subir" }} aria-label={`Subir “${texto}”`} disabled={i === 0} onClick={() => moverA(i, i - 1, "subir")}>
                <ArrowUp size={14} aria-hidden="true" />
              </button>
              <button type="button" className="pulso-f6-icono-boton" {...{ [ATRIBUTO_ACCION_ORDEN]: "bajar" }} aria-label={`Bajar “${texto}”`} disabled={i === lista.length - 1} onClick={() => moverA(i, i + 1, "bajar")}>
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
