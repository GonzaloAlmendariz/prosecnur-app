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

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
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
  MonitoreoActorUnit,
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
import { apiConnectionsList } from "../../../api/multiIntegrado";
import { KOBO_SERVIDOR_PUBLICO, perfilKoboActivo, servidorKoboActivo } from "./servidorKobo";
import { SelectorDeActor } from "./SelectorDeActor";
import {
  admiteDireccionPegada,
  leerDireccion,
} from "./direccionDeFuente";
import type { ServicioDeFuente } from "./direccionDeFuente";
import { guionConEstado, piezaPorLaQueSeguir, piezaSiguienteTrasConectar } from "./guionDeConexion";
import type { PapelDeFuente, PiezaConEstado } from "./guionDeConexion";
import { actorQueContradiceElNombre, contar } from "./vocabulario";
import { conflictoDeCardinalidad } from "./rosterDeActores";
import "./conectarFuente.css";

const SM_API = "https://api.surveymonkey.com/v3";
// El servidor de Kobo NO es una constante del wizard: sale del perfil de
// conexión activo. Ver servidorKobo.ts.
const KOBO_POR_DEFECTO = KOBO_SERVIDOR_PUBLICO;

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

/**
 * La dirección de una fuente ya guardada, en la forma que el panel sabe leer.
 *
 * Cambiar una conexión empieza por ver la que hay: un campo vacío obliga a
 * recordar de memoria a qué hoja apuntaba el estudio, que es justo lo que
 * nadie recuerda. Sheets acepta el identificador suelto; Kobo necesita la URL
 * completa, así que se reconstruye desde el servidor y el uid guardados.
 */
function direccionGuardadaDe(source: MonitoreoSource | null | undefined): string {
  if (!source) return "";
  if (source.kind === "google_sheets") return source.sheet_binding?.spreadsheet_id ?? "";
  if (source.kind === "kobo" && source.base_url && source.asset_uid) {
    return `${source.base_url.replace(/\/+$/, "")}/#/forms/${source.asset_uid}`;
  }
  return "";
}

function servicioDe(source: MonitoreoSource | null | undefined): ServicioDeFuente | null {
  if (!source) return null;
  if (source.kind === "google_sheets" || source.kind === "kobo" || source.kind === "surveymonkey") {
    return source.kind;
  }
  return null;
}

export function ConectarFuente({
  sources,
  familia,
  actoresSugeridos,
  papelInicial,
  fuenteAEditar,
  elenco = [],
  renderCanal,
  onCerrar,
  onStateChange,
}: {
  sources: MonitoreoSource[];
  /** Familia del perfil de monitoreo; decide el guion. */
  familia?: string;
  actoresSugeridos: string[];
  papelInicial?: PapelDeFuente;
  /**
   * La fuente que se viene a cambiar, si el panel se abrió desde su tarjeta.
   *
   * Con ella el panel deja de ser un alta: arranca en la pieza que le
   * corresponde, con su dirección delante, y al guardar actualiza esa misma
   * fuente en vez de registrar una segunda apuntando al mismo sitio.
   */
  fuenteAEditar?: MonitoreoSource | null;
  /**
   * El elenco declarado, para comprobar la cardinalidad antes de pedir nada.
   * El servidor la vuelve a comprobar y tiene la última palabra.
   */
  elenco?: MonitoreoActorUnit[];
  /**
   * El selector de canal de la encuesta, inyectado por el perfil.
   *
   * El vocabulario de canales es de acreditación y este panel lo comparten
   * todas las familias, así que el control llega como render prop en vez de
   * importar UI de un perfil concreto.
   */
  renderCanal?: (value: string, onChange: (value: string) => void) => ReactNode;
  onCerrar: () => void;
  onStateChange?: (state: MonitoreoState) => void;
}) {
  const { guion, piezas } = useMemo(() => guionConEstado(familia, sources), [familia, sources]);
  const sugerida = useMemo(() => piezaPorLaQueSeguir(piezas), [piezas]);

  // Editar manda sobre el guion: quien abrió la tarjeta de una hoja concreta ya
  // dijo qué viene a tocar, y proponerle «sigue por el barrido» sería contestar
  // otra pregunta.
  const editando = fuenteAEditar ?? null;

  const [papel, setPapel] = useState<PapelDeFuente>(() => (
    piezas.find((pieza) => pieza.papel === editando?.role)?.papel
      ?? piezas.find((pieza) => pieza.papel === papelInicial)?.papel
      ?? sugerida?.papel
      ?? piezas[0]?.papel
      ?? "universo"
  ));
  const pieza = piezas.find((item) => item.papel === papel) ?? piezas[0] ?? null;
  const pasos = pasosDeLaPieza(pieza);
  // Cambiar salta la elección de pieza: se entra por «de dónde sale», que es lo
  // que se viene a corregir.
  const primerPaso = editando ? "cual" : pasos[0];

  const [paso, setPaso] = useState<Paso>(primerPaso);
  const [servicio, setServicio] = useState<ServicioDeFuente>(() => (
    servicioDe(editando) ?? pieza?.servicios[0] ?? "google_sheets"
  ));
  const [actor, setActor] = useState(editando?.dimensions?.actor || actoresSugeridos[0] || "");
  // El texto libre se abre solo si el actor que traemos no es ninguno del
  // roster —editar una fuente vieja con un nombre propio—; si no, estorba.
  const [actorEsLibre, setActorEsLibre] = useState(() => {
    const actual = String(editando?.dimensions?.actor ?? "").trim().toLocaleLowerCase("es-PE");
    if (!actual) return false;
    return !actoresSugeridos.some((item) => item.trim().toLocaleLowerCase("es-PE") === actual);
  });
  const [pegado, setPegado] = useState(() => direccionGuardadaDe(editando));
  // El canal de la encuesta se declara AQUÍ. Antes la fuente nacía sin canal y
  // `acreditacionSourceChannel` lo adivinaba —una de sus reglas era si el
  // nombre del actor contenía «docent» o «administr»—, y ese canal adivinado es
  // el que después heredaban todos sus recopiladores.
  const [canal, setCanal] = useState(() => (
    String((editando?.dimensions as Record<string, unknown> | undefined)?.canal ?? "")
  ));
  const [eleccion, setEleccion] = useState<Eleccion | null>(null);
  const [lectura, setLectura] = useState<Lectura | null>(null);
  const [ocupado, setOcupado] = useState<"catalogo" | "leyendo" | "guardando" | null>(null);
  const [error, setError] = useState("");
  /** Lo que se acaba de conectar, para que el salto de pieza no sea un misterio. */
  const [hecho, setHecho] = useState("");

  // Catálogos de la cuenta, cargados solo cuando el paso 2 los necesita.
  const [assetsKobo, setAssetsKobo] = useState<MonitoreoKoboAssetItem[] | null>(null);
  // A qué servidor de Kobo pertenece la cuenta conectada. Se resuelve del
  // perfil activo en vez de asumir el público: ver servidorKobo.ts.
  const [koboServidor, setKoboServidor] = useState(KOBO_POR_DEFECTO);
  const [koboPerfil, setKoboPerfil] = useState("");
  const [encuestasSm, setEncuestasSm] = useState<Array<{ id: string; title: string }> | null>(null);
  const [busqueda, setBusqueda] = useState("");

  const lecturaDeLoPegado = useMemo(
    () => (admiteDireccionPegada(servicio) ? leerDireccion(servicio, pegado) : null),
    [servicio, pegado],
  );

  // El servidor de Kobo se resuelve al entrar al paso, no solo al abrir el
  // catálogo: el placeholder de la dirección lo nombra, y anunciar el servidor
  // público a quien tiene cuenta en otro es la pista falsa que hacía pegar la
  // URL equivocada. Si la consulta falla, el público sigue siendo el respaldo.
  useEffect(() => {
    if (servicio !== "kobo") return undefined;
    let vigente = true;
    apiConnectionsList()
      .then((data) => {
        if (!vigente) return;
        setKoboServidor(servidorKoboActivo(data.connections));
        setKoboPerfil(perfilKoboActivo(data.connections));
      })
      .catch(() => undefined);
    return () => {
      vigente = false;
    };
  }, [servicio]);

  // Cambiar de pieza o de servicio invalida todo lo elegido después: dejar un
  // asset de Kobo colgando mientras la cabecera dice «Google Sheets» es cómo se
  // guardan fuentes con el servicio de una y el identificador de otra.
  //
  // Solo cuando cambian DE VERDAD, no cada vez que el efecto se ejecuta: el
  // estado inicial ya trae lo que corresponde —vacío al conectar, la dirección
  // guardada al cambiar— y limpiarlo al montar borraba la precarga. Comparar
  // contra el valor anterior y no un `primerRender` booleano porque en
  // desarrollo StrictMode monta, desmonta y vuelve a montar: con el booleano,
  // la segunda pasada ya lo encontraba en `true` y limpiaba igual.
  const ultimaEleccionDeFuente = useRef(`${servicio}|${papel}`);
  useEffect(() => {
    const actual = `${servicio}|${papel}`;
    if (ultimaEleccionDeFuente.current === actual) return;
    ultimaEleccionDeFuente.current = actual;
    setEleccion(null);
    setLectura(null);
    setPegado("");
    setCanal("");
    setError("");
  }, [servicio, papel]);

  // El aviso de «conectada» dura hasta que el usuario hace algo: vive un paso,
  // no un temporizador. Desaparecer solo obligaría a recordar qué decía.
  useEffect(() => {
    if (paso !== "pieza") setHecho("");
  }, [paso]);

  const ultimoPapel = useRef(papel);
  useEffect(() => {
    if (ultimoPapel.current === papel) return;
    ultimoPapel.current = papel;
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
        // El servidor se resuelve acá y no al montar: es el dato que decide a
        // dónde va el token, y pedirlo tarde es preferible a pedirlo con una
        // conexión que el usuario acaba de cambiar en otra pestaña.
        const conexiones = await apiConnectionsList().catch(() => null);
        const servidor = servidorKoboActivo(conexiones?.connections);
        const perfil = perfilKoboActivo(conexiones?.connections);
        setKoboServidor(servidor);
        setKoboPerfil(perfil);
        const data = await apiMonitoreoKoboAssets(servidor, 100, { profile_id: perfil });
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
    // Cambiar una fuente es una tarea de una pieza: encadenar a la siguiente
    // convertiría «corregir la hoja del barrido» en un recorrido por todo el
    // guion que nadie pidió.
    if (editando) {
      onCerrar();
      return;
    }
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
          // Con `id` el backend actualiza esa fuente; sin él registra una nueva.
          // Es la diferencia entre corregir la hoja del estudio y acabar con dos
          // fuentes apuntando al mismo sitio, que es lo que pasaba cuando el
          // único camino para cambiarla era volver a darla de alta.
          ...(editando ? { id: editando.id } : {}),
          kind: "google_sheets",
          // Al cambiar se respeta el nombre con el que el estudio ya la conoce:
          // reetiquetarla por corregir su dirección rompería el reconocimiento.
          label: editando?.label
            || (pieza.papel === "barrido" ? "Barrido telefónico" : `Base ${actor}`.trim()),
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
          ...(editando ? { id: editando.id } : {}),
          kind: eleccion.servicio,
          label: eleccion.nombre,
          enabled: true,
          role: "respuestas",
          ...(eleccion.servicio === "kobo"
            ? { asset_uid: eleccion.assetUid, base_url: eleccion.baseUrl }
            : { survey_id: eleccion.surveyId, base_url: SM_API }),
          // `canal` es la declaración del usuario, no una deducción. Cuando el
          // perfil no ofrece el control (familias sin canal) se omite el campo
          // en vez de guardar una cadena vacía que se leería como «declarado
          // sin canal».
          dimensions: {
            actor,
            segmento: actor,
            survey_title: eleccion.nombre,
            ...(canal.trim() ? { canal: canal.trim() } : {}),
          },
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

  /**
   * Si esta combinación de pieza y actor rompe la cardinalidad del estudio.
   *
   * Espejo de `monitoreo_actor_roster_conflict` en el backend, que es quien
   * corta de verdad con un 409. Aquí solo sirve para decirlo a tiempo.
   */
  const conflicto = useMemo(() => (
    pieza
      ? conflictoDeCardinalidad({
        sources,
        elenco,
        papel: pieza.papel,
        actor,
        idExcluido: editando?.id ?? "",
      })
      : null
  ), [pieza, sources, elenco, actor, editando]);
  const puedeAvanzarDeLaPieza = Boolean(pieza) && (!pideActor || Boolean(actor.trim())) && !conflicto;

  // El actor se declara al elegir la pieza, pero es al verificar —con el nombre
  // real de la encuesta delante— cuando se ve si estaba bien. Antes había que
  // volver atrás para corregirlo, y el pie afirmaba «respuestas de
  // Administrativos» sobre una encuesta llamada «…Estudiantes» sin decir nada.
  const nombreDeLaFuente = lectura
    ? (lectura.tipo === "sheets" ? lectura.inspeccion.title ?? "" : lectura.nombre)
    : "";
  const actorQueSugiereElNombre = actorQueContradiceElNombre(nombreDeLaFuente, actor, actoresSugeridos);

  /**
   * El catálogo entero de la cuenta, sin tope: la lista es dueña de su scroll
   * y tiene alto para ejercerlo. Recortarla a las más recientes escondía
   * encuestas detrás de una búsqueda que hay que adivinar; con 76 nombres
   * delante, bajar es más barato que recordar cómo se llamaba.
   */
  const catalogoCompleto = useMemo(() => (
    servicio === "kobo"
      ? (assetsKobo ?? []).map((asset) => ({
        id: asset.uid,
        nombre: asset.name,
        extra: asset.deployment_active ? "Desplegado" : "Inactivo",
      }))
      : (encuestasSm ?? []).map((survey) => ({ id: survey.id, nombre: survey.title, extra: "" }))
  ), [servicio, assetsKobo, encuestasSm]);

  const catalogoVisible = useMemo(() => {
    const termino = busqueda.trim().toLocaleLowerCase("es-PE");
    if (!termino) return catalogoCompleto;
    return catalogoCompleto.filter((item) => item.nombre.toLocaleLowerCase("es-PE").includes(termino));
  }, [catalogoCompleto, busqueda]);

  const indiceDelPaso = Math.max(0, pasos.indexOf(paso));

  return (
    <div
      className="fuentes-conectar"
      role="dialog"
      aria-modal="true"
      aria-label={editando ? "Cambiar fuente" : "Conectar fuente"}
    >
      {/* Columna del guion: qué necesita ESTE modo, en su orden y con su estado.
        * Es lo que convierte el panel en una guía en vez de un formulario: quien
        * lo abre ve de un vistazo qué le falta al estudio y por dónde va. */}
      <aside className="fuentes-conectar-guion">
        <header>
          <i aria-hidden="true"><PlugZap size={17} /></i>
          <span>{editando ? "Cambiar fuente" : "Conectar fuente"}</span>
          <strong>{editando ? editando.label || guion.modo : guion.modo}</strong>
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
                  <SelectorDeActor
                    valor={actor}
                    sugeridos={actoresSugeridos}
                    yaConectados={pieza.actores}
                    onElegir={(elegido) => {
                      setActorEsLibre(false);
                      setActor(elegido);
                    }}
                    textoLibreAbierto={actorEsLibre}
                    onAbrirTextoLibre={() => setActorEsLibre(true)}
                  />
                  {actorEsLibre ? (
                    <input
                      value={actor}
                      onChange={(event) => setActor(event.currentTarget.value)}
                      placeholder="Nombre del actor"
                      aria-label="Nombre del actor"
                      autoFocus
                      // Llega con el actor que estaba elegido; si abriste
                      // «Otro» es porque no es ese, así que escribir lo
                      // reemplaza en vez de obligarte a borrarlo.
                      onFocus={(event) => event.currentTarget.select()}
                    />
                  ) : null}
                </fieldset>
              ) : null}

              {/* El canal solo se pregunta en las respuestas: un padrón no se
                * «aplica» por ningún medio y una hoja de barrido es telefónica
                * por definición. */}
              {pieza.papel === "respuestas" && renderCanal ? (
                <fieldset className="fuentes-conectar-grupo">
                  <legend>Cómo se aplica</legend>
                  {renderCanal(canal, setCanal)}
                  {/* La frase decía «Es el canal base de la encuesta: …», que es
                    * repetir el rótulo que está justo encima. Queda lo único que
                    * el rótulo no dice y no se ve en ningún otro sitio. */}
                  <p className="fuentes-conectar-pista is-neutra">
                    Los recopiladores lo heredan; cada uno puede declarar su excepción.
                  </p>
                </fieldset>
              ) : null}

              {/* La cardinalidad se dice antes de pedir la dirección. Enterarse
                * de que el padrón ya existía después de pegar la URL y esperar la
                * lectura es el ciclo que este panel vino a matar. */}
              {conflicto ? (
                <p className="fuentes-conectar-pista is-alerta">
                  <AlertTriangle size={13} /> {conflicto.message}
                </p>
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
                      ? `${koboServidor}/#/forms/…`
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
                {(servicio === "kobo" ? assetsKobo : encuestasSm) === null ? (
                  <button
                    type="button"
                    className="pulso-button"
                    onClick={() => { void cargarCatalogo(); }}
                    disabled={ocupado === "catalogo"}
                  >
                    {ocupado === "catalogo" ? <Loader2 size={14} className="pulso-spin" /> : <Search size={14} />}
                    <span>Ver mis {servicio === "kobo" ? "formularios" : "encuestas"}</span>
                  </button>
                ) : (
                  <>
                    <input
                      value={busqueda}
                      onChange={(event) => setBusqueda(event.currentTarget.value)}
                      placeholder={`Buscar entre ${catalogoCompleto.length}`}
                    />
                    <div className="fuentes-conectar-catalogo" data-qa-geometry-capacity="owned">
                      {catalogoVisible.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              void verificar(servicio === "kobo"
                                ? { servicio: "kobo", baseUrl: koboServidor, assetUid: item.id, nombre: item.nombre }
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
                  <SelectorDeActor
                    valor={actor}
                    sugeridos={actoresSugeridos}
                    yaConectados={pieza.actores}
                    onElegir={(elegido) => {
                      setActorEsLibre(false);
                      setActor(elegido);
                    }}
                    textoLibreAbierto={actorEsLibre}
                    onAbrirTextoLibre={() => setActorEsLibre(true)}
                  />
                  {actorEsLibre ? (
                    <input
                      value={actor}
                      onChange={(event) => setActor(event.currentTarget.value)}
                      placeholder="Nombre del actor"
                      aria-label="Nombre del actor"
                      autoFocus
                      onFocus={(event) => event.currentTarget.select()}
                    />
                  ) : null}
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
