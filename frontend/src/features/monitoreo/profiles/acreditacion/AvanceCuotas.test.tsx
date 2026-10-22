import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { normalizeMonitoreoCuotasEstado } from "../../../../api/monitoreoCuotas";
import { AvanceCuotasPanel, type AvanceCuotasPanelProps } from "./AvanceCuotasPanel";
import { AvanceCuotasVista, type AvanceCuotasVistaProps } from "./AvanceCuotasVista";
import { borradorDeCuota, borradorNuevo, ESTADO_CUOTAS_INICIAL, type EstadoCuotas } from "./avanceCuotasModelo";

const sinSeparador = (t: string) => t.replace(/(\d)[.,](\d)/g, "$1|$2");

// Pregrado · Unidad académica con cobertura 0.199: 15 categorías (cifras del
// estudio real, coordinador 2026-10-22); y Administrativos · Puesto con 91.
const UNIDADES = ["Arquitectura", "Arte", "Ciencias", "Ciencias Sociales", "Comunicaciones", "Derecho", "Economía", "Educación",
  "Gestión", "Ingeniería", "Letras", "Psicología", "Estudios Generales Ciencias", "Estudios Generales Letras", "Sin dato"];

const ESTADO = normalizeMonitoreoCuotasEstado({
  ok: true,
  avisos: [],
  publicos: [
    { actor: "Docentes Campus", universo: 2599, efectivas: 481, meta: 811, variables: [{ variable: "Dedicación", categorias: 3 }] },
    { actor: "Estudiantes de pregrado", universo: 22850, efectivas: 3120, meta: 4542, variables: [{ variable: "Unidad académica", categorias: 15 }] },
    { actor: "Administrativos", universo: 1800, efectivas: 200, meta: 540, variables: [{ variable: "Puesto", categorias: 91 }] },
  ],
  cuotas: [
    {
      id: "q1", actor: "Docentes Campus", variable: "Dedicación", cobertura: 0.312, universo: 2599, meta: 812, efectivas: 481,
      avance: 0.592, categorias_cumplidas: 0, categorias_total: 3, sin_dato: 0,
      categorias: [
        { categoria: "TPA", universo: 1939, meta: 605, efectivas: 350, falta: 255, avance: 0.578, tasa: 0.18, estado: "en_curso" },
        { categoria: "DTC", universo: 631, meta: 197, efectivas: 125, falta: 72, avance: 0.634, tasa: 0.198, estado: "en_curso" },
        { categoria: "TPC20", universo: 29, meta: 10, efectivas: 6, falta: 4, avance: 0.6, tasa: 0.207, estado: "en_curso" },
      ],
    },
    {
      id: "q2", actor: "Estudiantes de pregrado", variable: "Unidad académica", cobertura: 0.199, universo: 22850, meta: 4547, efectivas: 3120,
      avance: 0.686, categorias_cumplidas: 1, categorias_total: 14, sin_dato: 40,
      categorias: UNIDADES.map((u, i) => ({
        categoria: u, universo: 2000 - i * 100, meta: u === "Sin dato" ? 0 : 398 - i * 20,
        efectivas: i === 0 ? 410 : i === 3 ? 0 : 250 - i * 10, falta: 0, avance: null, tasa: null,
        estado: u === "Sin dato" ? "sin_meta" : i === 0 ? "cumplida" : i === 3 ? "sin_avance" : "en_curso",
      })),
    },
    {
      id: "q3", actor: "Administrativos", variable: "Puesto", cobertura: null, universo: 1800, meta: 540, efectivas: 200,
      avance: 0.37, categorias_cumplidas: 3, categorias_total: 91, sin_dato: 0,
      categorias: Array.from({ length: 91 }, (_, i) => ({
        categoria: `Puesto ${i + 1}`, universo: 20, meta: 6, efectivas: i % 4, falta: 6 - (i % 4), avance: (i % 4) / 6, tasa: (i % 4) / 20,
        estado: i % 4 === 0 ? "sin_avance" : "en_curso",
      })),
    },
  ],
});

const noop = () => {};
const pinta = (s: Partial<EstadoCuotas>, extra: Partial<AvanceCuotasVistaProps> = {}) => renderToStaticMarkup(
  <AvanceCuotasVista
    s={{ ...ESTADO_CUOTAS_INICIAL, cargando: false, ...s }}
    foco=""
    panel={null}
    onElegir={noop}
    onAgregar={noop}
    onEditar={noop}
    onReintentar={noop}
    {...extra}
  />,
);

const pintaPanel = (extra: Partial<AvanceCuotasPanelProps> = {}) => renderToStaticMarkup(
  <AvanceCuotasPanel
    borrador={borradorDeCuota(ESTADO.cuotas[0])}
    publicos={ESTADO.publicos}
    cuotas={ESTADO.cuotas}
    proponiendo={false}
    guardando={false}
    error=""
    panelProps={{ "data-pulso-panel": "cuota" }}
    onBorrador={noop}
    onProponer={noop}
    onGuardar={noop}
    onQuitar={noop}
    onCerrar={noop}
    {...extra}
  />,
);

describe("vista de Avance › Cuotas", () => {
  it("con cuotas: un indicador por cuota y el detalle de la elegida", () => {
    const html = pinta({ estado: ESTADO });
    expect(html).toContain('data-audit-ready="monitoreo-cuotas"');
    expect(html).toContain('data-qa-geometry-group="monitoreo/acreditacion/avance/cuotas/resumen"');
    expect(html).toContain('data-qa-geometry-group="monitoreo/acreditacion/avance/cuotas/categorias"');
    expect(html).toContain('data-qa-scroll-owner="monitoreo-cuotas"');
    expect(html.match(/class="mon-cuotas-indicador"/g)).toHaveLength(3);
    expect(html).toContain("0 de 3 categorías cumplidas");
    expect(sinSeparador(html)).toContain("59|2 % · 481 de 812");
    // Detalle de la primera cuota: TPA con su meta, lo que falta y la tasa con base.
    expect(html).toContain("TPA");
    expect(html).toContain("faltan 255");
    expect(sinSeparador(html)).toContain("18|1 % · 350 de 1|939 en la base");
    expect(html).toContain("Agregar cuota");
  });

  it("el foco elige qué cuota se detalla, sin techo de categorías", () => {
    const html = pinta({ estado: ESTADO }, { foco: "q3" });
    expect(html.match(/class="mon-cuotas-categoria /g)).toHaveLength(91);
    expect(html).not.toMatch(/y \d+ más/);
    expect(html).toContain("Filtrar 91 categorías");
    expect(html).toContain("metas escritas a mano");
  });

  it("el estado de cada categoría da el color; «Sin dato» va al final", () => {
    const html = pinta({ estado: ESTADO }, { foco: "q2" });
    expect(html).toContain("mon-cuotas-categoria es-cumplida");
    expect(html).toContain("mon-cuotas-categoria es-sin_avance");
    expect(html).toContain("mon-cuotas-categoria es-sin_meta");
    expect(html.lastIndexOf("Sin dato")).toBeGreaterThan(html.lastIndexOf("Estudios Generales Letras"));
    expect(html).toContain("40 personas sin dato en la base");
  });

  it("sin cuotas: el CTA vive dentro de su superficie", () => {
    const html = pinta({ estado: { ...ESTADO, cuotas: [] } });
    expect(html).toContain("Sin cuotas configuradas");
    expect(html).toContain('data-audit-ready="vacio:sin-cuotas"');
    expect(html).toContain('data-qa-geometry-capacity="owned"');
    expect(html.match(/Agregar cuota/g)?.length).toBeGreaterThanOrEqual(1);
  });

  it("sin universo cruzado: dice qué falta", () => {
    const html = pinta({ estado: { ...ESTADO, publicos: [], cuotas: [], avisos: ["Monitoreo todavía no tiene el universo cargado: sincroniza las fuentes."] } });
    expect(html).toContain("Falta el universo cruzado");
    expect(html).toContain("sincroniza las fuentes");
    expect(html).toContain('data-audit-ready="vacio:sin-universo"');
    expect(html).not.toContain("Agregar cuota");
  });

  it("mientras carga la marca queda en false; el error se clasifica", () => {
    expect(pinta({ cargando: true })).toContain('data-audit-ready="false"');
    expect(pinta({ error: "sin red" })).toContain('data-audit-ready="monitoreo-cuotas:error"');
  });
});

describe("panel de configuración", () => {
  it("edita la cuota: suma visible frente a la meta del público y metas editables", () => {
    const html = pintaPanel();
    expect(html).toContain('data-pulso-panel="cuota"');
    expect(html).toContain('role="dialog"');
    expect(html).toContain("Docentes Campus · Dedicación");
    expect(sinSeparador(html)).toContain("Suma de metas <strong>812</strong>");
    expect(html).toContain("meta del público <strong>811</strong>");
    expect(html).toContain("1 sobre la meta del público");
    expect(html).toContain('aria-label="Meta de TPA"');
    expect(html).toContain("Quitar cuota");
    expect(html).toContain("Proponer metas");
    expect(html).toContain('data-qa-scroll-owner="cuota-panel"');
    expect(html).not.toContain('type="checkbox"');
  });

  it("una cuota nueva sin variable no se puede guardar ni quitar", () => {
    const html = pintaPanel({ borrador: borradorNuevo(ESTADO.publicos) });
    expect(html).toContain("Nueva cuota");
    expect(html).toContain("Elige la variable de la cuota.");
    expect(html).not.toContain("Quitar cuota");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Guardar/);
  });

  it("con muchas categorías la tabla trae filtro y va completa", () => {
    const html = pintaPanel({ borrador: borradorDeCuota(ESTADO.cuotas[2]) });
    expect(html).toContain("Filtrar 91 categorías");
    expect(html.match(/aria-label="Meta de Puesto /g)).toHaveLength(91);
  });
});

describe("dirección de Cuotas", () => {
  it("abrir el panel sobre una cuota conserva modo, sección y pestaña", async () => {
    const { parsearDireccion, serializarDireccion } = await import("../../../../lib/navegacion/direccion");
    const actual = parsearDireccion("/monitoreo", "?modo=acreditacion&seccion=avance&pestana=cuotas");
    expect(actual).not.toBeNull();
    const href = serializarDireccion({ ...actual!, panel: "cuota", foco: "q1" });
    const vuelta = parsearDireccion(href.split("?")[0], `?${href.split("?")[1] ?? ""}`);
    expect(vuelta).toMatchObject({ modulo: "monitoreo", modo: "acreditacion", seccion: "avance", pestana: "cuotas", panel: "cuota", foco: "q1" });
    const cerrado = serializarDireccion({ ...vuelta!, panel: undefined });
    expect(cerrado).not.toContain("panel=");
    expect(cerrado).toContain("foco=q1");
  });
});
