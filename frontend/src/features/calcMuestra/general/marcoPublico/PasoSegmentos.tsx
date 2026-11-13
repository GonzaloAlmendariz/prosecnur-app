import { useEffect, useMemo, useState } from "react";
import { Layers } from "lucide-react";

import { apiMarcoPublicoCruce, type CruceDelMarco } from "../../../../api/calcMuestraMarcoPublico";
import { Alert } from "../../../../components/Alert";
import { PanelDeMesa } from "../../../../components/procesamiento/PanelDeMesa";
import { PulsoInput } from "../../../../components/PulsoInput";
import { PulsoSelect } from "../../../../components/PulsoSelect";
import { PulsoTable, type PulsoTableColumna } from "../../../../components/PulsoTable";
import { fmtInt } from "../../sharedCore";
import {
  celdasSinGrupo,
  columnasConUso,
  grupoDeCelda,
  gruposIniciales,
  moverCelda,
  nombreDeSegmento,
  poblacionDeGrupo,
  reglasDe,
  renombrarGrupo,
  type EstadoMarco,
} from "./modeloMarco";
import { cifra, errorLegible, Pastilla } from "./piezas";

const SIN_CRUCE = "__sin_cruce__";
const SIN_SEGMENTO = "__sin_segmento__";
const GRUPO_NUEVO = "__grupo_nuevo__";
const SIN_GRUPO = "__sin_grupo__";
const TONOS = 8;

/** El cruce de quienes se invitan por las columnas del segmento. */
export function useCruce(estado: EstadoMarco): { cruce: CruceDelMarco | null; leyendo: boolean; error: string | null } {
  const reglas = useMemo(() => reglasDe(estado), [estado]);
  const correo = columnasConUso(estado, "correo")[0] ?? "";
  const { fila, columna } = estado.segmento;
  const clave = JSON.stringify([estado.fileId, estado.hoja, correo, reglas, fila, columna]);
  const [res, setRes] = useState<{ clave: string; cruce: CruceDelMarco | null; error: string | null }>({ clave: "", cruce: null, error: null });
  useEffect(() => {
    if (!estado.fileId || !fila) return undefined;
    let vivo = true;
    apiMarcoPublicoCruce({ fileId: estado.fileId, hoja: estado.hoja, columnaCorreo: correo, reglas, fila, columna })
      .then((r) => { if (vivo) setRes({ clave, cruce: r.cruce, error: null }); })
      .catch((e: unknown) => { if (vivo) setRes({ clave, cruce: null, error: errorLegible(e) }); });
    return () => { vivo = false; };
    // La clave resume las dependencias que cambian el cruce.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);
  if (!fila) return { cruce: null, leyendo: false, error: null };
  return { cruce: res.clave === clave ? res.cruce : null, leyendo: res.clave !== clave, error: res.clave === clave ? res.error : null };
}

type FilaDelCruce = { fila: string; i: number };

/** Paso 4: el segmento sale de una columna o del cruce de dos, y cada celda va a un grupo. */
export function PasoSegmentos({ estado, cruce, leyendo, error, onCambio }: {
  estado: EstadoMarco;
  cruce: CruceDelMarco | null;
  leyendo: boolean;
  error: string | null;
  onCambio: (e: EstadoMarco) => void;
}) {
  const cuotas = columnasConUso(estado, "cuota");
  const seg = estado.segmento;
  const grupos = seg.grupos;

  // Un cruce nuevo (otra columna) arranca con un grupo por fila; si los grupos ya cubren el cruce, se conservan.
  useEffect(() => {
    if (!cruce) return;
    const cubre = grupos.length > 0 && celdasSinGrupo(cruce, grupos).length === 0
      && grupos.every((g) => g.celdas.every((c) => cruce.filas.includes(c.fila) && cruce.columnas.includes(c.columna)));
    if (!cubre) onCambio({ ...estado, segmento: { ...seg, grupos: gruposIniciales(cruce) } });
    // Solo al llegar otro cruce.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cruce]);

  const tono = (nombre: string) => Math.max(0, grupos.findIndex((g) => g.nombre === nombre)) % TONOS;
  const columnaOpciones = [{ value: SIN_CRUCE, label: "Sin cruce" }, ...cuotas.filter((c) => c !== seg.fila).map((c) => ({ value: c, label: c }))];
  const libres = cruce ? celdasSinGrupo(cruce, grupos) : [];
  const maxGrupo = cruce ? Math.max(1, ...grupos.map((g) => poblacionDeGrupo(cruce, g))) : 1;

  const columnas: PulsoTableColumna<FilaDelCruce>[] = cruce ? [
    { id: "fila", encabezado: cruce.filaVariable, ancho: 220, celda: (f) => <strong>{f.fila}</strong> },
    ...cruce.columnas.map((c, j): PulsoTableColumna<FilaDelCruce> => ({
      id: `c-${j}`,
      encabezado: cruce.columnaVariable ? c : "Personas",
      ancho: 168,
      celda: (f) => {
        const n = cruce.conteos[f.i]?.[j] ?? 0;
        if (!n) return <span className="cmmp-suave">Sin personas</span>;
        const g = grupoDeCelda(grupos, f.fila, c);
        return (
          <span className="cmmp-celda-g" data-tono={g ? tono(g) : undefined} data-libre={g ? undefined : "true"}>
            <span className="cmmp-celda-n">{cifra(n)}</span>
            <PulsoSelect
              size="sm"
              value={g || SIN_GRUPO}
              ariaLabel={`Grupo de ${f.fila}${cruce.columnaVariable ? `, ${c}` : ""} (${cifra(n)} personas)`}
              options={[
                ...(g ? [] : [{ value: SIN_GRUPO, label: "Sin grupo", disabled: true }]),
                ...grupos.map((x) => ({ value: x.nombre, textValue: x.nombre, label: <span className="cmmp-opcion-grupo"><i data-tono={tono(x.nombre)} />{x.nombre}</span> })),
                { value: GRUPO_NUEVO, label: "Grupo nuevo" },
              ]}
              onValueChange={(v) => {
                if (v === SIN_GRUPO) return;
                const destino = v === GRUPO_NUEVO ? (cruce.columnaVariable ? `${f.fila}, ${c}` : f.fila) : v;
                onCambio({ ...estado, segmento: { ...seg, grupos: moverCelda(grupos, f.fila, c, destino) } });
              }}
            />
          </span>
        );
      },
    })),
    { id: "total", encabezado: "Total", ancho: 96, tipo: "cifra", celda: (f) => cifra(cruce.conteos[f.i]?.reduce((s, x) => s + x, 0) ?? 0) },
  ] : [];

  return (
    <PanelDeMesa zona="marco-segmentos" titulo="Segmentos de cruce" icono={<Layers size={15} aria-hidden="true" />} conteo={grupos.length || undefined} ocupado={leyendo}>
      <div className="cmmp-formula">
        <label className="cmmp-ctl">
          <small>Filas</small>
          <PulsoSelect
            size="sm"
            value={seg.fila || SIN_SEGMENTO}
            ariaLabel="Columna de las filas del segmento"
            options={[{ value: SIN_SEGMENTO, label: "Sin segmento" }, ...cuotas.map((c) => ({ value: c, label: c }))]}
            onValueChange={(v) => {
              const fila = v === SIN_SEGMENTO ? "" : v;
              onCambio({ ...estado, segmento: { ...seg, fila, columna: !fila || seg.columna === v ? "" : seg.columna, grupos: [] } });
            }}
          />
        </label>
        <b aria-hidden="true">×</b>
        <label className="cmmp-ctl">
          <small>Columnas</small>
          <PulsoSelect
            size="sm"
            value={seg.columna || SIN_CRUCE}
            ariaLabel="Columna del cruce"
            disabled={!seg.fila}
            options={columnaOpciones}
            onValueChange={(v) => onCambio({ ...estado, segmento: { ...seg, columna: v === SIN_CRUCE ? "" : v, grupos: [] } })}
          />
        </label>
        <b aria-hidden="true">=</b>
        <label className="cmmp-ctl cmmp-ctl--ancho">
          <small>Nombre del segmento</small>
          <PulsoInput
            size="sm"
            value={seg.nombre}
            placeholder={nombreDeSegmento(seg) || "Condición y categoría"}
            aria-label="Nombre del segmento"
            onChange={(e) => onCambio({ ...estado, segmento: { ...seg, nombre: e.currentTarget.value } })}
          />
        </label>
      </div>
      {!cuotas.length ? (
        <p className="cmmp-vacio-chico cmmp-pad">Marca al menos una columna "Para cuotas" en Columnas.</p>
      ) : !seg.fila ? (
        <p className="cmmp-vacio-chico cmmp-pad">Sin segmento, la meta del público no se reparte.</p>
      ) : null}
      {error ? <div className="cmmp-pad"><Alert kind="error">{error}</Alert></div> : null}
      {cruce ? (
        <>
          <PulsoTable
            columnas={columnas}
            filas={cruce.filas.map((fila, i) => ({ fila, i }))}
            idDeFila={(f) => f.fila}
            ariaLabel={`Población por ${cruce.filaVariable}${cruce.columnaVariable ? ` y ${cruce.columnaVariable}` : ""}`}
            densidad="compacta"
            altoMaximo={2000}
          />
          <section className="cmmp-sec" aria-label="Grupos">
            <h4>Grupos {libres.length ? <Pastilla tono="aviso">{libres.length === 1 ? "1 celda sin grupo" : `${fmtInt(libres.length)} celdas sin grupo`}</Pastilla> : null}</h4>
            <ul className="cmmp-grupos">
              {grupos.map((g) => {
                const n = poblacionDeGrupo(cruce, g);
                return (
                  <li key={g.nombre}>
                    <i data-tono={tono(g.nombre)} aria-hidden="true" />
                    <PulsoInput
                      size="sm"
                      defaultValue={g.nombre}
                      aria-label={`Nombre del grupo ${g.nombre}`}
                      onBlur={(e) => onCambio({ ...estado, segmento: { ...seg, grupos: renombrarGrupo(grupos, g.nombre, e.currentTarget.value) } })}
                    />
                    <em>{cifra(n)}</em>
                    <span className="cmmp-grupo-barra"><span data-tono={tono(g.nombre)} style={{ transform: `scaleX(${n / maxGrupo})` }} /></span>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      ) : null}
    </PanelDeMesa>
  );
}
