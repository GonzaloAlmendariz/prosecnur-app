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
      { id: "cronograma", label: "Cronograma", to: "/bitacora?tab=cronograma", layoutPolicy: "viewport" },
      { id: "calendario", label: "Calendario", to: "/bitacora?tab=calendario", layoutPolicy: "viewport" },
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
    landingKind: "section",
    to: "/hojas-ruta",
    sections: [
      { id: "hojas-ruta", label: "Hojas de ruta", to: "/hojas-ruta", layoutPolicy: "viewport" },
    ],
  },
  recopiladores: {
    landingKind: "section",
    to: "/recopiladores",
    sections: [
      { id: "recopiladores", label: "Fichas QR", to: "/recopiladores", layoutPolicy: "viewport" },
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
  it("declara una cobertura parcial que el shell todavía no puede consumir", () => {
    expect(PROSECNUR_NAVIGATION_CONTRACT).toEqual({
      version: 1,
      coverage: "primary-routes-v1",
      tabsCoverage: "deferred",
      consumableByShell: false,
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
        expect(module.slug).toBe("procesamiento");
        expect(module.to).toBe("/procesamiento");
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
      }
    }

    expect(new Set(sectionIds).size).toBe(sectionIds.length);
    expect(new Set(sectionRoutes).size).toBe(sectionRoutes.length);
  });

  it("mantiene ocho acentos de módulo distintos y fuera de los estados semánticos", () => {
    const accents = PROSECNUR_MODULES.map((module) => module.tone.accent);

    expect(new Set(accents).size).toBe(8);
    for (const module of PROSECNUR_MODULES) {
      expect(module.tone).toBe(MODULE_TONES[module.slug]);
    }
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
