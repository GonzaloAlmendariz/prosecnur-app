// Panel «Conectar fuente» — el guion del modo, no un formulario de tres pasos.
//
// §4.3 de `docs/plan-fuentes-legibles-2026-07.md`. El ANTES no era un flujo:
// eran tres formularios repartidos por pestaña (`+ Agregar SurveyMonkey`,
// `Seleccionar encuesta Kobo`, y un campo `SPREADSHEET` suelto en otra), cada
// uno con sus propios botones y sin decir en qué orden se usaban ni qué quedó
// guardado (N1–N5).
//
// La primera versión unificada arregló eso y dejó otro defecto: preguntaba
// **el servicio** —Google Sheets / Kobo / SurveyMonkey— antes que nada, igual
// para todos los estudios. Medido en `acnur_pdm`: un estudio telefónico, que
// lee su padrón de Sheets y sus efectivas de Kobo, recibía SurveyMonkey como
// tercera opción de igual peso, y «Universo» preseleccionado sin decir que lo
// que faltaba era el barrido. El panel no sabía en qué modo estaba.
//
// Ahora manda el guion del modo (`guionDeConexion.ts`): a la izquierda las
// piezas que ese tipo de monitoreo necesita, en el orden en que dependen una de
// otra y con su estado real; a la derecha el trabajo sobre la pieza elegida. El
// servicio sólo se pregunta donde hay una decisión —las respuestas de
// acreditación pueden venir de SurveyMonkey o de Kobo—; una hoja de barrido es
// una hoja de cálculo y no hay nada que elegir.
//
// El paso de verificación no se salta nunca. Guardar sin haber leído es
// exactamente cómo se llega a una fuente conectada que no trae filas y que
// nadie mira hasta que el avance sale en cero.

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ExternalLink,
  Layers3,
  Loader2,
  PhoneCall,
  ListChecks,
  NotepadText,
  PlugZap,
  Search,
  Table2,
  X,
} from "../../../vendor/lucide-react";
import type { LucideIcon } from "../../../vendor/lucide-react";
import type {
  MonitoreoKoboAssetItem,
  MonitoreoSheetsInspectResult,
  MonitoreoSource,
  MonitoreoState,
} from "../../../api/client";
import {
  apiMonitoreoKoboAssets,
  apiMonitoreoSheetsInspect,
  apiMonitoreoSheetsSource,
  apiMonitoreoSource,
} from "../../../api/client";
import { apiSurveyMonkeyMultibaseListSurveys } from "../../../api/surveymonkey";
import {
  admiteDireccionPegada,
  leerDireccion,
} from "./direccionDeFuente";
import type { ServicioDeFuente } from "./direccionDeFuente";
import { guionConEstado, piezaPorLaQueSeguir, piezaSiguienteTrasConectar } from "./guionDeConexion";
import type { PapelDeFuente, PiezaConEstado } from "./guionDeConexion";
import { actorQueContradiceElNombre, contar } from "./vocabulario";
import "./conectarFuente.css";

const SM_API = "https://api.surveymonkey.com/v3";
const KOBO_POR_DEFECTO = "https://kf.kobotoolbox.org";

const NOMBRE_DE_SERVICIO: Record<ServicioDeFuente, string> = {
  google_sheets: "Google Sheets",
  kobo: "Kobo",
  surveymonkey: "SurveyMonkey",
};

const ICONO_DE_SERVICIO: Record<ServicioDeFuente, LucideIcon> = {
  google_sheets: Table2,
  kobo: ListChecks,
  surveymonkey: NotepadText,
};

const ICONO_DE_PAPEL: Record<PapelDeFuente, LucideIcon> = {
  universo: Layers3,
  barrido: PhoneCall,
  respuestas: ListChecks,
};

type Paso = "pieza" | "cual" | "verificar";

/**
 * Los pasos que esta pieza necesita de verdad.
 *
 * El paso «qué» sólo existe si hay algo que decidir: el proveedor cuando la
 * pieza admite más de uno, o el actor cuando el estudio la reparte. Una hoja de
 * barrido en telefónico no tiene ninguna de las dos cosas, y ese paso quedaba
 * como una pantalla que repetía el nombre de la pieza —ya presente en el guion
 * de la izquierda y en la cabecera— y pedía pulsar «Continuar» para nada.
 */
function pasosDeLaPieza(pieza: PiezaConEstado | null): Paso[] {
  const decide = Boolean(pieza && (pieza.servicios.length > 1 || pieza.porActor));
  return decide ? ["pieza", "cual", "verificar"] : ["cual", "verificar"];
}

/** Qué se está haciendo con la pieza, dicho en concreto y sin repetir su nombre. */
const ROTULO_DEL_PASO: Record<Paso, string> = {
  pieza: "Qué vas a conectar",
  cual: "De dónde sale",
  verificar: "Qué se leyó",
};

type Eleccion =
  | { servicio: "google_sheets"; spreadsheetId: string }
  | { servicio: "kobo"; baseUrl: string; assetUid: string; nombre: string }
  | { servicio: "surveymonkey"; surveyId: string; nombre: string };

type Lectura =
  | { tipo: "sheets"; inspeccion: MonitoreoSheetsInspectResult; hoja: string }
  | { tipo: "encuesta"; nombre: string; detalle: string };

export function ConectarFuente({
  sources,
  familia,
  actoresSugeridos,
  papelInicial,
  onCerrar,
  onStateChange,
}: {
  sources: MonitoreoSource[];
  /** Familia del perfil de monitoreo; decide el guion. */
  familia?: string;
  actoresSugeridos: string[];
  papelInicial?: PapelDeFuente;
  onCerrar: () => void;
  onStateChange?: (state: MonitoreoState) => void;
}) {
  const { guion, piezas } = useMemo(() => guionConEstado(familia, sources), [familia, sources]);
  const sugerida = useMemo(() => piezaPorLaQueSeguir(piezas), [piezas]);

  const [papel, setPapel] = useState<PapelDeFuente>(() => (
    piezas.find((pieza) => pieza.papel === papelInicial)?.papel
      ?? sugerida?.papel
      ?? piezas[0]?.papel
      ?? "universo"
  ));
  const pieza = piezas.find((item) => item.papel === papel) ?? piezas[0] ?? null;
  const pasos = pasosDeLaPieza(pieza);
  const primerPaso = pasos[0];

  const [paso, setPaso] = useState<Paso>(primerPaso);
  const [servicio, setServicio] = useState<ServicioDeFuente>(() => (
    pieza?.servicios[0] ?? "google_sheets"
  ));
  const [actor, setActor] = useState(actoresSugeridos[0] ?? "");
  const [pegado, setPegado] = useState("");
  const [eleccion, setEleccion] = useState<Eleccion | null>(null);
  const [lectura, setLectura] = useState<Lectura | null>(null);
  const [ocupado, setOcupado] = useState<"catalogo" | "leyendo" | "guardando" | null>(null);
  const [error, setError] = useState("");
  /** Lo que se acaba de conectar, para que el salto de pieza no sea un misterio. */
  const [hecho, setHecho] = useState("");

  // Catálogos de la cuenta, cargados solo cuando el paso 2 los necesita.
  const [assetsKobo, setAssetsKobo] = useState<MonitoreoKoboAssetItem[] | null>(null);
  const [encuestasSm, setEncuestasSm] = useState<Array<{ id: string; title: string }> | null>(null);
  const [busqueda, setBusqueda] = useState("");

  const lecturaDeLoPegado = useMemo(
    () => (admiteDireccionPegada(servicio) ? leerDireccion(servicio, pegado) : null),
    [servicio, pegado],
  );

  // Cambiar de pieza o de servicio invalida todo lo elegido después: dejar un
  // asset de Kobo colgando mientras la cabecera dice «Google Sheets» es cómo se
  // guardan fuentes con el servicio de una y el identificador de otra.
  useEffect(() => {
    setEleccion(null);
    setLectura(null);
    setPegado("");
    setError("");
  }, [servicio, papel]);

  // El aviso de «conectada» dura hasta que el usuario hace algo: vive un paso,
  // no un temporizador. Desaparecer solo obligaría a recordar qué decía.
  useEffect(() => {
    if (paso !== "pieza") setHecho("");
  }, [paso]);

  useEffect(() => {
    if (!pieza) return;
    if (!pieza.servicios.includes(servicio)) setServicio(pieza.servicios[0]);
    // Cambiar de pieza empieza su flujo por donde le toca a ella, que no es el
    // mismo sitio para todas: una pieza sin decisiones arranca en «de dónde
    // sale» y una repartida por actor, en el actor.
    setPaso(pasosDeLaPieza(pieza)[0]);
  }, [papel]);

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
        const sugeridaHoja = inspeccion.sheets.find((hoja) => (
          hoja.title.localeCompare(actor, "es", { sensitivity: "base" }) === 0
        ))?.title ?? inspeccion.sheets[0]?.title ?? "";
        setLectura({ tipo: "sheets", inspeccion, hoja: sugeridaHoja });
      } else {
        setLectura({
          tipo: "encuesta",
          nombre: elegida.nombre,
          detalle: elegida.servicio === "kobo" ? "Formulario de Kobo" : "Encuesta de SurveyMonkey",
        });
      }
      setEleccion(elegida);
      setPaso("verificar");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOcupado(null);
    }
  }

  /**
   * Tras guardar, el panel no se cierra si queda algo por conectar: avanza a la
   * pieza siguiente con el guion ya actualizado. Cerrar aquí devolvía al usuario
   * a la pantalla anterior con el estudio a medio configurar y le obligaba a
   * volver a abrir el panel para la pieza que él mismo acababa de ver marcada
   * como pendiente.
   */
  function seguirODCerrar(estado: MonitoreoState, papelConectado: PapelDeFuente) {
    const { piezas: actualizadas } = guionConEstado(familia, estado.sources ?? []);
    const siguiente = piezaSiguienteTrasConectar(actualizadas, papelConectado, actor);
    if (!siguiente) {
      onCerrar();
      return;
    }
    setHecho(`${pieza?.titulo ?? "Fuente"} conectada. Sigue por ${siguiente.titulo.toLocaleLowerCase("es")}.`);
    setPapel(siguiente.papel);
    setPaso("pieza");
    setOcupado(null);
  }

  async function conectar() {
    if (!eleccion || !pieza) return;
    setOcupado("guardando");
    setError("");
    try {
      if (eleccion.servicio === "google_sheets") {
        const hoja = lectura?.tipo === "sheets" ? lectura.hoja : "";
        const result = await apiMonitoreoSheetsSource({
          kind: "google_sheets",
          label: pieza.papel === "barrido" ? "Barrido telefónico" : `Base ${actor}`.trim(),
          enabled: true,
          role: pieza.papel,
          integration_mode: "connected_read",
          sheet_binding: { spreadsheet_id: eleccion.spreadsheetId, sheet_name: hoja, header_row: 1, range: "" },
          dimensions: {
            actor,
            segmento: actor,
            canal: pieza.papel === "barrido" ? "Telefónico" : "Base",
            sheet_name: hoja,
          },
        });
        onStateChange?.(result.state);
        seguirODCerrar(result.state, pieza.papel);
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
        seguirODCerrar(result.state, pieza.papel);
      }
    } catch (e) {
      setError((e as Error).message);
      setOcupado(null);
    }
  }

  // El actor sólo se pide donde el estudio reparte la pieza por actor. En
  // telefónico hay un solo padrón y un solo barrido: preguntarlo ahí era un
  // campo obligatorio sin respuesta correcta.
  const pideActor = Boolean(pieza?.porActor);
  const puedeAvanzarDeLaPieza = Boolean(pieza) && (!pideActor || Boolean(actor.trim()));

  // El actor se declara al elegir la pieza, pero es al verificar —con el nombre
  // real de la encuesta delante— cuando se ve si estaba bien. Antes había que
  // volver atrás para corregirlo, y el pie afirmaba «respuestas de
  // Administrativos» sobre una encuesta llamada «…Estudiantes» sin decir nada.
  const nombreDeLaFuente = lectura
    ? (lectura.tipo === "sheets" ? lectura.inspeccion.title ?? "" : lectura.nombre)
    : "";
  const actorQueSugiereElNombre = actorQueContradiceElNombre(nombreDeLaFuente, actor, actoresSugeridos);

  const indiceDelPaso = Math.max(0, pasos.indexOf(paso));

  return (
    <div className="fuentes-conectar" role="dialog" aria-modal="true" aria-label="Conectar fuente">
      {/* Columna del guion: qué necesita ESTE modo, en su orden y con su estado.
        * Es lo que convierte el panel en una guía en vez de un formulario: quien
        * lo abre ve de un vistazo qué le falta al estudio y por dónde va. */}
      <aside className="fuentes-conectar-guion">
        <header>
          <i aria-hidden="true"><PlugZap size={17} /></i>
          <span>Conectar fuente</span>
          <strong>{guion.modo}</strong>
        </header>
        <ol>
          {piezas.map((item, index) => {
            const Icono = ICONO_DE_PAPEL[item.papel];
            const activa = item.papel === papel;
            return (
              <li key={item.papel}>
                <button
                  type="button"
                  className={`${activa ? "is-actual " : ""}${item.lista ? "is-lista" : "is-pendiente"}`}
                  aria-current={activa ? "step" : undefined}
                  onClick={() => { setPapel(item.papel); setPaso("pieza"); }}
                >
                  <b aria-hidden="true">{item.lista ? <Check size={12} /> : index + 1}</b>
                  <span>
                    <strong><Icono size={13} /> {item.titulo}</strong>
                    <em>{item.aporta}</em>
                    {/* Una pieza repartida por actor no está «lista»: siempre
                      * puede entrar otro. Lo que se dice es cuántos ya tiene,
                      * que es la pregunta de quien viene a sumar el siguiente. */}
                    {item.porActor ? (
                      <i>
                        {item.actores.length
                          ? `${contar(item.actores.length, "actor", "actores")}: ${item.actores.join(" · ")}`
                          : "Todavía sin actores"}
                      </i>
                    ) : null}
                    {/* Sin fuente propia pero cubierta: muchos estudios llevan
                      * universo y barrido en la misma hoja, y sin decirlo el
                      * guion pedía conectar algo que el estudio ya tiene. */}
                    {item.cubiertaCon ? <i>La cubre {item.cubiertaCon.toLocaleLowerCase("es")}</i> : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
        {sugerida && !sugerida.lista ? (
          <p className="fuentes-conectar-guion-pista">
            Sigue por {sugerida.titulo.toLocaleLowerCase("es")}.
          </p>
        ) : null}
      </aside>

      <div className="fuentes-conectar-obra">
        <header className="fuentes-conectar-cabecera">
          {/* Sin antetítulo: el rótulo del paso ya está en el indicador de al
            * lado, y ponerlo también aquí lo dejaba dos veces en la misma
            * línea. La cabecera nombra la pieza sobre la que se trabaja. */}
          <div>
            <strong>{pieza?.titulo ?? "Fuente"}</strong>
            {pieza?.cubiertaCon ? <span>La cubre {pieza.cubiertaCon.toLocaleLowerCase("es")}</span> : null}
          </div>
          <ol className="fuentes-conectar-pasos" aria-label="Pasos">
            {pasos.map((item, index) => (
              <li key={item} className={item === paso ? "is-actual" : index < indiceDelPaso ? "is-hecho" : ""}>
                <i>{index + 1}</i>
                <span>{ROTULO_DEL_PASO[item]}</span>
              </li>
            ))}
          </ol>
          <button type="button" onClick={onCerrar} aria-label="Cerrar"><X size={16} /></button>
        </header>

        <div className="fuentes-conectar-cuerpo">
          {error ? (
            <p className="fuentes-conectar-error"><AlertTriangle size={14} /> {error}</p>
          ) : null}
          {hecho ? (
            <p className="fuentes-conectar-hecho"><CheckCircle2 size={14} /> {hecho}</p>
          ) : null}

          {paso === "pieza" && pieza ? (
            <div className="fuentes-conectar-paso">
              {/* Sin tarjeta que repita el título: ya está en el guion de la
                * izquierda y en la cabecera de aquí al lado. Este paso sólo
                * existe cuando hay algo que decidir, así que sólo muestra eso. */}

              {/* Servicio: sólo cuando hay más de uno posible. Una hoja de
                * barrido es una hoja de cálculo, y ofrecer tres proveedores
                * para eso era pedir una decisión inexistente. */}
              {pieza.servicios.length > 1 ? (
                <fieldset className="fuentes-conectar-grupo">
                  <legend>De dónde salen</legend>
                  <div className="fuentes-conectar-opciones">
                    {pieza.servicios.map((item) => {
                      const Icon = ICONO_DE_SERVICIO[item];
                      return (
                        <button
                          key={item}
                          type="button"
                          className={servicio === item ? "is-elegido" : ""}
                          onClick={() => setServicio(item)}
                        >
                          <Icon size={15} />
                          <strong>{NOMBRE_DE_SERVICIO[item]}</strong>
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              ) : null}

              {pideActor ? (
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
                  {pieza.actores.length ? (
                    <p className="fuentes-conectar-pista is-neutra">
                      Ya tienen {pieza.titulo.toLocaleLowerCase("es")}: {pieza.actores.join(", ")}.
                    </p>
                  ) : null}
                </fieldset>
              ) : null}
            </div>
          ) : null}

          {paso === "cual" ? (
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

              {/* Google Sheets no tiene catálogo. Pintar aquí un grupo titulado
                  «O elige del catálogo de tu cuenta» cuyo único contenido era el
                  aviso de que ese catálogo no existe ofrecía una alternativa que
                  no está: el campo de arriba es el único camino. */}
              {servicio === "google_sheets" ? null : (
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
              )}
            </div>
          ) : null}

          {paso === "verificar" && lectura ? (
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

              {pideActor ? (
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
          {indiceDelPaso > 0 ? (
            <button
              type="button"
              className="pulso-button"
              onClick={() => setPaso(pasos[indiceDelPaso - 1])}
            >
              <ArrowLeft size={14} /><span>Atrás</span>
            </button>
          ) : <span />}

          {paso === "pieza" ? (
            <button
              type="button"
              className="pulso-button is-primary"
              disabled={!puedeAvanzarDeLaPieza}
              onClick={() => setPaso("cual")}
            >
              <span>Continuar</span>
            </button>
          ) : null}

          {paso === "cual" && admiteDireccionPegada(servicio) ? (
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

          {paso === "verificar" ? (
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
    </div>
  );
}

export type { PiezaConEstado };
