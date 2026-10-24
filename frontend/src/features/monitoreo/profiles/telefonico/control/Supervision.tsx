import { useMemo, useState } from "react";
import { ClipboardCheck } from "../../../../../vendor/lucide-react";
import type { MonitoreoAcreditacionReports, MonitoreoState } from "../../../../../api/client";
import type { RondaDeSupervisionApi } from "../../../../../api/monitoreoTelefonico";
import { usePanelDireccionable } from "../../../../../lib/navegacion/paneles";
import { DialogoNuevaRonda } from "./DialogoNuevaRonda";
import { DialogoPublicarRonda } from "./DialogoPublicarRonda";
import { RondasDeSupervision, PANEL_NUEVA_RONDA, PANEL_PUBLICAR_RONDA } from "./RondasDeSupervision";
import { avisosDeSupervision, baseDeSupervision, casosDeRondaApi, efectivasSinRonda, repartoDeRondaApi, hojaDeSupervision, rondasDesdeApi, rondasDesdeBloques, type FilaDeRonda } from "./rondasModel";
import { EstadoVacio } from "../../../../../components/EstadoVacio";
import { NotaDelModo } from "../../../core/NotaDelModo";
import { RotuloDePestana, useHayRotulo } from "../navegacion/RotuloDePestana";
import { construirSupervision, porcentajeLegible } from "./supervisionModel";
import "./controlTelefonico.css";
import "./supervision.css";

function n(valor: number) {
  return valor.toLocaleString("es-PE");
}

/**
 * Control › Supervisión (T9): qué efectivas se vuelven a llamar. A la
 * izquierda, el sorteo (base, cantidad declarada y su porcentaje, semilla y
 * regla), el reparto por enumerador (efectivas y casos, misma escala) y los
 * resultados; a la derecha, los casos sorteados con el resultado de la
 * rellamada si hay hoja de supervisión.
 */
export function Supervision({
  reports,
  state,
  onStateChange,
  onIrAFuentes,
}: {
  reports: MonitoreoAcreditacionReports;
  state?: MonitoreoState | null;
  onStateChange?: (state: MonitoreoState) => void;
  onIrAFuentes?: () => void;
}) {
  const modelo = useMemo(() => construirSupervision(reports), [reports]);
  // Tras generar o publicar, las rondas que devuelve la API mandan hasta el
  // próximo corte (los bloques del reporte se regeneran al Actualizar).
  // Atadas al corte en que se pidieron: al Actualizar, los bloques vuelven a mandar.
  const [desdeApi, setDesdeApi] = useState<{ corte: string; rondas: RondaDeSupervisionApi[] } | null>(null);
  const rondasApi = desdeApi && desdeApi.corte === (reports.generated_at ?? "") ? desdeApi.rondas : null;
  const [elegida, setElegida] = useState<number | null>(null);
  const hayRotulo = useHayRotulo();
  const panelNueva = usePanelDireccionable(PANEL_NUEVA_RONDA);
  const panelPublicar = usePanelDireccionable(PANEL_PUBLICAR_RONDA);
  const rondas = rondasApi ? rondasDesdeApi(rondasApi) : rondasDesdeBloques(reports);
  const base = useMemo(() => baseDeSupervision(reports), [reports]);
  const actual = elegida ?? rondas.at(-1)?.numero ?? null;
  const proxima = (rondas.filter((ronda) => ronda.guardada).at(-1)?.numero ?? 0) + 1;
  // Sin rondas guardadas, «efectivas sin ronda» del motor vale 0: la primera
  // sale de todas las efectivas y el diálogo las cuenta desde la base.
  const hayGuardadas = proxima > 1;
  // Publicar va sobre la elegida si se puede publicar; si no (o si el diálogo se
  // abrió por dirección), sobre la última guardada sin publicar.
  const publicables = rondas.filter((ronda) => ronda.guardada && !ronda.publicadaEn);
  const aPublicar = publicables.find((ronda) => ronda.numero === actual)?.numero ?? publicables.at(-1)?.numero ?? null;
  const hoja = hojaDeSupervision(state?.sources ?? []);
  const koboId = (state?.sources ?? []).find((fuente) => fuente.enabled && fuente.kind === "kobo")?.id ?? "";
  const preguntas = (state?.source_metadata?.variables_by_source?.[koboId] ?? [])
    .filter((stat) => stat.name && !/^(_|\.|meta\/|formhub|__version__|start$|end$)/.test(stat.name))
    .map((stat) => ({ nombre: stat.name, etiqueta: stat.label && stat.label !== stat.name ? stat.label : "" }));
  const hecha = (nuevas: RondaDeSupervisionApi[], estado: MonitoreoState) => {
    setDesdeApi({ corte: reports.generated_at ?? "", rondas: nuevas });
    setElegida(nuevas.at(-1)?.numero ?? null);
    onStateChange?.(estado);
  };

  if (!modelo || !modelo.base) {
    return (
      <section className="mon-ctl-panel mon-sup-vacio mon-tel-vacio" aria-label="Supervisión" data-qa-geometry-capacity="owned">
        {hayRotulo ? <header className="mon-ctl-panel-cabecera"><RotuloDePestana /></header> : null}
        <EstadoVacio
          tamano="normal"
          icono={<ClipboardCheck size={22} />}
          titulo="Sin efectivas para sortear"
          descripcion={modelo ? "El corte no trae efectivas de Kobo: la muestra de supervisión sale de ellas." : "El corte es anterior a la supervisión por enumerador; actualiza para sortear."}
        />
      </section>
    );
  }

  // Un corte anterior a las rondas no trae `supervision_rondas`: su sorteo es la
  // Ronda 1 sin guardar, con el porcentaje que resultó sobre todas las efectivas.
  const rondasVisibles: FilaDeRonda[] = rondas.length || !modelo.casos ? rondas : [{
    numero: 1, guardada: false, generadaEl: "", porcentaje: modelo.porcentaje, semilla: Number(modelo.semilla) || null,
    universo: modelo.base, corte: "", sorteados: modelo.casos, agregados: 0, casos: modelo.casos, publicadaEn: "", publicadaEl: "", lectura: "", leidaEl: "",
  }];
  const hayRondas = modelo.reparto.some((fila) => fila.ronda != null) || modelo.sorteados.some((caso) => caso.ronda != null);
  const repartoDelCorte = hayRondas && actual != null ? modelo.reparto.filter((fila) => fila.ronda === actual) : modelo.reparto;
  const casosDelCorte = hayRondas && actual != null ? modelo.sorteados.filter((caso) => caso.ronda === actual) : modelo.sorteados;
  // Una ronda recién generada todavía no está en los bloques: sus casos vienen de la API.
  const deLaApi = rondasApi?.find((ronda) => ronda.numero === actual);
  const casosDeRonda = casosDelCorte.length || !deLaApi ? casosDelCorte : casosDeRondaApi(deLaApi);
  const repartoVisible = repartoDelCorte.length || !deLaApi ? repartoDelCorte : repartoDeRondaApi(deLaApi);
  const maximo = Math.max(1, ...repartoVisible.map((fila) => fila.efectivas));
  // proGres es una llave del proyecto (RMS), no del modo: la columna sólo
  // aparece si algún caso la trae.
  const conProgres = casosDeRonda.some((caso) => caso.progres);
  const minimos = repartoVisible.filter((fila) => fila.minimo).length;

  return (
    <div className="mon-sup" data-qa-geometry-group="telefonico-control-supervision" data-qa-geometry-contract="intrinsic">
      {/* Dos columnas que terminan juntas: a la izquierda el sorteo, el reparto
        * (que toma el alto que queda y desplaza) y los resultados; al centro la
        * lista de casos. Sin tarjetas estiradas. */}
      <div className="mon-sup-izquierda">
          <RondasDeSupervision
            rondas={rondasVisibles}
            actual={actual}
            proxima={proxima}
            nuevas={hayGuardadas ? efectivasSinRonda(reports) : null}
            onElegir={setElegida}
            onNueva={panelNueva.abrir}
            onPublicar={(numero) => { setElegida(numero); panelPublicar.abrir(); }}
            onGuardada={hecha}
            hojaConectada={Boolean(hoja)}
            avisos={avisosDeSupervision(reports).map((fila) => fila.aviso)}
          />
        <section className="mon-ctl-panel mon-sup-reparto" aria-label="Por enumerador" data-qa-geometry-capacity="owned">
          <header className="mon-ctl-panel-cabecera">
            <b>Por enumerador</b>
            <span>{n(repartoVisible.length)} con efectivas</span>
          </header>
          {/* El aviso va dentro de su tarjeta, bajo el título (§2a-bis). */}
          {minimos ? (
            <NotaDelModo tono="info" className="mon-sup-reparto-nota">
              {minimos === 1 ? "Un enumerador sube" : `${n(minimos)} enumeradores suben`} a un caso por el mínimo.
            </NotaDelModo>
          ) : null}
          <ul className="mon-sup-lista">
            {repartoVisible.map((fila) => (
              <li key={fila.enumerador}>
                <span className="mon-sup-nombre">
                  {fila.enumerador}
                  {fila.minimo ? <em className="mon-sup-minimo" title="El caso existe por el mínimo de uno por enumerador">mínimo</em> : null}
                </span>
                <i className="mon-sup-barras" aria-hidden="true">
                  <i className="is-efectivas" style={{ width: `${(fila.efectivas / maximo) * 100}%` }} />
                  <i className="is-casos" style={{ width: `${(fila.casos / maximo) * 100}%` }} />
                </i>
                <span className="mon-sup-cifras is-num">{n(fila.efectivas)} · <b>{n(fila.casos)}</b></span>
              </li>
            ))}
          </ul>
          <footer className="mon-sup-leyenda">
            <span><i className="is-efectivas" aria-hidden="true" />Efectivas</span>
            <span><i className="is-casos" aria-hidden="true" />Casos sorteados</span>
          </footer>
        </section>
          {/* Sin hoja, la explicación vive una sola vez, en la tarjeta de casos. */}
          {modelo.hojaConectada ? (
          <section className="mon-ctl-panel mon-insumos-tarjeta" aria-label="Resultados de la rellamada">
            <span className="mon-ctl-antetitulo">Resultados de la rellamada</span>
              <dl className="mon-sup-sorteo">
                {modelo.enHoja != null ? <div><dt>En la hoja</dt><dd className="is-num">{n(modelo.enHoja)} de {n(modelo.casos)}</dd></div> : null}
              <div><dt>Coinciden con Kobo</dt><dd className="is-num">{n(modelo.resultados.coinciden)}</dd></div>
                <div><dt>No coinciden</dt><dd className="is-num">{n(modelo.resultados.noCoinciden)}</dd></div>
                <div><dt>Sin rellamar todavía</dt><dd className="is-num">{n(modelo.resultados.sinResultado)}</dd></div>
              </dl>
          </section>
          ) : null}
      </div>

      <section className="mon-ctl-panel mon-sup-casos" aria-label="Casos sorteados" data-qa-geometry-capacity="owned">
        <header className="mon-ctl-panel-cabecera">
          <b>Casos sorteados</b>
          <span>{actual != null ? `Ronda ${n(actual)}: ` : ""}{n(casosDeRonda.length)} para volver a llamar</span>
        </header>
        {modelo.hojaConectada ? null : (
          <NotaDelModo tono="neutro" className="mon-sup-casos-nota">
            <span>Sin hoja de supervisión: el resultado de cada rellamada aparece cuando el proyecto la conecta.</span>
            {onIrAFuentes ? <button type="button" className="mon-sup-enlace" onClick={onIrAFuentes}>Conectar la hoja en Fuentes</button> : null}
          </NotaDelModo>
        )}
        <div className="mon-ctl-tabla-marco mon-sup-marco">
          <table className="mon-ctl-tabla mon-sup-tabla">
            <thead>
              <tr>
                <th scope="col" className="is-num is-compacta">N</th>
                <th scope="col" className="is-compacta">CodPulso</th>
                {conProgres ? <th scope="col" className="is-compacta">proGres</th> : null}
                <th scope="col">Enumerador</th>
                <th scope="col" className="is-compacta">Categoría</th>
                <th scope="col" className="is-compacta">Envío</th>
                <th scope="col">Resultado de la rellamada</th>
                <th scope="col" className="is-compacta">Controles</th>
              </tr>
            </thead>
            <tbody>
              {casosDeRonda.map((caso) => (
                <tr key={caso.codigo}>
                  <td className="is-num is-compacta">{n(caso.n)}</td>
                  <th scope="row" className="is-compacta">{caso.codigo}</th>
                  {conProgres ? <td className="is-compacta">{caso.progres || "—"}</td> : null}
                  <td>{caso.enumerador}</td>
                  <td className="is-compacta">{caso.categoria || "—"}</td>
                  <td className="is-compacta">{caso.fechaKobo || "—"}</td>
                  <td>
                    {modelo.hojaConectada ? (
                      caso.resultado || caso.statusFinal ? (
                        <span className={`mon-sup-resultado${caso.coincide === "No" ? " is-no" : caso.coincide === "Sí" ? " is-si" : ""}`} title={caso.observacion || undefined}>
                          {[caso.resultado, caso.statusFinal].filter(Boolean).join(" · ")}
                          {caso.coincide ? ` (${caso.coincide === "Sí" ? "coincide" : "no coincide"})` : ""}
                        </span>
                      ) : <span className="mon-sup-pendiente">Sin rellamar</span>
                    ) : <span className="mon-sup-pendiente">—</span>}
                  </td>
                  <td
                    className={caso.controlesQueNoCoinciden.length ? "mon-sup-controles is-compacta is-no" : "mon-sup-controles is-compacta"}
                    title={caso.controlesQueNoCoinciden.length ? `No coinciden: ${caso.controlesQueNoCoinciden.join("; ")}` : undefined}
                  >
                    {modelo.hojaConectada ? caso.controles || "—" : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {panelNueva.abierto ? (
        <DialogoNuevaRonda
          numero={proxima}
          base={base}
          nuevas={hayGuardadas ? efectivasSinRonda(reports) : null}
          porcentajeInicial={Math.max(1, Math.round(modelo.porcentaje ?? 10))}
          onCerrar={panelNueva.cerrar}
          onHecha={(nuevas, estado) => { hecha(nuevas, estado); panelNueva.cerrar(); }}
        />
      ) : null}
      {panelPublicar.abierto && aPublicar != null ? (
        <DialogoPublicarRonda
          numero={aPublicar}
          hoja={hoja}
          preguntas={preguntas}
          onCerrar={panelPublicar.cerrar}
          onIrAFuentes={() => { panelPublicar.cerrar(); onIrAFuentes?.(); }}
          onHecha={(nuevas, estado) => { hecha(nuevas, estado); panelPublicar.cerrar(); }}
        />
      ) : null}
    </div>
  );
}
