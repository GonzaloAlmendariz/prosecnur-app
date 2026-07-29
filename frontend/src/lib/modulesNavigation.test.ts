import { describe, expect, it } from "vitest";
import {
  MODULE_TONES,
  PROSECNUR_GLOBAL_NAV_ITEMS,
  PROSECNUR_MODULES,
  PROSECNUR_NAVIGATION_CONTRACT,
  type ProsecnurModuleSlug,
} from "./modules";

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
      { id: "entrega", label: "Entrega", to: "/hojas-ruta?seccion=entrega", layoutPolicy: "viewport" },
    ],
  },
  recopiladores: {
    landingKind: "section",
    to: "/recopiladores",
    sections: [
      { id: "plan-recoleccion", label: "Plan", to: "/recopiladores", layoutPolicy: "viewport" },
      { id: "accesos", label: "Accesos", to: "/recopiladores?seccion=accesos", layoutPolicy: "viewport" },
      { id: "materiales", label: "Materiales", to: "/recopiladores?seccion=materiales", layoutPolicy: "viewport" },
      { id: "entrega-campo", label: "Entrega", to: "/recopiladores?seccion=entrega-campo", layoutPolicy: "viewport" },
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
      modosCoverage: "monitoring-profiles-v1+calc-muestra-v1",
      tabsCoverage: "hojas-ruta-v1",
      shellCoverage: "hojas-ruta-v1",
      consumableByShell: true,
      addressable: true,
    });
  });

  it("da a los ocho módulos un landing y secciones primarias válidas", () => {
    expect(PROSECNUR_MODULES).toHaveLength(8);

    const sectionIds: string[] = [];
    const sectionRoutes: string[] = [];

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
        sectionIds.push(section.id);
        sectionRoutes.push(section.to);
        for (const tab of section.tabs ?? []) {
          expect(tab.id.trim()).not.toBe("");
          expect(tab.label.trim()).not.toBe("");
          expect(tab.label[0]).toBe(tab.label[0].toLocaleUpperCase("es-PE"));
          expect(tab.label).toMatch(/[a-záéíóúüñ]/);
          expect(tab.to).toMatch(/^\//);
          expect(tab.layoutPolicy).toBe("viewport");
          expect(tab.icon).toBeTruthy();
          expect(tab).not.toHaveProperty("lockedReason");
          sectionIds.push(tab.id);
          sectionRoutes.push(tab.to);
        }
      }
    }

    expect(new Set(sectionIds).size).toBe(sectionIds.length);
    expect(new Set(sectionRoutes).size).toBe(sectionRoutes.length);
  });

  it("define las cinco etapas y los tres destinos subordinados de Entrega", () => {
    const routes = PROSECNUR_MODULES.find(
      (module) => module.slug === "hojas-ruta",
    );
    const delivery = routes?.sections.find((section) => section.id === "entrega");

    expect(routes?.tone.accent).toBe("var(--pulso-module-routes)");
    expect(routes?.sections.map(({ id, label, to }) => ({ id, label, to }))).toEqual([
      { id: "territorio", label: "Territorio", to: "/hojas-ruta?seccion=territorio" },
      { id: "poblacion", label: "Población", to: "/hojas-ruta?seccion=poblacion" },
      { id: "muestra", label: "Muestra", to: "/hojas-ruta?seccion=muestra" },
      { id: "manzanas", label: "Manzanas", to: "/hojas-ruta?seccion=manzanas" },
      { id: "entrega", label: "Entrega", to: "/hojas-ruta?seccion=entrega" },
    ]);
    expect(delivery?.tabs?.map(({ id, label, to }) => ({ id, label, to }))).toEqual([
      { id: "cuotas", label: "Cuotas", to: "/hojas-ruta?seccion=entrega&pestana=cuotas" },
      { id: "titulares", label: "Titulares", to: "/hojas-ruta?seccion=entrega&pestana=titulares" },
      { id: "reemplazos", label: "Reemplazos", to: "/hojas-ruta?seccion=entrega&pestana=reemplazos" },
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
          { id: "fuentes", label: "Fuentes", to: "/monitoreo?seccion=fuentes", layoutPolicy: "viewport" },
          { id: "modelo", label: "Modelo operativo", to: "/monitoreo?seccion=modelo", layoutPolicy: "viewport" },
          { id: "consultas", label: "Consultas", to: "/monitoreo?seccion=consultas", layoutPolicy: "viewport" },
          { id: "telefonico", label: "Monitoreo telefónico", to: "/monitoreo?seccion=telefonico", layoutPolicy: "viewport" },
          { id: "avance", label: "Avance", to: "/monitoreo?seccion=avance", layoutPolicy: "viewport" },
        ],
      },
      {
        id: "telefonico",
        label: "Telefónico",
        sections: [
          { id: "fuentes", label: "Fuentes", to: "/monitoreo?seccion=fuentes", layoutPolicy: "viewport" },
          { id: "modelo", label: "Modelo operativo", to: "/monitoreo?seccion=modelo", layoutPolicy: "viewport" },
          { id: "telefonico", label: "Llamadas", to: "/monitoreo?seccion=telefonico", layoutPolicy: "viewport" },
          { id: "consultas", label: "Consultas", to: "/monitoreo?seccion=consultas", layoutPolicy: "viewport" },
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

  it("modela Enciclopedia como utilidad global y no como módulo del proyecto", () => {
    expect(PROSECNUR_GLOBAL_NAV_ITEMS.map(({ id, label, shortLabel, to, layoutPolicy }) => ({
      id,
      label,
      shortLabel,
      to,
      layoutPolicy,
    }))).toEqual([
      {
        id: "enciclopedia",
        label: "Enciclopedia metodológica",
        shortLabel: "Enciclopedia",
        to: "/enciclopedia",
        layoutPolicy: "legacy-scroll",
      },
    ]);
    expect(PROSECNUR_MODULES.some((module) => module.to === "/enciclopedia")).toBe(false);
  });
});
