/**
 * La mesa de Hallazgos (plan de fidelidad, rebanada V3; prototipo
 * `validacion-hallazgos*`): la cabecera con sus cifras y "Volver a auditar",
 * los avisos, y tres columnas, Cola, el hallazgo abierto y la Decisión, más el
 * panel del caso (`panel=caso&foco=<id_caso>`).
 *
 * El hallazgo abierto vive en la dirección (`foco=<id de regla>`). Mientras el
 * caso está abierto el foco es del caso, y la pestaña recuerda el hallazgo
 * para volver a él al cerrarlo. El enlace viejo al detalle de una regla en
 * Hallazgos (`panel=regla&foco=<id>`) abre ese hallazgo, sin panel.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FileCheck2, ListChecks, Play, RefreshCw } from "../../../vendor/lucide-react";
import { Alert } from "../../../components/Alert";
import { FranjaDeTrabajo } from "../../../components/procesamiento/FranjaDeTrabajo";
import { MesaDePestana } from "../../../components/procesamiento/MesaDePestana";
import { PanelDeMesa } from "../../../components/procesamiento/PanelDeMesa";
import { PulsoButton } from "../../../components/PulsoButton";
import { ErrorBlock } from "../../../components/States";
import { causaDelError, identificadorDelError } from "../../../components/errorPresentation";
import { EstadoVacio } from "../../../components/EstadoVacio";
import { searchConPanel, usePanelDireccionable } from "../../../lib/navegacion/paneles";
import { useDireccion } from "../../../lib/navegacion/useDireccion";
import { normalizarSeguimiento, type ClaseDeHallazgo } from "../../../api/validacionAuditoria";
import { PANEL_CASO_VALIDACION, PANEL_OPERATIVO_VALIDACION, PANEL_REGLA_VALIDACION } from "../panelesValidacion";
import { searchDePestana, useSeleccionDeValidacion, usePestanaValidacion } from "../pestanaDireccionable";
import CabeceraDeTransicion from "../pestanas/CabeceraDeTransicion";
import { buildChoiceOptions, describirDecisionesPreservadas, getDecisionReadiness, humanizeAction, isSelectMultipleItem } from "../limpieza/modeloLimpieza";
import { CabeceraDelHallazgo } from "./CabeceraDelHallazgo";
import { CentroDelHallazgo, type ModoDelCentro } from "./CentroDelHallazgo";
import { Cola } from "./Cola";
import { Decision, type AlcanceDeDecision, type AvisosDeDecision } from "./Decision";
import { DecisionVacia, EsqueletoDeHallazgos, RevisionPorFamilia } from "./EstadosDeHallazgos";
import { totalDeCasos } from "./detalleCompleto";
import { PanelCaso } from "./PanelCaso";
import { notaDelResultadoAnterior } from "./modeloFranjaDeAuditoria";
import { PautasDeRevision } from "./PautasDeRevision";
import { AvisoFiltroFueraDeLista } from "./AvisoFiltroFueraDeLista";
import { filtroFueraDeLista } from "./filtroFueraDeLista";
import { esReglaDeSeccion } from "./seccionDelSalto";
import { pautasDelHallazgo, situacionDeOpcion, subtipoDeLosCasos } from "./pautasDelHallazgo";
import { useFranjaDeAuditoria } from "./useFranjaDeAuditoria";
import { DistribucionDelHallazgo } from "./vistas/DistribucionDelHallazgo";
import { HallazgoCasiIguales } from "./vistas/HallazgoCasiIguales";
import { SentidosDelSalto } from "./vistas/SentidosDelSalto";
import { TablaDeCasos } from "./vistas/TablaDeCasos";
import { useDistribucion } from "./useDistribucion";
import { useHallazgos } from "./useHallazgos";
import {
  avisoDeCasosNuevos,
  cabeceraDeHallazgos,
  cifraDelHallazgo,
  causaEnPantalla,
  conteo,
  conservadoDelPar,
  faseDeHallazgos,
  fechaCorta,
  lineaDeAlcance,
  lineaDeAlcanceDePares,
  lineaDeCasosQueYaNoMarca,
  lineaDeEfecto,
  lineaNoAplicable,
  lineasDeGruposRepetidos,
  opcionesDeTratamiento,
  paresCasiIguales,
  preguntaRevisada,
  rotulosDeAlcance,
  searchConCaso,
  searchSinCaso,
  searchSinPanelDeRegla,
  sentidosDelSalto,
  siguientePorDecidir,
  tablaDeCasos,
  vistaDelHallazgo,
  type CualSeConserva,
  type LineaDeEfecto,
  type OpcionDeTratamiento,
  type PestanaDeCola,
} from "./modeloHallazgos";

/** Carga › Respuestas: todavía no abre un caso por su dirección (pedido de Carga). */
const RESPUESTAS = "/carga?pestana=respuestas";

export function PestanaHallazgosMesa() {
  const seleccion = useSeleccionDeValidacion();
  const direccion = useDireccion();
  const location = useLocation();
  const navigate = useNavigate();
  const { irAPestana } = usePestanaValidacion();
  const panelCaso = usePanelDireccionable(PANEL_CASO_VALIDACION);

  // El hallazgo que se recuerda mientras el caso usa el foco.
  const [recordado, setRecordado] = useState<string | null>(null);
  const casoAbierto = panelCaso.abierto ? direccion?.foco ?? null : null;
  const focoDelHallazgo = panelCaso.abierto ? recordado : seleccion.foco;

  // Enlace viejo: `panel=regla&foco=<id>` en Hallazgos abre el hallazgo de esa regla.
  const delAlias = direccion?.panel === PANEL_REGLA_VALIDACION.id;
  useEffect(() => {
    if (delAlias) navigate({ pathname: location.pathname, search: searchSinPanelDeRegla(location.search) }, { replace: true });
  }, [delAlias, location.pathname, location.search, navigate]);

  const elegirHallazgo = useCallback((id: string) => seleccion.elegir({ foco: id }), [seleccion]);
  const h = useHallazgos({ foco: delAlias ? direccion?.foco ?? null : focoDelHallazgo, onElegir: elegirHallazgo });
  const avanceDeAuditoria = useFranjaDeAuditoria(h.auditando, h.auditoriaInicio, h.auditoriaAvance);
  const elegidoId = h.elegido?.id ?? null;
  useEffect(() => {
    if (elegidoId && !panelCaso.abierto) setRecordado(elegidoId);
  }, [elegidoId, panelCaso.abierto]);

  // Lo que solo es de la vista: la pestaña de la cola, el filtro por clase y qué se ve del hallazgo.
  const [pestanaCola, setPestanaCola] = useState<PestanaDeCola>("por-decidir");
  const [clase, setClase] = useState<ClaseDeHallazgo | null>(null);
  const [modo, setModo] = useState<ModoDelCentro | null>(null);
  const [casosDelPanel, setCasosDelPanel] = useState<string[] | null>(null);
  // Casi iguales: el criterio y la respuesta elegida a mano en cada par.
  const [criterio, setCriterio] = useState<CualSeConserva | "todas">("mas-completa");
  const [aMano, setAMano] = useState<Record<string, string>>({});
  const [paresTodos, setParesTodos] = useState(true);

  // Un hallazgo decidido antes de hoy no está en "Por decidir": se abre en "Decididos".
  useEffect(() => {
    if (h.elegido && !h.elegido.pendiente && !h.elegido.decididoHoy) setPestanaCola("decididos");
  }, [h.elegido]);

  const data = h.data;
  const fase = h.lectura.fase === "error" ? { tipo: "error" as const, mensaje: h.lectura.mensaje } : faseDeHallazgos(data, h.cifras);
  const catalogoCompleto = h.catalogo ? h.catalogo.completo : h.catalogo;
  const cabecera = cabeceraDeHallazgos({
    data,
    cifras: h.cifras,
    elementos: h.elementos,
    catalogo: h.catalogo ? h.catalogo.completo : null,
    auditando: h.auditando,
  });

  // --- El hallazgo abierto ---------------------------------------------------
  const vista = h.elegido
    ? vistaDelHallazgo({ narrativa: h.elegido.narrativa, item: h.item, regla: h.reglaDelCatalogo, limites: h.limites, drill: h.drill })
    : "general";
  const pregunta = preguntaRevisada(h.reglaDelCatalogo, h.drill, h.item);
  const distribuible = !!pregunta?.numerica && vista !== "casi-iguales";
  const modoEfectivo: ModoDelCentro = !distribuible ? "casos" : modo ?? (vista === "rango" ? "distribucion" : "casos");
  useEffect(() => {
    setModo(null);
    setCasosDelPanel(null);
    setAMano({});
    setCriterio("mas-completa");
    setParesTodos(true);
  }, [elegidoId]);
  const distribucion = useDistribucion(pregunta?.variable ?? null, h.baseNombre, distribuible && modoEfectivo === "distribucion");
  const tabla = useMemo(() => tablaDeCasos(h.drill, h.item), [h.drill, h.item]);
  // Ítem 41: la pregunta filtro con un código fuera de su lista. Ítem 42: el salto de una sección.
  const filtroFuera = useMemo(() => filtroFueraDeLista(h.drill), [h.drill]);
  const deSeccion = useMemo(() => esReglaDeSeccion(tabla.filas.map((f) => f.esperado)), [tabla.filas]);
  const pares = useMemo(() => (vista === "casi-iguales" ? paresCasiIguales(h.drill) : []), [h.drill, vista]);
  const etiquetas = useMemo(() => {
    const e: Record<string, string> = {};
    for (const [k, v] of Object.entries(h.drill?.regla.variable_roles?.labels ?? {})) if (v) e[k] = v;
    return e;
  }, [h.drill]);
  const tono = h.elegido?.clase === "caso_a_revisar" ? "revisar" : "inconsistencia";
  const decisionLista = h.elegido?.decision ?? null;
  const seguimientoLista = decisionLista ? normalizarSeguimiento(decisionLista) : null;

  // Casi iguales: el criterio de la decisión guardada y lo que se conserva en cada par.
  // Solo al abrir el hallazgo o cambiar su decisión guardada.
  const decisionGuardada = h.decision;
  useEffect(() => {
    if (vista !== "casi-iguales" || !decisionGuardada) return;
    if (decisionGuardada.action_type === "ignore_rule") setCriterio("todas");
    if (decisionGuardada.action_type === "exclude_cases") {
      const excluidos = new Set(decisionGuardada.target_case_ids ?? []);
      const elegidos: Record<string, string> = {};
      for (const p of pares) {
        const quedan = p.miembros.filter((m) => !excluidos.has(m.id));
        if (quedan.length === 1) elegidos[p.clave] = quedan[0].id;
      }
      setAMano(elegidos);
    }
  }, [decisionGuardada, pares, vista]);
  const conservados = useMemo(() => {
    const out: Record<string, string | null> = {};
    for (const p of pares) out[p.clave] = aMano[p.clave] ?? (criterio === "todas" ? null : conservadoDelPar(p, criterio));
    return out;
  }, [aMano, criterio, pares]);
  const setForm = h.setForm;
  useEffect(() => {
    if (vista !== "casi-iguales" || !elegidoId) return;
    if (criterio === "todas") {
      setForm((f) => ({ ...f, action_type: "ignore_rule", use_all_cases: true, scope_mode: "all", target_case_ids: [] }));
      return;
    }
    const enAlcance = paresTodos ? pares : pares.filter((p) => aMano[p.clave]);
    const excluidos = new Set<string>();
    for (const p of enAlcance) {
      const queda = conservados[p.clave];
      if (queda) for (const m of p.miembros) if (m.id !== queda) excluidos.add(m.id);
    }
    setForm((f) => ({ ...f, action_type: "exclude_cases", use_all_cases: false, scope_mode: "selected", target_case_ids: [...excluidos] }));
  }, [aMano, conservados, criterio, elegidoId, pares, paresTodos, setForm, vista]);

  // --- Las pautas de revisión (ítem 27) ------------------------------------------
  const pautas = useMemo(() => (h.elegido ? pautasDelHallazgo({
    vista,
    familia: h.reglaDelCatalogo?.familia ?? h.elegido.narrativa.familia ?? null,
    direccion: h.reglaDelCatalogo?.direccion ?? null,
    subtipo: subtipoDeLosCasos(tabla.filas.map((f) => f.esperado?.subtipo)),
    tipoRegla: h.item?.tipo_regla ?? null,
    semillaOrigen: h.reglaDelCatalogo?.semilla_origen ?? null,
    filtroFueraDeLista: filtroFuera,
  }) : null), [filtroFuera, h.elegido, h.item?.tipo_regla, h.reglaDelCatalogo, tabla.filas, vista]);

  // --- La decisión -------------------------------------------------------------
  const opciones = useMemo((): OpcionDeTratamiento[] => {
    if (!h.elegido) return [];
    const base = opcionesDeTratamiento({
      vista,
      etiquetaPregunta: pregunta?.etiqueta ?? null,
      prevista: h.prevista,
      seleccionMultiple: isSelectMultipleItem(h.item),
      fueraDeLista: h.item?.tipo_regla === "catalog",
      respuestaVacia: (h.reglaDelCatalogo?.familia ?? h.elegido.narrativa.familia) === "obligatoria" || h.item?.tipo_regla === "required",
      especial: null,
      pares,
      seccion: deSeccion,
    });
    // Una decisión guardada con una acción que la vista no ofrece se ve igual, con su nombre.
    const accion = h.form.action_type;
    if (vista !== "casi-iguales" && !base.some((o) => o.accion === accion)) {
      base.push({ clave: `guardada-${accion}`, accion, titulo: humanizeAction(accion), detalle: "La acción de la decisión guardada.", prevista: h.prevista === accion });
    }
    return base.map((o) => {
      const situacion = situacionDeOpcion(pautas, o);
      return situacion ? { ...o, situacion } : o;
    });
  }, [deSeccion, h.elegido, h.form.action_type, h.item, h.prevista, h.reglaDelCatalogo?.familia, pares, pautas, pregunta?.etiqueta, vista]);
  const opcionElegida = vista === "casi-iguales"
    ? (criterio === "todas" ? "todas" : criterio)
    : opciones.find((o) => o.accion === h.form.action_type)?.clave ?? null;
  const elegirOpcion = (o: OpcionDeTratamiento) => {
    if (vista === "casi-iguales") {
      setCriterio(o.conserva ?? "todas");
      return;
    }
    h.setForm((f) => {
      const ignorar = o.accion === "ignore_rule";
      const conPregunta = ["replace_value", "set_value", "recode_map", "nullify_fields", "normalize_value", "impute_value", "complete_select_multiple_hierarchy", "adjust_select_multiple"].includes(o.accion);
      return {
        ...f,
        action_type: o.accion,
        use_all_cases: ignorar ? true : f.use_all_cases,
        scope_mode: ignorar ? "all" : f.scope_mode,
        target_variable: conPregunta ? f.target_variable || pregunta?.variable || h.variables[0] || "" : "",
      };
    });
  };

  const marcados = useMemo(() => new Set(h.form.target_case_ids), [h.form.target_case_ids]);
  // Los casos que la regla marca (`n_casos_total` del detalle), no los que trae una página.
  const nCasos = vista === "casi-iguales" ? pares.length : totalDeCasos(h.drill) ?? (tabla.filas.length || h.elegido?.n || 0);
  const nMarcados = vista === "casi-iguales" ? pares.filter((p) => aMano[p.clave]).length : tabla.filas.filter((f) => f.id && marcados.has(f.id)).length;
  const rotulos = rotulosDeAlcance(nCasos, nMarcados, vista);
  const efectoListo = h.efecto.fase === "listo" ? h.efecto.efecto : h.efecto.fase === "midiendo" ? h.efecto.anterior : null;
  const alcanceDeLaRegla = efectoListo?.alcance
    ?? seguimientoLista?.alcance
    ?? (h.reglaDelCatalogo?.tabla && h.reglaDelCatalogo.tabla !== "principal" ? "encuestado" : null);
  const todosElegido = vista === "casi-iguales" ? paresTodos : h.form.use_all_cases;
  const alcance: AlcanceDeDecision = {
    ...rotulos,
    todosElegido,
    bloqueado: h.form.action_type === "ignore_rule",
    onCambiar: (todos) => {
      if (vista === "casi-iguales") {
        setParesTodos(todos);
        return;
      }
      h.setForm((f) => ({ ...f, use_all_cases: todos, scope_mode: todos ? "all" : "selected" }));
    },
    linea: vista === "casi-iguales" ? lineaDeAlcanceDePares({
      conservar: criterio !== "todas",
      nExcluidas: h.form.target_case_ids.length,
      nPares: paresTodos ? pares.length : pares.filter((p) => aMano[p.clave]).length,
      sinResolver: (paresTodos ? pares : pares.filter((p) => aMano[p.clave])).filter((p) => !conservados[p.clave]).length,
    }) : lineaDeAlcance({
      accion: h.form.action_type,
      todos: todosElegido,
      n: nCasos,
      marcados: nMarcados,
      alcance: alcanceDeLaRegla,
      unidad: h.elegido?.unidad ?? "casos",
    }),
  };
  const marcar = (id: string) => h.setForm((f) => {
    const siguientes = f.target_case_ids.includes(id) ? f.target_case_ids.filter((x) => x !== id) : [...f.target_case_ids, id];
    return { ...f, target_case_ids: siguientes, use_all_cases: false, scope_mode: "selected" };
  });
  const marcarTodos = (marcar: boolean) => h.setForm((f) => ({
    ...f,
    target_case_ids: marcar ? tabla.filas.map((x) => x.id).filter((x): x is string => x !== null) : [],
    use_all_cases: marcar ? f.use_all_cases : true,
    scope_mode: marcar ? f.scope_mode : "all",
  }));

  const readiness = getDecisionReadiness(h.form);
  const causaNoGuardar = readiness.ready ? null : causaEnPantalla(readiness.issues[0] ?? "", rotulos.todos);
  const etiquetaDeLaPregunta = h.form.target_variable ? etiquetas[h.form.target_variable] ?? h.form.target_variable : pregunta?.etiqueta ?? null;
  let efecto: LineaDeEfecto;
  let efectoOcupado = false;
  if (h.efecto.fase === "listo") {
    efecto = lineaDeEfecto(h.efecto.efecto, { etiquetaPregunta: etiquetaDeLaPregunta, valorAsignado: h.form.set_value || null });
  } else if (h.efecto.fase === "midiendo") {
    efectoOcupado = true;
    efecto = h.efecto.anterior
      ? lineaDeEfecto(h.efecto.anterior, { etiquetaPregunta: etiquetaDeLaPregunta, valorAsignado: h.form.set_value || null })
      : { texto: "Midiendo el efecto de la decisión." };
  } else if (h.efecto.fase === "incompleto") {
    efecto = { texto: causaEnPantalla(h.efecto.causa, rotulos.todos) };
  } else if (h.efecto.fase === "error") {
    efecto = { texto: `No se pudo medir el efecto: ${h.efecto.mensaje}` };
  } else {
    efecto = { texto: "" };
  }
  const avisos: AvisosDeDecision = {
    decidida: decisionLista && h.decision?.id === decisionLista.id
      ? `Decidida el ${fechaCorta(decisionLista.updated_at) ?? "día de su registro"}${decisionLista.rationale ? `: ${decisionLista.rationale}` : "."}`
      : null,
    noAplicable: lineaNoAplicable(decisionLista),
    casosNuevos: avisoDeCasosNuevos(seguimientoLista),
    yaNoMarca: lineaDeCasosQueYaNoMarca(seguimientoLista),
  };
  const hayOtro = !!siguientePorDecidir(h.elementos, elegidoId);
  const choiceOptions = useMemo(() => buildChoiceOptions(h.drill, h.form.target_variable), [h.drill, h.form.target_variable]);

  // --- Navegación ------------------------------------------------------------
  const abrirCaso = (id: string, lista?: string[]) => {
    setCasosDelPanel(lista ?? null);
    navigate({ pathname: location.pathname, search: searchConCaso(location.search, id) }, { replace: true });
  };
  const cerrarCaso = () => navigate({ pathname: location.pathname, search: searchSinCaso(location.search, recordado ?? elegidoId) }, { replace: true });
  const irACaso = (id: string) => navigate({ pathname: location.pathname, search: searchConCaso(location.search, id) }, { replace: true });
  const verRegla = () => irAPestana("reglas", undefined, h.reglaDelCatalogo ? { familia: h.reglaDelCatalogo.familia, foco: h.reglaDelCatalogo.id } : {});
  const revisarControles = () => navigate({
    pathname: location.pathname,
    search: searchConPanel(searchDePestana(location.search, "reglas"), PANEL_OPERATIVO_VALIDACION),
  });
  const casosDelHallazgo = useMemo(() => tabla.filas.map((f) => f.id).filter((x): x is string => x !== null), [tabla.filas]);
  const pendientes = useMemo(() => new Map(h.elementos.map((e) => [e.id, e.pendiente])), [h.elementos]);

  // --- Cabecera, avisos y franja ---------------------------------------------
  const sinAuditar = fase.tipo === "sin-auditar";
  const causaAuditar = h.controlesSinAplicar
    ? "Los controles del operativo tienen cambios sin aplicar."
    : fase.tipo === "sin-plan"
      ? "El plan del formulario todavía no se leyó."
      : undefined;
  const cabeceraNodo = (
    <CabeceraDeTransicion
      pestana="hallazgos"
      estado={cabecera.estado}
      cifras={cabecera.cifras}
      pendientes={cabecera.pendientes}
      acciones={(
        <PulsoButton
          variant="secondary"
          disabled={fase.tipo === "cargando" || fase.tipo === "error" || h.auditando || !!causaAuditar}
          title={causaAuditar}
          onClick={() => void h.auditar()}
        >
          {sinAuditar ? <Play size={14} aria-hidden="true" /> : <RefreshCw size={14} aria-hidden="true" />}
          {sinAuditar ? "Auditar" : "Volver a auditar"}
        </PulsoButton>
      )}
    />
  );
  const preservadas = describirDecisionesPreservadas(data?.decisiones_preservadas);
  const grupos = lineasDeGruposRepetidos(h.cifras);
  const listaParaCerrar = !!data?.summary?.ready_to_finalize && fase.tipo === "con-hallazgos";
  const avisosDeLaMesa = h.error || h.aviso || h.controlesSinAplicar || preservadas || grupos.length || listaParaCerrar ? (
    <div className="pulso-hz-franja-avisos">
      {h.error ? <ErrorBlock label="No se pudo completar la acción" detail={h.error} /> : null}
      {h.aviso ? <Alert kind="info">{h.aviso}</Alert> : null}
      {listaParaCerrar ? (
        <Alert kind="info" acciones={<PulsoButton variant="secondary" size="sm" onClick={() => irAPestana("cierre")}>Ir a Cierre</PulsoButton>}>
          Las decisiones están listas: la base se puede cerrar.
        </Alert>
      ) : null}
      {h.controlesSinAplicar ? (
        <Alert kind="warn" acciones={<PulsoButton variant="link" size="sm" onClick={revisarControles}>Revisar los controles</PulsoButton>}>
          Los controles del operativo tienen cambios sin aplicar: no se puede auditar hasta aplicarlos en Reglas.
        </Alert>
      ) : null}
      {preservadas ? <Alert kind={preservadas.tone === "warn" ? "warn" : "info"}>{preservadas.texto}</Alert> : null}
      {grupos.map((g) => <Alert key={g} kind="info">{g}.</Alert>)}
    </div>
  ) : undefined;
  const franja = h.auditando ? (
    <FranjaDeTrabajo
      titulo="Auditando la base"
      detalle={avanceDeAuditoria.detalle}
      porcentaje={avanceDeAuditoria.porcentaje}
      nota={fase.tipo === "con-hallazgos" ? notaDelResultadoAnterior(fechaCorta(h.catalogo?.completo.auditada_en ?? null)) : null}
      onCancelar={() => void h.cancelarAuditoria()}
    />
  ) : undefined;

  // --- Estados sin hallazgo abierto ------------------------------------------
  if (fase.tipo === "cargando") {
    return (
      <MesaDePestana grupo="validacion/hallazgos" columnas={3} cabecera={cabeceraNodo}>
        <EsqueletoDeHallazgos />
      </MesaDePestana>
    );
  }
  if (fase.tipo === "error") {
    return (
      <MesaDePestana grupo="validacion/hallazgos" columnas={3} cabecera={cabeceraNodo}>
        <div className="pulso-hz-error pulso-hz-error--mesa">
          <ErrorBlock
            label="No se pudo leer la cola de hallazgos"
            causa={causaDelError(fase.mensaje)}
            queda="Las decisiones ya guardadas no cambiaron."
            identificador={identificadorDelError(fase.mensaje)}
            acciones={(
              <PulsoButton variant="primary" size="lg" onClick={() => void h.recargar()}>
                <RefreshCw size={14} aria-hidden="true" />
                Reintentar
              </PulsoButton>
            )}
          />
        </div>
      </MesaDePestana>
    );
  }
  if (fase.tipo === "sin-plan") {
    return (
      <MesaDePestana grupo="validacion/hallazgos" columnas={3} cabecera={cabeceraNodo} avisos={avisosDeLaMesa}>
        <PanelDeMesa zona="cola" titulo="Cola" conteo={0}>
          <div className="pulso-hz-vacio">
            <EstadoVacio
              tamano="normal"
              icono={<ListChecks size={20} />}
              titulo="Sin plan de reglas"
              descripcion="La auditoría corre el plan de reglas del formulario, que se lee en Reglas."
              accion={<PulsoButton variant="primary" size="lg" onClick={() => irAPestana("reglas")}>Ir a Reglas</PulsoButton>}
            />
          </div>
        </PanelDeMesa>
        <RevisionPorFamilia catalogo={catalogoCompleto} auditada={false} onVerReglas={() => irAPestana("reglas")} />
        <DecisionVacia titulo="Sin hallazgo elegido" descripcion="Al auditar, elige un hallazgo de la cola para decidir." />
      </MesaDePestana>
    );
  }
  if (fase.tipo === "sin-auditar" || fase.tipo === "sin-hallazgos" || fase.tipo === "sin-reglas-evaluadas") {
    const auditada = fase.tipo !== "sin-auditar";
    const nReglas = h.cifras?.n_reglas_evaluadas ?? h.catalogo?.completo.n_activas ?? null;
    const nCasosAuditados = h.cifras?.n_casos_evaluados ?? null;
    const fechaAuditoria = fechaCorta(h.catalogo?.completo.auditada_en ?? null);
    const reglasTexto = nReglas !== null ? conteo(nReglas, "regla", "reglas") : null;
    const descripcionCola = auditada
      ? fase.tipo === "sin-reglas-evaluadas"
        ? "La auditoría no evaluó ninguna regla: revisa en Reglas las que quedaron sin evaluar."
        : `${nCasosAuditados === 1 ? "Se revisó" : "Se revisaron"} ${nCasosAuditados !== null ? conteo(nCasosAuditados, "caso", "casos") : "los casos"}${reglasTexto ? ` con ${reglasTexto}` : ""}${fechaAuditoria ? ` el ${fechaAuditoria}` : ""}.`
      : `La cola aparece al auditar${reglasTexto ? `: ${reglasTexto} sobre los casos de la base` : ""}.`;
    return (
      <MesaDePestana grupo="validacion/hallazgos" columnas={3} cabecera={cabeceraNodo} avisos={avisosDeLaMesa} franja={franja}>
        <PanelDeMesa zona="cola" titulo="Cola" conteo={0}>
          <div className="pulso-hz-vacio">
            <EstadoVacio
              tamano="normal"
              icono={<ListChecks size={20} />}
              titulo={auditada ? (fase.tipo === "sin-reglas-evaluadas" ? "No hay reglas evaluadas" : "Ninguna regla encontró casos") : "La base no se ha auditado"}
              descripcion={descripcionCola}
              accion={!auditada ? (
                <PulsoButton variant="primary" size="lg" disabled={h.auditando || !!causaAuditar} title={causaAuditar} onClick={() => void h.auditar()}>
                  <Play size={14} aria-hidden="true" />
                  Auditar
                </PulsoButton>
              ) : undefined}
            />
          </div>
        </PanelDeMesa>
        <RevisionPorFamilia
          catalogo={catalogoCompleto}
          auditada={auditada}
          aplicadas={auditada ? h.cifras?.n_reglas_evaluadas ?? null : null}
          onVerReglas={() => irAPestana("reglas")}
        />
        {auditada && fase.tipo === "sin-hallazgos" ? (
          <DecisionVacia
            titulo="No hay nada que decidir"
            descripcion="Puedes pasar a cerrar la base."
            accion={(
              <PulsoButton variant="primary" size="lg" onClick={() => irAPestana("cierre")}>
                <FileCheck2 size={14} aria-hidden="true" />
                Ir a Cierre
              </PulsoButton>
            )}
          />
        ) : (
          <DecisionVacia titulo="Sin hallazgo elegido" descripcion="Al auditar, elige un hallazgo de la cola para decidir." />
        )}
      </MesaDePestana>
    );
  }

  // --- Con hallazgos -----------------------------------------------------------
  const sinCasos = h.cifras && h.cifras.n_reglas_con_casos !== null ? Math.max(0, h.cifras.n_reglas_evaluadas - h.cifras.n_reglas_con_casos) : null;
  const elegido = h.elegido;
  const cifra = elegido ? cifraDelHallazgo(h.reglaDelCatalogo, elegido.n, elegido.unidad) : null;
  // Una sección no tiene el otro sentido ("le correspondía y está vacía"): lo cubren sus preguntas.
  const sentidos = vista === "salto" && !deSeccion ? sentidosDelSalto(h.catalogo?.completo ?? null, h.reglaDelCatalogo) : null;
  const enCola = new Set(h.elementos.map((e) => e.id));
  const estadoCentro = h.casos.fase === "error" ? "error" : h.casos.fase === "lista" ? "lista" : "cargando";

  return (
    <>
      <MesaDePestana grupo="validacion/hallazgos" columnas={3} cabecera={cabeceraNodo} avisos={avisosDeLaMesa} franja={franja}>
        <Cola
          elementos={h.elementos}
          elegido={elegidoId}
          pestana={pestanaCola}
          onPestana={setPestanaCola}
          clase={clase}
          onClase={setClase}
          onElegir={elegirHallazgo}
          sinCasos={sinCasos}
          onVerReglas={() => irAPestana("reglas")}
          ocupada={h.releyendo || h.auditando}
        />
        {elegido ? (
          <CentroDelHallazgo
            titulo={elegido.nombre}
            n={elegido.n}
            unidad={elegido.unidad}
            distribuible={distribuible}
            modo={modoEfectivo}
            onModo={setModo}
            rango={vista === "rango"}
            ocupado={h.releyendo || h.auditando}
            estado={estadoCentro}
            mensajeError={h.casos.fase === "error" ? h.casos.mensaje : undefined}
            onReintentar={h.reintentarCasos}
            onSiguiente={hayOtro ? h.omitir : undefined}
            cabecera={(
              <CabeceraDelHallazgo
                narrativa={elegido.narrativa}
                nombre={elegido.nombre}
                origen={elegido.origen}
                n={elegido.n}
                unidad={elegido.unidad}
                cifra={cifra}
                onVerRegla={verRegla}
              />
            )}
            pautas={filtroFuera.length || pautas ? (
              <>
                <AvisoFiltroFueraDeLista filtros={filtroFuera} />
                {pautas ? <PautasDeRevision pautas={pautas.revisar} /> : null}
              </>
            ) : null}
          >
            {sentidos ? <SentidosDelSalto sentidos={sentidos} enCola={enCola} onAbrir={elegirHallazgo} /> : null}
            {distribuible && modoEfectivo === "distribucion" ? (
              <DistribucionDelHallazgo lectura={distribucion} limites={h.limites} tono={tono} etiqueta={pregunta?.etiqueta ?? ""} />
            ) : null}
            {vista === "casi-iguales" ? (
              <HallazgoCasiIguales
                pares={pares}
                conservados={conservados}
                editable={criterio !== "todas"}
                onConservar={(par, id) => setAMano((m) => ({ ...m, [par.clave]: id }))}
                onAbrirCaso={abrirCaso}
              />
            ) : (
              <TablaDeCasos
                columnas={tabla.columnas}
                filas={tabla.filas}
                marcados={marcados}
                onMarcar={marcar}
                onMarcarTodos={marcarTodos}
                onAbrirCaso={(id) => abrirCaso(id)}
                tono={tono}
                marcable={h.form.action_type !== "ignore_rule"}
              />
            )}
          </CentroDelHallazgo>
        ) : null}
        {elegido && h.casos.fase === "error" ? (
          <DecisionVacia titulo="Sin casos a la vista" descripcion="Se habilita cuando carguen los casos del hallazgo." />
        ) : elegido ? (
          <Decision
            opciones={opciones}
            elegida={opcionElegida}
            onElegir={elegirOpcion}
            tituloOpciones={vista === "casi-iguales" ? "Cuál se conserva" : "Tratamiento"}
            alcance={alcance}
            form={h.form}
            setForm={h.setForm}
            variables={h.variables}
            etiquetas={etiquetas}
            choiceOptions={choiceOptions}
            numerica={!!pregunta?.numerica && (!h.form.target_variable || h.form.target_variable === pregunta.variable)}
            avisos={avisos}
            efecto={efecto}
            efectoOcupado={efectoOcupado}
            causaNoGuardar={causaNoGuardar}
            guardando={h.guardando || h.auditando}
            onGuardar={() => void h.guardar("ready")}
            onOmitir={h.omitir}
            hayOtro={hayOtro}
            decisionLista={decisionLista}
            onIncluirCasosNuevos={(d) => void h.incluirCasosNuevos(d)}
            onEliminar={(d) => void h.eliminar(d)}
            decisiones={h.decisiones}
            decisionAbierta={h.decision}
            onAbrirDecision={h.abrirDecision}
          />
        ) : (
          <DecisionVacia titulo="Sin hallazgo elegido" descripcion="Elige un hallazgo de la cola para decidir." />
        )}
      </MesaDePestana>
      <PanelCaso
        abierto={panelCaso.abierto}
        idCaso={casoAbierto}
        casos={casosDelPanel ?? casosDelHallazgo}
        pendientes={pendientes}
        baseNombre={h.baseNombre}
        onIr={irACaso}
        onCerrar={cerrarCaso}
        onVerEnRespuestas={() => navigate(RESPUESTAS)}
        onCorregida={() => void h.recargar({ silenciosa: true })}
      />
    </>
  );
}
