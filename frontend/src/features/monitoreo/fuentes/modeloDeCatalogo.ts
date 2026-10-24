/**
 * El catálogo de encuestas de una cuenta (Kobo o SurveyMonkey) al conectar o
 * cambiar una fuente: de la más reciente a la más antigua, con su código, sus
 * envíos y su fecha, y búsqueda por nombre o código. El de Kobo era una lista
 * de nombres sin orden ni fecha; con 29 formularios no se encontraba el del
 * estudio en campo (RMS, 2026-10-24).
 *
 * Sólo se muestra lo que la API trae: Kobo publica hoy `date_modified`; el
 * número de envíos y el último envío se muestran cuando el backend los
 * entregue (`submission_count`, `last_submission_time`).
 */
import type { MonitoreoKoboAssetItem } from "../../../api/monitoreo";

export type EncuestaDelCatalogo = {
  id: string;
  nombre: string;
  /** ISO de la fecha que ordena: el último envío si lo hay, si no la última modificación. */
  fecha: string | null;
  /** «Último envío» o «Modificada», según de dónde salga la fecha. */
  queFecha: "envio" | "modificada" | null;
  envios: number | null;
  estado: string;
};

type KoboConExtras = MonitoreoKoboAssetItem & { submission_count?: number | null; last_submission_time?: string | null };

export function desdeKobo(assets: readonly KoboConExtras[]): EncuestaDelCatalogo[] {
  return assets.map((asset) => {
    const envio = asset.last_submission_time || null;
    return {
      id: asset.uid,
      nombre: asset.name || asset.uid,
      fecha: envio ?? asset.date_modified ?? null,
      queFecha: envio ? "envio" : asset.date_modified ? "modificada" : null,
      envios: typeof asset.submission_count === "number" ? asset.submission_count : null,
      estado: asset.deployment_active ? "Desplegado" : "Inactivo",
    };
  });
}

export function desdeSurveyMonkey(
  encuestas: ReadonlyArray<{ id: string; title: string; date_modified?: string | null; response_count?: number | null }>,
): EncuestaDelCatalogo[] {
  return encuestas.map((encuesta) => ({
    id: encuesta.id,
    nombre: encuesta.title,
    fecha: encuesta.date_modified ?? null,
    queFecha: encuesta.date_modified ? "modificada" : null,
    envios: typeof encuesta.response_count === "number" ? encuesta.response_count : null,
    estado: "",
  }));
}

function clave(texto: string) {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("es-PE");
}

/** De la más reciente a la más antigua (sin fecha al final), filtrada por nombre o código. */
export function ordenarYBuscar(items: readonly EncuestaDelCatalogo[], termino: string) {
  const buscado = clave(termino.trim());
  const tiempo = (fecha: string | null) => {
    const t = fecha ? Date.parse(fecha) : Number.NaN;
    return Number.isNaN(t) ? Number.NEGATIVE_INFINITY : t;
  };
  return items
    .filter((item) => !buscado || clave(item.nombre).includes(buscado) || clave(item.id).includes(buscado))
    .slice()
    .sort((a, b) => tiempo(b.fecha) - tiempo(a.fecha) || a.nombre.localeCompare(b.nombre, "es"));
}

export function fechaDelCatalogo(fecha: string | null) {
  if (!fecha) return "";
  const t = new Date(fecha);
  if (Number.isNaN(t.getTime())) return fecha;
  return t.toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** La línea de detalle: «aBcD123 · 412 envíos · modificada 23/10/2026 · Desplegado». */
export function detalleDelCatalogo(item: EncuestaDelCatalogo) {
  const partes = [item.id];
  if (item.envios != null) partes.push(`${item.envios.toLocaleString("es-PE")} ${item.envios === 1 ? "envío" : "envíos"}`);
  if (item.fecha) partes.push(`${item.queFecha === "envio" ? "último envío" : "modificada"} ${fechaDelCatalogo(item.fecha)}`);
  if (item.estado) partes.push(item.estado);
  return partes.join(" · ");
}
