/**
 * Ninguna clave de contrato, de modelo o del motor llega a la pantalla sin
 * rótulo.
 *
 * Renderiza las pestañas de Control e Insumos del telefónico con un corte de
 * prueba y revisa el texto que ve el usuario. Falla si un nodo de texto es
 * exactamente una clave conocida en minúscula («atencion», «exacta»,
 * «non_effective»…) o tiene forma de clave (`snake_case`, `kebab-case`). El
 * contenido de `<code>` queda fuera: ahí se pintan nombres de columna, que son
 * datos del estudio.
 *
 * Existe porque dos rechazos seguidos del verificador fueron por claves que se
 * colaron a la UI y que sólo una captura dejaba ver.
 */

import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { MonitoreoAcreditacionReports, MonitoreoSource, MonitoreoState } from "../../../../api/client";
import { buildAcreditacionPhoneSourceContract } from "./TelefonicoSourcesModel";
import { Avisos } from "./control/Avisos";
import { Equipo } from "./control/Equipo";
import { Insistencia } from "./control/Insistencia";
import { BarridoDeLaHoja, RespuestasDelCorte } from "./control/montaje";
import { Estados } from "./insumos/Estados";
import { Fuentes } from "./insumos/Fuentes";
import { LlaveYFiltros } from "./insumos/Llave";
import { ColumnasEsperadas } from "./insumos/ColumnasEsperadas";

// Claves que viven en contratos y modelos del telefónico y que en pantalla
// siempre llevan rótulo.
const CLAVES = [
  // Columnas que espera cada pieza (TelefonicoSourcesModel `expected`).
  "sede", "atencion", "tramite", "origen", "telefono", "responsable", "estado", "intento", "fecha", "observacion",
  "consentimiento", "respuesta", "codpulso",
  // Piezas del contrato y su papel.
  "universo", "barrido", "plataforma", "respuestas",
  // Cruce de la llave y marcas de un envío.
  "exacta", "normalizada", "no cruza", "corta", "repetida", "más de 2 h", "menos de 5 min",
  // Familias del lenguaje común y del definidor.
  "efectiva", "efectivo", "parcial", "rechazo", "reintentable", "terminal", "sin llamar", "otro",
  // Estados del motor.
  "complete", "partial", "refusal", "pending", "excluded",
  // Tipo de regla y nivel.
  "filtro", "regla", "aviso", "alta", "media", "baja",
];

const FORMA_DE_CLAVE = /^[a-z0-9]+([_-][a-z0-9]+)+$/;

function textosVisibles(html: string): string[] {
  return html
    .replace(/<code[^>]*>[\s\S]*?<\/code>/g, " ")
    .replace(/<!-- -->/g, "")
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/g, " ")
    .split(/<[^>]+>/)
    .map((texto) => texto.replace(/&quot;/g, "\"").replace(/&#x27;/g, "'").replace(/&amp;/g, "&").trim())
    .filter(Boolean);
}

function clavesCrudas(html: string): string[] {
  return textosVisibles(html).filter((texto) => CLAVES.includes(texto) || FORMA_DE_CLAVE.test(texto));
}

function pintar(nodo: ReactNode, ruta: string) {
  return renderToStaticMarkup(<MemoryRouter initialEntries={[ruta]}>{nodo}</MemoryRouter>);
}

function bloques(porId: Record<string, Array<Record<string, unknown>>>, alertas: Array<Record<string, unknown>> = []) {
  return {
    schema: "test",
    generated_at: "2026-07-27T09:04:00",
    reference_tabs: [],
    sheets: [
      { id: "monitoreo_telefonico", title: "Telefónico", blocks: Object.entries(porId).map(([id, rows]) => ({ id, title: id, columns: [], rows })) },
      { id: "alertas", title: "Alertas", blocks: [{ id: "alertas", title: "Alertas", columns: [], rows: alertas }] },
    ],
  } as unknown as MonitoreoAcreditacionReports;
}

const alerta = (nivel: string, tipo: string, detalle: string, extra: Record<string, unknown> = {}) => ({
  Nivel: nivel, "Tipo alerta": tipo, "Detalle del tipo de alerta": detalle, Detalle: detalle, Responsable: "", CodPulso: "", ...extra,
});

const REPORTS = bloques({
  resumen_telefonico: [
    { Indicador: "Casos barridos", Casos: 631 },
    { Indicador: "No barridos", Casos: 1665 },
    { Indicador: "Total telefónico", Casos: 2296 },
  ],
  estatus_telefonico: [
    { Estatus: "No barrido", Casos: 1665 },
    { Estatus: "Efectivo", Casos: 222 },
    { Estatus: "No contesta", Casos: 197 },
    { Estatus: "Número suspendido", Casos: 31 },
    { Estatus: "Colgó / Cortó la llamada", Casos: 29 },
    { Estatus: "Rechazo", Casos: 11 },
  ],
  estatus_dia: [
    { Estado: "Efectivo", "1/07/2026": 87, "Sin fecha": 4, Total: 91 },
    { Estado: "No contesta", "2/07/2026": 50, Total: 50 },
  ],
  estatus_responsable: [
    { Responsable: "Op-01", Estado: "Efectivo", Casos: 20 },
    { Responsable: "Op-01", Estado: "No contesta", Casos: 9 },
    { Responsable: "Op-02", Estado: "Rechazo", Casos: 3 },
  ],
  operacion_responsable: [
    { Actor: "ACNUR", Responsable: "Op-01", "Casos asignados": 40, Barridos: 30, "No barridos": 10, "Efectivas telefónicas": 12, "Efectivas Kobo": 14, "Efectiva Kobo sin tel. efectiva": 2, "Sin efectiva": 18 },
    { Actor: "ACNUR", Responsable: "Sin responsable", "Casos asignados": 19, Barridos: 0, "No barridos": 19, "Efectivas Kobo": 0 },
  ],
  reintentos_responsable: [{ Responsable: "Op-01", "Casos reintentables": 10, "Promedio intentos": 3, "No contesta": 6 }],
  no_barridos_responsable: [
    { Responsable: "Op-01", "No barridos": 10 },
    { Responsable: "Sin responsable", "No barridos": 19 },
  ],
  cuotas_variable: [
    { Variable: "Sede", Categoría: "San Juan de Lurigancho (SJL)", Meta: 80, "Efectivas Kobo": 90, Universo: 600 },
  ],
  cola_insistencia: [
    { CodPulso: "PDM1376", Responsable: "Op-01", "Sin asignar": false, Status: "Contactar después", Intentos: 3, Fecha: "2026-07-02", "Observación": "durante la mañana", "Variable cuota": "Sede", Cuota: "SJL", efectiva_kobo: false, dias_sin_registro: 25, "Criterio cola": "Vocabulario del proyecto", Origen: "Backup" },
    { CodPulso: "PDM1999", Responsable: "Sin asignar", "Sin asignar": true, Status: "No contesta", Intentos: "", Fecha: "", "Observación": "", "Variable cuota": "Sede", Cuota: "SJL", efectiva_kobo: true, dias_sin_registro: "", "Criterio cola": "Vocabulario del proyecto" },
  ],
  cola_insistencia_responsables: [
    { Responsable: "Op-01", "Sin asignar": false, "Casos en cola": 1, "Ya efectivas en Kobo": 0, "Promedio intentos": 3, "Sin dato de intentos": 0, "Por llamar": 0 },
  ],
  control_tiempo_kobo: [
    { CodPulso: "PDM1371", "Fecha Kobo": "2026-06-30", "Duración segundos": 365100, "Response ID": "r1" },
    { CodPulso: "PDM1429", "Fecha Kobo": "2026-07-01", "Duración segundos": 960, "Response ID": "r2" },
    { CodPulso: "PDM1429", "Fecha Kobo": "2026-07-01", "Duración segundos": 1020, "Response ID": "r3" },
    { CodPulso: "1218", "Fecha Kobo": "2026-07-01", "Duración segundos": 1680, "Response ID": "r4" },
    { CodPulso: "123456", "Fecha Kobo": "2026-07-01", "Duración segundos": 200, "Response ID": "r5" },
  ],
  comparacion_codpulso: [
    { CodPulso: "PDM1371", Sede: "SJL", "Estado telefónico": "Efectivo", Responsable: "Op-01" },
    { CodPulso: "PDM1429", Sede: "Pueblo Libre (PL)", "Estado telefónico": "Efectivo", Responsable: "Op-02" },
    { CodPulso: "PDM1218", Sede: "Cercado de Lima", "Estado telefónico": "Efectivo", Responsable: "Op-02" },
  ],
}, [
  alerta("Alta", "Efectiva Kobo fuera de base", "Kobo trae una respuesta completa, pero la llave detectada no aparece en la base (codigo:MVH9999).", { CodPulso: "codigo:MVH9999" }),
  alerta("Alta", "cruce_llave_bajo", "Solo 2 de 430 respuestas cruzan con el barrido."),
  alerta("Media", "status_desconocido", "Colgó: 29."),
  alerta("Media", "algo_sin_titulo_conocido", "Un tipo nuevo del motor."),
  alerta("Media", "Responsable con casos por iniciar", "Op-01 tiene 4 casos por iniciar", { Responsable: "Op-01" }),
]);

const hoja = {
  id: "barrido", kind: "google_sheets", label: "11_ACNUR_PDM_Base de barrido", enabled: true, role: "barrido",
  sheet_binding: { spreadsheet_id: "abc", sheet_name: "Barrido", range: "Barrido!A1:Y2297", header_row: 1, last_read_at: "", snapshot_hash: "" },
  dimensions: { sede: "sede", atencion: "atencion" },
} as unknown as MonitoreoSource;
const kobo = {
  id: "kobo", kind: "kobo", label: "PDM", enabled: true, role: "respuestas", survey_title: "Post-Distribution Monitoring",
  declared_person_code_var: "Intro/Pulso_code",
} as unknown as MonitoreoSource;
const apagada = { id: "listado", kind: "google_sheets", label: "Listado", enabled: false } as unknown as MonitoreoSource;

const STATE = {
  synced_at: "2026-07-27T09:04:00",
  sources: [hoja, kobo, apagada],
  variables: [],
  config: {
    operational_model: {
      state_rules: [
        { id: "a", label: "", final_state: "complete", priority: 1, stop_contact: false, outcome_values: ["Efectivo"] },
        { id: "b", label: "", final_state: "non_effective", priority: 2, stop_contact: false, outcome_values: ["No contesta", "Número suspendido"] },
        { id: "c", label: "", final_state: "refusal", priority: 3, stop_contact: true, outcome_values: ["Rechazo"] },
        { id: "estado-numero_invalido", label: "Número inválido", final_state: "numero_invalido", priority: 100, stop_contact: false, outcome_values: ["Número suspendido"] },
      ],
    },
    monitoreo_profile: {
      key_rules: { universe_fields: ["CodPulso", "Telefono1"], response_fields: ["CodPulso"], use_name_fallback: false, automatic_detection: true },
      platform_effective_filter: { enabled: true, variable: "Intro/Consent", values: ["Yes"], label: "Intro/Consent", value_label: "Yes" },
      platform_test_filter: { enabled: true, variable: "Intro/testreal", values: ["test"], label: "Prueba o real" },
    },
  },
} as unknown as MonitoreoState;

const RUTA = "/monitoreo?modo=telefonico";
const nada = () => undefined;

const PESTANAS: Array<[string, () => string]> = [
  ["Control › Barrido", () => pintar(<BarridoDeLaHoja reports={REPORTS} state={STATE} cuotas={[]} />, `${RUTA}&seccion=control&pestana=barrido`)],
  ["Control › Insistencia", () => pintar(<Insistencia reports={REPORTS} state={STATE} />, `${RUTA}&seccion=control&pestana=insistencia`)],
  ["Control › Insistencia con ficha", () => pintar(<Insistencia reports={REPORTS} state={STATE} />, `${RUTA}&seccion=control&pestana=insistencia&panel=caso&foco=PDM1376`)],
  ["Control › Equipo", () => pintar(<Equipo reports={REPORTS} state={STATE} />, `${RUTA}&seccion=control&pestana=equipo`)],
  ["Control › Equipo por estados", () => pintar(<Equipo reports={REPORTS} state={STATE} />, `${RUTA}&seccion=control&pestana=equipo&panel=estados`)],
  ["Control › Respuestas", () => pintar(<RespuestasDelCorte reports={REPORTS} state={STATE} />, `${RUTA}&seccion=control&pestana=respuestas`)],
  ["Control › Avisos", () => pintar(<Avisos reports={REPORTS} onIrA={nada} />, `${RUTA}&seccion=control&pestana=avisos`)],
  ["Insumos › Estados", () => pintar(<Estados reports={REPORTS} state={STATE} onIrA={nada} />, `${RUTA}&seccion=insumos&pestana=estados`)],
  ["Insumos › Llave y filtros", () => pintar(
    <LlaveYFiltros reports={REPORTS} state={STATE} filtro={null} tarjetaKobo={null} onIrA={nada} />,
    `${RUTA}&seccion=insumos&pestana=llave`,
  )],
  ["Tarjetas de fuente (universo, barrido y encuesta)", () => {
    const contrato = buildAcreditacionPhoneSourceContract([hoja, kobo]);
    return pintar(
      <>
        {[contrato.universe, contrato.sweep, contrato.platform].map((slot) => (
          <ColumnasEsperadas key={slot.key} columnas={slot.expected} pieza={slot.label} />
        ))}
      </>,
      `${RUTA}&seccion=insumos&pestana=llave`,
    );
  }],
  ["Insumos › Fuentes", () => {
    const fuentes = [hoja, kobo, apagada];
    return pintar(
      <Fuentes
        state={STATE}
        fuentes={fuentes}
        contrato={buildAcreditacionPhoneSourceContract(fuentes)}
        acciones={null}
        cadena={null}
        onCambiar={nada}
        onRenombrar={async () => undefined}
      />,
      `${RUTA}&seccion=insumos&pestana=fuentes`,
    );
  }],
];

describe("ninguna clave llega a la pantalla sin rótulo", () => {
  it.each(PESTANAS)("%s", (_nombre, render) => {
    const html = render();
    expect(textosVisibles(html).length).toBeGreaterThan(5);
    expect(clavesCrudas(html)).toEqual([]);
  });

  it("el detector reconoce una clave cruda y respeta los nombres de columna en <code>", () => {
    expect(clavesCrudas("<td>atencion</td><td>non_effective</td><td><code>sede</code></td><td>Atención</td>")).toEqual(["atencion", "non_effective"]);
  });
});
