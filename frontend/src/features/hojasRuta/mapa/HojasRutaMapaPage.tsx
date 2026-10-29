import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { PageFrame } from "../../../components/PageFrame";
import { ModuleCommandBar } from "../../../components/ModuleCommandBar";
import { SectionPillbar } from "../../../components/SectionPillbar";
import { ChromeIndicator, ChromeIndicatorGroup } from "../../../components/ChromeIndicator";
import { apiHojasRutaGeometria, apiHojasRutaPersistWorkspace, apiHojasRutaState, type HojasRutaState } from "../../../api/hojasRuta";
import { useSeccion } from "../../../lib/navegacion/useDireccion";
import { indicadoresDecididos } from "../chrome/loDecidido";
import cobertura from "../limaDistrictCoverage.json";
import { LienzoMapa, type UtilLienzo } from "./lienzo/LienzoMapa";
import { piezasDeGeometria, unirCajas, type PiezasDistrito } from "./lienzo/piezas";
import {
  contornosDeCobertura,
  dibujarContornos,
  dibujarRotulosDistrito,
  dibujarTitularesMundo,
  dibujarTitularesPantalla,
  type TitularEnMapa,
} from "./lienzo/capas";
import { nombreDistrito } from "./nombres";
import { useLienzoHojasRuta } from "./store";
import { distritoEnPunto } from "./territorio/puntoEnDistrito";
import { TerritorioEstructura, TerritorioInspector } from "./territorio/TerritorioPaneles";
import { zonasDeLima } from "./territorio/zonasLima";
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
  const { borrador: borradorCrudo, distritoBajoCursor, setBorrador, setDistritoBajoCursor } = useLienzoHojasRuta();
  const enTerritorio = nav.seccion === "territorio";

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
  const entrevistasPorRuta = estado?.integrated_config.entrevistas_por_manzana ?? 0;

  const titulares = useMemo<TitularEnMapa[]>(() => {
    const bloques = salidas?.sample?.blocks ?? [];
    const porId = new Map(distritos.flatMap((d) => d.manzanas.map((m) => [m.id, m] as const)));
    return bloques.flatMap((b, i) => {
      const manzana = porId.get(b.id_manzana);
      if (!manzana) return [];
      const estadoUmp = b.viviendas <= 0 ? "error" : b.viviendas <= entrevistasPorRuta ? "aviso" : "ok";
      return [{ id: b.id_manzana, numero: b.hoja_num ?? i + 1, estado: estadoUmp, manzana }];
    });
  }, [salidas, distritos, entrevistasPorRuta]);

  const decidido = indicadoresDecididos({
    distritos: confirmados.length,
    poblacion: territorios.reduce((a, t) => a + t.poblacion, 0),
    n: salidas?.quota?.total_asignado ?? null,
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
        if (!enTerritorio) return { relleno: conf ? u.colores.distrito : u.colores.fondo, borde: u.colores.distritoBorde, grosor: conf ? 1.3 : 0.8 };
        const enB = borrador.includes(c.ubigeo);
        return {
          relleno: enB ? u.colores.distrito : u.colores.fondo,
          borde: enB !== conf ? u.colores.acento : u.colores.distritoBorde,
          grosor: enB !== conf ? 2 : enB ? 1.3 : 0.8,
          punteado: enB && !conf,
        };
      }),
    [confirmados, borrador, enTerritorio],
  );
  const dibujarMundo = useCallback(
    (ctx: CanvasRenderingContext2D, u: UtilLienzo) => {
      if (enTerritorio) {
        ctx.globalAlpha = 0.22;
        ctx.fillStyle = u.colores.acento;
        for (const c of contornos) if (borrador.includes(c.ubigeo)) ctx.fill(u.trazo(c));
        ctx.globalAlpha = 1;
        const bajo = distritoBajoCursor ? contornos.find((c) => c.ubigeo === distritoBajoCursor) : null;
        if (bajo) {
          ctx.strokeStyle = u.colores.texto;
          ctx.lineWidth = 2 * u.px;
          ctx.stroke(u.trazo(bajo));
        }
        return;
      }
      dibujarTitularesMundo(ctx, u, titulares, null);
    },
    [enTerritorio, borrador, distritoBajoCursor, titulares],
  );
  const dibujarPantalla = useCallback(
    (ctx: CanvasRenderingContext2D, u: UtilLienzo) => {
      if (!enTerritorio) dibujarTitularesPantalla(ctx, u, titulares, null, null);
      const visibles = enTerritorio ? contornos.filter((c) => borrador.includes(c.ubigeo) || confirmados.includes(c.ubigeo)) : contornos.filter((c) => confirmados.includes(c.ubigeo));
      if (u.camara.s < 0.09 || enTerritorio) {
        dibujarRotulosDistrito(
          ctx,
          u,
          visibles.map((c) => {
            const enB = borrador.includes(c.ubigeo), conf = confirmados.includes(c.ubigeo);
            const detalle = enTerritorio && enB !== conf ? (enB ? "Se agrega al confirmar" : "Se quita al confirmar") : undefined;
            return { ubigeo: c.ubigeo, nombre: nombreDistrito(c.nombre), detalle, x: c.rotulo[0], y: c.rotulo[1], tono: u.colores.acento };
          }),
        );
      }
    },
    [titulares, confirmados, borrador, enTerritorio],
  );

  const seccionActual = nav.secciones.find((s) => s.id === nav.seccion);
  const chrome = (
    <ModuleCommandBar
      modulo="hojas-ruta"
      className="hojas-ruta-commandbar"
      ariaLabel="Contexto operativo de hojas de ruta"
      contexto={
        <ChromeIndicatorGroup ariaLabel="Lo decidido" resumen={decidido.map((i) => i.detalle).join(" · ")}>
          {decidido.map((i) => (
            <ChromeIndicator key={i.id} label={i.label} value={i.value} detalle={i.detalle} prioridad={i.prioridad} onClick={() => nav.irA("seccion", i.seccion)} />
          ))}
        </ChromeIndicatorGroup>
      }
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
        <section className="hr-mapa-estructura" aria-label="Distritos del estudio">
          {enTerritorio && estado ? (
            <TerritorioEstructura territorios={estado.territories} confirmados={confirmados} zonas={zonas} bloqueado={bloqueado} />
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
          distritos={distritos}
          capa="manzanas"
          encuadreObjetivo={enTerritorio && cajaLima ? { caja: cajaLima, pad: 0.03, clave: "territorio" } : caja ? { caja, pad: 0.08, clave: `${nav.seccion}:${confirmados.join(",") || "lima"}`, animar: false } : null}
          dibujarFondo={dibujarFondo}
          dibujarMundo={dibujarMundo}
          dibujarPantalla={dibujarPantalla}
          alClic={
            enTerritorio && !bloqueado
              ? ([x, y]) => {
                  const d = distritoEnPunto(contornos, x, y);
                  if (d) setBorrador(borrador.includes(d.ubigeo) ? borrador.filter((u) => u !== d.ubigeo) : [...borrador, d.ubigeo]);
                }
              : undefined
          }
          alMover={enTerritorio ? (punto) => setDistritoBajoCursor(punto ? distritoEnPunto(contornos, punto[0], punto[1])?.ubigeo ?? null : null) : undefined}
        />
        <section className="hr-mapa-inspector" aria-label={enTerritorio ? "Territorio" : "Lo decidido"}>
          {enTerritorio && estado ? (
            <TerritorioInspector territorios={estado.territories} confirmados={confirmados} bloqueado={bloqueado} guardando={guardando} onConfirmar={(u) => void confirmarTerritorio(u)} />
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
