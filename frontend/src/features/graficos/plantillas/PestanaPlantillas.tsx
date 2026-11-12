// Pestaña Plantillas de Procesamiento > Gráficos (checklist-pestana-plantillas-2026-11-11; prototipo aprobado el
// 2026-11-11 en tmp/prototipo-plantillas). A la izquierda, el menú de plantillas y las guardadas en el proyecto; a la
// derecha, el contenido del informe por sección y pregunta, en el orden del cuestionario. Lo que se deja fuera y el
// gráfico de cada pregunta viven en `scope_rules` (modeloPlantillas.ts) y el plan sugerido los respeta al crear las
// láminas. Reemplaza al popover "Armar desde" en la base activa.

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ChevronDown, ChevronRight, ListChecks, Loader2, Plus, Trash2 } from "../../../vendor/lucide-react";
import { apiGraficosPlanSugerido, apiGraficosTemplates } from "../../../api/client";
import { apiPlannerEstado } from "../../../api/planner";
import { apiGraficosEstructuraInforme, type EstructuraDelInforme, type GraficoPorPregunta, type SeccionDelInforme } from "../../../api/graficosEstructura";
import { Alert } from "../../../components/Alert";
import { PulsoButton } from "../../../components/PulsoButton";
import { PulsoSwitch } from "../../../components/PulsoSwitch";
import { Panel } from "../../../components/Panel";
import { CifrasEnTarjeta } from "../../../components/CifrasEnTarjeta";
import { CargaDeBloque } from "../../../components/CargaDeBloque";
import { EstadoVacio } from "../../../components/EstadoVacio";
import { PulsoInput } from "../../../components/PulsoInput";
import { PulsoSelect } from "../../../components/PulsoSelect";
import { formatoConteo } from "../../../lib/formatoNumero";
import { RadioSegmentado } from "../subpestanas/RadioSegmentado";
import { useSeccion } from "../../../lib/navegacion/useDireccion";
import { useOptionalProjectShell } from "../../project/ProjectShell";
import { usePlanStore } from "../store";
import { buildGraficosConfigFromStore } from "../configSnapshot";
import { usePptStyleProfiles } from "../usePptStyleProfiles";
import { useGraficosRegistry } from "../useGraficosRegistry";
import { useVariables } from "../useVariables";
import { conBaseFijada } from "../fijarBase";
import { identidadDelPlan, perfilResuelto } from "../armarDesde/aplicarPlanSugerido";
import { clonePlanWithFreshIds } from "../armarDesde/clonarPlanSugerido";
import { PLANTILLAS_INFORME, ROTULO_GRUPO, plantillaInicial, plantillaPorId, type PlantillaInforme } from "./catalogoPlantillas";
import { cambiosDeIdentidad, configDePlantilla, nombreDeEstilo, perfilVigente } from "./identidadDePlantilla";
import {
  ROTULO_GRAFICO,
  conExclusion,
  conGrafico,
  conPlantillaElegida,
  conPlantillaGuardada,
  conPlantillaReusada,
  conSeleccion,
  conteo,
  estadoSeccion,
  exclusionesDe,
  graficosDe,
  laminasDeSeccion,
  plantillasGuardadasDe,
  preguntasVisibles,
  resumenInforme,
  sinPlantillaGuardada,
  type FiltroPreguntas,
} from "./modeloPlantillas";
import { AdelantoPlantilla } from "./AdelantoPlantilla";
import { avisoDeReemplazo, seleccionSinLeer } from "./modeloAdelanto";
import "./plantillas.css";

type Carga = { fase: "sin-leer" } | { fase: "cargando" } | { fase: "lista"; estructura: EstructuraDelInforme } | { fase: "error"; mensaje: string };

const FILTROS: Array<{ clave: FiltroPreguntas; rotulo: string }> = [
  { clave: "todas", rotulo: "Todas" },
  { clave: "dentro", rotulo: "En el informe" },
  { clave: "fuera", rotulo: "Fuera" },
];

const mensajeDeError = (e: unknown) => {
  const raw = (e as Error)?.message || "";
  return /failed to fetch|networkerror|load failed|timeout|aborted/i.test(raw)
    ? "Se cortó la conexión con el servidor de la app. Vuelve a intentarlo."
    : raw || "No se pudo leer el cuestionario.";
};

export default function PestanaPlantillas() {
  const reglas = usePlanStore((s) => s.scopeRules);
  const setScopeRules = usePlanStore((s) => s.setScopeRules);
  const planActual = usePlanStore((s) => s.plan);
  const aplicarPlanSugerido = usePlanStore((s) => s.aplicarPlanSugerido);
  const presets = usePlanStore((s) => s.presets);
  const paletas = usePlanStore((s) => s.paletas);
  const overridesReusables = usePlanStore((s) => s.overridesReusables);
  const logosPropios = usePlanStore((s) => Object.keys(s.estiloCliente.logos ?? {}).length);
  const { profiles: perfiles } = usePptStyleProfiles();
  const { registry } = useGraficosRegistry();
  const { variables, multi, relacionBases } = useVariables();
  const { irA } = useSeccion("procesamiento");
  const shell = useOptionalProjectShell();
  // Sin plantilla elegida, la de partida sale de lo que el estudio dice de sí mismo: nombre y ruta del proyecto, la Ficha
  // del estudio (nombre, código y cliente). Un RMS guardado como "rms.pulso" con cliente
  // ACNUR parte de la plantilla ACNUR. Mientras se lee la ficha no se pide la estructura de una plantilla que puede cambiar.
  const [ficha, setFicha] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    apiPlannerEstado()
      .then((e) => { if (vivo) setFicha([e.planner.estudio.nombre, e.planner.estudio.codigo, e.planner.estudio.cliente].join(" ")); })
      .catch(() => { if (vivo) setFicha(""); });
    return () => { vivo = false; };
  }, []);
  const identidadProyecto = [shell?.project.status.name, shell?.project.status.path, ficha].filter(Boolean).join(" ");
  const esperandoFicha = ficha === null && !plantillaPorId(typeof reglas.plantilla_elegida === "string" ? reglas.plantilla_elegida : null);

  const territorio = registry?.graficadores.find((g) => g.feature_kind === "territorial_coverage" || g.requisito === "territorial_coverage");
  const hayTerritorio = territorio?.available === true;
  const motivoSinTerritorio = territorio?.disabled_reason || "Pide Hojas de ruta y Monitoreo territorial en el proyecto.";

  const plantilla = plantillaInicial(reglas.plantilla_elegida, identidadProyecto);
  const guardadas = plantillasGuardadasDe(reglas);
  const exclusiones = exclusionesDe(reglas);
  const graficos = graficosDe(reglas);

  const [carga, setCarga] = useState<Carga>({ fase: "sin-leer" });
  // Elegir una plantilla sólo muestra su adelanto (Gonzalo, 2026-11-12): el cuestionario se lee cuando el analista pide
  // elegir secciones y preguntas, y las láminas se crean con el botón de crear. Guarda el id de la plantilla pedida.
  const [lecturaPedida, setLecturaPedida] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);
  const [filtro, setFiltro] = useState<FiltroPreguntas>("todas");
  const [busqueda, setBusqueda] = useState("");
  const [abiertas, setAbiertas] = useState<Set<string>>(new Set());
  const [creando, setCreando] = useState(false);
  const [errorCrear, setErrorCrear] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [nombreNueva, setNombreNueva] = useState("");
  const pedido = useRef(0);

  // La estructura depende sólo de la plantilla: encender o apagar preguntas no la vuelve a pedir (cada pedido arma el
  // plan completo en el backend, decenas de segundos en un estudio grande). Cambiar de plantilla vuelve al adelanto.
  const leer = lecturaPedida === plantilla.id && !plantilla.enBlanco && !esperandoFicha;
  useEffect(() => {
    if (!leer) { ++pedido.current; setCarga((c) => (c.fase === "sin-leer" ? c : { fase: "sin-leer" })); return; }
    const n = ++pedido.current;
    setCarga({ fase: "cargando" });
    apiGraficosEstructuraInforme(configDePlantilla(buildGraficosConfigFromStore(), plantilla))
      .then((estructura) => { if (n === pedido.current) setCarga({ fase: "lista", estructura }); })
      .catch((e) => { if (n === pedido.current) setCarga({ fase: "error", mensaje: mensajeDeError(e) }); });
  }, [leer, intento, plantilla.id, plantilla.config]);

  // Identidad (checklist-plantillas-validez, ítem 4): lo que "Crear láminas" cambia en estilo, paletas, ajustes y logos.
  // Mientras no llegan los perfiles de estilo no se sabe qué trae la plantilla: no se puede crear todavía.
  const idPerfilNuevo = plantilla.enBlanco ? "" : String(plantilla.config.profile_id ?? "");
  const perfilNuevo = idPerfilNuevo ? perfiles.find((p) => p.name === idPerfilNuevo) ?? null : null;
  const perfilActual = perfiles.find((p) => p.name === perfilVigente(reglas)) ?? null;
  const identidadPendiente = !!idPerfilNuevo && !perfilNuevo;
  const cambiosIdentidad = useMemo(
    () => (identidadPendiente ? [] : cambiosDeIdentidad({ presets, paletas, overridesReusables, scopeRules: reglas }, perfilActual, perfilNuevo, {
      logosPropios,
      mantieneIdentidad: plantilla.enBlanco,
    })),
    [identidadPendiente, presets, paletas, overridesReusables, reglas, perfilActual, perfilNuevo, logosPropios, plantilla.enBlanco],
  );
  const pisaIdentidad = cambiosIdentidad.some((c) => c.pisa);

  const secciones = useMemo(
    () => (carga.fase === "lista" ? conSeleccion(carga.estructura, exclusiones, graficos) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [carga, reglas],
  );
  const resumen = resumenInforme(secciones, carga.fase === "lista" ? carga.estructura.laminasFijas : 0);

  const cambiar = useCallback((f: (r: Record<string, unknown>) => Record<string, unknown>) => {
    setScopeRules(f(usePlanStore.getState().scopeRules));
  }, [setScopeRules]);

  function elegirPlantilla(p: PlantillaInforme) {
    if (p.requiereTerritorio && !hayTerritorio) return;
    cambiar((r) => conPlantillaElegida(r, p.id));
  }

  function alternarSeccion(s: SeccionDelInforme) {
    const fuera = estadoSeccion(s) !== "ninguna";
    cambiar((r) => conExclusion(r, s.preguntas.map((q) => q.ref), fuera));
  }

  function alternarAbierta(titulo: string) {
    setAbiertas((prev) => {
      const next = new Set(prev);
      if (next.has(titulo)) next.delete(titulo); else next.add(titulo);
      return next;
    });
  }

  // Una plantilla siempre reemplaza el informe (Gonzalo, 2026-11-11): no se agregan láminas de otra plantilla al final.
  // El reemplazo y los cambios de identidad se leen junto al botón de crear, que es la única confirmación.
  async function crearLaminas() {
    setCreando(true);
    setErrorCrear("");
    try {
      let plan;
      let perfil = null;
      let identidad = null;
      if (plantilla.enBlanco) {
        const { templates } = await apiGraficosTemplates();
        const vacio = templates.find((t) => t.name === "plan_vacio") ?? templates[0];
        if (!vacio) throw new Error("No se encontró la plantilla en blanco.");
        plan = clonePlanWithFreshIds(vacio.plan);
      } else {
        const perfilId = (plantilla.config.profile_id as string | undefined) ?? "auto";
        const result = await apiGraficosPlanSugerido(configDePlantilla(buildGraficosConfigFromStore(), plantilla));
        plan = clonePlanWithFreshIds(result.plan);
        perfil = perfiles.find((p) => p.name === perfilResuelto(result, perfilId)) ?? null;
        identidad = identidadDelPlan(result, perfilId);
      }
      // Con varias bases, cada pregunta sale con su base escrita (`default$p7`): el plan nuevo no arranca con el aviso
      // "se leen de la base principal sin que el plan lo diga" en cada lámina (fijarBase.ts).
      if (multi) plan = { ...plan, slides: conBaseFijada(plan.slides, variables, relacionBases).slides };
      const cambiaEstilo = !plantilla.enBlanco && nombreDeEstilo(perfilVigente(reglas)) !== nombreDeEstilo(idPerfilNuevo);
      aplicarPlanSugerido({
        plan,
        perfil,
        identidad,
        perfilQueSale: cambiaEstilo ? perfilActual : null,
      });
      irA("pestana", "laminas");
    } catch (e) {
      setErrorCrear(mensajeDeError(e));
    } finally {
      setCreando(false);
    }
  }

  function guardarPlantilla() {
    const nombre = nombreNueva.trim();
    if (!nombre) return;
    cambiar((r) => conPlantillaGuardada(r, nombre, plantilla.id, `pl-${Date.now().toString(36)}`));
    setNombreNueva("");
    setGuardando(false);
  }

  const hayLaminas = planActual.slides.length > 0;
  // Validación de "Crear láminas" (ítem 5): el botón dice por qué no se puede.
  const motivoNoCrear = creando ? "Creando las láminas."
    : esperandoFicha ? "Falta leer la Ficha del estudio."
    : carga.fase === "cargando" ? "Faltan las secciones y preguntas del cuestionario."
    : identidadPendiente ? "Falta leer el estilo de la plantilla."
    : carga.fase === "lista" && !plantilla.enBlanco && resumen.preguntas === 0 ? "No hay preguntas dentro del informe."
    : "";
  const puedeCrear = !motivoNoCrear;
  const nombreRepetido = guardadas.some((g) => g.nombre.trim().toLowerCase() === nombreNueva.trim().toLowerCase() && !!nombreNueva.trim());
  const grupos = Array.from(new Set(PLANTILLAS_INFORME.map((p) => p.grupo)));

  return (
    <div
      className="pulso-plantillas"
      data-audit-ready={esperandoFicha ? "false" : carga.fase === "error" ? "vacio:error" : "graficos-plantillas"}
      data-qa-surface="graficos/plantillas"
    >
      <header className="pulso-plantillas-barra">
        <h2 className="pulso-plantillas-titulo">Plantillas</h2>
      </header>

      <div className="pulso-plantillas-cuerpo" data-qa-scroll-owner="plantillas">
        <div className="pulso-plantillas-columnas" data-qa-geometry-group="graficos/plantillas-columnas" data-qa-geometry-contract="intrinsic">
          <nav className="pulso-plantillas-menu" aria-label="Plantillas de informe" data-qa-geometry-member>
            {grupos.map((g) => (
              <section key={g} className="pulso-plantillas-grupo" aria-label={ROTULO_GRUPO[g]}>
                <h3>{ROTULO_GRUPO[g]}</h3>
                {PLANTILLAS_INFORME.filter((p) => p.grupo === g).map((p) => {
                  const deshabilitada = p.requiereTerritorio && !hayTerritorio;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      className="pulso-plantillas-opcion"
                      aria-pressed={p.id === plantilla.id}
                      disabled={deshabilitada}
                      title={deshabilitada ? motivoSinTerritorio : undefined}
                      onClick={() => elegirPlantilla(p)}
                    >
                      <span className="pulso-plantillas-mini" aria-hidden="true" style={{ "--mini-barras": p.muestra.barras, "--mini-titulo": p.muestra.titulo } as CSSProperties}>
                        <i /><b /><b /><b />
                      </span>
                      <span className="pulso-plantillas-opcion-texto">
                        <strong>{p.nombre}</strong>
                        {deshabilitada && <small>{motivoSinTerritorio}</small>}
                      </span>
                    </button>
                  );
                })}
              </section>
            ))}
            <section className="pulso-plantillas-grupo" aria-label="Guardadas en este proyecto">
              <h3>Guardadas en este proyecto</h3>
              {guardadas.length === 0 ? (
                <p className="pulso-plantillas-sin-guardadas">Ninguna todavía.</p>
              ) : guardadas.map((g) => (
                <div key={g.id} className="pulso-plantillas-guardada">
                  <button type="button" className="pulso-plantillas-guardada-usar" onClick={() => cambiar((r) => conPlantillaReusada(r, g))}>
                    <strong>{g.nombre}</strong>
                    <small>{plantillaPorId(g.base)?.nombre ?? "Plantilla"}, {conteo(g.exclusiones.length, "pregunta fuera", "preguntas fuera")}</small>
                  </button>
                  <PulsoButton variant="icon" size="sm" aria-label={`Borrar la plantilla ${g.nombre}`} title="Borrar" onClick={() => cambiar((r) => sinPlantillaGuardada(r, g.id))}>
                    <Trash2 size={14} aria-hidden="true" />
                  </PulsoButton>
                </div>
              ))}
            </section>
          </nav>

          <section className="pulso-plantillas-contenido" aria-label="Contenido del informe" data-qa-geometry-member>
            <Panel
              className="pulso-plantillas-resumen"
              title={plantilla.nombre}
              actions={(
                <div className="pulso-plantillas-acciones">
                  {guardando ? (
                    <form className="pulso-plantillas-guardar" onSubmit={(e) => { e.preventDefault(); guardarPlantilla(); }}>
                      <PulsoInput
                        size="sm"
                        autoFocus
                        aria-label="Nombre de la plantilla"
                        placeholder="Nombre, por ejemplo RMS versión cliente"
                        value={nombreNueva}
                        onChange={(e) => setNombreNueva(e.target.value)}
                      />
                      <PulsoButton type="submit" variant="secondary" size="sm" disabled={!nombreNueva.trim()}>{nombreRepetido ? "Reemplazar" : "Guardar"}</PulsoButton>
                      <PulsoButton type="button" variant="ghost" size="sm" onClick={() => setGuardando(false)}>Cancelar</PulsoButton>
                    </form>
                  ) : (
                    <PulsoButton variant="secondary" size="sm" onClick={() => setGuardando(true)} disabled={plantilla.enBlanco}>
                      <Plus size={14} aria-hidden="true" /> Guardar como plantilla
                    </PulsoButton>
                  )}
                </div>
              )}
            >
              <AdelantoPlantilla plantilla={plantilla} />
              {cambiosIdentidad.length > 0 && (
                <div className="pulso-plantillas-identidad" role="note" aria-label="Cambios en la identidad del informe">
                  <Alert kind={pisaIdentidad ? "warn" : "info"}>
                    <p className="pulso-plantillas-identidad-titulo">Identidad del informe</p>
                    <ul data-qa-geometry-group="graficos/plantillas-identidad" data-qa-geometry-contract="intrinsic">
                      {cambiosIdentidad.map((c) => <li key={c.clave} className={c.pisa ? "is-pisa" : undefined}>{c.texto}</li>)}
                    </ul>
                  </Alert>
                </div>
              )}
              <div className="pulso-plantillas-generar" role="group" aria-labelledby="pulso-plantillas-generar-pregunta">
                <div className="pulso-plantillas-generar-texto">
                  <p id="pulso-plantillas-generar-pregunta" className="pulso-plantillas-generar-pregunta">¿Crear el informe con esta plantilla?</p>
                  {hayLaminas && <p className="pulso-plantillas-generar-aviso">{avisoDeReemplazo(planActual.slides.length)}</p>}
                </div>
                <PulsoButton variant="primary" onClick={() => void crearLaminas()} disabled={!puedeCrear} title={motivoNoCrear || undefined}>
                  {creando && <Loader2 size={14} className="pulso-spin" aria-hidden="true" />}
                  {hayLaminas ? `Reemplazar las ${formatoConteo(planActual.slides.length)} láminas` : "Crear láminas"}
                </PulsoButton>
              </div>
            </Panel>
            {errorCrear && <p className="pulso-plantillas-error" role="alert">{errorCrear}</p>}

            {plantilla.enBlanco || esperandoFicha ? null : carga.fase === "sin-leer" ? (
              <EstadoVacio
                tamano="compacto"
                icono={<ListChecks size={18} aria-hidden="true" />}
                titulo="Secciones y preguntas"
                descripcion={seleccionSinLeer(exclusiones.size)}
                accion={(
                  <PulsoButton variant="secondary" size="sm" onClick={() => setLecturaPedida(plantilla.id)}>
                    Elegir secciones y preguntas
                  </PulsoButton>
                )}
              />
            ) : carga.fase === "cargando" ? (
              <CargaDeBloque label="Leyendo las secciones y preguntas del cuestionario" />
            ) : carga.fase === "error" ? (
              <div className="pulso-plantillas-error-lectura">
                <p className="pulso-plantillas-error" role="alert">{carga.mensaje}</p>
                <PulsoButton variant="secondary" size="sm" onClick={() => setIntento((i) => i + 1)}>Volver a leer</PulsoButton>
              </div>
            ) : secciones.length === 0 ? (
              <EstadoVacio
                tamano="compacto"
                icono={<ListChecks size={18} aria-hidden="true" />}
                titulo="Secciones y preguntas"
                descripcion="La base no tiene preguntas que se puedan graficar."
              />
            ) : (
              <>
                <Panel title="Contenido del informe">
                  <CifrasEnTarjeta
                    grupo="graficos/plantillas-cifras"
                    cifras={[
                      { id: "laminas", rotulo: "Láminas", valor: formatoConteo(resumen.laminas) },
                      { id: "secciones", rotulo: "Secciones", valor: formatoConteo(resumen.secciones) },
                      { id: "preguntas", rotulo: "Preguntas", valor: formatoConteo(resumen.preguntas) },
                      { id: "fuera", rotulo: "Fuera del informe", valor: formatoConteo(resumen.fuera) },
                    ]}
                  />
                </Panel>
                <div className="pulso-plantillas-herramientas">
                  <PulsoInput
                    className="pulso-plantillas-buscar"
                    type="search"
                    aria-label="Buscar pregunta"
                    placeholder="Buscar pregunta"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                  />
                  <RadioSegmentado
                    etiqueta="Mostrar"
                    valor={filtro}
                    onCambiar={setFiltro}
                    opciones={FILTROS.map((f) => ({ clave: f.clave, rotulo: f.rotulo }))}
                  />
                </div>
                <ol className="pulso-plantillas-secciones" data-qa-geometry-group="graficos/plantillas-secciones" data-qa-geometry-contract="intrinsic">
                  {secciones.map((s) => {
                    const visibles = preguntasVisibles(s, filtro, busqueda);
                    if ((filtro !== "todas" || busqueda.trim()) && visibles.length === 0) return null;
                    const estado = estadoSeccion(s);
                    const dentro = s.preguntas.filter((q) => q.dentro).length;
                    const abierta = abiertas.has(s.titulo) || busqueda.trim().length > 0;
                    const laminas = laminasDeSeccion(s);
                    return (
                      <li key={s.titulo} className="pulso-plantillas-seccion" data-estado={estado}>
                        <Panel noPadding variant={estado === "ninguna" ? "subtle" : "content"} aria-label={s.titulo}>
                        <div className="pulso-plantillas-seccion-cabeza">
                          <PulsoSwitch
                            size="sm"
                            ariaLabel={`Incluir la sección ${s.titulo}`}
                            checked={estado !== "ninguna"}
                            onCheckedChange={() => alternarSeccion(s)}
                          />
                          <button type="button" className="pulso-plantillas-seccion-abrir" aria-expanded={abierta} onClick={() => alternarAbierta(s.titulo)}>
                            <span className="pulso-plantillas-seccion-texto">
                              <strong>{s.titulo}</strong>
                              <small>{formatoConteo(dentro)} de {conteo(s.preguntas.length, "pregunta", "preguntas")}</small>
                            </span>
                            <span className="pulso-plantillas-seccion-laminas">{laminas > 0 ? conteo(laminas, "lámina", "láminas") : "Fuera del informe"}</span>
                            {abierta ? <ChevronDown size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}
                          </button>
                        </div>
                        {abierta && (
                          <ul className="pulso-plantillas-preguntas">
                            {visibles.map((q) => (
                              <li key={q.ref} className="pulso-plantillas-pregunta" data-dentro={q.dentro ? "si" : "no"}>
                                <PulsoSwitch
                                  size="sm"
                                  ariaLabel={`Incluir ${q.etiqueta}`}
                                  checked={q.dentro}
                                  onCheckedChange={(v) => cambiar((r) => conExclusion(r, [q.ref], !v))}
                                />
                                <span className="pulso-plantillas-pregunta-texto">
                                  {q.etiqueta}
                                  {q.porRegistro && <small>Por miembro o registro</small>}
                                </span>
                                <span className="pulso-plantillas-tipo">{q.tipo}</span>
                                {q.graficosPosibles.length < 2 ? (
                                  <span className="pulso-plantillas-grafico-unico">{ROTULO_GRAFICO[q.grafico]}</span>
                                ) : (
                                  <PulsoSelect
                                    size="sm"
                                    ariaLabel={`Gráfico de ${q.etiqueta}`}
                                    value={q.grafico}
                                    disabled={!q.dentro}
                                    onValueChange={(v) => cambiar((r) => conGrafico(r, q.ref, v as GraficoPorPregunta, q.graficosPosibles[0]))}
                                    options={q.graficosPosibles.map((g) => ({ value: g, label: ROTULO_GRAFICO[g] }))}
                                  />
                                )}
                                <span className="pulso-plantillas-pregunta-laminas">{q.dentro ? conteo(q.laminas, "lámina", "láminas") : "Fuera"}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                        </Panel>
                      </li>
                    );
                  })}
                </ol>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
