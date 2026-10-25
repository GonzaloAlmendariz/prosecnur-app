import type { CasoDeCola } from "../colaDeInsistenciaModel";
import { diasDesde, fechaDeCola, siglaDeCuota } from "../colaDeInsistenciaModel";

export type ColumnasDeCola = {
  /** Rótulo de la columna de cuota que declara el estudio (Sede, Actor…). */
  categoria: string;
  /** Teléfono en uso y teléfonos del caso, si la hoja los trae. */
  telefono: boolean;
  /** Plataforma de las respuestas, para rotular la efectiva («Kobo» si no se dice). */
  plataforma?: string;
};

export function telefonoDelCaso(caso: CasoDeCola): string {
  if (caso.ordenTelefono == null) return "";
  return caso.numTelefonos != null
    ? `${caso.ordenTelefono.toLocaleString("es-PE")} de ${caso.numTelefonos.toLocaleString("es-PE")}`
    : caso.ordenTelefono.toLocaleString("es-PE");
}

/**
 * La columna del código mide lo que el código más largo: 92 px alcanzaban
 * para «PDM1698», pero un proGres («CGU268000420», RMS) se cortaba por la
 * izquierda y se montaba sobre los intentos.
 */
export function anchoDeColumnaDeCodigo(casos: readonly Pick<CasoDeCola, "codigo">[]) {
  const largo = Math.max(0, ...casos.map((caso) => caso.codigo.length));
  // El código va en negrita y con espaciado: 1.15 ch por carácter.
  const ancho = Math.round(largo * 1.15 * 10) / 10;
  return `max(92px, calc(${ancho}ch + 40px))`;
}

function tonoDeResultado(status: string) {
  const clave = status.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (clave.includes("despues") || clave.includes("whatsapp")) return "is-cita";
  if (clave.includes("contesta") || clave.includes("apagado") || clave.includes("colg")) return "is-reintento";
  return "";
}

/**
 * La cola caso por caso: intentos, último resultado y observación juntos, que
 * es lo que el supervisor mira para decidir si se sigue insistiendo.
 */
export function TablaDeCola({
  casos,
  columnas,
  elegido,
  onElegir,
  vacia = "Ningún caso de la cola cumple los filtros.",
}: {
  casos: readonly CasoDeCola[];
  columnas: ColumnasDeCola;
  elegido: string | null;
  onElegir: (codigo: string) => void;
  /** Qué decir sin filas: no es lo mismo una cola vacía que filtros sin resultado. */
  vacia?: string;
}) {
  const maximo = Math.max(1, ...casos.map((caso) => caso.intentos ?? 0));
  const anchoDelCodigo = anchoDeColumnaDeCodigo(casos);
  return (
    <div className="mon-cola-tabla-marco" data-scroll-reset="">
      <table className="mon-cola-tabla">
        <thead>
          <tr>
            <th scope="col" style={{ width: anchoDelCodigo }}>CodPulso</th>
            <th scope="col">Intentos</th>
            <th scope="col">Último resultado</th>
            <th scope="col">Observación de la hoja</th>
            <th scope="col">{columnas.telefono ? "Teléfono" : columnas.categoria}</th>
            <th scope="col">Fecha</th>
            <th scope="col">{columnas.plataforma ?? "Kobo"}</th>
          </tr>
        </thead>
        <tbody>
          {casos.map((caso) => {
            const activo = caso.codigo === elegido;
            return (
              <tr key={caso.codigo} className={activo ? "is-activo" : undefined} aria-current={activo ? "true" : undefined}>
                <th scope="row">
                  <button type="button" onClick={() => onElegir(caso.codigo)} aria-label={`Ver la ficha de ${caso.codigo}`}>
                    {caso.codigo}
                  </button>
                </th>
                <td className="mon-cola-intentos">
                  <b>{caso.intentos == null ? "—" : caso.intentos.toLocaleString("es-PE")}</b>
                  <i aria-hidden="true" style={{ width: `${((caso.intentos ?? 0) / maximo) * 100}%` }} />
                </td>
                <td title={caso.status || undefined}>
                  <span className={`mon-cola-resultado ${tonoDeResultado(caso.status)}`}>{caso.status || "—"}</span>
                </td>
                <td title={caso.observacion || undefined}>
                  <span className={caso.observacion ? "mon-cola-observacion" : "mon-cola-observacion is-vacia"}>
                    {caso.observacion || "Sin observación"}
                  </span>
                </td>
                <td>
                  {columnas.telefono ? telefonoDelCaso(caso) || "—" : caso.cuota ? (
                    <span className="mon-cola-cuota" title={caso.cuota}>{siglaDeCuota(caso.cuota) ?? caso.cuota}</span>
                  ) : "—"}
                </td>
                <td className="mon-cola-fecha">
                  <span>{fechaDeCola(caso.fecha) || "Sin fecha"}</span>
                  <small>{diasDesde(caso.diasSinRegistro)}</small>
                </td>
                <td>
                  <span className={`mon-cola-kobo${caso.efectivaKobo ? " is-efectiva" : ""}`}>
                    {caso.efectivaKobo ? "Efectiva" : "Sin efectiva"}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {!casos.length ? <p className="mon-cola-vacia">{vacia}</p> : null}
    </div>
  );
}
