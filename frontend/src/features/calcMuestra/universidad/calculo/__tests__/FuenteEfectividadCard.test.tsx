/**
 * «De dónde sale la tasa». UNSA 2026 (2026-10-14) dimensionaba con la
 * calibración embebida de otro estudio y no había forma de declarar desde la
 * pantalla una tasa única: hubo que escribir la config por la API.
 */
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { FuenteEfectividadCard } from "../FuenteEfectividadCard";
import {
  contarTauManuales,
  declararTauGlobal,
  efectividadDesactualizada,
  fuenteConstruida,
  fuenteDeclarada,
  tauReseteados,
} from "../../shared/efectividadFuente";
import { marcoCriteriosDesactualizado } from "../../shared/frame";
import type { CalcMuestraAulasState, CalcMuestraWorkspaceAulasConfig } from "../../../../../api/calcMuestra";

const marcoEmbebido = [{ efectividad_fuente: "calibracion_embebida", efectividad_tau: null }];
const marcoTau50 = [{ efectividad_fuente: "tau_global", efectividad_tau: 0.5 }];

type Props = Parameters<typeof FuenteEfectividadCard>[0];

function props(over: Partial<Props> = {}): Props {
  return {
    efectividad: {},
    aulaFrame: marcoEmbebido,
    tauDiseno: 0.5,
    puedeReconstruir: true,
    onDeclararTauGlobal: vi.fn(),
    onVolverACalibracion: vi.fn(),
    onReconstruir: vi.fn(),
    ...over,
  };
}

/** Los botones del árbol, con su texto plano. La tarjeta no usa hooks. */
function botones(p: Props): Array<{ texto: string; onClick: () => void; disabled: boolean }> {
  const out: Array<{ texto: string; onClick: () => void; disabled: boolean }> = [];
  const texto = (n: ReactNode): string =>
    typeof n === "string" || typeof n === "number"
      ? String(n)
      : Array.isArray(n)
        ? n.map(texto).join("")
        : isValidElement(n)
          ? texto((n.props as { children?: ReactNode }).children)
          : "";
  const visitar = (n: ReactNode) => {
    if (Array.isArray(n)) return n.forEach(visitar);
    if (!isValidElement(n)) return;
    const el = n as ReactElement<{ children?: ReactNode; onClick?: () => void; disabled?: boolean }>;
    if (el.type === "button") {
      out.push({ texto: texto(el.props.children), onClick: el.props.onClick!, disabled: Boolean(el.props.disabled) });
    }
    visitar(el.props.children);
  };
  visitar(FuenteEfectividadCard(p));
  return out;
}

describe("la fuente declarada y la construida", () => {
  it("sin declaración rige la calibración embebida", () => {
    expect(fuenteDeclarada({}).tipo).toBe("calibracion_embebida");
    expect(fuenteDeclarada(undefined).tipo).toBe("calibracion_embebida");
  });

  it("una tasa fuera de rango se lee como R la lee: embebida", () => {
    expect(fuenteDeclarada({ fuente: "tau_global", tau: 1.4 }).tipo).toBe("calibracion_embebida");
  });

  it("el marco sin anotación no es comparable y no se acusa", () => {
    expect(fuenteConstruida([{ faculty: "X" }])).toBeNull();
    expect(efectividadDesactualizada(declararTauGlobal(0.5, ""), [{ faculty: "X" }])).toBe(false);
  });

  it("declarar una tasa única deja el marco embebido desactualizado", () => {
    expect(efectividadDesactualizada(declararTauGlobal(0.5, ""), marcoEmbebido)).toBe(true);
    expect(efectividadDesactualizada(declararTauGlobal(0.5, ""), marcoTau50)).toBe(false);
  });

  it("cambiar la tasa declarada también lo deja desactualizado", () => {
    expect(efectividadDesactualizada(declararTauGlobal(0.55, ""), marcoTau50)).toBe(true);
  });

  it("el aviso de marco desactualizado lo recoge", () => {
    const frame = { aula_frame: marcoEmbebido } as unknown as CalcMuestraAulasState["frame"];
    const config = { efectividad: declararTauGlobal(0.5, "") } as CalcMuestraWorkspaceAulasConfig;
    expect(marcoCriteriosDesactualizado(frame, null, null, { config })).toBe(true);
    expect(marcoCriteriosDesactualizado(frame, null, null, { config: { ...config, efectividad: {} } })).toBe(false);
  });
});

describe("FuenteEfectividadCard", () => {
  it("con la calibración embebida dice que es de otro estudio y ofrece la tasa del Diseño", () => {
    const html = renderToStaticMarkup(<FuenteEfectividadCard {...props()} />);
    expect(html).toContain("calibración de un estudio anterior");
    const [declarar] = botones(props());
    expect(declarar.texto).toBe("Usar la tasa del Diseño (50,0 %) para todas");
  });

  it("declarar pasa la tasa del Diseño", () => {
    const p = props({ tauDiseno: 0.5 });
    botones(p)[0].onClick();
    expect(p.onDeclararTauGlobal).toHaveBeenCalledWith(0.5);
  });

  it("declarada y aplicada: sin pendiente, sólo se puede volver a la calibración", () => {
    const p = props({ efectividad: declararTauGlobal(0.5, ""), aulaFrame: marcoTau50 });
    const html = renderToStaticMarkup(<FuenteEfectividadCard {...p} />);
    expect(html).toContain("Todas las facultades usan <b>50,0 %</b>");
    expect(html).not.toContain("Pendiente de aplicar");
    expect(botones(p).map((b) => b.texto)).toEqual(["Volver a la calibración"]);
    botones(p)[0].onClick();
    expect(p.onVolverACalibracion).toHaveBeenCalled();
  });

  it("declarada sin reconstruir: lo dice y ofrece reconstruir", () => {
    const p = props({ efectividad: declararTauGlobal(0.5, ""), aulaFrame: marcoEmbebido });
    expect(renderToStaticMarkup(<FuenteEfectividadCard {...p} />)).toContain("Pendiente de aplicar");
    const reconstruir = botones(p).find((b) => b.texto === "Reconstruir el marco");
    reconstruir!.onClick();
    expect(p.onReconstruir).toHaveBeenCalled();
  });

  it("si el Diseño cambió después, lo dice y ofrece igualarla", () => {
    const p = props({ efectividad: declararTauGlobal(0.5, ""), aulaFrame: marcoTau50, tauDiseno: 0.6 });
    expect(renderToStaticMarkup(<FuenteEfectividadCard {...p} />)).toContain("El Diseño usa <b>60,0 %</b>");
    expect(botones(p)[0].texto).toBe("Igualar a la tasa del Diseño (60,0 %)");
  });

  it("sin base para reconstruir los botones quedan apagados y se dice por qué", () => {
    const p = props({ puedeReconstruir: false });
    expect(botones(p).every((b) => b.disabled)).toBe(true);
    expect(renderToStaticMarkup(<FuenteEfectividadCard {...p} />)).toContain("hace falta la base cargada");
  });

  it("con estratos fijados a mano dice cuántos conservan su tasa", () => {
    const p = props({ efectividad: declararTauGlobal(0.5, ""), aulaFrame: marcoTau50, manuales: 3 });
    const html = renderToStaticMarkup(<FuenteEfectividadCard {...p} />);
    expect(html).toContain("Las facultades sin tasa fijada a mano usan <b>50,0 %</b>.");
    expect(html).toContain("3 la tienen fijada a mano y la conservan.");
    expect(html).not.toContain("Todas las facultades usan");
    const uno = renderToStaticMarkup(<FuenteEfectividadCard {...props({ ...p, manuales: 1 })} />);
    expect(uno).toContain("1 la tiene fijada a mano y la conserva.");
  });

  it("sin manuales queda el texto de todas las facultades", () => {
    const p = props({ efectividad: declararTauGlobal(0.5, ""), aulaFrame: marcoTau50, manuales: 0 });
    expect(renderToStaticMarkup(<FuenteEfectividadCard {...p} />)).toContain("Todas las facultades usan <b>50,0 %</b>");
  });

  it("avisa las facultades que volvieron a la tasa del diseño", () => {
    const reseteados = tauReseteados([
      { facultad: "DERECHO", tau_anterior: 0.562, tau_vigente: 0.5 },
      { facultad: "LETRAS", tau_anterior: 0.61, tau_vigente: 0.5 },
      { facultad: "", tau_anterior: 0.6, tau_vigente: 0.5 },
    ]);
    expect(reseteados).toHaveLength(2);
    const html = renderToStaticMarkup(<FuenteEfectividadCard {...props({ reseteados })} />);
    expect(html).toContain("2 facultades volvieron a la tasa del diseño (50,0 %)");
    expect(html).toContain("porque el marco ya no publica su tasa propia");
    expect(html).toContain("DERECHO (antes 56,2 %)");
  });
});

describe("conteos de la procedencia del τ", () => {
  it("cuenta sólo los estratos manuales con tasa", () => {
    expect(contarTauManuales([
      { tau: 0.6, tau_origen: "manual" },
      { tau: 0, tau_origen: "manual" },
      { tau: 0.5, tau_origen: "marco" },
      { tau: 0.5 },
    ])).toBe(1);
    expect(contarTauManuales(undefined)).toBe(0);
  });

  it("tau_reseteados mal formado se lee vacío", () => {
    expect(tauReseteados(null)).toEqual([]);
    expect(tauReseteados([{ facultad: "X" }])).toEqual([]);
  });
});
