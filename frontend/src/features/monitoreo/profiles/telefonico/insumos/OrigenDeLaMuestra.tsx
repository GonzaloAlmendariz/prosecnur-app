import { useEffect, useMemo, useState } from "react";
import { Loader2, Save } from "../../../../../vendor/lucide-react";
import { apiMonitoreoConfig } from "../../../../../api/monitoreo";
import type { MonitoreoAcreditacionReports, MonitoreoState } from "../../../../../api/client";
import { NotaDelModo } from "../../../core/NotaDelModo";
import { Switch } from "../../../../../components/Switch";
import {
  borradorInicial,
  clavesDelPerfil,
  columnasOfrecidas,
  filasDeOrigen,
  lecturaDeOrigen,
  mismoBorrador,
  rolesSugeridos,
  siSugerido,
  valoresParaElegir,
  type BorradorDeOrigen,
  type RolDeOrigen,
} from "./origenModel";

const ROLES: ReadonlyArray<{ id: RolDeOrigen; etiqueta: string }> = [
  { id: "titular", etiqueta: "Titular" },
  { id: "reserva", etiqueta: "Reserva" },
  { id: "sin_rol", etiqueta: "Sin rol" },
];

function n(valor: number) {
  return valor.toLocaleString("es-PE");
}

function casos(valor: number | null) {
  return valor == null ? "—" : n(valor);
}

/**
 * Insumos › Llave y filtros › Origen de la muestra: qué columna separa la
 * muestra titular de su reserva y qué columna marca un reemplazo, con los
 * casos de cada valor. Sin declarar, se propone por el nombre de la columna y
 * el equipo confirma. Se guarda en el perfil (`sample_origin` y
 * `replacement_flag`); Modelo › Reserva y Avance › Reemplazos leen esas claves.
 */
export function OrigenDeLaMuestra({
  reports,
  state,
  onStateChange,
}: {
  reports: MonitoreoAcreditacionReports;
  state: MonitoreoState | null | undefined;
  onStateChange?: (state: MonitoreoState) => void;
}) {
  const filas = useMemo(() => filasDeOrigen(reports), [reports]);
  const variables = useMemo(() => state?.variables ?? [], [state?.variables]);
  const perfil = state?.config?.monitoreo_profile;
  const inicial = useMemo(() => borradorInicial(perfil, filas, variables), [perfil, filas, variables]);
  const [borrador, setBorrador] = useState<BorradorDeOrigen>(inicial.borrador);
  const [envio, setEnvio] = useState<{ guardando: boolean; error: string }>({ guardando: false, error: "" });
  useEffect(() => setBorrador(inicial.borrador), [inicial]);

  const columnas = useMemo(() => columnasOfrecidas(filas, variables), [filas, variables]);
  const valoresOrigen = valoresParaElegir(filas, variables, borrador.origen.columna);
  const valoresMarca = valoresParaElegir(filas, variables, borrador.marca.columna);
  const lectura = lecturaDeOrigen(borrador, filas);
  const sucio = !mismoBorrador(borrador, inicial.borrador) || !inicial.declarado;
  const puedeGuardar = Boolean(state?.config && (borrador.origen.columna || borrador.marca.columna));

  const elegirOrigen = (columna: string) => setBorrador((actual) => ({
    ...actual,
    origen: { columna, roles: rolesSugeridos(valoresParaElegir(filas, variables, columna)) },
  }));
  const elegirMarca = (columna: string) => setBorrador((actual) => ({
    ...actual,
    marca: { columna, si: siSugerido(valoresParaElegir(filas, variables, columna).map(({ valor }) => valor)) },
  }));
  const asignar = (valor: string, rol: RolDeOrigen) => setBorrador((actual) => ({
    ...actual,
    origen: { ...actual.origen, roles: { ...actual.origen.roles, [valor]: rol } },
  }));
  const marcarSi = (valor: string, si: boolean) => setBorrador((actual) => ({
    ...actual,
    marca: { ...actual.marca, si: si ? [...actual.marca.si, valor] : actual.marca.si.filter((item) => item !== valor) },
  }));

  const guardar = async () => {
    if (!state?.config) return;
    setEnvio({ guardando: true, error: "" });
    try {
      const result = await apiMonitoreoConfig({
        ...state.config,
        monitoreo_profile: { ...state.config.monitoreo_profile, ...clavesDelPerfil(borrador) },
      });
      onStateChange?.(result.state);
      setEnvio({ guardando: false, error: "" });
    } catch (error) {
      setEnvio({ guardando: false, error: (error as Error).message });
    }
  };

  return (
    <section className="mon-ctl-panel mon-origen" aria-label="Origen de la muestra">
      <header className="mon-insumos-cabecera">
        <strong>Origen de la muestra</strong>
        {inicial.declarado || inicial.sugerido ? (
          <span className="mon-insumos-estado">{inicial.declarado ? "Declarado" : "Sugerido por el nombre"}</span>
        ) : null}
        <button
          type="button"
          className="mon-insumos-boton is-primario"
          disabled={!sucio || !puedeGuardar || envio.guardando}
          onClick={() => { void guardar(); }}
        >
          {envio.guardando ? <Loader2 size={14} className="pulso-spin" /> : <Save size={14} />}
          <span>{envio.guardando ? "Guardando…" : "Confirmar origen"}</span>
        </button>
      </header>
      {envio.error ? <NotaDelModo tono="error" estado className="mon-origen-nota">{envio.error}</NotaDelModo> : null}

      <div className="mon-origen-cuerpo">
        <div className="mon-origen-bloque">
          <label className="mon-origen-columna">
            <span className="mon-ctl-antetitulo">Columna de origen</span>
            <select value={borrador.origen.columna} onChange={(event) => elegirOrigen(event.currentTarget.value)}>
              <option value="">Sin columna de origen</option>
              {columnas.map((columna) => <option key={columna} value={columna}>{columna}</option>)}
            </select>
          </label>
          {valoresOrigen.length ? (
            <table className="mon-ctl-tabla mon-origen-tabla">
              <thead>
                <tr>
                  <th scope="col">Valor en la hoja</th>
                  <th scope="col" className="is-num">Casos</th>
                  <th scope="col">Rol</th>
                </tr>
              </thead>
              <tbody>
                {valoresOrigen.map(({ valor, casos: cuantos }) => (
                  <tr key={valor}>
                    <th scope="row">{valor}</th>
                    <td className="is-num">{casos(cuantos)}</td>
                    <td>
                      <div className="mon-origen-roles" role="radiogroup" aria-label={`Rol de ${valor}`}>
                        {ROLES.map((rol) => (
                          <button
                            key={rol.id}
                            type="button"
                            role="radio"
                            aria-checked={(borrador.origen.roles[valor] ?? "sin_rol") === rol.id}
                            className={(borrador.origen.roles[valor] ?? "sin_rol") === rol.id ? `is-activo is-${rol.id}` : undefined}
                            onClick={() => asignar(valor, rol.id)}
                          >
                            {rol.etiqueta}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            borrador.origen.columna ? <p className="mon-origen-vacio">La columna no trae valores en este corte.</p> : null
          )}
        </div>

        <div className="mon-origen-bloque">
          <label className="mon-origen-columna">
            <span className="mon-ctl-antetitulo">Marca de reemplazo</span>
            <select value={borrador.marca.columna} onChange={(event) => elegirMarca(event.currentTarget.value)}>
              <option value="">Sin marca de reemplazo</option>
              {columnas.filter((columna) => columna !== borrador.origen.columna).map((columna) => <option key={columna} value={columna}>{columna}</option>)}
            </select>
          </label>
          {valoresMarca.length ? (
            <table className="mon-ctl-tabla mon-origen-tabla">
              <thead>
                <tr>
                  <th scope="col">Valor en la hoja</th>
                  <th scope="col" className="is-num">Casos</th>
                  <th scope="col">Significa reemplazo</th>
                </tr>
              </thead>
              <tbody>
                {valoresMarca.map(({ valor, casos: cuantos }) => (
                  <tr key={valor}>
                    <th scope="row">{valor}</th>
                    <td className="is-num">{casos(cuantos)}</td>
                    <td>
                      {/* Booleano que queda puesto: interruptor, no casilla (Meta B, L26). */}
                      <Switch
                        checked={borrador.marca.si.includes(valor)}
                        disabled={valor === "Sin dato"}
                        onToggle={() => marcarSi(valor, !borrador.marca.si.includes(valor))}
                        ariaLabel={`${valor} significa reemplazo`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            borrador.marca.columna ? <p className="mon-origen-vacio">La columna no trae valores en este corte.</p> : null
          )}
        </div>
      </div>

      {/* El vacío se dice una vez: o la lectura, o por qué no la hay. */}
      {lectura.conConteoOrigen ? (
        <footer className="mon-origen-lectura" aria-label="Lectura del origen">
          <dl>
            <div><dt>Muestra titular</dt><dd className="is-num">{n(lectura.titular)}</dd></div>
            <div><dt>Reserva</dt><dd className="is-num">{n(lectura.reserva)}</dd></div>
            {lectura.sinRol ? <div><dt>Sin rol</dt><dd className="is-num">{n(lectura.sinRol)}</dd></div> : null}
            {lectura.conConteoMarca ? <div><dt>Reemplazos marcados</dt><dd className="is-num">{n(lectura.reemplazos)}</dd></div> : null}
          </dl>
        </footer>
      ) : (
        <footer className="mon-origen-lectura">
          <NotaDelModo tono="neutro" className="mon-origen-nota">
            {borrador.origen.columna || borrador.marca.columna
              ? "Los casos de cada valor se cuentan al confirmar y actualizar el corte."
              : "Ninguna columna de la base parece separar la muestra titular de su reserva; si la hoja la trae, elígela arriba."}
          </NotaDelModo>
        </footer>
      )}
    </section>
  );
}
