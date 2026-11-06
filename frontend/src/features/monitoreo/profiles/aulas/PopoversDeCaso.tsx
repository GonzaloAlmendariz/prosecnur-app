import type { MonitoreoAulasDashboard, MonitoreoAulasPlanRow, MonitoreoRow } from "../../../../api/monitoreo";
import { AulasPopoverReemplazo } from "./AulasPopoverReemplazo";
import { AulasPopoverRefuerzo } from "./AulasPopoverRefuerzo";
import { alertaDeAnticipacion } from "./alertaDeAnticipacion";
import { brechaDeLaFacultad, cuotaDeLaFacultad } from "./brechaDeLaFacultad";
import { deficitOperativo } from "./deficitOperativo";
import { proyeccionPorAgenda } from "./proyeccionPorAgenda";

/**
 * Los dos popovers con los que se decide un caso desde una brecha: el relevo
 * de un curso-horario (reemplazo A o complemento B) y el refuerzo (C) de una
 * facultad. Viven aquí y no en una sección porque los abren dos superficies:
 * Consultas (vista heredada) y Control › Brechas (Ctl7). Una sola copia de la
 * cuenta del plazo y de la deuda: dos acabarían discrepando.
 */

type Marcar = (codigo: string, tipo: "complemento" | "refuerzo", para: string) => unknown;

export function PopoverDeRelevo({ dashboard, codigo, marcar, onCerrar }: {
  dashboard: MonitoreoAulasDashboard;
  codigo: string;
  marcar: Marcar;
  onCerrar: () => void;
}) {
  const relevoDe = codigo;
  const setRelevoDe = (_: string) => onCerrar();
  const todas = (dashboard.agenda ?? []) as unknown as MonitoreoAulasPlanRow[];
  const caido = todas.find((f) =>
    String(f.operational_code ?? "").trim() === relevoDe
    || String(f.classroom_id ?? "").trim() === relevoDe);
  if (!caido) return null;
  return (
    <AulasPopoverReemplazo
      abierto
      caido={caido}
      filas={todas}
      // Lo que le falta a SU facultad, por sexo: es contra lo que se
      // elige, y el motor ya lo tiene por celda.
      // **`quotas_sex_faculty` y no `avance_sexo_facultad`.** El
      // segundo trae `brecha`, que es lo que faltará AL CIERRE
      // proyectando todo el plan: en este corte vale 0 en las treinta
      // celdas —«llega con todo el plan, con margen»— y con eso la
      // ayuda de cada candidato se apagaba entera. Lo que decide a
      // quién meter es lo que falta HOY, que es `missing`, y ése vive
      // en las cuotas. Es el mismo bloque que lee Registro de campo.
      brecha={brechaDeLaFacultad(
        (dashboard.quotas_sex_faculty ?? []) as Array<Record<string, unknown>>,
        String(caido.faculty ?? ""),
      )}
      // El plazo sale del MISMO sitio que la tabla «Cuándo pedir aula
      // adicional» de Resumen y que el popover de refuerzo: dos fechas
      // distintas para el mismo día útil es la avería más cara de este
      // perfil.
      pedirAntesDe={alertaDeAnticipacion(
        proyeccionPorAgenda(
          (dashboard.agenda ?? []) as MonitoreoRow[],
          (dashboard.partes_campo ?? []) as MonitoreoRow[],
          (dashboard.quotas_sex_faculty ?? []) as MonitoreoRow[],
        ),
        dashboard.banco_extras?.por_facultad ?? [],
      ).find((a) => a.facultad === String(caido.faculty ?? ""))?.pedirAntesDe ?? null}
      // **Aquí conviven A y B, y sólo B se marca.** Si el titular cayó
      // —rechazo o reemplazada— esto es un reemplazo (A), y A se aplica
      // en el Sheets: la app sólo lo lee. Si el titular sigue en pie y
      // lo que se busca es sumar, es un complemento (B) y sí se marca.
      onElegir={(fila) => {
        const cayo = /^(rechaz|reemplazada)/.test(
          String(caido.sample_status ?? "").trim().toLowerCase());
        if (!cayo) {
          void marcar(String(fila.operational_code ?? ""), "complemento",
                      String(caido.operational_code ?? ""));
        }
        setRelevoDe("");
      }}
      onCerrar={() => setRelevoDe("")}
    />
  );
}

export function PopoverDeRefuerzoDeFacultad({ dashboard, facultad, marcar, onCerrar }: {
  dashboard: MonitoreoAulasDashboard;
  facultad: string;
  marcar: Marcar;
  onCerrar: () => void;
}) {
  const refuerzoDe = facultad;
  const setRefuerzoDe = (_: string) => onCerrar();
          // El plazo sale del mismo sitio que la tabla «Cuándo pedir aula
          // adicional» de Resumen, no de una segunda cuenta: dos fechas
          // distintas para el mismo día útil es la avería más cara del perfil.
          const alerta = alertaDeAnticipacion(
            proyeccionPorAgenda(
              (dashboard.agenda ?? []) as MonitoreoRow[],
              (dashboard.partes_campo ?? []) as MonitoreoRow[],
              (dashboard.quotas_sex_faculty ?? []) as MonitoreoRow[],
            ),
            dashboard.banco_extras?.por_facultad ?? [],
          ).find((a) => a.facultad === refuerzoDe);
          return (
            <AulasPopoverRefuerzo
              facultad={refuerzoDe}
              filas={(dashboard.agenda ?? []) as unknown as MonitoreoAulasPlanRow[]}
              deuda={brechaDeLaFacultad(
                (dashboard.quotas_sex_faculty ?? []) as Array<Record<string, unknown>>,
                refuerzoDe,
              ) ?? { mujeres: 0, hombres: 0 }}
              // La meta y lo logrado, para que la cifra se explique sola y no
              // parezca contradecir al ranking del que se viene.
              cuota={cuotaDeLaFacultad(
                (dashboard.quotas_sex_faculty ?? []) as Array<Record<string, unknown>>,
                refuerzoDe,
              )}
              // **Lo que ya viene descontado, y el marco del plan.** El déficit
              // sin descontar lo agendado manda a reforzar facultades que ya
              // están cubiertas, y eso gasta una reserva que otra necesita.
              deficit={(() => {
                const c = cuotaDeLaFacultad(
                  (dashboard.quotas_sex_faculty ?? []) as Array<Record<string, unknown>>,
                  refuerzoDe,
                );
                return c
                  ? deficitOperativo(
                    c,
                    (dashboard.agenda ?? []) as unknown as MonitoreoAulasPlanRow[],
                    refuerzoDe,
                  )
                  : undefined;
              })()}
              pedirAntesDe={alerta?.pedirAntesDe ?? null}
              // **C se marca desde aquí.** Antes sólo cerraba y la decisión se
              // perdía. Ahora el aula queda en REFUERZO POR CONTACTAR —no
              // agendada, que nadie la ha llamado—, visible en la app.
              onElegir={(fila) => {
                void marcar(String(fila.operational_code ?? ""), "refuerzo", refuerzoDe);
                setRefuerzoDe("");
              }}
              onCerrar={() => setRefuerzoDe("")}
            />
          );
}
