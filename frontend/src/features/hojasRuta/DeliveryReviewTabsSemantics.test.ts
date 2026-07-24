import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

describe("Hojas delivery-review tabs semantics", () => {
  test("links every review tab to the active delivery panel", () => {
    const source = fs.readFileSync(path.join(__dirname, "HojasRutaPage.tsx"), "utf8");
    const reviewTabs = source.slice(
      source.indexOf('aria-label="Revisión de entregables"'),
      source.indexOf('<JobProgress<HojasRutaJobResult>'),
    );

    expect(reviewTabs).toContain("id={hojasDeliveryReviewTabId(tab.key)}");
    expect(reviewTabs).toContain("aria-controls={HOJAS_DELIVERY_REVIEW_PANEL_ID}");
    expect(reviewTabs).toContain("id={HOJAS_DELIVERY_REVIEW_PANEL_ID}");
    expect(reviewTabs).toContain('role="tabpanel"');
    expect(reviewTabs).toContain(
      "aria-labelledby={hojasDeliveryReviewTabId(deliveryReviewTab)}",
    );
    expect(reviewTabs).toContain("tabIndex={0}");
  });
});
