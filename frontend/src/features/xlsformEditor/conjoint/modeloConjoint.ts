// Experimento de elección por pares (conjoint) como bloque del editor (checklist editor-conjoint, E7a, 2026-11-06;
// nombre y orden de filas, checklist elección por pares C1–C2, 2026-11-07).
// Quien diseña declara atributos, niveles, pesos y condiciones; aquí se generan las filas XLSForm que hacen el
// sorteo dentro del formulario, sin escribir fórmulas:
//   - un `once(random())` por atributo, tarea y perfil: el sorteo se fija una vez por entrevista;
//   - el nivel sale de ese número (equiprobable con `int(r * k)`, o por umbrales acumulados si hay pesos);
//   - un atributo condicional vale 'NA' cuando su condición no se cumple y se muestra «—»;
//   - cada par es una página (`field-list`) con su sorteo adentro, la tabla de perfiles lado a lado y la pregunta;
//   - opcional: el orden de los atributos se sortea una vez por encuestado y se mantiene en todas sus tareas.

export type NivelConjoint = { codigo: string; texto: string; peso?: number };

export type AtributoConjoint = {
  clave: string;
  rotulo: string;
  niveles: NivelConjoint[];
  /** Sólo se sortea si el atributo indicado NO tomó alguno de estos códigos (si no, vale 'NA'). */
  soloSi?: { atributo: string; noEs: string[] };
};

export type DisenoConjoint = {
  prefijo: string;
  tareas: number;
  rotulosPerfil: [string, string];
  atributos: AtributoConjoint[];
  pregunta: string;
  intro?: string;
  ordenAleatorio?: boolean;
};

export type FilaSurveyConjoint = {
  type: string;
  name: string;
  label: string;
  calculation: string;
  appearance: string;
  required: string;
};

export type FilaChoiceConjoint = { list_name: string; name: string; label: string };

export const SIN_NIVEL = "—";
const NOMBRE = /^[A-Za-z_][A-Za-z0-9_]*$/;
const PERFILES = ["A", "B"] as const;

export const ref = (n: string) => "${" + n + "}";

/** Literal XPath: comillas simples salvo que el texto las traiga; si trae ambas, el apóstrofo pasa a tipográfico. */
export function literal(texto: string): string {
  if (!texto.includes("'")) return `'${texto}'`;
  if (!texto.includes('"')) return `"${texto}"`;
  return `'${texto.replace(/'/g, "’")}'`;
}

/** Problemas del diseño, en castellano. Vacío si se puede generar. */
export function validarDiseno(d: DisenoConjoint): string[] {
  const out: string[] = [];
  if (!NOMBRE.test(d.prefijo)) out.push(`El prefijo "${d.prefijo}" no sirve como nombre de variable: usa letras, números y _.`);
  if (!Number.isInteger(d.tareas) || d.tareas < 1 || d.tareas > 30) out.push("El número de pares va de 1 a 30.");
  if (d.atributos.length < 2) out.push("El experimento necesita al menos dos atributos.");
  if (!d.pregunta.trim()) out.push("Falta la pregunta de elección.");
  return [...out, ...validarAtributos(d.atributos)];
}

/** Problemas de los atributos y sus niveles; los comparten todos los experimentos que sortean atributos. */
export function validarAtributos(atributos: readonly AtributoConjoint[]): string[] {
  const out: string[] = [];
  const vistos = new Set<string>();
  atributos.forEach((a, i) => {
    const nombre = a.rotulo || a.clave || `#${i + 1}`;
    if (!NOMBRE.test(a.clave)) out.push(`La clave de "${nombre}" no sirve como nombre de variable.`);
    if (vistos.has(a.clave)) out.push(`La clave "${a.clave}" se repite.`);
    if (!a.rotulo.trim()) out.push(`El atributo "${a.clave}" no tiene rótulo.`);
    if (a.niveles.length < 2) out.push(`"${nombre}" necesita al menos dos niveles.`);
    const codigos = a.niveles.map((n) => n.codigo);
    if (new Set(codigos).size !== codigos.length) out.push(`"${nombre}" repite un código de nivel.`);
    if (codigos.some((c) => !NOMBRE.test(c) && !/^\d+$/.test(c))) out.push(`"${nombre}" tiene un código con espacios o símbolos.`);
    if (codigos.includes("NA")) out.push(`"${nombre}" usa el código NA, que queda reservado para "no aplica".`);
    const pesos = a.niveles.map((n) => n.peso);
    const conPeso = pesos.filter((p) => p != null);
    if (conPeso.length && conPeso.length !== pesos.length) out.push(`"${nombre}": o todos los niveles llevan peso o ninguno.`);
    if (conPeso.length === pesos.length && conPeso.length) {
      const suma = conPeso.reduce((s, p) => s + (p ?? 0), 0);
      if (Math.abs(suma - 1) > 0.001 || conPeso.some((p) => (p ?? 0) <= 0)) out.push(`"${nombre}": los pesos deben ser positivos y sumar 1 (suman ${Math.round(suma * 1000) / 1000}).`);
    }
    if (a.soloSi) {
      const base = atributos.findIndex((b) => b.clave === a.soloSi!.atributo);
      if (base < 0 || base >= i) out.push(`"${nombre}" depende de "${a.soloSi.atributo}", que debe ir antes en la lista.`);
      else if (a.soloSi.noEs.some((c) => !atributos[base]!.niveles.some((n) => n.codigo === c))) out.push(`"${nombre}" depende de un nivel que "${a.soloSi.atributo}" no tiene.`);
    }
    vistos.add(a.clave);
  });
  return out;
}

/** Fórmula del nivel: equiprobable o por umbrales acumulados. */
export function formulaNivel(r: string, niveles: NivelConjoint[]): string {
  const k = niveles.length;
  if (niveles.every((n) => n.peso != null)) {
    let acumulado = 0;
    let expr = literal(niveles[k - 1]!.codigo);
    const cortes = niveles.slice(0, -1).map((n) => (acumulado += n.peso ?? 0));
    for (let i = k - 2; i >= 0; i -= 1) expr = `if(${ref(r)} < ${Math.round(cortes[i]! * 1e6) / 1e6}, ${literal(niveles[i]!.codigo)}, ${expr})`;
    return expr;
  }
  let expr = literal(niveles[k - 1]!.codigo);
  for (let i = k - 2; i >= 0; i -= 1) expr = `if(int(${ref(r)} * ${k}) = ${i}, ${literal(niveles[i]!.codigo)}, ${expr})`;
  return expr;
}

export function formulaTexto(variable: string, niveles: NivelConjoint[]): string {
  let expr = literal(SIN_NIVEL);
  for (let i = niveles.length - 1; i >= 0; i -= 1) expr = `if(${ref(variable)} = ${literal(niveles[i]!.codigo)}, ${literal(niveles[i]!.texto)}, ${expr})`;
  return expr;
}

export const fila = (p: Partial<FilaSurveyConjoint> & Pick<FilaSurveyConjoint, "type" | "name">): FilaSurveyConjoint => ({
  label: "",
  calculation: "",
  appearance: "",
  required: "",
  ...p,
});

/** Nombres de las filas del experimento. Los del editor salen del prefijo; uno ya escrito conserva los suyos. */
export type NombresConjoint = {
  azar: (tarea: number, perfil: "A" | "B", clave: string) => string;
  nivel: (tarea: number, perfil: "A" | "B", clave: string) => string;
  texto: (tarea: number, perfil: "A" | "B", clave: string) => string;
  grupo: (tarea: number) => string;
  tabla: (tarea: number) => string;
  eleccion: (tarea: number) => string;
  lista: string;
  intro: string;
};

export function nombresDelEditor(prefijo: string): NombresConjoint {
  const v = (t: number, perfil: "A" | "B", clave: string) => `${prefijo}_t${t}${perfil}_${clave}`;
  return {
    azar: (t, perfil, clave) => `${v(t, perfil, clave)}_r`,
    nivel: v,
    texto: (t, perfil, clave) => `${v(t, perfil, clave)}_txt`,
    grupo: (t) => `${prefijo}_tarea${t}`,
    tabla: (t) => `${prefijo}_t${t}_tabla`,
    eleccion: (t) => `${prefijo}_t${t}_eleccion`,
    lista: `${prefijo}_perfil`,
    intro: `${prefijo}_intro`,
  };
}

/** Nombres de las variables que se analizan: el código sorteado de cada atributo por tarea y perfil. */
export function variableNivel(d: DisenoConjoint, tarea: number, perfil: "A" | "B", clave: string): string {
  return nombresDelEditor(d.prefijo).nivel(tarea, perfil, clave);
}

export function generarConjoint(
  d: DisenoConjoint,
  nombres: NombresConjoint = nombresDelEditor(d.prefijo),
): { survey: FilaSurveyConjoint[]; choices: FilaChoiceConjoint[] } {
  const problemas = validarDiseno(d);
  if (problemas.length) throw new Error(problemas.join(" "));
  const p = d.prefijo;
  const survey: FilaSurveyConjoint[] = [];
  const nAtr = d.atributos.length;

  // Orden de los atributos, sorteado una vez por encuestado: posición = 1 + cuántos sacaron un número menor. Vale para
  // todos los pares, así que va antes del primero.
  if (d.ordenAleatorio) {
    d.atributos.forEach((a) => survey.push(fila({ type: "calculate", name: `${p}_u_${a.clave}`, calculation: "once(random())" })));
    d.atributos.forEach((a) => {
      const otros = d.atributos.filter((b) => b.clave !== a.clave).map((b) => `if(${ref(`${p}_u_${b.clave}`)} < ${ref(`${p}_u_${a.clave}`)}, 1, 0)`);
      survey.push(fila({ type: "calculate", name: `${p}_pos_${a.clave}`, calculation: `1 + ${otros.join(" + ")}` }));
    });
    for (let k = 1; k <= nAtr; k += 1) {
      let atr = "''";
      let rot = "''";
      for (let i = nAtr - 1; i >= 0; i -= 1) {
        const a = d.atributos[i]!;
        atr = `if(${ref(`${p}_pos_${a.clave}`)} = ${k}, ${literal(a.clave)}, ${atr})`;
        rot = `if(${ref(`${p}_fila${k}`)} = ${literal(a.clave)}, ${literal(a.rotulo)}, ${rot})`;
      }
      survey.push(fila({ type: "calculate", name: `${p}_fila${k}`, calculation: atr }));
      survey.push(fila({ type: "calculate", name: `${p}_fila${k}_rot`, calculation: rot }));
    }
  }

  if (d.intro?.trim()) survey.push(fila({ type: "note", name: nombres.intro, label: d.intro.trim() }));

  // Cada par: su grupo con el sorteo de los dos perfiles adentro (C2), la tabla y la pregunta de elección.
  const [rA, rB] = d.rotulosPerfil;
  for (let t = 1; t <= d.tareas; t += 1) {
    survey.push(fila({ type: "begin_group", name: nombres.grupo(t), label: `Par ${t} de ${d.tareas}`, appearance: "field-list" }));
    for (const perfil of PERFILES) {
      for (const a of d.atributos) {
        const v = nombres.nivel(t, perfil, a.clave);
        const r = nombres.azar(t, perfil, a.clave);
        survey.push(fila({ type: "calculate", name: r, calculation: "once(random())" }));
        let calc = formulaNivel(r, a.niveles);
        if (a.soloSi) {
          const base = ref(nombres.nivel(t, perfil, a.soloSi.atributo));
          const cond = a.soloSi.noEs.map((c) => `${base} = ${literal(c)}`).join(" or ");
          calc = `if(${cond}, 'NA', ${calc})`;
        }
        survey.push(fila({ type: "calculate", name: v, calculation: calc }));
        survey.push(fila({ type: "calculate", name: nombres.texto(t, perfil, a.clave), calculation: formulaTexto(v, a.niveles) }));
      }
      if (d.ordenAleatorio) {
        for (let k = 1; k <= nAtr; k += 1) {
          let celda = literal(SIN_NIVEL);
          for (let i = nAtr - 1; i >= 0; i -= 1) {
            const a = d.atributos[i]!;
            celda = `if(${ref(`${p}_fila${k}`)} = ${literal(a.clave)}, ${ref(nombres.texto(t, perfil, a.clave))}, ${celda})`;
          }
          survey.push(fila({ type: "calculate", name: `${p}_t${t}${perfil}_celda${k}`, calculation: celda }));
        }
      }
    }
    const lineas = [`| | ${rA} | ${rB} |`, "|---|---|---|"];
    for (let k = 1; k <= nAtr; k += 1) {
      if (d.ordenAleatorio) {
        lineas.push(`| ${ref(`${p}_fila${k}_rot`)} | ${ref(`${p}_t${t}A_celda${k}`)} | ${ref(`${p}_t${t}B_celda${k}`)} |`);
      } else {
        const a = d.atributos[k - 1]!;
        lineas.push(`| ${a.rotulo} | ${ref(nombres.texto(t, "A", a.clave))} | ${ref(nombres.texto(t, "B", a.clave))} |`);
      }
    }
    survey.push(fila({ type: "note", name: nombres.tabla(t), label: lineas.join("\n") }));
    survey.push(fila({ type: `select_one ${nombres.lista}`, name: nombres.eleccion(t), label: d.pregunta.trim(), required: "yes" }));
    survey.push(fila({ type: "end_group", name: "" }));
  }

  const choices: FilaChoiceConjoint[] = [
    { list_name: nombres.lista, name: "1", label: rA },
    { list_name: nombres.lista, name: "2", label: rB },
  ];
  return { survey, choices };
}
