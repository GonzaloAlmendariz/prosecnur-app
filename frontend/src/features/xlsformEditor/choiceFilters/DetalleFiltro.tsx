// Detalle del filtro elegido (E5, variante A): cabecera con la pregunta y la frase del motor, diagnósticos con «Ver el
// caso» y arreglos de un clic cuando son seguros, la matriz en el centro y «Qué ve el encuestado» a la derecha.

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { XlsformEditorWorkbook } from "../../../api/multiIntegrado";
import { Pencil } from "../../../vendor/lucide-react";
import type { BuilderNode } from "../types";
import { PiezasLectura } from "../kit/CuerpoPanelMarca";
import { LECTURA_FILA_ROTA } from "../reglas/motor/filaRota";
import { EditarEnConstructor } from "../shell/EditarEnConstructor";
import { alternarFijaCascada, conExpresion, marcarCascada, marcarFijo, reemplazarCodigos, renombrarColumna } from "./escrituraFiltros";
import type { FraseFiltro } from "./fraseFiltro";
import { ChipEstado } from "./ListaFiltros";
import { ListaFija } from "./ListaFija";
import { MatrizCascada } from "./MatrizCascada";
import { MatrizPorOpcion } from "./MatrizPorOpcion";
import { NOMBRE_TIPO, respuestasIniciales, type AnalisisFiltro, type Diagnostico, type Respuestas } from "./modeloFiltros";
import { OpcionesDeExpresion } from "./OpcionesDeExpresion";
import type { PreguntaElegible } from "./SelectorPreguntaFiltro";
import { VistaEncuestado } from "./VistaEncuestado";
import { PulsoButton } from "../../../components/PulsoButton";

type Props = {
  id: string;
  a: AnalisisFiltro;
  frase: FraseFiltro | undefined;
  workbook: XlsformEditorWorkbook | null;
  porNombre: ReadonlyMap<string, BuilderNode>;
  candidatas: readonly PreguntaElegible[];
  onWorkbook: ((wb: XlsformEditorWorkbook) => void) | null;
  onEditarFiltro: (() => void) | null;
  onEditar?: (fila: number) => void;
  /** El editor por intención, cuando está abierto: va arriba, con su barra fija. */
  editor: ReactNode;
  aviso: ReactNode;
};

const DURACION_DESTELLO = 2400;
const lista = (xs: readonly string[], n = 6) => (xs.length > n ? `${xs.slice(0, n).join(", ")} y ${xs.length - n} más` : xs.join(", "));
const plural = (n: number, uno: string, varios: string) => (n === 1 ? uno : `${n} ${varios}`);

export function DetalleFiltro({ id, a, frase, workbook, porNombre, candidatas, onWorkbook, onEditarFiltro, onEditar, editor, aviso }: Props) {
  const choices = workbook?.choices ?? { columns: [], rows: [] };
  const [respuestas, setRespuestas] = useState<Respuestas>(() => respuestasIniciales(a, choices));
  const [resaltadas, setResaltadas] = useState<ReadonlySet<string>>(new Set());
  const [destello, setDestello] = useState(false);
  const [anuncio, setAnuncio] = useState("");
  const [fraseEntera, setFraseEntera] = useState(false);
  const fraseLarga = (frase?.texto.length ?? 0) > 200;
  const raiz = useRef<HTMLDivElement>(null);
  const editable = !!workbook && !!onWorkbook;
  const escribir = (wb: XlsformEditorWorkbook) => onWorkbook?.(wb);
  const etiquetaDe = (cod: string) => a.opciones.find((o) => o.codigo === cod)?.etiqueta ?? cod;

  useEffect(() => {
    if (!resaltadas.size && !destello) return;
    const t = window.setTimeout(() => { setResaltadas(new Set()); setDestello(false); }, DURACION_DESTELLO);
    return () => window.clearTimeout(t);
  }, [resaltadas, destello]);

  const verCaso = (d: Diagnostico) => {
    if (d.clase === "vacia" && d.entrada) {
      const e = a.entradas.find((x) => x.nombre === d.entrada);
      setRespuestas((r) => ({ ...r, [d.entrada]: e?.multiple ? [d.respuestas[0]!] : d.respuestas[0]! }));
      setDestello(true);
      raiz.current?.querySelector(".xcf-vista")?.scrollIntoView({ block: "nearest", behavior: movimiento() });
    } else if (d.clase === "nunca") {
      setResaltadas(new Set(d.opciones));
      window.requestAnimationFrame(() => raiz.current?.querySelector(`[data-opcion="${CSS.escape(d.opciones[0]!)}"]`)?.scrollIntoView({ block: "nearest", behavior: movimiento() }));
    }
  };

  const textoDiag = (d: Diagnostico): { titulo: ReactNode; sub: ReactNode; arreglo: { texto: string; aplicar: () => void } | null; ver: boolean } => {
    if (d.clase === "rota") return { titulo: `${LECTURA_FILA_ROTA}.`, sub: "No filtra ninguna opción. Corrígela en el Constructor.", arreglo: null, ver: false };
    if (d.clase === "conflicto") {
      return {
        titulo: <>La columna <code>{d.columna}</code> no existe en la lista <code>{a.lista}</code></>,
        sub: d.sugerida ? <>La lista tiene <code>{d.sugerida}</code>. La pregunta sale vacía.</> : "La pregunta sale vacía.",
        arreglo: d.sugerida && workbook ? { texto: `Usar ${d.sugerida}`, aplicar: () => escribir(conExpresion(workbook, a.fila, renombrarColumna(a.expresion, d.columna, d.sugerida!))) } : null,
        ver: false,
      };
    }
    if (d.clase === "vacia") {
      if (!d.entrada) return { titulo: "La lista queda vacía siempre", sub: "Ninguna opción cumple el filtro.", arreglo: null, ver: false };
      const e = a.entradas.find((x) => x.nombre === d.entrada);
      const nombres = d.respuestas.map((r) => e?.respuestas?.find((x) => x.codigo === r)?.etiqueta ?? r);
      return {
        titulo: d.respuestas.length === 1 ? <>Con <b>{nombres[0]}</b> la lista queda vacía</> : <>Con {d.respuestas.length} respuestas de <code>{d.entrada}</code> la lista queda vacía</>,
        sub: d.respuestas.length === 1 ? <>Ninguna opción tiene <code>{d.respuestas[0]}</code>.</> : lista(nombres, 4),
        arreglo: null,
        ver: true,
      };
    }
    const cambios = d.arreglo?.cambios ?? [];
    return {
      titulo: plural(d.opciones.length, "1 opción nunca se muestra", "opciones nunca se muestran"),
      sub: <>{lista(d.opciones.map(etiquetaDe))}.{cambios.length === 1 ? <> Usan <code>{cambios[0]!.de}</code> y la respuesta es <code>{cambios[0]!.a}</code>.</> : null}</>,
      arreglo: d.arreglo && workbook
        ? { texto: cambios.length === 1 ? `Cambiar ${cambios[0]!.de} por ${cambios[0]!.a}` : `Corregir ${cambios.length} códigos`, aplicar: () => escribir(reemplazarCodigos(workbook, a.lista, d.arreglo!.columna, cambios)) }
        : null,
      ver: true,
    };
  };

  const centro = (() => {
    if (a.estado.clase === "conflicto") {
      const propias = choices.columns.filter((c) => !["list_name", "name"].includes(c) && !c.startsWith("label") && !c.startsWith("media"));
      return (
        <div className="xcf-matriz">
          <div className="xcf-matriz__cab"><h4>{a.columnas.length ? "Columnas de la lista" : "Expresión"}</h4></div>
          {a.columnas.length ? (
            <p className="xcf-nota">El filtro pide {a.columnas.map((c, i) => <span key={c}>{i ? ", " : ""}<code>{c}</code></span>)}. En choices hay {propias.length ? propias.slice(0, 12).map((c, i) => <span key={c}>{i ? ", " : ""}<code>{c}</code></span>) : "sólo name y label"}.</p>
          ) : <p className="xcf-nota">La columna choice_filter repite el nombre de la pregunta.</p>}
          <pre className="xcf-codigo">{a.expresion}</pre>
        </div>
      );
    }
    if (a.tipo === "cascada" && a.cascada && workbook) {
      const madre = respuestas[a.cascada.madre];
      return <MatrizCascada a={a} choices={choices} actual={Array.isArray(madre) ? madre : madre ? [madre] : []} resaltadas={resaltadas} editable={editable}
        onMarcar={(cod, r) => escribir(marcarCascada(workbook, a.lista, a.cascada!.columna, a.cascada!.forma, cod, r))}
        onFija={(cod) => escribir(alternarFijaCascada(workbook, a.fila, a.cascada!, cod))} />;
    }
    if (a.tipo === "opcion" && a.porOpcion && workbook) {
      return <MatrizPorOpcion a={a} workbook={workbook} porNombre={porNombre} candidatas={candidatas} resaltadas={resaltadas} editable={editable}
        onWorkbook={escribir} onAnunciar={setAnuncio} />;
    }
    if (a.tipo === "fijo" && a.fijo && workbook) {
      return <ListaFija a={a} choices={choices} editable={editable} onMarcar={(cods, v) => escribir(marcarFijo(workbook, a.fila, a.lista, a.fijo!, cods, v))} />;
    }
    return <OpcionesDeExpresion a={a} resaltadas={resaltadas} />;
  })();

  return (
    <div ref={raiz} id={id} className="xcf-detalle" role="region" aria-label={`Filtro de ${a.pregunta}`} data-qa-geometry-member="" data-qa-geometry-capacity="owned" data-qa-scroll-owner="filtros-detalle">
      {editor}
      {aviso}
      <header className="xcf-detalle__cab">
        <div className="xcf-detalle__meta">
          <code className="xcf-detalle__codigo">{a.pregunta}</code>
          <span className="xcf-chip">{NOMBRE_TIPO[a.tipo]}</span>
          <span className="xcf-nota">lista <code>{a.lista || "—"}</code></span>
          <span className="xcf-esp" />
          <ChipEstado estado={a.estado} />
          {onEditarFiltro ? <PulsoButton variant="secondary" size="sm" onClick={onEditarFiltro}><Pencil size={13} aria-hidden="true" /> Editar filtro</PulsoButton> : null}
          {onEditar ? <EditarEnConstructor onEditar={() => onEditar(a.fila)} /> : null}
        </div>
        <h3 className="xcf-detalle__titulo">{a.etiqueta}</h3>
        <p id={`${id}-frase`} className={fraseLarga && !fraseEntera ? "xcf-detalle__frase is-recortada" : "xcf-detalle__frase"}>
          {frase?.piezas ? <><PiezasLectura piezas={frase.piezas} />.</> : frase?.texto}
          {frase?.tecnica ? <code className="xcf-detalle__raw">{a.expresion}</code> : null}
        </p>
        {fraseLarga ? (
          <button type="button" className="xcf-enlace" aria-expanded={fraseEntera} aria-controls={`${id}-frase`} onClick={() => setFraseEntera((x) => !x)}>
            {fraseEntera ? "Ver menos" : "Ver la frase completa"}
          </button>
        ) : null}
        {frase?.aviso ? <p className="xcf-aviso">{frase.aviso}</p> : null}
        {a.compartidaCon.length && (a.tipo === "cascada" || a.tipo === "fijo") ? (
          <p className="xcf-nota">
            La columna <code>{a.columnas[0]}</code> también filtra {a.compartidaCon.slice(0, 4).map((n, i) => <span key={n}>{i ? ", " : ""}<code>{n}</code></span>)}
            {a.compartidaCon.length > 4 ? ` y ${a.compartidaCon.length - 4} más` : ""}. Editarla las cambia también.
          </p>
        ) : null}
      </header>
      {a.diagnosticos.length ? (
        <ul className="xcf-diags" aria-label="Diagnóstico">
          {a.diagnosticos.map((d, i) => {
            const t = textoDiag(d);
            const grave = d.clase !== "nunca";
            return (
              <li key={i} className={grave ? "xcf-diag is-grave" : "xcf-diag"}>
                <span className="xcf-diag__icono" aria-hidden="true">!</span>
                <span className="xcf-diag__texto">{t.titulo}<span className="xcf-diag__sub">{t.sub}</span></span>
                {t.arreglo && editable ? <PulsoButton variant="secondary" size="sm" onClick={t.arreglo.aplicar}>{t.arreglo.texto}</PulsoButton> : null}
                {t.ver ? <PulsoButton variant="ghost" size="sm" onClick={() => verCaso(d)}>Ver el caso</PulsoButton> : null}
              </li>
            );
          })}
        </ul>
      ) : null}
      <div className="xcf-detalle__cuerpo" data-qa-geometry-group="xlsform/filtros-detalle" data-qa-geometry-contract="intrinsic">
        <div className="xcf-detalle__centro" data-qa-geometry-member="">{centro}</div>
        <div className="xcf-detalle__lado" data-qa-geometry-member="">
          <VistaEncuestado a={a} choices={choices} respuestas={respuestas} destello={destello}
            onRespuesta={(n, v) => setRespuestas((r) => ({ ...r, [n]: v }))} />
        </div>
      </div>
      <p className="xcf-oculto" aria-live="polite" role="status">{anuncio}</p>
    </div>
  );
}

function movimiento(): ScrollBehavior {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}
