/**
 * Acreditación › Selección (ADR 0090, E5): cada actor se sortea por su
 * `componente_id`, su técnica se dice en palabras, su estado sale del store y
 * el actor activo vive en la dirección (`foco`). Render estático: en SSR
 * zustand sirve el estado inicial del store, así que los estados con datos se
 * prueban sobre la Vista con el estado explícito.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";

import type { CalcMuestraComponente, CalcMuestraTecnica } from "../../../../api/calcMuestra";
import type { CalcMuestraGeneralCorrida, CalcMuestraGeneralMarco } from "../../../../api/calcMuestraGeneral";
import { parsearDireccion } from "../../../../lib/navegacion/direccion";
import { actorEnFoco, estadoDelActor, tecnicaDelActor } from "../actores";
import { actoresDelSelector, SeleccionActores, SeleccionActoresVista } from "../SeleccionActores";
import { SelectorActor, type ActorDelSelector } from "../SelectorActor";
import { useMuestraGeneralStore } from "../store";
import { searchConActor } from "../useActorEnFoco";

function actor(id: string, nombre: string, tecnica: CalcMuestraTecnica): CalcMuestraComponente {
  return { id, actor: nombre, actor_id: id, tecnica, resultado: { n_operativo: 120 } } as unknown as CalcMuestraComponente;
}

const ACTORES = [
  actor("cmp-adm", "Personal administrativo", "intencion_censal"),
  actor("cmp-doc", "Docentes", "no_prob_cuotas"),
  actor("cmp-est", "Estudiantes pregrado", "prob_estratificado"),
  actor("cmp-egr", "Egresados", "intencion_censal"),
];

const MARCO: CalcMuestraGeneralMarco = {
  file_id: "f1",
  hoja: "padron",
  columnas: { id: "codigo", estrato: "", tamano: "" },
  marco_hash: "abcdef0123456789",
  N: 5000,
  estratos: [],
  declarado_at: "2026-09-24T06:00:00Z",
};

function corrida(modalidad: "probabilistica" | "censo", n: number, componente_id = "cmp-est"): CalcMuestraGeneralCorrida {
  return {
    corrida: {
      run_id: `run-${componente_id}`, semilla: 20260924, rng_kind: "Mersenne-Twister/Inversion/Rejection",
      r_version: "R 4.4.1", metodo: "mas", modalidad, marco_hash: "abcdef0123456789", config_hash: "c0ffee",
      N: 5000, n_titulares: n, n_reservas: 0, piso_incumplible: false, reservas_omitidas_pps: false,
    },
    estratos: [],
    unidades: null,
    n_fuente: n,
    componente_id,
    sorteado_at: "2026-09-24T06:19:57Z",
  };
}

afterEach(() => useMuestraGeneralStore.getState().reset());

describe("técnica del actor en palabras", () => {
  it("cobertura censal, muestra probabilística y cuotas", () => {
    expect(tecnicaDelActor("intencion_censal")).toMatchObject({ clase: "censal", etiqueta: "Cobertura censal", sorteable: true, motivo: null });
    expect(tecnicaDelActor("barrido")).toMatchObject({ clase: "censal", sorteable: true });
    for (const t of ["prob_aleatorio_simple", "prob_estratificado", "sistematico"] as const) {
      expect(tecnicaDelActor(t)).toMatchObject({ clase: "probabilistica", etiqueta: "Muestra probabilística", sorteable: true });
    }
    const cuotas = tecnicaDelActor("no_prob_cuotas");
    expect(cuotas).toMatchObject({ clase: "cuotas", etiqueta: "Cuotas", sorteable: false });
    expect(cuotas.motivo).toContain("no selecciona unidades con probabilidad conocida");
  });

  it("sigue la lista del motor: lo que no es de elementos ni censal no se sortea", () => {
    const conglomerados = tecnicaDelActor("prob_conglomerado_multietapico");
    expect(conglomerados).toMatchObject({ clase: "sin_sorteo", etiqueta: "Conglomerados por etapas", sorteable: false });
    // Un diseño por conglomerados SÍ tiene π: el motivo no dice lo contrario.
    expect(conglomerados.motivo).not.toContain("probabilidad conocida");
    expect(tecnicaDelActor("no_prob_conveniencia")).toMatchObject({ etiqueta: "Conveniencia", sorteable: false });
    expect(tecnicaDelActor("listado_externo_meta_fija").sorteable).toBe(false);
  });
});

describe("estado del marco y del sorteo por actor", () => {
  const prob = tecnicaDelActor("prob_estratificado");
  const censal = tecnicaDelActor("intencion_censal");

  it("sin marco · marco declarado N=… · sorteado", () => {
    expect(estadoDelActor({ tecnica: prob, cargado: true, marco: null, corrida: null })).toEqual({ fase: "sin_marco", etiqueta: "Sin marco", detalle: "" });
    expect(estadoDelActor({ tecnica: prob, cargado: true, marco: MARCO, corrida: null })).toEqual({ fase: "marco", etiqueta: "Marco declarado", detalle: "N=5,000" });
    expect(estadoDelActor({ tecnica: prob, cargado: true, marco: MARCO, corrida: corrida("probabilistica", 120) }))
      .toEqual({ fase: "sorteado", etiqueta: "Sorteado", detalle: "120 de N=5,000" });
    expect(estadoDelActor({ tecnica: censal, cargado: true, marco: MARCO, corrida: corrida("censo", 5000) }).detalle)
      .toBe("5,000 a contactar");
  });

  it("un sorteo que ya no es vigente es «Sorteo viejo», nunca «Sorteado» (QA E11 ronda 2)", () => {
    const viejo = estadoDelActor({ tecnica: prob, cargado: true, marco: MARCO, corrida: corrida("probabilistica", 120), vigente: false });
    expect(viejo.fase).toBe("sorteo_viejo");
    expect(viejo.etiqueta).toBe("Sorteo viejo");
    expect(estadoDelActor({ tecnica: censal, cargado: true, marco: MARCO, corrida: corrida("censo", 5000), vigente: false }).fase)
      .toBe("sorteo_viejo");
  });

  it("antes de rehidratar no afirma «sin marco»; cuotas no espera nada", () => {
    expect(estadoDelActor({ tecnica: prob, cargado: false, marco: null, corrida: null }).fase).toBe("leyendo");
    expect(estadoDelActor({ tecnica: tecnicaDelActor("no_prob_cuotas"), cargado: false, marco: null, corrida: null }))
      .toEqual({ fase: "sin_sorteo", etiqueta: "Sin sorteo", detalle: "no da π" });
  });
});

describe("actor en foco", () => {
  it("el foco elige; uno ajeno cae al primero; sin actores no hay foco", () => {
    expect(actorEnFoco(ACTORES, "cmp-est")?.id).toBe("cmp-est");
    expect(actorEnFoco(ACTORES, "cmp-de-otro-estudio")?.id).toBe("cmp-adm");
    expect(actorEnFoco(ACTORES, null)?.id).toBe("cmp-adm");
    expect(actorEnFoco([], "cmp-est")).toBeNull();
  });

  it("se escribe como `foco` de la gramática y conserva el resto de la dirección", () => {
    const search = searchConActor("?modo=acreditacion&seccion=seleccion&pulso=abc", "cmp-est");
    const direccion = parsearDireccion("/calc-muestra", search);
    expect(direccion).toMatchObject({ modo: "acreditacion", seccion: "seleccion", foco: "cmp-est" });
    expect(new URLSearchParams(search).get("pulso")).toBe("abc");
    expect(searchConActor(search, null)).not.toContain("foco");
  });
});

describe("SelectorActor", () => {
  it("un botón por actor con su técnica, su estado y sólo uno presionado", () => {
    const actores: ActorDelSelector[] = ACTORES.map((c, i) => {
      const tecnica = tecnicaDelActor(c.tecnica);
      return {
        id: c.id,
        nombre: c.actor,
        tecnica,
        estado: estadoDelActor({ tecnica, cargado: true, marco: i === 2 ? MARCO : null, corrida: null }),
        conMarco: i === 2,
      };
    });
    const html = renderToStaticMarkup(<SelectorActor actores={actores} activoId="cmp-est" onElegir={() => {}} />);
    expect(html.match(/<button/g)).toHaveLength(4);
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(html).toMatch(/aria-pressed="true"[^>]*data-actor="cmp-est"/);
    expect(html).toContain('aria-controls="cmg-actor-trabajo"');
    expect(html).toContain("Cobertura censal");
    expect(html).toContain("Muestra probabilística");
    expect(html).toContain("Cuotas");
    expect(html).toContain("Marco declarado");
    expect(html).toContain("N=5,000");
    expect(html).toContain("Sin sorteo");
    expect(html).toContain('data-qa-geometry-group="calc-muestra/acreditacion-actores"');
  });
});

function seccion(search: string, componentes: readonly CalcMuestraComponente[] = ACTORES) {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[`/calc-muestra${search}`]}>
      <SeleccionActores componentes={componentes} />
    </MemoryRouter>,
  );
}

/** Actores del selector con el estado que dejaría la rehidratación. */
function actoresCon(marcos: Record<string, CalcMuestraGeneralMarco>, corridas: Record<string, CalcMuestraGeneralCorrida>): ActorDelSelector[] {
  return ACTORES.map((c) => {
    const tecnica = tecnicaDelActor(c.tecnica);
    return {
      id: c.id,
      nombre: c.actor,
      tecnica,
      estado: estadoDelActor({ tecnica, cargado: true, marco: marcos[c.id] ?? null, corrida: corridas[c.id] ?? null }),
      conMarco: Boolean(marcos[c.id]),
    };
  });
}

function vista(activoId: string | null, actores = actoresCon({}, {}), cargado = true, pestana?: string) {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={["/calc-muestra?modo=acreditacion&seccion=seleccion"]}>
      <SeleccionActoresVista
        actores={actores}
        activo={ACTORES.find((c) => c.id === activoId) ?? null}
        cargado={cargado}
        onElegir={() => {}}
        pestana={pestana}
      />
    </MemoryRouter>,
  );
}

describe("Acreditación › Selección", () => {
  it("el foco de la dirección elige el actor activo", () => {
    const html = seccion("?modo=acreditacion&seccion=seleccion&foco=cmp-est");
    expect(html).toMatch(/aria-pressed="true"[^>]*data-actor="cmp-est"/);
    expect(html).toContain('aria-label="Marco y sorteo de Estudiantes pregrado"');
  });

  it("sin foco, el primer actor; antes de rehidratar la readiness está en false", () => {
    const html = seccion("?modo=acreditacion&seccion=seleccion");
    expect(html).toMatch(/aria-pressed="true"[^>]*data-actor="cmp-adm"/);
    expect(html).toMatch(/id="cmv2-section-acreditacion-seleccion"[^>]*data-audit-ready="false"/);
  });

  it("reutiliza el marco y el sorteo de Muestra general, sin la sección ni el salto a Marco del otro modo", () => {
    const html = vista("cmp-adm");
    expect(html).toMatch(/id="cmv2-section-acreditacion-seleccion"[^>]*data-audit-ready="true"/);
    expect(html).toContain('class="cmg-seleccion cmg-seleccion--actor"');
    expect(html).not.toContain("Ir a Marco");
    expect(html).not.toContain('id="cmv2-section-general-seleccion"');
    // El archivo del actor vive en su pestaña (E15 · P1), no encima del sorteo.
    expect(html).not.toContain("cmg-archivo");
    expect(vista("cmp-adm", undefined, true, "seleccion-marco")).toContain('class="cmv2-panel cmg-archivo"');
    // Un solo dueño de scroll y una sola sección, nombrada por el encabezado;
    // dentro, UN tabpanel real, nombrado por la pestaña que lo controla.
    expect(html.match(/aria-labelledby="cmg-seccion-titulo"/g)).toHaveLength(1);
    expect(html.match(/cmv2-tab-panel/g)).toHaveLength(1);
    expect(html.match(/role="tabpanel"/g)).toHaveLength(1);
    expect(html).toMatch(/id="cmg-panel-seleccion" class="cmg-pestana-panel" role="tabpanel" aria-labelledby="cmg-tab-seleccion-seleccion-sorteo"/);
    expect(html).toMatch(/id="cmg-tab-seleccion-seleccion-sorteo"[^>]*role="tab"[^>]*aria-selected="true"[^>]*aria-controls="cmg-panel-seleccion"/);
  });

  it("el selector publica el estado de cada actor", () => {
    const html = vista("cmp-est", actoresCon({ "cmp-est": MARCO, "cmp-adm": MARCO }, { "cmp-est": corrida("probabilistica", 120) }));
    expect(html).toContain("120 de N=5,000");
    expect(html).toContain("Marco declarado");
    expect(html).toContain("Sin marco");
  });

  it("un actor por cuotas lo dice de entrada, con motivo, y no ofrece Sortear", () => {
    const html = vista("cmp-doc");
    expect(html).toContain("Docentes va por cuotas");
    expect(html).toContain("no selecciona unidades con probabilidad conocida");
    expect(html).not.toContain("Sortear");
    expect(html).not.toContain("cmg-archivo");
  });

  it("si el actor sin sorteo ya declaró marco, lo sigue viendo: cambiarlo puede cambiar su técnica", () => {
    const html = vista("cmp-doc", actoresCon({ "cmp-doc": MARCO }, {}));
    expect(html).toContain("Docentes va por cuotas");
    expect(html).not.toContain("Sortear");
    // El archivo sigue a una pestaña: la de «Archivo del marco».
    expect(html).toContain('id="cmg-tab-seleccion-seleccion-marco"');
    expect(vista("cmp-doc", actoresCon({ "cmp-doc": MARCO }, {}), true, "seleccion-marco")).toContain('class="cmv2-panel cmg-archivo"');
  });

  it("sin actores contiene su propio vacío", () => {
    const html = vista(null, []);
    expect(html).toContain("Aún no hay actores");
    expect(html).toContain("Ir a Actores");
    expect(html).toContain('data-audit-ready="true"');
  });
});

describe("el estado del sorteo está indexado por componente_id", () => {
  it("declarar el marco de un actor invalida su corrida y no la de otro", () => {
    const store = useMuestraGeneralStore.getState();
    store.setCorrida("cmp-est", corrida("probabilistica", 120, "cmp-est"));
    store.setCorrida("cmp-adm", corrida("censo", 5000, "cmp-adm"));
    store.setMarco("cmp-adm", MARCO);
    const s = useMuestraGeneralStore.getState();
    expect(s.corridas["cmp-adm"]).toBeUndefined();
    expect(s.corridas["cmp-est"]?.corrida.run_id).toBe("run-cmp-est");
    expect(s.marcos["cmp-adm"]?.N).toBe(5000);
    expect(s.marcos["cmp-est"]).toBeUndefined();
  });
});

describe("actoresDelSelector conecta la vigencia del sorteo (QA E11 ronda 2)", () => {
  it("un sorteo de un marco que ya cambió sale «Sorteo viejo», aunque el actor tenga corrida", () => {
    const marcoNuevo: CalcMuestraGeneralMarco = { ...MARCO, marco_hash: "0000111122223333" };
    const [, , est] = actoresDelSelector(ACTORES, {
      cargado: true,
      marcos: { "cmp-est": marcoNuevo },
      corridas: { "cmp-est": corrida("probabilistica", 120) },
    });
    expect(est.estado.fase).toBe("sorteo_viejo");
    expect(est.estado.etiqueta).toBe("Sorteo viejo");
  });

  it("con el mismo marco y el mismo cálculo el sorteo sigue «Sorteado»", () => {
    // Un cálculo vigente trae n_objetivo; sin él el sorteo quedó de un cálculo que ya no existe.
    const calculados = ACTORES.map((c) => ({ ...c, resultado: { n_objetivo: 100, n_operativo: 120 } }) as unknown as CalcMuestraComponente);
    const [, , est] = actoresDelSelector(calculados, {
      cargado: true,
      marcos: { "cmp-est": MARCO },
      corridas: { "cmp-est": corrida("probabilistica", 120) },
    });
    expect(est.estado.fase).toBe("sorteado");
  });
});
