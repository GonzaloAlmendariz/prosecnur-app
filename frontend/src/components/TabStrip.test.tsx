import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { Layers } from "../vendor/lucide-react";
import { TabStrip } from "./TabStrip";

describe("TabStrip", () => {
  test("vincula cada tab con un panel estable", () => {
    const html = renderToStaticMarkup(
      <TabStrip
        idBase="reportes"
        tabs={[
          { key: "resumen", label: "Resumen", icon: Layers },
          { key: "detalle", label: "Detalle", icon: Layers },
        ]}
        active="resumen"
        onChange={() => undefined}
      />,
    );

    expect(html).toContain('id="reportes-tab-resumen"');
    expect(html).toContain('aria-controls="reportes-panel-resumen"');
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('id="reportes-tab-detalle"');
    expect(html).toContain('aria-controls="reportes-panel-detalle"');
  });

  test("sus consumidores publican el tabpanel asociado", () => {
    const srcDir = path.resolve(__dirname, "..");
    const consumers = [
      path.join(srcDir, "features", "enciclopedia", "EnciclopediaHome.tsx"),
      path.join(srcDir, "features", "enciclopedia", "FichaMetodologica.tsx"),
    ];

    for (const file of consumers) {
      const source = fs.readFileSync(file, "utf8");
      expect(source, file).toMatch(/<TabStrip[\s\S]*?idBase="[^"]+"/);
      expect(source, file).toMatch(
        /<section\s+\{\.\.\.tabPanelProps\("[^"]+",\s*tab\)\}/,
      );
    }
  });
});
