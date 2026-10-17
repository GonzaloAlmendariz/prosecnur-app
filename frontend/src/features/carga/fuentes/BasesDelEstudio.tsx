// Carga › Fuentes con «Bases separadas» (propuesta F aprobada por Gonzalo, 2026-10-11): la lista de bases del estudio,
// sin número fijo. Cada base es una tarjeta con su actor, de dónde viene y cuántas respuestas trae; «Agregar base» está
// siempre a mano y pregunta de dónde sale (formulario publicado —ADR 0102—, SurveyMonkey, Kobo, archivos o Monitoreo). Responde a «¿qué pasa si
// quiero agregar una base o si tenía pensado 3 y luego eran 4?».

import { useEffect, useRef, useState, type ReactNode } from "react";
import { apiEstudioGet, apiEstudioRemoveBase, apiEstudioRenameBase, type EstudioBase, type EstudioPayload } from "../../../api/estudio";
import type { VistaPreviaFuente } from "../../../api/xlsformEditor";
import { PulsoButton } from "../../../components/PulsoButton";
import { ClipboardCheck, CloudDownload, Columns3, Database, FileCheck2, FileUp, GitCompareArrows, GitMerge, ListChecks, Pencil, Plus, Trash2, Upload, X } from "../../../vendor/lucide-react";
import { formatoConteo, formatoConteoDe } from "../../../lib/formatoNumero";
import { ordenarBasesPorSerie } from "../equivalenciasEditorModel";
import { useOrdenDeSerie } from "./useOrdenDeSerie";
import { AvisoFormularioPublicado } from "./AvisoFormularioPublicado";
import { rotuloBaseDeclarada, vinculoFormularioDeBase, type VinculoFormulario } from "./formularioPublicadoModel";
import { NuevaBaseFormularioPublicado } from "./NuevaBaseFormularioPublicado";
import { useFormulariosPublicados } from "./useFormulariosPublicados";
import { AbrirPanelFuentes } from "./AbrirPanelFuentes";
import { NuevaVersionRespuestas } from "./NuevaVersionRespuestas";
import { ArmonizacionBasePanel } from "./ArmonizacionBasePanel";
import { CompararFuentesPanel } from "./CompararFuentesPanel";
import { VariablesBasePanel } from "../variablesBase/VariablesBasePanel";
import { searchConVariablesBase } from "../variablesBase/variablesBaseModel";
import { comparablesCon, hayFuentesComparables, primerParComparable, searchConArmonizacionBase, searchConComparacion } from "./compararFuentesModel";
import "./basesDelEstudio.css";

export type OrigenNuevaBase = "formulario" | "surveymonkey" | "kobo" | "archivos" | "sav" | "monitoreo";
/** Los orígenes que resuelve la página; «formulario» (ADR 0102) lo resuelve esta sección. */
export type OrigenDePagina = Exclude<OrigenNuevaBase, "formulario">;

// B2: la base .sav sin formulario es un origen más de «Agregar base», no un
// panel aparte que compita con él.
// ADR 0102: «Formulario publicado» va primero y sólo aparece si hay alguno.
const ORIGENES: { id: OrigenNuevaBase; rotulo: string; ayuda: string; icono: ReactNode }[] = [
  { id: "formulario", rotulo: "Formulario publicado", ayuda: "Usa un formulario de Formularios", icono: <FileCheck2 size={16} aria-hidden="true" /> },
  { id: "surveymonkey", rotulo: "SurveyMonkey", ayuda: "Una encuesta de tu cuenta", icono: <CloudDownload size={16} aria-hidden="true" /> },
  { id: "kobo", rotulo: "KoboToolbox", ayuda: "Un proyecto de Kobo", icono: <CloudDownload size={16} aria-hidden="true" /> },
  { id: "archivos", rotulo: "Archivos", ayuda: "Formulario y respuestas en Excel", icono: <Upload size={16} aria-hidden="true" /> },
  { id: "sav", rotulo: "Archivo .sav", ayuda: "Sin formulario, sólo el .sav", icono: <FileUp size={16} aria-hidden="true" /> },
  { id: "monitoreo", rotulo: "Monitoreo", ayuda: "Lo que ya sigue el proyecto en campo", icono: <ClipboardCheck size={16} aria-hidden="true" /> },
];

/** De dónde viene una base, en palabras: «SurveyMonkey», «Kobo», «Archivos». */
export function origenDeBase(b: Pick<EstudioBase, "source_kind">): string {
  const k = String(b.source_kind ?? "manual");
  if (k === "surveymonkey" || k === "formulario_publicado_surveymonkey") return "SurveyMonkey";
  if (k === "formulario_publicado_sav") return "Archivo .sav";
  if (k === "formulario_publicado_excel") return "Excel";
  if (k.startsWith("kobo")) return "KoboToolbox";
  return "Archivos";
}

/** Las bases que se muestran como tarjeta: las hijas de un grupo repetido viven dentro de su madre. */
export function basesVisibles(estudio: Pick<EstudioPayload, "bases">): EstudioBase[] {
  return Object.values(estudio.bases ?? {}).filter((b) => !b.parent_base);
}

/**
 * Las tarjetas siguen el orden de la serie declarado en Equivalencias (M6); las
 * bases que la serie no nombra van después, en su orden de alta. Sin serie, el
 * orden de alta.
 */
export function ordenarBasesDelEstudio(bases: readonly EstudioBase[], periodos: readonly string[]): EstudioBase[] {
  const porNombre = new Map(bases.map((b) => [b.nombre, b] as const));
  return ordenarBasesPorSerie(bases.map((b) => b.nombre), periodos)
    .map((nombre) => porNombre.get(nombre))
    .filter((b): b is EstudioBase => Boolean(b));
}

function TarjetaBase({ base, vinculo, comparables, ocupado, onRenombrar, onQuitar, onOtraFuente, onCambio }: {
  base: EstudioBase;
  vinculo: VinculoFormulario | null;
  /** Otras bases ligadas a la misma revisión: habilitan «Comparar con…». */
  comparables: readonly string[];
  ocupado: boolean;
  onOtraFuente?: () => void;
  onRenombrar: (nuevo: string) => Promise<void>;
  onQuitar: () => Promise<void>;
  /** Sólo las bases que vienen de archivos reciben una versión nueva de sus respuestas desde aquí. */
  onCambio?: (payload: EstudioPayload) => Promise<void> | void;
}) {
  const [editando, setEditando] = useState(false);
  const [borrador, setBorrador] = useState(base.nombre);
  const [confirmando, setConfirmando] = useState(false);
  const titulo = base.source_title || base.source_alias || base.data_file_name || "";
  return (
    <article className="pulso-bde-tarjeta" data-qa-geometry-member>
      <header className="pulso-bde-cabecera">
        <span className="pulso-bde-marca" aria-hidden="true"><Database size={16} /></span>
        {editando ? (
          <form
            className="pulso-bde-renombrar"
            onSubmit={(e) => { e.preventDefault(); if (borrador.trim() && borrador.trim() !== base.nombre) void onRenombrar(borrador.trim()).then(() => setEditando(false)); else setEditando(false); }}
          >
            <input value={borrador} onChange={(e) => setBorrador(e.target.value)} aria-label={`Nuevo nombre de la base ${base.nombre}`} autoFocus />
            <PulsoButton type="submit" variant="secondary" size="sm" disabled={ocupado}>Guardar</PulsoButton>
            <PulsoButton type="button" variant="ghost" size="sm" onClick={() => { setBorrador(base.nombre); setEditando(false); }}>Cancelar</PulsoButton>
          </form>
        ) : (
          <h4 className="pulso-bde-nombre">{base.nombre}</h4>
        )}
        <span className="pulso-bde-origen">{origenDeBase(base)}</span>
      </header>
      {(base.surveymonkey_sources?.length ?? 0) > 1 ? (
        <ul className="pulso-bde-fuentes" aria-label="Fuentes de esta base">
          {base.surveymonkey_sources!.map((f, i) => (
            <li key={`${f.survey_id ?? ""}:${f.channel ?? ""}:${i}`}>{f.source_title || f.survey_id}{f.channel ? <span className="pulso-bde-canal">{f.channel}</span> : null}</li>
          ))}
        </ul>
      ) : titulo ? <p className="pulso-bde-fuente">{titulo}{base.source_channel ? <span className="pulso-bde-canal">{base.source_channel}</span> : null}</p> : null}
      {vinculo ? (
        <p className="pulso-bfp-vinculo">
          <FileCheck2 size={13} aria-hidden="true" />
          <span>Formulario: <strong>{vinculo.formulario}</strong> · {vinculo.revision}</span>
          {vinculo.logicaExterna ? <span className="pulso-bfp-declarada">{rotuloBaseDeclarada(vinculo)}</span> : null}
          <span className="pulso-bfp-vinculo-acciones">
            <AbrirPanelFuentes
              variant="ghost"
              clave={`armonizacion:${base.nombre}`}
              destino={(search) => searchConArmonizacionBase(search, base.nombre)}
              etiqueta={`Ver armonización de ${base.nombre}`}
            >
              <ListChecks size={13} aria-hidden="true" />Ver armonización
            </AbrirPanelFuentes>
            {comparables.length ? (
              <AbrirPanelFuentes
                variant="ghost"
                clave={`comparar:${base.nombre}`}
                destino={(search) => searchConComparacion(search, { a: base.nombre, b: comparables[0] })}
                etiqueta={`Comparar ${base.nombre} con ${comparables.length === 1 ? comparables[0] : "otra fuente del mismo formulario"}`}
              >
                <GitCompareArrows size={13} aria-hidden="true" />{comparables.length === 1 ? `Comparar con ${comparables[0]}` : "Comparar con…"}
              </AbrirPanelFuentes>
            ) : null}
          </span>
        </p>
      ) : null}
      <dl className="pulso-bde-cifras">
        <div><dt>Respuestas</dt><dd>{formatoConteo(base.n_filas)}</dd></div>
        <div><dt>Columnas</dt><dd>{formatoConteo(base.n_columnas)}</dd></div>
      </dl>
      {confirmando ? (
        <div className="pulso-bde-confirmar" role="alert">
          <span>¿Quitar «{base.nombre}» del estudio? Sus respuestas dejan de estar en el proyecto.</span>
          <PulsoButton variant="danger" size="sm" disabled={ocupado} onClick={() => void onQuitar().finally(() => setConfirmando(false))}>Quitar</PulsoButton>
          <PulsoButton variant="ghost" size="sm" onClick={() => setConfirmando(false)}>Cancelar</PulsoButton>
        </div>
      ) : (
        <div className="pulso-bde-acciones">
          {onOtraFuente ? (
            <PulsoButton variant="secondary" size="sm" disabled={ocupado} onClick={onOtraFuente}><GitMerge size={13} aria-hidden="true" />Agregar otra fuente</PulsoButton>
          ) : null}
          {/* ADR 0106: columnas propias, calculadas y la marca «ya viene codificada». */}
          <AbrirPanelFuentes
            variant="secondary"
            clave={`variables-base:${base.nombre}`}
            destino={(search) => searchConVariablesBase(search, base.nombre)}
            etiqueta={`Variables de la base ${base.nombre}`}
          >
            <Columns3 size={13} aria-hidden="true" />Variables
          </AbrirPanelFuentes>
          {/* ADR 0100 D1: lo decidido fuera se cambia allá y la base recibe su archivo nuevo. */}
          {onCambio ? <NuevaVersionRespuestas base={base.nombre} ocupado={ocupado} onCambio={onCambio} /> : null}
          {/* M2: acciones secundarias con el mismo PulsoButton secundario de Carga. */}
          <PulsoButton variant="secondary" size="sm" disabled={ocupado} onClick={() => setEditando(true)}><Pencil size={13} aria-hidden="true" />Renombrar</PulsoButton>
          <PulsoButton variant="secondary" size="sm" disabled={ocupado} onClick={() => setConfirmando(true)}><Trash2 size={13} aria-hidden="true" />Quitar</PulsoButton>
        </div>
      )}
    </article>
  );
}

export function BasesDelEstudio({
  estudio,
  onCambio,
  onOrigen,
  renderOrigen,
  onDestinoFuente,
  renderCatalogo,
  vistaPreviaFuente = null,
  onConfirmarFuente,
  onDescartarVistaPrevia,
  ocupado: ocupadoPagina = false,
}: {
  estudio: EstudioPayload;
  onCambio: (payload: EstudioPayload) => Promise<void> | void;
  /** Avisa el origen elegido para que la página prepare lo suyo (proveedor del catálogo, modo de carga). */
  onOrigen?: (origen: OrigenNuevaBase) => void;
  /** Lo que se muestra para traer la base nueva desde el origen elegido (catálogo, carriles de archivos, Monitoreo). */
  renderOrigen: (origen: OrigenDePagina) => ReactNode;
  /** «Agregar otra fuente a esta base»: la página dirige el próximo import del catálogo a esa base con ese canal. */
  onDestinoFuente?: (destino: { base: string; canal: string } | null) => void;
  renderCatalogo?: () => ReactNode;
  /** Lo que pasaría al unir la encuesta elegida; se une al confirmar. */
  vistaPreviaFuente?: VistaPreviaFuente | null;
  onConfirmarFuente?: () => void;
  onDescartarVistaPrevia?: () => void;
  ocupado?: boolean;
}) {
  const altas = basesVisibles(estudio);
  const periodos = useOrdenDeSerie(altas.map((b) => b.nombre).join("|"));
  const bases = ordenarBasesDelEstudio(altas, periodos);
  const enSerie = periodos.some((p) => altas.some((b) => b.nombre === p));
  const publicados = useFormulariosPublicados();
  const hayPublicados = publicados.formularios.length > 0;
  const origenPorDefecto: OrigenNuevaBase = hayPublicados ? "formulario" : "surveymonkey";
  const origenes = hayPublicados ? ORIGENES : ORIGENES.filter((o) => o.id !== "formulario");
  const [agregando, setAgregandoEstado] = useState<OrigenNuevaBase | null>(bases.length ? null : "surveymonkey");
  const eligioOrigen = useRef(false);
  const setAgregando = (o: OrigenNuevaBase | null) => { eligioOrigen.current = true; setAgregandoEstado(o); if (o) onOrigen?.(o); };
  // Sin bases, «Agregar base» se abre solo; cuando llega el catálogo, el
  // formulario publicado pasa a ser la opción propuesta si nadie eligió otra.
  useEffect(() => {
    if (hayPublicados && !eligioOrigen.current) setAgregandoEstado((actual) => (actual === "surveymonkey" ? "formulario" : actual));
  }, [hayPublicados]);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");
  const correr = async (accion: () => Promise<EstudioPayload>) => {
    setOcupado(true);
    setError("");
    try { await onCambio(await accion()); } catch (e) { setError(e instanceof Error ? e.message : "No se pudo completar."); } finally { setOcupado(false); }
  };
  const parInicial = primerParComparable(bases);
  const total = bases.reduce((s, b) => s + (b.n_filas ?? 0), 0);
  const [otraFuente, setOtraFuenteEstado] = useState<{ base: string; canal: string } | null>(null);
  const setOtraFuente = (d: { base: string; canal: string } | null) => {
    setOtraFuenteEstado(d);
    onDestinoFuente?.(d);
    if (d) setAgregandoEstado(null);
  };

  return (
    <section className="pulso-bde" aria-labelledby="pulso-bde-titulo">
      <header className="pulso-bde-encabezado">
        <div>
          <h3 id="pulso-bde-titulo">Bases del estudio</h3>
          <p>{bases.length
            ? `${formatoConteoDe(bases.length, "base")}, ${formatoConteoDe(total, "respuesta")} en total${enSerie ? ", en el orden de la serie de Equivalencias" : ""}. Agrega las que falten cuando quieras.`
            : "Agrega la primera base: una por actor (estudiantes, docentes…)."}</p>
        </div>
        <div className="pulso-bde-encabezado-acciones">
          {/* ADR 0102: dos bases de la misma revisión se pueden comparar fuente contra fuente. */}
          {hayFuentesComparables(bases) ? (
            <AbrirPanelFuentes variant="secondary" clave="comparar" destino={(search) => searchConComparacion(search, parInicial)}>
              <GitCompareArrows size={14} aria-hidden="true" />Comparar fuentes
            </AbrirPanelFuentes>
          ) : null}
          {agregando ? null : (
            <PulsoButton variant="primary" size="sm" onClick={() => { setOtraFuente(null); setAgregando(origenPorDefecto); }}><Plus size={14} aria-hidden="true" />Agregar base</PulsoButton>
          )}
        </div>
      </header>
      {error ? <p className="pulso-bde-error" role="alert">{error}</p> : null}
      {bases.length ? (
        <div className="pulso-bde-grilla" data-qa-geometry-group="carga/bases-del-estudio" data-qa-geometry-contract="intrinsic">
          {bases.map((b) => (
            <TarjetaBase
              key={b.nombre}
              base={b}
              vinculo={vinculoFormularioDeBase(b, publicados.formularios)}
              comparables={comparablesCon(b.nombre, bases)}
              ocupado={ocupado}
              onRenombrar={(nuevo) => correr(() => apiEstudioRenameBase(b.nombre, nuevo))}
              onQuitar={() => correr(async () => { await apiEstudioRemoveBase(b.nombre); return apiEstudioGet(); })}
              // Kobo y SurveyMonkey se actualizan desde su plataforma.
              onCambio={origenDeBase(b) === "Archivos" || origenDeBase(b) === "Excel" ? onCambio : undefined}
              // Sólo la vía SurveyMonkey clásica: una base nacida de un formulario
              // publicado suma sus campañas desde el formulario (ADR 0102), y
              // «Agregar fuente» regeneraría el XLSForm rompiendo el enlace.
              onOtraFuente={renderCatalogo && b.source_kind === "surveymonkey" ? () => setOtraFuente({ base: b.nombre, canal: "" }) : undefined}
            />
          ))}
        </div>
      ) : null}
      {otraFuente && renderCatalogo ? (
        <div className="pulso-bde-agregar">
          <div className="pulso-bde-agregar-cabecera">
            <strong>Agregar otra fuente a «{otraFuente.base}»</strong>
            <span>El mismo actor por otra vía, por ejemplo una encuesta enviada por correo además de la del QR en aula. Las respuestas se unen en esta base y cada una conserva su vía. Si las encuestas no tienen las mismas preguntas, te mostramos qué difiere y la base no cambia.</span>
            <button type="button" className="pulso-bde-cerrar" aria-label="Cerrar" onClick={() => setOtraFuente(null)}><X size={16} aria-hidden="true" /></button>
          </div>
          <label className="pulso-bde-nueva-nombre">
            <span>¿Por qué vía llegó esta encuesta?</span>
            <input value={otraFuente.canal} onChange={(e) => setOtraFuente({ ...otraFuente, canal: e.target.value })} placeholder="Por ejemplo, correo" />
            <small>Así se distingue en la base de dónde vino cada respuesta.</small>
          </label>
          {vistaPreviaFuente ? (
            <div className="pulso-bde-previa" role="status">
              <strong>«{vistaPreviaFuente.titulo}» y «{vistaPreviaFuente.base_name}»</strong>
              <p>Calzan {vistaPreviaFuente.n_emparejadas} de las {vistaPreviaFuente.n_preguntas_base} preguntas de la base.</p>
              {vistaPreviaFuente.extra.length ? (
                <div>
                  <span className="pulso-bde-previa-rotulo">Trae de más (se suman a la base; quedan vacías en las respuestas anteriores)</span>
                  <ul>{vistaPreviaFuente.extra.map((x) => <li key={x.variable}>{x.etiqueta || x.variable}</li>)}</ul>
                </div>
              ) : null}
              {vistaPreviaFuente.faltan.length ? (
                <div>
                  <span className="pulso-bde-previa-rotulo">No las pregunta (quedan vacías en sus respuestas)</span>
                  <ul>{vistaPreviaFuente.faltan.map((x) => <li key={x.variable}>{x.etiqueta || x.variable}</li>)}</ul>
                </div>
              ) : null}
              <div className="pulso-bde-acciones">
                <PulsoButton variant="primary" size="sm" disabled={ocupadoPagina} onClick={onConfirmarFuente}><GitMerge size={14} aria-hidden="true" />Unir a «{vistaPreviaFuente.base_name}»</PulsoButton>
                <PulsoButton variant="ghost" size="sm" onClick={onDescartarVistaPrevia}>Elegir otra encuesta</PulsoButton>
              </div>
            </div>
          ) : (
            <div className="pulso-bde-agregar-cuerpo">{renderCatalogo()}</div>
          )}
        </div>
      ) : null}
      {agregando ? (
        <div className="pulso-bde-agregar">
          <div className="pulso-bde-agregar-cabecera">
            <strong>Agregar base</strong>
            <span>¿De dónde salen el formulario y las respuestas?</span>
            {bases.length ? (
              <button type="button" className="pulso-bde-cerrar" aria-label="Cerrar" onClick={() => setAgregando(null)}><X size={16} aria-hidden="true" /></button>
            ) : null}
          </div>
          <div className="pulso-bde-origenes" role="radiogroup" aria-label="Origen de la base nueva">
            {origenes.map((o) => (
              <button key={o.id} type="button" role="radio" aria-checked={agregando === o.id} className={agregando === o.id ? "pulso-bde-origen-opcion is-activa" : "pulso-bde-origen-opcion"} onClick={() => setAgregando(o.id)}>
                {o.icono}
                <span><strong>{o.rotulo}</strong><small>{o.ayuda}</small></span>
              </button>
            ))}
          </div>
          <div className="pulso-bde-agregar-cuerpo">
            {agregando === "formulario" ? (
              <NuevaBaseFormularioPublicado
                estudio={estudio}
                formularios={publicados.formularios}
                onCreada={async () => { await onCambio(await apiEstudioGet()); setAgregando(null); }}
              />
            ) : (
              <>
                {agregando === "archivos" ? (
                  <AvisoFormularioPublicado cuantos={publicados.formularios.length} onUsar={() => setAgregando("formulario")} />
                ) : null}
                {renderOrigen(agregando)}
              </>
            )}
          </div>
        </div>
      ) : null}
      <ArmonizacionBasePanel />
      <CompararFuentesPanel bases={bases} />
      <VariablesBasePanel />
    </section>
  );
}
