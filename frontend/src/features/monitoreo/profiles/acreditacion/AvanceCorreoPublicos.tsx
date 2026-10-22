import { useId, useMemo, useState } from "react";

import type {
  MonitoreoMailchimpEnvio,
  MonitoreoMailchimpPublico,
  MonitoreoMailchimpUmbrales,
} from "../../../../api/monitoreoMailchimp";
import { EstadoVacio } from "../../../../components/EstadoVacio";
import { ArrowDown, ArrowUp, Users } from "../../../../vendor/lucide-react";
import { AvanceCorreoRitmo } from "./AvanceCorreoRitmo";
import { AvanceCorreoSerie } from "./AvanceCorreoSerie";
import { serieDeRespuestas } from "./avanceCorreoEmbudoModelo";
import {
  barraDeRespuesta,
  type NivelUmbral,
  nivelBaja,
  nivelQueja,
  type OrdenMatriz,
  ordenarPublicos,
  todosSinEnvios,
} from "./avanceCorreoMatriz";
import { cifra, piezasDeUmbrales, porcentaje } from "./avanceCorreoModelo";
import { clasePublico, type PaletaDePublicos } from "./paletaPublicos";

// Avance › Correo › Públicos: una fila por público con su respuesta sobre la
// base alcanzable (barra) y sobre el universo (marca), la composición de su
// base, la serie de respuestas por envío y la salida del último envío. El ritmo
// se dice una sola vez si ningún público recibió envíos.

function CifraSalida({
  rotulo,
  n,
  base,
  tasa,
  nivel,
}: {
  rotulo: string;
  n: number | null;
  base: number | null;
  tasa: number | null;
  nivel: NivelUmbral;
}) {
  return (
    <span className={`mon-correo-salida is-${nivel}`}>
      <span>{rotulo}</span>
      <strong>{porcentaje(tasa)}</strong>
      <small>{cifra(n)} de {cifra(base)}</small>
    </span>
  );
}

function CabezaOrdenable({
  valor,
  actual,
  onOrden,
  children,
  className,
}: {
  valor: OrdenMatriz;
  actual: OrdenMatriz;
  onOrden: (o: OrdenMatriz) => void;
  children: string;
  className?: string;
}) {
  const activo = actual === valor;
  const asc = valor === "nombre";
  return (
    <th scope="col" className={className} aria-sort={activo ? (asc ? "ascending" : "descending") : "none"}>
      <button type="button" className={`mon-correo-orden${activo ? " is-activo" : ""}`} onClick={() => onOrden(valor)}>
        {children}
        {activo ? (asc ? <ArrowUp size={12} aria-hidden /> : <ArrowDown size={12} aria-hidden />) : null}
      </button>
    </th>
  );
}

export function AvanceCorreoPublicos({
  publicos,
  envios,
  umbrales,
  paleta,
  publico,
  onPublico,
}: {
  publicos: MonitoreoMailchimpPublico[];
  envios: MonitoreoMailchimpEnvio[];
  umbrales: MonitoreoMailchimpUmbrales;
  paleta: PaletaDePublicos;
  publico: string;
  onPublico: (publico: string) => void;
}) {
  const ids = useId();
  const [orden, setOrden] = useState<OrdenMatriz>("tasa");
  const filas = useMemo(() => ordenarPublicos(publicos, orden), [publicos, orden]);
  const series = useMemo(
    () => new Map(publicos.map((p) => [p.actor, serieDeRespuestas(envios, p.actor)])),
    [publicos, envios],
  );
  const colapsado = todosSinEnvios(publicos);
  const umbralesLeyenda = piezasDeUmbrales(umbrales);
  const totalUniverso = publicos.reduce((n, p) => n + (p.universo ?? 0), 0);
  const totalEfectivas = publicos.reduce((n, p) => n + (p.efectivas ?? 0), 0);

  return (
    <section className="mon-correo-bloque" aria-labelledby={`${ids}-t`}>
      <header className="mon-correo-bloque-cabeza">
        <div>
          <h3 id={`${ids}-t`}>Públicos</h3>
          <p className="mon-correo-bloque-meta">
            {cifra(publicos.length)} {publicos.length === 1 ? "público" : "públicos"} · {cifra(totalEfectivas)} efectivas de {cifra(totalUniverso)} en el universo
          </p>
        </div>
        {umbralesLeyenda.length && !colapsado ? (
          <ul className="mon-correo-umbrales" aria-label="Umbrales propuestos sobre el último envío">
            <li className="mon-correo-versalita">Umbrales propuestos</li>
            {umbralesLeyenda.map((u) => (
              <li key={u.clave} className={`is-${u.tono}`}>
                <i aria-hidden />{u.texto} {u.tono === "danger" ? "detener" : "espaciar"}
              </li>
            ))}
          </ul>
        ) : null}
      </header>

      {colapsado ? (
        <p className="mon-correo-banda" role="status">
          <span className="mon-correo-ritmo is-neutral">Sin envíos</span>
          Ningún público ha recibido correos de esta audiencia.
        </p>
      ) : null}

      {filas.length ? (
        <div className="mon-correo-tabla-marco">
          <table className="mon-correo-tabla mon-correo-matriz">
            <thead>
              <tr>
                <CabezaOrdenable valor="nombre" actual={orden} onOrden={setOrden} className="es-publico">Público</CabezaOrdenable>
                <CabezaOrdenable valor="tasa" actual={orden} onOrden={setOrden} className="es-respuesta">Respuesta sobre la base alcanzable</CabezaOrdenable>
                <CabezaOrdenable valor="universo" actual={orden} onOrden={setOrden} className="is-num">Universo</CabezaOrdenable>
                <th scope="col" className="is-num">Inválidos</th>
                <th scope="col" className="is-num">Alcanzable</th>
                <th scope="col">Respuestas por envío</th>
                <th scope="col">Último envío</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((p) => {
                const barra = barraDeRespuesta(p);
                const elegido = publico === p.actor;
                const u = p.ultimo;
                return (
                  <tr key={p.actor} className={`${clasePublico(paleta, p.actor)}${elegido ? " is-elegida" : ""}`}>
                    <th scope="row" className="es-publico">
                      <span className="mon-correo-publico-cab">
                      <button
                        type="button"
                        className="mon-correo-publico-nombre"
                        aria-pressed={elegido}
                        onClick={() => onPublico(p.actor)}
                      >
                        <i className="mon-publico-punto" aria-hidden />
                        {p.actor}
                      </button>
                      {colapsado ? null : <AvanceCorreoRitmo ritmo={p.ritmo} motivo={p.ritmo_motivo} publico={p.actor} />}
                      </span>
                    </th>
                    <td className="es-respuesta">
                      <span className="mon-correo-respuesta">
                      <span
                        className="mon-correo-avance"
                        role="img"
                        aria-label={`${porcentaje(p.tasa_alcanzable)}, ${cifra(p.efectivas)} de ${cifra(p.alcanzable)} alcanzables; ${porcentaje(p.tasa_universo)} del universo`}
                      >
                        <i className="mon-correo-avance-relleno" style={{ inlineSize: `${barra.relleno}%` }} />
                        {barra.marca != null ? (
                          <i className="mon-correo-avance-marca" style={{ insetInlineStart: `${barra.marca}%` }} />
                        ) : null}
                      </span>
                      <span className="mon-correo-avance-cifras">
                        <strong>{porcentaje(p.tasa_alcanzable)}</strong>
                        <span>{cifra(p.efectivas)} de {cifra(p.alcanzable)}</span>
                        <small>{porcentaje(p.tasa_universo)} del universo</small>
                      </span>
                      </span>
                    </td>
                    <td className="is-num">{cifra(p.universo)}</td>
                    <td className={`is-num${p.invalidos ? " es-invalidos" : " mon-correo-tenue"}`}>{cifra(p.invalidos)}</td>
                    <td className="is-num es-fuerte">{cifra(p.alcanzable)}</td>
                    <td><AvanceCorreoSerie puntos={series.get(p.actor) ?? []} publico={p.actor} /></td>
                    <td>
                      {u ? (
                        <span className="mon-correo-salidas">
                          <CifraSalida rotulo="Bajas" n={u.bajas} base={u.entregados} tasa={u.tasa_baja} nivel={nivelBaja(u.tasa_baja, umbrales)} />
                          <CifraSalida rotulo="Quejas" n={u.quejas} base={u.entregados} tasa={u.tasa_queja} nivel={nivelQueja(u.tasa_queja, umbrales)} />
                        </span>
                      ) : (
                        <span className="mon-correo-tenue">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EstadoVacio
          icono={<Users size={16} />}
          titulo="Todavía no hay públicos que mostrar"
          descripcion="Los públicos salen del universo de Monitoreo; sincroniza las fuentes para calcularlos."
        />
      )}
    </section>
  );
}
