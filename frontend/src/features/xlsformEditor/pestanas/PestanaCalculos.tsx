import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Pencil, Plus } from "../../../vendor/lucide-react";
import { enriquecerAlcance, type LogicScope } from "../logic";
import { DONDE_SE_USA, indiceDeUsos } from "../logic/usos";
import { leerRegla } from "../reglas/leerRegla";
import { EditorFormula } from "./EditorFormula";
import { stripMarkdown } from "../helpers/markdown";
import type { BuilderStructure } from "../types";
import { PanelCard, QuestionToken, ReadsAs, TypeIcon } from "../kit";
import { EditarEnConstructor } from "../shell/EditarEnConstructor";
import { PestanaReglas, type ReglaListaGrupo } from "./PestanaReglas";
import { calculosDelFormulario, referenciasDe } from "./reglasModel";
import { EtiquetaLegible, LecturaPiezas } from "./LecturaPiezas";
import { etiquetaPlana, textoLegible } from "./variablesLegibles";
import { fragmentoDe, insertarEnCursor, type Funcion } from "./catalogoModelo";
import { ProbarCalculo } from "./ProbarCalculo";
import { CatalogoFunciones } from "./CatalogoFunciones";
import { CalculationRecipePanel } from "../canvas/constructor/CalculoRepeticionPaneles";

// Pestaña Cálculos (revamp 2026-10-16): cada `calculate` del formulario con su fórmula leída
// en español, de qué respuestas sale y quién lo usa después.

export type PestanaCalculosProps = {
  structure: BuilderStructure | null;
  scope: LogicScope;
  seleccionada: string | null;
  onSeleccionar: (variable: string | null) => void;
  onEditar: (rowIndex: number) => void;
  onCampo: (rowIndex: number, field: string, value: string) => void;
  catalogs: { listName: string; items: { name: string; label: string }[] }[];
  /** M5: crea un cálculo al final del formulario y lo deja abierto aquí (cada pestaña deja crear lo que muestra). */
  onNuevo?: () => void;
};

export function PestanaCalculos({ structure, scope: scopeBase, seleccionada, onSeleccionar, onEditar, onCampo, catalogs, onNuevo }: PestanaCalculosProps) {
  const opcionesDe = useCallback((listName: string) => catalogs.find((c) => c.listName === listName)?.items ?? [], [catalogs]);
  // Con la estructura el motor cita grupos y repeticiones por su etiqueta (indexed-repeat, sum, join).
  const scope = useMemo(() => enriquecerAlcance(scopeBase, structure), [scopeBase, structure]);
  // «Lo usan» cuenta TODAS las columnas: también la etiqueta, la ayuda, los mensajes y las opciones (S1).
  const usos = useMemo(() => indiceDeUsos(structure, catalogs), [structure, catalogs]);
  const items = useMemo(
    () => calculosDelFormulario(structure).map((i) => ({ ...i, loUsan: usos.get(i.node.name) ?? [] })),
    [structure, usos],
  );
  const actual = items.find((i) => i.node.name === seleccionada) ?? items[0] ?? null;
  const porNombre = (name: string) => structure?.outline.find((n) => n.name === name) ?? null;
  const etiquetaDe = (name: string) => stripMarkdown(porNombre(name)?.label ?? "");
  const numero = (n: { paperNumber?: string; name: string }) => n.paperNumber || n.name;
  // Título: la etiqueta o, sin ella, el código UNA vez; debajo, qué hace la fórmula leída por el motor (S13: antes el
  // título repetía el código y el resumen era el mismo código otra vez).
  const grupos: ReglaListaGrupo[] = useMemo(() => {
    const etq = (name: string) => structure?.outline.find((n) => n.name === name)?.label ?? "";
    const item = (i: (typeof items)[number]) => {
      const leida = i.vacio ? null : leerRegla("calculation", i.node.calculation, i.node, scope);
      return {
        key: i.node.name, baseType: i.enPregunta ? i.node.typeInfo.base : "calculate", numero: "", titulo: i.node.label ? etiquetaPlana(i.node.label, etq) : i.node.name,
        resumen: i.vacio ? "Sin fórmula: quedará vacío" : leida && !leida.tecnica ? textoLegible(leida.piezas, etq) : "Fórmula que el editor no traduce",
        aviso: i.vacio,
      };
    };
    return [
      { titulo: "En uso", items: items.filter((i) => !i.enPregunta && i.loUsan.length > 0).map(item) },
      { titulo: "Sólo para la base", items: items.filter((i) => !i.enPregunta && i.loUsan.length === 0).map(item) },
      { titulo: "Preguntas con fórmula", items: items.filter((i) => i.enPregunta).map(item) },
    ];
  }, [items, scope, structure]);
  const lectura = useMemo(() => (actual && !actual.vacio ? leerRegla("calculation", actual.node.calculation, actual.node, scope) : null), [actual, scope]);
  const enPreguntas = items.filter((i) => i.enPregunta).length;
  const [editando, setEditando] = useState(false);
  const clave = actual?.node.rowIndex ?? -1;
  const [claveEditor, setClaveEditor] = useState(clave);
  // El borrador de la fórmula vive aquí: lo evalúa «Probar con respuestas» y el catálogo inserta en él.
  const [borrador, setBorrador] = useState<{ fila: number; texto: string } | null>(null);
  if (claveEditor !== clave) { setClaveEditor(clave); setEditando(false); setBorrador(null); }
  const guardada = actual?.node.calculation ?? "";
  const editorAbierto = Boolean(actual) && (editando || Boolean(actual?.vacio));
  const texto = borrador && borrador.fila === clave ? borrador.texto : guardada;
  const formulaPrueba = editorAbierto ? texto : guardada;
  const usaPrueba = useMemo(() => referenciasDe(formulaPrueba).filter((v) => v !== actual?.node.name), [formulaPrueba, actual?.node.name]);
  const campoRef = useRef<HTMLTextAreaElement | null>(null);
  const cursorPendiente = useRef<number | null>(null);
  useLayoutEffect(() => {
    const c = cursorPendiente.current;
    if (c === null || !campoRef.current) return;
    cursorPendiente.current = null;
    campoRef.current.focus();
    campoRef.current.setSelectionRange(c, c);
  });
  const insertar = (f: Funcion) => {
    if (!actual) return;
    const campo = campoRef.current;
    const ini = campo ? campo.selectionStart : texto.length;
    const fin = campo ? campo.selectionEnd : texto.length;
    const r = insertarEnCursor(texto, ini, fin, fragmentoDe(f));
    setEditando(true);
    setBorrador({ fila: clave, texto: r.texto });
    cursorPendiente.current = r.cursor;
  };
  const focoPerdido = seleccionada && actual && actual.node.name !== seleccionada
    ? <>No hay un cálculo llamado <code>{seleccionada}</code>: se muestra el primero de la lista.</>
    : null;

  return (
    <PestanaReglas
      titulo="Cálculos"
      marca="calc"
      total={`${items.length} cálculo${items.length === 1 ? "" : "s"}${enPreguntas ? ` · ${enPreguntas} en preguntas` : ""}`}
      aviso={focoPerdido}
      grupos={grupos}
      seleccionada={actual?.node.name ?? null}
      onSeleccionar={onSeleccionar}
      vacio={<>Este formulario todavía no tiene cálculos.{onNuevo ? <NuevoCalculo onNuevo={onNuevo} /> : null}</>}
      vacioDetalle={<CalculosVacio />}
      lateral={<CatalogoFunciones scope={scope} onInsertar={actual ? insertar : undefined} />}
      pie={onNuevo ? <NuevoCalculo onNuevo={onNuevo} /> : undefined}
    >
      {actual ? (
        <>
          <div className="xfp-encabezado">
            <span className="xfp-encabezado__ruta">
              <TypeIcon baseType={actual.enPregunta ? actual.node.typeInfo.base : "calculate"} boxed /> {actual.enPregunta ? "Pregunta con fórmula" : "Cálculo"}
              {actual.node.label ? <> · <code className="xfp-codigo">{actual.node.name}</code></> : null}
            </span>
            <h2 className="xfp-encabezado__titulo">{actual.node.label ? <EtiquetaLegible texto={actual.node.label} etiquetaDe={etiquetaDe} /> : <code className="xfp-var is-codigo">{actual.node.name}</code>}</h2>
            <span className="xfp-encabezado__accion"><EditarEnConstructor onEditar={() => onEditar(actual.node.rowIndex)} que={`el cálculo ${actual.node.name}`} /></span>
          </div>
          <PanelCard
            title="Fórmula"
            meta={<span className={`xfp-insignia is-${actual.vacio ? "sin-regla" : lectura?.tecnica ? "sin-traducir" : "vigente"}`}>{actual.vacio ? "vacía" : lectura?.tecnica ? "sin traducir" : "vigente"}</span>}
            footer={actual.vacio ? undefined : (
              <button type="button" className="xfp-boton" aria-expanded={editando} onClick={() => setEditando((v) => !v)}>
                <Pencil size={13} aria-hidden="true" /> {editando ? "Cerrar el editor" : "Editar la fórmula"}
              </button>
            )}
          >
            <div className="xfp-lectura-regla">
              <p className="xfp-lectura" data-qa-geometry-group="xlsform/lectura-regla" data-qa-geometry-contract="intrinsic">
                {actual.vacio
                  ? "Sin fórmula: la columna quedará vacía en la base."
                  : lectura?.tecnica
                    ? "El motor todavía no traduce esta fórmula: se calcula tal como está escrita."
                    : <LecturaPiezas piezas={lectura?.piezas ?? []} etiquetaDe={etiquetaDe} />}
              </p>
              {actual.enPregunta ? <p className="xfp-nota">La respuesta de esta pregunta sale de la fórmula: quien encuesta no la escribe.</p> : null}
              {!actual.vacio && !editorAbierto ? (
                <details className="xfp-codigo-xls" open={Boolean(lectura?.tecnica)}>
                  <summary>Expresión en XLSForm</summary>
                  <code>{actual.node.calculation.trim()}</code>
                </details>
              ) : null}
            </div>
            {actual.vacio ? (
              <CalculationRecipePanel
                expression={actual.node.calculation}
                scope={scope}
                onFieldChange={(field, value) => onCampo(actual.node.rowIndex, field, value)}
              />
            ) : null}
            {editorAbierto ? (
              <EditorFormula
                key={actual.node.rowIndex}
                valor={guardada}
                texto={texto}
                campoRef={campoRef}
                onTexto={(t) => setBorrador({ fila: clave, texto: t })}
                onGuardar={(v) => { onCampo(actual.node.rowIndex, "calculation", v); setBorrador(null); setEditando(false); }}
              />
            ) : null}
          </PanelCard>
          <ProbarCalculo key={actual.node.rowIndex} node={actual.node} formula={formulaPrueba} usa={usaPrueba} structure={structure} opcionesDe={opcionesDe} />
          <div className="xfp-fila2" data-qa-geometry-group="xlsform/calculos-fila" data-qa-geometry-contract="equal">
            <PanelCard title="Usa" meta={actual.usa.length ? `${actual.usa.length}` : undefined} fill>
              {actual.usa.length ? (
                <div className="xfp-toks">
                  {actual.usa.map((v) => {
                    const n = porNombre(v);
                    return <QuestionToken key={v} baseType={n?.typeInfo.base ?? ""} label={n ? numero(n) : v} hint={n?.label ? etiquetaPlana(n.label, etiquetaDe) : undefined} variable={v} />;
                  })}
                </div>
              ) : <p className="xfp-nota">No lee ninguna respuesta.</p>}
            </PanelCard>
            <PanelCard title="Lo usan" meta={actual.loUsan.length ? `${actual.loUsan.length}` : undefined} fill>
              {actual.loUsan.length ? (
                <ul className="xfp-usos">
                  {actual.loUsan.map((u) => (
                    <li key={`${u.node.rowIndex}-${u.columna}-${u.opcion?.valor ?? ""}`}>
                      <QuestionToken baseType={u.node.typeInfo.base} label={numero(u.node)} hint={etiquetaPlana(u.node.label, etiquetaDe)} variable={u.node.name} />
                      {/* M2: el sufijo es corto para no comerse el título; qué opción, en el tooltip y sin `${x}` crudo. */}
                      <span className="xfp-usos__col" title={u.opcion ? `Opción de la lista ${u.opcion.lista}: ${etiquetaPlana(u.opcion.etiqueta, etiquetaDe)}` : undefined}>
                        {DONDE_SE_USA[u.columna]}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : <p className="xfp-nota">Ninguna fila lo usa, ni en sus reglas ni en sus textos: sólo queda como columna en la base.</p>}
            </PanelCard>
          </div>
        </>
      ) : null}
    </PestanaReglas>
  );
}

function NuevoCalculo({ onNuevo }: { onNuevo: () => void }) {
  return (
    <button type="button" className="xfp-nuevo" onClick={onNuevo}>
      <Plus size={14} aria-hidden="true" /> Nuevo cálculo
    </button>
  );
}

const EJEMPLOS = [
  { titulo: "Tramo de edad", formula: "if(${edad} < 25, '18 a 24', '25 o más')", lee: "Agrupa la edad en tramos para cruzar resultados." },
  { titulo: "Índice promedio", formula: "round((${p8_1} + ${p8_2} + ${p8_3}) div 3, 1)", lee: "Resume una tabla de satisfacción en un solo número." },
  { titulo: "Cuántas marcó", formula: "count-selected(${servicios})", lee: "Cuenta las opciones elegidas en una pregunta múltiple." },
  { titulo: "Años desde el egreso", formula: "format-date(today(), '%Y') - ${anio_egreso}", lee: "Convierte un año en tiempo transcurrido." },
  { titulo: "Nombre completo", formula: "concat(${nombres}, ' ', ${apellidos})", lee: "Une dos textos para listados y fichas." },
  { titulo: "Duración", formula: "decimal-date-time(${fin}) - decimal-date-time(${inicio})", lee: "Mide cuánto tardó la entrevista." },
];

function CalculosVacio() {
  return (
    <>
      <div className="xfp-encabezado">
        <span className="xfp-encabezado__ruta"><TypeIcon baseType="calculate" boxed /> Cálculos</span>
        <h2 className="xfp-encabezado__titulo">Este formulario todavía no tiene cálculos</h2>
      </div>
      <PanelCard title="Qué es un cálculo" flush>
        <ReadsAs label="Qué hace">Se obtiene de otras respuestas, no se pregunta. Queda como columna en la base y puede decidir qué preguntas aparecen.</ReadsAs>
        <ReadsAs label="En XLSForm">Una fila de tipo <span className="xfk-mono">calculate</span> con su fórmula en la columna <span className="xfk-mono">calculation</span>.</ReadsAs>
        <ReadsAs label="Cómo crearlo">Con Nuevo cálculo, en la lista de la izquierda: queda al final del formulario y se abre aquí para escribir su fórmula. En el Constructor puedes ubicarlo donde lo necesites.</ReadsAs>
      </PanelCard>
      <PanelCard title="Cálculos frecuentes en encuestas" meta="ejemplos" fill flush>
        <ul className="xfp-ejemplos">
          {EJEMPLOS.map((e) => (
            <li key={e.titulo}>
              <span className="xfp-ejemplos__titulo">{e.titulo}</span>
              <span className="xfp-ejemplos__lee">{e.lee}</span>
              <code className="xfp-ejemplos__formula">{e.formula}</code>
            </li>
          ))}
        </ul>
      </PanelCard>
    </>
  );
}
