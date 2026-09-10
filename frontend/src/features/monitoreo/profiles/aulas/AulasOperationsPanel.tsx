// Operación del plan de cursos-horario — unidad 4.1 (piloto modular).
// Estas acciones profundas vivían en el monolito MonitoreoPage.tsx
// (AulasSourceActions + commandbar de AulasUniversitariasView); se MUEVEN
// aquí sin reescribir la lógica: importar el plan desde el cálculo de
// muestra y recalcular el corte de campo (/api/monitoreo/aulas/sync).
// La agenda y las fichas QR siguen viviendo en Recopiladores: ese flujo
// pertenece al módulo de fichas y este monitoreo solo lo lee.
import { useEffect, useRef, useState } from "react";
import { contar } from "../../fuentes/vocabulario";
import { Download, FileCheck2, FileSpreadsheet, Link2, Loader2, RefreshCw, Target, Upload, UploadCloud } from "../../../../vendor/lucide-react";
import type { MonitoreoAulasConfig, MonitoreoSource } from "../../../../api/client";
import { fmt } from "./kpisDeAulas";
import {
  enlaceParaLeer, enlaceParaPublicar, enlaceRecordado, hayDestinoDelLibro, textoDelRecordado,
} from "./destinoDelLibro";
import "./aulasLibroDestino.css";
import { AulasDosSheets } from "./AulasDosSheets";

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
  /** De qué sorteo viene el plan y cuántas aulas hay listas para traer. Sirve
      para distinguir «no hay nada que importar» de «hay 686 esperando», que es
      justo lo que el hueco de Selección no decía. */
  origen?: { selection_run_id?: string; unidades_disponibles?: number } | null;
  sources: MonitoreoSource[];
  busy: boolean;
  onImportPlan: () => void;
  onSyncField: () => void;
  /** Produce el libro que el equipo llena en Excel y lo descarga. */
  onGenerarLibro: () => void;
  /** Relee el libro que alguien llenó. */
  onImportarLibro: (archivo: File) => void;
  /** Lee el libro desde las tres pestañas de un Google Sheets. Recibe el
   *  destino ya resuelto —el escrito en el campo o el recordado del proyecto—
   *  tal como se copia del navegador; el backend extrae el id. */
  onLeerDeSheets?: (enlace: string) => void;
  /** Publica el libro al Sheets del operativo. Con enlace lo reemplaza y lo
   *  recuerda; `undefined` usa el destino ya recordado en el proyecto. */
  onPublicarASheets?: (enlace?: string) => void;
};

export function AulasOperationsPanel({
  config, sources, busy, origen = null, onImportPlan, onSyncField, onGenerarLibro, onImportarLibro,
  onLeerDeSheets, onPublicarASheets,
}: AulasOperationsPanelProps) {
  const entradaLibro = useRef<HTMLInputElement | null>(null);
  // El destino del Sheets del operativo. El estado DURO —qué enlace quedó
  // recordado— vive en el backend (`libro_sheets` de la config); aquí sólo el
  // borrador de lo que se está escribiendo: `null` = «no tocado, enseña el
  // recordado». Se pega una vez y las dos acciones (leer y publicar) lo usan.
  const recordado = config?.libro_sheets ?? null;
  const recordadoUrl = enlaceRecordado(recordado);
  const [enlaceEditado, setEnlaceEditado] = useState<string | null>(null);
  // Cuando el recordado cambia —típicamente porque la publicación acaba de
  // guardar lo pegado— el borrador se suelta y el campo enseña la URL canónica.
  useEffect(() => {
    setEnlaceEditado(null);
  }, [recordado?.spreadsheet_id]);
  const escrito = (enlaceEditado ?? "").trim();
  // La guarda sale del MISMO módulo que decide qué enlace viaja: calcularla
  // aparte es como se abrió el agujero del panel de los aplicadores.
  const hayDestino = hayDestinoDelLibro(escrito, recordado);
  const sheetsConectado = Boolean(onLeerDeSheets || onPublicarASheets);
  const hayPlan = aulasHayPlan(config);
  // Cuántas trae ese plan, para poder decir de dónde salió cuando no hay corrida.
  const filasDelPlan = config?.plan_rows ?? config?.plan?.length ?? 0;
  const imported = aulasPlanImported(config);
  const methodologyReady = Boolean(config?.frame_hash || Object.keys(config?.methodology ?? {}).length);
  const activeSources = sources.filter((source) => source.enabled);
  // Aulas listas para traer desde el cálculo de muestra, cuando todavía no hay
  // plan. Con plan no se anuncia: ahí lo que importa es de qué corrida viene.
  const esperando = !hayPlan && origen?.selection_run_id
    ? Number(origen.unidades_disponibles) || 0
    : 0;
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
      // Faltaba el tercer caso, y es el más común al abrir un proyecto recién
      // sorteado: NO hay plan y SÍ hay una selección esperando. «Sin corrida
      // importada» valía igual para eso que para un proyecto sin sorteo, así que
      // el hueco no distinguía «no hay nada» de «hay 686 listas y nadie las ha
      // traído».
      hint: config?.selection_run_id
        ? aulasOpsShortId(config.selection_run_id)
        : hayPlan
          ? `${filasDelPlan} del libro · sin corrida de cálculo`
          : esperando
            ? `${fmt(esperando)} cursos-horario sorteados sin traer`
            : "el cálculo de muestra todavía no sorteó aulas",
      ready: imported,
    },
    {
      key: "marco",
      icon: Link2,
      label: "Marco institucional",
      // «Hash listo» / «Sin hash» era jerga del backend en pantalla: `hash` es
      // cómo la app guarda la huella del marco, no algo que el equipo diga en
      // voz alta. La tarjeta de al lado ya había dejado de enseñar
      // `selection_run_id` por la misma razón y ésta se quedó atrás.
      //
      // Lo que el marco institucional ES para quien mira: el padrón de
      // matrícula contra el que se armó la muestra. O está registrado —y
      // entonces se puede comprobar que nadie lo cambió por el camino— o no.
      value: config?.frame_hash ? "Registrado" : "Sin registrar",
      hint: config?.frame_hash
        ? aulasOpsShortId(config.frame_hash)
        : "falta el padrón contra el que se armó la muestra",
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
      // Sin grupo en el `section`: con él, la CABECERA entra como miembro y sus
      // 5 px de holgura se leen como `capacity-drift` del panel. Es la trampa
      // que la norma describe —declarar el grupo en el `section` en vez del
      // wrapper de datos hace que el padding del encabezado se lea como
      // capacidad inflada— y salía igual en cinco paneles del perfil. Lo que hay
      // que vigilar es el contenedor de datos, que declara lo suyo más abajo.
      //
      // El `data-qa-geometry-contract` de aquí abajo es INERTE y se deja a
      // propósito: `ui-quick-check` lee el contrato del mismo elemento que
      // lleva el grupo, así que éste no lo mide nadie. Pero
      // `AulasCompactWorkbenchLayout.test.ts` exige que TODO panel declare su
      // contrato en su etiqueta de apertura, y esa convención documenta qué es
      // el panel aunque el runner no la consuma. Las dos reglas conviven y el
      // conflicto está anotado; quitarlo por «inerte» rompe el test.
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
      {/* Los dos Sheets, dichos juntos y antes de los botones: sus acciones
          viven en dos pantallas y no había dónde ver si los dos estaban al
          día. Sólo cuando el proyecto ya conoce alguno de los dos. */}
      {(config?.libro_sheets || config?.distribucion_sheets) ? (
        <AulasDosSheets config={config} />
      ) : null}
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
            // `contar()` ya antepone el número, así que el rótulo NO lleva
            // artículo: con él salía «a 1 la fuente activa». Visto en el
            // tooltip el 2026-09-09.
            ? `Pide las respuestas nuevas a la plataforma (${contar(activeSources.length, "fuente activa", "fuentes activas")}: ${sourceKinds}) y recalcula el corte de campo`
            : "Primero importa el plan de cursos-horario"}
        >
          {busy ? <Loader2 size={14} className="pulso-spin" /> : <RefreshCw size={14} />}
          {/* **El rótulo promete lo que el botón hace, desde el 2026-09-09.**
              Antes sólo recalculaba con el snapshot que ya había en la sesión, y
              el nombre decía «sincronizar»: dos jornadas devolviendo las mismas
              cifras de la víspera sin nada en pantalla que lo explicara. Ahora
              baja primero de la plataforma; el rótulo se queda porque ya es
              cierto. */}
          <span>Traer respuestas</span>
        </button>
        {/* El ciclo del libro: la app lo produce, alguien lo llena en Excel y la
            app lo relee. Sin estos dos botones sólo se podía cerrar por API.
            Desde el 2026-09-08 «Publicar al Sheets» LEE antes de escribir, así
            que el ciclo completo son dos clics —«Traer respuestas» para traer
            las respuestas y «Publicar al Sheets» para el resto— y no hace falta
            acordarse de «Leer del Sheets» en medio. */}
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
        {/* **La otra puerta del mismo ciclo.**

            El botón de al lado lee el archivo; éste lee la pestaña que el
            equipo llena en línea, que es lo que pasa mientras el operativo está
            en marcha y nadie quiere descargar un `.xlsx` para ver cómo va.

            Va junto a los otros dos y no en un panel propio: son formas de la
            misma operación —cruzar el operativo con lo que el equipo
            escribió— y separarlas obligaría a saber de antemano cuál toca.

            El destino sale del campo de abajo (o del recordado del proyecto):
            el prompt del navegador que vivía aquí pedía el enlace en cada
            lectura y no guardaba nada. */}
        {onLeerDeSheets ? (
          <button
            type="button"
            onClick={() => {
              const destino = enlaceParaLeer(escrito, recordado);
              if (destino) onLeerDeSheets(destino);
            }}
            disabled={busy || !hayPlan || !hayDestino}
            title={!hayPlan
              ? "Primero importa el plan de cursos-horario"
              : !hayDestino
                ? "Pega el enlace del Google Sheets del operativo: sin él no hay de dónde leer"
                : "Lee las tres pestañas del Sheets y actualiza el operativo"}
          >
            {busy ? <Loader2 size={14} className="pulso-spin" /> : <Link2 size={14} />}
            <span>Leer del Sheets</span>
          </button>
        ) : null}
        {/* La vuelta de ese viaje: escribir en el MISMO Sheets lo que la app
            sabe. Sólo donde la app es dueña —«Base de control»—; las dos hojas
            del equipo se siembran una única vez si están vacías y después se
            respetan (regla de Gonzalo: las llenan desde el Sheets, no desde la
            app). Sin destino no dispara un 400: el título dice qué falta. */}
        {onPublicarASheets ? (
          <button
            type="button"
            onClick={() => onPublicarASheets(enlaceParaPublicar(escrito))}
            disabled={busy || !hayPlan || !hayDestino}
            title={!hayPlan
              ? "Primero importa el plan de cursos-horario"
              : !hayDestino
                ? "Pega el enlace del Google Sheets del operativo: sin él no hay dónde publicar"
                : "Lee primero lo que el equipo escribió en sus hojas y luego reescribe las de la app; las cuatro del equipo no se tocan"}
          >
            {busy ? <Loader2 size={14} className="pulso-spin" /> : <UploadCloud size={14} />}
            <span>Publicar al Sheets</span>
          </button>
        ) : null}
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
        {/* El plural iba fijo, y con una sola fuente —el caso corriente de un
            estudio de aulas— la barra decía «1 fuentes activas». */}
        <em>{activeSources.length ? `${contar(activeSources.length, "fuente activa", "fuentes activas")} · ${sourceKinds}` : "Sin fuentes activas conectadas"}</em>
      </div>
      {/* El destino de las dos acciones de Sheets: se pega UNA vez y queda
          recordado en el proyecto (decisión textual de Gonzalo). Va después de
          los botones para que la banda compacta conserve su par rejilla +
          acciones; su hoja lo hace ocupar el ancho entero ahí. El valor enseña
          el recordado hasta que alguien escribe encima; pegar uno nuevo lo
          reemplaza al publicar. */}
      {sheetsConectado ? (
        <div className="aulas-libro-destino">
          <label htmlFor="aulas-libro-destino-enlace">Sheets del operativo</label>
          <input
            id="aulas-libro-destino-enlace"
            type="url"
            spellCheck={false}
            placeholder="Pega el enlace del Google Sheets del libro"
            value={enlaceEditado ?? recordadoUrl}
            onChange={(event) => setEnlaceEditado(event.target.value)}
            disabled={busy}
          />
          <small>{textoDelRecordado(recordado)}</small>
        </div>
      ) : null}
    </section>
  );
}
