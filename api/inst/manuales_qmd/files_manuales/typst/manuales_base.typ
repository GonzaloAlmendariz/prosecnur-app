#set text(font: "Arial", size: 10pt, lang: "es")
#set par(justify: false, leading: 0.75em)
#set page(numbering: "1", number-align: right)

#show heading.where(level: 1): it => {
  v(0.9em)
  block(
    width: 100%,
    fill: rgb("#1A4A7A"),
    inset: (x: 10pt, y: 7pt),
    radius: 4pt
  )[
    #text(fill: white, weight: "bold", size: 13pt)[#it.body]
  ]
  v(0.5em)
}

#show heading.where(level: 2): it => {
  v(0.7em)
  block(
    width: 100%,
    fill: rgb("#2E5B9E"),
    inset: (x: 8pt, y: 5pt),
    radius: 3pt
  )[
    #text(fill: white, weight: "bold", size: 11pt)[#it.body]
  ]
  v(0.3em)
}

#show heading.where(level: 3): it => {
  v(0.5em)
  text(weight: "bold", fill: rgb("#1A4A7A"), size: 10.5pt)[#it.body]
  v(0.15em)
}

#show strong: it => text(weight: "bold", fill: rgb("#1A4A7A"))[#it.body]

