/**
 * Ninguna clave del motor llega a la pantalla de Acreditación sin rótulo.
 *
 * Renderiza las pestañas ya rediseñadas (Avance › Resumen, Avance › Por
 * público con su inspector, la cabecera y el rail) con un corte de prueba y
 * revisa el texto visible. Falla si un nodo de texto es una clave conocida en
 * minúscula o tiene forma de clave (`snake_case`, `kebab-case`). Es el
 * equivalente de `profiles/telefonico/clavesSinRotulo.test.tsx`; cada fase
 * del revamp suma aquí sus pestañas.
 */

import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { MonitoreoCorte } from "../../corte/corteContract";
import { PorPublicoVista } from "./avance/PorPublico";
import { ResumenVista } from "./avance/Resumen";
import { advanceCardsFromRows } from "./avance/tarjetasDeAvance";
import { CabeceraAcreditacion, RailAcreditacion } from "./navegacion/ChromeAcreditacion";
import { disponibilidad, pestanasDelRail } from "./navegacion/modeloDelRail";
import { casosDelCorte } from "./control/casos/tiposDeCaso";
import { SECCIONES_ACREDITACION, pestanasDeSeccion, vistaPrincipal } from "./navegacion/direccionAcreditacion";

const CLAVES = [
  // Tipos de caso del motor y su grupo.
  "fuera_base", "sin_llave", "conflicto_telefonico", "parcial_no_identificable", "duplicado_caso",
  "parcial_identificable", "rechazo_plataforma", "incluido_con_salvedad", "espera", "decidido", "regla",
  // Estados de avance del motor.
  "effective", "partial", "refusal", "pending", "excluded", "efectiva", "parcial", "rechazo", "sin-respuesta",
  // Claves de la dirección.
  "insumos", "modelo", "control", "avance", "publicos", "resolver", "reintentos", "personas", "respuestas",
  "dim_actor",
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

function pintar(nodo: ReactNode, ruta = "/monitoreo?modo=acreditacion&seccion=avance&pestana=publicos") {
  return renderToStaticMarkup(<MemoryRouter initialEntries={[ruta]}>{nodo}</MemoryRouter>);
}

const ACTORES = [
  { Actor: "Egresados", Universo: 270, Efectivas: 178, Parciales: 5, "Rechazos plataforma": 0, "Sin respuesta": 87 },
  { Actor: "Estudiantes", Universo: 180, Efectivas: 173, Parciales: 3, "Rechazos plataforma": 1, "Sin respuesta": 3 },
  { Actor: "Piloto", Universo: 7, Efectivas: 2, Parciales: 0, "Rechazos plataforma": 0, "Sin respuesta": 5 },
];
const GOALS = [
  { id: "egr", label: "Egresados", meta: 108, filters: { dim_actor: "Egresados" } },
  { id: "est", label: "Estudiantes", meta: 126, filters: { dim_actor: "Estudiantes" } },
];
const TARJETAS = advanceCardsFromRows(ACTORES, GOALS as never);
const DIARIO = [
  { Fecha: "2026-05-25", Efectivas: 25, Acumulado: 25 },
  { Fecha: "2026-05-26", Efectivas: 0, Acumulado: 25 },
  { Fecha: "2026-05-27", Efectivas: 80, Acumulado: 105 },
];
const DIARIO_PUBLICO = [
  { Actor: "Egresados", Fecha: "2026-05-25", Efectivas: 10 },
  { Actor: "Estudiantes", Fecha: "2026-05-27", Efectivas: 80 },
];
const FUENTES = [
  { Actor: "Egresados", Canal: "Telefónico", Efectivas: 117 },
  { Actor: "Egresados", Canal: "Correo", Efectivas: 61 },
];
const ISSUES = [
  { issue_type: "fuera_base", label: "Llave fuera de base", count: 11, actor: "Egresados" },
  { issue_type: "sin_llave", label: "", count: 2, actor: "Estudiantes" },
  { issue_type: "incluido_con_salvedad", label: "Incluido con salvedad", count: 3, actor: "Egresados" },
  { issue_type: "tipo_nuevo_del_motor", label: "tipo_nuevo_del_motor", count: 1, actor: "Egresados" },
].map((issue) => ({ ...issue, severity: "", case_key: "", response_id: "", detail: "" }));
const CORTE = {
  hasSnapshot: true, ingesta: 488, procesable: 470, oficial: 418, saltos: [],
} as unknown as MonitoreoCorte;

describe("Acreditación: claves sin rótulo", () => {
  it("Avance › Resumen", () => {
    const html = pintar(<ResumenVista tarjetas={TARJETAS} diarioGeneral={DIARIO} diarioPorPublico={DIARIO_PUBLICO} corte={CORTE} casos={casosDelCorte(ISSUES)} />);
    expect(html).toContain("Respuesta sin llave");
    expect(html).toContain("Tipo nuevo del motor");
    expect(clavesCrudas(html)).toEqual([]);
  });

  it("Avance › Por público con el inspector abierto", () => {
    const barridos = new Map([["egresados", { asignados: 270, barridos: 254, noBarridos: 16, efectivasAlTelefono: 141 }]]);
    const html = pintar(
      <PorPublicoVista tarjetas={TARJETAS} diarioGeneral={DIARIO} diarioPorPublico={DIARIO_PUBLICO} fuentes={FUENTES} issues={ISSUES} barridos={barridos} />,
      "/monitoreo?modo=acreditacion&seccion=avance&pestana=publicos&panel=publico&foco=Egresados",
    );
    expect(html).toContain("Barrido telefónico");
    expect(html).toContain("Asignadas por el supervisor");
    expect(clavesCrudas(html)).toEqual([]);
  });

  it("cabecera y rail de las cuatro secciones", () => {
    for (const seccion of SECCIONES_ACREDITACION) {
      for (const pestana of pestanasDeSeccion(seccion)) {
        const activa = vistaPrincipal(seccion, pestana)!;
        const pestanas = pestanasDelRail(seccion, () => [], disponibilidad({ correo: true, barrido: true }));
        const html = pintar(
          <>
            <CabeceraAcreditacion seccion={seccion} pestana={pestana} activa={activa} onElegirVista={() => undefined} />
            <RailAcreditacion seccion={seccion} pestana={pestana} pestanas={pestanas} corte="2026-07-23T18:09:00" onCambioPestana={() => undefined} />
          </>,
        );
        expect(clavesCrudas(html), `${seccion}/${pestana}`).toEqual([]);
      }
    }
  });
});
