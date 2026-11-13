/**
 * Las filas de "Combinación fuera de catálogo" en la caja "Condiciones" del
 * panel de regla: un selector por papel (departamento, provincia, distrito,
 * ubigeo), con la columna que propone el motor ya elegida, más lo que no se
 * revisa y si se marcan las filas incompletas. Cualquier subconjunto de
 * papeles vale desde dos. Lo que se guarda lo arma `paramsDeCombinacion`; el
 * motor es `api/R/reglas_custom_catalogo.R`.
 *
 * La propuesta mira el contenido de cada columna (qué parte de sus valores
 * casa con cada nivel del catálogo), nunca su nombre. Se aplica una sola vez,
 * cuando ningún papel está elegido: después manda lo que el analista elija.
 */
import { useEffect, useRef } from "react";
import { PAPELES_DE_CATALOGO, type PapelDeCatalogo, type PapelesDeCatalogo, type PropuestaDePapeles } from "../../../../api/catalogoUbigeo";
import { PulsoButton } from "../../../../components/PulsoButton";
import { PulsoInput } from "../../../../components/PulsoInput";
import { PulsoSwitch } from "../../../../components/PulsoSwitch";
import type { ExploradorVariable } from "../../types";
import type { AccionDeBorrador, Borrador } from "../borradorDeRegla";
import { CampoPregunta } from "../campos/CampoPregunta";
import { useBaseDelPanel } from "../campos/opcionesDeVariable";
import { ROTULO_DE_PAPEL, ariaDeLaPregunta, papelesDeParams } from "../modeloCombinacion";
import { paramList } from "../modeloRegla";
import { Fila } from "./FilaDeRegla";
import { usePropuestaDePapeles } from "./usePropuestaDePapeles";
import "./camposDeCombinacion.css";

const NIVEL_EN_PLURAL: Readonly<Record<PapelDeCatalogo, string>> = {
  departamento: "departamentos",
  provincia: "provincias",
  distrito: "distritos",
  ubigeo: "ubigeos",
};

/** "92 % casa con distritos": la parte de los valores de la columna que el catálogo reconoce en ese nivel. */
export function parteDeLaColumna(propuesta: PropuestaDePapeles | null, columna: string | null, papel: PapelDeCatalogo): string {
  if (!propuesta || !columna) return "";
  const medida = propuesta.columnas.find((c) => c.columna === columna);
  const parte = medida?.parte[papel];
  if (parte === null || parte === undefined) return "";
  return `${(parte * 100).toFixed(0)} % casa con ${NIVEL_EN_PLURAL[papel]}`;
}

/** "p1_1, p1_2 y p1_3": las columnas de un grupo propuesto, en el orden de los papeles. */
export function columnasDelGrupo(papeles: PapelesDeCatalogo): string {
  const cols = PAPELES_DE_CATALOGO.map((p) => papeles[p]).filter((c): c is string => Boolean(c));
  return cols.length <= 1 ? cols.join("") : `${cols.slice(0, -1).join(", ")} y ${cols[cols.length - 1]}`;
}

function rolesComoParams(papeles: PapelesDeCatalogo): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of PAPELES_DE_CATALOGO) if (papeles[p]) out[p] = papeles[p] as string;
  return out;
}

export function CamposDeCombinacion({
  borrador: b,
  despachar,
  variables,
}: {
  borrador: Borrador;
  despachar: (accion: AccionDeBorrador) => void;
  variables: readonly ExploradorVariable[];
}) {
  const base = useBaseDelPanel();
  const estado = usePropuestaDePapeles(base);
  const propuesta = estado.fase === "lista" ? estado.propuesta : null;
  const papeles = papelesDeParams(b.params);
  const ninguno = PAPELES_DE_CATALOGO.every((p) => !papeles[p]);
  const aplicada = useRef(false);

  const setPapeles = (nuevos: PapelesDeCatalogo) =>
    despachar({ tipo: "params", valor: { ...b.params, roles: rolesComoParams(nuevos) } });

  // La propuesta del motor llega elegida, una vez y solo si nadie eligió nada.
  useEffect(() => {
    if (aplicada.current || !propuesta || !ninguno) return;
    aplicada.current = true;
    if (PAPELES_DE_CATALOGO.some((p) => propuesta.propuesta[p])) setPapeles(propuesta.propuesta);
  }, [propuesta, ninguno]);

  const otros = (propuesta?.propuestas ?? []).filter((g) => columnasDelGrupo(g.papeles) !== columnasDelGrupo(papeles));

  const filas = PAPELES_DE_CATALOGO.map((papel) => {
    const columna = papeles[papel];
    const parte = parteDeLaColumna(propuesta, columna, papel);
    return (
      <Fila
        key={papel}
        variante="campo"
        rotulo={ROTULO_DE_PAPEL[papel]}
        quitar={columna ? { etiqueta: `Quitar la pregunta de ${ROTULO_DE_PAPEL[papel].toLowerCase()}`, onQuitar: () => setPapeles({ ...papeles, [papel]: null }) } : undefined}
      >
        <span className="pulso-regla-combinacion-papel">
          <CampoPregunta
            variables={variables}
            valor={columna ?? ""}
            onCambio={(v) => setPapeles({ ...papeles, [papel]: v || null })}
            ariaLabel={ariaDeLaPregunta(papel)}
            placeholder="Sin pregunta"
          />
          {parte ? <span className="pulso-regla-combinacion-parte">{parte}</span> : null}
        </span>
      </Fila>
    );
  });

  if (estado.fase === "error") {
    filas.push(
      <Fila key="aviso" variante="campo" rotulo="Propuesta">
        <span className="pulso-regla-combinacion-aviso">No se pudo leer la base para proponer las preguntas: {estado.mensaje}</span>
      </Fila>,
    );
  } else if (otros.length) {
    filas.push(
      <Fila key="otras" variante="campo" rotulo="Otra combinación">
        <span className="pulso-regla-combinacion-grupos">
          {otros.map((g) => (
            <PulsoButton key={columnasDelGrupo(g.papeles)} variant="secondary" size="sm" onClick={() => setPapeles(g.papeles)}>
              {columnasDelGrupo(g.papeles)}
            </PulsoButton>
          ))}
        </span>
      </Fila>,
    );
  }

  filas.push(
    <Fila key="omitir" variante="campo" rotulo="No revisar">
      <PulsoInput
        value={typeof b.params.omitir === "string" ? b.params.omitir : paramList(b.params.omitir).join(", ")}
        onChange={(e) => despachar({ tipo: "param", clave: "omitir", valor: e.target.value })}
        placeholder="VENEZUELA, NO RECUERDA"
        aria-label="Respuestas que no se revisan, separadas por coma"
      />
    </Fila>,
    <Fila key="incompletos" variante="campo" rotulo="Preguntas vacías">
      <PulsoSwitch
        size="sm"
        checked={b.params.marcar_incompletos === true}
        onCheckedChange={(v) => despachar({ tipo: "param", clave: "marcar_incompletos", valor: v })}
        label="Marcar también las encuestas que calzan con alguna pregunta de lugar vacía"
      />
    </Fila>,
  );
  return <>{filas}</>;
}
