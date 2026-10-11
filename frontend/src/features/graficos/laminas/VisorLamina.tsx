// Centro de la pestaña Láminas: la lámina real que va a salir (F6.1; dirección F6 §4.1 «Visor», §4.8 estados).
// La imagen la rasteriza el motor del export (`preview-slide`, vía el coordinador). Ranuras seleccionables sobre la
// imagen, zoom y tira de miniaturas (parte 2); guías por capas encima de la hoja (plan F6 §8, `guias/`).

import { useMemo, useRef, type CSSProperties, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Eye,
  ChevronLeft,
  ChevronRight,
  History,
  ImageOff,
  Images,
  ListTree,
  Loader2,
  RefreshCw,
  SlidersHorizontal,
} from "../../../vendor/lucide-react";
import { downloadUrl } from "../../../api/core";
import { IconoTipo } from "../iconos/IconoTipo";
import type { PreviewFormas, Slide } from "../../../api/graficos";
import { MaquetaLamina } from "./MaquetaLamina";
import { ZonasTextoLamina, type CampoTextoLamina } from "./ZonasTextoLamina";
import type { LaminaEnEstructura } from "./modeloEstructura";
import { estadoDeLamina, ETIQUETA_ESTADO, mensajeSinImagen, motivoDeEstado, type LaminaVisor } from "./estadoLamina";
import type { VistaPreviaLamina } from "./usePreviewLamina";
import { useLaminasUi, type ZoomVisor } from "./laminasStore";
import { useMiniaturasLoteStore } from "./miniaturas/miniaturasStore";
import { RanurasSobreLamina } from "./RanurasSobreLamina";
import { ATRIBUTO_LIENZO } from "./selectores/focoAlCerrar";
import type { RanuraSobreLamina } from "./ranurasLamina";
import { BotonGuias } from "./guias/BotonGuias";
import { GuiasSobreLamina } from "./guias/GuiasSobreLamina";
import { useGuiasUi } from "./guias/guiasStore";
import { construirGuias, rolesPresentes } from "./guias/modeloGuias";
import "./visorLamina.css";

type Props = {
  slide: Slide;
  lamina: LaminaEnEstructura;
  /** Se pidió «Ver cómo queda» en esta lámina: corre la vista previa del motor. */
  vistaPedida: boolean;
  onPedirVista: () => void;
  /** Clic en el antetítulo, el título o la base: abre ese campo en los ajustes. */
  onTexto: (campo: CampoTextoLamina) => void;
  total: number;
  vista: VistaPreviaLamina;
  /** La vista previa necesita la base preparada en Analítica. */
  prepOk: boolean;
  parte: number;
  onParte: (parte: number) => void;
  onIr: (posicion: number) => void;
  motorNativoApagado: boolean;
  /** Abre el inspector como sideover (sólo visible en el marco compacto). */
  onAbrirAjustes: () => void;
  ajustesAbiertos: boolean;
  onVerAvisos: () => void;
  ajustesRef: RefObject<HTMLButtonElement>;
  estructuraAbierta: boolean;
  onAlternarEstructura: () => void;
  /** Tira de miniaturas, bajo el lienzo. */
  tira: ReactNode;
  ranuras: readonly RanuraSobreLamina[];
  ranuraActiva: number | null;
  nombreRanura: (k: number) => string;
  onRanura: (k: number | null) => void;
  /** Doble clic en una ranura: abre «¿Qué gráfico?» para ella. */
  onCambiarGrafico: (k: number) => void;
  /** Formas y ranuras del estándar de la vista previa (K11, `normalizePreviewFormas`); sin ellas las guías lo dicen. */
  formas?: PreviewFormas | null;
};

const MOD = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl+";

const ZOOMS: { valor: ZoomVisor; label: string; factor: number }[] = [
  { valor: "ajustar", label: "Ajustar", factor: 1 },
  { valor: "125", label: "125 %", factor: 1.25 },
  { valor: "150", label: "150 %", factor: 1.5 },
];

export function VisorLamina({
  slide, vistaPedida, onPedirVista, onTexto,
  lamina, total, vista, prepOk, parte, onParte, onIr, motorNativoApagado, onAbrirAjustes, ajustesAbiertos, onVerAvisos, ajustesRef, estructuraAbierta, onAlternarEstructura, tira,
  ranuras, ranuraActiva, nombreRanura, onRanura, onCambiarGrafico, formas = null,
}: Props) {
  const zoom = useLaminasUi((s) => s.zoom);
  const setZoom = useLaminasUi((s) => s.setZoom);
  const tiraVisible = useLaminasUi((s) => s.tiraVisible);
  const alternarTira = useLaminasUi((s) => s.alternarTira);

  const factor = ZOOMS.find((z) => z.valor === zoom)?.factor ?? 1;
  const l = vista.lamina;
  const nPartes = l?.partes.length ?? 1;
  const parteActiva = Math.min(parte, nPartes);
  const actual = l?.partes[parteActiva - 1] ?? null;
  const estado = actual?.estado ?? (l ? estadoDeLamina(l) : null);
  const cargando = vista.fase === "esperando" || vista.fase === "cargando";
  // Sin vista previa pedida se muestra la imagen que el lote ya dibujó en segundo plano o, sin ella, la maqueta.
  const imagenLote = useMiniaturasLoteStore((s) => s.entradas[lamina.id]?.imagen ?? null);
  const real = actual?.imagen ?? null;
  const src = real ?? imagenLote;
  const hojaRef = useRef<HTMLElement>(null);
  const capas = useGuiasUi((s) => s.capas);
  const rolesOcultos = useGuiasUi((s) => s.rolesOcultos);
  const resaltada = useGuiasUi((s) => s.resaltada);
  const guias = useMemo(() => construirGuias(formas, parteActiva, capas, rolesOcultos), [formas, parteActiva, capas, rolesOcultos]);
  const rolesGuias = useMemo(() => rolesPresentes(formas?.porParte[parteActiva] ?? [], formas?.ranuras ?? []), [formas, parteActiva]);

  const onTecla = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === "Escape" && ranuraActiva !== null) { e.preventDefault(); onRanura(null); return; }
    if (e.target !== e.currentTarget) return;
    if (e.key === "ArrowLeft" && lamina.posicion > 1) { e.preventDefault(); onIr(lamina.posicion - 1); }
    else if (e.key === "ArrowRight" && lamina.posicion < total) { e.preventDefault(); onIr(lamina.posicion + 1); }
    else if (e.key === "ArrowUp" && parteActiva > 1) { e.preventDefault(); onParte(parteActiva - 1); }
    else if (e.key === "ArrowDown" && parteActiva < nPartes) { e.preventDefault(); onParte(parteActiva + 1); }
    else if (e.key === "Escape" && ranuraActiva !== null) { e.preventDefault(); onRanura(null); }
  };

  return (
    <section className="pulso-f6-visor" aria-label="Visor de la lámina">
      <header className="pulso-f6-visor-barra">
        <button
          type="button"
          className={`pulso-f6-boton${estructuraAbierta ? " is-activo" : ""}`}
          aria-pressed={estructuraAbierta}
          title={`${estructuraAbierta ? "Ocultar" : "Mostrar"} la estructura (${MOD}1)`}
          onClick={onAlternarEstructura}
        >
          <ListTree size={15} aria-hidden="true" />
          <span className="pulso-f6-solo-ancho pulso-f6-rotulo-estrecho">Estructura</span>
        </button>
        <button type="button" className="pulso-f6-icono-boton" aria-label="Lámina anterior" disabled={lamina.posicion <= 1} onClick={() => onIr(lamina.posicion - 1)}>
          <ChevronLeft size={16} aria-hidden="true" />
        </button>
        <button type="button" className="pulso-f6-icono-boton" aria-label="Lámina siguiente" disabled={lamina.posicion >= total} onClick={() => onIr(lamina.posicion + 1)}>
          <ChevronRight size={16} aria-hidden="true" />
        </button>
        <IconoTipo clase="lamina" tipo={lamina.tipo} size={16} titulo={lamina.tipoLabel} className="pulso-f6-visor-tipo" />
        <p className="pulso-f6-visor-pos" aria-live="polite">
          <strong><span className="pulso-f6-rotulo-angosto">Lámina </span>{lamina.posicion} de {total}</strong>
          {nPartes > 1 && <span className="pulso-sr-only"> · parte {parteActiva} de {nPartes}</span>}
        </p>
        {estado && !cargando && (
          <span className={`pulso-f6-chip-estado is-${estado === "ruta_anterior" ? "ruta" : estado === "sin_grafico" ? "neutro" : "nativa"}`} title={motivoDeEstado(estado, motorNativoApagado, (l?.avisos.length ?? 0) > 0)}>
            {estado === "ruta_anterior" ? <History size={13} aria-hidden="true" /> : <CheckCircle2 size={13} aria-hidden="true" />}
            <span className="pulso-f6-rotulo-estrecho">{ETIQUETA_ESTADO[estado]}</span>
            <span className="pulso-sr-only">: {motivoDeEstado(estado, motorNativoApagado, (l?.avisos.length ?? 0) > 0)}</span>
          </span>
        )}
        {cargando && prepOk && (
          <span className="pulso-f6-chip-estado is-neutro" role="status">
            <Loader2 size={13} className="pulso-spin" aria-hidden="true" />
            {vista.desactualizada ? "Regenerando" : "Generando"}
            {vista.progreso?.porcentaje != null ? ` · ${Math.round(vista.progreso.porcentaje)} %` : ""}
            {vista.progreso?.mensaje ? <span className="pulso-sr-only">: {vista.progreso.mensaje}</span> : null}
          </span>
        )}
        {nPartes > 1 && l && (
          <span
            className="pulso-f6-partes-barra"
            role="group"
            aria-label={`Partes de la lámina${l.truncado ? `; la vista muestra las primeras ${nPartes}` : ""}`}
            data-qa-geometry-group="graficos/f6-partes-barra"
            data-qa-geometry-contract="intrinsic"
          >
            <BotonesPartes lamina={l} activa={parteActiva} onParte={onParte} />
          </span>
        )}
        <span className="pulso-f6-col-sp" />
        {l && l.avisos.length > 0 && (
          <button type="button" className="pulso-f6-boton pulso-f6-visor-avisos" onClick={onVerAvisos}>
            <AlertTriangle size={14} aria-hidden="true" />
            {l.avisos.length}
            <span className="pulso-f6-rotulo-medio">{l.avisos.length === 1 ? " aviso" : " avisos"}</span>
          </button>
        )}
        {l?.fileId && vista.fase === "lista" && (
          <a
            className="pulso-f6-icono-boton"
            href={downloadUrl(l.fileId)}
            download={`lamina-${lamina.posicion}.pptx`}
            aria-label="Descargar esta lámina en PowerPoint"
            title="Descargar esta lámina en PowerPoint"
          >
            <Download size={16} aria-hidden="true" />
          </a>
        )}
        {!real && (
          <button
            type="button"
            className="pulso-f6-boton is-primario"
            disabled={!prepOk || (vistaPedida && cargando)}
            title={prepOk ? "Dibuja la lámina como saldrá en el PowerPoint" : "Prepara la base en Analítica para ver cómo queda"}
            onClick={vistaPedida ? vista.reintentar : onPedirVista}
          >
            {vistaPedida && cargando ? <Loader2 size={14} className="pulso-spin" aria-hidden="true" /> : <Eye size={14} aria-hidden="true" />}
            Ver cómo queda
          </button>
        )}
        <span className="pulso-f6-guias">
          <BotonGuias modelo={guias} roles={rolesGuias} disponible={!!formas?.disponible} hayRanuras={(formas?.ranuras.length ?? 0) > 0} />
        </span>
        <label className="pulso-f6-zoom">
          <span className="pulso-sr-only">Zoom de la lámina</span>
          <select value={zoom} onChange={(e) => setZoom(e.target.value as ZoomVisor)}>
            {ZOOMS.map((z) => <option key={z.valor} value={z.valor}>{z.label}</option>)}
          </select>
        </label>
        <button
          type="button"
          className={`pulso-f6-icono-boton pulso-f6-solo-ancho${tiraVisible ? " is-activo" : ""}`}
          aria-pressed={tiraVisible}
          aria-label="Miniaturas"
          title={tiraVisible ? "Ocultar miniaturas" : "Mostrar miniaturas"}
          onClick={alternarTira}
        >
          <Images size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          ref={ajustesRef}
          className={`pulso-f6-boton${ajustesAbiertos ? " is-activo" : ""}`}
          aria-pressed={ajustesAbiertos}
          title={`${ajustesAbiertos ? "Ocultar" : "Mostrar"} los ajustes (${MOD}.)`}
          aria-controls="pulso-f6-inspector"
          onClick={onAbrirAjustes}
        >
          <SlidersHorizontal size={14} aria-hidden="true" />
          <span className="pulso-f6-rotulo-angosto">Ajustes</span>
        </button>
      </header>

      <div
        className={`pulso-f6-lienzo${factor > 1 ? " is-zoom" : ""}`}
        style={{ "--pulso-f6-zoom": factor } as CSSProperties}
        tabIndex={0}
        onKeyDown={onTecla}
        {...{ [ATRIBUTO_LIENZO]: lamina.posicion }}
        aria-label={`Lámina ${lamina.posicion}: ${lamina.titulo}. Flechas izquierda y derecha cambian de lámina${nPartes > 1 ? "; arriba y abajo, de parte" : ""}.`}
      >
        <figure ref={hojaRef} className={`pulso-f6-hoja${cargando && real ? " is-desactualizada" : ""}`}>
          {src ? (
            <img
              src={src}
              alt={`Lámina ${lamina.posicion}: ${lamina.titulo}${nPartes > 1 ? `, parte ${parteActiva} de ${nPartes}` : ""}`}
              draggable={false}
            />
          ) : (
            <MaquetaLamina slide={slide} lamina={lamina} ranuraActiva={ranuraActiva} onRanura={onRanura} onCambiar={onCambiarGrafico} onTexto={onTexto} />
          )}
          {src && <ZonasTextoLamina onTexto={onTexto} sinAntetitulo={slide.tipo === "p_slide_seccion"} />}
          {src && <RanurasSobreLamina ranuras={ranuras} activa={ranuraActiva} nombre={nombreRanura} onRanura={onRanura} onCambiar={onCambiarGrafico} />}
          {/* Las guías son del visor: nunca entran al entregable (D17). Sólo sobre el dibujo real del motor. */}
          {real && !cargando && <GuiasSobreLamina modelo={guias} resaltada={resaltada} hojaRef={hojaRef} />}
        </figure>
        {cargando && (
          <p className="pulso-f6-lienzo-aviso is-info" role="status">
            <Loader2 size={14} className="pulso-spin" aria-hidden="true" />
            Dibujando la lámina…
          </p>
        )}
        {vista.error && (
          <p className="pulso-f6-lienzo-aviso is-error" role="alert">
            <AlertTriangle size={14} aria-hidden="true" />
            No se pudo dibujar la lámina.
            <button type="button" className="pulso-f6-texto-boton" onClick={vista.reintentar}>Reintentar</button>
          </p>
        )}
        {vista.fase === "lista" && l?.sinImagen && (() => {
          const m = mensajeSinImagen(l.motivoSinImagen);
          return (
            <p className="pulso-f6-lienzo-aviso is-error" role="alert">
              <ImageOff size={14} aria-hidden="true" />
              {m.titulo}.
              {m.reintentable && <button type="button" className="pulso-f6-texto-boton" onClick={vista.reintentar}>Reintentar</button>}
            </p>
          );
        })()}
      </div>

      {tiraVisible && tira}
    </section>
  );
}

/** Con tres partes o más los botones no caben junto a los controles de la barra (C4): un selector de ancho fijo. */
const PARTES_EN_SELECTOR = 3;

function BotonesPartes({ lamina, activa, onParte }: { lamina: LaminaVisor; activa: number; onParte: (p: number) => void }) {
  const n = lamina.partes.length;
  if (n >= PARTES_EN_SELECTOR) {
    return (
      <label className="pulso-f6-partes-selector">
        <span className="pulso-sr-only">Parte de la lámina</span>
        <select value={activa} onChange={(e) => onParte(Number(e.target.value))}>
          {lamina.partes.map((p) => (
            <option key={p.indice} value={p.indice}>{`Parte ${p.indice} de ${n}`}</option>
          ))}
        </select>
      </label>
    );
  }
  return (
    <>
      {lamina.partes.map((p) => (
        <button
          key={p.indice}
          type="button"
          className={`pulso-f6-parte${p.indice === activa ? " is-activa" : ""}`}
          aria-pressed={p.indice === activa}
          aria-label={`Parte ${p.indice}${p.continuacion ? ", continuación" : ""}`}
          onClick={() => onParte(p.indice)}
        >
          {p.indice}{p.continuacion && <span className="pulso-f6-rotulo-estrecho"> (cont.)</span>}
        </button>
      ))}
    </>
  );
}

function EstadoSobreHoja({ vista, prepOk, hayImagen }: { vista: VistaPreviaLamina; prepOk: boolean; hayImagen: boolean }) {
  if (hayImagen) return null;
  if (!prepOk) {
    return (
      <Tarjeta icono={<ImageOff size={20} aria-hidden="true" />} titulo="La lámina se ve cuando la base está preparada">
        Prepara los datos en Analítica; el motor necesita la base preparada para dibujar los gráficos.
      </Tarjeta>
    );
  }
  if (vista.fase === "error") {
    return (
      <Tarjeta icono={<AlertTriangle size={20} aria-hidden="true" />} titulo="El motor no pudo generar esta lámina" tono="error">
        <span className="pulso-f6-tarjeta-detalle">{vista.error}</span>
        <button type="button" className="pulso-f6-boton" onClick={vista.reintentar}>
          <RefreshCw size={14} aria-hidden="true" /> Reintentar
        </button>
      </Tarjeta>
    );
  }
  if (vista.fase === "lista" && vista.lamina?.sinImagen) {
    // La causa la dice el backend (`motivo_sin_imagen`): un LibreOffice lento no es un equipo sin LibreOffice.
    const m = mensajeSinImagen(vista.lamina.motivoSinImagen);
    return (
      <Tarjeta icono={<ImageOff size={20} aria-hidden="true" />} titulo={m.titulo}>
        {m.detalle}
        {m.reintentable && (
          <button type="button" className="pulso-f6-boton" onClick={vista.reintentar}>
            <RefreshCw size={14} aria-hidden="true" /> Reintentar
          </button>
        )}
      </Tarjeta>
    );
  }
  return (
    <Tarjeta icono={<Loader2 size={20} className="pulso-spin" aria-hidden="true" />} titulo="Generando la lámina">
      El motor la dibuja igual que en la exportación; puede tardar entre unos segundos y medio minuto.
      <span className="pulso-f6-progreso" aria-hidden="true"><i /></span>
    </Tarjeta>
  );
}

function Tarjeta({ icono, titulo, tono, children }: { icono: JSX.Element; titulo: string; tono?: "error"; children: ReactNode }) {
  return (
    <div className="pulso-f6-hoja-estado" role={tono === "error" ? "alert" : "status"}>
      <div className={`pulso-f6-tarjeta-estado${tono ? ` is-${tono}` : ""}`}>
        {icono}
        <strong>{titulo}</strong>
        <p>{children}</p>
      </div>
    </div>
  );
}
