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
  Plus,
  SlidersHorizontal,
} from "../../../vendor/lucide-react";
import { downloadUrl } from "../../../api/core";
import { PulsoButton } from "../../../components/PulsoButton";
import { PulsoSelect } from "../../../components/PulsoSelect";
import { IconoTipo } from "../iconos/IconoTipo";
import type { PreviewFormas, Slide } from "../../../api/graficos";
import { MaquetaLamina } from "./MaquetaLamina";
import { faltaEnLamina } from "./faltaLamina";
import { varianteDe } from "./selectores/tiposLamina";
import { camposTextoDe, ZonasTextoLamina, zonasPortada, type CampoTextoLamina } from "./ZonasTextoLamina";
import { useGraficosRegistry } from "../useGraficosRegistry";
import { composicionDe } from "../iconos/composicion";
import { SLIDE_GRAF_SLOTS } from "../store";
import type { LaminaEnEstructura } from "./modeloEstructura";
import { estadoDeLamina, ETIQUETA_ESTADO, mensajeSinImagen, motivoDeEstado, type LaminaVisor } from "./estadoLamina";
import type { VistaPreviaLamina } from "./usePreviewLamina";
import { useLaminasUi, type ZoomVisor } from "./laminasStore";
import { useMiniaturasLoteStore } from "./miniaturas/miniaturasStore";
import { RanurasSobreLamina } from "./RanurasSobreLamina";
import { nombreSlot } from "./selectores/etiquetas";
import { ATRIBUTO_LIENZO } from "./selectores/focoAlCerrar";
import type { RanuraSobreLamina } from "./ranurasLamina";
import { BotonGuias } from "./guias/BotonGuias";
import { GuiasSobreLamina } from "./guias/GuiasSobreLamina";
import { useGuiasUi } from "./guias/guiasStore";
import { construirGuias, rolesPresentes } from "./guias/modeloGuias";
import { presentacionPreview } from "./presentacionPreview";
import { useTituloEnLienzo } from "./modeloTituloLienzo";
import { BotonConTecla } from "./BotonConTecla";
import "./visorLamina.css";
import { formatoConteo } from "../../../lib/formatoNumero";

type Props = {
  slide: Slide;
  lamina: LaminaEnEstructura;
  /** «Previsualizar» activo: el dibujo del motor en vez de la maqueta. */
  verComoQueda: boolean;
  onAlternarComoQueda: () => void;
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
  /** «+ Lámina»: abre «¿Qué lámina?» para insertar una nueva después de esta. */
  onInsertarLamina: () => void;
  /** Formas y ranuras del estándar de la vista previa (K11, `normalizePreviewFormas`); sin ellas las guías lo dicen. */
  formas?: PreviewFormas | null;
};


const ZOOMS: { valor: ZoomVisor; label: string; factor: number }[] = [
  { valor: "ajustar", label: "Ajustar", factor: 1 },
  { valor: "125", label: "125 %", factor: 1.25 },
  { valor: "150", label: "150 %", factor: 1.5 },
];

export function VisorLamina({
  slide, verComoQueda, onAlternarComoQueda, onTexto, onInsertarLamina,
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
  // En maqueta no se muestra ninguna imagen; en «cómo queda», la del motor o, mientras llega, la del lote. Con un dato
  // obligatorio pendiente (Q4-4) no hay dibujo que mostrar: la maqueta dice qué falta.
  const falta = faltaEnLamina(slide);
  // Hallazgo 7: mientras llega la imagen nueva, la anterior se queda nítida y la barra dice «Actualizando» (presentacionPreview.ts).
  const presentacion = presentacionPreview({ verComoQueda, falta, fase: vista.fase, imagenMotor: real, imagenLote, error: vista.error });
  const src = presentacion.src;
  const { slidesById } = useGraficosRegistry();
  const camposTexto = useMemo(
    () => camposTextoDe(slide.tipo, slidesById[slide.tipo]?.args, composicionDe(slide.tipo, SLIDE_GRAF_SLOTS[slide.tipo] ?? []).fuente !== "estructura"),
    [slide.tipo, slidesById],
  );
  const hojaRef = useRef<HTMLElement>(null);
  const titulo = useTituloEnLienzo(slide);
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
    // Mientras el motor dibuja la vista previa pedida (U6), la vista no está lista: el QA espera la imagen, no la maqueta.
    <section className="pulso-f6-visor" aria-label="Visor de la lámina" data-audit-ready={cargando && prepOk && verComoQueda ? "false" : "true"}>
      <header className="pulso-f6-visor-barra">
        {/* Acabado W2-A: secundarios con un solo lenguaje de pulsado (aria-pressed); «+ Lámina» es EL primario; ‹ ›,
            descarga y miniaturas son íconos quietos. */}
        <BotonConTecla accion="estructura" ayuda={`${estructuraAbierta ? "Ocultar" : "Mostrar"} la estructura`}>
          <PulsoButton
            variant="secondary"
            className="pulso-f6-visor-estructura"
            aria-pressed={estructuraAbierta}
            aria-label="Estructura"
            onClick={onAlternarEstructura}
          >
            <ListTree aria-hidden="true" />
            <span className="pulso-f6-solo-ancho pulso-f6-rotulo-estrecho">Estructura</span>
          </PulsoButton>
        </BotonConTecla>
        <PulsoButton variant="icon" tone="quiet" aria-label="Lámina anterior" disabled={lamina.posicion <= 1} onClick={() => onIr(lamina.posicion - 1)}>
          <ChevronLeft aria-hidden="true" />
        </PulsoButton>
        <PulsoButton variant="icon" tone="quiet" aria-label="Lámina siguiente" disabled={lamina.posicion >= total} onClick={() => onIr(lamina.posicion + 1)}>
          <ChevronRight aria-hidden="true" />
        </PulsoButton>
        <BotonConTecla accion="insertar" ayuda="Insertar una lámina nueva después de esta">
          <PulsoButton variant="primary" className="pulso-f6-visor-insertar" onClick={onInsertarLamina}>
            <Plus aria-hidden="true" />
            Lámina
          </PulsoButton>
        </BotonConTecla>
        <IconoTipo clase="lamina" tipo={lamina.tipo} size={16} titulo={lamina.tipoLabel} className="pulso-f6-visor-tipo" />
        <p className="pulso-f6-visor-pos" aria-live="polite">
          <strong><span className="pulso-f6-rotulo-angosto">Lámina </span>{lamina.posicion} de {total}</strong>
          {nPartes > 1 && <span className="pulso-sr-only">, parte {parteActiva} de {nPartes}</span>}
        </p>
        {estado && !cargando && (
          <span className={`pulso-f6-chip-estado is-${estado === "ruta_anterior" ? "ruta" : estado === "sin_grafico" ? "neutro" : "nativa"}`} title={motivoDeEstado(estado, motorNativoApagado, (l?.avisos.length ?? 0) > 0)}>
            {estado === "ruta_anterior" ? <History size={13} aria-hidden="true" /> : <CheckCircle2 size={13} aria-hidden="true" />}
            <span className="pulso-f6-rotulo-estrecho">{ETIQUETA_ESTADO[estado]}</span>
            <span className="pulso-sr-only">: {motivoDeEstado(estado, motorNativoApagado, (l?.avisos.length ?? 0) > 0)}</span>
          </span>
        )}
        {presentacion.dibujandoPrimera && prepOk && (
          <span className="pulso-f6-chip-estado is-neutro" role="status">
            <Loader2 size={13} className="pulso-spin" aria-hidden="true" />
            Generando
            {vista.progreso?.porcentaje != null ? `, ${Math.round(vista.progreso.porcentaje)} %` : ""}
            {vista.progreso?.mensaje ? <span className="pulso-sr-only">: {vista.progreso.mensaje}</span> : null}
          </span>
        )}
        {/* R7-2: «Actualizando» va en la barra, junto a «Lámina N de M», como «Generando»; sobre la hoja tapaba la base. */}
        {presentacion.actualizando && (
          <span className="pulso-f6-chip-estado is-neutro pulso-f6-barra-actualizando" role="status">
            <Loader2 size={13} className="pulso-spin" aria-hidden="true" />
            <span className="pulso-f6-rotulo-estrecho">Actualizando</span>
            {vista.progreso?.porcentaje != null ? <span className="pulso-sr-only">, {Math.round(vista.progreso.porcentaje)} %</span> : null}
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
          <PulsoButton variant="secondary" className="pulso-f6-visor-avisos" onClick={onVerAvisos}>
            <AlertTriangle aria-hidden="true" />
            {formatoConteo(l.avisos.length)}
            <span className="pulso-f6-rotulo-medio">{l.avisos.length === 1 ? " aviso" : " avisos"}</span>
          </PulsoButton>
        )}
        {l?.fileId && vista.fase === "lista" && (
          // Un enlace de descarga con la piel del ícono quieto (PulsoButton es un <button>; la descarga es un <a>).
          <a
            className="pulso-button pulso-button--icon pulso-button--md pulso-button--quiet pulso-f6-visor-descargar"
            href={downloadUrl(l.fileId)}
            download={`lamina-${lamina.posicion}.pptx`}
            aria-label="Descargar esta lámina en PowerPoint"
            title="Descargar esta lámina en PowerPoint"
          >
            <Download aria-hidden="true" />
          </a>
        )}
        {/* Previsualizar es un interruptor: secundario pulsado como Estructura y Ajustes, no un relleno del acento. */}
        <PulsoButton
          variant="secondary"
          className="pulso-f6-previsualizar"
          aria-pressed={verComoQueda}
          disabled={!prepOk && !verComoQueda}
          title={prepOk ? (verComoQueda ? "Volver a la maqueta" : "Ver la lámina como saldrá en el PowerPoint") : "Prepara la base en Analítica para previsualizar"}
          onClick={onAlternarComoQueda}
        >
          {verComoQueda && cargando ? <Loader2 className="pulso-spin" aria-hidden="true" /> : <Eye aria-hidden="true" />}
          {/* «Previsualizar» (Gonzalo, 2026-10-14): el dibujo real del PowerPoint vive aquí; el Informe muestra maquetas. */}
          Previsualizar
        </PulsoButton>
        {/* Las guías miden el dibujo del motor: sólo existen al previsualizar, no sobre la maqueta. */}
        {verComoQueda && (
          <span className="pulso-f6-guias">
            <BotonGuias modelo={guias} roles={rolesGuias} disponible={!!formas?.disponible && !cargando} hayRanuras={(formas?.ranuras.length ?? 0) > 0} />
          </span>
        )}
        <span className="pulso-f6-zoom">
          <PulsoSelect
            size="sm"
            ariaLabel="Zoom de la lámina"
            value={zoom}
            onValueChange={(v) => setZoom(v as ZoomVisor)}
            options={ZOOMS.map((z) => ({ value: z.valor, label: z.label }))}
          />
        </span>
        <PulsoButton
          variant="icon"
          tone="quiet"
          className="pulso-f6-solo-ancho"
          aria-pressed={tiraVisible}
          aria-label="Miniaturas"
          title={tiraVisible ? "Ocultar miniaturas" : "Mostrar miniaturas"}
          onClick={alternarTira}
        >
          <Images aria-hidden="true" />
        </PulsoButton>
        <BotonConTecla accion="ajustes" ayuda={`${ajustesAbiertos ? "Ocultar" : "Mostrar"} los ajustes`}>
          <PulsoButton
            variant="secondary"
            ref={ajustesRef}
            aria-pressed={ajustesAbiertos}
            aria-label="Ajustes"
            aria-controls="pulso-f6-inspector"
            onClick={onAbrirAjustes}
          >
            <SlidersHorizontal aria-hidden="true" />
            <span className="pulso-f6-rotulo-angosto">Ajustes</span>
          </PulsoButton>
        </BotonConTecla>
      </header>

      <div
        className={`pulso-f6-lienzo${factor > 1 ? " is-zoom" : ""}`}
        style={{ "--pulso-f6-zoom": factor } as CSSProperties}
        tabIndex={0}
        onKeyDown={onTecla}
        {...{ [ATRIBUTO_LIENZO]: lamina.posicion }}
        aria-label={`Lámina ${lamina.posicion}: ${lamina.titulo}. Flechas izquierda y derecha cambian de lámina${nPartes > 1 ? "; arriba y abajo, de parte" : ""}.`}
      >
        <figure ref={hojaRef} className="pulso-f6-hoja" aria-busy={presentacion.actualizando || undefined}>
          {src ? (
            <img
              src={src}
              alt={`Lámina ${lamina.posicion}: ${lamina.titulo}${nPartes > 1 ? `, parte ${parteActiva} de ${nPartes}` : ""}`}
              draggable={false}
            />
          ) : (
            <MaquetaLamina slide={slide} lamina={lamina} ranuraActiva={ranuraActiva} onRanura={onRanura} onCambiar={onCambiarGrafico} onTexto={onTexto}
              onPrevisualizar={verComoQueda ? undefined : onAlternarComoQueda} prepOk={prepOk} falta={falta} />
          )}
          {src && (() => {
            const portada = zonasPortada(slide.tipo, varianteDe(slide));
            // El título de la cabecera estándar se edita en su caja (hallazgo 12); la portada abre sus campos en Contenido.
            return <ZonasTextoLamina onTexto={onTexto} campos={camposTexto} zonas={portada ?? undefined} titulo={portada ? undefined : titulo} />;
          })()}
          {src && <RanurasSobreLamina ranuras={ranuras} activa={ranuraActiva} nombre={nombreRanura} onRanura={onRanura} onCambiar={onCambiarGrafico}
            lugar={(slot) => nombreSlot(slot, slidesById[slide.tipo])} />}
          {/* Las guías son del visor: nunca entran al entregable (D17). Sólo sobre el dibujo real del motor. */}
          {real && !cargando && <GuiasSobreLamina modelo={guias} resaltada={resaltada} hojaRef={hojaRef} />}
        </figure>
        {presentacion.dibujandoPrimera && (
          <p className="pulso-f6-lienzo-aviso is-info" role="status">
            <Loader2 size={14} className="pulso-spin" aria-hidden="true" />
            Dibujando la lámina…
          </p>
        )}
        {presentacion.error && (
          <p className="pulso-f6-lienzo-aviso is-error" role="alert">
            <AlertTriangle size={14} aria-hidden="true" />
            No se pudo dibujar la lámina.
            <PulsoButton variant="link" size="sm" onClick={vista.reintentar}>Reintentar</PulsoButton>
          </p>
        )}
        {!falta && vista.fase === "lista" && l?.sinImagen && (() => {
          const m = mensajeSinImagen(l.motivoSinImagen);
          return (
            <p className="pulso-f6-lienzo-aviso is-error" role="alert">
              <ImageOff size={14} aria-hidden="true" />
              {m.titulo}.
              {m.reintentable && <PulsoButton variant="link" size="sm" onClick={vista.reintentar}>Reintentar</PulsoButton>}
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
      <span className="pulso-f6-partes-selector">
        <PulsoSelect
          size="sm"
          ariaLabel="Parte de la lámina"
          value={String(activa)}
          onValueChange={(v) => onParte(Number(v))}
          options={lamina.partes.map((p) => ({ value: String(p.indice), label: `Parte ${p.indice} de ${n}` }))}
        />
      </span>
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
