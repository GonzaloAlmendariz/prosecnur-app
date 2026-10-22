import type { MonitoreoMailchimpPublico, MonitoreoMailchimpUmbrales } from "../../../../api/monitoreoMailchimp";
import { EstadoVacio } from "../../../../components/EstadoVacio";
import { Users } from "../../../../vendor/lucide-react";
import { cifra, porcentaje, RITMO, textoUmbrales } from "./avanceCorreoModelo";

// Avance › Correo › Por público: la pieza principal. Una fila por actor con su
// base alcanzable (universo menos inválidos), la respuesta sobre esa base y
// sobre el universo, y el ritmo sugerido para los recordatorios.

export function AvanceCorreoPublicos({
  publicos,
  umbrales,
}: {
  publicos: MonitoreoMailchimpPublico[];
  umbrales: MonitoreoMailchimpUmbrales;
}) {
  const lineaUmbrales = textoUmbrales(umbrales);
  return (
    <section className="mon-correo-bloque" aria-labelledby="mon-correo-publicos-titulo">
      <header className="mon-correo-bloque-cabeza">
        <h3 id="mon-correo-publicos-titulo">Por público</h3>
        <p>La respuesta se mide sobre la base alcanzable: el universo sin los correos inválidos.</p>
      </header>
      {publicos.length ? (
        <div className="mon-correo-tabla-marco">
          <table className="mon-correo-tabla">
            <thead>
              <tr>
                <th scope="col">Público</th>
                <th scope="col" className="is-num">Universo</th>
                <th scope="col" className="is-num">Correos inválidos</th>
                <th scope="col" className="is-num">Base alcanzable</th>
                <th scope="col" className="is-num">Efectivas</th>
                <th scope="col" className="is-num">Respuesta sobre la base alcanzable</th>
                <th scope="col" className="is-num">Respuesta sobre el universo</th>
                <th scope="col" className="is-num">Bajas</th>
                <th scope="col" className="is-num">Quejas</th>
                <th scope="col">Ritmo de recordatorios</th>
              </tr>
            </thead>
            <tbody>
              {publicos.map((p) => {
                const ritmo = RITMO[p.ritmo];
                return (
                  <tr key={p.actor}>
                    <th scope="row">{p.actor}</th>
                    <td className="is-num">{cifra(p.universo)}</td>
                    <td className="is-num">{cifra(p.invalidos)}</td>
                    <td className="is-num">{cifra(p.alcanzable)}</td>
                    <td className="is-num">{cifra(p.efectivas)}</td>
                    <td className="is-num">
                      <strong>{porcentaje(p.tasa_alcanzable)}</strong>
                      <small>{cifra(p.efectivas)} de {cifra(p.alcanzable)}</small>
                    </td>
                    <td className="is-num">
                      <span>{porcentaje(p.tasa_universo)}</span>
                      <small>{cifra(p.efectivas)} de {cifra(p.universo)}</small>
                    </td>
                    <td className="is-num">{cifra(p.bajas)}</td>
                    <td className="is-num">{cifra(p.quejas)}</td>
                    <td className="mon-correo-ritmo-celda">
                      <span className={`mon-correo-ritmo is-${ritmo.tono}`}>{ritmo.etiqueta}</span>
                      {p.ritmo_motivo ? <small>{p.ritmo_motivo}</small> : null}
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
      {lineaUmbrales ? <p className="mon-correo-nota">{lineaUmbrales}</p> : null}
    </section>
  );
}
