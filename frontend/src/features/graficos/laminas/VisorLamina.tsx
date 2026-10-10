// Centro de la pestaña Láminas: la lámina real que va a salir (F6.1; dirección F6 §4.1 «Visor», §4.8 estados).
// La imagen la rasteriza el motor del export (`preview-slide`, vía el coordinador). Ranuras seleccionables sobre la
// imagen, guías, zoom y tira de miniaturas llegan en la parte 2.

import type { CSSProperties, KeyboardEvent, ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  ChevronLeft,
  ChevronRight,
  History,
  ImageOff,
  Images,
  PanelLeftOpen,
  Loader2,
  RefreshCw,
  SlidersHorizontal,
} from "../../../vendor/lucide-react";
import { downloadUrl } from "../../../api/core";
import { IconoTipo } from "../iconos/IconoTipo";
import { DebugPhToggle } from "../GraficosHeader";
import type { LaminaEnEstructura } from "./modeloEstructura";
import { estadoDeLamina, ETIQUETA_ESTADO, motivoDeEstado, type LaminaVisor } from "./estadoLamina";
import type { VistaPreviaLamina } from "./usePreviewLamina";
import { useLaminasUi, type ZoomVisor } from "./laminasStore";
import "./visorLamina.css";

type Props = {
  lamina: LaminaEnEstructura;
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
  /** Tira de miniaturas, bajo el lienzo. */
  tira: ReactNode;
};

const ZOOMS: { valor: ZoomVisor; label: string; factor: number }[] = [
  { valor: "ajustar", label: "Ajustar", factor: 1 },
  { valor: "125", label: "125 %", factor: 1.25 },
  { valor: "150", label: "150 %", factor: 1.5 },
];

export function VisorLamina({
  lamina, total, vista, prepOk, parte, onParte, onIr, motorNativoApagado, onAbrirAjustes, ajustesAbiertos, onVerAvisos, tira,
}: Props) {
  const zoom = useLaminasUi((s) => s.zoom);
  const setZoom = useLaminasUi((s) => s.setZoom);
  const tiraVisible = useLaminasUi((s) => s.tiraVisible);
  const alternarTira = useLaminasUi((s) => s.alternarTira);
  const estructuraVisible = useLaminasUi((s) => s.estructuraVisible);
  const alternarEstructura = useLaminasUi((s) => s.alternarEstructura);
  const factor = ZOOMS.find((z) => z.valor === zoom)?.factor ?? 1;
  const l = vista.lamina;
  const nPartes = l?.partes.length ?? 1;
  const parteActiva = Math.min(parte, nPartes);
  const actual = l?.partes[parteActiva - 1] ?? null;
  const estado = actual?.estado ?? (l ? estadoDeLamina(l) : null);
  const cargando = vista.fase === "esperando" || vista.fase === "cargando";

  const onTecla = (e: KeyboardEvent<HTMLElement>) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === "ArrowLeft" && lamina.posicion > 1) { e.preventDefault(); onIr(lamina.posicion - 1); }
    else if (e.key === "ArrowRight" && lamina.posicion < total) { e.preventDefault(); onIr(lamina.posicion + 1); }
    else if (e.key === "ArrowUp" && parteActiva > 1) { e.preventDefault(); onParte(parteActiva - 1); }
    else if (e.key === "ArrowDown" && parteActiva < nPartes) { e.preventDefault(); onParte(parteActiva + 1); }
  };

  return (
    <section className="pulso-f6-visor" aria-label="Visor de la lámina">
      <header className="pulso-f6-visor-barra">
        {!estructuraVisible && (
          <button
            type="button"
            className="pulso-f6-icono-boton pulso-f6-solo-ancho"
            aria-label="Mostrar la estructura"
            title="Mostrar la estructura"
            onClick={alternarEstructura}
          >
            <PanelLeftOpen size={16} aria-hidden="true" />
          </button>
        )}
        <button type="button" className="pulso-f6-icono-boton" aria-label="Lámina anterior" disabled={lamina.posicion <= 1} onClick={() => onIr(lamina.posicion - 1)}>
          <ChevronLeft size={16} aria-hidden="true" />
        </button>
        <button type="button" className="pulso-f6-icono-boton" aria-label="Lámina siguiente" disabled={lamina.posicion >= total} onClick={() => onIr(lamina.posicion + 1)}>
          <ChevronRight size={16} aria-hidden="true" />
        </button>
        <IconoTipo clase="lamina" tipo={lamina.tipo} size={16} titulo={lamina.tipoLabel} className="pulso-f6-visor-tipo" />
        <p className="pulso-f6-visor-pos" aria-live="polite">
          <strong>Lámina {lamina.posicion} de {total}</strong>
          {nPartes > 1 && <span className="pulso-f6-solo-ancho"> · parte {parteActiva} de {nPartes}</span>}
        </p>
        {estado && !cargando && (
          <span className={`pulso-f6-chip-estado is-${estado === "ruta_anterior" ? "ruta" : estado === "sin_grafico" ? "neutro" : "nativa"}`} title={motivoDeEstado(estado, motorNativoApagado, (l?.avisos.length ?? 0) > 0)}>
            {estado === "ruta_anterior" ? <History size={13} aria-hidden="true" /> : <CheckCircle2 size={13} aria-hidden="true" />}
            {ETIQUETA_ESTADO[estado]}
            <span className="pulso-sr-only">: {motivoDeEstado(estado, motorNativoApagado, (l?.avisos.length ?? 0) > 0)}</span>
          </span>
        )}
        {cargando && prepOk && (
          <span className="pulso-f6-chip-estado is-neutro" role="status">
            <Loader2 size={13} className="pulso-spin" aria-hidden="true" />
            {vista.desactualizada ? "Regenerando" : "Generando"}
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
          <button type="button" className="pulso-f6-boton" onClick={onVerAvisos}>
            <AlertTriangle size={14} aria-hidden="true" />
            {l.avisos.length === 1 ? "1 aviso" : `${l.avisos.length} avisos`}
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
        <span className="pulso-f6-guias pulso-f6-solo-ancho">
          <DebugPhToggle etiqueta="Guías (beta)" />
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
          className="pulso-f6-boton pulso-f6-solo-compacto"
          aria-expanded={ajustesAbiertos}
          aria-controls="pulso-f6-inspector"
          onClick={onAbrirAjustes}
        >
          <SlidersHorizontal size={14} aria-hidden="true" />
          Ajustes
        </button>
      </header>

      <div
        className={`pulso-f6-lienzo${factor > 1 ? " is-zoom" : ""}`}
        style={{ "--pulso-f6-zoom": factor } as CSSProperties}
        tabIndex={0}
        onKeyDown={onTecla}
        aria-label={`Lámina ${lamina.posicion}: ${lamina.titulo}. Flechas izquierda y derecha cambian de lámina${nPartes > 1 ? "; arriba y abajo, de parte" : ""}.`}
      >
        <figure className={`pulso-f6-hoja${cargando && actual?.imagen ? " is-desactualizada" : ""}`}>
          {actual?.imagen ? (
            <img
              src={actual.imagen}
              alt={`Lámina ${lamina.posicion}: ${lamina.titulo}${nPartes > 1 ? `, parte ${parteActiva} de ${nPartes}` : ""}`}
              draggable={false}
            />
          ) : null}
          <EstadoSobreHoja vista={vista} prepOk={prepOk} hayImagen={!!actual?.imagen} />
        </figure>
        {cargando && actual?.imagen && (
          <p className="pulso-f6-lienzo-aviso is-info" role="status">
            <Loader2 size={14} className="pulso-spin" aria-hidden="true" />
            Cambiaste la lámina: lo que ves es la versión anterior mientras el motor la regenera.
          </p>
        )}
        {vista.error && actual?.imagen && (
          <p className="pulso-f6-lienzo-aviso is-error" role="alert">
            <AlertTriangle size={14} aria-hidden="true" />
            No se pudo regenerar; ves la versión anterior.
            <button type="button" className="pulso-f6-texto-boton" onClick={vista.reintentar}>Reintentar</button>
          </p>
        )}
      </div>

      {tiraVisible && tira}
    </section>
  );
}

function BotonesPartes({ lamina, activa, onParte }: { lamina: LaminaVisor; activa: number; onParte: (p: number) => void }) {
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
          {p.indice}{p.continuacion ? " (cont.)" : ""}
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
    return (
      <Tarjeta icono={<ImageOff size={20} aria-hidden="true" />} titulo="No hay con qué dibujar la vista previa">
        El motor generó la lámina, pero este equipo no tiene LibreOffice para convertirla en imagen. La exportación a
        PowerPoint no se ve afectada; la versión de escritorio lo trae incluido.
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
