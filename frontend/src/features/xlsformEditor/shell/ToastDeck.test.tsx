import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import {
  compactToastQueue,
  ToastDeck,
  type Toast,
} from "./ToastDeck";

function toast(id: string, overrides: Partial<Toast> = {}): Toast {
  return {
    id,
    kind: "info",
    title: "Formulario eliminado",
    ...overrides,
  };
}

describe("ToastDeck", () => {
  test("coalesces consecutive equivalent notices instead of covering the library", () => {
    const once = compactToastQueue([], toast("t-1"));
    const twice = compactToastQueue(once, toast("t-2"));

    expect(twice).toHaveLength(1);
    expect(twice[0]).toMatchObject({ id: "t-2", occurrences: 2 });

    const markup = renderToStaticMarkup(
      <ToastDeck items={twice} onDismiss={vi.fn()} />,
    );
    expect(markup).toContain("2 veces");
    expect(markup).toContain("×2");
    expect(markup).toContain('data-toast-portal="body"');
  });

  test("does not merge notices with actions and keeps the deck bounded", () => {
    const action = { label: "Descargar", onClick: vi.fn() };
    let items: Toast[] = [];
    items = compactToastQueue(items, toast("t-1", { action }));
    items = compactToastQueue(items, toast("t-2", { action }));
    items = compactToastQueue(items, toast("t-3", { title: "Importado" }));
    items = compactToastQueue(items, toast("t-4", { title: "Publicado" }));

    expect(items).toHaveLength(3);
    expect(items.map((item) => item.id)).toEqual(["t-2", "t-3", "t-4"]);
    expect(items.every((item) => item.occurrences === undefined)).toBe(true);
  });
});
