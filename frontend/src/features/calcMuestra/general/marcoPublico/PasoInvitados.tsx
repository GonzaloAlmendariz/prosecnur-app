import { useEffect, useMemo, useState } from "react";
import { Filter } from "lucide-react";

import { apiMarcoPublicoInvitados, type EmbudoDeInvitados } from "../../../../api/calcMuestraMarcoPublico";
import { Alert } from "../../../../components/Alert";
import { ChipSeleccion } from "../../../../components/ChipSeleccion";
import { PanelDeMesa } from "../../../../components/procesamiento/PanelDeMesa";
import { PulsoSwitch } from "../../../../components/PulsoSwitch";
import { columnasConUso, reglasDe, usoDe, type EstadoMarco } from "./modeloMarco";
import { cifra, errorLegible, Pastilla } from "./piezas";

/** El embudo de quién se invita, leído del motor cada vez que cambia una regla. */
export function useEmbudo(estado: EstadoMarco): { embudo: EmbudoDeInvitados | null; leyendo: boolean; error: string | null } {
  const reglas = useMemo(() => reglasDe(estado), [estado]);
  const correo = columnasConUso(estado, "correo")[0] ?? "";
  const clave = JSON.stringify([estado.fileId, estado.hoja, correo, reglas]);
  const [res, setRes] = useState<{ clave: string; embudo: EmbudoDeInvitados | null; error: string | null }>({ clave: "", embudo: null, error: null });
  useEffect(() => {
    if (!estado.fileId || !estado.lectura) return undefined;
    let vivo = true;
    apiMarcoPublicoInvitados({ fileId: estado.fileId, hoja: estado.hoja, columnaCorreo: correo, reglas })
      .then((embudo) => { if (vivo) setRes({ clave, embudo, error: null }); })
      .catch((e: unknown) => { if (vivo) setRes((r) => ({ clave, embudo: r.embudo, error: errorLegible(e) })); });
    return () => { vivo = false; };
    // La clave resume las dependencias que cambian el embudo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);
  if (!estado.fileId || !estado.lectura) return { embudo: null, leyendo: false, error: null };
  return { embudo: res.embudo, leyendo: res.clave !== clave, error: res.error };
}

/** Paso 3: las reglas que restan del marco y el embudo con la resta de cada una. */
export function PasoInvitados({ estado, embudo, leyendo, error, onCambio }: {
  estado: EstadoMarco;
  embudo: EmbudoDeInvitados | null;
  leyendo: boolean;
  error: string | null;
  onCambio: (e: EstadoMarco) => void;
}) {
  const reglas = (estado.lectura?.columnas ?? []).filter((c) => usoDe(c, estado.usos) === "regla");
  const hayCorreo = columnasConUso(estado, "correo").length > 0;
  const base = embudo?.base ?? estado.lectura?.filas ?? 0;

  function alternar(columna: string, valor: string) {
    const antes = estado.exclusiones[columna] ?? [];
    const valores = antes.includes(valor) ? antes.filter((v) => v !== valor) : [...antes, valor];
    onCambio({ ...estado, exclusiones: { ...estado.exclusiones, [columna]: valores } });
  }

  return (
    <PanelDeMesa zona="marco-invitados" titulo="Quién se invita" icono={<Filter size={15} aria-hidden="true" />} ocupado={leyendo}>
      <ul className="cmmp-embudo" aria-label="Embudo de invitados">
        <li>
          <b>Personas en la base</b><em>{cifra(base)}</em>
          <i><span style={{ width: "100%" }} /></i>
        </li>
        {(embudo?.pasos ?? []).map((p, k) => (
          <li key={`${p.tipo}-${p.columna}-${k}`}>
            <b>{p.tipo === "excluir_sin_correo" ? "Sin correo" : "Fuera por regla"}</b>
            <em data-resta>− {cifra(p.quitadas)}</em>
            <i><span style={{ width: `${base ? (p.quedan / base) * 100 : 0}%` }} /></i>
            {p.tipo === "excluir_valores" ? (
              <span className="cmmp-chips"><Pastilla>{p.columna}</Pastilla>{p.valores.map((v) => <Pastilla key={v}>{v || "(vacío)"}</Pastilla>)}</span>
            ) : null}
          </li>
        ))}
        <li data-final>
          <b>Se invitan</b><em>{cifra(embudo?.invitados ?? base)}</em>
          <i><span style={{ width: `${base ? ((embudo?.invitados ?? base) / base) * 100 : 0}%` }} /></i>
        </li>
      </ul>
      {error ? <div className="cmmp-pad"><Alert kind="error">{error}</Alert></div> : null}
      <section className="cmmp-sec" aria-label="Reglas">
        <h4>Reglas</h4>
        {reglas.length === 0 ? (
          <p className="cmmp-vacio-chico">Marca una columna "Para reglas" en Columnas para excluir valores.</p>
        ) : reglas.map((c) => (
          <fieldset key={c.nombre} className="cmmp-regla">
            <legend>Excluir de {c.nombre}</legend>
            {c.distribucion.length ? (
              <div className="cmmp-valores">
                {c.distribucion.map((v) => {
                  const fuera = (estado.exclusiones[c.nombre] ?? []).includes(v.valor);
                  return (
                    <ChipSeleccion
                      key={v.valor}
                      etiqueta={v.valor}
                      cifra={cifra(v.n)}
                      activo={fuera}
                      excluye
                      onAlternar={() => alternar(c.nombre, v.valor)}
                    />
                  );
                })}
              </div>
            ) : (
              <p className="cmmp-vacio-chico">Esta columna tiene demasiados valores distintos para elegirlos uno por uno.</p>
            )}
          </fieldset>
        ))}
        <PulsoSwitch
          size="sm"
          checked={estado.sinCorreo}
          disabled={!hayCorreo}
          onCheckedChange={(v) => onCambio({ ...estado, sinCorreo: v })}
          label="Excluir a quien no tiene correo"
          description={hayCorreo ? undefined : "Marca la columna de correo en Columnas."}
        />
      </section>
    </PanelDeMesa>
  );
}
