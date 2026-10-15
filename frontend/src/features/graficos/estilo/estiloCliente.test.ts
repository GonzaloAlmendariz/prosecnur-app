import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  apiGraficosSubirLogo,
  esFirmaPng,
  estiloClienteRecetario,
  motivoLogoInvalido,
  normalizeEstiloCliente,
  normalizeEstiloClienteDefaults,
  normalizeEstiloOpciones,
  normalizeLogoSubido,
  type EstiloCliente,
} from "../../../api/graficosEstilo";
import { normalizeGraficosConfig } from "../../../api/graficosConfigNormalizer";
import { buildGraficosConfigFromStore, graficosConfigFromRemote } from "../configSnapshot";
import { usePlanStore, type GraficosConfig } from "../store";
import { mergeWithDefaults } from "../useGraficosAutosave";
import { motivoPiezaNoDisponible, motivoSinVistaPrevia } from "./disponibilidadEstilo";
import {
  conAmbito,
  conLogo,
  conNombreLogo,
  conPaso,
  conRol,
  decisionesEstilo,
  letraModificada,
  logosModificados,
  pasoEfectivoRol,
  procedenciaLogo,
  procedenciaPaso,
  procedenciaRol,
  sinLetra,
  sinLogo,
  sinPaso,
  sinRol,
  tamanosRol,
} from "./modeloEstilo";

// Contrato A6 §3 vitest 1–9 para `estilo_cliente` (R3 frontend; ADR 0094; decisiones 14–16). Cada bloque nombra el
// mutante que mata.

function emptyConfig(patch: Partial<GraficosConfig> = {}): GraficosConfig {
  return {
    version: "graficos/4",
    plan: { slides: [] },
    presets: {},
    w_presets: {},
    selected_slide_id: null,
    paletas: {},
    iconos: [],
    overrides_reusables: [],
    debug_ph: { activo: false, color: "#FF00FF", lwd: 0.6 },
    ...patch,
  } as GraficosConfig;
}

// Lo que manda el GET hoy: completo, con defaults repuestos y el ámbito siempre presente.
const DEL_GET: EstiloCliente = {
  version: 1,
  ambito: "proyecto",
  logos: { portada_izquierda: { file_id: "f-unsa", nombre: "UNSA" } },
  letra: { paso: "grande", roles: { cifras: "muy_grande" } },
};
const DEFAULTS: EstiloCliente = { version: 1, ambito: "proyecto", logos: {}, letra: { paso: "estandar", roles: {} } };

describe("normalizeEstiloCliente · defensivo", () => {
  // Mata: un normalizador que copie el objeto tal cual y mande rutas o pasos inválidos al 400 del backend.
  it("descarta lo inválido, nunca lleva rutas y conserva lo desconocido", () => {
    const out = normalizeEstiloCliente({
      version: 1,
      ambito: "galaxia",
      logos: {
        portada_izquierda: { file_id: " f1 ", nombre: " UNSA ", path: "/tmp/x.png" },
        portada_derecha: { file_id: "" },
        lomo: { file_id: "f9" },
      },
      letra: { paso: "enorme", roles: { cifras: "grande", titulos: "gigante", pie: "grande" }, nota: "a mano" },
      extra_futura: { a: 1 },
    });
    expect(out).toEqual({
      version: 1,
      logos: { portada_izquierda: { file_id: "f1", nombre: "UNSA" } },
      letra: { roles: { cifras: "grande" }, nota: "a mano" },
      extra_futura: { a: 1 },
    });
    expect(JSON.stringify(out)).not.toContain("/tmp/");
  });

  it("`[]` de R es un bloque vacío; ausente o escalar → {}; idempotente", () => {
    expect(normalizeEstiloCliente([])).toEqual({});
    expect(normalizeEstiloCliente("proyecto")).toEqual({});
    expect(normalizeEstiloCliente({ logos: [], letra: { roles: [] } })).toEqual({ logos: {}, letra: { roles: {} } });
    expect(normalizeEstiloCliente(normalizeEstiloCliente(DEL_GET))).toEqual(DEL_GET);
  });

  it("acepta escalares envueltos en vector de largo 1", () => {
    expect(normalizeEstiloCliente({ version: [1], ambito: ["base"], letra: { paso: ["muy_grande"] } }))
      .toEqual({ version: 1, ambito: "base", letra: { paso: "muy_grande" } });
  });
});

describe("(1) KNOWN_KEYS · estilo_cliente no cae en _unknown", () => {
  // Mata: quitar `estilo_cliente`/`estiloCliente` de KNOWN_KEYS (el hydrate lo descartaba, bug K3).
  it("snake y camel", () => {
    const a = normalizeGraficosConfig({ estilo_cliente: DEL_GET });
    expect(a.estilo_cliente).toEqual(DEL_GET);
    expect(a._unknown).toBeUndefined();
    const b = normalizeGraficosConfig({ estiloCliente: { ambito: "base" } });
    expect(b.estilo_cliente).toEqual({ ambito: "base" });
    expect(b._unknown).toBeUndefined();
  });

  it("siempre viaja: ausente → {}", () => {
    expect(normalizeGraficosConfig({}).estilo_cliente).toEqual({});
  });
});

describe("(2)(3)(5) hydrate → productor único y lectura remota lo conservan", () => {
  beforeEach(() => usePlanStore.getState().hydrate(emptyConfig()));

  // Mata: olvidar `estiloCliente` en hydrate, en buildGraficosConfig o en graficosConfigSource.
  it("lo que llega del backend sale igual en la próxima config", () => {
    usePlanStore.getState().hydrate(emptyConfig({ estilo_cliente: DEL_GET }));
    expect(usePlanStore.getState().estiloCliente).toEqual(DEL_GET);
    expect(buildGraficosConfigFromStore().estilo_cliente).toEqual(DEL_GET);
    expect(graficosConfigFromRemote({ estilo_cliente: DEL_GET }).estilo_cliente).toEqual(DEL_GET);
    expect(mergeWithDefaults({ estilo_cliente: DEL_GET }).estilo_cliente).toEqual(DEL_GET);
  });

  it("el setter marca sucio y normaliza", () => {
    usePlanStore.getState().setEstiloCliente({ letra: { paso: "grande" }, ambito: "nada" } as unknown as EstiloCliente);
    expect(usePlanStore.getState().dirty).toBe(true);
    expect(buildGraficosConfigFromStore().estilo_cliente).toEqual({ letra: { paso: "grande" } });
  });
});

describe("(4) reset", () => {
  // Mata: reset con `estiloCliente: undefined` (la clave no viajaría y el backend conservaría el estilo guardado).
  it("tras reset viaja estilo_cliente: {} con la clave presente", () => {
    usePlanStore.getState().hydrate(emptyConfig({ estilo_cliente: DEL_GET }));
    usePlanStore.getState().reset();
    const cfg = buildGraficosConfigFromStore();
    expect(Object.prototype.hasOwnProperty.call(cfg, "estilo_cliente")).toBe(true);
    expect(JSON.stringify(cfg)).toContain('"estilo_cliente":{}');
  });
});

describe("(6) deshacer / rehacer", () => {
  // Mata: no incluir `estiloCliente` en el Snapshot del historial.
  it("restauran el estilo del cliente", () => {
    usePlanStore.getState().hydrate(emptyConfig({ estilo_cliente: DEFAULTS }));
    usePlanStore.getState().setEstiloCliente(conPaso(DEFAULTS, "muy_grande"));
    usePlanStore.getState().undo();
    expect(usePlanStore.getState().estiloCliente.letra?.paso).toBe("estandar");
    usePlanStore.getState().redo();
    expect(usePlanStore.getState().estiloCliente.letra?.paso).toBe("muy_grande");
  });

  it("deshacer un reset devuelve el estilo", () => {
    usePlanStore.getState().hydrate(emptyConfig({ estilo_cliente: DEL_GET }));
    usePlanStore.getState().reset();
    usePlanStore.getState().undo();
    expect(usePlanStore.getState().estiloCliente).toEqual(DEL_GET);
  });
});

describe("(7) «Modificado» y procedencia contra los defaults del GET (decisión 5a)", () => {
  // Mata: comparar contra «hay clave» en vez de contra el default (el GET la manda completa: todo saldría Propio).
  it("el estilo completo igual al default no tiene decisiones: todo Del recetario", () => {
    const d = decisionesEstilo(DEFAULTS, DEFAULTS);
    expect(d).toEqual({ logos: {}, roles: {} });
    expect(logosModificados(d)).toBe(false);
    expect(letraModificada(d)).toBe(false);
    expect(procedenciaPaso(d)).toBe("recetario");
  });

  it("un bloque distinto sí, y sólo ese", () => {
    const d = decisionesEstilo(DEL_GET, DEFAULTS);
    expect(procedenciaLogo(d, "portada_izquierda")).toBe("propio");
    expect(procedenciaLogo(d, "contraportada")).toBe("recetario");
    expect(procedenciaPaso(d)).toBe("propio");
    expect(procedenciaRol(d, "cifras")).toBe("propio");
    expect(procedenciaRol(d, "titulos")).toBe("recetario");
  });

  // Mata: ignorar los defaults del GET (el perfil del catálogo puede traer «grande» como default).
  it("prefiere los defaults del GET; sin ellos compara contra el recetario", () => {
    const perfil: EstiloCliente = { ...DEFAULTS, letra: { paso: "grande", roles: {} } };
    const actual = conPaso(DEFAULTS, "grande");
    expect(procedenciaPaso(decisionesEstilo(actual, perfil))).toBe("recetario");
    expect(procedenciaPaso(decisionesEstilo(actual, null))).toBe("propio");
  });

  it("un rol igual al paso que heredaría no es decisión", () => {
    const actual = conRol(conPaso(DEFAULTS, "grande"), "titulos", "grande");
    const d = decisionesEstilo(actual, DEFAULTS);
    expect(procedenciaRol(d, "titulos")).toBe("recetario");
    expect(pasoEfectivoRol(actual, DEFAULTS, "base")).toBe("grande");
  });

  it("los defaults se leen del GET y, si faltan, quedan en null", () => {
    expect(normalizeEstiloClienteDefaults({ defaults: { estilo_cliente: DEFAULTS } })).toEqual(DEFAULTS);
    expect(normalizeEstiloClienteDefaults({ defaults: { w_presets: {} } })).toBeNull();
    expect(normalizeEstiloClienteDefaults(null)).toBeNull();
    expect(decisionesEstilo(estiloClienteRecetario(), null)).toEqual({ logos: {}, roles: {} });
  });
});

describe("(9) «Volver al recetario» borra la clave", () => {
  // Mata: «volver» que escriba el valor del default en vez de borrar (quedaría guardado como decisión).
  it("logo, paso, rol y letra entera", () => {
    const sinIzq = sinLogo(DEL_GET, "portada_izquierda");
    expect(sinIzq.logos).toEqual({});
    expect("portada_izquierda" in (sinIzq.logos ?? {})).toBe(false);
    expect("paso" in (sinPaso(DEL_GET).letra ?? {})).toBe(false);
    expect(sinPaso(DEL_GET).letra?.roles).toEqual({ cifras: "muy_grande" });
    expect("cifras" in (sinRol(DEL_GET, "cifras").letra?.roles ?? {})).toBe(false);
    expect("letra" in sinLetra(DEL_GET)).toBe(false);
  });

  it("en el store, la config que viaja ya no lleva el logo quitado", () => {
    usePlanStore.getState().hydrate(emptyConfig({ estilo_cliente: DEL_GET }));
    usePlanStore.getState().setEstiloCliente(sinLogo(usePlanStore.getState().estiloCliente, "portada_izquierda"));
    const cfg = buildGraficosConfigFromStore();
    expect(cfg.estilo_cliente?.logos).toEqual({});
    expect(JSON.stringify(cfg)).not.toContain("f-unsa");
  });

  it("no muta el estilo de entrada", () => {
    const copia = JSON.parse(JSON.stringify(DEL_GET)) as EstiloCliente;
    sinLogo(DEL_GET, "portada_izquierda");
    sinRol(DEL_GET, "cifras");
    conNombreLogo(DEL_GET, "portada_izquierda", "Otra");
    expect(DEL_GET).toEqual(copia);
  });
});

describe("Ámbito · al cambiarlo se manda el estilo que se estaba viendo (decisión 14)", () => {
  // Mata: un cambio de ámbito que mande sólo `{ambito}` (el backend copiaría un estilo vacío al portador nuevo).
  it("el autosave lleva logos y letra con el ámbito nuevo", () => {
    usePlanStore.getState().hydrate(emptyConfig({ estilo_cliente: DEL_GET }));
    usePlanStore.getState().setEstiloCliente(conAmbito(usePlanStore.getState().estiloCliente, "base"));
    const enviado = buildGraficosConfigFromStore().estilo_cliente;
    expect(enviado).toEqual({ ...DEL_GET, ambito: "base" });
  });
});

describe("Logos · subida", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("motivoLogoInvalido: sólo PNG hasta 5 MB y con firma", () => {
    expect(motivoLogoInvalido({ name: "logo.png", type: "image/png", size: 10 })).toBeNull();
    expect(motivoLogoInvalido({ name: "logo.jpg", type: "image/jpeg", size: 10 })).toBe("El logo debe ser un PNG.");
    expect(motivoLogoInvalido({ name: "logo.png", type: "image/jpeg", size: 10 })).toBe("El logo debe ser un PNG.");
    expect(motivoLogoInvalido({ name: "logo.png", type: "", size: 10 })).toBeNull();
    expect(motivoLogoInvalido({ name: "logo", type: "", size: 10 })).toBe("El logo debe ser un PNG.");
    expect(motivoLogoInvalido({ name: "logo.png", type: "image/png", size: 6 * 1024 * 1024 })).toBe("El logo supera los 5 MB.");
    expect(motivoLogoInvalido({ name: "logo.png", type: "image/png", size: 10 }, new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])))
      .toBe("El archivo no es un PNG válido.");
    expect(esFirmaPng(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(true);
  });

  // Mata: subir sin filtrar en el cliente (el usuario esperaría el 400 E_BAD_LOGO para enterarse).
  it("un archivo que no es PNG se rechaza sin llamar al backend", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const jpg = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], "logo.jpg", { type: "image/jpeg" });
    await expect(apiGraficosSubirLogo(jpg, "portada_izquierda")).rejects.toThrow("El logo debe ser un PNG.");
    const disfrazado = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0])], "logo.png", { type: "image/png" });
    await expect(apiGraficosSubirLogo(disfrazado, "portada_izquierda")).rejects.toThrow("El archivo no es un PNG válido.");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("normalizeLogoSubido exige file_id y lee el resto con defensa", () => {
    expect(normalizeLogoSubido({ file_id: "f1", nombre: "UNSA", lugar: "contraportada", ancho_px: [400], alto_px: 100 }))
      .toMatchObject({ fileId: "f1", nombre: "UNSA", lugar: "contraportada", anchoPx: 400, altoPx: 100 });
    expect(normalizeLogoSubido({ file_id: "f1", lugar: "lomo" }).lugar).toBeNull();
    expect(() => normalizeLogoSubido({ ok: true })).toThrow();
  });

  it("poner un logo y renombrarlo", () => {
    const con = conLogo(DEFAULTS, "contraportada", { file_id: "f2" });
    expect(con.logos?.contraportada).toEqual({ file_id: "f2" });
    expect(conNombreLogo(con, "contraportada", "  ACNUR ").logos?.contraportada).toEqual({ file_id: "f2", nombre: "ACNUR" });
    expect(conNombreLogo(con, "contraportada", "  ").logos?.contraportada).toEqual({ file_id: "f2" });
    expect(conNombreLogo(DEFAULTS, "contraportada", "X")).toBe(DEFAULTS);
  });
});

describe("Opciones y tamaños «16 pt = 14 + 2»", () => {
  const RAW = {
    ambitos: ["proyecto", "base"],
    pasos: [{ id: "estandar", desplazamiento_pt: 0 }, { id: "grande", desplazamiento_pt: 2 }, { id: "muy_grande", desplazamiento_pt: 4 }],
    roles: [{ id: "titulos", ppt: { titulo: 24 }, word: { titulo_1: 18, titulo_2: 12.5 } }, { id: "cifras", ppt: [], word: { grafico_cifra: 9.5 } }],
    logos: [{ lugar: "portada_izquierda", logo: "pucp", nombre: "PUCP" }, { lugar: "lomo", logo: "x", nombre: "X" }],
  };

  it("normaliza con defensa y completa lo que falte del catálogo", () => {
    const o = normalizeEstiloOpciones(RAW);
    expect(o.pasos.map((p) => p.desplazamientoPt)).toEqual([0, 2, 4]);
    expect(o.roles.map((r) => r.id)).toEqual(["titulos", "preguntas", "cifras", "rotulos", "base"]);
    expect(o.roles[2].ppt).toEqual({});
    expect(o.logos).toEqual([{ lugar: "portada_izquierda", logo: "pucp", nombre: "PUCP" }]);
    const vacio = normalizeEstiloOpciones(null);
    expect(vacio.ambitos).toEqual(["proyecto", "base"]);
    expect(vacio.pasos.find((p) => p.id === "muy_grande")?.desplazamientoPt).toBe(4);
  });

  // Mata: sumar el desplazamiento al revés o mostrar el tamaño del recetario sin el paso.
  it("muestra el tamaño final y su suma", () => {
    const o = normalizeEstiloOpciones(RAW);
    const t = tamanosRol(o.roles[0], "grande", o.pasos);
    expect(t.map((x) => x.texto)).toEqual(["20 pt = 18 + 2", "14,5 pt = 12,5 + 2"]);
    expect(tamanosRol(o.roles[0], "estandar", o.pasos)[0].texto).toBe("18 pt");
    expect(tamanosRol(undefined, "grande", o.pasos)).toEqual([]);
  });
});

describe("Disponibilidad · consolidado y vista previa", () => {
  // L2 (2026-10-14). Mata: volver a apagar Identidad entera en el compartido, o dejar logos y letra ajustables ahí
  // cuando sólo los aplica el Word (que el compartido no exporta).
  it("en el compartido colores e íconos se ajustan; logos y letra dicen por qué no", () => {
    expect(motivoPiezaNoDisponible("consolidated", "colores")).toBeNull();
    expect(motivoPiezaNoDisponible("consolidated", "iconos")).toBeNull();
    expect(motivoPiezaNoDisponible("consolidated", "logos")).toMatch(/Word/);
    expect(motivoPiezaNoDisponible("consolidated", "letra")).toMatch(/Word/);
    for (const pieza of ["logos", "letra", "iconos", "colores"] as const) expect(motivoPiezaNoDisponible("active", pieza)).toBeNull();
  });

  it("la vista previa explica por qué no se puede generar", () => {
    expect(motivoSinVistaPrevia({ prepOk: false, laminas: 3, ocupado: false })).toMatch(/Analítica/);
    expect(motivoSinVistaPrevia({ prepOk: true, laminas: 0, ocupado: false })).toMatch(/láminas/);
    expect(motivoSinVistaPrevia({ prepOk: true, laminas: 3, ocupado: true })).toMatch(/generando/);
    expect(motivoSinVistaPrevia({ prepOk: true, laminas: 3, ocupado: false })).toBeNull();
  });
});
