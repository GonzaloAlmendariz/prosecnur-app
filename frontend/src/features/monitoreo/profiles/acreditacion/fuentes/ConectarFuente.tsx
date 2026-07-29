// Panel «Conectar fuente» — una sola puerta para Sheets, Kobo y SurveyMonkey.
//
// §4.3 de `docs/plan-fuentes-legibles-2026-07.md`. El ANTES no era un flujo:
// eran tres formularios repartidos por pestaña (`+ Agregar SurveyMonkey`,
// `Seleccionar encuesta Kobo`, y un campo `SPREADSHEET` suelto en otra), cada
// uno con sus propios botones y sin decir en qué orden se usaban ni qué quedó
// guardado (N1–N5).
//
// Aquí hay tres pasos, iguales para los tres servicios:
//
//   1 · Qué  — servicio y papel dentro del estudio.
//   2 · Cuál — pegar la dirección, o elegir del catálogo de la cuenta.
//   3 · Verificar — leer de verdad, mostrar qué se encontró, y recién ahí
//                   conectar. Este paso es el que no existía: es lo que
//                   convierte «guardé algo» en «sé qué guardé».
//
// El paso 3 nunca se salta. Guardar sin haber leído es exactamente cómo se
// llega a una fuente conectada que no trae filas y que nadie mira hasta que el
// avance sale en cero.

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Layers3,
  Loader2,
  PhoneCall,
  ListChecks,
  NotepadText,
  Search,
  Table2,
  X,
} from "../../../../../vendor/lucide-react";
import type { LucideIcon } from "../../../../../vendor/lucide-react";
import type {
  MonitoreoKoboAssetItem,
  MonitoreoSheetsInspectResult,
  MonitoreoSource,
  MonitoreoSourceRole,
  MonitoreoState,
} from "../../../../../api/client";
import {
  apiMonitoreoKoboAssets,
  apiMonitoreoSheetsInspect,
  apiMonitoreoSheetsSource,
  apiMonitoreoSource,
} from "../../../../../api/client";
import { apiSurveyMonkeyMultibaseListSurveys } from "../../../../../api/surveymonkey";
import {
  admiteDireccionPegada,
  leerDireccion,
} from "../../../fuentes/direccionDeFuente";
import type { ServicioDeFuente } from "../../../fuentes/direccionDeFuente";
import { actorQueContradiceElNombre, contar } from "../../../fuentes/vocabulario";
import "./fuentes.css";

const SM_API = "https://api.surveymonkey.com/v3";
const KOBO_POR_DEFECTO = "https://kf.kobotoolbox.org";

type Papel = Extract<MonitoreoSourceRole, "universo" | "barrido" | "respuestas">;

const SERVICIOS: ReadonlyArray<{
  key: ServicioDeFuente;
  nombre: string;
  icon: LucideIcon;
  /** Qué trae, dicho con lo que el estudio hace con ello. */
  aporta: string;
}> = [
  { key: "google_sheets", nombre: "Google Sheets", icon: Table2, aporta: "Bases de universo y hojas de barrido" },
  { key: "kobo", nombre: "Kobo", icon: ListChecks, aporta: "Respuestas de un formulario" },
  { key: "surveymonkey", nombre: "SurveyMonkey", icon: NotepadText, aporta: "Respuestas de una encuesta" },
];

const PAPELES: ReadonlyArray<{ key: Papel; nombre: string; icon: LucideIcon }> = [
  { key: "universo", nombre: "Universo", icon: Layers3 },
  { key: "respuestas", nombre: "Respuestas", icon: ListChecks },
  { key: "barrido", nombre: "Barrido", icon: PhoneCall },
];

/** Papeles que cada servicio puede cumplir. Kobo y SurveyMonkey traen
 * respuestas: ofrecerles «universo» invita a una configuración que después
 * falla al calcular metas. */
function papelesDe(servicio: ServicioDeFuente): readonly Papel[] {
  return servicio === "google_sheets" ? ["universo", "barrido"] : ["respuestas"];
}

type Paso = 1 | 2 | 3;

type Eleccion =
  | { servicio: "google_sheets"; spreadsheetId: string }
  | { servicio: "kobo"; baseUrl: string; assetUid: string; nombre: string }
  | { servicio: "surveymonkey"; surveyId: string; nombre: string };

type Lectura =
  | { tipo: "sheets"; inspeccion: MonitoreoSheetsInspectResult; hoja: string }
  | { tipo: "encuesta"; nombre: string; detalle: string };

export function ConectarFuente({
  sources,
  actoresSugeridos,
  papelInicial = "universo",
  onCerrar,
  onStateChange,
}: {
  sources: MonitoreoSource[];
  actoresSugeridos: string[];
  papelInicial?: Papel;
  onCerrar: () => void;
  onStateChange?: (state: MonitoreoState) => void;
}) {
  const [paso, setPaso] = useState<Paso>(1);
  const [servicio, setServicio] = useState<ServicioDeFuente>("google_sheets");
  const [papel, setPapel] = useState<Papel>(papelInicial);
  const [actor, setActor] = useState(actoresSugeridos[0] ?? "");
  const [pegado, setPegado] = useState("");
  const [eleccion, setEleccion] = useState<Eleccion | null>(null);
  const [lectura, setLectura] = useState<Lectura | null>(null);
  const [ocupado, setOcupado] = useState<"catalogo" | "leyendo" | "guardando" | null>(null);
  const [error, setError] = useState("");

  // Catálogos de la cuenta, cargados solo cuando el paso 2 los necesita.
  const [assetsKobo, setAssetsKobo] = useState<MonitoreoKoboAssetItem[] | null>(null);
  const [encuestasSm, setEncuestasSm] = useState<Array<{ id: string; title: string }> | null>(null);
  const [busqueda, setBusqueda] = useState("");

  const papelesDisponibles = papelesDe(servicio);
  const lecturaDeLoPegado = useMemo(
    () => (admiteDireccionPegada(servicio) ? leerDireccion(servicio, pegado) : null),
    [servicio, pegado],
  );

  // Cambiar de servicio invalida todo lo elegido después: dejar un asset de
  // Kobo colgando mientras la cabecera dice «Google Sheets» es cómo se guardan
  // fuentes con el servicio de una y el identificador de otra.
  useEffect(() => {
    setEleccion(null);
    setLectura(null);
    setPegado("");
    setError("");
    if (!papelesDisponibles.includes(papel)) setPapel(papelesDisponibles[0]);
  }, [servicio]);

  const yaConectada = useMemo(() => {
    if (!eleccion) return null;
    return sources.find((source) => (
      (eleccion.servicio === "google_sheets" && source.sheet_binding?.spreadsheet_id === eleccion.spreadsheetId)
      || (eleccion.servicio === "kobo" && source.asset_uid === eleccion.assetUid)
      || (eleccion.servicio === "surveymonkey" && source.survey_id === eleccion.surveyId)
    )) ?? null;
  }, [eleccion, sources]);

  async function cargarCatalogo() {
    setOcupado("catalogo");
    setError("");
    try {
      if (servicio === "kobo") {
        const data = await apiMonitoreoKoboAssets(KOBO_POR_DEFECTO, 100);
        setAssetsKobo(data.assets ?? []);
      } else if (servicio === "surveymonkey") {
        const data = await apiSurveyMonkeyMultibaseListSurveys("", 200, 12);
        setEncuestasSm(data.surveys.map((survey) => ({ id: survey.id, title: survey.title })));
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOcupado(null);
    }
  }

  /** Paso 3: leer de verdad antes de dejar guardar. */
  async function verificar(elegida: Eleccion) {
    setOcupado("leyendo");
    setError("");
    setLectura(null);
    try {
      if (elegida.servicio === "google_sheets") {
        const inspeccion = await apiMonitoreoSheetsInspect({
          spreadsheet_id: elegida.spreadsheetId,
          sheet_name: "",
          header_row: 1,
          range: "",
        });
        const sugerida = inspeccion.sheets.find((hoja) => (
          hoja.title.localeCompare(actor, "es", { sensitivity: "base" }) === 0
        ))?.title ?? inspeccion.sheets[0]?.title ?? "";
        setLectura({ tipo: "sheets", inspeccion, hoja: sugerida });
      } else {
        setLectura({
          tipo: "encuesta",
          nombre: elegida.nombre,
          detalle: elegida.servicio === "kobo" ? "Formulario de Kobo" : "Encuesta de SurveyMonkey",
        });
      }
      setEleccion(elegida);
      setPaso(3);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOcupado(null);
    }
  }

  async function conectar() {
    if (!eleccion) return;
    setOcupado("guardando");
    setError("");
    try {
      if (eleccion.servicio === "google_sheets") {
        const hoja = lectura?.tipo === "sheets" ? lectura.hoja : "";
        const result = await apiMonitoreoSheetsSource({
          kind: "google_sheets",
          label: papel === "barrido" ? "Barrido telefónico" : `Base ${actor}`.trim(),
          enabled: true,
          role: papel,
          integration_mode: "connected_read",
          sheet_binding: { spreadsheet_id: eleccion.spreadsheetId, sheet_name: hoja, header_row: 1, range: "" },
          dimensions: {
            actor,
            segmento: actor,
            canal: papel === "barrido" ? "Telefónico" : "Base",
            sheet_name: hoja,
          },
        });
        onStateChange?.(result.state);
      } else {
        const result = await apiMonitoreoSource({
          kind: eleccion.servicio,
          label: eleccion.nombre,
          enabled: true,
          role: "respuestas",
          ...(eleccion.servicio === "kobo"
            ? { asset_uid: eleccion.assetUid, base_url: eleccion.baseUrl }
            : { survey_id: eleccion.surveyId, base_url: SM_API }),
          dimensions: { actor, segmento: actor, survey_title: eleccion.nombre },
        });
        onStateChange?.(result.state);
      }
      onCerrar();
    } catch (e) {
      setError((e as Error).message);
      setOcupado(null);
    }
  }

  const puedeAvanzarDesde1 = Boolean(actor.trim()) || papel === "barrido";

  // El actor se declara en el paso 1, pero es en el paso 3 —con el nombre real
  // de la encuesta delante— cuando se ve si estaba bien. Antes había que volver
  // al paso 1 para corregirlo, y el pie afirmaba «respuestas de Administrativos»
  // sobre una encuesta llamada «…Estudiantes» sin decir nada.
  const nombreDeLaFuente = lectura
    ? (lectura.tipo === "sheets" ? lectura.inspeccion.title ?? "" : lectura.nombre)
    : "";
  const actorQueSugiereElNombre = actorQueContradiceElNombre(nombreDeLaFuente, actor, actoresSugeridos);

  return (
    <div className="fuentes-conectar" role="dialog" aria-modal="true" aria-label="Conectar fuente">
      <header className="fuentes-conectar-cabecera">
        <div>
          <span>Conectar fuente</span>
          <strong>{SERVICIOS.find((item) => item.key === servicio)?.nombre}</strong>
        </div>
        <ol className="fuentes-conectar-pasos" aria-label="Pasos">
          {([1, 2, 3] as Paso[]).map((numero) => (
            <li key={numero} className={numero === paso ? "is-actual" : numero < paso ? "is-hecho" : ""}>
              <i>{numero}</i>
              <span>{numero === 1 ? "Qué" : numero === 2 ? "Cuál" : "Verificar"}</span>
            </li>
          ))}
        </ol>
        <button type="button" onClick={onCerrar} aria-label="Cerrar"><X size={16} /></button>
      </header>

      <div className="fuentes-conectar-cuerpo">
        {error ? (
          <p className="fuentes-conectar-error"><AlertTriangle size={14} /> {error}</p>
        ) : null}

        {paso === 1 ? (
          <div className="fuentes-conectar-paso">
            <fieldset className="fuentes-conectar-grupo">
              <legend>Servicio</legend>
              <div className="fuentes-conectar-opciones">
                {SERVICIOS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      className={servicio === item.key ? "is-elegido" : ""}
                      onClick={() => setServicio(item.key)}
                    >
                      <Icon size={15} />
                      <strong>{item.nombre}</strong>
                      <em>{item.aporta}</em>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <fieldset className="fuentes-conectar-grupo">
              <legend>Papel en el estudio</legend>
              <div className="fuentes-conectar-opciones is-compacto">
                {PAPELES.filter((item) => papelesDisponibles.includes(item.key)).map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      className={papel === item.key ? "is-elegido" : ""}
                      onClick={() => setPapel(item.key)}
                    >
                      <Icon size={15} />
                      <strong>{item.nombre}</strong>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            {papel !== "barrido" ? (
              <fieldset className="fuentes-conectar-grupo">
                <legend>Actor</legend>
                <input
                  list="fuentes-conectar-actores"
                  value={actor}
                  onChange={(event) => setActor(event.currentTarget.value)}
                  placeholder="Estudiantes, Docentes, Egresados…"
                />
                <datalist id="fuentes-conectar-actores">
                  {actoresSugeridos.map((item) => <option key={item} value={item} />)}
                </datalist>
              </fieldset>
            ) : null}
          </div>
        ) : null}

        {paso === 2 ? (
          <div className="fuentes-conectar-paso">
            {admiteDireccionPegada(servicio) ? (
              <fieldset className="fuentes-conectar-grupo">
                <legend>{servicio === "kobo" ? "Dirección del proyecto en Kobo" : "Dirección del Google Sheet"}</legend>
                <input
                  value={pegado}
                  onChange={(event) => setPegado(event.currentTarget.value)}
                  placeholder={servicio === "kobo"
                    ? "https://kf.kobotoolbox.org/#/forms/…"
                    : "https://docs.google.com/spreadsheets/d/…"}
                  autoFocus
                />
                {/* N2/N5: el diagnóstico es local y aparece mientras se escribe,
                  * no después de apretar un botón y esperar al backend. */}
                {pegado.trim() && lecturaDeLoPegado ? (
                  lecturaDeLoPegado.ok ? (
                    <p className="fuentes-conectar-pista is-ok">
                      <CheckCircle2 size={13} /> Dirección reconocida.
                    </p>
                  ) : (
                    <p className="fuentes-conectar-pista is-aviso">
                      <AlertTriangle size={13} /> {lecturaDeLoPegado.mensaje}
                    </p>
                  )
                ) : null}
              </fieldset>
            ) : (
              <p className="fuentes-conectar-pista is-neutra">
                SurveyMonkey no se conecta por dirección: la encuesta se elige del catálogo de tu cuenta.
              </p>
            )}

            <fieldset className="fuentes-conectar-grupo">
              <legend>{admiteDireccionPegada(servicio) ? "O elige del catálogo de tu cuenta" : "Catálogo de tu cuenta"}</legend>
              {(servicio === "kobo" ? assetsKobo : servicio === "surveymonkey" ? encuestasSm : null) === null
                && servicio !== "google_sheets" ? (
                <button
                  type="button"
                  className="pulso-button"
                  onClick={() => { void cargarCatalogo(); }}
                  disabled={ocupado === "catalogo"}
                >
                  {ocupado === "catalogo" ? <Loader2 size={14} className="pulso-spin" /> : <Search size={14} />}
                  <span>Ver mis {servicio === "kobo" ? "formularios" : "encuestas"}</span>
                </button>
              ) : servicio === "google_sheets" ? (
                <p className="fuentes-conectar-pista is-neutra">
                  Google Sheets se conecta pegando la dirección del documento.
                </p>
              ) : (
                <>
                  <input
                    value={busqueda}
                    onChange={(event) => setBusqueda(event.currentTarget.value)}
                    placeholder="Filtrar por nombre"
                  />
                  <div className="fuentes-conectar-catalogo" data-qa-geometry-capacity="owned">
                    {(servicio === "kobo"
                      ? (assetsKobo ?? []).map((asset) => ({ id: asset.uid, nombre: asset.name, extra: asset.deployment_active ? "Desplegado" : "Inactivo" }))
                      : (encuestasSm ?? []).map((survey) => ({ id: survey.id, nombre: survey.title, extra: "" }))
                    )
                      .filter((item) => !busqueda.trim() || item.nombre.toLowerCase().includes(busqueda.trim().toLowerCase()))
                      .map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            void verificar(servicio === "kobo"
                              ? { servicio: "kobo", baseUrl: KOBO_POR_DEFECTO, assetUid: item.id, nombre: item.nombre }
                              : { servicio: "surveymonkey", surveyId: item.id, nombre: item.nombre });
                          }}
                        >
                          <strong>{item.nombre}</strong>
                          {item.extra ? <em>{item.extra}</em> : null}
                        </button>
                      ))}
                  </div>
                </>
              )}
            </fieldset>
          </div>
        ) : null}

        {paso === 3 && lectura ? (
          <div className="fuentes-conectar-paso">
            {yaConectada ? (
              <p className="fuentes-conectar-pista is-aviso">
                <AlertTriangle size={13} /> Esta fuente ya está conectada como «{yaConectada.label || yaConectada.id}». Conectarla otra vez duplicaría sus respuestas en el corte.
              </p>
            ) : null}

            {lectura.tipo === "sheets" ? (
              <>
                <div className="fuentes-conectar-resultado">
                  <span>Documento</span>
                  <strong>{lectura.inspeccion.title || "Google Sheet"}</strong>
                  <em>{contar(lectura.inspeccion.sheets.length, "pestaña", "pestañas")}</em>
                </div>
                <fieldset className="fuentes-conectar-grupo">
                  {/* N4: la pestaña se elige de las que el documento tiene de
                    * verdad. Antes era un input de texto libre aunque la app ya
                    * conocía la lista. */}
                  <legend>Pestaña que se va a leer</legend>
                  <div className="fuentes-conectar-catalogo is-corto" data-qa-geometry-capacity="owned">
                    {lectura.inspeccion.sheets.map((hoja) => (
                      <button
                        key={hoja.title}
                        type="button"
                        className={lectura.hoja === hoja.title ? "is-elegido" : ""}
                        onClick={() => setLectura({ ...lectura, hoja: hoja.title })}
                      >
                        <strong>{hoja.title}</strong>
                        <em>{contar(hoja.row_count, "fila", "filas")}</em>
                      </button>
                    ))}
                  </div>
                </fieldset>
                {lectura.inspeccion.headers.length ? (
                  <div className="fuentes-conectar-resultado">
                    <span>Columnas leídas</span>
                    <div className="fuentes-conectar-columnas">
                      {lectura.inspeccion.headers.slice(0, 12).map((header) => <i key={header}>{header}</i>)}
                      {lectura.inspeccion.headers.length > 12
                        ? <i>+{lectura.inspeccion.headers.length - 12}</i>
                        : null}
                    </div>
                  </div>
                ) : (
                  <p className="fuentes-conectar-pista is-aviso">
                    <AlertTriangle size={13} /> Esa pestaña no devolvió encabezados. Revisa que la primera fila tenga los nombres de columna.
                  </p>
                )}
              </>
            ) : (
              <div className="fuentes-conectar-resultado">
                <span>{lectura.detalle}</span>
                <strong>{lectura.nombre}</strong>
              </div>
            )}

            {papel !== "barrido" ? (
              <fieldset className="fuentes-conectar-grupo">
                <legend>Se leerá como respuestas de</legend>
                <input
                  list="fuentes-conectar-actores-confirmar"
                  value={actor}
                  onChange={(event) => setActor(event.currentTarget.value)}
                  placeholder="Estudiantes, Docentes, Egresados…"
                />
                <datalist id="fuentes-conectar-actores-confirmar">
                  {actoresSugeridos.map((item) => <option key={item} value={item} />)}
                </datalist>
                {actorQueSugiereElNombre ? (
                  <p className="fuentes-conectar-pista is-aviso">
                    <AlertTriangle size={13} /> El nombre de esta fuente menciona «{actorQueSugiereElNombre}» y la vas a
                    guardar como «{actor}». Si es un error, corrígelo aquí mismo.
                  </p>
                ) : null}
              </fieldset>
            ) : null}
          </div>
        ) : null}
      </div>

      <footer className="fuentes-conectar-pie">
        {paso > 1 ? (
          <button type="button" className="pulso-button" onClick={() => setPaso((paso - 1) as Paso)}>
            <ArrowLeft size={14} /><span>Atrás</span>
          </button>
        ) : <span />}

        {paso === 1 ? (
          <button
            type="button"
            className="pulso-button is-primary"
            disabled={!puedeAvanzarDesde1}
            onClick={() => setPaso(2)}
          >
            <span>Continuar</span>
          </button>
        ) : null}

        {paso === 2 && admiteDireccionPegada(servicio) ? (
          <button
            type="button"
            className="pulso-button is-primary"
            disabled={!lecturaDeLoPegado?.ok || ocupado === "leyendo"}
            onClick={() => {
              if (!lecturaDeLoPegado?.ok) return;
              void verificar(lecturaDeLoPegado.servicio === "google_sheets"
                ? { servicio: "google_sheets", spreadsheetId: lecturaDeLoPegado.spreadsheetId }
                : { servicio: "kobo", baseUrl: lecturaDeLoPegado.baseUrl, assetUid: lecturaDeLoPegado.assetUid, nombre: "Formulario de Kobo" });
            }}
          >
            {ocupado === "leyendo" ? <Loader2 size={14} className="pulso-spin" /> : <ExternalLink size={14} />}
            <span>{ocupado === "leyendo" ? "Leyendo…" : "Leer y verificar"}</span>
          </button>
        ) : null}

        {paso === 3 ? (
          <button
            type="button"
            className="pulso-button is-primary"
            disabled={ocupado === "guardando" || (lectura?.tipo === "sheets" && !lectura.hoja)}
            onClick={() => { void conectar(); }}
          >
            {ocupado === "guardando" ? <Loader2 size={14} className="pulso-spin" /> : <CheckCircle2 size={14} />}
            <span>{ocupado === "guardando" ? "Conectando…" : "Conectar"}</span>
          </button>
        ) : null}
      </footer>
    </div>
  );
}
