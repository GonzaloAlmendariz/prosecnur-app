// @vitest-environment happy-dom
/**
 * ADR 0133, fases 2 y 4: el menú «Exportar» de Gráficos lleva la espera y el
 * resultado en el contenedor de entregables, en forma «anclada»: al elegir un
 * formato el menú se cierra y el contenedor queda colgado del disparador con la
 * fase del job y «Cancelar»; el resultado se ve sin reabrir el menú. Nunca abre
 * el diálogo de guardado: el informe ya quedó en `Entregables/<Módulo>` o se
 * descargó.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProsecnurApi } from "../project/types";
import type { EstadoGeneracion } from "../../components/entregables/tipos";
import type { ExportarInformeMenuProps } from "./ExportarInformeMenu";

vi.mock("./estilo/ColoresPendientesAviso", () => ({
  ColoresPendientesAviso: () => null,
  ID_COLORES_PENDIENTES: "colores-pendientes",
  useColoresPendientes: () => ({ pendientes: [], completar: () => undefined }),
}));

const { ExportarInformeMenu } = await import("./ExportarInformeMenu");
const { archivoDesdeRespuesta } = await import("../../components/entregables/archivoDesdeRespuesta");

const CARPETA = "C:\\Users\\ana\\Estudios\\HSVG2026\\Entregables\\Procesamiento";

let host: HTMLDivElement;
let root: Root;
let dialogo: ReturnType<typeof vi.fn>;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  dialogo = vi.fn(async () => "C:\\Users\\ana\\reporte.pptx");
  window.prosecnurApi = {
    saveEntregableDialog: dialogo,
    abrirArchivo: vi.fn(async () => ({ ok: true })),
    mostrarEnCarpeta: vi.fn(async () => ({ ok: true })),
  } as unknown as ProsecnurApi;
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  document.body.innerHTML = "";
  delete window.prosecnurApi;
});

async function montar(props: Partial<ExportarInformeMenuProps> & { estado?: EstadoGeneracion; cerrar?: () => void }) {
  const { estado = { fase: "inactiva" }, cerrar = vi.fn(), ...resto } = props;
  const base: ExportarInformeMenuProps = {
    onExportPpt: vi.fn(),
    onExportWord: vi.fn(),
    generacion: { estado, cerrar },
    canExportFinal: true,
    isSharedReport: false,
    prepBlocked: false,
  };
  await act(async () => {
    root.render(
      <MemoryRouter>
        <ExportarInformeMenu {...base} {...resto} />
      </MemoryRouter>,
    );
  });
}

function disparador() {
  return host.querySelector<HTMLButtonElement>(".pulso-gv2-export-menu-trigger");
}

function boton(texto: string) {
  return Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find((b) => b.textContent?.includes(texto) || b.getAttribute("aria-label") === texto) ?? null;
}

describe("ExportarInformeMenu con el contenedor anclado (ADR 0133)", () => {
  it("al elegir PowerPoint el menú se cierra y se pide la exportación", async () => {
    const onExportPpt = vi.fn();
    const cerrar = vi.fn();
    await montar({ onExportPpt, cerrar });
    await act(async () => { disparador()?.click(); });
    expect(host.querySelector(".pulso-gv2-export-menu-popover")).not.toBeNull();
    await act(async () => { boton("PowerPoint")?.click(); });
    expect(onExportPpt).toHaveBeenCalledTimes(1);
    expect(cerrar).toHaveBeenCalled();
    expect(host.querySelector(".pulso-gv2-export-menu-popover")).toBeNull();
  });

  it("en curso: el disparador solo se deshabilita y el contenedor cuelga de él con la fase y Cancelar", async () => {
    const cancelar = vi.fn();
    await montar({ estado: { fase: "en_curso", titulo: "Informe en PowerPoint", paso: 3, pasos: 5, mensaje: "Dibujando láminas", porcentaje: 60, cancelar } });
    const t = disparador();
    expect(t?.disabled).toBe(true);
    expect(t?.querySelector(".pulso-spin")).toBeNull();
    expect(t?.textContent).toContain("Exportar");
    // A ≤1180 px el `:disabled` se compacta a ícono; exportando no (editor-v2.css lo excluye por este atributo).
    expect(t?.getAttribute("data-exportando")).toBe("true");
    const contenedor = host.querySelector(".pulso-gv2-export-menu > [data-entregable-forma='anclada']");
    expect(contenedor?.getAttribute("data-entregable-fase")).toBe("en_curso");
    expect(contenedor?.textContent).toContain("Paso 3 de 5: dibujando láminas");
    expect(host.querySelectorAll("[role='progressbar']")).toHaveLength(1);
    await act(async () => { boton("Cancelar")?.click(); });
    expect(cancelar).toHaveBeenCalled();
  });

  it("listo con guardado_en: no abre el diálogo y el resultado se ve sin reabrir el menú", async () => {
    const resultData = {
      ok: true, file_id: "ppt-job", filename: "HSVG2026_Reporte_de_graficos_07_11_26.pptx", size: 99, avisos: [],
      modulo: "Procesamiento", rotulo: "Reporte de gráficos",
      guardado_en: `${CARPETA}\\HSVG2026_Reporte_de_graficos_07_11_26.pptx`, aviso_guardado: null,
    };
    const cerrar = vi.fn();
    await montar({ estado: { fase: "lista", titulo: "Informe en PowerPoint", archivos: archivoDesdeRespuesta(resultData) }, cerrar });
    expect(dialogo).not.toHaveBeenCalled();
    expect(host.querySelector(".pulso-gv2-export-menu-popover")).toBeNull();
    const contenedor = host.querySelector("[data-entregable-forma='anclada']");
    expect(contenedor?.textContent).toContain("HSVG2026_Reporte_de_graficos_07_11_26.pptx");
    expect(contenedor?.textContent).toContain("Entregables\\Procesamiento");
    expect(host.querySelector(".pulso-entregable-tile")?.textContent).toBe("PPTX");
    expect(host.querySelectorAll("a")).toHaveLength(0);
    expect(disparador()?.disabled).toBe(false);
    await act(async () => { boton("Cerrar")?.click(); });
    expect(cerrar).toHaveBeenCalled();
  });

  it("fallo: causa, código y la acción extra del pie (ir a la lámina)", async () => {
    await montar({
      estado: { fase: "fallo", titulo: "Informe en PowerPoint", causa: "Lámina 3: su gráfico no se puede dibujar.", codigo: "E_GRAFICOS_RENDER", reintentar: vi.fn() },
      pieDelFallo: <button type="button">Ir a la lámina 3</button>,
    });
    const contenedor = host.querySelector("[data-entregable-forma='anclada']");
    expect(contenedor?.getAttribute("role")).toBe("alert");
    expect(contenedor?.textContent).toContain("Lámina 3: su gráfico no se puede dibujar.");
    expect(contenedor?.textContent).toContain("E_GRAFICOS_RENDER");
    expect(boton("Ir a la lámina 3")).not.toBeNull();
    expect(boton("Reintentar")).not.toBeNull();
  });

  it("sin plan exportable el disparador queda deshabilitado (y ese sí puede compactarse)", async () => {
    await montar({ canExportFinal: false });
    expect(disparador()?.disabled).toBe(true);
    expect(disparador()?.hasAttribute("data-exportando")).toBe(false);
  });

  it("editor-v2.css: el colapso a ícono del disparador deshabilitado no alcanza a una exportación en curso", () => {
    const css = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "v2/styles/editor-v2.css"), "utf8");
    // Las reglas que esconden el rótulo o achican el disparador deshabilitado a un ícono.
    const colapsan = [...css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^}]*)\}/g)]
      .filter(([, sel, cuerpo]) => sel.includes("export-menu-trigger:disabled")
        && /display:\s*(?:none|block)|width:\s*var\(--gv2-command-control-h\)/.test(cuerpo));
    expect(colapsan.length).toBeGreaterThanOrEqual(3);
    for (const [, sel] of colapsan) {
      for (const s of sel.split(",")) expect(s.trim()).toContain(":disabled:not([data-exportando])");
    }
  });
});
