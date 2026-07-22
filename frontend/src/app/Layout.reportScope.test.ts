import { describe, expect, test } from "vitest";
import { processingHeaderReportScope } from "./Layout";

describe("processingHeaderReportScope", () => {
  test("distingue el informe compartido de una base activa", () => {
    expect(processingHeaderReportScope("/graficos", "?scope=consolidado")).toBe("consolidated");
    expect(processingHeaderReportScope("/graficos", "")).toBe("active");
    expect(processingHeaderReportScope("/analitica", "?scope=consolidado")).toBe("active");
  });
});
