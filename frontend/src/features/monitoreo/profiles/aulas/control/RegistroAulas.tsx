import { memo, useState, type ReactNode } from "react";

import type { MonitoreoAulasDashboard } from "../../../../../api/monitoreo";
import { EstadoChip } from "../../../../../components/EstadoChip";
import type { ChromeStatusTone } from "../../../../../components/ModuleCommandBar";
import { fmt } from "../kpisDeAulas";
import { useMarcarRefuerzo } from "../useMarcarRefuerzo";
import { construirRegistro, readinessDeRegistro, type FiltroDePartes, type ItemDeParte } from "./registroModelo";
import "../insumos/insumos.css";
import "./registro.css";

const FILTROS: Array<[FiltroDePartes, string]> = [["todos", "Todos"], ["sin", "Sin parte"], ["con", "Con parte"]];

/** El tono que pintaba `.aulas-ins-chip[data-tono]` en la fila de la lista (insumos.css). */
const TONO_DE_LECTURA: Record<ItemDeParte["tono"], ChromeStatusTone> = { ok: "success", aviso: "warn", riesgo: "danger", neutro: "neutral" };

/**
 * Control › Registro de campo (ficha Ctl4). Izquierda, los partes; al centro,
 * el parte del curso-horario tal como lo trae el libro, en solo lectura, con
 * su cuadre; a la derecha, las reservas que entraron sin caso declarado, que
 * es lo único que se declara en la app (B complemento, C refuerzo).
 */
function RegistroAulasImpl({ dashboard, cargando, vacioSinTablero, onGuardado }: {
  dashboard: MonitoreoAulasDashboard | null;
  cargando: boolean;
  vacioSinTablero: ReactNode;
  onGuardado?: () => void;
}) {
  const [filtro, setFiltro] = useState<FiltroDePartes>("todos");
  const [codigo, setCodigo] = useState("");
  const marca = useMarcarRefuerzo(onGuardado);
  const readiness = readinessDeRegistro(cargando, dashboard);
  if (cargando) return <section className="aulas-ins aulas-ins--silueta" aria-label="Registro de campo" aria-busy="true" data-audit-ready={readiness} />;
  const modelo = construirRegistro(dashboard, filtro, codigo);
  if (modelo.estado === "sin-tablero") return <section className="aulas-ins" aria-label="Registro de campo" data-audit-ready={readiness}>{vacioSinTablero}</section>;
  const p = modelo.elegido;

  return (
    <section
      className="aulas-reg"
      aria-label="Registro de campo"
      data-audit-ready={readiness}
      data-qa-geometry-group="aulas-control-registro"
      data-qa-geometry-contract="intrinsic"
    >
      <section className="aulas-ins-panel" aria-labelledby="aulas-reg-lista" data-qa-geometry-member="lista">
        <header className="aulas-ins-cabecera"><h3 id="aulas-reg-lista">Partes</h3></header>
        <div className="aulas-ins-tramos-selector" role="group" aria-label="Filtro">
          {FILTROS.map(([k, r]) => (
            <button key={k} type="button" className={filtro === k ? "is-activo" : undefined} aria-pressed={filtro === k} onClick={() => setFiltro(k)}>
              {r} ({fmt(modelo.cuentas[k])})
            </button>
          ))}
        </div>
        <ul className="aulas-reg-items" data-qa-geometry-capacity="owned" tabIndex={0} aria-label="Partes, con desplazamiento">
          {modelo.items.map((i) => (
            <li key={i.codigo}>
              <button type="button" className={p?.codigo === i.codigo ? "is-elegido" : undefined} aria-pressed={p?.codigo === i.codigo} onClick={() => setCodigo(i.codigo)}>
                <b>{i.codigo}</b>
                <span className="aulas-ins-sub">{i.facultad}</span>
                <EstadoChip label={i.lectura} tone={TONO_DE_LECTURA[i.tono]} />
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="aulas-ins-panel" aria-labelledby="aulas-reg-parte" data-qa-geometry-member="parte">
        <header className="aulas-ins-cabecera">
          <h3 id="aulas-reg-parte">{p ? `Parte de ${p.codigo}` : "Parte del curso-horario"}</h3>
          {p ? <span className="aulas-ins-sub">{[p.facultad, p.curso].filter(Boolean).join(", ")}</span> : null}
        </header>
        {p ? (
          <>
            <dl className="aulas-reg-franja">
              {p.franja.map((c) => <div key={c.rotulo}><dt>{c.rotulo}</dt><dd>{c.valor}</dd></div>)}
            </dl>
            {p.campos.length ? (
              <dl className="aulas-reg-campos">
                {p.campos.map((c) => <div key={c.rotulo}><dt>{c.rotulo}</dt><dd>{c.valor}</dd></div>)}
              </dl>
            ) : null}
            <p className="aulas-ins-chip aulas-reg-cuadre" data-tono={p.cuadre.tono}>{p.cuadre.texto}</p>
            <p className="aulas-ins-pie">El parte se lee de la hoja «Aulas Aplicadas (Campo)» y se corrige allí; Monitoreo lo vuelve a leer al actualizar.</p>
          </>
        ) : (
          <p className="aulas-ins-nota" data-qa-geometry-empty="legitimo">Todavía no hay partes ni cursos-horario con respuestas.</p>
        )}
      </section>

      <section className="aulas-ins-panel" aria-labelledby="aulas-reg-caso" data-qa-geometry-member="caso">
        <header className="aulas-ins-cabecera">
          <h3 id="aulas-reg-caso">Reservas sin caso declarado</h3>
          <span className="aulas-ins-sub">{fmt(modelo.sinCaso.length)}</span>
        </header>
        {modelo.sinCaso.length ? (
          <ul className="aulas-reg-casos">
            {modelo.sinCaso.map((r) => (
              <li key={r.codigo}>
                <span><b>{r.codigo}</b> <span className="aulas-ins-sub">{r.facultad}, {r.estado}</span></span>
                <span className="aulas-ins-acciones">
                  <button
                    type="button"
                    className="pulso-button pulso-button--secondary pulso-button--sm"
                    disabled={!r.titular || marca.marcando === r.codigo}
                    title={r.titular ? `Complemento (B) de ${r.titular}` : "Sin titular en la cadena: no puede ser B"}
                    onClick={() => { void marca.marcar(r.codigo, "complemento", r.titular); }}
                  >
                    B (complemento)
                  </button>
                  <button
                    type="button"
                    className="pulso-button pulso-button--secondary pulso-button--sm"
                    disabled={!r.facultad || marca.marcando === r.codigo}
                    title={`Refuerzo (C) de ${r.facultad}`}
                    onClick={() => { void marca.marcar(r.codigo, "refuerzo", r.facultad); }}
                  >
                    C (refuerzo)
                  </button>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="aulas-ins-nota" data-qa-geometry-empty="legitimo">Toda reserva en juego tiene su caso declarado.</p>
        )}
        {marca.aviso || marca.fallos.length ? (
          <p className="aulas-ins-pie" role="status">
            {marca.aviso}{marca.fallos.length ? ` No se pudo declarar ${marca.fallos.map((f) => f.codigo).join(", ")}: ${marca.fallos[0]?.motivo}` : ""}
          </p>
        ) : null}
        <p className="aulas-ins-pie">B completa a un curso-horario que se quedó corto; C refuerza la cuota de la facultad. El reemplazo (A) se lee de la hoja.</p>
      </section>
    </section>
  );
}

export const RegistroAulas = memo(RegistroAulasImpl);
