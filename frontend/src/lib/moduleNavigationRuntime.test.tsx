import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  ModuleNavigationRuntimeProvider,
  useModuleNavigationRuntime,
  useRegisterModuleNavigationRuntime,
  type ModuleNavigationRuntimeRegistration,
} from "./moduleNavigationRuntime";

const registration: ModuleNavigationRuntimeRegistration = {
  moduleSlug: "hojas-ruta",
  activeSectionId: "territorio",
  preferredRailMode: "collapsed",
  sectionStates: {
    territorio: { done: true, badge: "Lista" },
    poblacion: { lockedReason: "Completa Territorio." },
  },
};

function RuntimeProbe({ register = false }: { register?: boolean }) {
  useRegisterModuleNavigationRuntime(register ? registration : null);
  const runtime = useModuleNavigationRuntime("hojas-ruta");
  const anyRuntime = useModuleNavigationRuntime();
  return (
    <output
      data-module-runtime={runtime?.activeSectionId ?? "none"}
      data-any-runtime={anyRuntime?.moduleSlug ?? "none"}
    />
  );
}

describe("module navigation runtime", () => {
  it("accepts the two declarative rail modes in the frozen registration", () => {
    expect(registration.preferredRailMode).toBe("collapsed");
    expect({
      ...registration,
      preferredRailMode: "expanded" as const,
    }.preferredRailMode).toBe("expanded");
  });

  it("is safe for shell consumers rendered outside the provider", () => {
    const html = renderToStaticMarkup(<RuntimeProbe register />);

    expect(html).toContain('data-module-runtime="none"');
    expect(html).toContain('data-any-runtime="none"');
  });

  it("provides an empty runtime until a mounted feature registers", () => {
    const html = renderToStaticMarkup(
      <ModuleNavigationRuntimeProvider>
        <RuntimeProbe />
      </ModuleNavigationRuntimeProvider>,
    );

    expect(html).toContain('data-module-runtime="none"');
    expect(html).toContain('data-any-runtime="none"');
  });
});
