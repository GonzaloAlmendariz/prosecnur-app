import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { MonitoreoConfig } from "../../../../../../api/client";
import { borradorDeReglas, configuracionConReglas, frasesDeEfectiva, hayCambios, mover, problemasDelBorrador } from "./reglasModelo";
import { ReglasVista } from "./Reglas";

const config = {
  min_duration_seconds: 60,
  max_duration_seconds: 7200,
  goals: [],
  monitoreo_profile: {
    family: "acreditacion",
    variant: "multi_actor",
    status: "active",
    units: [], segments: [], groups: [], minimums: {},
    rejection_rules: [{ enabled: true, actor: "", question_patterns: ["q0001"], rejection_answers: ["No"] }],
    platform_test_filter: { enabled: true, variable: "es_prueba", label: "Es prueba", values: ["1"], value_label: "Sí" },
    key_rules: { universe_fields: ["Código PUCP", "Correo"], response_fields: ["custom_value"], use_name_fallback: false, automatic_detection: true },
    deduplication: { priority: ["Completa", "Parcial", "Rechazo", "Sin respuesta"] },
    alerts: { no_sweep_pct: 0.5, no_sweep_min_cases: 20, extra: 9 },
  },
} as unknown as MonitoreoConfig;

describe("Insumos › Reglas", () => {
  it("lee el perfil con los valores del motor donde no declara otro", () => {
    const borrador = borradorDeReglas(config);
    expect(borrador.alertas.no_sweep_pct).toBe("50");
    expect(borrador.alertas.no_answer_min_attempts).toBe("4");
    expect(borrador.duracionMinima).toBe("60");
    expect(hayCambios(config, borrador)).toBe(false);
  });

  it("guarda solo lo cambiado y deja viajar el resto como vino", () => {
    const borrador = { ...borradorDeReglas(config), respaldoNombre: true, prioridad: mover(["Completa", "Parcial", "Rechazo", "Sin respuesta"], 1, -1) };
    borrador.alertas = { ...borrador.alertas, no_sweep_pct: "25" };
    const guardada = configuracionConReglas(config, borrador);
    expect(guardada.monitoreo_profile.key_rules.use_name_fallback).toBe(true);
    expect(guardada.monitoreo_profile.key_rules.universe_fields).toEqual(["Código PUCP", "Correo"]);
    expect(guardada.monitoreo_profile.deduplication.priority).toEqual(["Parcial", "Completa", "Rechazo", "Sin respuesta"]);
    expect(guardada.monitoreo_profile.alerts.no_sweep_pct).toBe(0.25);
    expect(guardada.monitoreo_profile.alerts.extra).toBe(9);
    expect(guardada.monitoreo_profile.rejection_rules).toBe(config.monitoreo_profile.rejection_rules);
  });

  it("no deja guardar una duración mínima mayor que la máxima ni una proporción sobre 100", () => {
    const borrador = { ...borradorDeReglas(config), duracionMinima: "8000" };
    borrador.alertas = { ...borrador.alertas, no_sweep_pct: "140" };
    expect(problemasDelBorrador(borrador)).toHaveLength(2);
  });

  it("dice las reglas de efectiva en frases", () => {
    expect(frasesDeEfectiva(config.monitoreo_profile)).toEqual([
      "Si la pregunta «q0001» se responde «No», la respuesta cuenta como rechazo.",
      "Se excluyen como prueba las respuestas con Es prueba igual a «Sí».",
    ]);
  });

  it("dibuja las tres tarjetas sin claves técnicas y el cruce pendiente con el componente del sistema", () => {
    const html = renderToStaticMarkup(
      <ReglasVista config={config} borrador={borradorDeReglas(config)} cruces={null} onCambiar={() => {}} onGuardar={() => {}} guardando={false} />,
    );
    expect(html).toContain("Llave de cruce");
    expect(html).toContain("Qué cuenta como efectiva");
    expect(html).toContain("Alertas");
    expect(html).toContain("pulso-alert");
    expect(html).not.toMatch(/no_sweep|use_name_fallback|automatic_detection|min_duration/);
  });

  it("muestra cómo cruzó el último corte cuando llega", () => {
    const html = renderToStaticMarkup(
      <ReglasVista config={config} borrador={borradorDeReglas(config)} cruces={[{ rotulo: "Código PUCP declarado", casos: 233 }]} onCambiar={() => {}} onGuardar={() => {}} guardando={false} />,
    );
    expect(html).toContain("Código PUCP declarado");
    expect(html).toContain("233");
  });
});
