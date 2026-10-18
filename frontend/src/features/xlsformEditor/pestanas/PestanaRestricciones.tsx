import { useMemo, useState } from "react";
import { Pencil } from "../../../vendor/lucide-react";
import { enriquecerAlcance, type LogicScope } from "../logic";
import { LECTURA_FILA_ROTA, esFilaRota } from "../reglas/motor/filaRota";
import type { BuilderStructure } from "../types";
import { describeValidation } from "../canvas/reglasHumanas";
import { PanelCard, QuestionToken, ReadsAs, TypeIcon } from "../kit";
import { PiezasLectura, TituloLegible, tituloPlano } from "../kit/CuerpoPanelMarca";
import { leerRegla } from "../reglas/leerRegla";
import { Markdown } from "./Markdown";
import { EditarEnConstructor } from "../shell/EditarEnConstructor";
import { EditorValidacion } from "../canvas/constructor/EditorValidacion";
import { PestanaReglas, type ReglaListaGrupo } from "./PestanaReglas";
import { restriccionesDelFormulario } from "./reglasModel";
import { ProbarRestriccion } from "./ProbarRestriccion";

// Pestaña Restricciones (revamp 2026-10-16): todas las reglas de «qué acepta» del formulario
// en un solo lugar. El Constructor edita la misma regla en línea; aquí hay más espacio para
// leerla, ver de qué otras preguntas depende y qué le falta.

export type PestanaRestriccionesProps = {
  structure: BuilderStructure | null;
  scope: LogicScope;
  seleccionada: string | null;
  onSeleccionar: (variable: string | null) => void;
  onEditar: (rowIndex: number) => void;
  /** Escritura de la regla en la fila (constraint / constraint_message): el mismo camino que usa el Constructor. */
  onCampo: (rowIndex: number, field: string, value: string) => void;
  onCampos: (rowIndex: number, updates: Record<string, string>) => void;
  /** Opciones de cada lista, para probar reglas de preguntas de selección. */
  catalogs: { listName: string; items: { name: string; label: string }[] }[];
};

export function PestanaRestricciones({ structure, scope: scopeBase, seleccionada, onSeleccionar, onEditar, onCampo, onCampos, catalogs }: PestanaRestriccionesProps) {
  const scope = useMemo(() => enriquecerAlcance(scopeBase, structure), [scopeBase, structure]);
  // Un «mensaje» que repite el nombre de la pregunta (fila rota) no es un mensaje: cuenta como que falta (S5).
  const items = useMemo(
    () => restriccionesDelFormulario(structure).map((i) => {
      const mensaje = (i.node.constraint_message ?? "").trim();
      const rota = esFilaRota(i.node);
      return { ...i, rota, usa: rota ? [] : i.usa, sinMensaje: i.sinMensaje || (i.estado === "con" && mensaje === i.node.name) };
    }),
    [structure],
  );
  const con = useMemo(() => items.filter((i) => i.estado === "con"), [items]);
  const sugeridas = useMemo(() => items.filter((i) => i.estado === "sugerida"), [items]);
  const actual = items.find((i) => i.node.name === seleccionada) ?? con[0] ?? sugeridas[0] ?? null;
  const numero = (n: { paperNumber?: string; name: string }) => n.paperNumber || n.name;
  const grupos: ReglaListaGrupo[] = useMemo(() => [
    {
      titulo: "Con restricción",
      items: con.map((i) => ({
        key: i.node.name, baseType: i.node.typeInfo.base, numero: i.node.paperNumber ?? "", titulo: i.node.label || i.node.name,
        resumen: i.rota ? LECTURA_FILA_ROTA : i.sinMensaje ? "Sin mensaje para quien se equivoca" : describeValidation(i.node.constraint, i.node, scope)?.summary ?? i.node.constraint,
        aviso: i.sinMensaje || i.rota,
      })),
    },
    {
      titulo: "Sugeridas",
      items: sugeridas.map((i) => ({
        key: i.node.name, baseType: i.node.typeInfo.base, numero: i.node.paperNumber ?? "", titulo: i.node.label || i.node.name,
        resumen: "Acepta cualquier valor",
      })),
    },
  ], [con, sugeridas, scope]);
  const lectura = useMemo(() => (actual ? leerRegla("constraint", actual.node.constraint, actual.node, scope) : null), [actual, scope]);
  const mensajeActual = (actual?.node.constraint_message ?? "").trim();
  const porNombre = (name: string) => structure?.outline.find((n) => n.name === name) ?? null;
  const etiquetaDe = (name: string) => porNombre(name)?.label ?? "";
  // Una sola insignia por regla, del mismo vocabulario en todas: antes convivían «Regla avanzada» y «Regla técnica» (S12).
  const estado = !actual ? "" : actual.rota ? "fila rota" : actual.estado !== "con" ? "sin regla" : lectura?.tecnica ? "sin traducir" : "vigente";
  const [editando, setEditando] = useState(false);
  // Cambiar de pregunta cierra el editor: la lectura es lo primero que se ve.
  const clave = actual?.node.rowIndex ?? -1;
  const [claveEditor, setClaveEditor] = useState(clave);
  if (claveEditor !== clave) { setClaveEditor(clave); setEditando(false); }
  const focoPerdido = seleccionada && actual && actual.node.name !== seleccionada
    ? <>No hay una restricción para <code>{seleccionada}</code>: se muestra la primera de la lista.</>
    : null;

  return (
    <PestanaReglas
      titulo="Restricciones"
      marca="regla"
      total={`${con.length} con regla · ${sugeridas.length} sugeridas`}
      grupos={grupos}
      seleccionada={actual?.node.name ?? null}
      onSeleccionar={onSeleccionar}
      vacio="Este formulario no tiene preguntas de número ni de fecha, ni reglas de qué aceptan."
      vacioDetalle={
        <PanelCard title="Sin restricciones" fill flush>
          <ReadsAs label="Qué es">Una regla de qué acepta una pregunta: un rango de edad, un formato de correo, un año que no puede ser futuro.</ReadsAs>
          <ReadsAs label="En XLSForm">La columna <span className="xfk-mono">constraint</span>, con su mensaje en <span className="xfk-mono">constraint_message</span>.</ReadsAs>
          <ReadsAs label="Dónde aparecen">Cada pregunta de número o fecha aparecerá aquí como sugerida, y las que tengan regla, con su lectura.</ReadsAs>
        </PanelCard>
      }
      aviso={focoPerdido}
      pie="Una restricción no deja avanzar a quien responde fuera de la regla: le muestra tu mensaje."
    >
      {actual ? (
        <>
          <div className="xfp-encabezado">
            <span className="xfp-encabezado__ruta"><TypeIcon baseType={actual.node.typeInfo.base} boxed /> Restricción{actual.node.label ? <> · <code className="xfp-codigo">{actual.node.name}</code></> : null}</span>
            <h2 className="xfp-encabezado__titulo"><TituloLegible texto={actual.node.label || actual.node.name} /></h2>
            <span className="xfp-encabezado__accion"><EditarEnConstructor onEditar={() => onEditar(actual.node.rowIndex)} que={`la pregunta ${numero(actual.node)}`} /></span>
          </div>
          <PanelCard
            title="Regla"
            meta={<span className={`xfp-insignia is-${estado.replace(/\s+/g, "-")}`}>{estado}</span>}
            footer={actual.estado === "con" ? (
              <button type="button" className="xfp-boton" aria-expanded={editando} onClick={() => setEditando((v) => !v)}>
                <Pencil size={13} aria-hidden="true" /> {editando ? "Cerrar el editor" : "Editar la regla"}
              </button>
            ) : undefined}
          >
            <div className="xfp-lectura-regla">
              <p className="xfp-lectura" data-qa-geometry-group="xlsform/lectura-regla" data-qa-geometry-contract="intrinsic">
                {actual.estado !== "con"
                  ? "Acepta cualquier valor: todavía no tiene restricción."
                  : actual.rota
                    ? LECTURA_FILA_ROTA
                    : lectura?.tecnica
                      ? "El motor todavía no traduce esta regla: se aplica tal como está escrita."
                      : <PiezasLectura piezas={lectura?.piezas ?? []} />}
              </p>
              <dl className="xfp-def">
                <dt>Mensaje</dt>
                <dd>
                  {mensajeActual && mensajeActual !== actual.node.name
                    ? <Markdown texto={mensajeActual} />
                    : <span className="xfp-nota">{mensajeActual ? "Sin mensaje: el de esta fila es el nombre de la pregunta repetido." : actual.estado === "con" ? "Sin mensaje: quien se equivoque verá un aviso genérico." : "Se escribe junto con la regla."}</span>}
                </dd>
              </dl>
              {actual.node.constraint.trim() ? (
                <details className="xfp-codigo-xls" open={Boolean(lectura?.tecnica)}>
                  <summary>Expresión en XLSForm</summary>
                  <code>{actual.node.constraint.trim()}</code>
                </details>
              ) : null}
            </div>
            {editando || actual.estado !== "con" ? (
              <div className="xfp-editor-regla">
                <EditorValidacion
                  node={actual.node}
                  scope={scope}
                  onFieldChange={(field, value) => onCampo(actual.node.rowIndex, field, value)}
                  onFieldsChange={(updates) => onCampos(actual.node.rowIndex, updates)}
                />
              </div>
            ) : null}
          </PanelCard>
          {actual.estado === "con" ? <ProbarRestriccion node={actual.node} opciones={catalogs.find((c) => c.listName === actual.node.typeInfo.listName)?.items ?? []} /> : null}
          <div className="xfp-fila2" data-qa-geometry-group="xlsform/restricciones-fila" data-qa-geometry-contract="equal">
            <PanelCard title="Depende de" meta={actual.usa.length ? `${actual.usa.length} pregunta${actual.usa.length === 1 ? "" : "s"}` : undefined} fill>
              {actual.usa.length ? (
                <div className="xfp-toks">
                  {actual.usa.map((v) => {
                    const n = porNombre(v);
                    return <QuestionToken key={v} baseType={n?.typeInfo.base ?? ""} label={n ? numero(n) : v} hint={n?.label ? tituloPlano(n.label, etiquetaDe) : undefined} variable={v} />;
                  })}
                </div>
              ) : <p className="xfp-nota">{actual.rota ? "Ninguna: la fila está rota y no tiene una regla real." : "Sólo mira la propia respuesta."}</p>}
            </PanelCard>
            <PanelCard title="Antes de aplicar" fill>
              <ul className="xfp-check" data-qa-geometry-group="xlsform/restricciones-checks" data-qa-geometry-contract="intrinsic">
                <li className={actual.estado === "con" && !actual.rota ? "is-ok" : "is-aviso"}>{actual.rota ? "La fila está rota: su regla es el nombre de la pregunta repetido." : actual.estado === "con" ? "Tiene una regla de qué acepta." : "Un número sin límites acepta errores de digitación."}</li>
                <li className={actual.sinMensaje || actual.estado !== "con" ? "is-aviso" : "is-ok"}>{actual.sinMensaje || actual.estado !== "con" ? "Falta un mensaje que diga qué escribir." : "Tiene mensaje para quien se equivoca."}</li>
              </ul>
            </PanelCard>
          </div>
        </>
      ) : null}
    </PestanaReglas>
  );
}
