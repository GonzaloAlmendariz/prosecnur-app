import { useMemo } from "react";

import type { MonitoreoRow } from "../../../../api/monitoreo";
import { COLOR_RESULTADO } from "../../coloresDeResultado";
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
      <div className="aulas-pronostico">
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
  // trabajo, y el fin de semana no produce.
  const totalX = p.serie.length + (p.diasLento ?? 0);
  const x = (i: number) => (totalX > 1 ? (100 * i) / (totalX - 1) : 0);
  const y = (v: number) => 100 - (100 * v) / Math.max(p.universo, 1);

  const observado = p.serie.map((d, i) => `${x(i)},${y(d.acumulado)}`).join(" ");
  const desde = p.serie.length - 1;
  const central = `${x(desde)},${y(p.aplicadas)} ${x(desde + (p.diasQueFaltan ?? 0))},${y(p.universo)}`;
  const rapido = `${x(desde)},${y(p.aplicadas)} ${x(desde + (p.diasRapido ?? 0))},${y(p.universo)}`;
  const lento = `${x(desde)},${y(p.aplicadas)} ${x(desde + (p.diasLento ?? 0))},${y(p.universo)}`;

  return (
    <div className="aulas-pronostico">
      <p className="aulas-pronostico-lectura">
        <strong>{fmt(p.aplicadas)}</strong> de <strong>{fmt(p.universo)}</strong> aulas aplicadas ·
        faltan <strong>{fmt(p.faltan)}</strong> · al ritmo de estos{" "}
        {fmt(p.diasConCampo)} días cierra hacia el <strong>{dm(fin)}</strong>
      </p>
      <svg className="aulas-pronostico-grafico" viewBox="0 0 100 100" preserveAspectRatio="none"
        role="img" aria-label={`${p.aplicadas} de ${p.universo} aulas; cierre estimado entre ${dm(pronto)} y ${dm(tarde)}`}>
        {/* La banda entre el ritmo más rápido y el más lento ya vistos. Va
            DEBAJO de las líneas para que no las tape. */}
        <polygon points={`${rapido} ${x(desde + (p.diasLento ?? 0))},${y(p.universo)}`}
          fill={COLOR_RESULTADO.pendiente} opacity="0.16" />
        <line x1="0" y1={y(p.universo)} x2="100" y2={y(p.universo)}
          stroke="var(--pulso-border-soft)" strokeWidth="0.6" />
        {/* Lo proyectado: punteado y gris, como pidió Gonzalo. Nunca del color
            de lo conseguido, que es lo que lo haría pasar por observado. */}
        <polyline points={lento} fill="none" stroke={COLOR_RESULTADO.pendiente}
          strokeWidth="0.8" strokeDasharray="2 2" opacity="0.75" />
        <polyline points={rapido} fill="none" stroke={COLOR_RESULTADO.pendiente}
          strokeWidth="0.8" strokeDasharray="2 2" opacity="0.75" />
        <polyline points={central} fill="none" stroke={COLOR_RESULTADO.pendiente}
          strokeWidth="1.4" strokeDasharray="3 2" />
        {/* Lo observado: sólido y en el verde de lo conseguido. */}
        <polyline points={observado} fill="none" stroke={COLOR_RESULTADO.efectiva} strokeWidth="1.8" />
      </svg>
      <p className="aulas-pronostico-eje">
        <span>{dm(p.serie[0].fecha)}</span>
        <span>hoy · {dm(p.ultimaFecha)}</span>
        <span>{sinVariacion ? dm(fin) : dm(tarde)}</span>
      </p>
      {/* Los SUPUESTOS, que es lo que separa una proyección de una promesa.
          Cuando todos los días rindieron lo mismo, la banda colapsa: decir
          «entre 17 y 17» y «entre el 25/08 y el 25/08» se lee como un error de
          la pantalla, así que ese caso se enuncia como lo que es —un ritmo sin
          variación— y se dice que por eso no hay banda. */}
      <p className="mon-profile-muted aulas-pronostico-pie">
        {sinVariacion ? (
          <>
            Proyectado al ritmo observado de <strong>{fmt(p.ritmoLento ?? 0)}</strong> aulas por día
            de campo, igual todos los días, contando sólo días hábiles. Sin variación entre días no
            hay banda que dibujar: la fecha es <strong>{dm(fin)}</strong> mientras el ritmo se
            sostenga.
          </>
        ) : (
          <>
            Proyectado al ritmo observado de <strong>{p.ritmo?.toLocaleString("es-PE")}</strong> aulas
            por día de campo (entre {fmt(p.ritmoLento ?? 0)} y {fmt(p.ritmoRapido ?? 0)} según el
            día), contando sólo días hábiles. Entre el <strong>{dm(pronto)}</strong> y el{" "}
            <strong>{dm(tarde)}</strong>.
          </>
        )}{" "}
        No descuenta las aulas que aún no tienen fecha ni supone que el ritmo mejore.
      </p>
    </div>
  );
}
