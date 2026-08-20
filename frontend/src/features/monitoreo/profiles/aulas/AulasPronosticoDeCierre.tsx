import { useMemo } from "react";

import type { MonitoreoRow } from "../../../../api/monitoreo";
import { COLOR_RESULTADO } from "../../coloresDeResultado";
import { escalaDeEje } from "./AulasSerieDeRendimiento";
import { pronosticoDeCierre, sumarDiasDeCampo } from "./pronosticoDeCierre";

/**
 * En qué semana se termina de aplicar el plan, al ritmo que se lleva.
 *
 * Lo observado va en línea sólida y lo proyectado en **punteado gris**, con una
 * banda entre el ritmo más lento y el más rápido ya vistos. Nunca un punto: una
 * fecha sola se lee como una promesa.
 */

const fmt = (n: number) => n.toLocaleString("es-PE");

function dm(iso: string): string {
  const [, m, d] = iso.split("-");
  return d && m ? `${d}/${m}` : iso;
}

const MOTIVOS: Record<string, string> = {
  "sin-dias": "Ningún parte de campo trae fecha, así que no hay ritmo que proyectar.",
  "pocos-dias": "Hacen falta al menos tres días de campo para proyectar: con dos, la fecha de cierre sería un accidente.",
  "ya-cerrado": "Todas las aulas del plan tienen parte de campo.",
  "sin-ritmo": "El ritmo observado es cero, así que no hay nada que proyectar.",
};

export function AulasPronosticoDeCierre({ partes, plan }: {
  partes: ReadonlyArray<MonitoreoRow>;
  plan: ReadonlyArray<MonitoreoRow>;
}) {
  const p = useMemo(() => pronosticoDeCierre(partes, plan), [partes, plan]);

  if (p.motivo) {
    return (
      <div className="aulas-pronostico" data-qa-geometry-capacity="owned" data-qa-geometry-member>
        <p className="aulas-pronostico-lectura">
          <strong>{fmt(p.aplicadas)}</strong> de <strong>{fmt(p.universo)}</strong> aulas del plan
          tienen parte de campo.
        </p>
        {/* Por qué NO se proyecta, en vez de una línea plana que parecería una
            predicción de que no pasará nada. */}
        <p className="mon-profile-muted">{MOTIVOS[p.motivo] ?? ""}</p>
      </div>
    );
  }

  const fin = sumarDiasDeCampo(p.ultimaFecha, p.diasQueFaltan ?? 0);
  const pronto = sumarDiasDeCampo(p.ultimaFecha, p.diasRapido ?? 0);
  const tarde = sumarDiasDeCampo(p.ultimaFecha, p.diasLento ?? 0);
  const sinVariacion = p.ritmoLento === p.ritmoRapido;

  // El eje X son días de campo, no fechas del calendario: lo que se proyecta es
  // trabajo, y el domingo no produce. **Sólo el domingo**: el sábado sí es día de
  // campo, y darlo por perdido alargaba el cierre unos cuatro días al mes.
  const totalX = p.serie.length + (p.diasLento ?? 0);
  // Un margen interior de verdad. Antes el area util era 0-100 en los dos ejes,
  // asi que la primera y la ultima marca quedaban partidas por el borde y la
  // linea nacia y moria pegada al canto del panel.
  const MARGEN = 4;
  const util = 100 - MARGEN * 2;
  const x = (i: number) => (totalX > 1 ? MARGEN + (util * i) / (totalX - 1) : MARGEN);
  const y = (v: number) => MARGEN + util - (util * v) / Math.max(p.universo, 1);
  // Las tres referencias del eje vertical. Sin ellas no se podia leer ni un
  // valor: habia una sola linea, la de la meta, y ninguna escala.
  // **El eje en saltos redondos, no en mitades.**
  //
  // Era `[0, universo/2, universo]`, o sea 0 · 98 · 196: dos de las tres marcas
  // son numeros que nadie usa para medir. Gonzalo ya lo pidio para el otro
  // grafico —«los ticks del eje y pueden tener saltos mas logicos como cada 20 o
  // cada 10»— y aqui seguia sin aplicarse. `escalaDeEje` es la misma funcion que
  // decide la escala de la serie de rendimiento: se reusa en vez de tener dos
  // criterios de eje en el mismo perfil.
  //
  // El tope de la escala puede quedar por encima del universo —196 sube a 200—,
  // que es justo lo que hace que las marcas sean redondas; la linea del universo
  // se sigue dibujando en su sitio.
  // `escalaDeEje` ya devuelve los escalones de arriba abajo; aquí se quieren de
  // abajo arriba, que es el orden en que se posicionan.
  const marcas = [...escalaDeEje(p.universo).escalones].reverse();

  const observado = p.serie.map((d, i) => `${x(i)},${y(d.acumulado)}`).join(" ");
  const desde = p.serie.length - 1;
  const central = `${x(desde)},${y(p.aplicadas)} ${x(desde + (p.diasQueFaltan ?? 0))},${y(p.universo)}`;
  const rapido = `${x(desde)},${y(p.aplicadas)} ${x(desde + (p.diasRapido ?? 0))},${y(p.universo)}`;
  const lento = `${x(desde)},${y(p.aplicadas)} ${x(desde + (p.diasLento ?? 0))},${y(p.universo)}`;

  return (
    // C1: el gráfico es el contenedor visible de datos y el dueño del espacio
    // interior. Sin declararlo, el gate cae a la cabecera y reporta sus 5 px de
    // holgura como `capacity-drift` — el mismo diagnóstico sobre el sitio
    // equivocado que salió en cinco paneles del perfil.
    <div className="aulas-pronostico" data-qa-geometry-capacity="owned" data-qa-geometry-member>
      <p className="aulas-pronostico-lectura">
        <strong>{fmt(p.aplicadas)}</strong> de <strong>{fmt(p.universo)}</strong> aulas aplicadas ·
        faltan <strong>{fmt(p.faltan)}</strong> · al ritmo de estos{" "}
        {fmt(p.diasConCampo)} días cierra hacia el <strong>{dm(fin)}</strong>
      </p>
      <div className="aulas-pronostico-plot">
        <ul className="aulas-pronostico-y" aria-hidden="true">
          {[...marcas].reverse().map((m) => <li key={m}>{fmt(m)}</li>)}
        </ul>
      <div className="aulas-pronostico-lienzo">
      <svg className="aulas-pronostico-grafico" viewBox="0 0 100 100" preserveAspectRatio="none"
        role="img" aria-label={`${p.aplicadas} de ${p.universo} aulas; cierre estimado entre ${dm(pronto)} y ${dm(tarde)}`}>
        {/* La rejilla. Va primero para quedar detras de todo. */}
        {marcas.map((m) => (
          <line key={m} x1={MARGEN} y1={y(m)} x2={100 - MARGEN} y2={y(m)}
            stroke="var(--pulso-border)" strokeWidth="1"
            vectorEffect="non-scaling-stroke" opacity={m === p.universo ? 1 : 0.55} />
        ))}
        {/* Donde termina lo observado y empieza lo proyectado. Era una etiqueta
            suelta debajo del grafico, sin nada en el dibujo que la sujetara. */}
        <line x1={x(desde)} y1={MARGEN} x2={x(desde)} y2={MARGEN + util}
          stroke="var(--pulso-border)" strokeWidth="1" strokeDasharray="3 3"
          vectorEffect="non-scaling-stroke" opacity="0.8" />
        {/* La banda entre el ritmo más rápido y el más lento ya vistos. Va
            DEBAJO de las líneas para que no las tape. */}
        <polygon points={`${rapido} ${x(desde + (p.diasLento ?? 0))},${y(p.universo)}`}
          fill={COLOR_RESULTADO.pendiente} opacity="0.16" />
        {/* Lo proyectado: punteado y gris, como pidió Gonzalo. Nunca del color
            de lo conseguido, que es lo que lo haría pasar por observado. */}
        {/* `non-scaling-stroke` en TODOS los trazos. El viewBox es cuadrado y la
            caja mide 1 290 x 200: sin esto el navegador estira el grosor diez
            veces mas a lo ancho que a lo alto, y la misma linea se ve gruesa en
            los tramos horizontales y de pelo en los verticales. Es lo que hacia
            que el trazo verde se viera mal dibujado. */}
        <polyline points={lento} fill="none" stroke={COLOR_RESULTADO.pendiente}
          strokeWidth="1.2" strokeDasharray="3 3" opacity="0.75" vectorEffect="non-scaling-stroke" />
        <polyline points={rapido} fill="none" stroke={COLOR_RESULTADO.pendiente}
          strokeWidth="1.2" strokeDasharray="3 3" opacity="0.75" vectorEffect="non-scaling-stroke" />
        <polyline points={central} fill="none" stroke={COLOR_RESULTADO.pendiente}
          strokeWidth="2" strokeDasharray="5 3" vectorEffect="non-scaling-stroke" />
        {/* Lo observado: sólido y en el verde de lo conseguido. */}
        <polyline points={observado} fill="none" stroke={COLOR_RESULTADO.efectiva}
          strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
        {/* El punto donde se está hoy, en HTML y no como `<circle>`.
            `vector-effect` arregla el GROSOR del trazo, no la geometría: en un
            viewBox cuadrado estirado a 1 262 x 200 un círculo se dibuja como una
            elipse de cincuenta píxeles de ancho. Posicionado por porcentaje sale
            redondo y además puede llevar su propio título. */}
        {/* El porcentaje es del LIENZO, no del `plot`: el `plot` incluye la
            columna del eje vertical, así que un 79 % suyo cae a la derecha del
            79 % del dibujo. */}
        <span className="aulas-pronostico-hoy"
          style={{ left: `${x(desde)}%`, top: `${y(p.aplicadas)}%` }}
          title={`${fmt(p.aplicadas)} de ${fmt(p.universo)} aulas al ${dm(p.ultimaFecha)}`} />
      </div>
      </div>
      <p className="aulas-pronostico-eje">
        <span>{dm(p.serie[0].fecha)}</span>
        {/* «último con campo», no «hoy»: es la fecha del último parte, que
            sobre este corte es el 21/08 mientras el corte es del 18. Llamarlo
            «hoy» convierte un dato en una afirmación falsa sobre el calendario. */}
        <span>último con campo · {dm(p.ultimaFecha)}</span>
        <span>{sinVariacion ? dm(fin) : dm(tarde)}</span>
      </p>
      {/* Los SUPUESTOS, que es lo que separa una proyección de una promesa.
          Cuando todos los días rindieron lo mismo, la banda colapsa: decir
          «entre 17 y 17» y «entre el 25/08 y el 25/08» se lee como un error de
          la pantalla, así que ese caso se enuncia como lo que es —un ritmo sin
          variación— y se dice que por eso no hay banda. */}
      {/* «Entre el 24/08 y el 25/08.» era una frase sin sujeto: no decía de qué
          era el rango, y repetía la fecha que el titular ya había dado cuatro
          líneas más arriba. Ahora cada extremo dice de qué día sale, que es lo
          único que el titular no puede decir.

          **Y el comentario vive AQUÍ, fuera del párrafo.** Puesto entre dos
          líneas de texto JSX se come el salto que las separa y salen pegadas:
          primero «según eldía» y, al moverlo una línea, «15 aulaspor día». Un
          comentario no debería cambiar lo que se lee, y en JSX sí lo hace. */}
      <p className="mon-profile-muted aulas-pronostico-pie">
        {sinVariacion ? (
          <>
            Proyectado al ritmo observado de <strong>{fmt(p.ritmoLento ?? 0)}</strong> aulas por día
            de campo, igual todos los días, contando todos los días menos el domingo. Sin
            variación entre días no
            hay banda que dibujar: la fecha es <strong>{dm(fin)}</strong> mientras el ritmo se
            sostenga.
          </>
        ) : (
          <>
            Proyectado al ritmo observado de <strong>{p.ritmo?.toLocaleString("es-PE")}</strong> aulas
            por día de campo (entre {fmt(p.ritmoLento ?? 0)} y {fmt(p.ritmoRapido ?? 0)} según el
            día), contando todos los días menos el domingo. Con un día flojo
            cerraría el <strong>{dm(tarde)}</strong>; con uno bueno,
            el <strong>{dm(pronto)}</strong>.
          </>
        )}{" "}
        No descuenta las aulas que aún no tienen fecha ni supone que el ritmo mejore.
      </p>
    </div>
  );
}
