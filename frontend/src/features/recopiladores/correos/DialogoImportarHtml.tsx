// Importar un correo existente (addendum E1l §5): `?panel=correo-importar`,
// clase «dialogo».
//
// Un archivo .html o el código pegado (hasta 512 KB) se lee como bloques del
// registro: se muestra la plataforma detectada, cuántos bloques salieron, el
// informe de lo que se descartó o no se reconoció (cada ítem con «Ver» si dice
// en qué bloque quedó) y la vista previa de lo importado. Después, «Crear
// campaña» o «Reemplazar la plantilla de esta campaña» (entra al historial).
//
// Contrato de Superficie:
// - C1: `material-campo/catalogo/correos-importar`, contrato intrinsic; cada
//   ítem del informe es miembro.
// - C2/C4: alto tope de la ventana. En ancho y alto suficientes, informe y
//   vista previa son dos columnas, cada una dueña de su scroll; en compacto el
//   cuerpo del diálogo es el único dueño y la vista toma su alto natural.
// - C3/C5: sin ítems en el informe, el informe lo dice (nada se descartó).

import * as Dialog from "@radix-ui/react-dialog";
import { useId, useLayoutEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";

import { MAIL_IMPORT_HTML_MAX_BYTES, type MailCampaignSummary, type MailImportHtml, type MailImportReportItem, type MailPlatform, type MailTemplate } from "../../../api/materialMail";
import { PulsoButton } from "../../../components/PulsoButton";
import type { ControlPanel } from "../../../lib/navegacion/paneles";
import { AlertTriangle, Eye, FileCode2, FileUp, Loader2, Plus, RefreshCw, X } from "../../../vendor/lucide-react";
import { Segmented } from "../../xlsformEditor/kit";
import { NOMBRE_DE_PLATAFORMA } from "./dialectos";
import { LARGO_NOMBRE, problemaDelNombre } from "./modeloCampanas";
import { pesoLegible } from "./modeloCorreo";
import type { CampanaImportada, ResultadoDeCampana } from "./useCampanas";
import { bytesDelTexto, problemaDeLaFuente, useImportarHtml, type FuenteDelHtml } from "./useImportarHtml";
import { VistaPreviaDelCorreo, type MedidasDeLaHoja } from "./VistaPreviaDelCorreo";
import "./correosImportar.css";

/** Rótulos del informe; un código que esta versión no conoce se muestra con el motivo del backend. */
export const ROTULO_DEL_INFORME: Record<string, string> = {
  style_discarded: "Estilos descartados",
  hover_ignored: "Efecto al pasar el cursor",
  subject_missing: "Sin asunto",
  unrecognized: "No reconocido",
  element_discarded: "Elemento descartado",
  comments_discarded: "Comentarios descartados",
  hidden_discarded: "Texto oculto descartado",
  event_handler_discarded: "Código en atributos",
  unsafe_link_discarded: "Enlace inseguro",
  link_discarded: "Enlace descartado",
  platform_link_removed: "Enlace de la plataforma",
  platform_footer_removed: "Pie de la plataforma",
  platform_mixed: "Etiquetas de dos plataformas",
  moved_to_footer: "Movido al pie",
  conditional_flattened: "Condicional simplificado",
  email_tag_removed: "Correo quitado",
  italic_plain: "Cursiva",
  strike_plain: "Tachado",
  text_escaped: "Texto separado",
  text_degraded: "Texto simplificado",
  block_degraded: "Bloque simplificado",
  button_without_link: "Botón sin enlace",
  header_missing: "Sin cabecera",
  image_needs_upload: "Imagen sin URL pública",
  image_http: "Imagen sin https",
  image_alt_missing: "Imagen sin texto alternativo",
};

export function rotuloDelInforme(item: Pick<MailImportReportItem, "code">): string {
  return ROTULO_DEL_INFORME[item.code] ?? item.code;
}

/** Marca el bloque que el informe pidió ver, sobre la vista previa, y lo trae a la vista. */
function MarcaDeBloque({ doc, medida, escala, blockId }: MedidasDeLaHoja & { blockId: string | null }) {
  const marca = useRef<HTMLDivElement | null>(null);
  const [rect, setRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  useLayoutEffect(() => {
    const el = blockId && doc ? doc.querySelector(`[data-pulso-block="${CSS.escape(blockId)}"]`) : null;
    if (!el) {
      setRect(null);
      return;
    }
    const r = el.getBoundingClientRect();
    setRect({ x: r.left * escala, y: r.top * escala, w: r.width * escala, h: r.height * escala });
  }, [blockId, doc, escala, medida]);
  useLayoutEffect(() => {
    if (rect) marca.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [rect]);
  if (!rect) return null;
  return <div ref={marca} className="rec-imp-marca" style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }} aria-hidden />;
}

/** Resumen e informe de lo importado; cada ítem con «Ver» si dice en qué bloque quedó. */
export function InformeDeImportacion({ resultado, visto, sinUrl, onVer }: {
  resultado: MailImportHtml;
  visto: string | null;
  sinUrl: number;
  onVer: (blockId: string) => void;
}) {
  const ids = useId();
  return (
    <section className="rec-imp-informe" aria-labelledby={`${ids}-informe`} data-qa-geometry-capacity="owned">
      <dl className="rec-imp-resumen">
        <div>
          <dt>Plataforma detectada</dt>
          <dd>
            {resultado.platform_detected ? <b>{NOMBRE_DE_PLATAFORMA[resultado.platform_detected]}</b> : <b>Ninguna</b>}
            <span className="rec-imp-evidencia">
              {resultado.platform_evidence.surveymonkey} de SurveyMonkey · {resultado.platform_evidence.mailchimp} de Mailchimp
            </span>
          </dd>
        </div>
        <div>
          <dt>Bloques</dt>
          <dd><b>{resultado.stats.blocks.toLocaleString("es-PE")}</b>{resultado.stats.dropped_empty ? <span className="rec-imp-evidencia">{resultado.stats.dropped_empty} vacíos descartados</span> : null}</dd>
        </div>
        <div>
          <dt>Imágenes</dt>
          <dd>
            <b>{resultado.images.length}</b>
            {sinUrl ? <span className="rec-imp-evidencia is-aviso">{sinUrl} sin URL pública</span> : null}
          </dd>
        </div>
      </dl>
      <h3 id={`${ids}-informe`} className="rec-imp-titulo">Informe de la importación</h3>
      {resultado.report.length ? (
        <ul
          className="rec-imp-items"
          data-qa-geometry-group="material-campo/catalogo/correos-importar"
          data-qa-geometry-contract="intrinsic"
        >
          {resultado.report.map((item, i) => (
            <li key={`${item.code}-${i}`} className={`rec-imp-item${visto && item.block_id === visto ? " is-visto" : ""}`} data-qa-geometry-member>
              <span className="rec-imp-item-cabeza">
                <b>{rotuloDelInforme(item)}</b>
                {item.block_id ? (
                  <button
                    type="button"
                    className="rec-mail-link rec-imp-ver"
                    aria-label={`Ver el bloque de «${rotuloDelInforme(item)}» en la vista previa`}
                    onClick={() => onVer(item.block_id!)}
                  >
                    <Eye size={13} aria-hidden /> Ver
                  </button>
                ) : null}
              </span>
              {item.reason ? <span className="rec-imp-item-motivo">{item.reason}</span> : null}
              {item.excerpt ? <code className="rec-imp-item-extracto" title={item.selector ?? undefined}>{item.excerpt}</code> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="rec-mail-vacio">Nada se descartó: todo el correo quedó en bloques.</p>
      )}
    </section>
  );
}

/** Nombre y plataforma de la campaña nueva, y las dos salidas: crear o reemplazar. */
export function PieDeImportacion({
  nombre, plataforma, problemaNombre, error, activa, conCambios, trabajando, aplicando,
  onNombre, onPlataforma, onOtra, onReemplazar, onCrear,
}: {
  nombre: string;
  plataforma: MailPlatform;
  problemaNombre: string | null;
  error: string;
  activa: MailCampaignSummary | null;
  conCambios: boolean;
  trabajando: boolean;
  aplicando: boolean;
  onNombre: (nombre: string) => void;
  onPlataforma: (p: MailPlatform) => void;
  onOtra: () => void;
  onReemplazar: () => void;
  onCrear: () => void;
}) {
  const ids = useId();
  return (
    <footer className="rec-imp-pie">
      <span className="rec-imp-pie-campos">
        <label className="rec-camp-campo">
          <span>Nombre de la campaña</span>
          <input
            value={nombre}
            maxLength={LARGO_NOMBRE}
            aria-invalid={problemaNombre ? true : undefined}
            onChange={(e) => onNombre(e.target.value)}
          />
        </label>
        <fieldset className="rec-imp-plataforma">
          <legend>Sale por</legend>
          {(["mailchimp", "surveymonkey"] as const).map((p) => (
            <label key={p} className={`rec-imp-plataforma-op${plataforma === p ? " is-on" : ""}`}>
              <input
                type="radio"
                name={`${ids}-plataforma`}
                value={p}
                checked={plataforma === p}
                onChange={() => onPlataforma(p)}
              />
              {NOMBRE_DE_PLATAFORMA[p]}
            </label>
          ))}
        </fieldset>
      </span>
      {problemaNombre ? <p className="rec-camp-nueva-problema" role="alert">{problemaNombre}</p> : null}
      {error ? <p className="rec-camp-mensaje is-error" role="alert">{error}</p> : null}
      {activa && conCambios ? (
        <p className="rec-camp-nueva-nota">«{activa.name}» tiene cambios sin guardar: reemplazar su plantilla los deja en el historial (⌘Z).</p>
      ) : null}
      {activa && activa.platform !== plataforma ? (
        <p className="rec-camp-nueva-nota">
          Reemplazar no cambia la plataforma: «{activa.name}» sigue saliendo por {NOMBRE_DE_PLATAFORMA[activa.platform]}.
        </p>
      ) : null}
      <span className="rec-imp-acciones">
        <PulsoButton variant="ghost" size="sm" disabled={trabajando} onClick={onOtra}>
          <RefreshCw size={14} aria-hidden /> Leer otro
        </PulsoButton>
        {activa ? (
          <PulsoButton variant="secondary" size="sm" disabled={trabajando} onClick={onReemplazar}>
            Reemplazar la plantilla de esta campaña
          </PulsoButton>
        ) : null}
        <PulsoButton variant="primary" size="sm" disabled={trabajando || Boolean(problemaNombre)} onClick={onCrear}>
          {aplicando ? <Loader2 size={14} className="pulso-spin" aria-hidden /> : <Plus size={14} aria-hidden />}
          Crear campaña
        </PulsoButton>
      </span>
    </footer>
  );
}

type Props = {
  panel: ControlPanel;
  /** La campaña abierta, si hay: habilita «Reemplazar la plantilla». */
  activa: MailCampaignSummary | null;
  campanas: readonly MailCampaignSummary[];
  plataformaPorDefecto: MailPlatform;
  /** La campaña abierta tiene cambios sin guardar. */
  conCambios: boolean;
  ocupado: boolean;
  onCrear: (input: CampanaImportada) => Promise<ResultadoDeCampana>;
  onReemplazar: (template: MailTemplate, importId: string) => void;
  /** Tras crear: abre la campaña nueva (y cierra el diálogo). */
  onAbrir: (campaignId: string, aviso: string | undefined, importada: MailTemplate) => void;
};

const FUENTES: { value: FuenteDelHtml; label: string }[] = [
  { value: "archivo", label: "Archivo .html" },
  { value: "pegar", label: "Pegar el código" },
];

export function DialogoImportarHtml({ panel, activa, campanas, plataformaPorDefecto, conCambios, ocupado, onCrear, onReemplazar, onAbrir }: Props) {
  const ids = useId();
  const { abierto, cerrar } = panel;
  const { estado, despachar, leer } = useImportarHtml({
    abierto,
    plataforma: plataformaPorDefecto,
    campanaDeVista: (p) => (activa?.platform === p ? activa.campaign_id : campanas.find((c) => c.platform === p)?.campaign_id ?? null),
  });
  const r = estado.resultado;
  const trabajando = estado.fase === "leyendo" || estado.fase === "aplicando" || ocupado;
  const problemaFuente = problemaDeLaFuente(estado);
  const problemaNombre = r ? problemaDelNombre(estado.nombre) : null;
  const sinUrl = r ? r.images.filter((i) => i.status === "needs_upload") : [];

  const alElegirArchivo = (event: ChangeEvent<HTMLInputElement>) => {
    despachar({ type: "archivo", archivo: event.target.files?.[0] ?? null });
  };

  const alLeer = (event: FormEvent) => {
    event.preventDefault();
    void leer();
  };

  const crear = async () => {
    if (!r || problemaNombre) return;
    despachar({ type: "aplicando" });
    const out = await onCrear({ name: estado.nombre, actor: "", platform: estado.plataforma, template: r.template, import_id: r.import_id });
    if (!out.ok) {
      despachar({ type: "aplicado-fallo", error: out.mensaje });
      return;
    }
    onAbrir(out.campaignId, out.aviso, out.campana?.template ?? r.template);
  };

  const reemplazar = () => {
    if (!r) return;
    onReemplazar(r.template, r.import_id);
    cerrar();
  };

  return (
    <Dialog.Root open={abierto} onOpenChange={(siguiente) => { if (!siguiente && !trabajando) cerrar(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="rec-camp-velo" />
        <Dialog.Content
          className={`rec-imp${r ? " is-leido" : ""}`}
          {...panel.props}
          // Montado con la lista leída: está listo; leer un HTML se anuncia con aria-busy.
          data-audit-ready="true"
          aria-busy={trabajando}
          aria-describedby={`${ids}-desc`}
        >
          <header className="rec-imp-cabeza">
            <span>
              <Dialog.Title className="rec-camp-dialogo-titulo">Importar un correo existente</Dialog.Title>
              <Dialog.Description id={`${ids}-desc`} className="rec-camp-dialogo-desc">
                El HTML se lee como bloques editables. Los estilos los pone la plantilla; el informe dice qué no se trajo.
              </Dialog.Description>
            </span>
            <Dialog.Close asChild>
              <PulsoButton variant="icon" size="sm" aria-label="Cerrar" disabled={trabajando}>
                <X size={16} aria-hidden />
              </PulsoButton>
            </Dialog.Close>
          </header>

          {!r ? (
            <form className="rec-imp-fuente" onSubmit={alLeer} data-qa-geometry-capacity="owned">
              <Segmented aria-label="De dónde sale el HTML" value={estado.fuente} options={FUENTES} onChange={(fuente) => despachar({ type: "fuente", fuente })} />
              {estado.fuente === "archivo" ? (
                <label className="rec-imp-archivo">
                  <input type="file" accept=".html,.htm,text/html" className="pulso-sr-only" onChange={alElegirArchivo} disabled={trabajando} />
                  <span className="rec-imp-archivo-caja">
                    <FileUp size={20} aria-hidden />
                    {estado.archivo ? (
                      <span><b>{estado.archivo.name}</b> · {pesoLegible(estado.archivo.size)}</span>
                    ) : (
                      <span><b>Elegir un archivo .html</b> · hasta 512 KB</span>
                    )}
                  </span>
                </label>
              ) : (
                <label className="rec-imp-pegar">
                  <span className="rec-mail-campo-rotulo">
                    <span>Código HTML</span>
                    <span className={`rec-mail-contador${bytesDelTexto(estado.texto) > MAIL_IMPORT_HTML_MAX_BYTES ? " is-excedido" : ""}`}>
                      {pesoLegible(bytesDelTexto(estado.texto))} / 512 KB
                    </span>
                  </span>
                  <textarea
                    className="rec-mail-input is-mono"
                    rows={10}
                    spellCheck={false}
                    value={estado.texto}
                    placeholder="<!DOCTYPE html>…"
                    onChange={(e) => despachar({ type: "texto", texto: e.target.value })}
                  />
                </label>
              )}
              <label className="rec-imp-asunto">
                <span className="rec-mail-campo-rotulo"><span>Asunto (opcional)</span></span>
                <input
                  className="rec-mail-input"
                  value={estado.asunto}
                  maxLength={160}
                  placeholder="El HTML no trae el asunto: escríbelo aquí o después"
                  onChange={(e) => despachar({ type: "asunto", asunto: e.target.value })}
                />
              </label>
              {estado.error ? <p className="rec-camp-mensaje is-error" role="alert">{estado.error}</p> : null}
              <span className="rec-imp-acciones">
                <PulsoButton variant="primary" size="sm" type="submit" disabled={trabajando || Boolean(problemaFuente)} title={problemaFuente ?? undefined}>
                  {estado.fase === "leyendo" ? <Loader2 size={14} className="pulso-spin" aria-hidden /> : <FileCode2 size={14} aria-hidden />}
                  Leer el correo
                </PulsoButton>
              </span>
            </form>
          ) : (
            <>
              <div className="rec-imp-cuerpo" data-qa-geometry-capacity="owned">
                <InformeDeImportacion resultado={r} visto={estado.visto} sinUrl={sinUrl.length} onVer={(blockId) => despachar({ type: "ver", blockId })} />
                <section className="rec-imp-vista" aria-label="Vista previa de lo importado">
                  {estado.vistaError ? (
                    <p className="rec-mail-lienzo-aviso" role="status"><AlertTriangle size={14} aria-hidden /> {estado.vistaError}</p>
                  ) : null}
                  <VistaPreviaDelCorreo
                    html={estado.vista}
                    template={r.template}
                    vista="escritorio"
                    cargando={!estado.vista && !estado.vistaError}
                    error=""
                    capa={(m) => <MarcaDeBloque {...m} blockId={estado.visto} />}
                  />
                </section>
              </div>
              <PieDeImportacion
                nombre={estado.nombre}
                plataforma={estado.plataforma}
                problemaNombre={problemaNombre}
                error={estado.error}
                activa={activa}
                conCambios={conCambios}
                trabajando={trabajando}
                aplicando={estado.fase === "aplicando"}
                onNombre={(nombre) => despachar({ type: "nombre", nombre })}
                onPlataforma={(plataforma) => despachar({ type: "plataforma", plataforma })}
                onOtra={() => despachar({ type: "otra" })}
                onReemplazar={reemplazar}
                onCrear={() => { void crear(); }}
              />
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
