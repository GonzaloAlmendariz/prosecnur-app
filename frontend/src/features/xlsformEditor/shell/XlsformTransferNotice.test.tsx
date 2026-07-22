import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { XlsformTransferNotice } from "./XlsformTransferNotice";

describe("XlsformTransferNotice", () => {
  test("explica los límites de la traducción SurveyMonkey a XLSForm", () => {
    const markup = renderToStaticMarkup(<XlsformTransferNotice />);

    expect(markup).toContain("borrador");
    expect(markup).toMatch(/matrices|saltos|lógica/i);
    expect(markup).toMatch(/revis/i);
    expect(markup).toMatch(/public/i);
    expect(markup).not.toMatch(/aprobad[oa]/i);
  });
});
