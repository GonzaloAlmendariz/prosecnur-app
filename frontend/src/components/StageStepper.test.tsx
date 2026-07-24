import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { Layers, Target } from "../vendor/lucide-react";
import {
  StageStepper,
  commitStageChange,
  resolveStageState,
} from "./StageStepper";
import { Stepper } from "./Stepper";

const stages = [
  {
    key: "prepare",
    label: "Preparar",
    description: "Revisar insumos",
    icon: Layers,
  },
  {
    key: "calculate",
    label: "Calcular",
    description: "Estimar resultados",
    icon: Target,
  },
  {
    key: "deliver",
    label: "Entregar",
    disabled: true,
    disabledReason: "Completa el cálculo.",
  },
] as const;

describe("StageStepper", () => {
  it("renders honest workflow semantics with visible labels for every stage", () => {
    const html = renderToStaticMarkup(
      <StageStepper
        stages={stages}
        currentStage="calculate"
        onStageChange={() => undefined}
        ariaLabel="Etapas del análisis"
        className="local-stepper"
      />,
    );

    expect(html).toContain("<nav");
    expect(html).toContain('aria-label="Etapas del análisis"');
    expect(html).toContain("<ol");
    expect(html.match(/<li/g)).toHaveLength(3);
    expect(html.match(/<button/g)).toHaveLength(3);
    expect(html).toContain('aria-current="step"');
    expect(html.match(/aria-current="step"/g)).toHaveLength(1);
    expect(html).toContain("Preparar");
    expect(html).toContain("Calcular");
    expect(html).toContain("Entregar");
    expect(html).toContain("Revisar insumos");
    expect(html).toContain("Estimar resultados");
    expect(html).toContain('title="Completa el cálculo."');
    expect(html).toContain("disabled");
    expect(html).toContain("local-stepper");
    expect(html).not.toContain('role="tablist"');
    expect(html).not.toContain('role="tab"');
    expect(html).not.toContain("aria-selected");
  });

  it("derives completed/current/pending states and keeps current selection a no-op", () => {
    expect(resolveStageState(0, 1)).toBe("completed");
    expect(resolveStageState(1, 1)).toBe("current");
    expect(resolveStageState(2, 1)).toBe("pending");
    expect(resolveStageState(2, 1, true)).toBe("completed");
    expect(resolveStageState(0, 1, false)).toBe("pending");

    const onStageChange = vi.fn();
    commitStageChange("calculate", "calculate", onStageChange);
    expect(onStageChange).not.toHaveBeenCalled();
    commitStageChange("calculate", "deliver", onStageChange);
    expect(onStageChange).toHaveBeenCalledWith("deliver");
  });

  it("keeps the legacy Stepper API as a semantic compatibility adapter", () => {
    const html = renderToStaticMarkup(
      <Stepper
        steps={[
          { key: "prepare", n: 1, label: "Preparar", icon: Layers, hint: "Revisar" },
          { key: "deliver", n: 2, label: "Entregar", icon: Target, hint: "Publicar" },
        ]}
        current="prepare"
        onChange={() => undefined}
      />,
    );

    expect(html).toContain('aria-label="Stepper"');
    expect(html).toContain("<ol");
    expect(html).toContain("Revisar");
    expect(html).toContain("Publicar");
    expect(html).not.toContain('role="tablist"');
    expect(html).not.toContain('role="tab"');
  });

  it("uses the contextual module accent without hiding stage labels", () => {
    const theme = fs.readFileSync(
      path.resolve(__dirname, "..", "app", "theme.css"),
      "utf8",
    );
    const stylesStart = theme.indexOf(".pulso-stepper {");
    const styles = theme.slice(
      stylesStart,
      theme.indexOf("@media (prefers-reduced-motion: no-preference)", stylesStart),
    );

    expect(styles).toContain(
      "--pulso-stepper-accent: color-mix(in srgb, var(--module-accent, var(--pulso-primary)) 82%, #001b33 18%);",
    );
    expect(styles).toContain(".pulso-stepper-list");
    expect(styles).toContain(".pulso-step-label");
    expect(styles).not.toContain("display: none");
    expect(styles).toContain("transform: scale(0.98);");
    expect(styles).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*?transform: none;/,
    );
  });
});
