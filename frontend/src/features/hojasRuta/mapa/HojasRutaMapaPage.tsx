import { useCallback, useEffect, useMemo, useState } from "react";
import { ParecidoAlMarco } from "./manzanas/ParecidoAlMarco";
import { BookOpenText, Send } from "../../../vendor/lucide-react";
import { apiHojasRutaBitacora } from "../../../api/hojasRuta";
import { codigoDeUmp } from "../seleccion/revisionMarco";
import { conSelectorDeCapa, leyendaLienzo, migaLienzo, SelectorCapa, type SeccionLienzo } from "./lienzo/flotantes";
import { useLocation, useNavigate } from "react-router-dom";
import { PageFrame } from "../../../components/PageFrame";
import { ModuleCommandBar } from "../../../components/ModuleCommandBar";
import { SectionPillbar } from "../../../components/SectionPillbar";
import { ChromeIndicator, ChromeIndicatorGroup } from "../../../components/ChromeIndicator";
import { apiHojasRutaGeometria, apiHojasRutaMarcoElegiblePreview, apiHojasRutaPersistWorkspace, apiHojasRutaPopulationPreview, apiHojasRutaSamplePreview, apiHojasRutaSampleSizePreview, apiHojasRutaState, type HojasRutaIntegratedConfig, type HojasRutaMarcoElegiblePreview, type HojasRutaPlanSupuestos, type HojasRutaRouteSnapshot, type HojasRutaState } from "../../../api/hojasRuta";
import { useSeccion } from "../../../lib/navegacion/useDireccion";
import { indicadoresDecididos } from "../chrome/loDecidido";
import cobertura from "../limaDistrictCoverage.json";
import { LienzoMapa, type UtilLienzo } from "./lienzo/LienzoMapa";
import { piezasDeGeometria, unirCajas, type PiezaManzana, type PiezasDistrito } from "./lienzo/piezas";
import {
  contornosDeCobertura,
  dibujarContornos,
  dibujarReemplazosMundo,
  dibujarRotulosDistrito,
  dibujarTitularesMundo,
  dibujarTitularesPantalla,
  type TitularEnMapa,
  mezclar,
  tonoDistrito,
} from "./lienzo/capas";
import { nombreDistrito } from "./nombres";
import { useLienzoHojasRuta } from "./store";
import { distritoEnPunto } from "./territorio/puntoEnDistrito";
import { TerritorioEstructura, TerritorioInspector } from "./territorio/TerritorioPaneles";
import { zonasDeLima } from "./territorio/zonasLima";
import { resumirMatriz } from "./poblacion/matriz";
import { conTopeAbierto } from "./poblacion/rangos";
import { MuestraCajon } from "./muestra/MuestraCajon";
import { useBarraAngosta } from "./useBarraAngosta";
import { PoblacionCajon } from "./poblacion/PoblacionCajon";
import { PoblacionEstructura, PoblacionInspector } from "./poblacion/PoblacionPaneles";
import { aplicarBorrador, entradaDesdeConfig } from "./muestra/desdeConfig";
import { calcularTamano, margenTotalParaN } from "./muestra/motorTamano";
import { MuestraEstructura, MuestraInspector } from "./muestra/MuestraPaneles";
import { aplicarSorteo, conInstantanea, instantaneaDeSorteo, parametrosDeSorteo } from "./manzanas/sorteo";
import { ManzanasEstructura, ManzanasInspector } from "./manzanas/ManzanasPaneles";
import { MarcoElegiblePanel } from "./manzanas/MarcoElegiblePanel";
import { cierraEnPrimero, MARCO_NUEVO } from "./manzanas/marcoElegible";
import { proyectarLonLat } from "./lienzo/camara";
import { revisarSeleccion } from "../seleccion/revisionMarco";
import { estadosPorTitular, manzanaEnPunto, reemplazosDe, rutasPorDistrito, vecina } from "./seleccion/rutas";
import { SeleccionCajon, SeleccionEstructura, SeleccionInspector } from "./seleccion/SeleccionPaneles";
import { SalidasPanel } from "./seleccion/SalidasPanel";
import { useSeleccionDireccion } from "./seleccion/useSeleccionDireccion";
import "./mapaPage.css";

/**
 * Hojas de ruta con el mapa como lienzo (ADR 0114). Esqueleto de U4: barra del
 * documento en la top bar, estructura, lienzo e inspector, con lo que el
 * estudio ya tiene (territorio confirmado, lo decidido, titulares sorteadas).
 * Cada sección se llena en U5–U10. Se ve sólo con el interruptor encendido.
 */

const contornos = contornosDeCobertura(cobertura as Parameters<typeof contornosDeCobertura>[0]);
const zonas = zonasDeLima(contornos);
const fmt = (n: number) => new Intl.NumberFormat("es-PE").format(n);

export default function HojasRutaMapaPage() {
  const nav = useSeccion("hojas-ruta");
  const location = useLocation();
  const [estado, setEstado] = useState<HojasRutaState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [geometrias, setGeometrias] = useState<Record<string, PiezasDistrito>>({});
  const [guardando, setGuardando] = useState(false);
  const { borrador: borradorCrudo, distritoBajoCursor, setBorrador, setDistritoBajoCursor, rangosBorrador, setRangosBorrador, setCortesBorrador, muestraBorrador, setMuestraBorrador, sorteoBorrador, setSorteoBorrador, soloPorRevisar, busquedaUmp, dibujoArea, setDibujoArea, capaMapa, setCapaMapa, distritoEnfocado, setDistritoEnfocado } = useLienzoHojasRuta();
  const { umpEnfocada, setUmpEnfocada, cajon } = useSeleccionDireccion();
  const enTerritorio = nav.seccion === "territorio";
  const enPoblacion = nav.seccion === "poblacion";
  const enMuestra = nav.seccion === "muestra";
  const enManzanas = nav.seccion === "manzanas";
  const enSeleccion = nav.seccion === "seleccion";

  useEffect(() => {
    let vivo = true;
    apiHojasRutaState()
      .then((s) => vivo && setEstado(s))
      .catch((e: unknown) => vivo && setError(e instanceof Error ? e.message : "No se pudo leer el estado de Hojas de ruta"));
    return () => {
      vivo = false;
    };
  }, []);

  const confirmados = useMemo(() => estado?.integrated_config.territorios ?? [], [estado]);
  const borrador = useMemo(() => borradorCrudo ?? confirmados, [borradorCrudo, confirmados]);
  const fase = estado?.active_phase ?? "field";
  const bloqueado = Boolean(estado?.runs?.[fase]?.locked);

  const confirmarTerritorio = useCallback(
    async (ubigeos: string[]) => {
      if (!estado) return;
      setGuardando(true);
      try {
        // Sin salidas: cambiar el territorio invalida población, tamaño, cuotas y muestra.
        await apiHojasRutaPersistWorkspace({ ...estado.integrated_config, territorios: ubigeos }, { ...estado.ui_state, draft_territories: ubigeos }, {}, fase);
        setEstado(await apiHojasRutaState());
        setBorrador(null);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "No se pudo confirmar el territorio");
      } finally {
        setGuardando(false);
      }
    },
    [estado, fase, setBorrador],
  );

  // Población: guardar los cambios de configuración y recalcular la matriz.
  // El backend borra tamaño, cuotas y muestra al recalcular la población.
  const guardarYCalcularPoblacion = useCallback(
    async (cambios: Partial<HojasRutaIntegratedConfig>) => {
      if (!estado) return;
      setGuardando(true);
      try {
        const config = { ...estado.integrated_config, ...cambios };
        await apiHojasRutaPersistWorkspace(config, estado.ui_state, {}, fase);
        await apiHojasRutaPopulationPreview(config);
        setEstado(await apiHojasRutaState());
        setRangosBorrador(null);
        setCortesBorrador(null);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "No se pudo calcular la población");
      } finally {
        setGuardando(false);
      }
    },
    [estado, fase, setRangosBorrador, setCortesBorrador],
  );


  // Geometría de cada distrito confirmado, de a uno: la primera lectura de un
  // distrito cuesta segundos en el backend y no conviene pedirlas todas juntas.
  useEffect(() => {
    let vivo = true;
    (async () => {
      for (const u of confirmados) {
        if (!vivo || geometrias[u]) continue;
        try {
          const geo = await apiHojasRutaGeometria(u);
          if (vivo && geo.ok) setGeometrias((prev) => ({ ...prev, [u]: piezasDeGeometria(geo) }));
        } catch {
          // Un distrito sin geometría sigue visible por su contorno.
        }
      }
    })();
    return () => {
      vivo = false;
    };
    // geometrias se consulta, no dispara: pedirla de nuevo al llegar cada una repetiría el bucle
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmados]);

  const distritos = useMemo(() => confirmados.map((u) => geometrias[u]).filter((d): d is PiezasDistrito => Boolean(d)), [confirmados, geometrias]);
  const territorios = useMemo(() => (estado?.territories ?? []).filter((t) => confirmados.includes(t.ubigeo)), [estado, confirmados]);
  const salidas = estado?.workspace_outputs;
  // Las cuotas que el sorteo usó viajan en sample.quota: respaldo para corridas sorteadas sin outputs.quota.
  const cuotas = salidas?.quota ?? salidas?.sample?.quota ?? null;
  // Con cortes poblacionales (B28) los rangos los pone el motor en la config; el tope abierto llega como "NA".
  const rangosConfig = useMemo(() => conTopeAbierto(estado?.integrated_config.age_ranges ?? []), [estado]);
  const rangosVista = rangosBorrador ?? rangosConfig;
  const matriz = useMemo(() => resumirMatriz(salidas?.population, rangosVista), [salidas, rangosVista]);
  const configMuestra = useMemo(() => (estado ? aplicarBorrador(estado.integrated_config, muestraBorrador) : null), [estado, muestraBorrador]);
  const entradaTamano = useMemo(() => (configMuestra && estado ? entradaDesdeConfig(configMuestra, estado.territories) : null), [configMuestra, estado]);
  const tamano = useMemo(() => (entradaTamano ? calcularTamano(entradaTamano) : null), [entradaTamano]);

  // Muestra: guardar los parámetros y recalcular el tamaño en R. La población
  // se conserva; tamaño, cuotas y muestra se recalculan.
  const guardarMuestra = useCallback(async () => {
    if (!estado || !configMuestra) return;
    setGuardando(true);
    try {
      await apiHojasRutaPersistWorkspace(configMuestra, estado.ui_state, { population: estado.workspace_outputs?.population ?? null }, fase);
      await apiHojasRutaSampleSizePreview(configMuestra);
      setEstado(await apiHojasRutaState());
      setMuestraBorrador(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "No se pudo calcular el tamaño de la muestra");
    } finally {
      setGuardando(false);
    }
  }, [estado, configMuestra, fase, setMuestraBorrador]);
  const entrevistasPorRuta = estado?.integrated_config.entrevistas_por_manzana ?? 0;

  // U14: los supuestos del plan van al ui_state. Se mandan las salidas actuales: un
  // persist sin ellas manda {} y borra población, tamaño, cuotas y muestra.
  const releerEstado = useCallback(async () => {
    setEstado(await apiHojasRutaState());
  }, []);
  const guardarPlanCampo = useCallback(async (supuestos: HojasRutaPlanSupuestos) => {
    if (!estado) return;
    await apiHojasRutaPersistWorkspace(estado.integrated_config, { ...estado.ui_state, plan_campo: supuestos }, estado.workspace_outputs ?? {}, fase);
    setEstado(await apiHojasRutaState());
  }, [estado, fase]);

  // Manzanas: R guarda la configuración y la muestra al sortear; el sorteo se
  // anota después en el historial del proyecto (ui_state.route_history).
  const configSorteo = useMemo(() => (estado ? aplicarSorteo(estado.integrated_config, sorteoBorrador) : null), [estado, sorteoBorrador]);

  // Marco elegible (ADR 0115): vista previa sin guardar, con espera para no
  // pedirla en cada tecla. Una corrida legacy ve lo que cambiaría al adoptarlo.
  const [vistaMarco, setVistaMarco] = useState<HojasRutaMarcoElegiblePreview | null>(null);
  const [cargandoMarco, setCargandoMarco] = useState(false);
  const firmaMarco = configSorteo && enManzanas && configSorteo.territorios.length ? JSON.stringify([configSorteo.territorios, configSorteo.marco_elegible ?? null, configSorteo.replacements_per_titular, configSorteo.entrevistas_por_manzana]) : "";
  useEffect(() => {
    if (!firmaMarco || !configSorteo) return undefined;
    let vivo = true;
    setCargandoMarco(true);
    const t = window.setTimeout(() => {
      const me = configSorteo.marco_elegible?.declarado ? configSorteo.marco_elegible : MARCO_NUEVO;
      apiHojasRutaMarcoElegiblePreview({ ...configSorteo, marco_elegible: me })
        .then((v) => vivo && setVistaMarco(v))
        .catch(() => vivo && setVistaMarco(null))
        .finally(() => vivo && setCargandoMarco(false));
    }, 400);
    return () => {
      vivo = false;
      window.clearTimeout(t);
    };
    // la firma resume lo que cambia la vista previa; configSorteo entero cambiaría en cada render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firmaMarco]);
  // Con una corrida legacy la vista previa describe la adopción, no el estado actual: no se pinta como vigente.
  const marcoDeclarado = configSorteo?.marco_elegible?.declarado === true;
  const zonasCortas = useMemo(() => new Set(marcoDeclarado ? (vistaMarco?.capacidad ?? []).filter((z) => z.falta).map((z) => `${z.ubigeo}|${z.zona}`) : []), [vistaMarco, marcoDeclarado]);
  const sortear = useCallback(
    async (config: HojasRutaIntegratedConfig) => {
      if (!estado) return;
      setGuardando(true);
      try {
        const muestra = await apiHojasRutaSamplePreview(config);
        const nuevo = await apiHojasRutaState();
        const foto = instantaneaDeSorteo(muestra, muestra.config, new Date(), `ruta-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
        await apiHojasRutaPersistWorkspace(nuevo.integrated_config, { ...nuevo.ui_state, route_history: conInstantanea(nuevo.ui_state?.route_history ?? [], foto) }, { ...nuevo.workspace_outputs, quota: muestra.quota ?? nuevo.workspace_outputs?.quota ?? null }, fase);
        setEstado(await apiHojasRutaState());
        setSorteoBorrador(null);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "No se pudo sortear las manzanas");
      } finally {
        setGuardando(false);
      }
    },
    [estado, fase, setSorteoBorrador],
  );
  // Volver a un ruteo: sólo sus parámetros de sorteo sobre la configuración
  // vigente (N, rangos y territorio siguen siendo los de hoy). Con el mismo
  // territorio y el mismo N, R repite el sorteo; si cambiaron, la estructura
  // no ofrece «Usar» (sortearía otra cosa).
  const usarRuteo = useCallback((h: HojasRutaRouteSnapshot) => {
    if (!estado) return;
    void sortear(aplicarSorteo(estado.integrated_config, parametrosDeSorteo(h.config)));
  }, [estado, sortear]);

  // Selección: la revisión contra el marco decide el tono de cada ruta.
  const bloquesTitulares = useMemo(() => salidas?.sample?.blocks ?? [], [salidas]);
  const bloquesReemplazos = useMemo(() => salidas?.sample?.replacement_blocks ?? [], [salidas]);
  // ADR 0116: la revisión mide la capacidad de cada manzana en visitas, con la respuesta y la ocupación del estudio.
  const supuestosVisitas = useMemo(() => (estado ? { respuesta: estado.integrated_config.sample_size.response_rate, ocupacion: estado.integrated_config.sample_size.ocupacion ?? 1, modoSalto: estado.integrated_config.route_jump_mode, saltoManual: estado.integrated_config.route_jump_manual } : undefined), [estado]);
  const revision = useMemo(() => revisarSeleccion(bloquesTitulares, bloquesReemplazos, supuestosVisitas), [bloquesTitulares, bloquesReemplazos, supuestosVisitas]);
  const estados = useMemo(() => estadosPorTitular(bloquesTitulares, bloquesReemplazos, revision), [bloquesTitulares, bloquesReemplazos, revision]);
  const grupos = useMemo(() => rutasPorDistrito(bloquesTitulares, bloquesReemplazos, estados, { soloPorRevisar, busqueda: busquedaUmp }), [bloquesTitulares, bloquesReemplazos, estados, soloPorRevisar, busquedaUmp]);
  const manzanaPorId = useMemo(() => new Map(distritos.flatMap((d) => d.manzanas.map((m) => [m.id, m] as const))), [distritos]);

  const titulares = useMemo<TitularEnMapa[]>(() => {
    return bloquesTitulares.flatMap((b, i) => {
      const manzana = manzanaPorId.get(b.id_manzana);
      if (!manzana) return [];
      const tono = estados.get(b.id_manzana);
      const estadoUmp = enSeleccion ? (tono === "error" ? "error" : tono === "aviso" ? "aviso" : "ok") : b.viviendas <= 0 ? "error" : b.viviendas <= entrevistasPorRuta ? "aviso" : "ok";
      return [{ id: b.id_manzana, numero: b.hoja_num ?? i + 1, estado: estadoUmp, manzana }];
    });
  }, [bloquesTitulares, manzanaPorId, entrevistasPorRuta, estados, enSeleccion]);
  const titularEnfocada = enSeleccion && umpEnfocada ? bloquesTitulares.find((b) => b.id_manzana === umpEnfocada) ?? null : null;
  const reemplazosEnfocados = useMemo<PiezaManzana[]>(() => (titularEnfocada ? reemplazosDe(titularEnfocada.id_manzana, bloquesReemplazos).flatMap((b) => manzanaPorId.get(b.id_manzana) ?? []) : []), [titularEnfocada, bloquesReemplazos, manzanaPorId]);
  const cajaEnfocada = useMemo(() => {
    // B12: el foco va a la MANZANA, a nivel de calle (sus vecinas y las vías alrededor);
    // los reemplazos, a menudo en otra zona, se ven al alejar y en la ficha.
    const m = titularEnfocada ? manzanaPorId.get(titularEnfocada.id_manzana) : undefined;
    return m ? m.caja : null;
  }, [titularEnfocada, manzanaPorId]);
  const centroEnfocado = useMemo(() => {
    const m = titularEnfocada ? manzanaPorId.get(titularEnfocada.id_manzana) : undefined;
    return m ? m.centro : null;
  }, [titularEnfocada, manzanaPorId]);

  const reemplazos = useMemo<PiezaManzana[]>(() => {
    const porId = new Map(distritos.flatMap((d) => d.manzanas.map((m) => [m.id, m] as const)));
    return (salidas?.sample?.replacement_blocks ?? []).flatMap((b) => porId.get(b.id_manzana) ?? []);
  }, [salidas, distritos]);

  const decidido = indicadoresDecididos({
    distritos: confirmados.length,
    poblacion: territorios.reduce((a, t) => a + t.poblacion, 0),
    poblacionObjetivo: matriz.vigente ? matriz.total : null,
    n: cuotas?.total_asignado ?? null,
    margen: salidas?.sample_size_preview?.margin_total_estimated ?? null,
    titulares: salidas?.sample ? salidas.sample.blocks.length : null,
    reemplazos: salidas?.sample ? salidas.sample.replacement_blocks.length : null,
  });

  const caja = useMemo(() => unirCajas(contornos.filter((c) => confirmados.includes(c.ubigeo)).map((c) => c.caja)) ?? unirCajas(contornos.map((c) => c.caja)), [confirmados]);
  const cajaLima = useMemo(() => unirCajas(contornos.map((c) => c.caja)), []);

  const dibujarFondo = useCallback(
    (ctx: CanvasRenderingContext2D, u: UtilLienzo) =>
      dibujarContornos(ctx, u, contornos, (c) => {
        const conf = confirmados.includes(c.ubigeo);
        // B9: cada distrito confirmado lleva su tono, en el orden de confirmación.
        // Población también: su cifra va en el rótulo, no en una rampa de color.
        const tono = tonoDistrito(u, confirmados.indexOf(c.ubigeo));
        if ((enMuestra || enPoblacion) && conf) return { relleno: mezclar(u.colores.distrito, tono, 0.42), borde: u.colores.distritoBorde, grosor: 1.3 };
        if (!enTerritorio) return { relleno: conf ? mezclar(u.colores.distrito, tono, 0.22) : u.colores.fondo, borde: u.colores.distritoBorde, grosor: conf ? 1.3 : 0.8 };
        const enB = borrador.includes(c.ubigeo);
        return {
          relleno: enB && conf ? mezclar(u.colores.distrito, tono, 0.42) : enB ? mezclar(u.colores.distrito, u.colores.acento, 0.3) : u.colores.fondo,
          borde: enB !== conf ? u.colores.acento : u.colores.distritoBorde,
          grosor: enB !== conf ? 2 : enB ? 1.3 : 0.8,
          punteado: enB && !conf,
        };
      }),
    [confirmados, borrador, enTerritorio, enPoblacion, enMuestra],
  );
  const dibujarMundo = useCallback(
    (ctx: CanvasRenderingContext2D, u: UtilLienzo) => {
      if (enTerritorio) {

        const enfocadoC = distritoEnfocado ? contornos.find((c) => c.ubigeo === distritoEnfocado) : null;
        if (enfocadoC) {
          ctx.strokeStyle = u.colores.acento;
          ctx.lineWidth = 3 * u.px;
          ctx.stroke(u.trazo(enfocadoC));
        }
        const bajo = distritoBajoCursor ? contornos.find((c) => c.ubigeo === distritoBajoCursor) : null;
        if (bajo) {
          ctx.strokeStyle = u.colores.texto;
          ctx.lineWidth = 2 * u.px;
          ctx.stroke(u.trazo(bajo));
        }
        return;
      }
      if (enManzanas) {
        // Zonas que no alcanzan con el marco elegible: borde ámbar, sin relleno.
        if (zonasCortas.size) {
          ctx.strokeStyle = u.colores.aviso;
          ctx.lineWidth = 2.2 * u.px;
          for (const d of distritos) for (const z of d.zonas) if (zonasCortas.has(`${d.ubigeo}|${z.codigo}`)) ctx.stroke(u.trazo(z));
        }
        // Áreas excluidas: trama tenue del módulo y borde punteado, nunca rojo.
        const anillo = (pts: readonly [number, number][]) => {
          const p = new Path2D();
          pts.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y)));
          return p;
        };
        for (const a of configSorteo?.marco_elegible?.areas_excluidas ?? []) {
          const p = anillo(a.poligono.map(([lon, lat]) => proyectarLonLat(lon, lat)));
          p.closePath();
          ctx.globalAlpha = 0.14;
          ctx.fillStyle = u.colores.acento;
          ctx.fill(p);
          ctx.globalAlpha = 1;
          ctx.strokeStyle = u.colores.acento;
          ctx.lineWidth = 1.6 * u.px;
          ctx.setLineDash([6 * u.px, 4 * u.px]);
          ctx.stroke(p);
          ctx.setLineDash([]);
        }
        if (dibujoArea?.length) {
          ctx.strokeStyle = u.colores.texto;
          ctx.lineWidth = 1.8 * u.px;
          ctx.stroke(anillo(dibujoArea));
          ctx.fillStyle = u.colores.texto;
          for (const [x, y] of dibujoArea) {
            ctx.beginPath();
            ctx.arc(x, y, 4 * u.px, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        dibujarReemplazosMundo(ctx, u, reemplazos);
      }
      if (enSeleccion) dibujarReemplazosMundo(ctx, u, reemplazosEnfocados);
      if (!enPoblacion && !enMuestra) dibujarTitularesMundo(ctx, u, titulares, enSeleccion ? umpEnfocada : null);
    },
    [enMuestra, enPoblacion, enTerritorio, enManzanas, enSeleccion, borrador, distritoBajoCursor, distritoEnfocado, titulares, reemplazos, reemplazosEnfocados, umpEnfocada, zonasCortas, distritos, configSorteo, dibujoArea],
  );
  // Perfil NSE de lo elegido para la gráfica del inspector de Territorio: viviendas
  // por nivel de las manzanas ya cargadas en el lienzo. null mientras no hay geometría.
  const viviendasPorNse = useMemo(() => {
    const elegidos = new Set(borrador);
    const cargados = distritos.filter((d) => elegidos.has(d.ubigeo));
    if (!cargados.length) return null;
    const out: Record<number, number> = {};
    for (const d of cargados) for (const m of d.manzanas) out[m.nse] = (out[m.nse] ?? 0) + Math.max(0, m.viviendas);
    return out;
  }, [distritos, borrador]);
  // B38: NSE del marco (viviendas de los distritos confirmados) y de la muestra (UMP titulares).
  const perfilNseMarco = useMemo(() => {
    const out: Record<number, number> = {};
    for (const d of distritos) if (confirmados.includes(d.ubigeo)) for (const m of d.manzanas) out[m.nse] = (out[m.nse] ?? 0) + Math.max(0, m.viviendas);
    return Object.keys(out).length ? out : null;
  }, [distritos, confirmados]);
  const perfilNseMuestra = useMemo(() => {
    const out: Record<number, number> = {};
    for (const t of titulares) if (t.manzana) out[t.manzana.nse] = (out[t.manzana.nse] ?? 0) + 1;
    return Object.keys(out).length ? out : null;
  }, [titulares]);
  // Habitantes por distrito para los rótulos de Territorio (B9), de todo el catálogo.
  const habitantes = useMemo(() => new Map((estado?.territories ?? []).map((t) => [t.ubigeo, t.poblacion])), [estado]);
  const dibujarPantalla = useCallback(
    (ctx: CanvasRenderingContext2D, u: UtilLienzo) => {
      if (!enTerritorio && !enPoblacion && !enMuestra) dibujarTitularesPantalla(ctx, u, titulares, enSeleccion ? umpEnfocada : null, null, enSeleccion ? reemplazosEnfocados : []);
      const visibles = enTerritorio ? contornos.filter((c) => borrador.includes(c.ubigeo) || confirmados.includes(c.ubigeo)) : contornos.filter((c) => confirmados.includes(c.ubigeo));
      if (u.camara.s < 0.09 || enTerritorio || enPoblacion || enMuestra) {
        dibujarRotulosDistrito(
          ctx,
          u,
          visibles.map((c) => {
            const enB = borrador.includes(c.ubigeo), conf = confirmados.includes(c.ubigeo);
            const fila = enMuestra ? tamano?.filas.find((f) => f.ubigeo === c.ubigeo) : undefined;
            const detalle = fila ? `${fmt(fila.nUsado)} entr. · ±${((fila.margen ?? 0) * 100).toLocaleString("es-PE", { maximumFractionDigits: 1 })} %` : enTerritorio && enB !== conf ? (enB ? "Se agrega al confirmar" : "Se quita al confirmar") : enPoblacion && matriz.vigente && matriz.porUbigeo[c.ubigeo] ? `${fmt(matriz.porUbigeo[c.ubigeo])} en la población objetivo`
              : enTerritorio && habitantes.get(c.ubigeo) ? `${fmt(habitantes.get(c.ubigeo) ?? 0)} hab.` : undefined;
            return { ubigeo: c.ubigeo, nombre: nombreDistrito(c.nombre), detalle, x: c.rotulo[0], y: c.rotulo[1], tono: conf ? tonoDistrito(u, confirmados.indexOf(c.ubigeo)) : u.colores.acento };
          }),
        );
      }
    },
    [titulares, confirmados, borrador, enTerritorio, enPoblacion, enMuestra, enSeleccion, umpEnfocada, reemplazosEnfocados, matriz, tamano, habitantes],
  );

  // B1: la zona de acciones del documento (fase, avisos por revisar, bitácora, Material).
  const navegar = useNavigate();
  const [entradasBitacora, setEntradasBitacora] = useState<number | null>(null);
  useEffect(() => {
    let vivo = true;
    apiHojasRutaBitacora()
      .then((e) => vivo && setEntradasBitacora(e.length))
      .catch(() => vivo && setEntradasBitacora(null));
    return () => {
      vivo = false;
    };
  }, [estado]);
  const porRevisarTotal = [...estados.values()].filter((e) => e === "error" || e === "aviso").length;
  const evitaPiloto = fase === "field" && Boolean(estado?.runs?.pilot) && estado?.runs?.field?.pilot_exclusion_mode !== "ignore";
  const chipsEstado = [
    {
      id: "fase",
      label: fase === "pilot" ? "Piloto" : "Campo real",
      tone: "info" as const,
      detail: fase === "pilot" ? "La corrida piloto es histórica: se consulta, no se cambia." : evitaPiloto ? "Campo real · evita las titulares del piloto." : "Campo real.",
    },
    ...(porRevisarTotal
      ? [{ id: "revisar", label: `${porRevisarTotal} por revisar`, tone: "warn" as const, detail: "UMP con observaciones contra el marco: ábrelas en Selección.", onSelect: () => navegar(`${location.pathname}?seccion=seleccion`) }]
      : []),
  ];
  const barraAngosta = useBarraAngosta();
  const accionesChrome = [
    {
      id: "bitacora",
      label: entradasBitacora ? `Bitácora · ${entradasBitacora}` : "Bitácora",
      shortLabel: "Bitácora",
      icon: BookOpenText,
      kind: "ghost" as const,
      rank: 1 as const,
      title: "Decisiones registradas del diseño muestral",
      onSelect: () => navegar(`${location.pathname}?seccion=seleccion&panel=salidas`),
    },
    {
      id: "material",
      label: "Enviar a Material",
      icon: Send,
      kind: "secondary" as const,
      rank: 2 as const,
      disabled: true,
      title: "Llega con la entrega a Recopiladores: las hojas pasarán a Material de campo.",
    },
  ];
  const seccionActual = nav.secciones.find((s) => s.id === nav.seccion);
  const chrome = (
    <ModuleCommandBar
      modulo="hojas-ruta"
      className="hojas-ruta-commandbar"
      ariaLabel="Contexto operativo de hojas de ruta"
      densidad={barraAngosta ? "compact" : "normal"}
      contexto={
        <ChromeIndicatorGroup ariaLabel="Lo decidido" resumen={decidido.map((i) => i.detalle).join(" · ")}>
          {decidido.map((i) => (
            // B4: el lienzo lleva fase, revisión, bitácora y Material en la barra; bajo 1080 px de barra
            // los indicadores ceden todos (como en el artefacto) para que secciones y acciones no se monten.
            <ChromeIndicator key={i.id} label={i.label} value={i.value} detalle={i.detalle} prioridad={i.prioridad === "alta" ? "media" : i.prioridad} onClick={() => nav.irA("seccion", i.seccion)} />
          ))}
        </ChromeIndicatorGroup>
      }
      acciones={accionesChrome}
      estado={chipsEstado}
      secciones={
        <SectionPillbar
          modulo="hojas-ruta"
          ariaLabel="Secciones de Hojas de ruta"
          seccionActiva={nav.seccion}
          items={nav.secciones.map((s) => ({ id: s.id, label: s.label, href: `${location.pathname}?seccion=${s.id}` }))}
        />
      }
    />
  );

  return (
    <PageFrame className="hojas-ruta-frame hr-mapa-frame" bodyMode="fill" scrollOwner="panels" layout="canvas" density="compact" headerMode="sr-only" title="Hojas de ruta" chrome={chrome}>
      <span hidden data-audit-ready={estado || error ? "hojas-ruta" : "false"} data-audit-stage={nav.seccion ?? ""} data-audit-navigation="lienzo-v1" />
      <div className="hr-mapa">
        {/* key por sección: cada una empieza arriba; el scroll de otra no se hereda (B25). */}
        <section key={nav.seccion ?? "territorio"} className="hr-mapa-estructura" aria-label="Distritos del estudio">
          {enTerritorio && estado ? (
            <TerritorioEstructura territorios={estado.territories} confirmados={confirmados} zonas={zonas} bloqueado={bloqueado} />
          ) : enSeleccion && estado ? (
            <SeleccionEstructura grupos={grupos} total={bloquesTitulares.length} observadas={[...estados.values()].filter((e) => e === "error" || e === "aviso").length} />
          ) : enManzanas && estado ? (
            <ManzanasEstructura muestra={salidas?.sample ?? null} historial={estado.ui_state?.route_history ?? []} territorios={confirmados} nFinal={salidas?.sample?.total_entrevistas ?? null} cobertura={marcoDeclarado ? vistaMarco?.por_distrito ?? [] : []} bloqueado={bloqueado} guardando={guardando} onUsar={usarRuteo} />
          ) : enMuestra && configMuestra && tamano ? (
            <MuestraEstructura config={configMuestra} resultado={tamano} bloqueado={bloqueado} />
          ) : enPoblacion && estado ? (
            <PoblacionEstructura rangosConfig={rangosConfig} config={estado.integrated_config} matriz={matriz} bloqueado={bloqueado} />
          ) : (
          <>
          <header className="hr-mapa-cab">
            <h2>{seccionActual?.label ?? "Hojas de ruta"}</h2>
            <small>{confirmados.length ? `${confirmados.length} distrito${confirmados.length === 1 ? "" : "s"}` : "Sin distritos confirmados"}</small>
          </header>
          <ul className="hr-mapa-lista">
            {territorios.map((t) => (
              <li key={t.ubigeo}>
                <strong>{nombreDistrito(t.distrito)}</strong>
                <small>
                  {fmt(t.poblacion)} hab. · {fmt(t.manzanas)} manzanas
                  {geometrias[t.ubigeo] ? "" : " · cargando el mapa…"}
                </small>
              </li>
            ))}
            {!territorios.length ? <li className="hr-mapa-vacio">{error ?? (estado ? "Confirma los distritos del estudio en Territorio." : "Leyendo el estudio…")}</li> : null}
          </ul>
          </>
          )}
        </section>
        <LienzoMapa
          className="hr-mapa-lienzo"
          ariaLabel="Mapa del territorio del estudio"
          miga={migaLienzo(nav.seccion as SeccionLienzo, confirmados.length, titularEnfocada ? { distrito: nombreDistrito(titularEnfocada.distrito), ump: codigoDeUmp(titularEnfocada) } : null)}
          leyenda={leyendaLienzo(nav.seccion as SeccionLienzo, { zonasCortas: zonasCortas.size > 0, areas: (configSorteo?.marco_elegible?.areas_excluidas ?? []).length > 0, capa: capaMapa })}
          distritos={enPoblacion || enMuestra ? [] : distritos}
          capa={conSelectorDeCapa(nav.seccion as SeccionLienzo) ? capaMapa : "manzanas"}
          anclaZoom={centroEnfocado}
          controles={conSelectorDeCapa(nav.seccion as SeccionLienzo) ? <SelectorCapa capa={capaMapa} onCapa={setCapaMapa} /> : undefined}
          encuadreObjetivo={enTerritorio && cajaLima ? { caja: cajaLima, pad: 0.03, clave: "territorio" } : cajaEnfocada ? { caja: cajaEnfocada, pad: 2.2, clave: `ump:${umpEnfocada}:${cajon ? "cajon" : "libre"}`, animar: true, tapadoAbajo: cajon ? 0.5 : 0 } : caja ? { caja, pad: 0.08, clave: `${nav.seccion}:${confirmados.join(",") || "lima"}`, animar: false } : null}
          dibujarFondo={dibujarFondo}
          dibujarMundo={dibujarMundo}
          dibujarPantalla={dibujarPantalla}
          alClic={
            enManzanas && dibujoArea
              ? (punto, u) => {
                  // Un clic cerca del primer vértice no agrega otro: el área ya cerró y espera su motivo.
                  if (!cierraEnPrimero(dibujoArea, punto, 12 / u.camara.s)) setDibujoArea([...dibujoArea, punto]);
                }
              : enSeleccion
              ? ([x, y]) => {
                  const m = manzanaEnPunto(titulares.map((t) => t.manzana), x, y);
                  if (m) setUmpEnfocada(m.id === umpEnfocada ? null : m.id);
                }
              : enTerritorio
              ? ([x, y]) => {
                  // Clic = ver su ficha, no elegirlo: elegir es con los interruptores.
                  const d = distritoEnPunto(contornos, x, y);
                  setDistritoEnfocado(d && d.ubigeo !== distritoEnfocado ? d.ubigeo : null);
                }
              : undefined
          }
          alMover={enTerritorio ? (punto) => setDistritoBajoCursor(punto ? distritoEnPunto(contornos, punto[0], punto[1])?.ubigeo ?? null : null) : undefined}
        />
        {enSeleccion ? <SeleccionCajon titulares={bloquesTitulares} reemplazos={bloquesReemplazos} cuotas={cuotas} /> : null}
        {enMuestra ? <MuestraCajon cuotas={cuotas} /> : null}
        {enPoblacion && estado ? <PoblacionCajon matriz={matriz} rangos={rangosConfig} sexo={estado.integrated_config.subquota_var !== "ninguna"} zonas={zonas} /> : null}
        <section className="hr-mapa-inspector" aria-label={enTerritorio ? "Territorio" : "Lo decidido"}>
          {enSeleccion && estado ? (
            <SeleccionInspector
              titular={titularEnfocada}
              estado={titularEnfocada ? estados.get(titularEnfocada.id_manzana) ?? "ok" : "ok"}
              reemplazos={bloquesReemplazos}
              revision={revision}
              totales={{ titulares: bloquesTitulares.length, reemplazos: bloquesReemplazos.length, entrevistas: salidas?.sample?.total_entrevistas ?? 0 }}
              onVecina={(paso) => setUmpEnfocada(vecina(grupos, umpEnfocada, paso))}
              salidas={<SalidasPanel config={estado.integrated_config} salidas={salidas} planSupuestos={estado.ui_state?.plan_campo} onGuardarPlan={guardarPlanCampo} onCuotasRepartidas={releerEstado} />}
            />
          ) : enManzanas && estado && configSorteo ? (
            <ManzanasInspector
              guardada={estado.integrated_config}
              config={configSorteo}
              muestra={salidas?.sample ?? null}
              viviendas={territorios.reduce((a, t) => a + t.viviendas, 0)}
              manzanas={territorios.reduce((a, t) => a + t.manzanas, 0)}
              listoParaSortear={Boolean(salidas?.sample_size_preview) && confirmados.length > 0}
              parecido={<ParecidoAlMarco marco={perfilNseMarco} muestra={perfilNseMuestra} />}
              marcoElegible={
                <MarcoElegiblePanel
                  marco={configSorteo.marco_elegible}
                  vista={vistaMarco}
                  cargando={cargandoMarco}
                  deshabilitado={bloqueado || guardando}
                  onCambiar={(me) => setSorteoBorrador({ ...sorteoBorrador, marco_elegible: me })}
                  ruta={configSorteo.entrevistas_por_manzana}
                />
              }
              bloqueado={bloqueado}
              guardando={guardando}
              onSortear={() => void sortear(configSorteo)}
            />
          ) : enMuestra && configMuestra && tamano ? (
            <MuestraInspector config={configMuestra} resultado={tamano} bloqueado={bloqueado} guardando={guardando} hayMuestra={Boolean(salidas?.quota || salidas?.sample)} avisosServidor={salidas?.sample_size_preview?.alerts ?? []} planSupuestos={estado?.ui_state?.plan_campo} margenPara={entradaTamano ? (n) => margenTotalParaN(entradaTamano, n) : undefined} onGuardar={() => void guardarMuestra()} />
          ) : enPoblacion && estado ? (
            <PoblacionInspector
              config={estado.integrated_config}
              rangosConfig={rangosConfig}
              matriz={matriz}
              poblacionDistritos={territorios.reduce((a, t) => a + t.poblacion, 0)}
              bloqueado={bloqueado}
              guardando={guardando}
              hayMuestra={Boolean(salidas?.sample_size_preview || salidas?.sample)}
              onGuardarYCalcular={(c) => void guardarYCalcularPoblacion(c)}
            />
          ) : enTerritorio && estado ? (
            <TerritorioInspector territorios={estado.territories} confirmados={confirmados} bloqueado={bloqueado} guardando={guardando} onConfirmar={(u) => void confirmarTerritorio(u)} viviendasPorNse={viviendasPorNse} marcoMeta={estado.frame_meta} />
          ) : (
            <>
              <header className="hr-mapa-cab">
                <h2>Lo decidido</h2>
              </header>
              <dl className="hr-mapa-filas">
                {decidido.map((i) => (
                  <div key={i.id}>
                    <dt>{i.label}</dt>
                    <dd>{i.value}</dd>
                  </div>
                ))}
              </dl>
            </>
          )}
        </section>
      </div>
    </PageFrame>
  );
}
