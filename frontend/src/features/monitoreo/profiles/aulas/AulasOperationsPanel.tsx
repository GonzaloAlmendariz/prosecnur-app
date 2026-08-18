// Operación del plan de cursos-horario — unidad 4.1 (piloto modular).
// Estas acciones profundas vivían en el monolito MonitoreoPage.tsx
// (AulasSourceActions + commandbar de AulasUniversitariasView); se MUEVEN
// aquí sin reescribir la lógica: importar el plan desde el cálculo de
// muestra y recalcular el corte de campo (/api/monitoreo/aulas/sync).
// La agenda y las fichas QR siguen viviendo en Recopiladores: ese flujo
// pertenece al módulo de fichas y este monitoreo solo lo lee.
import { useRef } from "react";
import { Download, FileCheck2, FileSpreadsheet, Link2, Loader2, RefreshCw, Target, Upload } from "../../../../vendor/lucide-react";
import type { MonitoreoAulasConfig, MonitoreoSource } from "../../../../api/client";

// Movido del monolito (aulasShortId): compacta hashes/run-ids largos.
function aulasOpsShortId(value: unknown, limit = 18) {
  const text = String(value ?? "").trim();
  if (!text) return "pendiente";
  if (text.length <= limit) return text;
  return `${text.slice(0, 8)}…${text.slice(-6)}`;
}

export function aulasPlanImported(config: MonitoreoAulasConfig | null | undefined) {
  return Boolean(config?.enabled && config?.selection_run_id);
}

/**
 * Si hay plan del que producir el libro.
 *
 * NO es `aulasPlanImported`: eso exige `selection_run_id`, que sólo trae un plan
 * venido del cálculo de muestra. Un plan que llegó por el propio libro Excel no
 * lo tiene, así que exigirlo dejaba el ciclo cerrado sobre sí mismo — importas
 * 196 aulas y no puedes regenerar el libro—. Para producir el Excel basta con
 * que haya unidades.
 */
export function aulasHayPlan(config: MonitoreoAulasConfig | null | undefined) {
  // `plan_rows` en vez de `plan.length`: el plan dejo de viajar en la config
  // —333 KB de 934 para responder «cuantas unidades hay»— y el backend manda el
  // conteo. El `plan?.length` se conserva de respaldo porque otras respuestas
  // (import-from-calc-muestra, config) si devuelven la config con su plan.
  const filas = config?.plan_rows ?? config?.plan?.length ?? 0;
  return Boolean(config?.enabled && filas > 0);
}

export type AulasOperationsPanelProps = {
  config: MonitoreoAulasConfig | null;
  sources: MonitoreoSource[];
  busy: boolean;
  onImportPlan: () => void;
  onSyncField: () => void;
  /** Produce el libro que el equipo llena en Excel y lo descarga. */
  onGenerarLibro: () => void;
  /** Relee el libro que alguien llenó. */
  onImportarLibro: (archivo: File) => void;
};

export function AulasOperationsPanel({
  config, sources, busy, onImportPlan, onSyncField, onGenerarLibro, onImportarLibro,
}: AulasOperationsPanelProps) {
  const entradaLibro = useRef<HTMLInputElement | null>(null);
  const hayPlan = aulasHayPlan(config);
  // Cuántas trae ese plan, para poder decir de dónde salió cuando no hay corrida.
  const filasDelPlan = config?.plan_rows ?? config?.plan?.length ?? 0;
  const imported = aulasPlanImported(config);
  const methodologyReady = Boolean(config?.frame_hash || Object.keys(config?.methodology ?? {}).length);
  const activeSources = sources.filter((source) => source.enabled);
  const sourceKinds = Array.from(new Set(activeSources.map((source) => source.kind).filter(Boolean))).join(" · ") || "sin fuentes";
  const cards = [
    {
      key: "seleccion",
      icon: Target,
      label: "Selección",
      value: imported ? "Conectada" : "Pendiente",
      // Sin corrida, aquí se leía «selection_run_id»: el nombre del campo del
      // backend, no algo que el usuario pueda accionar.
      //
      // Y «sin corrida importada» a secas, con las 196 aulas del plan en el KPI
      // de dos dedos más arriba, se lee como que la vista se contradice. No se
      // contradice: hay plan y NO hay corrida, porque un plan puede llegar por
      // dos caminos y el del libro no trae `selection_run_id` —la distinción ya
      // está escrita en `aulasHayPlan` y no llegaba a la pantalla—. Decir por
      // cuál llegó es lo que convierte el hueco en información.
      hint: config?.selection_run_id
        ? aulasOpsShortId(config.selection_run_id)
        : hayPlan
          ? `${filasDelPlan} del libro · sin corrida de cálculo`
          : "sin corrida importada",
      ready: imported,
    },
    {
      key: "marco",
      icon: Link2,
      label: "Marco institucional",
      value: config?.frame_hash ? "Hash listo" : "Sin hash",
      hint: config?.frame_hash ? aulasOpsShortId(config.frame_hash) : "requiere marco",
      ready: Boolean(config?.frame_hash),
    },
    {
      key: "metodologia",
      icon: FileCheck2,
      label: "Metodología",
      value: methodologyReady ? "Trazable" : "Pendiente",
      hint: "semilla, cuotas y bitácora",
      ready: methodologyReady,
    },
  ];
  return (
    <section
      className="mon-profile-panel aulas-ops-panel"
      aria-label="Operación del plan de cursos-horario"
      data-qa-geometry-group="monitoring-aulas-operacion"
      data-qa-geometry-contract="intrinsic"
    >
      <div className="mon-profile-panel-head">
        <h3>Operación del plan</h3>
        <span>{imported ? "plan conectado" : "plan pendiente"}</span>
      </div>
      <div
        className="aulas-ops-grid"
        data-qa-geometry-group="monitoring-aulas-operations"
        data-qa-geometry-contract="equal"
      >
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <article key={card.key} className={card.ready ? "is-ready" : "is-waiting"}>
              <i aria-hidden="true"><Icon size={14} /></i>
              <span>{card.label}</span>
              <strong>{card.value}</strong>
              <small>{card.hint}</small>
            </article>
          );
        })}
      </div>
      <div className="aulas-ops-actions">
        <button
          type="button"
          onClick={onImportPlan}
          disabled={busy}
          title="Importar titulares y reservas desde el cálculo de muestra de cursos-horario"
        >
          {busy ? <Loader2 size={14} className="pulso-spin" /> : <Download size={14} />}
          <span>Importar plan</span>
        </button>
        <button
          type="button"
          className="is-primary"
          onClick={onSyncField}
          disabled={busy || !imported}
          title={imported
            ? `Recalcular el corte de campo (${activeSources.length} fuentes activas: ${sourceKinds})`
            : "Primero importa el plan de cursos-horario"}
        >
          {busy ? <Loader2 size={14} className="pulso-spin" /> : <RefreshCw size={14} />}
          <span>Sincronizar campo</span>
        </button>
        {/* El ciclo del libro: la app lo produce, alguien lo llena en Excel y la
            app lo relee. Sin estos dos botones sólo se podía cerrar por API. */}
        <button
          type="button"
          onClick={onGenerarLibro}
          disabled={busy || !hayPlan}
          title={hayPlan
            ? "Generar el Excel de tres hojas para que el equipo lo llene"
            : "Primero importa el plan de cursos-horario"}
        >
          {busy ? <Loader2 size={14} className="pulso-spin" /> : <FileSpreadsheet size={14} />}
          <span>Generar libro</span>
        </button>
        <button
          type="button"
          onClick={() => entradaLibro.current?.click()}
          // Ya funciona: el archivo sube por `/api/files/upload`, que digiere
          // binarios sin pelearse con el parser multipart, y al endpoint le
          // llega el `file_id` que acepta desde el primer día.
          disabled={busy || !hayPlan}
          title={hayPlan
            ? "Lee un libro llenado y actualiza el operativo con lo que traiga"
            : "Primero importa el plan de cursos-horario"}
        >
          {busy ? <Loader2 size={14} className="pulso-spin" /> : <Upload size={14} />}
          <span>Leer libro llenado</span>
        </button>
        <input
          ref={entradaLibro}
          type="file"
          accept=".xlsx,.xls,.xlsm"
          hidden
          onChange={(event) => {
            const archivo = event.target.files?.[0];
            // El valor se limpia para que elegir el MISMO archivo dos veces
            // vuelva a disparar el cambio.
            event.target.value = "";
            if (archivo) onImportarLibro(archivo);
          }}
        />
        <em>{activeSources.length ? `${activeSources.length} fuentes activas · ${sourceKinds}` : "Sin fuentes activas conectadas"}</em>
      </div>
    </section>
  );
}
