import { useCallback, useEffect, useState } from "react";

import { downloadUrl } from "../../api/core";
import {
  apiRecopiladoresMaterialDrive,
  apiRecopiladoresMaterialInstances,
  apiRecopiladoresMaterialPrueba,
  apiRecopiladoresMaterialPruebas,
  apiRecopiladoresMaterialsRender,
  apiRecopiladoresMaterialTemplateGet,
  type CollectionArtifactReceipt,
  type CollectionDrivePublicacion,
  type CollectionFichaPrueba,
  type CollectionMaterialInstance,
  type CollectionMaterialRenderResult,
  type CollectionMaterialTemplate,
  type CollectionStatePayload,
} from "../../api/recopiladores";
import { FichaPruebaControl } from "./FichaPruebaControl";
import { FichasPruebaHistorico } from "./FichasPruebaHistorico";
import { JobProgress } from "../../components/JobProgress";
import { Panel } from "../../components/Panel";
import { PulsoButton } from "../../components/PulsoButton";
import {
  Archive,
  CheckCircle2,
  Download,
  UploadCloud,
  FileText,
  Image,
  Layers,
  Loader2,
} from "../../vendor/lucide-react";
import type { RecopiladoresPestana } from "./navegacion";
import { deploymentStatusLabel } from "./providerRules";
import { VacioSinPlanCard } from "./VacioSinPlanCard";
import { vacioSinPlan } from "./vacioSinPlan";
import "./styles/materials.css";
import "./driveDeFichas.css";
import { composicionDelPlan, unidadesDelPlan } from "./codigoOperativo";
import { fichasAlDia, fichasHechasDelEstado, instanciaReutilizable } from "./fichasDelEstado";

type Props = {
  payload: CollectionStatePayload | null;
  activeTab: RecopiladoresPestana;
  onStateRefresh: () => Promise<void>;
  onArtifact: (artifact: CollectionArtifactReceipt | null) => void;
  /** Avisa al shell mientras la plantilla no está: sin esto la página se
      declaraba lista con el panel aún en «Leyendo plantilla semántica…», y el QA
      visual medía el esqueleto. */
  onCargando?: (cargando: boolean) => void;
  /** Navega a una dirección de la app (la acción del vacío sin plan). */
  onIr?: (to: string) => void;
};

// Los rótulos de los 13 tipos y el vocabulario de bindings viven en
// `bloquesDeMaterial.ts`; se reexportan aquí por compatibilidad.
export { bindingLabel, materialFieldBinding, materialFieldCanvasLabel } from "./bloquesDeMaterial";

/**
 * Cuántas fichas hay hechas, de cuántas hacen falta.
 *
 * «Fichas 0» no dice de cuántas, y las que hay que hacer son las aulas que se
 * van a visitar. Es el mismo ancla que ya lleva el vacío de Accesos —«Ninguna
 * de las 193 aulas del plan tiene acceso todavía»— y aquí faltaba.
 *
 * Sin plan no se inventa un denominador: se dice la cuenta a secas, porque «0
 * de 0» promete una comparación que no se puede hacer.
 */
export function cuentaDeFichas(hechas: number, delPlan: number): string {
  const n = (v: number) => v.toLocaleString("es-PE");
  return delPlan > 0 ? `${n(hechas)} de ${n(delPlan)}` : n(hechas);
}

// Semilla vacía: sólo ocupa el estado hasta que resuelve el GET, y no se
// dibuja nunca (el componente corta en `loading`). El editor de la receta vive
// en `editor/EditorDeMaterial.tsx` (E1b); aquí sólo se lee su `template_id`.
//
// Aquí vivía una `DEFAULT_COLLECTION_TEMPLATE` completa que parecía la ficha de
// la casa y no lo era: el backend siempre responde una plantilla —cae a
// `collection_material_builtin_template()`—, así que su rama de fallback era
// inalcanzable y nadie la mantenía. Había derivado hasta tener otro
// `template_id`, otra revisión, campos sin etiqueta y ni separador ni registro
// de aplicación. Una segunda fuente de verdad que nadie consulta no se
// sincroniza: se borra, porque el día que alguien la lea va a creerle.
const TEMPLATE_PLACEHOLDER: CollectionMaterialTemplate = {
  schema: "collection_material_template/v1",
  template_id: "",
  revision: 1,
  preset_id: "ficha_aplicacion_a4_v1",
  material_kind: "application_sheet",
  compatible_adapters: [],
  page: { size: "A4", orientation: "portrait" },
  pages: [{ page_id: "ficha", layout_preset: "single_sheet", blocks: [] }],
  brand_ref: "pulso-default",
  sensitivity_policy: "operational",
};

function firstReceipt(result: CollectionMaterialRenderResult): CollectionArtifactReceipt | null {
  if (result.receipt?.schema === "collection_artifact_receipt/v1") return result.receipt;
  if (Array.isArray(result.manifest)) {
    return result.manifest.find((item) => item.schema === "collection_artifact_receipt/v1") ?? null;
  }
  return result.manifest?.schema === "collection_artifact_receipt/v1" ? result.manifest : null;
}

export function MaterialsSection({ payload, activeTab, onStateRefresh, onArtifact, onCargando, onIr }: Props) {
  const [template, setTemplate] = useState<CollectionMaterialTemplate>(TEMPLATE_PLACEHOLDER);
  const [loading, setLoading] = useState(true);
  const [instanceBusy, setInstanceBusy] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobFormat, setJobFormat] = useState<"png" | "pdf" | "bundle" | null>(null);
  const [codigoPrueba, setCodigoPrueba] = useState("");
  const [pruebas, setPruebas] = useState<CollectionFichaPrueba[]>([]);
  const [renderResult, setRenderResult] = useState<CollectionMaterialRenderResult | null>(null);
  const [driveBusy, setDriveBusy] = useState(false);
  const [drivePub, setDrivePub] = useState<CollectionDrivePublicacion | null>(null);
  const [driveError, setDriveError] = useState("");
  const [error, setError] = useState("");
  useEffect(() => { onCargando?.(loading); }, [loading, onCargando]);
  // Una receta nueva deja viejo el resultado: el panel no muestra el archivo
  // anterior como si reflejara la receta recién leída — mismo patrón que la
  // vista previa stale de Accesos (ece1b0dc).
  useEffect(() => { setRenderResult(null); }, [template]);
  const deployment = payload?.state.deployment ?? null;
  // Las aulas que se van a visitar: son las fichas que hay que llegar a tener.
  // El denominador es lo que el botón de al lado va a crear: `createInstances`
  // manda `plan.units.map(...)` entero. Contar titulares prometía 193 fichas y
  // creaba 2.616.
  const aulasDelPlan = unidadesDelPlan(payload?.state.plan);
  const composicion = composicionDelPlan(payload?.state.plan);
  // Por que estan apagados los tres botones de render. `null` cuando no lo
  // estan: asi el vacio y los `title` preguntan lo mismo en un solo sitio.
  const motivoBloqueo = deployment
    ? null
    : "Todavia no hay accesos preparados, asi que la ficha no tiene enlace que codificar.";
  // Del estado persistido: una instancia cubre muchas unidades y sobrevive a
  // la visita, así que contar las creadas en esta sesión daba «0 de 2,373».
  const fichasHechas = cuentaDeFichas(fichasHechasDelEstado(payload?.state), aulasDelPlan);
  // Con todas las unidades cubiertas, crear de nuevo sólo duplicaría la instancia.
  const alDia = fichasAlDia(payload?.state);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    void apiRecopiladoresMaterialTemplateGet()
      .then((result) => {
        if (!alive) return;
        // Sin plantilla no se inventa una: el editor guardaría sobre el estado
        // real una ficha que el motor nunca produjo.
        if (!result.template) {
          setError("No llegó la receta en uso; las fichas no se arman con una inventada.");
          return;
        }
        setTemplate(result.template);
      })
      .catch((cause) => {
        if (alive) setError(cause instanceof Error ? cause.message : "No se pudo leer la plantilla.");
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  // El histórico de fichas de prueba se lee aparte de la plantilla: si fallara,
  // el editor tiene que abrir igual. Un error aquí no vale un panel en blanco.
  useEffect(() => {
    let alive = true;
    void apiRecopiladoresMaterialPruebas()
      .then((lista) => { if (alive) setPruebas(lista); })
      .catch(() => { if (alive) setPruebas([]); });
    return () => { alive = false; };
  }, []);

  const createInstances = async (): Promise<CollectionMaterialInstance[]> => {
    if (!payload || !deployment) return [];
    // Con el plan entero cubierto no se crea otra: cada click duplicaba.
    if (fichasAlDia(payload.state)) {
      const vigente = instanciaReutilizable(payload.state);
      return vigente ? [vigente] : [];
    }
    setInstanceBusy(true);
    setError("");
    try {
      const result = await apiRecopiladoresMaterialInstances({
        expected_revision: payload.state_revision,
        unit_refs: payload.state.plan?.units.map((unit) => unit.unit_id),
        locale: "es-PE",
      });
      // Crear sube `state_revision`: sin releer el estado, el siguiente guardado
      // mandaría la revisión vieja y chocaría (409), y el contador no se movería.
      await onStateRefresh();
      return result.instances;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudieron crear las fichas.");
      return [];
    } finally {
      setInstanceBusy(false);
    }
  };

  const render = async (format: "png" | "pdf" | "bundle") => {
    if (!deployment) return;
    // Reutiliza la instancia persistida: crear una en cada render hacía crecer
    // `material_instances` en cada visita.
    const persistida = instanciaReutilizable(payload?.state);
    const readyInstances = persistida ? [persistida] : await createInstances();
    if (!readyInstances.length) return;
    setError("");
    setRenderResult(null);
    try {
      const job = await apiRecopiladoresMaterialsRender({
        format,
        instance_id: readyInstances[0].instance_id,
        audience: "field_team",
      });
      setJobFormat(format);
      setJobId(job.job_id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo generar el archivo.");
    }
  };

  // Ficha suelta con un identificador inventado: la que se escanea ANTES de
  // imprimir las 1.512 para comprobar que el QR abre y que la respuesta llega
  // con su colector, y la que se usa en la capacitación sin ensuciar el estudio.
  // No pasa por `createInstances()`: no persiste nada en el plan.
  const renderPrueba = async (codigoPedido?: string) => {
    const codigo = (codigoPedido ?? codigoPrueba).trim();
    if (!deployment || !codigo) return;
    setError("");
    setRenderResult(null);
    try {
      const job = await apiRecopiladoresMaterialPrueba({ codigo });
      setJobFormat("pdf");
      setJobId(job.job_id);
      // El histórico se relee del backend en vez de añadir la entrada a mano:
      // ahí es donde se decide si un código ya existía —se actualiza en su
      // sitio— y si su enlace sigue siendo el del despliegue de hoy.
      setPruebas(await apiRecopiladoresMaterialPruebas());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo generar la ficha de prueba.");
    }
  };

  const onRenderDone = useCallback((result: CollectionMaterialRenderResult) => {
    setJobId(null);
    setRenderResult(result);
    setDrivePub(null);
    setDriveError("");
    onArtifact(firstReceipt(result));
    void onStateRefresh();
  }, [onArtifact, onStateRefresh]);

  // B6(b): el artefacto YA renderizado se sube al Drive del operativo con la
  // credencial del libro. La carpeta se recuerda en el estado; lo que falla
  // llega con su causa (sin Google, sin permiso de Drive) y se muestra tal
  // cual — el backend ya habla en lenguaje de la persona.
  const enviarAlDrive = async () => {
    if (!payload || !renderResult) return;
    setDriveBusy(true);
    setDriveError("");
    try {
      const pub = await apiRecopiladoresMaterialDrive({
        file_id: renderResult.file_id,
        expected_revision: payload.state_revision,
      });
      setDrivePub(pub);
      await onStateRefresh();
    } catch (cause) {
      setDriveError(cause instanceof Error ? cause.message : "No se pudo subir al Drive.");
    } finally {
      setDriveBusy(false);
    }
  };

  // Sin plan no hay unidades que empaquetar: el armado entero (fichas, PNG,
  // PDF, paquete, ficha de ensayo) quedaba pintado con todo apagado.
  if (activeTab === "armado" && !payload?.state.plan) {
    return <VacioSinPlanCard vacio={vacioSinPlan("paquetes")} icono={<Archive size={18} />} onIr={onIr} />;
  }

  if (loading) return <div className="rec-loading">Leyendo la plantilla de la ficha…</div>;

  if (activeTab === "armado") {
    return (
      <div className="rec-package-layout">
        <Panel
          className="rec-package-card"
          eyebrow="Fichas"
          title={<><Archive size={18} aria-hidden /> La ficha de estos accesos</>}
        >
          <dl>
            <div><dt>Plantilla</dt><dd>{template.template_id}</dd></div>
            <div><dt>Accesos</dt><dd>{deployment?.deployment_id ?? "pendiente"}</dd></div>
            {/* Con su denominador: «Fichas 0» no dice de cuántas, y las que
                hay que hacer son las aulas que se van a visitar. Es el mismo
                ancla que ya lleva el vacío de Accesos —«Ninguna de las 193
                aulas del plan tiene acceso todavía»— y aquí faltaba. */}
            <div>
              <dt>Fichas</dt>
              <dd>
                {fichasHechas}
                {/* El total con su composición: «2.616» a secas no dice que ahí
                    dentro van los tres cajones que el paquete reparte por
                    facultad, y sin eso se lee como si se fuera a visitar 2.616
                    aulas. */}
                {aulasDelPlan > 0 && composicion.titulares > 0 ? (
                  <small className="rec-cuenta-composicion">
                    {composicion.titulares.toLocaleString("es-PE")} titulares
                    {composicion.reemplazos > 0
                      ? ` · ${composicion.reemplazos.toLocaleString("es-PE")} reemplazos` : ""}
                    {composicion.adicionales > 0
                      ? ` · ${composicion.adicionales.toLocaleString("es-PE")} adicionales` : ""}
                  </small>
                ) : null}
              </dd>
            </div>
            <div><dt>Estado</dt><dd>{deployment ? deploymentStatusLabel(deployment.status) : "sin preparar"}</dd></div>
          </dl>
          <PulsoButton
            variant="secondary"
            onClick={() => { void createInstances(); }}
            disabled={!deployment || instanceBusy || alDia}
            title={alDia ? "Las fichas vigentes ya cubren todas las unidades del plan." : undefined}
          >
            {instanceBusy ? <Loader2 size={15} className="pulso-spin" /> : alDia ? <CheckCircle2 size={15} /> : <Layers size={15} />}
            {alDia ? " Fichas al día" : " Crear las fichas"}
          </PulsoButton>
        </Panel>
        <Panel
          className="rec-render-card"
          data-qa-geometry-capacity="owned"
          eyebrow="Lo genera Pulso"
          title="PNG, PDF o paquete"
        >
          {/* **Un boton apagado dice por que lo esta, y en su sitio.** Los tres
              se apagan con `!deployment` —sin accesos preparados no hay enlace
              que meter en el QR— y el motivo vivia arriba a la derecha, en otra
              banda, como «accesos sin preparar». Quien pulsa mira el boton, no
              la esquina opuesta. */}
          <div className="rec-render-actions">
            <PulsoButton variant="secondary" title={motivoBloqueo ?? undefined} onClick={() => { void render("png"); }} disabled={!deployment || Boolean(jobId)}><Image size={15} /> Ver imagen</PulsoButton>
            <PulsoButton variant="primary" title={motivoBloqueo ?? undefined} onClick={() => { void render("pdf"); }} disabled={!deployment || Boolean(jobId)}><FileText size={15} /> Generar PDF</PulsoButton>
            <PulsoButton variant="secondary" title={motivoBloqueo ?? undefined} onClick={() => { void render("bundle"); }} disabled={!deployment || Boolean(jobId)}><Archive size={15} /> Generar el paquete</PulsoButton>
          </div>
          {/* **La ficha de ensayo no es un formato mas, por eso va aparte.**
              No sale del plan ni deja instancia: es una hoja con el MISMO
              enlace del operativo y un colector inventado, para escanearla
              antes de imprimir el lote y para la capacitacion. Vive en su
              propio archivo para poder renderizarla y mirar su markup. */}
          <FichaPruebaControl
            codigo={codigoPrueba}
            onCodigo={setCodigoPrueba}
            onGenerar={() => { void renderPrueba(); }}
            motivoBloqueo={motivoBloqueo}
            listo={Boolean(deployment)}
            ocupado={Boolean(jobId)}
          />
          <FichasPruebaHistorico
            fichas={pruebas}
            onPdf={(codigo) => { void renderPrueba(codigo); }}
            ocupado={Boolean(jobId)}
          />
          <JobProgress<CollectionMaterialRenderResult>
            label={`Render ${jobFormat ?? "material"}`}
            jobId={jobId}
            onDone={onRenderDone}
            onError={(message) => { setJobId(null); setError(message); }}
            onCancelled={() => setJobId(null)}
          />
          {renderResult ? (
            <div className="rec-render-result">
              {renderResult.media_type === "image/png" ? (
                <img src={downloadUrl(renderResult.file_id)} alt="La ficha tal como la genera Pulso" />
              ) : null}
              <div><strong>{renderResult.filename}</strong><span>{renderResult.media_type} · {renderResult.page_count} páginas · {renderResult.size_bytes} bytes</span><code>{renderResult.sha256}</code></div>
              <a href={downloadUrl(renderResult.file_id)}><Download size={14} /> Descargar la ficha</a>
              <div className="rec-drive">
                <button type="button" onClick={() => { void enviarAlDrive(); }} disabled={driveBusy}>
                  <UploadCloud size={14} /> {driveBusy ? "Subiendo al Drive…" : "Enviar al Drive del operativo"}
                </button>
                {drivePub ? (
                  <span className="rec-drive-listo">
                    En <strong>{drivePub.folderName || "el Drive"}</strong>:{" "}
                    <a href={drivePub.webViewLink} target="_blank" rel="noreferrer">ver en Drive</a>
                  </span>
                ) : null}
                {driveError ? <span className="rec-inline-error" role="alert">{driveError}</span> : null}
              </div>
            </div>
          ) : (
            /* **El vacio dice lo que hace falta, no una nota de archivo.**
               Sin accesos preparados los tres botones estan apagados y este
               hueco explicaba donde NO se guardan unos archivos que todavia no
               se pueden generar: informacion correcta contestando otra
               pregunta. Con accesos listos vuelve a ser esa nota, que ahi si es
               lo unico que queda por decir. */
            <div className="rec-contained-empty">
              {motivoBloqueo ? (
                <>
                  <strong>{motivoBloqueo}</strong>
                  <span>
                    Los accesos se preparan en la seccion Accesos: cada
                    curso-horario recibe su enlace y ese enlace es lo que va
                    dentro del QR de su ficha.
                  </span>
                </>
              ) : (
                "El archivo y su vista previa los genera Pulso, y no se guardan dentro del proyecto."
              )}
            </div>
          )}
          {error ? <p className="rec-inline-error" role="alert">{error}</p> : null}
        </Panel>
      </div>
    );
  }

  return null;
}
