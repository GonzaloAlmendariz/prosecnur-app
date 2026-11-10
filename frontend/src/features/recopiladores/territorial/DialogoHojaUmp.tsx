// La hoja de ruta de una UMP en grande, con «Generar el PDF» (ADR 0118 §1,
// brecha B46; antes «Imprimir o descargar»). El PDF se entrega por el kit de
// entregables (ADR 0133): el botón del pie sólo se deshabilita y el contenedor
// queda al final del cuerpo. Panel direccionable `?panel=hoja&foco=<id_manzana>` sobre
// Territorial › Unidades; cerrar quita sólo el panel y deja la UMP resaltada.
//
// Abrir NO genera nada (Gonzalo, 2026-10-31): se ve la maqueta de la ficha con los
// datos de la UMP; la vista previa real (PNG con el mapa) se pide con un botón.
//
// Contrato de Superficie: diálogo `lg` de alto fijo (C2): el cuerpo es dueño
// de la maqueta, del vacío mientras se genera, del error y de la imagen, con su scroll (C4).

import { useEffect, useState } from "react";

import { urlDelArchivo } from "../../../api/core";
import { apiHojasRutaFichaUmp } from "../../../api/hojasRuta";
import type { UnidadTerritorial } from "../../../api/materialTerritorial";
import { Dialog } from "../../../components/Dialog";
import { ContenedorEntregable } from "../../../components/entregables/ContenedorEntregable";
import { useGeneracion } from "../../../components/entregables/useGeneracion";
import { EstadoVacio } from "../../../components/EstadoVacio";
import { PulsoButton } from "../../../components/PulsoButton";
import { usePanelDireccionable } from "../../../lib/navegacion/paneles";
import { ChevronLeft, ChevronRight, FileText, Loader2, Printer } from "../../../vendor/lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { MODULO_MATERIAL } from "../entregas/modeloEntrega";
import { MaquetaFicha } from "./MaquetaFicha";
import { PANEL_HOJA_UMP } from "./panelesTerritorial";

/** `pdf`: la respuesta del motor cuando la vista previa salió en PDF; se entrega tal cual. */
type Estado = { png: string | null; pdf: unknown; cargando: boolean; error: string };
const INICIAL: Estado = { png: null, pdf: null, cargando: false, error: "" };

function mensaje(e: unknown, porDefecto: string): string {
  return e instanceof Error ? e.message.replace(/ · E_[A-Z_]+$/, "") : porDefecto;
}

type Props = {
  unidad: UnidadTerritorial | null;
  stale: boolean;
  /** M7: la hoja anterior y la siguiente en el orden de la lista (hrefs con el panel abierto). */
  hrefAnterior?: string | null;
  hrefSiguiente?: string | null;
  /** M8: lo que la revisión dice de esta UMP («no alcanza»…); null si está bien. */
  motivo?: string | null;
};

export function DialogoHojaUmp({ unidad, stale, hrefAnterior = null, hrefSiguiente = null, motivo = null }: Props) {
  const { abierto } = usePanelDireccionable(PANEL_HOJA_UMP);
  const navigate = useNavigate();
  // Con el diálogo abierto, ← y → pasan a la hoja anterior o siguiente (revisar 150 hojas sin cerrar y abrir).
  useEffect(() => {
    if (!abierto) return undefined;
    const alPulsar = (ev: KeyboardEvent) => {
      if (ev.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(ev.target.tagName)) return;
      if (ev.key === "ArrowLeft" && hrefAnterior) navigate(hrefAnterior);
      if (ev.key === "ArrowRight" && hrefSiguiente) navigate(hrefSiguiente);
    };
    window.addEventListener("keydown", alPulsar);
    return () => window.removeEventListener("keydown", alPulsar);
  }, [abierto, hrefAnterior, hrefSiguiente, navigate]);
  const [e, setE] = useState<Estado>(INICIAL);
  const id = unidad?.unit_id ?? null;
  const gen = useGeneracion({ titulo: "Hoja de ruta", modulo: MODULO_MATERIAL, formato: "pdf", articulo: "la" });
  const generando = gen.estado.fase === "en_curso";
  const { cerrar } = gen;

  // La vista previa real se genera sólo si se pide; cambiar de UMP vuelve a la maqueta y suelta el
  // contenedor de la anterior (si seguía generando, sigue en la bandeja «Entregables»).
  const [pedida, setPedida] = useState(false);
  useEffect(() => { setPedida(false); cerrar(); }, [id, cerrar]);
  useEffect(() => {
    setE(INICIAL);
    if (!abierto || !id || !pedida) return;
    let vivo = true;
    setE({ ...INICIAL, cargando: true });
    apiHojasRutaFichaUmp(id, "png")
      .then((r) => {
        if (!vivo) return;
        setE({ ...INICIAL, png: r.formato === "png" ? urlDelArchivo(r.file_id) : null, pdf: r.formato === "pdf" ? r : null });
      })
      .catch((err: unknown) => { if (vivo) setE({ ...INICIAL, error: mensaje(err, "No se pudo generar la hoja.") }); });
    return () => { vivo = false; };
  }, [abierto, id, pedida]);

  const generarPdf = () => {
    if (!id) return;
    const yaGenerado = e.pdf;
    void gen.ejecutar(async () => {
      if (yaGenerado) return yaGenerado;
      const r = await apiHojasRutaFichaUmp(id, "pdf");
      setE((s) => ({ ...s, pdf: r }));
      return r;
    }, { titulo: unidad ? `Hoja de ruta de ${unidad.label}` : "Hoja de ruta" });
  };

  return (
    <Dialog
      panel={PANEL_HOJA_UMP}
      size="lg"
      alto="fijo"
      icon={<FileText size={16} />}
      title={unidad ? `Hoja de ruta · ${unidad.label}` : "Hoja de ruta"}
      subtitle={unidad ? [unidad.distrito, unidad.zona ? `zona ${unidad.zona}` : "", unidad.manzana ? `manzana ${unidad.manzana}` : "", unidad.viviendas !== null ? `${unidad.viviendas.toLocaleString("es-PE")} viv.` : "", motivo ?? ""].filter(Boolean).join(" · ") : undefined}
      bodyClassName="rec-terr-hoja-cuerpo"
      footer={(
        <>
          <span className="rec-terr-hoja-pasos">
            {hrefAnterior ? <Link className="rec-terr-hoja-paso" to={hrefAnterior} title="Hoja anterior (←)"><ChevronLeft size={14} aria-hidden /> Anterior</Link> : null}
            {hrefSiguiente ? <Link className="rec-terr-hoja-paso" to={hrefSiguiente} title="Hoja siguiente (→)">Siguiente <ChevronRight size={14} aria-hidden /></Link> : null}
          </span>
          <PulsoButton variant="primary" size="sm" disabled={!unidad || e.cargando || generando} onClick={generarPdf}>
            <Printer size={14} aria-hidden /> Generar el PDF
          </PulsoButton>
        </>
      )}
    >
      {!unidad ? (
        <EstadoVacio
          icono={<FileText size={20} />}
          titulo="Esa UMP no está en la muestra enviada"
          descripcion="Elige una UMP de la lista para ver su hoja."
        />
      ) : null}
      {unidad && stale ? (
        <p className="rec-terr-nota">La muestra cambió en Hojas de ruta desde el envío: la hoja se arma con la muestra vigente.</p>
      ) : null}
      {unidad && !pedida ? (
        <>
          <MaquetaFicha unidad={unidad} />
          <p className="rec-terr-nota rec-terr-hoja-real">
            Esta es la estructura de la ficha.{" "}
            <button type="button" className="rec-terr-hoja-generar" onClick={() => setPedida(true)}>Generar la vista previa real</button>
            {" "}(tarda unos segundos por el mapa).
          </p>
        </>
      ) : null}
      {e.cargando ? (
        <p className="rec-terr-nota rec-terr-generando"><Loader2 size={14} className="pulso-spin" aria-hidden /> Generando la hoja… tarda unos segundos por el mapa.</p>
      ) : null}
      {e.error ? <p className="rec-terr-error" role="alert">{e.error}</p> : null}
      {e.png ? (
        <img className="rec-terr-hoja-img" src={e.png} alt={`Hoja de ruta de ${unidad?.label ?? "la UMP"}`} />
      ) : null}
      {!e.png && e.pdf && !e.cargando ? (
        <p className="rec-terr-nota">La vista previa salió en PDF: se entrega con "Generar el PDF".</p>
      ) : null}
      <ContenedorEntregable estado={gen.estado} forma="bloque" onCerrar={gen.cerrar} />
    </Dialog>
  );
}
