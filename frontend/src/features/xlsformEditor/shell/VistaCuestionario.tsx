// =============================================================================
// shell/VistaCuestionario.tsx — pestaña «Vista del cuestionario»
// =============================================================================
// La vista de LECTURA (2026-10-15): el formulario como lo verá la persona
// encuestada, como una página. A la izquierda el índice de secciones
// (`ListaPartes`, con seguimiento de lectura); al centro una columna de lectura
// con cada pregunta numerada, su enunciado completo, su ayuda, sus opciones como
// se ven (círculo, cuadrado, línea, recuadro), las notas, las matrices y la
// lógica en contexto. Cada pregunta abre su lugar en el Constructor.
//
// Un solo dueño de scroll: el documento. El índice queda fijo a la izquierda.
// Las cifras de la cabecera usan la regla del Resumen (una sola definición).
// =============================================================================

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { ListaPartes, type GrupoDePartes } from "../../../components/ListaPartes";
import { AlertTriangle, ArrowRight, Repeat } from "../../../vendor/lucide-react";
import type { BuilderStructure, XlsformEditorWorkbook } from "../types";
import { buildCatalogs } from "../parsing/buildIndex";
import { detectMatrixCandidates } from "../parsing/detectMatrixCandidates";
import { renderMarkdownInline, stripMarkdown } from "../helpers/markdown";
import { duracion, minutos, resumirFormulario } from "../resumen/modeloResumen";
import {
  armarDocumento,
  marcarOpcionales,
  type BloqueDoc,
  type OpcionDoc,
  type PreguntaDoc,
  type SeccionDoc,
} from "../cuestionario/modeloCuestionario";
import "../cuestionario/cuestionario.css";

export type VistaCuestionarioProps = {
  workbook: XlsformEditorWorkbook;
  structure: BuilderStructure | null;
  /** La lógica importada espera revisión (el mismo estado que anuncia la cabecera). */
  logicaPendiente: boolean;
  onRevisarLogica?: () => void;
  onIrAPregunta: (name: string) => void;
};

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

function Markdown({ texto, como = "span", className }: { texto: string; como?: "span" | "p" | "h3"; className?: string }) {
  const Tag = como;
  // renderMarkdownInline escapa el texto y sólo emite el subconjunto de marcas del editor.
  return <Tag className={className} dangerouslySetInnerHTML={{ __html: renderMarkdownInline(texto) }} />;
}

function Marca({ forma }: { forma: "una" | "varias" }) {
  return <span className={`pulso-xf-cue-marca is-${forma}`} aria-hidden="true" />;
}

function Opciones({ pregunta }: { pregunta: PreguntaDoc }) {
  const { forma, opciones, rango } = pregunta;
  if ((forma === "una" || forma === "varias" || forma === "orden") && opciones.length > 0) {
    return (
      <ul className={`pulso-xf-cue-opciones${opciones.length > 6 ? " is-columnas" : ""}`}>
        {opciones.map((o) => (
          <li key={o.codigo}>
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
        {rango && (
          <span className="pulso-xf-cue-rango">
            {rango.min && rango.max ? `entre ${rango.min} y ${rango.max}` : rango.min ? `desde ${rango.min}` : `hasta ${rango.max}`}
          </span>
        )}
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

function Pregunta({ pregunta, marcarOpcionales: opcionales, onAbrir }: {
  pregunta: PreguntaDoc;
  marcarOpcionales: boolean;
  onAbrir: (name: string) => void;
}) {
  const { nodo, numero, condicion } = pregunta;
  const abrir = () => onAbrir(nodo.name);
  const marca = opcionales ? (!nodo.required ? "opcional" : null) : nodo.required ? "*" : null;
  return (
    <article className="pulso-xf-cue-pregunta" data-qa-geometry-member="">
      {condicion && <p className="pulso-xf-cue-condicion">Aparece si {condicion}</p>}
      <div
        className="pulso-xf-cue-cabeza"
        role="button"
        tabIndex={0}
        onClick={abrir}
        onKeyDown={(e) => abrirConTeclado(e, abrir)}
        aria-label={`Abrir la pregunta ${numero} en el Constructor`}
        title="Abrir en el Constructor"
      >
        <span className="pulso-xf-cue-numero">
          {numero}.
          {marca === "*" && <span className="pulso-xf-cue-obligatoria" aria-label="obligatoria">*</span>}
        </span>
        <Markdown como="h3" className="pulso-xf-cue-enunciado" texto={nodo.label || nodo.name} />
        {marca === "opcional" && <span className="pulso-xf-cue-opcional">opcional</span>}
      </div>
      {nodo.hint.trim() && <Markdown como="p" className="pulso-xf-cue-ayuda" texto={nodo.hint} />}
      <Opciones pregunta={pregunta} />
    </article>
  );
}

function Matriz({ bloque, marcarOpcionales: opcionales, onAbrir }: {
  bloque: Extract<BloqueDoc, { tipo: "matriz" }>;
  marcarOpcionales: boolean;
  onAbrir: (name: string) => void;
}) {
  const forma = bloque.filas[0]?.forma === "varias" ? "varias" : "una";
  return (
    <article className="pulso-xf-cue-pregunta is-matriz" data-qa-geometry-member="">
      <div className="pulso-xf-cue-matriz-marco">
        <table className="pulso-xf-cue-matriz">
          <thead>
            <tr>
              <th scope="col"><span className="pulso-xf-cue-sr">Pregunta</span></th>
              {bloque.escala.map((o: OpcionDoc) => (
                <th key={o.codigo} scope="col"><Markdown texto={o.etiqueta} /></th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bloque.filas.map((f) => (
              <tr key={f.nodo.name} onClick={() => onAbrir(f.nodo.name)} title="Abrir en el Constructor">
                <th scope="row">
                  <button type="button" className="pulso-xf-cue-matriz-fila" onClick={(e) => { e.stopPropagation(); onAbrir(f.nodo.name); }}
                    aria-label={`Abrir la pregunta ${f.numero} en el Constructor`}>
                    <span className="pulso-xf-cue-numero">
                      {f.numero}.
                      {!opcionales && f.nodo.required && <span className="pulso-xf-cue-obligatoria" aria-label="obligatoria">*</span>}
                    </span>
                    <Markdown texto={f.nodo.label || f.nodo.name} />
                    {opcionales && !f.nodo.required && <span className="pulso-xf-cue-opcional">opcional</span>}
                  </button>
                  {f.condicion && <span className="pulso-xf-cue-condicion is-fila">Aparece si {f.condicion}</span>}
                </th>
                {bloque.escala.map((o) => <td key={o.codigo}><Marca forma={forma} /></td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}

function Seccion({ seccion, marcarOpcionales: opcionales, onAbrir, registrar }: {
  seccion: SeccionDoc;
  marcarOpcionales: boolean;
  onAbrir: (name: string) => void;
  registrar: (clave: string, el: HTMLElement | null) => void;
}) {
  return (
    <section className="pulso-xf-cue-seccion" ref={(el) => registrar(seccion.clave, el)} data-seccion={seccion.clave} data-qa-geometry-member=""
      aria-labelledby={`xf-cue-${seccion.clave}`}>
      <header className="pulso-xf-cue-banda">
        <h2 id={`xf-cue-${seccion.clave}`}>
          {seccion.repite && <Repeat size={14} aria-hidden="true" />}
          <Markdown texto={seccion.rotulo} />
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
          if (b.tipo === "matriz") return <Matriz key={b.clave} bloque={b} marcarOpcionales={opcionales} onAbrir={onAbrir} />;
          return <Pregunta key={b.pregunta.nodo.name} pregunta={b.pregunta} marcarOpcionales={opcionales} onAbrir={onAbrir} />;
        })}
      </div>
    </section>
  );
}

export function VistaCuestionario({ workbook, structure, logicaPendiente, onRevisarLogica, onIrAPregunta }: VistaCuestionarioProps) {
  const catalogos = useMemo(() => buildCatalogs(workbook.choices), [workbook]);
  const resumen = useMemo(() => resumirFormulario(structure, catalogos), [structure, catalogos]);
  const secciones = useMemo(
    () => armarDocumento(structure, catalogos, detectMatrixCandidates(workbook)),
    [structure, catalogos, workbook],
  );
  const opcionales = marcarOpcionales(resumen.preguntas, resumen.obligatorias);

  const documento = useRef<HTMLDivElement>(null);
  const anclas = useRef(new Map<string, HTMLElement>());
  const [actual, setActual] = useState<string>(secciones[0]?.clave ?? "");
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
      for (const s of secciones) {
        const el = anclas.current.get(s.clave);
        if (el && el.getBoundingClientRect().top <= tope) vigente = s.clave;
      }
      setActual(vigente);
    };
    alDesplazar();
    raiz.addEventListener("scroll", alDesplazar, { passive: true });
    return () => raiz.removeEventListener("scroll", alDesplazar);
  }, [secciones]);

  const irASeccion = (clave: string) => {
    setActual(clave);
    // Se desplaza sólo el documento: scrollIntoView movería también los contenedores de la pestaña.
    const raiz = documento.current;
    const el = anclas.current.get(clave);
    if (!raiz || !el) return;
    const destino = el.getBoundingClientRect().top - raiz.getBoundingClientRect().top + raiz.scrollTop - 20;
    raiz.scrollTo({ top: Math.max(0, destino), behavior: "smooth" });
  };

  const grupos: GrupoDePartes<string>[] = [{
    id: "secciones",
    titulo: "Secciones",
    partes: secciones.map((s) => ({
      clave: s.clave,
      rotulo: stripMarkdown(s.rotulo),
      detalle: `${plural(s.preguntas, "pregunta", "preguntas")}${s.preguntas ? ` · ${duracion(s.segundos)}` : ""}`,
      ...(s.conCondicion > 0 ? { estado: { tono: "neutro" as const, texto: "condicional" } } : {}),
    })),
  }];

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
            </span>
          </div>
        </div>
      </header>

      <div className="pulso-xf-cue" ref={documento} data-qa-scroll-owner="cuestionario">
        {secciones.length === 0 ? (
          <p className="pulso-xf-cue-vacio">El cuestionario todavía no tiene preguntas: agrega la primera en el Constructor.</p>
        ) : (
          <div className="pulso-xf-cue-rejilla">
            <nav className="pulso-xf-cue-indice" aria-label="Índice del cuestionario">
              <ListaPartes etiqueta="Secciones del cuestionario" grupos={grupos} actual={actual} onElegir={irASeccion} prefijoId="xf-cue-indice" />
            </nav>
            <div className="pulso-xf-cue-pagina" lang="es" data-qa-geometry-group="xlsform/cuestionario-documento" data-qa-geometry-contract="intrinsic">
              <div className="pulso-xf-cue-leyenda">
                {opcionales
                  ? <span>Todas son obligatorias salvo las marcadas <span className="pulso-xf-cue-opcional">opcional</span>.</span>
                  : <span><span className="pulso-xf-cue-obligatoria">*</span> obligatoria</span>}
                <span>Toca una pregunta para abrirla en el Constructor.</span>
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
              {secciones.map((s) => (
                <Seccion key={s.clave} seccion={s} marcarOpcionales={opcionales} onAbrir={onIrAPregunta} registrar={registrar} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
