import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AulasPestanaCuotas } from "./AulasPestanaCuotas";
import type { MonitoreoAulasDashboard } from "../../../../api/monitoreo";

/**
 * **De dónde sale la cuota tiene que decirlo el panel que la PINTA.**
 *
 * Medido el 2026-09-18 en la app, sobre CCSS Perfil 2026-II: el motor publicaba
 * `vigencia: "no_verificable"` con su motivo escrito —el sello de las metas no
 * casa con el de la selección—, `avanceCuota()` construía el chip «(sello sin
 * verificar)», había test del chip… y la pantalla enseñaba «Nivel 7 · faltan 121
 * · 0 de 121» con la palabra «sello» ausente de TODO el DOM, `title` incluido.
 *
 * La causa: el chip vivía sólo en «Metas por facultad y sexo», que se monta bajo
 * guarda (`proyeccion_metas`), y CCSS no publica esa proyección. Un aviso con
 * test y sin consumidor es un aviso que no existe.
 *
 * Por eso esta prueba renderiza la PESTAÑA y no el view-model: una prueba del
 * `chip` vuelve a pasar en verde el día que el montaje se caiga otra vez.
 */

const AVANCE = (parches: Record<string, unknown> = {}) => ({
  schema: "monitoreo_aulas_avance_cuota_v1",
  fuente: "design_targets",
  vigencia: "no_verificable",
  motivo: "El sello de las metas no se puede verificar (selection_run_id '' contra 'sel_aulas_2026'): se usan las cuotas del diseño sin poder confirmar su vigencia.",
  tasa_esperada: 0.5, tasa_fuente: "tau_disenio",
  eje: { clave: "nivel", etiqueta: "Nivel", etiqueta_plural: "Niveles", etiqueta_sin: "Sin nivel" },
  facultades: [{ facultad: "7", faculty_key: "7", cuota: 121, respuestas_validas: 0, brecha: 121 }],
  total: { cuota: 400, respuestas_validas: 0, brecha: 400, avance_pct: 0 },
  ...parches,
});

const pinta = (dashboard: Record<string, unknown>) => renderToStaticMarkup(
  <AulasPestanaCuotas
    dashboard={dashboard as unknown as MonitoreoAulasDashboard}
    pestana="cuotas"
    foco={null}
    facultadEnFoco={undefined}
    onFoco={() => {}}
    tabla={{} as never}
    diasDeCampoDelCorte={() => 1}
  />,
);

const BASE = {
  // VACÍO a propósito: es la condición que apagaba el chip. Con proyección, la
  // prueba pasaría en verde sobre la pantalla que en el estudio real salía muda.
  proyeccion_metas: null,
  avance_sexo_facultad: [{ facultad: "7", faculty_key: "7", sexo: "", cuota: 121, efectivas: 0 }],
  quotas_sex_faculty: [],
  aulas_por_facultad: [],
  reserva_dirigida: [],
};

describe("la procedencia de la cuota llega a la pantalla que la publica", () => {
  it("sin el panel de metas por sexo, el chip viaja al panel que sí se monta", () => {
    const html = pinta({ ...BASE, avance_cuota: AVANCE() });
    expect(html).toContain("sello sin verificar");
    // Una sola vez: el chip no se duplica con el del otro panel.
    expect(html.match(/sello sin verificar/g)).toHaveLength(1);
  });

  it("y el motivo entero viaja con él, que es lo que dice QUÉ no se pudo verificar", () => {
    const html = pinta({ ...BASE, avance_cuota: AVANCE() });
    expect(html).toContain("El sello de las metas no se puede verificar");
  });

  it("con el sello en regla no se inventa una advertencia", () => {
    // El chip sigue diciendo de dónde sale la cuota, pero sin la coletilla: un
    // aviso que sale siempre deja de avisar.
    const html = pinta({ ...BASE, avance_cuota: AVANCE({ vigencia: "vigente", motivo: "" }) });
    expect(html).not.toContain("sello sin verificar");
    expect(html).toContain("cuota del dise");
  });

  it("con el panel de metas por sexo montado, la procedencia se dice UNA vez", () => {
    // Ese panel ya lleva el chip en su cabecera: repetirlo dos veces en la misma
    // pantalla es ruido, y el guard de títulos ya cazó una vez ese patrón.
    const fila = {
      facultad: "7", meta: 121, meta_M: 60, meta_F: 61,
      obtenidas: 0, obtenidas_M: 0, obtenidas_F: 0,
      aulas_aplicadas: 0, aulas_agendadas: 2, elegibles_agendados: 40,
      tasa_usada: 0.5, tasa_es_del_diseno: true, tasa_diseno: 0.5, tasa_obtenida: 0,
      elegibles_aplicados: 0, desvio_de_la_del_diseno: 0,
      proyectadas: 20, proyectadas_M: 10, proyectadas_F: 10,
      total: 20, brecha: -101, llega: false,
      meta_elegida: "muestra", factor_meta: 1, supuesto_meta: "", supuesto_sexo: "",
    };
    const html = pinta({
      ...BASE,
      proyeccion_metas: { muestra_diseno: [fila] },
      avance_cuota: AVANCE(),
    });
    // **Primero: que el panel esté ahí de verdad.** Sin esta línea el test
    // contaría «una vez» sobre una pantalla donde el otro panel no se montó, y
    // pasaría en verde sin haber comprobado nada.
    expect(html).toContain("Metas por facultad y sexo");
    expect(html.match(/sello sin verificar/g)).toHaveLength(1);
  });
});
