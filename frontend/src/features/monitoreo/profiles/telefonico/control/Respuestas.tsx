import { useMemo, useState } from "react";
import { NotaDelModo } from "../../../core/NotaDelModo";
import type { CSSProperties } from "react";
import { Search } from "../../../../../vendor/lucide-react";
import {
  DOS_HORAS,
  ETIQUETA_DE_MARCA,
  ROTULO_DE_LLAVE,
  rotuloDeRepetidas,
  duracionLegible,
  filtrarEnvios,
  type FiltroDeRespuestas,
  type MarcaDeEnvio,
  type Respuestas as Modelo,
} from "./respuestasModel";
import { RotuloDePestana, useHayRotulo } from "../navegacion/RotuloDePestana";
import "./controlTelefonico.css";

function n(valor: number | null | undefined) {
  return valor == null ? "—" : valor.toLocaleString("es-PE");
}

function fechaCorta(fecha: string | null) {
  const partes = fecha?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return partes ? `${partes[3]}/${partes[2]}` : fecha ?? "—";
}

export type PasoDeLaCadena = { nombre: string; valor: number; detalle: string; merma?: string };

export type ReglaQueCuenta = { texto: string; tipo: "filtro" | "regla" | "aviso" };

const CHIPS: ReadonlyArray<{ id: FiltroDeRespuestas; etiqueta: string }> = [
  { id: "por-revisar", etiqueta: "Por revisar" },
  { id: "todas", etiqueta: "Todas" },
  { id: "corta", etiqueta: "Menos de 5 min" },
  { id: "repetida", etiqueta: "Repetidas" },
  { id: "no-cruza", etiqueta: "No cruzan" },
];

const TIPO_DE_REGLA: Record<ReglaQueCuenta["tipo"], string> = {
  filtro: "Filtro",
  regla: "Regla",
  aviso: "Aviso, no excluye",
};

/**
 * Control › Respuestas: la cadena de envíos a efectivas, la distribución de
 * duración y el registro de cada efectiva con sus marcas. Marcar no excluye;
 * lo que cuenta se edita en Insumos › Llave y filtros.
 */
export function Respuestas({
  modelo,
  cadena,
  reglas,
  segmento,
}: {
  modelo: Modelo;
  cadena: readonly PasoDeLaCadena[];
  reglas: readonly ReglaQueCuenta[];
  segmento: string;
}) {
  const [filtro, setFiltro] = useState<FiltroDeRespuestas>(modelo.porRevisar ? "por-revisar" : "todas");
  const [busqueda, setBusqueda] = useState("");
  const visibles = useMemo(() => filtrarEnvios(modelo.envios, filtro, busqueda), [modelo.envios, filtro, busqueda]);
  const maximoTramo = Math.max(1, ...modelo.tramos.map((tramo) => tramo.casos));
  const maximoDuracion = Math.max(1, ...modelo.envios.map((envio) => Math.min(envio.segundos ?? 0, DOS_HORAS)));
  const hayRotulo = useHayRotulo();
  const cuenta = (id: FiltroDeRespuestas) => (
    id === "todas" ? modelo.envios.length : id === "por-revisar" ? modelo.porRevisar : modelo.conteos[id as MarcaDeEnvio]
  );

  return (
    <div className="mon-respuestas" data-qa-geometry-group="telefonico-control-respuestas" data-qa-geometry-contract="intrinsic">
      <section className="mon-ctl-panel mon-respuestas-cadena-panel" aria-label="De los envíos a las efectivas">
        {/* §2a-bis: el rótulo de la pestaña encabeza su primera tarjeta. */}
        {hayRotulo ? <header className="mon-ctl-panel-cabecera mon-respuestas-cadena-cabecera"><RotuloDePestana /></header> : null}
        <div className="mon-respuestas-cadena">
        {cadena.map((paso) => (
          <div key={paso.nombre} className="mon-respuestas-paso">
            <span className="mon-ctl-antetitulo">{paso.nombre}</span>
            <strong className="is-num">{n(paso.valor)}</strong>
            <span>{paso.detalle}</span>
            <em>{paso.merma ?? ""}</em>
          </div>
        ))}
        </div>
      </section>

      <div className="mon-respuestas-medio">
        <section className="mon-ctl-panel mon-respuestas-duracion" aria-label="Duración de las efectivas">
          <header className="mon-ctl-panel-cabecera">
            <b>Duración de las {n(modelo.envios.length)} efectivas</b>
            <span
              className="mon-respuestas-mediana"
              title={`Entre el inicio y el fin${modelo.largas ? `. ${n(modelo.largas)} ${modelo.largas === 1 ? "duró" : "duraron"} más de 2 h` : ""}`}
            >
              Mediana {duracionLegible(modelo.mediana)}
            </span>
          </header>
          <div className="mon-barrido-columnas mon-respuestas-histograma" role="img" aria-label={modelo.tramos.map((tramo) => `${tramo.etiqueta}: ${n(tramo.casos)}`).join(", ")}>
            {modelo.tramos.map((tramo) => (
              <span key={tramo.etiqueta} className={tramo.corto && tramo.casos ? "is-corta" : undefined}>
                <b className="is-num">{n(tramo.casos)}</b>
                <i style={{ "--alto": `${(tramo.casos / maximoTramo) * 100}%` } as CSSProperties} />
                <em>{tramo.etiqueta}</em>
              </span>
            ))}
          </div>
        </section>
        <section className="mon-ctl-panel mon-respuestas-reglas" aria-label="Qué cuenta">
          <header className="mon-ctl-panel-cabecera"><span className="mon-ctl-antetitulo">Qué cuenta</span></header>
          <ul>
            {reglas.map((regla) => (
              <li key={regla.texto}>
                <span>{regla.texto}</span>
                <em className={`is-${regla.tipo}`}>{TIPO_DE_REGLA[regla.tipo]}</em>
              </li>
            ))}
          </ul>
          <NotaDelModo tono="neutro">Se edita en Llave y filtros, en Insumos.</NotaDelModo>
        </section>
      </div>

      <section className="mon-ctl-panel mon-respuestas-registro" aria-label="Registro de efectivas">
        <div className="mon-respuestas-filtros">
          <div className="mon-respuestas-chips" role="group" aria-label="Filtrar efectivas">
            {CHIPS.map((chip) => (
              <button
                key={chip.id}
                type="button"
                className={`mon-respuestas-chip${filtro === chip.id ? " is-activo" : ""}`}
                aria-pressed={filtro === chip.id}
                onClick={() => setFiltro(chip.id)}
              >
                {chip.id === "repetida" ? rotuloDeRepetidas(modelo) : `${chip.etiqueta} (${n(cuenta(chip.id))})`}
              </button>
            ))}
          </div>
          <label className="mon-cola-buscar mon-respuestas-buscar">
            <Search size={14} aria-hidden="true" />
            <input type="search" value={busqueda} placeholder="Buscar CodPulso" aria-label="Buscar CodPulso" onChange={(event) => setBusqueda(event.target.value)} />
          </label>
        </div>
        <div className="mon-ctl-tabla-marco" data-scroll-reset="">
          <table className="mon-ctl-tabla mon-respuestas-tabla">
            <thead>
              <tr>
                <th scope="col">CodPulso</th>
                <th scope="col">{segmento}</th>
                <th scope="col">Envío</th>
                <th scope="col">Duración</th>
                <th scope="col">Llave</th>
                <th scope="col">La hoja dice</th>
                <th scope="col">Responsable</th>
                <th scope="col">Marca</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((envio, indice) => (
                <tr key={`${envio.responseId || envio.codigo}-${indice}`}>
                  <th scope="row">{envio.codigo}</th>
                  <td>{envio.categoria || "—"}</td>
                  <td className="is-num">{fechaCorta(envio.fecha)}</td>
                  <td className="mon-respuestas-barra">
                    <i aria-hidden="true">
                      <b
                        className={envio.marcas.includes("corta") ? "is-corta" : undefined}
                        style={{ width: `${(Math.min(envio.segundos ?? 0, DOS_HORAS) / maximoDuracion) * 100}%` }}
                      />
                    </i>
                    <span className="is-num">{duracionLegible(envio.segundos)}</span>
                  </td>
                  <td className={`mon-respuestas-llave is-${envio.llave}`}>{ROTULO_DE_LLAVE[envio.llave]}</td>
                  <td>{envio.cruza ? envio.hojaDice || "—" : "—"}</td>
                  <td>{envio.cruza ? envio.responsable || "Sin asignar" : "—"}</td>
                  <td>
                    {envio.marcas.length ? envio.marcas.map((marca) => (
                      <span key={marca} className={`mon-respuestas-marca is-${marca}`}>{ETIQUETA_DE_MARCA[marca]}</span>
                    )) : <span className="mon-respuestas-marca is-efectiva">Efectiva</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!visibles.length ? <NotaDelModo tono="neutro" className="mon-respuestas-vacio">Ninguna efectiva cumple el filtro.</NotaDelModo> : null}
        </div>
        {/* Que marcar no excluye ya lo dice «Qué cuenta» (Aviso, no excluye): el pie sólo cuenta. */}
        <footer className="mon-respuestas-pie">
          {n(visibles.length)} de {n(modelo.envios.length)} efectivas
        </footer>
      </section>
    </div>
  );
}
