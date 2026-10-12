// Carga › Fuentes con «Bases separadas» (propuesta F aprobada por Gonzalo, 2026-10-11): la lista de bases del estudio,
// sin número fijo. Cada base es una tarjeta con su actor, de dónde viene y cuántas respuestas trae; «Agregar base» está
// siempre a mano y pregunta de dónde sale (SurveyMonkey, Kobo, archivos o Monitoreo). Responde a «¿qué pasa si
// quiero agregar una base o si tenía pensado 3 y luego eran 4?».

import { useState, type ReactNode } from "react";
import { apiEstudioGet, apiEstudioRemoveBase, apiEstudioRenameBase, type EstudioBase, type EstudioPayload } from "../../../api/estudio";
import { PulsoButton } from "../../../components/PulsoButton";
import { ClipboardCheck, CloudDownload, Database, GitMerge, Pencil, Plus, Trash2, Upload, X } from "../../../vendor/lucide-react";
import "./basesDelEstudio.css";

export type OrigenNuevaBase = "surveymonkey" | "kobo" | "archivos" | "monitoreo";

const ORIGENES: { id: OrigenNuevaBase; rotulo: string; ayuda: string; icono: ReactNode }[] = [
  { id: "surveymonkey", rotulo: "SurveyMonkey", ayuda: "Una encuesta de tu cuenta", icono: <CloudDownload size={16} aria-hidden="true" /> },
  { id: "kobo", rotulo: "KoboToolbox", ayuda: "Un proyecto de Kobo", icono: <CloudDownload size={16} aria-hidden="true" /> },
  { id: "archivos", rotulo: "Archivos", ayuda: "Formulario y respuestas en Excel", icono: <Upload size={16} aria-hidden="true" /> },
  { id: "monitoreo", rotulo: "Monitoreo", ayuda: "Lo que ya sigue el proyecto en campo", icono: <ClipboardCheck size={16} aria-hidden="true" /> },
];

/** De dónde viene una base, en palabras: «SurveyMonkey», «Kobo», «Archivos». */
export function origenDeBase(b: Pick<EstudioBase, "source_kind">): string {
  const k = String(b.source_kind ?? "manual");
  if (k === "surveymonkey") return "SurveyMonkey";
  if (k.startsWith("kobo")) return "KoboToolbox";
  return "Archivos";
}

/** Las bases que se muestran como tarjeta: las hijas de un grupo repetido viven dentro de su madre. */
export function basesVisibles(estudio: Pick<EstudioPayload, "bases">): EstudioBase[] {
  return Object.values(estudio.bases ?? {}).filter((b) => !b.parent_base);
}

function TarjetaBase({ base, ocupado, onRenombrar, onQuitar, onOtraFuente }: {
  base: EstudioBase;
  ocupado: boolean;
  onOtraFuente?: () => void;
  onRenombrar: (nuevo: string) => Promise<void>;
  onQuitar: () => Promise<void>;
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
      <dl className="pulso-bde-cifras">
        <div><dt>Respuestas</dt><dd>{base.n_filas ?? "—"}</dd></div>
        <div><dt>Columnas</dt><dd>{base.n_columnas ?? "—"}</dd></div>
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
            <PulsoButton variant="ghost" size="sm" disabled={ocupado} onClick={onOtraFuente}><GitMerge size={13} aria-hidden="true" />Agregar otra fuente</PulsoButton>
          ) : null}
          <PulsoButton variant="ghost" size="sm" disabled={ocupado} onClick={() => setEditando(true)}><Pencil size={13} aria-hidden="true" />Renombrar</PulsoButton>
          <PulsoButton variant="ghost" size="sm" disabled={ocupado} onClick={() => setConfirmando(true)}><Trash2 size={13} aria-hidden="true" />Quitar</PulsoButton>
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
}: {
  estudio: EstudioPayload;
  onCambio: (payload: EstudioPayload) => Promise<void> | void;
  /** Avisa el origen elegido para que la página prepare lo suyo (proveedor del catálogo, modo de carga). */
  onOrigen?: (origen: OrigenNuevaBase) => void;
  /** Lo que se muestra para traer la base nueva desde el origen elegido (catálogo, carriles de archivos, Monitoreo). */
  renderOrigen: (origen: OrigenNuevaBase) => ReactNode;
  /** «Agregar otra fuente a esta base»: la página dirige el próximo import del catálogo a esa base con ese canal. */
  onDestinoFuente?: (destino: { base: string; canal: string } | null) => void;
  renderCatalogo?: () => ReactNode;
}) {
  const bases = basesVisibles(estudio);
  const [agregando, setAgregandoEstado] = useState<OrigenNuevaBase | null>(bases.length ? null : "surveymonkey");
  const setAgregando = (o: OrigenNuevaBase | null) => { setAgregandoEstado(o); if (o) onOrigen?.(o); };
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");
  const correr = async (accion: () => Promise<EstudioPayload>) => {
    setOcupado(true);
    setError("");
    try { await onCambio(await accion()); } catch (e) { setError(e instanceof Error ? e.message : "No se pudo completar."); } finally { setOcupado(false); }
  };
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
          <p>{bases.length ? `${bases.length} ${bases.length === 1 ? "base" : "bases"}, ${total} respuestas en total. Agrega las que falten cuando quieras.` : "Agrega la primera base: una por actor (estudiantes, docentes…)."}</p>
        </div>
        {agregando ? null : (
          <PulsoButton variant="primary" size="sm" onClick={() => { setOtraFuente(null); setAgregando("surveymonkey"); }}><Plus size={14} aria-hidden="true" />Agregar base</PulsoButton>
        )}
      </header>
      {error ? <p className="pulso-bde-error" role="alert">{error}</p> : null}
      {bases.length ? (
        <div className="pulso-bde-grilla" data-qa-geometry-group="carga/bases-del-estudio" data-qa-geometry-contract="intrinsic">
          {bases.map((b) => (
            <TarjetaBase
              key={b.nombre}
              base={b}
              ocupado={ocupado}
              onRenombrar={(nuevo) => correr(() => apiEstudioRenameBase(b.nombre, nuevo))}
              onQuitar={() => correr(async () => { await apiEstudioRemoveBase(b.nombre); return apiEstudioGet(); })}
              onOtraFuente={renderCatalogo && origenDeBase(b) === "SurveyMonkey" ? () => setOtraFuente({ base: b.nombre, canal: "" }) : undefined}
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
          <div className="pulso-bde-agregar-cuerpo">{renderCatalogo()}</div>
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
            {ORIGENES.map((o) => (
              <button key={o.id} type="button" role="radio" aria-checked={agregando === o.id} className={agregando === o.id ? "pulso-bde-origen-opcion is-activa" : "pulso-bde-origen-opcion"} onClick={() => setAgregando(o.id)}>
                {o.icono}
                <span><strong>{o.rotulo}</strong><small>{o.ayuda}</small></span>
              </button>
            ))}
          </div>
          <div className="pulso-bde-agregar-cuerpo">{renderOrigen(agregando)}</div>
        </div>
      ) : null}
    </section>
  );
}
