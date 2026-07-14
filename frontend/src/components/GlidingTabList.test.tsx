import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  GlidingTabList,
  computeGlidingIndicatorGeometry,
  findActiveGlidingItem,
} from "./GlidingTabList";

describe("findActiveGlidingItem", () => {
  const item = (key: string, hidden = false, disabled = false) => ({
    dataset: { glidingKey: key },
    hidden,
    disabled,
  });

  it("tracks active-key and dynamic catalog changes without relying on indexes", () => {
    const initial = [item("summary"), item("results")];
    expect(findActiveGlidingItem(initial, "summary")).toBe(initial[0]);
    expect(findActiveGlidingItem(initial, "results")).toBe(initial[1]);

    const dynamicCatalog = [item("context"), item("monitor"), item("results")];
    expect(findActiveGlidingItem(dynamicCatalog, "results")).toBe(dynamicCatalog[2]);
  });

  it("handles a temporarily absent or hidden active item and preserves disabled targets", () => {
    expect(findActiveGlidingItem([item("one")], "missing")).toBeNull();
    expect(findActiveGlidingItem([item("one", true)], "one")).toBeNull();
    expect(findActiveGlidingItem([item("locked", false, true)], "locked")?.disabled).toBe(true);
    expect(findActiveGlidingItem([item("null")], null)).toBeNull();
  });
});

describe("computeGlidingIndicatorGeometry", () => {
  it("measures a tab in both axes relative to the root padding box", () => {
    expect(computeGlidingIndicatorGeometry(
      { left: 100, top: 50, width: 500, height: 120 },
      { left: 238, top: 92, width: 84, height: 32 },
      { scrollLeft: 0, scrollTop: 0, clientLeft: 1, clientTop: 2 },
    )).toEqual({ x: 137, y: 40, width: 84, height: 32 });
  });

  it("keeps content coordinates stable inside a scrolled tablist", () => {
    expect(computeGlidingIndicatorGeometry(
      { left: 20, top: 10, width: 240, height: 180 },
      { left: 70, top: 45, width: 110, height: 44 },
      { scrollLeft: 160, scrollTop: 80, clientLeft: 2, clientTop: 3 },
    )).toEqual({ x: 208, y: 112, width: 110, height: 44 });
  });

  it("tracks vertical rails and wrapped rows with the full active box", () => {
    expect(computeGlidingIndicatorGeometry(
      { left: 40, top: 20, width: 280, height: 240 },
      { left: 52, top: 148, width: 196, height: 52 },
      { scrollLeft: 0, scrollTop: 0, clientLeft: 0, clientTop: 0 },
    )).toEqual({ x: 12, y: 128, width: 196, height: 52 });

    expect(computeGlidingIndicatorGeometry(
      { left: 100, top: 80, width: 360, height: 100 },
      { left: 112, top: 126, width: 148, height: 32 },
      { scrollLeft: 0, scrollTop: 0, clientLeft: 1, clientTop: 1 },
    )).toEqual({ x: 11, y: 45, width: 148, height: 32 });
  });
});

describe("GlidingTabList SSR", () => {
  it("preserves tablist semantics and renders one initially hidden indicator", () => {
    const html = renderToStaticMarkup(
      <GlidingTabList
        as="nav"
        activeKey="results"
        orientation="vertical"
        role="tablist"
        aria-label="Secciones"
        className="module-rail"
      >
        <button role="tab" data-gliding-key="results" aria-selected="true">
          Resultados
        </button>
      </GlidingTabList>,
    );

    expect(html).toContain("<nav");
    expect(html).toContain('role="tablist"');
    expect(html).toContain('aria-orientation="vertical"');
    expect(html).toContain('class="pulso-gliding-tab-list module-rail"');
    expect(html.match(/pulso-gliding-tab-indicator/g)).toHaveLength(1);
    expect(html).not.toContain("is-motion-ready");
    expect(html).toContain('data-gliding-key="results"');
  });

  it("accepts an absent active key without serializing it as a target", () => {
    const html = renderToStaticMarkup(
      <GlidingTabList activeKey={null} role="tablist">
        <button role="tab" data-gliding-key="null">Sin selección</button>
      </GlidingTabList>,
    );

    expect(html).not.toContain("is-visible");
    expect(html).not.toContain("is-motion-ready");
  });

  it("keeps a disabled active tab measurable and semantically disabled", () => {
    const html = renderToStaticMarkup(
      <GlidingTabList activeKey="locked" role="tablist">
        <button
          role="tab"
          data-gliding-key="locked"
          aria-selected="true"
          aria-disabled="true"
          disabled
        >
          Bloqueada
        </button>
      </GlidingTabList>,
    );

    expect(html).toContain('data-gliding-key="locked"');
    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain("disabled");
  });
});
