import { ClipboardList } from "lucide-react";
import { EstadoVacio } from "../../../../../components/EstadoVacio";
import { EstadoChip } from "../../../../../components/EstadoChip";
import { fmt, fmtConSigno, rotuloDeCelda } from "../rotulos";
import type { CruceConCoordinacion as Modelo } from "./cruceConCoordinacionModelo";
import "./cruceConCoordinacion.css";

/** 2h parte 2 · Declarado por coordinación contra Kobo, celda por celda, dentro del detalle de la UMP. */
export function CruceConCoordinacion({ modelo, ump }: { modelo: Modelo; ump: string }) {
  if (modelo.estado === "sin-registro") {
    return (
      <div data-qa-geometry-empty="legitimo">
        <EstadoVacio icono={<ClipboardList size={15} />} titulo="Coordinación todavía no anotó efectivas por celda para esta UMP en el Excel de asignación." />
      </div>
    );
  }
  return (
    <section className="mon-falt-coord" aria-label={`UMP ${ump}: declarado por coordinación contra Kobo`}>
      <header>
        <h5>Declarado por coordinación</h5>
        <EstadoChip
          label={modelo.noCuadran ? `${fmt(modelo.noCuadran)} ${modelo.noCuadran === 1 ? "celda no cuadra" : "celdas no cuadran"}` : "Cuadra con Kobo"}
          tone={modelo.noCuadran ? "warn" : "success"}
        />
      </header>
      <div className="mon-falt-coord-marginales">
        {modelo.marginales.map((m) => (
          <table key={m.variable} className="mon-falt-cruce" aria-label={`${m.variable}: coordinación contra Kobo`}>
            <thead>
              <tr>
                <th scope="col">{m.variable}</th>
                <th scope="col">Coordinación</th>
                <th scope="col">Kobo</th>
                <th scope="col">Diferencia</th>
              </tr>
            </thead>
            <tbody>
              {m.celdas.map((c) => (
                <tr key={c.celda} className={c.diferencia ? "is-no-cuadra" : undefined}>
                  <th scope="row">{rotuloDeCelda(c.celda)}</th>
                  <td>{c.coordinacion == null ? "—" : fmt(c.coordinacion)}</td>
                  <td>{m.evaluable ? fmt(c.kobo) : "—"}</td>
                  <td>{c.diferencia == null ? "—" : c.diferencia === 0 ? "0" : fmtConSigno(c.diferencia)}</td>
                </tr>
              ))}
            </tbody>
            {m.evaluable ? null : (
              <caption>Sin meta de {m.variable.toLowerCase()} o sin esa variable en la base: no se cruza.</caption>
            )}
          </table>
        ))}
      </div>
      <p className="mon-falt-coord-pie">
        Kobo cuenta las efectivas de la manzana en uso, en observación incluidas (la misma base del avance, sin las subsanaciones). Lo declarado no se suma al avance: si no cuadra, se revisa en el Excel o en Kobo.
      </p>
    </section>
  );
}
