import { memo, useMemo } from "react";
import { ClipboardList, TriangleAlert } from "lucide-react";
import type { MonitoreoTerritorialDashboard } from "../../../../../api/client";
import { useFocoMonitoreo } from "../../../useMonitoreoDireccion";
import { fmt } from "../rotulos";
import { construirReportes, textoDeDiferencia, type BaldosaDeUmp } from "./reportesModel";
import { RotuloDePestana } from "../navegacion/RotuloDePestana";
import { SiluetaDeDistrito } from "../avance/SiluetaDeDistrito";
import "./ocurrencias.css";

/**
 * Control › Reportes UMP (territorial.md §3.10): una retícula de baldosas por
 * distrito (sin parte, un parte, dos o más; borde ámbar si lo declarado no
 * cuadra con lo recibido en Kobo) y un lateral con la UMP elegida
 * (`foco=<UMP>`), la lista de las que no tienen parte y los partes de UMP que
 * no están en la ruta.
 */
function ReportesTabImpl({
  ocurrencias,
  validacion,
}: {
  ocurrencias: MonitoreoTerritorialDashboard | null;
  validacion: MonitoreoTerritorialDashboard | null;
}) {
  const modelo = useMemo(() => construirReportes(ocurrencias, validacion), [ocurrencias, validacion]);
  const [foco, escribirFoco] = useFocoMonitoreo();
  const todas = useMemo(() => modelo.distritos.flatMap((bloque) => bloque.baldosas), [modelo.distritos]);
  const elegida = todas.find((baldosa) => baldosa.ump === String(foco ?? "").replace(/^UMP\s*/i, "")) ?? null;

  if (!modelo.disponible) {
    return (
      <section className="mon-rep mon-rep--vacio" data-audit-ready="vacio:sin-partes" aria-label="Reportes UMP">
        <div className="mon-ocu-panel mon-ocu-vacio">
          <RotuloDePestana />
          <ClipboardList size={20} aria-hidden="true" />
          <strong>Sin partes por UMP en el corte</strong>
          <span>Los partes llegan del formulario de ocurrencias de campo; «Actualizar» trae los nuevos.</span>
        </div>
      </section>
    );
  }

  return (
    <section
      className="mon-rep"
      aria-label="Reportes UMP"
      data-audit-ready="monitoreo-territorial-control-reportes"
      data-qa-geometry-group="territorial-reportes"
      data-qa-geometry-contract="intrinsic"
    >
      <section className="mon-ocu-panel mon-rep-reticula-panel" aria-labelledby="mon-rep-titulo" data-qa-geometry-member="reticula">
        <header className="mon-ocu-cabecera">
          <RotuloDePestana />
          <h3 id="mon-rep-titulo" className="mon-ocu-titulo">Partes por UMP</h3>
          <span className="mon-ocu-base">
            {fmt(modelo.conUnParte)} con un parte · {fmt(modelo.conDosOMas)} con dos o más · {fmt(modelo.sinParte.length)} sin parte
            {modelo.noCuadran ? ` · ${fmt(modelo.noCuadran.total)} no cuadran con lo recibido (${fmt(modelo.noCuadran.conMenos)} con menos, ${fmt(modelo.noCuadran.conMas)} con más)` : ""}
          </span>
        </header>
        <div className="mon-rep-reticula" data-qa-geometry-capacity="owned">
          {modelo.distritos.map((bloque) => (
            <section key={bloque.distrito} className="mon-rep-distrito" aria-label={bloque.distrito}>
              <h4 className="mon-ocu-subtitulo mon-ter-con-silueta"><SiluetaDeDistrito distrito={bloque.distrito} lado={22} />{bloque.distrito}</h4>
              <ul className="mon-rep-baldosas">
                {bloque.baldosas.map((baldosa) => (
                  <li key={baldosa.ump}>
                    <button
                      type="button"
                      className={claseDeBaldosa(baldosa, elegida?.ump === baldosa.ump)}
                      aria-pressed={elegida?.ump === baldosa.ump}
                      aria-label={`UMP ${baldosa.ump}: ${rotuloDePartes(baldosa.partes)}${baldosa.diferencia ? `, ${textoDeDiferencia(baldosa.diferencia).toLowerCase()}` : ""}`}
                      onClick={() => escribirFoco(elegida?.ump === baldosa.ump ? null : baldosa.ump)}
                    >
                      {baldosa.ump}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <span className="mon-ocu-leyenda">
          <span className="is-sin-parte">Sin parte</span>
          <span className="is-un-parte">Un parte</span>
          <span className="is-dos-partes">Dos o más</span>
          <span className="is-no-cuadra">Borde: no cuadra con lo recibido</span>
        </span>
      </section>

      <aside className="mon-ocu-panel mon-rep-lateral" aria-label="UMP elegida y avisos" data-qa-geometry-member="lateral">
        {elegida ? (
          <section aria-labelledby="mon-rep-elegida">
            <h3 id="mon-rep-elegida" className="mon-ocu-titulo">UMP {elegida.ump}</h3>
            <dl className="mon-rep-cifras">
              <div><dt>Partes</dt><dd>{fmt(elegida.partes)}</dd></div>
              <div><dt>Efectivas en partes</dt><dd>{fmt(elegida.efectivasDeclaradas)}</dd></div>
              <div><dt>Recibidas en Kobo</dt><dd>{elegida.recibidas == null ? "—" : fmt(elegida.recibidas)}</dd></div>
              <div><dt>Intentos</dt><dd>{fmt(elegida.intentos)}</dd></div>
            </dl>
            {elegida.partes ? <p className={`mon-rep-cuadre${elegida.diferencia ? " is-no-cuadra" : ""}`}>{textoDeDiferencia(elegida.diferencia)}</p> : null}
          </section>
        ) : (
          <p className="mon-ocu-base">Elige una UMP para ver su parte frente a lo recibido.</p>
        )}
        <section aria-labelledby="mon-rep-sin-parte">
          <h4 id="mon-rep-sin-parte" className="mon-ocu-subtitulo">Sin parte · {fmt(modelo.sinParte.length)}</h4>
          {modelo.sinParte.length ? (
            <ul className="mon-rep-chips">
              {modelo.sinParte.map((ump) => <li key={ump}><button type="button" onClick={() => escribirFoco(ump)}>{ump}</button></li>)}
            </ul>
          ) : (
            <p className="mon-ocu-base">Todas las UMP tienen su parte.</p>
          )}
        </section>
        {modelo.fueraDeRuta.length ? (
          <p className="mon-rep-aviso">
            <TriangleAlert size={14} aria-hidden="true" />
            {modelo.fueraDeRuta.length === 1
              ? `UMP ${modelo.fueraDeRuta[0]} tiene parte pero no está en la ruta.`
              : `UMP ${modelo.fueraDeRuta.join(", ")} tienen parte pero no están en la ruta.`}
          </p>
        ) : null}
      </aside>
    </section>
  );
}

function rotuloDePartes(partes: number): string {
  if (!partes) return "sin parte";
  return partes === 1 ? "un parte" : `${fmt(partes)} partes`;
}

function claseDeBaldosa(baldosa: BaldosaDeUmp, elegida: boolean): string {
  const base = baldosa.partes === 0 ? "is-sin-parte" : baldosa.partes === 1 ? "is-un-parte" : "is-dos-partes";
  return `mon-rep-baldosa ${base}${baldosa.diferencia ? " is-no-cuadra" : ""}${elegida ? " is-elegida" : ""}`;
}

export const ReportesTab = memo(ReportesTabImpl);
