"use strict";

(() => {
  const SVG_NS = "http://www.w3.org/2000/svg";

  function material(kind, base, detail, highlight) {
    return Object.freeze({ kind, base, detail, highlight });
  }

  const MATERIALS = Object.freeze({
    plasterCream: material("plaster", "#d9c99a", "#b9a878", "#f0e2b9"),
    plasterPeach: material("plaster", "#c99674", "#a87458", "#e2b08d"),
    concreteGrey: material("concrete", "#aaa395", "#7e7a70", "#c5beb0"),
    logsHoney: material("logs", "#9a7047", "#65472f", "#b8895a"),
    planksDark: material("planks", "#684b36", "#433126", "#846149"),
    planksWarm: material("planks", "#8b6343", "#5c402e", "#a47750"),
    shingleRedDark: material("shingle", "#a84e32", "#7b3e2e", "#c66a48"),
    shingleRedLight: material("shingle", "#c86d3f", "#95503a", "#e08a5d"),
    shingleCharcoalDark: material("shingle", "#4f555b", "#343b42", "#687079"),
    shingleCharcoalLight: material("shingle", "#646a70", "#434b52", "#7d858d"),
    shingleBrownDark: material("shingle", "#755039", "#533a2d", "#946d4f"),
    shingleBrownLight: material("shingle", "#8e6445", "#664833", "#ad805b"),
    thatchDark: material("thatch", "#b68b40", "#87672f", "#c59a4a"),
    thatchLight: material("thatch", "#d0aa57", "#9b7837", "#e0bc68")
  });

  function appearance({
    wall,
    wallAlt = wall,
    foundation,
    roofDark,
    roofLight,
    roofOutline,
    door = "#755037",
    beam = "#51392d",
    brace = "#a87549",
    chimney = "#805847",
    outline = "#40372f"
  }) {
    return Object.freeze({
      wall,
      wallAlt,
      foundation,
      roofDark,
      roofLight,
      roofOutline,
      outline,
      door,
      beam,
      brace,
      chimney
    });
  }

  const RED_ROOF = Object.freeze({
    roofDark: MATERIALS.shingleRedDark,
    roofLight: MATERIALS.shingleRedLight,
    roofOutline: "#693d2e"
  });
  const THATCH_ROOF = Object.freeze({
    roofDark: MATERIALS.thatchDark,
    roofLight: MATERIALS.thatchLight,
    roofOutline: "#6f512d"
  });
  const CHARCOAL_ROOF = Object.freeze({
    roofDark: MATERIALS.shingleCharcoalDark,
    roofLight: MATERIALS.shingleCharcoalLight,
    roofOutline: "#2f3840"
  });
  const BROWN_ROOF = Object.freeze({
    roofDark: MATERIALS.shingleBrownDark,
    roofLight: MATERIALS.shingleBrownLight,
    roofOutline: "#5b3d2e"
  });

  const APPEARANCES = Object.freeze({
    whitewash_red: appearance({
      wall: MATERIALS.plasterCream,
      foundation: "#b7a26f",
      ...RED_ROOF
    }),
    log_thatch: appearance({
      wall: MATERIALS.logsHoney,
      foundation: "#5e4431",
      door: "#52392d",
      ...THATCH_ROOF
    }),
    peach_plaster_red: appearance({
      wall: MATERIALS.plasterPeach,
      foundation: "#9e765d",
      ...RED_ROOF
    }),
    concrete_thatch: appearance({
      wall: MATERIALS.concreteGrey,
      foundation: "#7d766a",
      door: "#52392d",
      ...THATCH_ROOF
    }),
    mixed_plaster_red: appearance({
      wall: MATERIALS.plasterCream,
      wallAlt: MATERIALS.planksDark,
      foundation: "#b7a26f",
      ...RED_ROOF
    }),
    timber_thatch: appearance({
      wall: MATERIALS.logsHoney,
      wallAlt: MATERIALS.planksWarm,
      foundation: "#5e4431",
      door: "#52392d",
      ...THATCH_ROOF
    }),
    weathered_charcoal: appearance({
      wall: MATERIALS.planksDark,
      foundation: "#4c372a",
      door: "#52392d",
      ...CHARCOAL_ROOF
    }),
    straw_thatch: appearance({
      wall: MATERIALS.planksWarm,
      foundation: "#5e4431",
      door: "#52392d",
      brace: "#b17b4d",
      ...THATCH_ROOF
    }),
    timber_brown: appearance({
      wall: MATERIALS.planksDark,
      foundation: "#4c372a",
      ...BROWN_ROOF
    }),
    concrete_red: appearance({
      wall: MATERIALS.concreteGrey,
      foundation: "#7d766a",
      door: "#52392d",
      ...RED_ROOF
    }),
    plaster_charcoal: appearance({
      wall: MATERIALS.plasterCream,
      foundation: "#b7a26f",
      ...CHARCOAL_ROOF
    }),
    wooden_brown_red: appearance({
      wall: MATERIALS.logsHoney,
      foundation: "#5e4431",
      door: "#52392d",
      beam: "#b07b4e",
      ...BROWN_ROOF
    })
  });

  function safeId(value) {
    return String(value ?? "building").replace(/[^a-zA-Z0-9_-]/g, "-");
  }

  function patternMarkup(id, material) {
    const base = material.base;
    const detail = material.detail;
    const highlight = material.highlight;

    if (material.kind === "plaster" || material.kind === "concrete") {
      return `<pattern id="${id}" width="58" height="44" patternUnits="userSpaceOnUse">
        <rect width="58" height="44" fill="${base}"/>
        <path d="M5 13C16 8 25 9 34 14M28 34C40 29 48 30 55 35" fill="none" stroke="${detail}" stroke-width="5" opacity=".09"/>
        <circle cx="46" cy="9" r="5" fill="${highlight}" opacity=".11"/>
      </pattern>`;
    }

    if (material.kind === "logs") {
      return `<pattern id="${id}" width="44" height="18" patternUnits="userSpaceOnUse">
        <rect width="44" height="18" fill="${base}"/>
        <path d="M0 17H44" stroke="${detail}" stroke-width="3" opacity=".72"/>
        <path d="M9 5H26" stroke="${highlight}" stroke-width="3" opacity=".32"/>
        <circle cx="35" cy="8" r="2.5" fill="${detail}" opacity=".44"/>
      </pattern>`;
    }

    if (material.kind === "planks") {
      return `<pattern id="${id}" width="22" height="60" patternUnits="userSpaceOnUse">
        <rect width="22" height="60" fill="${base}"/>
        <path d="M21 0V60" stroke="${detail}" stroke-width="3" opacity=".82"/>
        <path d="M6 6V51" stroke="${highlight}" stroke-width="2" opacity=".26"/>
      </pattern>`;
    }

    if (material.kind === "stone") {
      return `<pattern id="${id}" width="52" height="30" patternUnits="userSpaceOnUse">
        <rect width="52" height="30" fill="${base}"/>
        <path d="M0 29H52M17 0V14M38 15V29" stroke="${detail}" stroke-width="3" opacity=".30"/>
        <path d="M5 8H13M25 21H34" stroke="${highlight}" stroke-width="3" opacity=".16"/>
      </pattern>`;
    }

    if (material.kind === "thatch") {
      return `<pattern id="${id}" width="34" height="42" patternUnits="userSpaceOnUse">
        <rect width="34" height="42" fill="${base}"/>
        <path d="M6 2V40M15 0V42M24 3V39M31 7V36" stroke="${detail}" stroke-width="4" opacity=".29"/>
        <path d="M10 7V26M28 12V32" stroke="${highlight}" stroke-width="3" opacity=".08"/>
      </pattern>`;
    }

    return `<pattern id="${id}" width="42" height="42" patternUnits="userSpaceOnUse">
      <rect width="42" height="42" fill="${base}"/>
      <path d="M8 4V38M21 2V40M34 6V39" stroke="${detail}" stroke-width="3" opacity=".18"/>
      <path d="M14 10V28M28 12V31" stroke="${highlight}" stroke-width="3" opacity=".08"/>
    </pattern>`;
  }

  function contextFor(definition, instance) {
    const shape = definition.presentation?.shape;
    const appearanceId = instance.appearance ?? definition.presentation?.defaultAppearance;
    const appearance = APPEARANCES[appearanceId];
    if (!shape) throw new Error(`Building ${definition.id} has no presentation shape.`);
    if (!appearance) throw new Error(`Unknown building appearance: ${appearanceId}`);

    const prefix = `building-${safeId(instance.id)}-${safeId(appearanceId)}`;
    const wallAlt = appearance.wallAlt ?? appearance.wall;
    const ids = Object.freeze({
      wall: `${prefix}-wall`,
      wallAlt: `${prefix}-wall-alt`,
      roofDark: `${prefix}-roof-dark`,
      roofLight: `${prefix}-roof-light`
    });

    return Object.freeze({
      shape,
      appearanceId,
      appearance,
      ids,
      fills: Object.freeze({
        wall: `url(#${ids.wall})`,
        wallAlt: `url(#${ids.wallAlt})`,
        roofDark: `url(#${ids.roofDark})`,
        roofLight: `url(#${ids.roofLight})`
      }),
      defs: [
        patternMarkup(ids.wall, appearance.wall),
        patternMarkup(ids.wallAlt, wallAlt),
        patternMarkup(ids.roofDark, appearance.roofDark),
        patternMarkup(ids.roofLight, appearance.roofLight)
      ].join("")
    });
  }

  function sharedWindow(x, y, width, height, micro = false) {
    const className = micro ? "building-svg-micro" : "building-svg-fine";
    return `<g class="${className}">
      <rect class="building-svg-detail" x="${x}" y="${y}" width="${width}" height="${height}" rx="2" fill="#97bbc6"/>
      <rect x="${x + width * .22}" y="${y + height * .22}" width="${width * .56}" height="${height * .48}" fill="#b8d0d6"/>
    </g>`;
  }

  function chimney(x, y, width, height, appearance) {
    return `<g class="building-svg-detail">
      <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="3" fill="${appearance.chimney}"/>
      <rect x="${x - 4}" y="${y - 4}" width="${width + 8}" height="8" rx="2" fill="#4e3b31" stroke="none"/>
    </g>`;
  }

  function smallCottage(ctx) {
    const { appearance: a, fills: f } = ctx;
    return `<g class="building-svg-shadow"><path d="M80 95H240V190H80Z" transform="translate(7 8)"/></g>
      <g class="building-svg-body">
        <path class="building-svg-structure" d="M88 106L160 84L232 106V190H88Z" fill="${f.wall}"/>
        <rect x="91" y="159" width="138" height="28" fill="${a.foundation}" opacity=".62"/>
        <path class="building-svg-detail" d="M145 155Q145 146 154 146H166Q175 146 175 155V190H145Z" fill="${a.door}"/>
        ${sharedWindow(108, 154, 22, 18, true)}
      </g>
      <g class="building-svg-roof">
        <path class="building-svg-roof-shape" d="M160 42L76 85V144L160 113Z" fill="${f.roofDark}"/>
        <path class="building-svg-roof-shape" d="M160 42L244 85V144L160 113Z" fill="${f.roofLight}"/>
        <path class="building-svg-ridge" d="M160 49V104"/>
        ${a.roofDark.kind === "thatch" ? '<path class="building-svg-thatch-eave" d="M78 141L107 134L134 127L160 113L187 127L214 135L242 141"/>' : ""}
      </g>`;
  }

  function mediumCottage(ctx) {
    const { appearance: a, fills: f } = ctx;
    return `<g class="building-svg-shadow"><path d="M58 92H286V201H58Z" transform="translate(7 8)"/></g>
      <g class="building-svg-body">
        <path class="building-svg-structure" d="M72 111L170 75L268 111V199H72Z" fill="${f.wall}"/>
        <rect x="75" y="165" width="190" height="31" fill="${a.foundation}" opacity=".62"/>
        ${sharedWindow(94, 151, 35, 30)}
        ${sharedWindow(211, 151, 35, 30)}
        <path class="building-svg-detail" d="M148 153Q148 141 160 141H180Q192 141 192 153V199H148Z" fill="${a.door}"/>
      </g>
      <g class="building-svg-roof">
        <path class="building-svg-roof-shape" d="M170 31L39 83V150L170 108Z" fill="${f.roofDark}"/>
        <path class="building-svg-roof-shape" d="M170 31L301 83V150L170 108Z" fill="${f.roofLight}"/>
        <path class="building-svg-ridge" d="M170 40V101"/>
        ${a.roofDark.kind === "thatch" ? '<path class="building-svg-thatch-eave" d="M43 146L88 135L128 121L170 108L212 121L252 136L297 146"/>' : ""}
        ${chimney(228, 34, 22, 51, a)}
      </g>`;
  }

  function longFarmhouse(ctx) {
    const { appearance: a, fills: f } = ctx;
    return `<g class="building-svg-shadow"><rect x="55" y="91" width="420" height="109" rx="18" transform="translate(7 8)"/></g>
      <g class="building-svg-body">
        <rect class="building-svg-structure" x="61" y="112" width="398" height="88" fill="${f.wall}"/>
        <rect class="building-svg-structure" x="278" y="112" width="181" height="88" fill="${f.wallAlt}"/>
        <rect x="64" y="171" width="211" height="26" fill="${a.foundation}" opacity=".62"/>
        <path class="building-svg-detail" d="M172 154Q172 145 181 145H199Q208 145 208 154V200H172Z" fill="${a.door}"/>
        ${sharedWindow(92, 149, 37, 31)}
        <g>
          <rect class="building-svg-detail" x="330" y="136" width="95" height="64" fill="#52392d"/>
          <path class="building-svg-brace" d="M337 143L418 193M418 143L337 193"/>
          <path class="building-svg-fine" d="M377 140V197"/>
        </g>
      </g>
      <g class="building-svg-roof">
        <rect class="building-svg-roof-shape" x="56" y="50" width="410" height="58" fill="${f.roofDark}"/>
        <path class="building-svg-roof-shape" d="M64 108H458L450 132H56Z" fill="${f.roofLight}"/>
        <path class="building-svg-ridge" d="M64 108H458"/>
        ${a.roofDark.kind === "thatch" ? '<path class="building-svg-thatch-eave" d="M60 129H454"/>' : ""}
        ${chimney(154, 32, 24, 48, a)}
      </g>`;
  }

  function barn(ctx) {
    const { appearance: a, fills: f } = ctx;
    return `<g class="building-svg-shadow"><rect x="49" y="90" width="292" height="120" rx="20" transform="translate(7 8)"/></g>
      <g class="building-svg-body">
        <path class="building-svg-structure" d="M58 112L195 76L332 112V207H58Z" fill="${f.wall}"/>
        <rect x="63" y="114" width="9" height="90" fill="${a.beam}"/>
        <rect x="318" y="114" width="9" height="90" fill="${a.beam}"/>
        <rect x="190" y="89" width="10" height="48" fill="${a.beam}"/>
        <rect class="building-svg-detail" x="111" y="140" width="168" height="67" fill="${a.door}"/>
        <path class="building-svg-brace" d="M120 148L270 199M270 148L120 199"/>
        <path class="building-svg-fine" d="M195 143V203"/>
        <rect class="building-svg-fine" x="178" y="108" width="34" height="23" fill="#52392d"/>
      </g>
      <g class="building-svg-roof">
        <path class="building-svg-roof-shape" d="M195 42L22 86V146L195 105Z" fill="${f.roofDark}"/>
        <path class="building-svg-roof-shape" d="M195 42L368 86V146L195 105Z" fill="${f.roofLight}"/>
        <path class="building-svg-ridge" d="M195 50V99"/>
        ${a.roofDark.kind === "thatch" ? '<path class="building-svg-thatch-eave" d="M25 143L73 134L120 123L160 114L195 105L231 114L272 124L319 135L365 143"/>' : ""}
      </g>`;
  }

  function shed(ctx) {
    const { appearance: a, fills: f } = ctx;
    return `<g class="building-svg-shadow"><path d="M62 79L246 58V190H62Z" transform="translate(7 8)"/></g>
      <g class="building-svg-body">
        <path class="building-svg-structure" d="M72 84L235 68V190H72Z" fill="${f.wall}"/>
        <path d="M75 158L103 156L132 160L163 157L194 161L232 158V187H75Z" fill="${a.foundation}" opacity=".62"/>
        <rect class="building-svg-fine" x="107" y="124" width="47" height="66" fill="${a.door}"/>
        <path class="building-svg-micro" d="M122 127V187M139 127V187" fill="none"/>
        <circle cx="145" cy="156" r="3.5" fill="#40372f"/>
      </g>
      <g class="building-svg-roof">
        <path class="building-svg-roof-shape" d="M57 67L246 42V46L57 71Z" fill="${f.roofDark}"/>
        <path class="building-svg-roof-shape" d="M57 71L246 46V76L57 99Z" fill="${f.roofLight}"/>
      </g>`;
  }

  function church(ctx) {
    const { appearance: a, fills: f } = ctx;
    return `<g class="building-svg-shadow"><path d="M52 67H403V211H52Z" transform="translate(7 8)"/></g>
      <g class="building-svg-body">
        <rect class="building-svg-structure" x="346" y="127" width="64" height="71" fill="${f.wall}"/>
        <rect class="building-svg-structure" x="111" y="119" width="257" height="80" fill="${f.wall}"/>
        <rect x="114" y="171" width="251" height="25" fill="${a.foundation}" opacity=".62"/>
        ${sharedWindow(185, 145, 25, 34)}
        ${sharedWindow(268, 145, 25, 34)}
        ${sharedWindow(370, 153, 19, 26, true)}
        <rect class="building-svg-structure" x="55" y="69" width="75" height="130" fill="${f.wall}"/>
        <rect x="58" y="171" width="69" height="25" fill="${a.foundation}" opacity=".62"/>
        <path class="building-svg-detail" d="M72 162Q72 150 84 150H101Q113 150 113 162V199H72Z" fill="${a.door}"/>
        ${sharedWindow(80, 101, 25, 33)}
      </g>
      <g class="building-svg-roof">
        <path class="building-svg-roof-shape" d="M339 113H414L420 133H333Z" fill="${f.roofDark}"/>
        <path class="building-svg-roof-shape" d="M333 133H420L414 147H339Z" fill="${f.roofLight}"/>
        <path class="building-svg-roof-shape" d="M101 78H354L368 112H115Z" fill="${f.roofDark}"/>
        <path class="building-svg-roof-shape" d="M115 112H368L360 131H108Z" fill="${f.roofLight}"/>
        <path class="building-svg-ridge" d="M116 112H367"/>
        <path class="building-svg-roof-shape" d="M92 8L43 76H141Z" fill="${f.roofDark}"/>
        <path class="building-svg-ridge" d="M92 19V68"/>
      </g>
      <g class="building-svg-cross"><rect x="89" y="-4" width="6" height="22"/><rect x="82" y="2" width="20" height="6"/></g>`;
  }

  const SHAPES = Object.freeze({
    "small-cottage": Object.freeze({ viewBox: "0 0 320 220", render: smallCottage }),
    "medium-cottage": Object.freeze({ viewBox: "0 0 340 230", render: mediumCottage }),
    "long-farmhouse": Object.freeze({ viewBox: "0 0 520 230", render: longFarmhouse }),
    barn: Object.freeze({ viewBox: "0 0 390 245", render: barn }),
    shed: Object.freeze({ viewBox: "0 0 300 220", render: shed }),
    church: Object.freeze({ viewBox: "0 0 460 250", render: church })
  });

  function createArt({ definition, instance }) {
    const context = contextFor(definition, instance);
    const shape = SHAPES[context.shape];
    if (!shape) throw new Error(`Unknown building shape: ${context.shape}`);

    const svg = document.createElementNS(SVG_NS, "svg");
    svg.classList.add("building-svg", `building-shape-${context.shape}`, `building-appearance-${context.appearanceId}`);
    svg.dataset.buildingShape = context.shape;
    svg.dataset.buildingAppearance = context.appearanceId;
    svg.setAttribute("viewBox", shape.viewBox);
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    svg.setAttribute("aria-hidden", "true");
    svg.style.setProperty("--building-outline", context.appearance.outline);
    svg.style.setProperty("--building-roof-outline", context.appearance.roofOutline);
    svg.style.setProperty("--building-brace", context.appearance.brace);
    svg.innerHTML = `<defs>${context.defs}</defs>${shape.render(context)}`;
    return svg;
  }

  function hasAppearance(id) {
    return Boolean(APPEARANCES[id]);
  }

  function hasShape(id) {
    return Boolean(SHAPES[id]);
  }

  window.CrossroadsBuildingPresentation = Object.freeze({
    createArt,
    hasAppearance,
    hasShape,
    appearanceIds: Object.freeze(Object.keys(APPEARANCES)),
    shapeIds: Object.freeze(Object.keys(SHAPES))
  });
})();
