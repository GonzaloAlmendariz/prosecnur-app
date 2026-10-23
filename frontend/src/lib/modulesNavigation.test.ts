import { describe, expect, it } from "vitest";
import {
  MODULE_TONES,
  PROSECNUR_GLOBAL_NAV_ITEMS,
  PROSECNUR_MODULES,
  PROSECNUR_NAVIGATION_CONTRACT,
  type ProsecnurModuleSlug,
} from "./modules";
import {
  MONITOREO_PESTANAS,
  TOTAL_PESTANAS_MONITOREO,
  type PestanaMonitoreoCatalogo,
} from "./navegacion/catalogos/monitoreo";
import {
  CALC_MUESTRA_UNIVERSIDAD_PESTANAS,
  TOTAL_PESTANAS_CALC_MUESTRA_UNIVERSIDAD,
} from "./navegacion/catalogos/calcMuestra";
import {
  PROCESAMIENTO_PESTANAS,
  TOTAL_PESTANAS_PROCESAMIENTO,
} from "./navegacion/catalogos/procesamiento";
import { DASHBOARD_PESTANAS } from "./navegacion/catalogos/dashboard";

const EXPECTED_PRIMARY_NAVIGATION: Record<
  Exclude<ProsecnurModuleSlug, "plan-trabajo">,
  {
    landingKind: "section" | "entrypoint";
    to: string;
    sections: Array<{
      id: string;
      label: string;
      to: string;
      layoutPolicy: "viewport" | "legacy-scroll";
    }>;
  }
> = {
  "diseno-estudio": {
    landingKind: "section",
    to: "/bitacora",
    sections: [
      { id: "bitacora", label: "Bitácora", to: "/bitacora", layoutPolicy: "viewport" },
      { id: "cronograma", label: "Cronograma", to: "/bitacora?seccion=cronograma", layoutPolicy: "viewport" },
      { id: "calendario", label: "Calendario", to: "/bitacora?seccion=calendario", layoutPolicy: "viewport" },
      { id: "canvas", label: "Lienzo", to: "/bitacora?seccion=canvas", layoutPolicy: "viewport" },
    ],
  },
  "calc-muestra": {
    landingKind: "section",
    to: "/calc-muestra",
    sections: [
      { id: "calc-muestra", label: "Cálculo de muestra", to: "/calc-muestra", layoutPolicy: "viewport" },
    ],
  },
  "editor-xlsform": {
    landingKind: "section",
    to: "/editor-xlsform",
    sections: [
      { id: "formularios", label: "Formularios", to: "/editor-xlsform", layoutPolicy: "viewport" },
    ],
  },
  "hojas-ruta": {
    landingKind: "entrypoint",
    to: "/hojas-ruta",
    sections: [
      { id: "territorio", label: "Territorio", to: "/hojas-ruta?seccion=territorio", layoutPolicy: "viewport" },
      { id: "poblacion", label: "Población", to: "/hojas-ruta?seccion=poblacion", layoutPolicy: "viewport" },
      { id: "muestra", label: "Muestra", to: "/hojas-ruta?seccion=muestra", layoutPolicy: "viewport" },
      { id: "manzanas", label: "Manzanas", to: "/hojas-ruta?seccion=manzanas", layoutPolicy: "viewport" },
      { id: "seleccion", label: "Selección", to: "/hojas-ruta?seccion=seleccion", layoutPolicy: "viewport" },
    ],
  },
  "material-campo": {
    landingKind: "section",
    to: "/material-campo",
    // ADR 0111: el landing es la lista de campañas; las secciones son del modo.
    sections: [
      { id: "campanas", label: "Campañas", to: "/material-campo", layoutPolicy: "viewport" },
    ],
  },
  monitoreo: {
    landingKind: "section",
    to: "/monitoreo",
    sections: [
      { id: "monitoreo", label: "Monitoreo", to: "/monitoreo", layoutPolicy: "viewport" },
    ],
  },
  procesamiento: {
    landingKind: "entrypoint",
    to: "/procesamiento",
    sections: [
      { id: "carga", label: "Carga", to: "/carga", layoutPolicy: "viewport" },
      { id: "validacion", label: "Validación", to: "/validacion", layoutPolicy: "viewport" },
      { id: "codificacion", label: "Codificación", to: "/codificacion", layoutPolicy: "viewport" },
      { id: "analitica", label: "Analítica", to: "/analitica", layoutPolicy: "viewport" },
      { id: "graficos", label: "Gráficos", to: "/graficos", layoutPolicy: "viewport" },
    ],
  },
  dashboard: {
    landingKind: "section",
    to: "/tablero",
    sections: [
      { id: "dashboard", label: "Dashboard", to: "/tablero", layoutPolicy: "viewport" },
    ],
  },
};

describe("manifiesto primario de navegación", () => {
  it("declara la cobertura v3 con la gramática de direcciones nombrada", () => {
    expect(PROSECNUR_NAVIGATION_CONTRACT).toEqual({
      version: 3,
      grammar: "modulo/modo/seccion/pestana/panel",
      coverage: "primary-routes-v1",
      modosCoverage: "monitoring-profiles-v1+calc-muestra-v1+material-campo-v1",
      tabsCoverage: "all-current-tabsets-v1",
      shellCoverage: "hojas-ruta-v1",
      consumableByShell: true,
      addressable: true,
    });
  });

  it("da a los ocho módulos un landing y secciones primarias válidas", () => {
    expect(PROSECNUR_MODULES).toHaveLength(8);

    const navigationKeys: string[] = [];
    const publishedRoutes: string[] = [];

    for (const module of PROSECNUR_MODULES) {
      const expected =
        EXPECTED_PRIMARY_NAVIGATION[
          module.slug as keyof typeof EXPECTED_PRIMARY_NAVIGATION
        ];

      expect(expected).toBeDefined();
      expect(module.to).toBe(expected.to);
      expect(module.landingKind).toBe(expected.landingKind);
      expect(module.sections.map(({ id, label, to, layoutPolicy }) => ({
        id,
        label,
        to,
        layoutPolicy,
      }))).toEqual(expected.sections);
      expect(module.sections.length).toBeGreaterThan(0);

      if (module.landingKind === "section") {
        expect(module.sections.some((section) => section.to === module.to)).toBe(true);
      } else {
        expect(["procesamiento", "hojas-ruta"]).toContain(module.slug);
        expect(["/procesamiento", "/hojas-ruta"]).toContain(module.to);
      }

      for (const section of module.sections) {
        expect(section.id.trim()).not.toBe("");
        expect(section.label.trim()).not.toBe("");
        expect(section.label[0]).toBe(section.label[0].toLocaleUpperCase("es-PE"));
        expect(section.label).toMatch(/[a-záéíóúüñ]/);
        expect(section.label).not.toMatch(/^\d+[.)-]?\s*/);
        expect(section.to).toMatch(/^\//);
        expect(["viewport", "legacy-scroll"]).toContain(section.layoutPolicy);
        expect(section.icon).toBeTruthy();
        expect(section).not.toHaveProperty("lockedReason");
        navigationKeys.push(`${module.slug}/${section.id}`);
        publishedRoutes.push(section.to);
        for (const tab of section.tabs ?? []) {
          expect(tab.id.trim()).not.toBe("");
          expect(tab.label.trim()).not.toBe("");
          expect(tab.label[0]).toBe(tab.label[0].toLocaleUpperCase("es-PE"));
          expect(tab.label).toMatch(/[a-záéíóúüñ]/);
          expect(tab.to).toMatch(/^\//);
          expect(tab.layoutPolicy).toBe("viewport");
          expect(tab.icon).toBeTruthy();
          expect(tab).not.toHaveProperty("lockedReason");
          navigationKeys.push(`${module.slug}/${section.id}/${tab.id}`);
          if (tab.direccionPublicada !== false) publishedRoutes.push(tab.to);
        }
      }
    }

    expect(new Set(navigationKeys).size).toBe(navigationKeys.length);
    expect(new Set(publishedRoutes).size).toBe(publishedRoutes.length);
  });

  it("define las cinco etapas y los tres destinos subordinados de Selección", () => {
    const routes = PROSECNUR_MODULES.find(
      (module) => module.slug === "hojas-ruta",
    );
    const delivery = routes?.sections.find((section) => section.id === "seleccion");

    expect(routes?.tone.accent).toBe("var(--pulso-module-routes)");
    expect(routes?.sections.map(({ id, label, to }) => ({ id, label, to }))).toEqual([
      { id: "territorio", label: "Territorio", to: "/hojas-ruta?seccion=territorio" },
      { id: "poblacion", label: "Población", to: "/hojas-ruta?seccion=poblacion" },
      { id: "muestra", label: "Muestra", to: "/hojas-ruta?seccion=muestra" },
      { id: "manzanas", label: "Manzanas", to: "/hojas-ruta?seccion=manzanas" },
      { id: "seleccion", label: "Selección", to: "/hojas-ruta?seccion=seleccion" },
    ]);
    expect(delivery?.tabs?.map(({ id, label, to }) => ({ id, label, to }))).toEqual([
      { id: "cuotas", label: "Cuotas", to: "/hojas-ruta?seccion=seleccion&pestana=cuotas" },
      { id: "titulares", label: "Titulares", to: "/hojas-ruta?seccion=seleccion&pestana=titulares" },
      { id: "reemplazos", label: "Reemplazos", to: "/hojas-ruta?seccion=seleccion&pestana=reemplazos" },
    ]);
  });

  it("mantiene ocho acentos de módulo distintos y fuera de los estados semánticos", () => {
    const accents = PROSECNUR_MODULES.map((module) => module.tone.accent);

    expect(new Set(accents).size).toBe(8);
    for (const module of PROSECNUR_MODULES) {
      expect(module.tone).toBe(MODULE_TONES[module.slug]);
    }
  });

  it("declara los modos de Monitoreo y las secciones de cada uno", () => {
    const monitoring = PROSECNUR_MODULES.find((module) => module.slug === "monitoreo");

    expect(monitoring).toBeDefined();
    for (const modo of monitoring?.modos ?? []) {
      expect(modo.label).toMatch(/[a-záéíóúüñ]/);
      for (const section of modo.sections) {
        expect(section.icon).toBeTruthy();
        expect(section.label[0]).toBe(section.label[0].toLocaleUpperCase("es-PE"));
        expect(section.label).toMatch(/[a-záéíóúüñ]/);
        expect(section).not.toHaveProperty("lockedReason");
      }
    }

    expect(monitoring?.modos?.map((modo) => ({
      id: modo.id,
      label: modo.label,
      sections: modo.sections.map(({ id, label, to, layoutPolicy }) => ({
        id,
        label,
        to,
        layoutPolicy,
      })),
    }))).toEqual([
      {
        id: "acreditacion",
        label: "Acreditación",
        sections: [
          // Esqueleto común de cuatro secciones (revamp de acreditación, A1).
          { id: "insumos", label: "Insumos", to: "/monitoreo?seccion=insumos", layoutPolicy: "viewport" },
          { id: "modelo", label: "Modelo", to: "/monitoreo?seccion=modelo", layoutPolicy: "viewport" },
          { id: "control", label: "Control", to: "/monitoreo?seccion=control", layoutPolicy: "viewport" },
          { id: "avance", label: "Avance", to: "/monitoreo?seccion=avance", layoutPolicy: "viewport" },
        ],
      },
      {
        id: "telefonico",
        label: "Telefónico",
        sections: [
          // Esqueleto común de cuatro secciones (revamp, 2026-10-23).
          { id: "insumos", label: "Insumos", to: "/monitoreo?seccion=insumos", layoutPolicy: "viewport" },
          { id: "modelo", label: "Modelo", to: "/monitoreo?seccion=modelo", layoutPolicy: "viewport" },
          { id: "control", label: "Control", to: "/monitoreo?seccion=control", layoutPolicy: "viewport" },
          { id: "avance", label: "Avance", to: "/monitoreo?seccion=avance", layoutPolicy: "viewport" },
        ],
      },
      {
        id: "territorial",
        label: "Territorial",
        sections: [
          { id: "fuentes", label: "Fuente", to: "/monitoreo?seccion=fuentes", layoutPolicy: "viewport" },
          { id: "modelo", label: "UMPs", to: "/monitoreo?seccion=modelo", layoutPolicy: "viewport" },
          { id: "calidad", label: "Validación", to: "/monitoreo?seccion=calidad", layoutPolicy: "viewport" },
          { id: "consultas", label: "Consultas internas", to: "/monitoreo?seccion=consultas", layoutPolicy: "viewport" },
          { id: "avance", label: "Avance territorial", to: "/monitoreo?seccion=avance", layoutPolicy: "viewport" },
          { id: "ocurrencias", label: "Ocurrencias de campo", to: "/monitoreo?seccion=ocurrencias", layoutPolicy: "viewport" },
        ],
      },
      {
        id: "aulas",
        label: "Cursos-horario",
        sections: [
          { id: "fuentes", label: "Fuentes", to: "/monitoreo?seccion=fuentes", layoutPolicy: "viewport" },
          { id: "modelo", label: "Agenda de cursos-horario", to: "/monitoreo?seccion=modelo", layoutPolicy: "viewport" },
          { id: "avance", label: "Avance", to: "/monitoreo?seccion=avance", layoutPolicy: "viewport" },
          { id: "calidad", label: "Validación", to: "/monitoreo?seccion=calidad", layoutPolicy: "viewport" },
          { id: "consultas", label: "Consultas", to: "/monitoreo?seccion=consultas", layoutPolicy: "viewport" },
        ],
      },
    ]);
  });

  it("declara los modos de Material de campo: el tipo de la campaña abierta (ADR 0111)", () => {
    const material = PROSECNUR_MODULES.find((module) => module.slug === "material-campo");
    expect(material?.modos?.map((modo) => ({
      id: modo.id,
      sections: modo.sections.map(({ id, to, tabs }) => ({ id, to, tabs: (tabs ?? []).map((tab) => tab.to) })),
    }))).toEqual([
      {
        id: "aulas",
        sections: [
          { id: "unidades", to: "/material-campo?modo=aulas&seccion=unidades", tabs: ["/material-campo?modo=aulas&seccion=unidades&pestana=lista", "/material-campo?modo=aulas&seccion=unidades&pestana=origen"] },
          { id: "accesos", to: "/material-campo?modo=aulas&seccion=accesos", tabs: ["/material-campo?modo=aulas&seccion=accesos&pestana=canales", "/material-campo?modo=aulas&seccion=accesos&pestana=vinculacion"] },
          { id: "catalogo", to: "/material-campo?modo=aulas&seccion=catalogo", tabs: ["/material-campo?modo=aulas&seccion=catalogo&pestana=tipos", "/material-campo?modo=aulas&seccion=catalogo&pestana=editor"] },
          { id: "paquetes", to: "/material-campo?modo=aulas&seccion=paquetes", tabs: ["/material-campo?modo=aulas&seccion=paquetes&pestana=armado"] },
          { id: "entrega", to: "/material-campo?modo=aulas&seccion=entrega", tabs: ["/material-campo?modo=aulas&seccion=entrega&pestana=traspaso"] },
        ],
      },
      {
        id: "correo",
        sections: [
          { id: "correo", to: "/material-campo?modo=correo&seccion=correo", tabs: ["/material-campo?modo=correo&seccion=correo&pestana=editor", "/material-campo?modo=correo&seccion=correo&pestana=contactos"] },
        ],
      },
    ]);
    // `territorial` no se declara hasta E2: aparece deshabilitado en «Nueva campaña».
    expect(material?.modos?.some((modo) => modo.id === "territorial")).toBe(false);
  });

  it("adjunta a Monitoreo las mismas pestañas del catálogo canónico", () => {
    const monitoring = PROSECNUR_MODULES.find((module) => module.slug === "monitoreo");
    const catalogos = MONITOREO_PESTANAS as unknown as Record<
      string,
      Record<string, readonly PestanaMonitoreoCatalogo[]>
    >;
    const declaradas = Object.values(catalogos)
      .flatMap((secciones) => Object.values(secciones))
      .flat();

    // El conteo se DERIVA del catálogo en vez de fijarse a mano. Estaba clavado
    // en 69 y ya iban 76: cada pestaña nueva y legítima dejaba este guard en
    // rojo, y un guard que se pone rojo por lo correcto acaba actualizándose a
    // ciegas o ignorándose. Lo que de verdad defiende son los asertos de abajo
    // —que el manifiesto y el catálogo sean el MISMO array, y que cada pestaña
    // tenga su `to` bien formado—; el número no añadía nada a eso. Comprobado
    // con un mutante: descolgar el catálogo de aulas deja el test en rojo.
    expect(declaradas.length).toBeGreaterThan(0);
    expect(TOTAL_PESTANAS_MONITOREO).toBe(declaradas.length);

    const adjuntas = monitoring?.modos?.flatMap((modo) =>
      modo.sections.flatMap((section) => section.tabs ?? []),
    ) ?? [];
    // El aserto con dientes: lo que el Shell adjunta tiene que ser exactamente
    // lo que el catálogo declara.
    expect(adjuntas).toHaveLength(declaradas.length);

    for (const modo of monitoring?.modos ?? []) {
      for (const section of modo.sections) {
        // modules.ts no clona ni traduce el catálogo: Shell y perfil reciben
        // exactamente el mismo array y, por extensión, los mismos objetos.
        expect(section.tabs).toBe(catalogos[modo.id]?.[section.id]);
        for (const tab of catalogos[modo.id]?.[section.id] ?? []) {
          expect(tab.id).toBe(tab.key);
          expect(tab.to).toBe(
            `/monitoreo?modo=${modo.id}&seccion=${section.id}&pestana=${tab.id}`,
          );
        }
      }
    }

    expect(
      declaradas
        .filter((tab) => tab.disponibilidad === "condicional")
        .map((tab) => tab.key),
      // Salvedades dejó de ser pestaña al pasar Telefónico al esqueleto común:
      // es una sub-vista de Control › Respuestas. Reserva y Reemplazos, las
      // condicionales del diseño, todavía no se declaran (P8 y P9). En
      // Acreditación, el grupo Contacto de Control existe solo si el estudio
      // declara el canal (`acreditacion.md` §1).
    ).toEqual(["correo", "barrido", "reintentos", "equipo"]);
  });

  it("adjunta sin clonar los catálogos de Muestra, Procesamiento y Dashboard", () => {
    const muestra = PROSECNUR_MODULES.find((module) => module.slug === "calc-muestra");
    const universidad = muestra?.modos?.find(
      (modo) => modo.id === "opinion-universitaria",
    );
    const procesamiento = PROSECNUR_MODULES.find(
      (module) => module.slug === "procesamiento",
    );
    const dashboard = PROSECNUR_MODULES.find((module) => module.slug === "dashboard");

    // D10 (2026-08-02): Consistencia dejó de ser subpágina de Fuentes y pasó a
    // pestaña propia de Datos, inmediatamente después. 23 → 24.
    // (2026-08-05): Selección gana «Perfil de la muestra», que describe de qué
    // están hechas las aulas elegidas. 26 → 27.
    // (2026-08-07, ADR 0067): Selección gana «Relato» (`aulas-relato`), el
    // sustento narrado de la corrida persistida, junto a Sustento. 27 → 28.
    // (2026-08-20): «Cursos-horario titulares» se parte en dos y lo operativo
    // deja de cargar con el porqué: nace «Solidez de la selección»
    // (`solidez`), justo después. 29 → 30.
    // (2026-08-27): Cálculo gana «¿Alcanza?» (`calculo-certeza`), la
    // certificación por simulación, que sale de ser un panel dentro de
    // «Cursos-horario requeridos» y pasa a pestaña propia y última. 30 → 31.
    // (2026-08-27, ADR 0082): Selección gana «¿Este sorteo o otro?»
    // (`aulas-rerandomizacion`), la última: aceptar o rechazar contra un
    // criterio fijado antes de sortear. 31 → 32.
    expect(TOTAL_PESTANAS_CALC_MUESTRA_UNIVERSIDAD).toBe(32);
    expect(CALC_MUESTRA_UNIVERSIDAD_PESTANAS.aulas.map((tab) => tab.id)).toEqual([
      "objetivo",
      "metodo",
      "laboratorio",
      "seleccion",
      "solidez",
      "perfil",
      "reemplazos",
      "aulas-relato",
      "auditoria",
      "aulas-rerandomizacion",
    ]);
    expect(TOTAL_PESTANAS_PROCESAMIENTO).toBe(32); // F6.4 «Estilo del cliente» 29 → 30; A10 W-E «Estilo del informe» 30 → 31; «Word» 31 → 32; sale «PowerPoint» 32 → 31. E4-E7 R4 «Comparativos» 31 → 32.
    expect(DASHBOARD_PESTANAS).toHaveLength(4);

    for (const [seccion, pestanas] of Object.entries(
      CALC_MUESTRA_UNIVERSIDAD_PESTANAS,
    )) {
      expect(universidad?.sections.find((item) => item.id === seccion)?.tabs).toBe(
        pestanas,
      );
    }
    for (const [seccion, pestanas] of Object.entries(PROCESAMIENTO_PESTANAS)) {
      expect(procesamiento?.sections.find((item) => item.id === seccion)?.tabs).toBe(
        pestanas,
      );
    }
    expect(dashboard?.sections.find((item) => item.id === "dashboard")?.tabs).toBe(
      DASHBOARD_PESTANAS,
    );
  });

  it("no tiene utilidades globales tras el retiro de Enciclopedia", () => {
    // La lista existe vacía a propósito: el contrato distingue módulo del
    // proyecto de utilidad global, y esa distinción sigue siendo cierta aunque
    // hoy no haya ninguna. El test fija que la app no volvió a colgar una
    // pantalla fuera de la jerarquía de módulos sin decidirlo.
    expect(PROSECNUR_GLOBAL_NAV_ITEMS).toEqual([]);
    expect(PROSECNUR_MODULES.some((module) => module.to === "/enciclopedia")).toBe(false);
  });
});
