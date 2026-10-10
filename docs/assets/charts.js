// Small dependency-free chart helpers (SVG + HTML). Colours come from CSS variables.
(function () {
  const NS = "http://www.w3.org/2000/svg";
  const svgEl = (tag, attrs, text) => {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (text != null) n.textContent = text;
    return n;
  };
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  const niceTicks = (lo, hi, n) => {
    const raw = (hi - lo) / n;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw);
    const out = [];
    for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9; v += step) out.push(+v.toFixed(10));
    return out;
  };

  function tooltip(host) {
    const tip = el("div", "tip");
    tip.hidden = true;
    host.appendChild(tip);
    return {
      show(x, y, title, rows) {
        tip.replaceChildren();
        if (title) tip.appendChild(el("div", "", title));
        rows.forEach(([color, value, name]) => {
          const row = el("div");
          if (color) {
            const key = el("i");
            key.style.background = color;
            row.appendChild(key);
          }
          row.appendChild(el("b", "", value));
          if (name) row.appendChild(document.createTextNode(" " + name));
          tip.appendChild(row);
        });
        tip.hidden = false;
        const half = tip.offsetWidth / 2;
        tip.style.left = Math.min(Math.max(x, half), host.clientWidth - half) + "px";
        tip.style.top = y + "px";
      },
      hide() { tip.hidden = true; },
    };
  }

  function legend(host, series) {
    if (series.length < 2) return;
    const box = el("div", "legend");
    series.forEach((s) => {
      const item = el("span");
      const key = el("i");
      key.style.background = s.color;
      if (s.block) key.style.height = "10px";
      item.append(key, document.createTextNode(s.name));
      box.appendChild(item);
    });
    host.appendChild(box);
  }

  function dataTable(host, headers, rows) {
    const details = el("details", "data");
    details.appendChild(el("summary", "", "Show data table"));
    const scroll = el("div", "table-scroll");
    const table = el("table");
    const head = el("tr");
    headers.forEach((h) => head.appendChild(el("th", "", h)));
    table.appendChild(head);
    rows.forEach((r) => {
      const tr = el("tr");
      r.forEach((c) => tr.appendChild(el("td", "", String(c))));
      table.appendChild(tr);
    });
    scroll.appendChild(table);
    details.appendChild(scroll);
    host.appendChild(details);
  }

  // Redraw when the container width changes.
  function responsive(host, draw) {
    let last = 0;
    const run = () => {
      const w = host.clientWidth;
      if (w && w !== last) { last = w; draw(w); }
    };
    new ResizeObserver(run).observe(host);
    run();
  }

  function frame(host, width, height, m, x, y) {
    const svg = svgEl("svg", { viewBox: `0 0 ${width} ${height}`, role: "img" });
    const pw = width - m.l - m.r, ph = height - m.t - m.b;
    const sy = (v) => m.t + ph - ((v - y.domain[0]) / (y.domain[1] - y.domain[0])) * ph;
    niceTicks(y.domain[0], y.domain[1], 5).forEach((t) => {
      svg.appendChild(svgEl("line", { x1: m.l, x2: m.l + pw, y1: sy(t), y2: sy(t), stroke: "var(--grid)" }));
      svg.appendChild(svgEl("text", { x: m.l - 8, y: sy(t) + 4, "text-anchor": "end" }, y.fmt(t)));
    });
    svg.appendChild(svgEl("line", { x1: m.l, x2: m.l + pw, y1: m.t + ph, y2: m.t + ph, stroke: "var(--axis)" }));
    if (y.label) svg.appendChild(svgEl("text", { x: 0, y: 12, class: "axis-title" }, y.label));
    if (x.label) svg.appendChild(svgEl("text", { x: m.l + pw / 2, y: height - 4, "text-anchor": "middle", class: "axis-title" }, x.label));
    return { svg, pw, ph, sy };
  }

  // Lines sharing one x axis and one y axis.
  // opts: { series:[{name,color,pts:[[x,y]]}], x:{domain,label,fmt}, y:{domain,label,fmt},
  //         vline:{x,label}, diagonal, table:{headers, rows} }
  function lineChart(host, opts) {
    host.replaceChildren();
    legend(host, opts.series);
    const box = el("div", "chart");
    host.appendChild(box);
    const tip = tooltip(box);
    const m = { l: 44, r: 16, t: 24, b: 42 };
    const height = opts.height || 300;

    responsive(box, (width) => {
      box.querySelector("svg")?.remove();
      const { svg, pw, ph, sy } = frame(box, width, height, m, opts.x, opts.y);
      const sx = (v) => m.l + ((v - opts.x.domain[0]) / (opts.x.domain[1] - opts.x.domain[0])) * pw;
      niceTicks(opts.x.domain[0], opts.x.domain[1], width < 420 ? 4 : 6).forEach((t) => {
        svg.appendChild(svgEl("text", { x: sx(t), y: m.t + ph + 18, "text-anchor": "middle" }, opts.x.fmt(t)));
      });
      if (opts.diagonal) {
        svg.appendChild(svgEl("line", { x1: sx(0), y1: sy(0), x2: sx(1), y2: sy(1), stroke: "var(--axis)" }));
      }
      if (opts.vline) {
        const vx = sx(opts.vline.x);
        svg.appendChild(svgEl("line", { x1: vx, x2: vx, y1: m.t, y2: m.t + ph, stroke: "var(--text-2)" }));
        const right = vx < m.l + pw / 2;
        svg.appendChild(svgEl("text", { x: vx + (right ? 6 : -6), y: m.t + 10, "text-anchor": right ? "start" : "end", class: "direct" }, opts.vline.label));
      }
      opts.series.forEach((s) => {
        const d = s.pts.map((p, i) => `${i ? "L" : "M"}${sx(p[0]).toFixed(1)},${sy(p[1]).toFixed(1)}`).join("");
        svg.appendChild(svgEl("path", { d, fill: "none", stroke: s.color, "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round" }));
      });
      const cross = svgEl("line", { y1: m.t, y2: m.t + ph, stroke: "var(--axis)", visibility: "hidden" });
      const dots = opts.series.map((s) => svgEl("circle", { r: 4, fill: s.color, stroke: "var(--surface)", "stroke-width": 2, visibility: "hidden" }));
      svg.append(cross, ...dots);

      const base = opts.series[0].pts;
      const hit = svgEl("rect", { x: m.l, y: m.t, width: pw, height: ph, fill: "transparent" });
      hit.addEventListener("pointermove", (e) => {
        const rect = svg.getBoundingClientRect();
        const px = ((e.clientX - rect.left) / rect.width) * width;
        let best = 0;
        base.forEach((p, i) => { if (Math.abs(sx(p[0]) - px) < Math.abs(sx(base[best][0]) - px)) best = i; });
        const bx = sx(base[best][0]);
        cross.setAttribute("x1", bx); cross.setAttribute("x2", bx); cross.setAttribute("visibility", "visible");
        const rows = opts.series.map((s, i) => {
          const p = s.pts[Math.min(best, s.pts.length - 1)];
          dots[i].setAttribute("cx", sx(p[0])); dots[i].setAttribute("cy", sy(p[1])); dots[i].setAttribute("visibility", "visible");
          return [s.color, opts.y.fmt(p[1]), s.name];
        });
        const top = Math.min(...opts.series.map((s) => sy(s.pts[Math.min(best, s.pts.length - 1)][1])));
        tip.show(bx, top, `${opts.x.label}: ${opts.x.fmt(base[best][0])}`, rows);
      });
      hit.addEventListener("pointerleave", () => {
        tip.hide(); cross.setAttribute("visibility", "hidden");
        dots.forEach((d) => d.setAttribute("visibility", "hidden"));
      });
      svg.appendChild(hit);
      box.insertBefore(svg, box.firstChild);
    });
    if (opts.table) dataTable(host, opts.table.headers, opts.table.rows);
  }

  // Grouped columns: one group per category, one column per series.
  // opts: { cats:[label], series:[{name,color,vals}], x:{label}, y:{label,fmt}, table }
  function columnChart(host, opts) {
    host.replaceChildren();
    legend(host, opts.series.map((s) => ({ ...s, block: true })));
    const box = el("div", "chart");
    host.appendChild(box);
    const tip = tooltip(box);
    const m = { l: 44, r: 8, t: 24, b: 42 };
    const height = 280;
    const top = Math.max(...opts.series.flatMap((s) => s.vals));
    const y = { ...opts.y, domain: [0, top * 1.08] };

    responsive(box, (width) => {
      box.querySelector("svg")?.remove();
      const { svg, pw, ph, sy } = frame(box, width, height, m, opts.x, y);
      const band = pw / opts.cats.length;
      const n = opts.series.length;
      const bw = Math.max(3, Math.min(24, (band - 10) / n - 2));
      const skip = Math.ceil(opts.cats.length / Math.max(2, Math.floor(pw / 56)));
      opts.cats.forEach((cat, ci) => {
        const cx = m.l + band * ci + band / 2;
        if (ci % skip === 0) svg.appendChild(svgEl("text", { x: cx, y: m.t + ph + 18, "text-anchor": "middle" }, cat));
        const group = svgEl("g", { tabindex: 0 });
        opts.series.forEach((s, si) => {
          const x0 = cx - (n * (bw + 2) - 2) / 2 + si * (bw + 2);
          const y0 = sy(s.vals[ci]);
          const h = m.t + ph - y0;
          const r = Math.min(4, h, bw / 2);
          const d = `M${x0},${m.t + ph}V${y0 + r}q0,${-r} ${r},${-r}h${bw - 2 * r}q${r},0 ${r},${r}V${m.t + ph}Z`;
          group.appendChild(svgEl("path", { d, fill: s.color }));
        });
        group.appendChild(svgEl("rect", { x: m.l + band * ci, y: m.t, width: band, height: ph, fill: "transparent" }));
        const show = () => {
          group.style.opacity = 0.75;
          tip.show(cx, sy(Math.max(...opts.series.map((s) => s.vals[ci]))), `${opts.x.label}: ${cat}`,
            opts.series.map((s) => [s.color, opts.y.fmt(s.vals[ci]), s.name]));
        };
        const hide = () => { group.style.opacity = 1; tip.hide(); };
        group.addEventListener("pointerenter", show);
        group.addEventListener("focus", show);
        group.addEventListener("pointerleave", hide);
        group.addEventListener("blur", hide);
        svg.appendChild(group);
      });
      box.insertBefore(svg, box.firstChild);
    });
    if (opts.table) dataTable(host, opts.table.headers, opts.table.rows);
  }

  // Horizontal bars with the value at the tip. items: [{label, value, emph}]
  function hbars(host, items, { max, fmt, single }) {
    host.replaceChildren();
    const grid = el("div", "hbars" + (single ? " single" : ""));
    items.forEach((it) => {
      const row = el("div", "row");
      const track = el("div", "track");
      const bar = el("div", "bar" + (it.emph ? " emph" : ""));
      bar.style.width = (it.value / max) * 100 + "%";
      track.appendChild(bar);
      row.append(el("div", "name", it.label), track, el("div", "val", fmt(it.value)));
      grid.appendChild(row);
    });
    host.appendChild(grid);
  }

  window.CKDCharts = { lineChart, columnChart, hbars, dataTable, el };
})();
