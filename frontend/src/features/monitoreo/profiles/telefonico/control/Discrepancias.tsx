import { useMemo, useState } from "react";
import { Check, Clipboard, Download, GitCompareArrows, Loader2, Save } from "../../../../../vendor/lucide-react";
import type { MonitoreoAcreditacionReports, MonitoreoState } from "../../../../../api/client";
import { apiMonitoreoTelefonicoDecidirDiscrepancia, type DecisionDeDiscrepancia } from "../../../../../api/monitoreoTelefonico";
import { EstadoVacio } from "../../../../../components/EstadoVacio";
import { NotaDelModo } from "../../../core/NotaDelModo";
import { useFocoMonitoreo } from "../../../useMonitoreoDireccion";
import {
  casosDeDiscrepancia,
  csvParaElEquipo,
  porResponsable,
  queDice,
  resumenDeDiscrepancias,
  textoParaElEquipo,
  type CasoDeDiscrepancia,
  type EstadoDeDecision,
} from "./discrepanciasModel";
import { RotuloDePestana, useHayRotulo } from "../navegacion/RotuloDePestana";
import "./controlTelefonico.css";
import "./discrepancias.css";

const TODOS = "";

const ROTULO_DE_DECISION: Record<EstadoDeDecision, string> = {
  pendiente: "Cuenta mientras tanto",
  cuenta: "Cuenta",
  no_cuenta: "No cuenta",
};

function n(valor: number) {
  return valor.toLocaleString("es-PE");
}

function fechaHora(iso: string) {
  if (!iso) return "";
  const fecha = new Date(iso);
  return Number.isNaN(fecha.getTime()) ? iso : fecha.toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" });
}

function descargar(nombre: string, contenido: string) {
  const url = URL.createObjectURL(new Blob([`﻿${contenido}`], { type: "text/csv;charset=utf-8" }));
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombre;
  enlace.click();
  URL.revokeObjectURL(url);
}

/**
 * Control › Discrepancias (T9): los casos en que Kobo y la hoja de barrido no
 * dicen lo mismo, en los dos sentidos (P2), agrupados por responsable para
 * avisar al equipo (copiar o exportar). A la derecha, el caso elegido y la
 * decisión «Cuenta / No cuenta» con nota; mientras no se decide, la efectiva
 * cuenta (P1). «La hoja dice Efectivo sin Kobo» se lista para avisar, pero se
 * resuelve en Avisos (P3): no hay envío que decidir.
 */
export function Discrepancias({
  reports,
  state,
  onStateChange,
}: {
  reports: MonitoreoAcreditacionReports;
  state: MonitoreoState | null | undefined;
  onStateChange?: (state: MonitoreoState) => void;
}) {
  const perfil = state?.config?.monitoreo_profile;
  const vigentes = useMemo(() => casosDeDiscrepancia(reports, perfil), [reports, perfil]);
  const resumen = resumenDeDiscrepancias(vigentes);
  const grupos = useMemo(() => porResponsable(vigentes), [vigentes]);
  const [responsable, setResponsable] = useState<string>(TODOS);
  const [aviso, setAviso] = useState<{ tono: "exito" | "error"; texto: string } | null>(null);
  const [foco, escribirFoco] = useFocoMonitoreo();
  const visibles = responsable === TODOS ? grupos.flatMap((grupo) => grupo.casos) : grupos.find((grupo) => grupo.responsable === responsable)?.casos ?? [];
  const elegido = vigentes.find((caso) => caso.codigo === foco) ?? visibles[0] ?? null;
  const gruposParaAvisar = responsable === TODOS ? grupos : grupos.filter((grupo) => grupo.responsable === responsable);
  const hayRotulo = useHayRotulo();

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(textoParaElEquipo(gruposParaAvisar));
      setAviso({ tono: "exito", texto: "Lista copiada: pégala en el chat del equipo." });
    } catch {
      setAviso({ tono: "error", texto: "No se pudo copiar; usa «Exportar CSV»." });
    }
  };

  if (!vigentes.length) {
    return (
      <section className="mon-ctl-panel mon-dsc-vacio mon-tel-vacio" aria-label="Discrepancias" data-qa-geometry-capacity="owned">
        {hayRotulo ? <header className="mon-ctl-panel-cabecera"><RotuloDePestana /></header> : null}
        <EstadoVacio
          tamano="normal"
          icono={<GitCompareArrows size={22} />}
          titulo="Kobo y la hoja dicen lo mismo"
          descripcion="Ninguna efectiva de Kobo sin «Efectivo» en la hoja ni «Efectivo» en la hoja sin envío de Kobo en este corte."
        />
      </section>
    );
  }

  return (
    <div className="mon-dsc" data-qa-geometry-group="telefonico-control-discrepancias" data-qa-geometry-contract="intrinsic">
      <div className="mon-dsc-izquierda">
        <section className="mon-ctl-panel mon-insumos-tarjeta" aria-label="Cómo no coinciden">
          {/* §2a-bis: el rótulo de la pestaña encabeza su primera tarjeta. */}
          {hayRotulo ? <header className="mon-tel-rotulo-de-tarjeta"><RotuloDePestana /></header> : null}
          <span
            className="mon-ctl-antetitulo"
            title="Mientras no se decide, la efectiva de Kobo cuenta en el avance. «Efectivo» sin Kobo se sigue en Avisos."
          >
            Cómo no coinciden
          </span>
          <dl className="mon-dsc-cifras">
            <div><dt>Kobo efectiva, la hoja no dice «Efectivo»</dt><dd className="is-num">{n(resumen.koboSinHoja)}</dd></div>
            <div><dt>La hoja dice «Efectivo», Kobo sin envío</dt><dd className="is-num">{n(resumen.hojaSinKobo)}</dd></div>
          </dl>
        </section>

        <section className="mon-ctl-panel mon-dsc-avisar" aria-label="Avisar al equipo" data-qa-geometry-capacity="owned">
          <header className="mon-ctl-panel-cabecera">
            <b>Avisar al equipo</b>
            <span>{n(grupos.length)} {grupos.length === 1 ? "responsable" : "responsables"}</span>
          </header>
          <ul className="mon-dsc-responsables">
            <li>
              <button type="button" className={responsable === TODOS ? "is-activo" : undefined} aria-pressed={responsable === TODOS} onClick={() => setResponsable(TODOS)}>
                <span>Todos</span><strong className="is-num">{n(vigentes.length)}</strong>
              </button>
            </li>
            {grupos.map((grupo) => (
              <li key={grupo.responsable}>
                <button
                  type="button"
                  className={responsable === grupo.responsable ? "is-activo" : undefined}
                  aria-pressed={responsable === grupo.responsable}
                  onClick={() => setResponsable(grupo.responsable)}
                >
                  <span>{grupo.responsable}</span><strong className="is-num">{n(grupo.casos.length)}</strong>
                </button>
              </li>
            ))}
          </ul>
          <footer className="mon-dsc-acciones">
            <button type="button" className="mon-insumos-boton is-primario" onClick={() => { void copiar(); }} disabled={!visibles.length}>
              <Clipboard size={14} /> Copiar para el equipo
            </button>
            <button
              type="button"
              className="mon-insumos-boton"
              disabled={!visibles.length}
              onClick={() => descargar("discrepancias-kobo-hoja.csv", csvParaElEquipo(visibles))}
            >
              <Download size={14} /> Exportar CSV
            </button>
            {aviso ? <NotaDelModo estado tono={aviso.tono} className="mon-dsc-aviso">{aviso.texto}</NotaDelModo> : null}
          </footer>
        </section>
      </div>

      <section className="mon-ctl-panel mon-dsc-centro" aria-label="Casos que no coinciden" data-qa-geometry-capacity="owned">
        <header className="mon-ctl-panel-cabecera">
          <b>{responsable === TODOS ? "Casos que no coinciden" : `Casos de ${responsable}`}</b>
          <span>{n(resumen.pendientes)} por decidir · {n(resumen.decididos)} {resumen.decididos === 1 ? "decidido" : "decididos"}</span>
        </header>
        <div className="mon-ctl-tabla-marco mon-dsc-marco">
          <table className="mon-ctl-tabla mon-dsc-tabla">
            {/* Anchos declarados (L28): con cinco nombres largos la Decisión
                quedaba fuera del marco a 1440. */}
            <colgroup>
              <col className="is-codigo" />
              <col className="is-hoja" />
              <col className="is-kobo" />
              <col className="is-responsable" />
              <col className="is-decision" />
            </colgroup>
            <thead>
              <tr>
                <th scope="col">CodPulso</th>
                <th scope="col">Hoja</th>
                <th scope="col">Kobo</th>
                {/* Responsable de la hoja y, debajo, el enumerador del envío en
                  * Kobo: en dos columnas, a 1280 las dos cabeceras se salían de
                  * su celda y los nombres quedaban en «Fabio In…». */}
                <th scope="col" title="Responsable en la hoja y, debajo, enumerador del envío en Kobo">Responsable</th>
                <th scope="col">Decisión</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((caso) => (
                <tr key={`${caso.sentido}-${caso.codigo}`} className={caso.codigo === elegido?.codigo ? "is-activo" : undefined} aria-current={caso.codigo === elegido?.codigo ? "true" : undefined}>
                  <th scope="row">
                    <button type="button" className="mon-dsc-codigo" onClick={() => escribirFoco(caso.codigo)}>{caso.codigo}</button>
                    {/* proGres bajo el código: en una columna propia la decisión quedaba cortada a 1440. */}
                    {caso.progres ? <small className="mon-dsc-progres" title={`proGres ${caso.progres}`}>{caso.progres}</small> : null}
                  </th>
                  {/* La hoja y Kobo en dos celdas: cada una dice su dato, sin frase
                      que los encadene. La lectura completa va en el tooltip. */}
                  <td className="mon-dsc-una-linea" title={queDice(caso)}>{caso.sentido === "hoja_sin_kobo" ? "Efectivo" : caso.hojaDice || "Sin status"}</td>
                  <td className="mon-dsc-una-linea" title={queDice(caso)}>{caso.sentido === "hoja_sin_kobo" ? "Sin envío" : "Efectiva"}</td>
                  <td className="mon-dsc-quien">
                    <span className="mon-dsc-una-linea" title={caso.responsable}>{caso.responsable || "—"}</span>
                    <small
                      className={`mon-dsc-una-linea${caso.enumeradorDistinto ? " mon-dsc-distinto" : ""}`}
                      title={caso.enumeradorDistinto ? `${caso.enumerador}, no es el responsable de la hoja ni tiene equivalencia confirmada en Llave y filtros` : caso.enumerador ? `Enumerador en Kobo: ${caso.enumerador}` : undefined}
                    >
                      Kobo: {caso.enumerador || "—"}
                    </small>
                  </td>
                  <td>
                    <span className={`mon-dsc-decision is-${caso.sentido === "hoja_sin_kobo" ? "avisos" : caso.decision}`}>
                      {caso.sentido === "hoja_sin_kobo" ? "Va a Avisos" : ROTULO_DE_DECISION[caso.decision]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <FichaDeDiscrepancia caso={elegido} state={state} onStateChange={onStateChange} />
    </div>
  );
}

function FichaDeDiscrepancia({
  caso,
  state,
  onStateChange,
}: {
  caso: CasoDeDiscrepancia | null;
  state: MonitoreoState | null | undefined;
  onStateChange?: (state: MonitoreoState) => void;
}) {
  const [borrador, setBorrador] = useState<{ codigo: string; decision: DecisionDeDiscrepancia | ""; nota: string }>({ codigo: "", decision: "", nota: "" });
  const [envio, setEnvio] = useState<{ guardando: boolean; error: string; hecho: boolean }>({ guardando: false, error: "", hecho: false });
  if (!caso) {
    return (
      <aside className="mon-ctl-panel mon-dsc-ficha is-vacia" aria-label="Caso por revisar" data-qa-geometry-capacity="owned">
        <span className="mon-ctl-antetitulo">Caso por revisar</span>
        <p>Elige un caso de la lista.</p>
      </aside>
    );
  }
  const actual = borrador.codigo === caso.codigo ? borrador : { codigo: caso.codigo, decision: "" as const, nota: "" };
  const decidible = caso.sentido === "kobo_sin_hoja" && Boolean(caso.responseId);
  const guardar = async () => {
    if (!actual.decision || !actual.nota.trim()) return;
    setEnvio({ guardando: true, error: "", hecho: false });
    try {
      const result = await apiMonitoreoTelefonicoDecidirDiscrepancia({
        response_id: caso.responseId, codpulso: caso.codigo, decision: actual.decision, note: actual.nota.trim(),
      });
      onStateChange?.(result.state);
      setEnvio({ guardando: false, error: "", hecho: true });
      setBorrador({ codigo: "", decision: "", nota: "" });
    } catch (error) {
      setEnvio({ guardando: false, error: (error as Error).message, hecho: false });
    }
  };

  return (
    <aside className="mon-ctl-panel mon-dsc-ficha" aria-label={`Caso ${caso.codigo}`}>
      <header className="mon-dsc-ficha-cabecera">
        <span className="mon-ctl-antetitulo">Caso por revisar</span>
        <b className="is-num">{caso.codigo}</b>
        {caso.progres ? <small>proGres {caso.progres}</small> : null}
      </header>
      <section className="mon-dsc-ficha-bloque" aria-label="Lo que dice la hoja">
        <span className="mon-ctl-antetitulo">La hoja de barrido</span>
        <dl>
          <div><dt>Status</dt><dd>{caso.hojaDice || "—"}</dd></div>
          <div><dt>Responsable</dt><dd>{caso.responsable}</dd></div>
          <div><dt>Fecha</dt><dd>{caso.fechaHoja || "—"}</dd></div>
        </dl>
      </section>
      <section className="mon-dsc-ficha-bloque" aria-label="Lo que dice Kobo">
        <span className="mon-ctl-antetitulo">Kobo</span>
        <dl>
          <div><dt>Envío</dt><dd>{caso.sentido === "hoja_sin_kobo" ? "Sin envío" : caso.fechaKobo || "Efectiva"}</dd></div>
          <div><dt>Enumerador</dt><dd className={caso.enumeradorDistinto ? "mon-dsc-distinto" : undefined}>{caso.enumerador || "—"}</dd></div>
        </dl>
      </section>
      <section className="mon-dsc-ficha-bloque mon-dsc-decidir" aria-label="Decisión del supervisor">
        <span className="mon-ctl-antetitulo">Decisión del supervisor</span>
        {decidible ? (
          <>
            <p className="mon-dsc-estado">
              Ahora: <b>{ROTULO_DE_DECISION[caso.decision]}</b>
              {caso.decididoEl ? ` (${fechaHora(caso.decididoEl)})` : ""}
            </p>
            {caso.nota ? <p className="mon-dsc-nota-guardada">«{caso.nota}»</p> : null}
            <div className="mon-dsc-opciones" role="radiogroup" aria-label="Decisión">
              {(["cuenta", "no_cuenta"] as const).map((opcion) => (
                <button
                  key={opcion}
                  type="button"
                  role="radio"
                  aria-checked={actual.decision === opcion}
                  className={actual.decision === opcion ? "is-activo" : undefined}
                  onClick={() => setBorrador({ ...actual, decision: opcion })}
                >
                  {opcion === "cuenta" ? "Cuenta" : "No cuenta"}
                </button>
              ))}
            </div>
            <label className="mon-dsc-nota">
              <span>Nota</span>
              <textarea
                rows={3}
                value={actual.nota}
                placeholder="Por qué: lo que dijo el responsable o la persona"
                onChange={(event) => setBorrador({ ...actual, nota: event.currentTarget.value })}
              />
            </label>
            <button
              type="button"
              className="mon-insumos-boton is-primario"
              disabled={!actual.decision || !actual.nota.trim() || envio.guardando}
              onClick={() => { void guardar(); }}
            >
              {envio.guardando ? <Loader2 size={14} className="pulso-spin" /> : envio.hecho ? <Check size={14} /> : <Save size={14} />}
              <span>{envio.guardando ? "Guardando…" : "Guardar decisión"}</span>
            </button>
            {envio.error ? <NotaDelModo tono="error" estado>{envio.error}</NotaDelModo> : null}
            <p className="mon-dsc-pie" title="Se guarda con la fecha y la nota. «No cuenta» la saca del avance al actualizar.">Se guarda en el proyecto</p>
          </>
        ) : caso.sentido === "hoja_sin_kobo" ? (
          <NotaDelModo tono="aviso">
            <span title="El caso sigue en Avisos hasta que llegue el Kobo o se corrija la hoja">Sin envío de Kobo que decidir</span>
          </NotaDelModo>
        ) : (
          <NotaDelModo tono="neutro"><span title="Actualiza para decidir">El corte no trae su envío de Kobo</span></NotaDelModo>
        )}
      </section>
      {state?.config ? null : <NotaDelModo tono="neutro">Sin configuración cargada.</NotaDelModo>}
    </aside>
  );
}
