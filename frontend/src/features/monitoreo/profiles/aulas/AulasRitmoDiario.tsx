import { COLOR_RESULTADO } from "../../coloresDeResultado";

/**
 * Cómo avanzó la recolección, día por día.
 *
 * Es el eje que le faltaba al perfil. Acreditación y telefónico llevan su ritmo
 * diario desde hace tiempo; aulas decía cuánto se lleva y cuánto falta, y en
 * ninguna pantalla se veía **cómo se llegó ahí**. Un tablero de monitoreo sin
 * tiempo no contesta la pregunta con la que se abre cada mañana —¿vamos al
 * ritmo que hace falta?— y es la razón de fondo de que Avance se leyera crudo
 * aun teniendo gráficos.
 *
 * Barras en CSS y no Plotly: son los días de un operativo —diez en este
 * estudio— y esta pestaña ya carga bastante. Es la misma decisión que la agenda
 * por día y que el histórico del cálculo de muestra.
 */

export type DiaDeRitmo = { fecha: string; validas: number; acumulado: number };

export type RitmoDiario = {
  dias: DiaDeRitmo[];
  dias_con_campo: number;
  mejor_dia?: { fecha: string; validas: number } | null;
  media_diaria: number;
  meta: number;
};

const fmt = (n: number) => n.toLocaleString("es-PE");

/** «Lun 10/08», que es como se nombra un día de campo en el resto del perfil. */
function etiquetaDeDia(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  const dia = d.toLocaleDateString("es-PE", { weekday: "short" });
  return `${dia.charAt(0).toUpperCase()}${dia.slice(1, 3)} ${d.toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit" })}`;
}

export function AulasRitmoDiario({ ritmo }: { ritmo: RitmoDiario | null }) {
  if (!ritmo || !ritmo.dias.length) {
    return (
      // El vacío dice de dónde saldría el dato: sin marca de envío no hay
      // calendario, y eso es una propiedad de la fuente, no un fallo de la
      // vista. Inventar un solo día con todo dentro sería peor que no dibujar.
      <p className="mon-profile-muted">
        Las respuestas de este estudio no traen fecha de envío, así que no se
        puede reconstruir el día a día de la recolección.
      </p>
    );
  }

  const { dias, dias_con_campo: conCampo, mejor_dia: mejor, media_diaria: media, meta } = ritmo;
  const tope = dias.reduce((max, d) => Math.max(max, d.validas), 0);
  const total = dias[dias.length - 1]?.acumulado ?? 0;
  const falta = Math.max(0, meta - total);
  // Cuántos días más al ritmo medio. Es una división, no un pronóstico, y por
  // eso se dice «al ritmo de» y no «terminará el».
  const diasAlRitmo = media > 0 && falta > 0 ? Math.ceil(falta / media) : 0;

  return (
    <div className="aulas-ritmo">
      <p className="aulas-cadenas-lectura">
        <strong>{fmt(total)}</strong> respuestas en <strong>{fmt(conCampo)}</strong>{" "}
        {conCampo === 1 ? "día de campo" : "días de campo"}
        {media > 0 ? <> · {fmt(media)} al día</> : null}
        {mejor ? <> · el mejor, {etiquetaDeDia(mejor.fecha)} con <strong>{fmt(mejor.validas)}</strong></> : null}
      </p>
      <ol className="aulas-ritmo-dias">
        {dias.map((d) => (
          <li key={d.fecha} className={d.validas ? "" : "es-sin-campo"}>
            <span className="aulas-ritmo-fecha">{etiquetaDeDia(d.fecha)}</span>
            <span className="aulas-ritmo-barra">
              <i
                style={{
                  width: `${tope ? Math.max(d.validas ? 2 : 0, (100 * d.validas) / tope) : 0}%`,
                  background: COLOR_RESULTADO.efectiva,
                }}
              />
            </span>
            {/* Las dos cifras del día: lo suyo y el acumulado. Sin el acumulado
                hay que sumar diez barras de cabeza para saber por dónde va el
                estudio, que es lo que se viene a mirar. */}
            <span className="aulas-ritmo-cifra"><strong>{fmt(d.validas)}</strong></span>
            <span className="aulas-ritmo-acumulado">{fmt(d.acumulado)}</span>
          </li>
        ))}
      </ol>
      {falta > 0 ? (
        <p className="mon-profile-table-recorte">
          Faltan <strong>{fmt(falta)}</strong> para la meta de {fmt(meta)}
          {diasAlRitmo
            ? ` · ${diasAlRitmo} ${diasAlRitmo === 1 ? "día más" : "días más"} al ritmo de estos ${fmt(conCampo)}`
            : ""}
        </p>
      ) : null}
    </div>
  );
}
