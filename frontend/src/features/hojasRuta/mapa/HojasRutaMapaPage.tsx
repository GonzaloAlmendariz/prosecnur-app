import { useCallback, useEffect, useMemo, useState } from "react";
import { ParecidoAlMarco } from "./manzanas/ParecidoAlMarco";
import { muestraV1 } from "./manzanas/sorteoV1";
import { BookOpenText, Send } from "../../../vendor/lucide-react";
import { apiHojasRutaBitacora } from "../../../api/hojasRuta";
import { codigoDeUmp } from "../seleccion/revisionMarco";
import { conSelectorDeCapa, leyendaLienzo, migaLienzo, SelectorCapa, type SeccionLienzo } from "./lienzo/flotantes";
import { useLocation, useNavigate } from "react-router-dom";
import { PageFrame } from "../../../components/PageFrame";
import { ModuleCommandBar } from "../../../components/ModuleCommandBar";
import { SectionPillbar } from "../../../components/SectionPillbar";
import { ChromeIndicator, ChromeIndicatorGroup } from "../../../components/ChromeIndicator";
import { apiHojasRutaGeometria, apiHojasRutaGuardarConfig, apiHojasRutaMarcoElegiblePreview, apiHojasRutaPersistWorkspace, apiHojasRutaPopulationPreview, apiHojasRutaSamplePreview, apiHojasRutaSampleSizePreview, apiHojasRutaState, type HojasRutaIntegratedConfig, type HojasRutaMarcoElegiblePreview, type HojasRutaRouteSnapshot, type HojasRutaSamplePreview, type HojasRutaState } from "../../../api/hojasRuta";
import { useSeccion } from "../../../lib/navegacion/useDireccion";
import { indicadoresDecididos } from "../chrome/loDecidido";
import peruDepartamentos from "../peruDepartamentos.json";
import { dibujarLimites, dibujarNombresDepartamento, limitesDePeru, type LimitesCrudos } from "./lienzo/limites";
import { useFoco } from "../../../lib/navegacion/useFoco";
import { ciudadAbiertaDeFoco, ciudadDeUbigeo, ciudadesDelAtlas, ciudadesDelEstudio, LIMA, regionesDe } from "./territorio/ciudades";
import { useContornosRegiones } from "./territorio/useContornosRegiones";
import { AtlasEstructura, AtlasInspector, CiudadCabecera, MigaAtlas } from "./territorio/AtlasPaneles";
import { ciudadEnPantalla, dibujarCiudadesAtlas } from "./territorio/atlasCapas";
import { LienzoMapa, type UtilLienzo } from "./lienzo/LienzoMapa";
import { piezasDeGeometria, unirCajas, type PiezaManzana, type PiezasDistrito } from "./lienzo/piezas";
import {
  dibujarContornos,
  dibujarReemplazosMundo,
  dibujarNombresFuera,
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
import { normalizarEnvioMeta } from "../../../api/materialTerritorial";
import { useBarraAngosta } from "./useBarraAngosta";
import { PoblacionCajon } from "./poblacion/PoblacionCajon";
import { FichaManzana } from "./manzanas/FichaManzana";
import { PoblacionEstructura, PoblacionInspector } from "./poblacion/PoblacionPaneles";
import { aplicarBorrador, entradaDesdeConfig } from "./muestra/desdeConfig";
import { calcularTamano, margenTotalParaN } from "./muestra/motorTamano";
import { MuestraEstructura, MuestraInspector } from "./muestra/MuestraPaneles";
import { aplicarSorteo, conInstantanea, instantaneaDeSorteo, parametrosDeSorteo } from "./manzanas/sorteo";
import { causaDeRuteo, type CausaRuteo } from "./manzanas/causaRuteo";
import { ManzanasEstructura, ManzanasInspector } from "./manzanas/ManzanasPaneles";
import { MarcoElegiblePanel } from "./manzanas/MarcoElegiblePanel";
import { cierraEnPrimero, MARCO_NUEVO } from "./manzanas/marcoElegible";
import { proyectarLonLat } from "./lienzo/camara";
import { cajaDelAtlas, departamentoEnPunto } from "./territorio/atlasFoco";
import { revisarSeleccion } from "../seleccion/revisionMarco";
import { estadosPorTitular, manzanaEnPunto, reemplazosDe, rutasPorDistrito, vecina } from "./seleccion/rutas";
import { SeleccionCajon, SeleccionEstructura, SeleccionInspector } from "./seleccion/SeleccionPaneles";
import { SalidasPanel } from "./seleccion/SalidasPanel";
import { useSeleccionDireccion } from "./seleccion/useSeleccionDireccion";
import "./mapaPage.css";
import "./angosto.css";

/**
 * Hojas de ruta con el mapa como lienzo (ADR 0114). Esqueleto de U4: barra del
 * documento en la top bar, estructura, lienzo e inspector, con lo que el
 * estudio ya tiene (territorio confirmado, lo decidido, titulares sorteadas).
 * Cada sección se llena en U5–U10. Se ve sólo con el interruptor encendido.
 */

// Sólo el país y sus departamentos van en el bundle (42 KB); los distritos se piden por región
// para las ciudades en juego (paquete docs/qa/plan-territorio-por-regiones-2026-10-29.md, R4).
const limites = limitesDePeru(peruDepartamentos as LimitesCrudos);
const fmt = (n: number) => new Intl.NumberFormat("es-PE").format(n);

export default function HojasRutaMapaPage() {
  const nav = useSeccion("hojas-ruta");
  const location = useLocation();
  const [estado, setEstado] = useState<HojasRutaState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [geometrias, setGeometrias] = useState<Record<string, PiezasDistrito>>({});
  const [guardando, setGuardando] = useState(false);
  // Al volver a un ruteo: si la muestra que salió es la de entonces, y si no, por qué.
  const [ruteoUsado, setRuteoUsado] = useState<{ id: string; causa: CausaRuteo } | null>(null);
  const { borrador: borradorCrudo, distritoBajoCursor, setBorrador, setDistritoBajoCursor, rangosBorrador, setRangosBorrador, setCortesBorrador, muestraBorrador, setMuestraBorrador, sorteoBorrador, setSorteoBorrador, soloPorRevisar, busquedaUmp, dibujoArea, setDibujoArea, capaMapa, setCapaMapa, distritoEnfocado, setDistritoEnfocado, ciudadEnfocada, setCiudadEnfocada, departamentoEnfocado, setDepartamentoEnfocado, manzanaEnfocada, setManzanaEnfocada } = useLienzoHojasRuta();
  const { umpEnfocada, setUmpEnfocada, cajon } = useSeleccionDireccion();
  const enTerritorio = nav.seccion === "territorio";
  const enPoblacion = nav.seccion === "poblacion";
  const enMuestra = nav.seccion === "muestra";
  const enManzanas = nav.seccion === "manzanas";
  const enSeleccion = nav.seccion === "seleccion";
  // Territorio: atlas de ciudades o una ciudad abierta, según el `foco` («lima» o provincia).
  const [foco, setFoco] = useFoco();
  const ciudadAbierta = enTerritorio ? ciudadAbiertaDeFoco(foco) : null;
  const enAtlas = enTerritorio && !ciudadAbierta;

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
  const atlas = useMemo(() => ciudadesDelAtlas(estado?.territories ?? []), [estado]);
  const enEstudio = useMemo(() => ciudadesDelEstudio(estado?.integrated_config.ciudades, confirmados), [estado, confirmados]);
  // Sólo se piden las regiones de las ciudades en juego: las del estudio, la abierta y las del borrador.
  // La ciudad enfocada en el atlas también carga sus distritos: el zoom los muestra.
  const regiones = useMemo(() => regionesDe([...enEstudio, ...(ciudadAbierta ? [ciudadAbierta] : []), ...(enTerritorio && ciudadEnfocada ? [ciudadEnfocada] : []), ...borrador.map((u) => ciudadDeUbigeo(u) ?? "")]), [enEstudio, ciudadAbierta, enTerritorio, ciudadEnfocada, borrador]);
  const { contornos, cargando: regionesCargando } = useContornosRegiones(regiones);
  // Por ciudad y no por nombre: Arequipa también tiene su Miraflores.
  const zonas = useMemo(() => zonasDeLima(contornos.filter((c) => ciudadDeUbigeo(c.ubigeo) === LIMA)), [contornos]);

  const confirmarTerritorio = useCallback(
    async (ubigeos: string[]) => {
      if (!estado) return;
      setGuardando(true);
      try {
        // Sin salidas: cambiar el territorio invalida población, tamaño, cuotas y muestra.
        await apiHojasRutaPersistWorkspace({ ...estado.integrated_config, territorios: ubigeos, ciudades: ciudadesDelEstudio(estado.integrated_config.ciudades, ubigeos) }, { ...estado.ui_state, draft_territories: ubigeos }, {}, fase);
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

  // Atlas: agregar una ciudad no toca distritos ni salidas (no se manda `outputs`); quitarla saca sus
  // distritos y, si había alguno, invalida población, tamaño y muestra como cualquier cambio de territorio.
  const cambiarCiudades = useCallback(
    async (codigo: string, agregar: boolean) => {
      if (!estado) return;
      setGuardando(true);
      try {
        const deLaCiudad = new Set(atlas.find((c) => c.codigo === codigo)?.ubigeos ?? []);
        const territorios = agregar ? confirmados : confirmados.filter((u) => !deLaCiudad.has(u));
        const ciudadesNuevas = agregar ? [...new Set([...enEstudio, codigo])] : enEstudio.filter((c) => c !== codigo);
        const cambiaTerritorio = territorios.length !== confirmados.length;
        if (cambiaTerritorio) {
          await apiHojasRutaPersistWorkspace({ ...estado.integrated_config, territorios, ciudades: ciudadesNuevas }, { ...estado.ui_state, draft_territories: territorios }, {}, fase);
          setEstado(await apiHojasRutaState());
        } else {
          // F1: sin distritos que sacar no se invalida nada: guardado ligero y el estado se actualiza
          // con la config que devuelve (sin volver a pedir los ~3 MB del estado).
          const r = await apiHojasRutaGuardarConfig({ ...estado.integrated_config, ciudades: ciudadesNuevas }, fase);
          setEstado((prev) => (prev ? { ...prev, integrated_config: r.integrated_config } : prev));
        }
        if (cambiaTerritorio) setBorrador(null);
        if (agregar) setFoco(codigo);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "No se pudo cambiar las ciudades del estudio");
      } finally {
        setGuardando(false);
      }
    },
    [estado, fase, atlas, confirmados, enEstudio, setBorrador, setFoco],
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

  const releerEstado = useCallback(async () => {
    setEstado(await apiHojasRutaState());
  }, []);
  // ADR 0118 F3: el plan por encuestador se arma en Material; aquí sólo el envío.
  const envio = useMemo(() => normalizarEnvioMeta(estado?.envio_meta), [estado]);

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
    async (config: HojasRutaIntegratedConfig): Promise<HojasRutaSamplePreview | null> => {
      if (!estado) return null;
      setGuardando(true);
      try {
        const muestra = await apiHojasRutaSamplePreview(config);
        const nuevo = await apiHojasRutaState();
        const foto = instantaneaDeSorteo(muestra, muestra.config, new Date(), `ruta-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
        await apiHojasRutaPersistWorkspace(nuevo.integrated_config, { ...nuevo.ui_state, route_history: conInstantanea(nuevo.ui_state?.route_history ?? [], foto) }, { ...nuevo.workspace_outputs, quota: muestra.quota ?? nuevo.workspace_outputs?.quota ?? null }, fase);
        setEstado(await apiHojasRutaState());
        setSorteoBorrador(null);
        setRuteoUsado(null);
        return muestra;
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "No se pudo sortear las manzanas");
        return null;
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
    void sortear(aplicarSorteo(estado.integrated_config, parametrosDeSorteo(h.config))).then((m) => m && setRuteoUsado({ id: h.id, causa: causaDeRuteo(h, m) }));
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

  // La ficha de manzana es de la sección donde se abrió: al cambiar de sección no tapa su inspector.
  useEffect(() => { setManzanaEnfocada(null); }, [nav.seccion, setManzanaEnfocada]);
  // Paridad §7: la ficha de cualquier manzana del marco, con su papel en la muestra.
  const manzanaFicha = manzanaEnfocada ? manzanaPorId.get(manzanaEnfocada) ?? null : null;
  const papelEnMuestra = useMemo(() => {
    if (!manzanaFicha) return null;
    const t = bloquesTitulares.find((b) => String(b.id_manzana) === manzanaFicha.id);
    if (t) return { rol: "titular" as const, ump: codigoDeUmp(t) };
    const r = bloquesReemplazos.find((b) => String(b.id_manzana) === manzanaFicha.id);
    return r ? { rol: "reemplazo" as const, ump: codigoDeUmp(r) } : null;
  }, [manzanaFicha, bloquesTitulares, bloquesReemplazos]);
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

  const cajaLima = useMemo(() => atlas.find((c) => c.codigo === LIMA)?.caja ?? null, [atlas]);
  const caja = useMemo(() => unirCajas(contornos.filter((c) => confirmados.includes(c.ubigeo)).map((c) => c.caja)) ?? cajaLima, [contornos, confirmados, cajaLima]);
  // Atlas: el país; ciudad abierta: sus distritos (o su silueta mientras llegan).
  const cajaTerritorio = useMemo(() => {
    // Atlas por niveles: el Perú, un departamento (sus ciudades) o una ciudad (sus distritos).
    if (enAtlas) return cajaDelAtlas({ atlas, departamentos: limites.departamentos, pais: limites.pais[0]?.caja ?? null, departamento: departamentoEnfocado, ciudad: ciudadEnfocada, distritosCiudad: contornos.filter((c) => ciudadDeUbigeo(c.ubigeo) === ciudadEnfocada).map((c) => c.caja) });
    if (!ciudadAbierta) return null;
    return unirCajas(contornos.filter((c) => ciudadDeUbigeo(c.ubigeo) === ciudadAbierta).map((c) => c.caja)) ?? atlas.find((c) => c.codigo === ciudadAbierta)?.caja ?? null;
  }, [enAtlas, ciudadAbierta, contornos, atlas, departamentoEnfocado, ciudadEnfocada]);
  const contornosAbiertos = useMemo(() => (ciudadAbierta ? contornos.filter((c) => ciudadDeUbigeo(c.ubigeo) === ciudadAbierta) : contornos), [contornos, ciudadAbierta]);

  const dibujarFondo = useCallback(
    (ctx: CanvasRenderingContext2D, u: UtilLienzo) => {
      dibujarLimites(ctx, u, limites);
      if (enAtlas) {
        // El departamento enfocado se distingue de las provincias con el acento del módulo.
        const dep = departamentoEnfocado ? limites.departamentos.find((d) => d.nombre === departamentoEnfocado) : null;
        if (dep) {
          ctx.save();
          ctx.strokeStyle = u.colores.acento;
          ctx.lineWidth = 2 * u.px;
          ctx.stroke(u.trazo(dep));
          ctx.restore();
        }
        // En el atlas las ciudades van en pantalla como círculos; la enfocada muestra sus distritos.
        if (ciudadEnfocada) dibujarContornos(ctx, u, contornos.filter((c) => ciudadDeUbigeo(c.ubigeo) === ciudadEnfocada), () => ({ relleno: u.colores.fondo, borde: u.colores.distritoBorde, grosor: 0.9 }));
        return;
      }
      dibujarContornos(ctx, u, enTerritorio ? contornosAbiertos : contornos, (c) => {
        const conf = confirmados.includes(c.ubigeo);
        // B9: cada distrito confirmado lleva su tono, en el orden de confirmación.
        // Población también: su cifra va en el rótulo, no en una rampa de color.
        const tono = tonoDistrito(u, confirmados.indexOf(c.ubigeo));
        if ((enMuestra || enPoblacion) && conf) return { relleno: mezclar(u.colores.distrito, tono, 0.42), borde: u.colores.distritoBorde, grosor: 1.3 };
        if (!enTerritorio) return { relleno: conf ? mezclar(u.colores.distrito, tono, 0.22) : u.colores.fondo, borde: u.colores.distritoBorde, grosor: conf ? 1.3 : 0.8 };
        const enB = borrador.includes(c.ubigeo);
        // F4: en la ciudad abierta, un distrito disponible se lee como elegible (tinte y borde del acento),
        // no como fondo; los del estudio llevan su tono y los que cambian, borde fuerte.
        return {
          relleno: enB && conf ? mezclar(u.colores.distrito, tono, 0.42) : enB ? mezclar(u.colores.distrito, u.colores.acento, 0.3) : mezclar(u.colores.fondo, u.colores.acento, 0.07),
          borde: enB !== conf ? u.colores.acento : enB ? u.colores.distritoBorde : mezclar(u.colores.distritoBorde, u.colores.acento, 0.45),
          grosor: enB !== conf ? 2 : enB ? 1.3 : 1,
          punteado: enB && !conf,
        };
      });
    },
    [confirmados, borrador, enTerritorio, enPoblacion, enMuestra, enAtlas, contornos, contornosAbiertos, ciudadEnfocada, departamentoEnfocado],
  );
  // Sobre Viviendas o NSE la titular va en tinta oscura con halo (si no, se pierde en el naranja).
  const capaContraste = conSelectorDeCapa(nav.seccion as SeccionLienzo) && capaMapa !== "manzanas";
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
      if (!enPoblacion && !enMuestra) dibujarTitularesMundo(ctx, u, titulares, enSeleccion ? umpEnfocada : null, capaContraste);
    },
    [enMuestra, enPoblacion, enTerritorio, enManzanas, enSeleccion, borrador, distritoBajoCursor, distritoEnfocado, titulares, reemplazos, reemplazosEnfocados, umpEnfocada, zonasCortas, distritos, configSorteo, dibujoArea, capaContraste, contornos],
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
      if (enAtlas) {
        dibujarCiudadesAtlas(ctx, u, atlas, enEstudio, ciudadEnfocada);
        // La ciudad enfocada muestra sus distritos con nombre (zoom de ciudad).
        if (ciudadEnfocada) dibujarNombresFuera(ctx, u, contornos.filter((c) => ciudadDeUbigeo(c.ubigeo) === ciudadEnfocada).map((c) => ({ clave: c.ubigeo, nombre: nombreDistrito(c.nombre), x: c.rotulo[0], y: c.rotulo[1] })));
        return;
      }
      dibujarNombresDepartamento(ctx, u, limites);
      if (!enTerritorio && !enPoblacion && !enMuestra) dibujarTitularesPantalla(ctx, u, titulares, enSeleccion ? umpEnfocada : null, null, enSeleccion ? reemplazosEnfocados : [], capaContraste);
      const visibles = enTerritorio ? contornosAbiertos.filter((c) => borrador.includes(c.ubigeo) || confirmados.includes(c.ubigeo)) : contornos.filter((c) => confirmados.includes(c.ubigeo));
      if (enTerritorio) dibujarNombresFuera(ctx, u, contornosAbiertos.filter((c) => !visibles.includes(c)).map((c) => ({ clave: c.ubigeo, nombre: nombreDistrito(c.nombre), x: c.rotulo[0], y: c.rotulo[1] })));
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
    [titulares, confirmados, borrador, enTerritorio, enPoblacion, enMuestra, enSeleccion, umpEnfocada, reemplazosEnfocados, matriz, tamano, habitantes, capaContraste, enAtlas, atlas, enEstudio, ciudadEnfocada, contornos, contornosAbiertos],
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
    // F11: la muestra del reparto v1 se ve desde cualquier sección, no sólo al fondo de Manzanas.
    ...(muestraV1(salidas?.sample?.alerts)
      ? [{ id: "sorteo-v1", label: "Re-sortear", tone: "warn" as const, detail: "Se sorteó con el reparto por zonas anterior y deja manzanas sin probabilidad de salir: vuelve a sortear en Manzanas.", onSelect: () => navegar(`${location.pathname}?seccion=manzanas`) }]
      : []),
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
      label: envio ? (envio.desactualizado ? "Reenviar a Material" : "En Material") : "Enviar a Material",
      icon: Send,
      kind: "secondary" as const,
      rank: 2 as const,
      disabled: !salidas?.sample,
      title: envio ? (envio.desactualizado ? "La muestra cambió desde el envío: reenvíala" : "La muestra está enviada a Material de campo") : "Envía la muestra a Material de campo, que produce las fichas y el paquete",
      // ADR 0118 F3: abre «Entrega», donde se envía y se enlaza la campaña territorial.
      onSelect: () => navegar(`${location.pathname}?seccion=seleccion&panel=salidas`),
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
          {enAtlas && estado ? (
            <AtlasEstructura ciudades={atlas} enEstudio={enEstudio} confirmados={confirmados} enfocada={ciudadEnfocada} departamento={departamentoEnfocado} onEnfocar={setCiudadEnfocada} onAbrir={(c) => setFoco(c)} onTodoPeru={() => { setCiudadEnfocada(null); setDepartamentoEnfocado(null); }} />
          ) : enTerritorio && estado && ciudadAbierta ? (
            <>
              {atlas.find((c) => c.codigo === ciudadAbierta) ? <CiudadCabecera ciudad={atlas.find((c) => c.codigo === ciudadAbierta)!} onVolver={() => { setCiudadEnfocada(ciudadAbierta); setFoco(null); }} /> : null}
              <TerritorioEstructura territorios={estado.territories.filter((t) => ciudadDeUbigeo(t.ubigeo) === ciudadAbierta)} confirmados={confirmados} zonas={ciudadAbierta === LIMA ? zonas : []} bloqueado={bloqueado} />
            </>
          ) : enSeleccion && estado ? (
            <SeleccionEstructura grupos={grupos} total={bloquesTitulares.length} observadas={[...estados.values()].filter((e) => e === "error" || e === "aviso").length} confirmados={confirmados} />
          ) : enManzanas && estado ? (
            <ManzanasEstructura muestra={salidas?.sample ?? null} historial={estado.ui_state?.route_history ?? []} territorios={confirmados} nFinal={salidas?.sample?.total_entrevistas ?? null} cobertura={marcoDeclarado ? vistaMarco?.por_distrito ?? [] : []} bloqueado={bloqueado} guardando={guardando} onUsar={usarRuteo} usado={ruteoUsado} />
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
          miga={enAtlas ? <MigaAtlas total={atlas.length} departamento={departamentoEnfocado} ciudad={atlas.find((c) => c.codigo === ciudadEnfocada) ?? null} distritos={contornos.filter((c) => ciudadDeUbigeo(c.ubigeo) === ciudadEnfocada).length} cargando={regionesCargando.length > 0} onPeru={() => { setCiudadEnfocada(null); setDepartamentoEnfocado(null); }} onDepartamento={(d) => { setCiudadEnfocada(null); setDepartamentoEnfocado(d); }} /> : enTerritorio && ciudadAbierta ? <><b>{atlas.find((c) => c.codigo === ciudadAbierta)?.nombre}</b>{regionesCargando.length ? " · cargando su mapa…" : <span className="hr-lienzo-miga-ayuda"> · clic en un distrito para ver su ficha</span>}</> : migaLienzo(nav.seccion as SeccionLienzo, confirmados.length, titularEnfocada ? { distrito: nombreDistrito(titularEnfocada.distrito), ump: codigoDeUmp(titularEnfocada) } : null, atlas.filter((c) => enEstudio.includes(c.codigo)).map((c) => c.nombre))}
          leyenda={enAtlas ? <><span className="hr-atlas-punto" aria-hidden="true" /> Con cartografía <span className="hr-atlas-punto" data-en-estudio aria-hidden="true" /> En el estudio</> : leyendaLienzo(nav.seccion as SeccionLienzo, { zonasCortas: zonasCortas.size > 0, areas: (configSorteo?.marco_elegible?.areas_excluidas ?? []).length > 0, capa: capaMapa })}
          distritos={enPoblacion || enMuestra ? [] : distritos}
          capa={conSelectorDeCapa(nav.seccion as SeccionLienzo) ? capaMapa : "manzanas"}
          anclaZoom={centroEnfocado}
          controles={!enAtlas && conSelectorDeCapa(nav.seccion as SeccionLienzo) ? <SelectorCapa capa={capaMapa} onCapa={setCapaMapa} /> : undefined}
          encuadreObjetivo={enTerritorio && cajaTerritorio ? { caja: cajaTerritorio, pad: enAtlas ? 0.03 : 0.08, clave: `territorio:${ciudadAbierta ?? `pe:${departamentoEnfocado ?? ""}:${ciudadEnfocada ?? ""}`}:${(ciudadAbierta || ciudadEnfocada) && regionesCargando.length ? "silueta" : "distritos"}`, animar: true } : cajaEnfocada ? { caja: cajaEnfocada, pad: 2.2, clave: `ump:${umpEnfocada}:${cajon ? "cajon" : "libre"}`, animar: true, tapadoAbajo: cajon ? 0.5 : 0 } : caja ? { caja, pad: 0.08, clave: `${nav.seccion}:${confirmados.join(",") || "lima"}:${contornos.some((c) => confirmados.includes(c.ubigeo)) ? "distritos" : "ciudad"}`, animar: false } : null}
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
                  if (m) {
                    setManzanaEnfocada(null);
                    setUmpEnfocada(m.id === umpEnfocada ? null : m.id);
                    return;
                  }
                  // Fuera de una titular: la ficha de esa manzana, cualquiera (paridad §7).
                  const otra = manzanaEnPunto([...manzanaPorId.values()], x, y);
                  setManzanaEnfocada(otra && otra.id !== manzanaEnfocada ? otra.id : null);
                }
              : enManzanas
              ? ([x, y]) => {
                  const m = manzanaEnPunto([...manzanaPorId.values()], x, y);
                  setManzanaEnfocada(m && m.id !== manzanaEnfocada ? m.id : null);
                }
              : enAtlas
              ? ([x, y], u) => {
                  // El mapa informa: un clic abre la tarjeta de la ciudad en el inspector.
                  const [px, py] = u.aPantalla(x, y);
                  const c = ciudadEnPantalla(u, atlas, px, py);
                  if (c) {
                    setCiudadEnfocada(c.codigo !== ciudadEnfocada ? c.codigo : null);
                    return;
                  }
                  // Fuera de una ciudad: el departamento bajo el clic (zoom a sus ciudades); fuera del país, todo el Perú.
                  const d = departamentoEnPunto(limites.departamentos, x, y);
                  setCiudadEnfocada(null);
                  setDepartamentoEnfocado(d && d.nombre !== departamentoEnfocado ? d.nombre : null);
                }
              : enTerritorio
              ? ([x, y]) => {
                  // Clic = ver su ficha, no elegirlo: elegir es con los interruptores.
                  const d = distritoEnPunto(contornosAbiertos, x, y);
                  setDistritoEnfocado(d && d.ubigeo !== distritoEnfocado ? d.ubigeo : null);
                }
              : undefined
          }
          alMover={enTerritorio && ciudadAbierta ? (punto) => setDistritoBajoCursor(punto ? distritoEnPunto(contornosAbiertos, punto[0], punto[1])?.ubigeo ?? null : null) : undefined}
        />
        {enSeleccion ? <SeleccionCajon titulares={bloquesTitulares} reemplazos={bloquesReemplazos} cuotas={cuotas} /> : null}
        {enMuestra ? <MuestraCajon cuotas={cuotas} /> : null}
        {enPoblacion && estado ? <PoblacionCajon matriz={matriz} rangos={rangosConfig} sexo={estado.integrated_config.subquota_var !== "ninguna"} zonas={zonas} config={estado.integrated_config} /> : null}
        <section className="hr-mapa-inspector" aria-label={enTerritorio ? "Territorio" : "Lo decidido"}>
          {(enSeleccion && !titularEnfocada) || enManzanas ? (manzanaFicha ? (
            <FichaManzana
              manzana={manzanaFicha}
              distrito={territorios.find((t) => t.ubigeo === manzanaFicha.ubigeo)?.distrito ?? ""}
              enMuestra={papelEnMuestra}
              minimo={estado?.integrated_config.marco_elegible?.declarado ? estado.integrated_config.marco_elegible.minimo_viviendas ?? 0 : null}
              onCerrar={() => setManzanaEnfocada(null)}
            />
          ) : null) : null}
          {manzanaFicha && ((enSeleccion && !titularEnfocada) || enManzanas) ? null : enSeleccion && estado ? (
            <SeleccionInspector
              enviada={Boolean(envio)}
              rutasPorRevisar={porRevisarTotal}
              minimoMarco={estado?.integrated_config.marco_elegible?.declarado ? estado.integrated_config.marco_elegible.minimo_viviendas ?? 0 : null}
              titular={titularEnfocada}
              estado={titularEnfocada ? estados.get(titularEnfocada.id_manzana) ?? "ok" : "ok"}
              reemplazos={bloquesReemplazos}
              revision={revision}
              totales={{ titulares: bloquesTitulares.length, reemplazos: bloquesReemplazos.length, entrevistas: salidas?.sample?.total_entrevistas ?? 0 }}
              onVecina={(paso) => setUmpEnfocada(vecina(grupos, umpEnfocada, paso))}
              salidas={<SalidasPanel salidas={salidas} envio={envio} onCambio={releerEstado} />}
            />
          ) : enManzanas && estado && configSorteo ? (
            <ManzanasInspector
              guardada={estado.integrated_config}
              config={configSorteo}
              muestra={salidas?.sample ?? null}
              viviendas={territorios.reduce((a, t) => a + t.viviendas, 0)}
              manzanas={territorios.reduce((a, t) => a + t.manzanas, 0)}
              listoParaSortear={Boolean(salidas?.sample_size_preview) && confirmados.length > 0}
              parecido={<ParecidoAlMarco marco={perfilNseMarco} muestra={perfilNseMuestra} causaV1={Boolean(muestraV1(salidas?.sample?.alerts))} />}
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
            <MuestraInspector config={configMuestra} resultado={tamano} bloqueado={bloqueado} guardando={guardando} hayMuestra={Boolean(salidas?.quota || salidas?.sample)} avisosServidor={salidas?.sample_size_preview?.alerts ?? []} margenPara={entradaTamano ? (n) => margenTotalParaN(entradaTamano, n) : undefined} onGuardar={() => void guardarMuestra()} />
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
          ) : enAtlas && estado ? (
            <AtlasInspector
              ciudad={atlas.find((c) => c.codigo === ciudadEnfocada) ?? null}
              enEstudio={Boolean(ciudadEnfocada && enEstudio.includes(ciudadEnfocada))}
              elegidos={confirmados.filter((u) => ciudadDeUbigeo(u) === ciudadEnfocada).length}
              totalCiudades={atlas.length}
              bloqueado={bloqueado}
              guardando={guardando}
              onAgregar={(c) => void cambiarCiudades(c, true)}
              onAbrir={(c) => setFoco(c)}
              onQuitar={(c) => void cambiarCiudades(c, false)}
            />
          ) : enTerritorio && estado ? (
            <TerritorioInspector territorios={estado.territories} confirmados={confirmados} bloqueado={bloqueado} guardando={guardando} onConfirmar={(u) => void confirmarTerritorio(u)} viviendasPorNse={viviendasPorNse} marcoMeta={estado.frame_meta} ciudad={ciudadAbierta ? (() => { const c = atlas.find((x) => x.codigo === ciudadAbierta); return c ? { nombre: c.nombre, ubigeos: c.ubigeos } : null; })() : null} />
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
