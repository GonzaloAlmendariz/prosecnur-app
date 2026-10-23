import type { KeyboardEvent, ReactNode } from "react";
import { enlaceDeFuente, nombreDeFuente } from "../../../fuentes/enlacesDeFuente";
import { acreditacionSourceResponseCount, type AcreditacionPhoneSourceSlot } from "../TelefonicoSourcesModel";
import { sourceRowCount, sourceSheetField, sourceSyncLabel } from "../fuentes/camposDeFuente";
import { fmt, formatDate } from "../formato";
import { ColumnasEsperadas } from "./ColumnasEsperadas";

/**
 * Tarjeta de una pieza del contrato telefónico (universo, barrido o encuesta):
 * volumen, origen con enlace, última lectura, columnas esperadas y «Cambiar
 * conexión». Salió del page-file para que la prueba de claves sin rótulo la
 * alcance; la monta Insumos (Llave y filtros) y el panel de contrato.
 */
export function AcreditacionPhoneSourceSlotCard({
  slot,
  icon,
  syncFallback,
  rowFallback = 0,
  onSelect,
  onCambiar,
}: {
  slot: AcreditacionPhoneSourceSlot;
  icon: ReactNode;
  syncFallback?: string;
  rowFallback?: number;
  onSelect?: () => void;
  /** Abre el panel de conexión sobre la fuente de esta pieza. */
  onCambiar?: () => void;
}) {
  const active = slot.sources.filter((source) => source.enabled);
  const primary = active[0] ?? slot.sources[0] ?? null;
  const statusLabel = slot.status === "ready" ? "Lista" : slot.status === "inactive" ? "Inactiva" : "Pendiente";
  const statusDetail = slot.key === "universo"
    ? "define la base y las cuotas"
    : slot.key === "barrido"
      ? "define responsables y estados"
      : "define avance y cruce CodPulso";
  const rows = slot.sources.reduce((sum, source) => (
    sum + (slot.key === "plataforma" ? acreditacionSourceResponseCount(source) : sourceRowCount(source))
  ), 0) || rowFallback;
  const enlacePrimario = primary ? enlaceDeFuente(primary) : null;
  const syncLabel = primary ? sourceSyncLabel(primary) : "Sin sync";
  const displayedSync = syncLabel === "Sin sync" && slot.ready && syncFallback ? formatDate(syncFallback) : syncLabel;
  const isPlatform = slot.key === "plataforma";
  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!onSelect) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onSelect();
  };
  return (
    <article
      className={`mon-phone-source-slot is-${slot.status}${onSelect ? " is-clickable" : ""}`}
      role={onSelect ? "button" : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
    >
      <div className="mon-phone-source-slot-main">
        <span className="mon-phone-source-slot-icon">{icon}</span>
        <div>
          <strong>{slot.label}</strong>
          <em>{slot.purpose}</em>
        </div>
        <span className="mon-phone-source-slot-status">{statusLabel}</span>
      </div>
      {/* Tres datos, no seis campos de formulario.
        *
        * Decía «Nombre: Barrido», «Abrir: Barrido» y «Pestaña: Barrido ·
        * Barrido!A1:Y2297»: el mismo nombre tres veces y un rango de hoja de
        * cálculo a la vista. Ahora el volumen manda —es lo que se viene a ver—,
        * el origen va en una línea con el enlace por delante y el rango baja al
        * `title`, y «Último sync» pasa a «Actualizada». «Se lee» solo aparece
        * cuando hay más de una fuente, que es cuando dice algo. */}
      <div className="mon-phone-source-slot-data">
        {/* Sin cifra no hay bloque: un «Listo» a 19 px ocupaba el sitio del
          * número y se leía como si fuera el dato. El estado ya lo dice el
          * distintivo de la cabecera. */}
        {rows ? (
          <span className="is-volumen">
            <strong>{fmt(rows)}</strong>
            <em>{isPlatform ? "respuestas" : slot.key === "universo" ? "personas por llamar" : "casos registrados"}</em>
          </span>
        ) : null}
        <span className="is-origen">
          <em>{isPlatform ? "Encuesta" : "Hoja"}</em>
          {enlacePrimario?.estado === "enlace" ? (
            <a
              href={enlacePrimario.href}
              target="_blank"
              rel="noreferrer"
              title={[enlacePrimario.titulo, !isPlatform ? sourceSheetField(primary, "range") : null].filter(Boolean).join(" · ")}
              onClick={(event) => event.stopPropagation()}
            >
              {primary ? nombreDeFuente(primary) : enlacePrimario.texto}
            </a>
          ) : (
            <strong>{enlacePrimario?.mensaje ?? "Sin fuente vinculada"}</strong>
          )}
        </span>
        <span>
          <em>Actualizada</em>
          <strong>{displayedSync}</strong>
        </span>
        {slot.sources.length > 1 ? (
          <span>
            <em>Se leen</em>
            <strong>{fmt(active.length)} de {fmt(slot.sources.length)}</strong>
          </span>
        ) : null}
      </div>
      <ColumnasEsperadas columnas={slot.expected} pieza={slot.label} />
      {/* La única puerta al cableado, y va al panel que ya conoce el guion del
        * estudio. Antes cada pestaña llevaba su propio formulario con la
        * dirección, la pestaña y el rango a la vista: dos caminos para lo mismo,
        * y el de Fuentes sin saber en qué orden pide las piezas este modo. */}
      {onCambiar ? (
        <button
          type="button"
          className="mon-phone-source-slot-cambiar"
          onClick={(event) => { event.stopPropagation(); onCambiar(); }}
        >
          {primary ? "Cambiar conexión" : "Conectar"}
        </button>
      ) : null}
    </article>
  );
}
