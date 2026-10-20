// =============================================================================
// shell/VistaCuestionario.tsx — pestaña «Vista del cuestionario»
// =============================================================================
// La vista de LECTURA (2026-10-15): el formulario como lo verá la persona
// encuestada, como una página. A la izquierda el índice de secciones
// (`ListaPartes`, con seguimiento de lectura); al centro una columna de lectura
// con cada pregunta numerada, su enunciado completo, su ayuda, sus opciones como
// se ven (círculo, cuadrado, línea, recuadro), las notas, las matrices y la
// lógica en contexto. El clic en una pregunta despliega su ficha de solo
// lectura bajo ella (una a la vez; Enter/Espacio la abren, Escape la cierra);
// la ficha abierta es el `foco` de la dirección. Al Constructor sólo se va con
// «Editar en Constructor» (ítem 50: un clic nunca saca de la pestaña).
//
// Un solo dueño de scroll: el documento. El índice queda fijo a la izquierda.
// Las cifras de la cabecera usan la regla del Resumen (una sola definición).
// =============================================================================

import { TituloSeccion } from "./TituloSeccion";
import { createContext, useContext, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { AlertTriangle, ArrowRight, Repeat } from "../../../vendor/lucide-react";
import type { BuilderStructure, XlsformEditorWorkbook } from "../types";
import { buildCatalogs } from "../parsing/buildIndex";
import { detectMatrixCandidates } from "../parsing/detectMatrixCandidates";
import { pistaLegible, type LectorReferencias } from "../helpers/markdownPregunta";
import { TextoPregunta } from "../helpers/markdownTexto";
import { duracion, minutos, resumirFormulario } from "../resumen/modeloResumen";
import { IndiceCuestionario } from "../cuestionario/IndiceCuestionario";
import {
  armarDocumento,
  marcarOpcionales,
  type BloqueDoc,
  type OpcionDoc,
  type PreguntaDoc,
  type SeccionDoc,
} from "../cuestionario/modeloCuestionario";
import { FichaPregunta, idFicha } from "../cuestionario/FichaPregunta";
import { textoRango } from "../cuestionario/modeloFicha";
import { alternarFicha } from "./detalleEnSitio";
import { TypeIcon } from "../kit";
import { typeLabel } from "../parsing/parseType";
import "../cuestionario/cuestionario.css";

export type VistaCuestionarioProps = {
  workbook: XlsformEditorWorkbook;
  structure: BuilderStructure | null;
  /** La lógica importada espera revisión (el mismo estado que anuncia la cabecera). */
  logicaPendiente: boolean;
  onRevisarLogica?: () => void;
  /** `name` de la pregunta con la ficha abierta (el `foco` de la dirección), o null. */
  abierta: string | null;
  onAbrir: (name: string | null) => void;
  /** La única salida al Constructor: «Editar en Constructor» de la ficha. */
  onEditar: (name: string) => void;
  /** Escribe el título de una sección sin título legible (su etiqueta). */
  onTitular?: (fila: number, texto: string) => void;
};

/** Lo que cada pregunta necesita para abrir, cerrar y editar su ficha. */
type Fichas = {
  abierta: string | null;
  alternar: (name: string) => void;
  onEditar: (name: string) => void;
};

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/** Cómo se leen los `${x}` del documento: «[Etiqueta corta]» o el código (helpers/markdownPregunta.ts). */
const Lector = createContext<LectorReferencias>({ etiquetaDe: () => undefined });

function Markdown({ texto, como = "span", className }: { texto: string; como?: "span" | "p" | "h3"; className?: string }) {
  return <TextoPregunta texto={texto} lector={useContext(Lector)} como={como} className={className} />;
}

function Marca({ forma }: { forma: "una" | "varias" }) {
  return <span className={`pulso-xf-cue-marca is-${forma}`} aria-hidden="true" />;
}

function Opciones({ pregunta }: { pregunta: PreguntaDoc }) {
  const { forma, opciones, rango } = pregunta;
  if ((forma === "una" || forma === "varias" || forma === "orden") && opciones.length > 0) {
    return (
      <ul className={`pulso-xf-cue-opciones${opciones.length > 6 ? " is-columnas" : ""}`}>
        {opciones.map((o, oi) => (
          <li key={`${o.codigo}-${oi}`}>
            {forma === "orden" ? <span className="pulso-xf-cue-marca is-orden" aria-hidden="true" /> : <Marca forma={forma} />}
            <Markdown texto={o.etiqueta} />
            {o.habilita.length > 0 && (
              <span className="pulso-xf-cue-salto">→ {o.habilita.map((x) => `P${x}`).join(", ")}</span>
            )}
          </li>
        ))}
      </ul>
    );
  }
  if (forma === "una" || forma === "varias") {
    return <p className="pulso-xf-cue-falta">Sin lista de opciones.</p>;
  }
  if (forma === "numero") {
    return (
      <div className="pulso-xf-cue-respuesta">
        <span className="pulso-xf-cue-caja" aria-hidden="true" />
        {rango && <span className="pulso-xf-cue-rango">{textoRango(rango)}</span>}
      </div>
    );
  }
  if (forma === "fecha") return <div className="pulso-xf-cue-respuesta"><span className="pulso-xf-cue-plantilla">__ / __ / ____</span></div>;
  if (forma === "hora") return <div className="pulso-xf-cue-respuesta"><span className="pulso-xf-cue-plantilla">__ : __</span></div>;
  if (forma === "acepta") return <div className="pulso-xf-cue-respuesta"><Marca forma="varias" /> <span>Entendido</span></div>;
  return <div className="pulso-xf-cue-respuesta"><span className="pulso-xf-cue-linea" aria-hidden="true" /></div>;
}

function abrirConTeclado(e: KeyboardEvent<HTMLElement>, abrir: () => void) {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    abrir();
  }
}

/** Escape cierra la ficha abierta del bloque y devuelve el foco a quien la abrió. */
function cerrarConEscape(e: KeyboardEvent<HTMLElement>, abierta: string | null, fichas: Fichas) {
  if (e.key !== "Escape" || !abierta) return;
  e.stopPropagation();
  const origen = e.currentTarget.querySelector<HTMLElement>(`[aria-controls="${idFicha(abierta)}"]`);
  fichas.alternar(abierta);
  origen?.focus();
}

function Pregunta({ pregunta, marcarOpcionales: opcionales, fichas }: {
  pregunta: PreguntaDoc;
  marcarOpcionales: boolean;
  fichas: Fichas;
}) {
  const { nodo, numero, condicion } = pregunta;
  const abierta = fichas.abierta === nodo.name;
  const alternar = () => fichas.alternar(nodo.name);
  const marca = opcionales ? (!nodo.required ? "opcional" : null) : nodo.required ? "*" : null;
  return (
    <article
      className={`pulso-xf-cue-pregunta${abierta ? " is-abierta" : ""}`}
      data-qa-geometry-member=""
      data-pregunta={nodo.name}
      onKeyDown={(e) => cerrarConEscape(e, abierta ? nodo.name : null, fichas)}
    >
      {condicion && <p className="pulso-xf-cue-condicion">Aparece si {condicion}</p>}
      <div
        className="pulso-xf-cue-cabeza"
        role="button"
        tabIndex={0}
        onClick={alternar}
        onKeyDown={(e) => abrirConTeclado(e, alternar)}
        aria-expanded={abierta}
        aria-controls={abierta ? idFicha(nodo.name) : undefined}
        title={abierta ? "Cerrar la ficha" : "Ver la ficha de la pregunta"}
      >
        <span className="pulso-xf-cue-numero">
          {numero}.
          {marca === "*" && <span className="pulso-xf-cue-obligatoria" aria-label="obligatoria">*</span>}
        </span>
        <Markdown como="h3" className="pulso-xf-cue-enunciado" texto={nodo.label || nodo.name} />
        {marca === "opcional" && <span className="pulso-xf-cue-opcional">opcional</span>}
        {/* F3: el tipo, discreto a la derecha; su nombre al pasar el puntero (la ficha lo dice entero). */}
        <span className="pulso-xf-cue-tipo" title={typeLabel(nodo.typeInfo.base)}><TypeIcon baseType={nodo.typeInfo.base} size={13} /></span>
      </div>
      {pistaLegible(nodo) && <Markdown como="p" className="pulso-xf-cue-ayuda" texto={pistaLegible(nodo)} />}
      {/* Abierta, la línea de respuesta de una pregunta abierta sobra: la ficha va justo debajo. */}
      {!(abierta && (pregunta.forma === "texto" || pregunta.forma === "otra")) && <Opciones pregunta={pregunta} />}
      {abierta && <FichaPregunta pregunta={pregunta} onEditar={fichas.onEditar} />}
    </article>
  );
}

function Matriz({ bloque, marcarOpcionales: opcionales, fichas }: {
  bloque: Extract<BloqueDoc, { tipo: "matriz" }>;
  marcarOpcionales: boolean;
  fichas: Fichas;
}) {
  const forma = bloque.filas[0]?.forma === "varias" ? "varias" : "una";
  const filaAbierta = bloque.filas.find((f) => f.nodo.name === fichas.abierta) ?? null;
  return (
    <article
      className="pulso-xf-cue-pregunta is-matriz"
      data-qa-geometry-member=""
      data-pregunta={filaAbierta?.nodo.name}
      onKeyDown={(e) => cerrarConEscape(e, filaAbierta?.nodo.name ?? null, fichas)}
    >
      <div className="pulso-xf-cue-matriz-marco">
        <table className="pulso-xf-cue-matriz">
          <thead>
            <tr>
              <th scope="col"><span className="pulso-xf-cue-sr">Pregunta</span></th>
              {bloque.escala.map((o: OpcionDoc, oi) => (
                <th key={`${o.codigo}-${oi}`} scope="col"><Markdown texto={o.etiqueta} /></th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bloque.filas.map((f) => (
              <tr key={f.nodo.rowIndex} className={f === filaAbierta ? "is-abierta" : undefined}
                onClick={() => fichas.alternar(f.nodo.name)} title="Ver la ficha de la pregunta">
                <th scope="row">
                  <button type="button" className="pulso-xf-cue-matriz-fila" onClick={(e) => { e.stopPropagation(); fichas.alternar(f.nodo.name); }}
                    aria-expanded={f === filaAbierta} aria-controls={f === filaAbierta ? idFicha(f.nodo.name) : undefined}>
                    <span className="pulso-xf-cue-numero">
                      {f.numero}.
                      {!opcionales && f.nodo.required && <span className="pulso-xf-cue-obligatoria" aria-label="obligatoria">*</span>}
                    </span>
                    <Markdown texto={f.nodo.label || f.nodo.name} />
                    {opcionales && !f.nodo.required && <span className="pulso-xf-cue-opcional">opcional</span>}
                  </button>
                  {f.condicion && <span className="pulso-xf-cue-condicion is-fila">Aparece si {f.condicion}</span>}
                </th>
                {bloque.escala.map((o, oi) => <td key={`${o.codigo}-${oi}`}><Marca forma={forma} /></td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filaAbierta && <FichaPregunta pregunta={filaAbierta} onEditar={fichas.onEditar} />}
    </article>
  );
}

function Seccion({ seccion, marcarOpcionales: opcionales, fichas, registrar, onTitular }: {
  seccion: SeccionDoc;
  onTitular?: (fila: number, texto: string) => void;
  marcarOpcionales: boolean;
  fichas: Fichas;
  registrar: (clave: string, el: HTMLElement | null) => void;
}) {
  return (
    <section className="pulso-xf-cue-seccion" ref={(el) => registrar(seccion.clave, el)} data-seccion={seccion.clave} data-qa-geometry-member=""
      aria-labelledby={`xf-cue-${seccion.clave}`}>
      <header className="pulso-xf-cue-banda">
        <h2 id={`xf-cue-${seccion.clave}`}>
          {seccion.repite && <Repeat size={14} aria-hidden="true" />}
          {seccion.sinTitulo && onTitular
            ? <TituloSeccion rotulo={seccion.rotulo} onTitular={(t) => onTitular(seccion.fila, t)} />
            : <Markdown texto={seccion.rotulo} />}
        </h2>
        <span>
          {seccion.repite ? "Se repite · " : ""}{plural(seccion.preguntas, "pregunta", "preguntas")}
          {seccion.preguntas ? ` · ${duracion(seccion.segundos)}` : ""}
        </span>
      </header>
      <div className="pulso-xf-cue-bloques" data-qa-geometry-group={`xlsform/cuestionario-${seccion.clave}`} data-qa-geometry-contract="intrinsic">
        {seccion.bloques.map((b, i) => {
          if (b.tipo === "nota") {
            return (
              <aside key={`n-${i}`} className="pulso-xf-cue-nota" data-qa-geometry-member="">
                {b.condicion && <p className="pulso-xf-cue-condicion">Aparece si {b.condicion}</p>}
                <Markdown como="p" texto={b.nodo.label || b.nodo.name} />
              </aside>
            );
          }
          if (b.tipo === "matriz") return <Matriz key={b.clave} bloque={b} marcarOpcionales={opcionales} fichas={fichas} />;
          return <Pregunta key={b.pregunta.nodo.rowIndex} pregunta={b.pregunta} marcarOpcionales={opcionales} fichas={fichas} />;
        })}
      </div>
    </section>
  );
}

export function VistaCuestionario({ workbook, structure, logicaPendiente, onRevisarLogica, abierta, onAbrir, onEditar, onTitular }: VistaCuestionarioProps) {
  const catalogos = useMemo(() => buildCatalogs(workbook.choices), [workbook]);
  const resumen = useMemo(() => resumirFormulario(structure, catalogos), [structure, catalogos]);
  const secciones = useMemo(
    () => armarDocumento(structure, catalogos, detectMatrixCandidates(workbook)),
    [structure, catalogos, workbook],
  );
  const opcionales = marcarOpcionales(resumen.preguntas, resumen.obligatorias);
  const sinTitulo = secciones.filter((s) => s.sinTitulo).length;

  const documento = useRef<HTMLDivElement>(null);
  const anclas = useRef(new Map<string, HTMLElement>());
  const [actual, setActual] = useState<string>(secciones[0]?.clave ?? "");
  const saltando = useRef<string | null>(null);
  const etiquetaDeNombre = useMemo(() => new Map((structure?.outline ?? []).map((n) => [n.name, n.label])), [structure]);
  const lector = useMemo<LectorReferencias>(() => ({ etiquetaDe: (n) => etiquetaDeNombre.get(n) }), [etiquetaDeNombre]);
  const registrar = (clave: string, el: HTMLElement | null) => {
    if (el) anclas.current.set(clave, el);
    else anclas.current.delete(clave);
  };

  // Seguimiento de lectura: la sección actual es la última cuyo inicio ya pasó el tercio superior del documento.
  useEffect(() => {
    const raiz = documento.current;
    if (!raiz) return undefined;
    const alDesplazar = () => {
      const tope = raiz.getBoundingClientRect().top + raiz.clientHeight / 3;
      let vigente = secciones[0]?.clave ?? "";
      // Mientras viaja un salto del índice, el resaltado es el destino y no lo que pasa por debajo.
      if (saltando.current) return;
      for (const s of secciones) {
        const el = anclas.current.get(s.clave);
        if (el && el.getBoundingClientRect().top <= tope) vigente = s.clave;
      }
      setActual(vigente);
    };
    const finSalto = () => { saltando.current = null; };
    alDesplazar();
    raiz.addEventListener("scroll", alDesplazar, { passive: true });
    raiz.addEventListener("scrollend", finSalto);
    return () => { raiz.removeEventListener("scroll", alDesplazar); raiz.removeEventListener("scrollend", finSalto); };
  }, [secciones]);

  const fichas: Fichas = { abierta, alternar: (name) => onAbrir(alternarFicha(abierta, name)), onEditar };

  // Una dirección con `foco` llega con la ficha abierta: el documento se desplaza hasta esa pregunta, una vez.
  const focoInicial = useRef(abierta);
  useEffect(() => {
    const raiz = documento.current;
    const name = focoInicial.current;
    if (!raiz || !name) return;
    const el = raiz.querySelector<HTMLElement>(`[data-pregunta="${CSS.escape(name)}"]`);
    if (el) raiz.scrollTo({ top: Math.max(0, el.getBoundingClientRect().top - raiz.getBoundingClientRect().top + raiz.scrollTop - 24) });
  }, []);

  // E6 (2026-10-20): el salto lleva el encabezado arriba (su scroll-margin) y el resaltado sale del destino. Se mide
  // con offsetTop respecto del documento (posicionado), que no cambia aunque haya otro desplazamiento en curso.
  const desplazarA = (el: HTMLElement) => {
    const raiz = documento.current;
    if (!raiz) return;
    let top = 0;
    for (let n: HTMLElement | null = el; n && n !== raiz; n = n.offsetParent as HTMLElement | null) top += n.offsetTop;
    const margen = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
    const reducido = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    raiz.scrollTo({ top: Math.max(0, top - margen), behavior: reducido ? "auto" : "smooth" });
  };

  const irASeccion = (clave: string) => {
    const el = anclas.current.get(clave);
    setActual(clave);
    if (!el) return;
    saltando.current = clave;
    window.setTimeout(() => { if (saltando.current === clave) saltando.current = null; }, 1500);
    desplazarA(el);
  };

  const irAPregunta = (name: string) => {
    const el = documento.current?.querySelector<HTMLElement>(`[data-pregunta="${CSS.escape(name)}"]`);
    const seccion = el?.closest<HTMLElement>("[data-seccion]")?.dataset.seccion;
    if (!el) return;
    if (seccion) { setActual(seccion); saltando.current = seccion; window.setTimeout(() => { if (saltando.current === seccion) saltando.current = null; }, 1500); }
    desplazarA(el);
  };

  return (
    <div
      className="pulso-graph-overlay pulso-questionnaire-overlay is-embebido"
      role="region"
      aria-label="Vista del cuestionario"
      data-audit-ready="xlsform-cuestionario"
    >
      <header className="pulso-graph-header">
        <div className="pulso-graph-header-left">
          <div className="pulso-graph-header-title">
            <strong>Vista del cuestionario</strong>
            <span>
              {plural(resumen.preguntas, "pregunta", "preguntas")} · {plural(resumen.secciones, "sección", "secciones")}
              {resumen.preguntas ? ` · ≈ ${minutos(resumen.segundos)} min` : ""}
              {sinTitulo > 0 && onTitular ? ` · ${plural(sinTitulo, "sección sin título", "secciones sin título")}` : ""}
            </span>
          </div>
        </div>
      </header>

      <div className="pulso-xf-cue" ref={documento} data-qa-scroll-owner="cuestionario">
        {secciones.length === 0 ? (
          <p className="pulso-xf-cue-vacio">El cuestionario todavía no tiene preguntas: agrega la primera en el Constructor.</p>
        ) : (
          <div className="pulso-xf-cue-rejilla">
            <IndiceCuestionario secciones={secciones} actual={actual} onSeccion={irASeccion} onPregunta={irAPregunta} />
            <div className="pulso-xf-cue-pagina" lang="es" data-qa-geometry-group="xlsform/cuestionario-documento" data-qa-geometry-contract="intrinsic">
              <div className="pulso-xf-cue-leyenda">
                {opcionales
                  ? <span>Todas son obligatorias salvo las marcadas <span className="pulso-xf-cue-opcional">opcional</span>.</span>
                  : <span><span className="pulso-xf-cue-obligatoria">*</span> obligatoria</span>}
                <span>Toca una pregunta para ver su ficha.</span>
              </div>
              {logicaPendiente && (
                <div className="pulso-xf-cue-aviso" role="note">
                  <AlertTriangle size={15} aria-hidden="true" />
                  <span>La lógica importada todavía no se revisa: los saltos y condiciones pueden no estar todos.</span>
                  {onRevisarLogica && (
                    <button type="button" className="pulso-xf-cue-enlace" onClick={onRevisarLogica}>
                      Revisar la lógica <ArrowRight size={13} aria-hidden="true" />
                    </button>
                  )}
                </div>
              )}
              <Lector.Provider value={lector}>
                {secciones.map((s) => (
                  <Seccion key={s.clave} seccion={s} marcarOpcionales={opcionales} fichas={fichas} registrar={registrar} onTitular={onTitular} />
                ))}
              </Lector.Provider>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
