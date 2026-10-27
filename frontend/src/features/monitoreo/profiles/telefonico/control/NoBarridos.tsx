import { useMemo, useState } from "react";
import { CheckCircle2, Clipboard } from "../../../../../vendor/lucide-react";
import type { MonitoreoAcreditacionReports, MonitoreoState } from "../../../../../api/client";
import { EstadoVacio } from "../../../../../components/EstadoVacio";
import { NotaDelModo } from "../../../core/NotaDelModo";
import { useFocoMonitoreo } from "../../../useMonitoreoDireccion";
import { nombreDelSegmento, rotuloDelSegmento } from "../segmentoDeCuotas";
import { RotuloDePestana, useHayRotulo } from "../navegacion/RotuloDePestana";
import {
  UMBRALES_NO_BARRIDO,
  atrasadosDe,
  construirNoBarridos,
  diasLegibles,
  fechaCorta,
  fraseDeReferencia,
  mensajeParaElEquipo,
  mensajeParaElOperador,
  rotuloDeReferencia,
  type OperadorNoBarrido,
  type Severidad,
} from "./noBarridosModel";
import "./controlTelefonico.css";
import "./noBarridos.css";

function n(valor: number | null | undefined) {
  return valor == null ? "—" : valor.toLocaleString("es-PE");
}

const ROTULO_DE_SEVERIDAD: Record<Severidad, string> = {
  grave: "Grave",
  aviso: "En aviso",
  reciente: "Reciente",
  "sin-dato": "Sin fecha",
};

/** Chip de severidad: el estado va en el chip, nunca en el color del texto suelto. */
export function ChipDeSeveridad({ severidad }: { severidad: Severidad }) {
  return <span className={`mon-nb-chip is-${severidad}`}>{ROTULO_DE_SEVERIDAD[severidad]}</span>;
}

type Copia = { tono: "exito" | "error"; texto: string } | null;

async function copiarTexto(texto: string, hecho: string): Promise<Copia> {
  try {
    await navigator.clipboard.writeText(texto);
    return { tono: "exito", texto: hecho };
  } catch {
    return { tono: "error", texto: "No se pudo copiar el mensaje." };
  }
}

function Cifra({ rotulo, valor, nota, severidad }: { rotulo: string; valor: number; nota: string; severidad?: Severidad }) {
  return (
    <div className={`mon-nb-cifra${severidad ? ` is-${severidad}` : ""}`}>
      <span className="mon-ctl-antetitulo">{rotulo}</span>
      <strong className="is-num">{n(valor)}</strong>
      <span className="mon-nb-cifra-nota">{nota}</span>
    </div>
  );
}

function FichaDelOperador({ operador, corte, segmento }: { operador: OperadorNoBarrido | null; corte: string; segmento: string }) {
  const [copia, setCopia] = useState<Copia>(null);
  if (!operador) {
    return (
      <aside className="mon-ctl-panel mon-nb-ficha" aria-label="Ficha del operador">
        <span className="mon-ctl-antetitulo">Operador</span>
        <p className="mon-nb-ficha-vacia">Elige un operador de la tabla.</p>
      </aside>
    );
  }
  const atrasados = atrasadosDe(operador).length;
  return (
    <aside className={`mon-ctl-panel mon-nb-ficha is-${operador.severidad}`} aria-label={`Casos sin barrer de ${operador.nombre}`} data-qa-geometry-capacity="owned">
      <header className="mon-nb-ficha-cabecera">
        <span className="mon-nb-ficha-titulo">
          <span className="mon-ctl-antetitulo">Operador</span>
          <b>{operador.nombre}</b>
        </span>
        <ChipDeSeveridad severidad={operador.severidad} />
      </header>
      <dl className="mon-nb-ficha-cifras">
        <div><dt>Sin barrer</dt><dd className="is-num">{n(operador.casos.length)}</dd></div>
        <div><dt>Más antiguo</dt><dd className="is-num">{diasLegibles(operador.maxDias)}</dd></div>
        <div><dt>Última llamada</dt><dd className="is-num">{fechaCorta(operador.ultimaLlamada)}</dd></div>
      </dl>
      <div className="mon-nb-ficha-acciones">
        <button
          type="button"
          className="mon-nb-boton is-primario"
          onClick={() => { void copiarTexto(mensajeParaElOperador(operador, corte), "Mensaje copiado: pégalo en el chat del equipo.").then(setCopia); }}
        >
          <Clipboard size={14} aria-hidden="true" /> Copiar mensaje
        </button>
        <span className="mon-nb-ficha-alcance">
          {atrasados ? `${n(atrasados)} ${atrasados === 1 ? "caso atrasado" : "casos atrasados"}` : "Todos sus casos sin barrer"}
        </span>
      </div>
      {copia ? <NotaDelModo estado tono={copia.tono}>{copia.texto}</NotaDelModo> : null}
      <div className="mon-ctl-tabla-marco mon-nb-ficha-marco">
        <table className="mon-ctl-tabla mon-nb-tabla mon-nb-tabla-casos">
          <colgroup>
            <col />
            <col className="is-desde" />
            <col className="is-dias" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">{`Caso y ${segmento.toLocaleLowerCase("es")}`}</th>
              <th scope="col" className="is-num">Desde</th>
              <th scope="col" className="is-num">Días</th>
            </tr>
          </thead>
          <tbody>
            {operador.casos.map((caso) => (
              <tr key={caso.codigo} className={`is-${caso.severidad}`}>
                <th scope="row">
                  <span className="mon-nb-caso">
                    <b>{caso.codigo}</b>
                    {caso.cuota ? <small>{caso.cuota}</small> : null}
                  </span>
                </th>
                <td className="is-num" title={rotuloDeReferencia(caso.tipo)}>{fechaCorta(caso.referencia)}</td>
                <td className="is-num mon-nb-dias">{diasLegibles(caso.dias)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </aside>
  );
}

/**
 * Control › Barrido › No barridos: quién tiene casos asignados sin ningún
 * intento en la hoja y desde hace cuántos días. Arriba las cifras por
 * severidad; la tabla de operadores (elegir uno es `foco`) y, a la derecha,
 * sus casos con el mensaje listo para el chat del equipo. Sin acciones sobre la
 * hoja: la reasignación se hace en la hoja del equipo.
 */
export function NoBarridos({
  reports,
  state,
}: {
  reports: MonitoreoAcreditacionReports;
  state: MonitoreoState | null | undefined;
}) {
  const modelo = useMemo(() => construirNoBarridos(reports, state?.synced_at), [reports, state?.synced_at]);
  const [foco, escribirFoco] = useFocoMonitoreo();
  const [copia, setCopia] = useState<Copia>(null);
  const hayRotulo = useHayRotulo();
  const rotulo = hayRotulo ? <header className="mon-ctl-panel-cabecera mon-nb-rotulo"><RotuloDePestana /></header> : null;

  if (modelo.clave !== "lista") {
    return (
      <section className="mon-ctl-panel mon-nb-vacio" aria-label="No barridos" data-qa-geometry-capacity="owned">
        {rotulo}
        <EstadoVacio
          tamano="normal"
          icono={<CheckCircle2 size={22} />}
          titulo={modelo.clave === "sin-hoja" ? "Sin hoja de barrido" : "Este corte todavía no trae los casos sin barrer"}
          descripcion={modelo.clave === "sin-hoja" ? "Conecta la hoja de barrido en Insumos, Fuentes." : "Actualizar los arma con la hoja de barrido actual."}
        />
      </section>
    );
  }

  if (!modelo.casos.length) {
    return (
      <section className="mon-ctl-panel mon-nb-vacio" aria-label="No barridos" data-qa-geometry-capacity="owned">
        {rotulo}
        <EstadoVacio
          tamano="normal"
          icono={<CheckCircle2 size={22} />}
          titulo="Todo caso asignado tiene al menos un intento"
          descripcion={modelo.sinAsignar
            ? `${n(modelo.sinAsignar)} casos siguen sin asignar: no son atraso de nadie.`
            : "Ningún operador tiene casos sin barrer en este corte."}
        />
      </section>
    );
  }

  const elegido = modelo.operadores.find((op) => op.nombre === foco) ?? modelo.operadores[0] ?? null;
  const segmento = rotuloDelSegmento(nombreDelSegmento(modelo.casos.map((caso) => caso.variableCuota), "Cuota"));
  const { totales } = modelo;
  const referencia = fraseDeReferencia(modelo.referencias);
  const { aviso, grave } = UMBRALES_NO_BARRIDO;

  return (
    <div className="mon-nb" data-qa-geometry-group="telefonico-control-no-barridos" data-qa-geometry-contract="intrinsic">
      <div className="mon-nb-principal">
        <section className="mon-ctl-panel mon-nb-resumen" aria-label="Casos sin barrer">
          {rotulo}
          <div className="mon-nb-cifras">
            <Cifra rotulo="Sin barrer" valor={totales.casos} nota={`De ${n(modelo.operadores.length)} ${modelo.operadores.length === 1 ? "operador" : "operadores"}`} />
            <Cifra rotulo="Graves" valor={totales.graves} nota={`${n(grave)} días o más`} severidad="grave" />
            <Cifra rotulo="En aviso" valor={totales.avisos} nota={`${n(aviso)} a ${n(grave - 1)} días`} severidad="aviso" />
            <Cifra rotulo="Sin asignar" valor={modelo.sinAsignar} nota="No son atraso de nadie" />
          </div>
        </section>

        <section className="mon-ctl-panel mon-nb-operadores" aria-label="Operadores con casos sin barrer" data-qa-geometry-capacity="owned">
          <header className="mon-ctl-panel-cabecera mon-nb-operadores-cabecera">
            <b>Por operador</b>
            <span title="La hoja guarda la fecha del último intento: un caso sin barrer no tiene fecha propia.">
              {referencia}{modelo.corte ? `, al ${modelo.corte}` : ""}
            </span>
            <button
              type="button"
              className="mon-nb-boton"
              disabled={!totales.atrasados}
              onClick={() => { void copiarTexto(mensajeParaElEquipo(modelo.operadores, modelo.corte), "Mensajes copiados: pégalos en el chat del equipo.").then(setCopia); }}
            >
              <Clipboard size={14} aria-hidden="true" /> Copiar para el equipo
            </button>
          </header>
          {copia ? <NotaDelModo estado tono={copia.tono} className="mon-nb-copia">{copia.texto}</NotaDelModo> : null}
          <div className="mon-ctl-tabla-marco">
            <table className="mon-ctl-tabla mon-nb-tabla">
              <thead>
                <tr>
                  <th scope="col">Operador</th>
                  <th scope="col" className="is-num">Sin barrer</th>
                  <th scope="col" className="is-num">Graves</th>
                  <th scope="col" className="is-num">En aviso</th>
                  <th scope="col" className="is-num">Más antiguo</th>
                  <th scope="col" className="is-num">Última llamada</th>
                  <th scope="col">Estado</th>
                </tr>
              </thead>
              <tbody>
                {modelo.operadores.map((op) => {
                  const activo = op.nombre === elegido?.nombre;
                  return (
                    <tr key={op.nombre} className={`is-${op.severidad}${activo ? " is-activo" : ""}`} aria-current={activo ? "true" : undefined}>
                      <th scope="row"><button type="button" onClick={() => escribirFoco(op.nombre)}>{op.nombre}</button></th>
                      <td className="is-num">{n(op.casos.length)}</td>
                      <td className="is-num">{n(op.graves)}</td>
                      <td className="is-num">{n(op.avisos)}</td>
                      <td className="is-num">{diasLegibles(op.maxDias)}</td>
                      <td className="is-num">{fechaCorta(op.ultimaLlamada)}</td>
                      <td><ChipDeSeveridad severidad={op.severidad} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
      <FichaDelOperador key={elegido?.nombre ?? ""} operador={elegido} corte={modelo.corte} segmento={segmento} />
    </div>
  );
}
