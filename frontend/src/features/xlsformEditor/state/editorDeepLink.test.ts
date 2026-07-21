import { describe, expect, test } from "vitest";
import { editorFormIdFromSearch, editorRequestedFormExists } from "./editorDeepLink";

describe("editor form deep-link", () => {
  test("reads and decodes only the stable form_id", () => {
    expect(editorFormIdFromSearch("?form_id=actor%20%2F%20A")).toBe("actor / A");
    expect(editorFormIdFromSearch("?name=Docentes&active_form_id=wrong")).toBeNull();
  });

  test("rejects empty, control-character and oversized ids", () => {
    expect(editorFormIdFromSearch("?form_id=%20%20")).toBeNull();
    expect(editorFormIdFromSearch("?form_id=form%0Aid")).toBeNull();
    expect(editorFormIdFromSearch(`?form_id=${"x".repeat(129)}`)).toBeNull();
  });

  test("accepts a requested form that exists only in the backend index", () => {
    expect(editorRequestedFormExists("remote-form", [], ["remote-form"])).toBe(true);
    expect(editorRequestedFormExists("missing", ["local-form"], ["remote-form"])).toBe(false);
  });
});
