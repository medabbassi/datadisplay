var CSV_FILE = 'ventes_unified_20k.csv';

/* ---- DOM refs ---- */
var statusEl          = document.getElementById('status');
var searchInput       = document.getElementById('searchInput');
var tableHead         = document.getElementById('tableHead');
var tableBody         = document.getElementById('tableBody');
var schemaBody        = document.getElementById('schemaBody');
var metricRows        = document.getElementById('metricRows');
var metricRevenue     = document.getElementById('metricRevenue');
var metricQuantity    = document.getElementById('metricQuantity');
var metricAvgPrice    = document.getElementById('metricAvgPrice');
var metricClients     = document.getElementById('metricClients');
var metricProducts    = document.getElementById('metricProducts');
var metricProfit      = document.getElementById('metricProfit');
var metricMargin      = document.getElementById('metricMargin');
var metricAvgBasket   = document.getElementById('metricAvgBasket');
var metricTotalCost   = document.getElementById('metricTotalCost');
var metricAvgDaily    = document.getElementById('metricAvgDaily');
var metricRegions     = document.getElementById('metricRegions');
var metricChannels    = document.getElementById('metricChannels');
var metricSegments    = document.getElementById('metricSegments');
var metricAvgQty      = document.getElementById('metricAvgQty');
var metricMaxTx       = document.getElementById('metricMaxTx');
var metricMinTx       = document.getElementById('metricMinTx');
var metricMedian      = document.getElementById('metricMedian');
var metricRevenuePerClient = document.getElementById('metricRevenuePerClient');
var regionList        = document.getElementById('regionList');
var categoryList      = document.getElementById('categoryList');
var regionPieCanvas   = document.getElementById('regionPie');
var categoryPieCanvas = document.getElementById('categoryPie');
var channelBarCanvas  = document.getElementById('channelBar');
var segmentBarCanvas  = document.getElementById('segmentBar');
var revenueLineCanvas = document.getElementById('revenueLine');
var stockDoughnutCanvas = document.getElementById('stockDoughnut');
var topProductsBarCanvas = document.getElementById('topProductsBar');

var summaryRows       = document.getElementById('summaryRows');
var summaryCols       = document.getElementById('summaryCols');
var summaryDates      = document.getElementById('summaryDates');
var summaryRegions    = document.getElementById('summaryRegions');
var summaryCategories = document.getElementById('summaryCategories');

/* ---- State ---- */
var headers     = [];
var allRows     = [];
var columnIndex = {};
var regionPieChart, categoryPieChart, channelBarChart, segmentBarChart;
var revenueLineChart, stockDoughnutChart, topProductsBarChart;

var CHART_COLORS = [
  '#6366f1', '#10b981', '#3b82f6', '#f59e0b', '#f43f5e',
  '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6', '#ef4444'
];

/* ============================================================
   DARK MODE TOGGLE
   ============================================================ */
(function () {
  var toggle  = document.getElementById('themeToggle');
  var icon    = document.getElementById('themeIcon');
  var stored  = localStorage.getItem('theme');
  var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    if (icon) {
      icon.className = theme === 'dark' ? 'bi bi-sun-fill' : 'bi bi-moon-fill';
    }
    localStorage.setItem('theme', theme);
    updateChartColors();
  }

  applyTheme(stored || (prefersDark ? 'dark' : 'light'));

  if (toggle) {
    toggle.addEventListener('click', function () {
      var current = document.documentElement.getAttribute('data-theme');
      applyTheme(current === 'dark' ? 'light' : 'dark');
    });
  }
})();

function isDark() {
  return document.documentElement.getAttribute('data-theme') === 'dark';
}

function getGridColor() {
  return isDark() ? '#334155' : '#f3f4f6';
}

function getTickColor() {
  return isDark() ? '#94a3b8' : '#6b7280';
}

function getLineColor() {
  return isDark() ? '#818cf8' : '#6366f1';
}

function getLineFill() {
  return isDark() ? 'rgba(129,140,248,.1)' : 'rgba(99,102,241,.08)';
}

function getPieBorder() {
  return isDark() ? '#1e293b' : '#ffffff';
}

/* ============================================================
   INIT
   ============================================================ */
async function init() {
  try {
    var response = await fetch(CSV_FILE);
    if (!response.ok) throw new Error('Echec du chargement du CSV (' + response.status + ')');

    var csvText = await response.text();
    var parsed  = parseCsv(csvText);
    if (parsed.length < 2) throw new Error('Le CSV semble vide ou invalide.');

    headers = parsed[0];
    allRows = parsed.slice(1).filter(function (row) {
      return row.some(function (cell) { return cell.trim() !== ''; });
    });
    columnIndex = buildColumnIndex(headers);

    renderSummary(headers, allRows);
    renderSchema(headers, allRows);
    renderHeader(headers);
    renderRows(allRows);
    updateDashboard(allRows);
    statusEl.textContent = allRows.length.toLocaleString() + ' lignes chargees.';
  } catch (error) {
    statusEl.textContent = error.message;
  }
}

/* ============================================================
   CSV PARSER
   ============================================================ */
function parseCsv(text) {
  var rows = [], currentRow = [], currentCell = '', inQuotes = false;
  for (var i = 0; i < text.length; i++) {
    var ch = text[i], next = text[i + 1];
    if (ch === '"') {
      if (inQuotes && next === '"') { currentCell += '"'; i++; }
      else { inQuotes = !inQuotes; }
      continue;
    }
    if (ch === ',' && !inQuotes) { currentRow.push(currentCell); currentCell = ''; continue; }
    if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && next === '\n') i++;
      currentRow.push(currentCell); rows.push(currentRow); currentRow = []; currentCell = ''; continue;
    }
    currentCell += ch;
  }
  if (currentCell.length || currentRow.length) { currentRow.push(currentCell); rows.push(currentRow); }
  return rows;
}

/* ============================================================
   HELPERS
   ============================================================ */
function normalizeKey(v) {
  return v.toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}
function buildColumnIndex(cols) {
  var idx = {};
  cols.forEach(function (c, i) { idx[normalizeKey(c)] = i; });
  return idx;
}
function findColumn(names) {
  for (var n = 0; n < names.length; n++) {
    var k = columnIndex[normalizeKey(names[n])];
    if (k !== undefined) return k;
  }
  return -1;
}
function parseNumber(v) {
  var c = v.toString().replace(/\s/g, '').replace(',', '.');
  var n = Number(c);
  return Number.isFinite(n) ? n : 0;
}
function aggregateTotals(rows, gi, vi) {
  if (gi < 0 || vi < 0) return [];
  var m = new Map();
  rows.forEach(function (r) {
    var key = r[gi] || 'Inconnu', amt = parseNumber(r[vi] || 0);
    m.set(key, (m.get(key) || 0) + amt);
  });
  return Array.from(m.entries());
}
function topEntries(rows, gi, vi, limit) {
  return aggregateTotals(rows, gi, vi).sort(function (a, b) { return b[1] - a[1]; }).slice(0, limit);
}
function toPieSeries(entries, limit) {
  var sorted = entries.slice().sort(function (a, b) { return b[1] - a[1]; });
  var top = sorted.slice(0, limit);
  var rest = sorted.slice(limit).reduce(function (s, e) { return s + e[1]; }, 0);
  if (rest > 0) top.push(['Autre', rest]);
  return { labels: top.map(function (e) { return e[0]; }), values: top.map(function (e) { return e[1]; }) };
}

function aggregateMonthly(rows, dateIdx, revenueIdx) {
  if (dateIdx < 0 || revenueIdx < 0) return { labels: [], values: [] };
  var m = new Map();
  rows.forEach(function (r) {
    var d = (r[dateIdx] || '').substring(0, 7);
    if (!d) return;
    m.set(d, (m.get(d) || 0) + parseNumber(r[revenueIdx] || 0));
  });
  var sorted = Array.from(m.entries()).sort(function (a, b) { return a[0].localeCompare(b[0]); });
  return { labels: sorted.map(function (e) { return e[0]; }), values: sorted.map(function (e) { return e[1]; }) };
}

function aggregateStockMovement(rows, movIdx) {
  if (movIdx < 0) return { labels: [], values: [] };
  var m = new Map();
  rows.forEach(function (r) {
    var key = (r[movIdx] || 'Inconnu').trim();
    m.set(key, (m.get(key) || 0) + 1);
  });
  var entries = Array.from(m.entries()).sort(function (a, b) { return b[1] - a[1]; });
  return { labels: entries.map(function (e) { return e[0]; }), values: entries.map(function (e) { return e[1]; }) };
}

/* ============================================================
   BLOC 1 -- RESUME
   ============================================================ */
function renderSummary(cols, rows) {
  summaryRows.textContent = rows.length.toLocaleString();
  summaryCols.textContent = cols.length;

  var dateIdx   = findColumn(['Date']);
  var regionIdx = findColumn(['Rgion', 'Region']);
  var catIdx    = findColumn(['Catgorie', 'Categorie', 'Category']);

  if (dateIdx >= 0) {
    var dates = rows.map(function (r) { return r[dateIdx]; }).filter(Boolean).sort();
    if (dates.length) summaryDates.textContent = dates[0] + ' au ' + dates[dates.length - 1];
  }
  if (regionIdx >= 0) {
    summaryRegions.textContent = new Set(rows.map(function (r) { return r[regionIdx]; }).filter(Boolean)).size;
  }
  if (catIdx >= 0) {
    summaryCategories.textContent = new Set(rows.map(function (r) { return r[catIdx]; }).filter(Boolean)).size;
  }
}

/* ============================================================
   BLOC 2 -- SCHEMA
   ============================================================ */
function detectType(colIdx, rows) {
  var sample = '', nonEmpty = 0, isNum = true, isDate = true, isID = true;
  var dateRe = /^\d{4}-\d{2}-\d{2}/, idRe = /^[A-Z]{2,6}\d{3,}/;

  for (var i = 0; i < Math.min(rows.length, 500); i++) {
    var v = (rows[i][colIdx] || '').trim();
    if (!v) continue;
    nonEmpty++;
    if (!sample) sample = v;
    if (isNum  && isNaN(parseFloat(v.replace(',', '.')))) isNum = false;
    if (isDate && !dateRe.test(v)) isDate = false;
    if (isID   && !idRe.test(v))   isID   = false;
  }

  var fullNonEmpty = rows.filter(function (r) { return (r[colIdx] || '').trim() !== ''; }).length;
  var uniques = new Set(rows.map(function (r) { return r[colIdx]; })).size;

  var typeName, typeClass;
  if (isDate)      { typeName = 'Date';       typeClass = 'type-date'; }
  else if (isID)   { typeName = 'Identifiant'; typeClass = 'type-id'; }
  else if (isNum)  { typeName = 'Nombre';     typeClass = 'type-number'; }
  else if (uniques < rows.length * 0.05) { typeName = 'Categorie'; typeClass = 'type-category'; }
  else             { typeName = 'Texte';      typeClass = 'type-text'; }

  return { typeName: typeName, typeClass: typeClass, sample: sample, uniques: uniques, nonEmpty: fullNonEmpty };
}

function renderSchema(cols, rows) {
  schemaBody.innerHTML = '';
  var frag = document.createDocumentFragment();
  cols.forEach(function (colName, idx) {
    var info = detectType(idx, rows);
    var tr = document.createElement('tr');
    tr.innerHTML =
      '<td>' + (idx + 1) + '</td>' +
      '<td><strong>' + colName + '</strong></td>' +
      '<td><span class="type-badge ' + info.typeClass + '">' + info.typeName + '</span></td>' +
      '<td><code>' + info.sample + '</code></td>' +
      '<td>' + info.uniques.toLocaleString() + '</td>' +
      '<td>' + info.nonEmpty.toLocaleString() + ' / ' + rows.length.toLocaleString() + '</td>';
    frag.appendChild(tr);
  });
  schemaBody.appendChild(frag);
}

/* ============================================================
   BLOC 3 -- KPIs
   ============================================================ */
function updateDashboard(rows) {
  var ri  = findColumn(['Montant', 'Amount']);
  var qi  = findColumn(['Quantit', 'Quantite', 'Quantity']);
  var pi  = findColumn(['PrixUnitaire', 'UnitPrice']);
  var ci  = findColumn(['CotRevient', 'CoutRevient', 'CostPrice', 'UnitCost']);
  var cli = findColumn(['ClientID', 'ClientId']);
  var pri = findColumn(['ProduitID', 'ProductID', 'ProductId']);
  var rgi = findColumn(['Rgion', 'Region']);
  var cti = findColumn(['Catgorie', 'Categorie', 'Category']);
  var chi = findColumn(['CanalVente', 'SalesChannel', 'Channel']);
  var sgi = findColumn(['Segment']);
  var dti = findColumn(['Date']);
  var mvi = findColumn(['MouvementStock', 'StockMovement']);
  var pni = findColumn(['NomProduit', 'ProductName']);

  var revenue  = rows.reduce(function (s, r) { return s + parseNumber(r[ri] || 0); }, 0);
  var quantity = rows.reduce(function (s, r) { return s + parseNumber(r[qi] || 0); }, 0);
  var priceSum = rows.reduce(function (s, r) { return s + parseNumber(r[pi] || 0); }, 0);
  var costSum  = rows.reduce(function (s, r) { return s + parseNumber(r[ci] || 0) * parseNumber(r[qi] || 0); }, 0);
  var profit   = revenue - costSum;
  var margin   = revenue > 0 ? (profit / revenue) * 100 : 0;
  var clients  = cli >= 0 ? new Set(rows.map(function (r) { return r[cli]; }).filter(Boolean)).size : 0;
  var products = pri >= 0 ? new Set(rows.map(function (r) { return r[pri]; }).filter(Boolean)).size : 0;

  metricRows.textContent     = rows.length.toLocaleString();
  metricRevenue.textContent  = revenue.toLocaleString(undefined, { maximumFractionDigits: 2 });
  metricQuantity.textContent = quantity.toLocaleString(undefined, { maximumFractionDigits: 0 });
  metricAvgPrice.textContent = rows.length ? (priceSum / rows.length).toLocaleString(undefined, { maximumFractionDigits: 2 }) : '0';
  metricClients.textContent  = clients.toLocaleString();
  metricProducts.textContent = products.toLocaleString();
  metricProfit.textContent   = profit.toLocaleString(undefined, { maximumFractionDigits: 2 });
  metricMargin.textContent   = margin.toLocaleString(undefined, { maximumFractionDigits: 2 }) + '%';

  /* --- new KPIs --- */
  var avgBasket = rows.length ? revenue / rows.length : 0;
  metricAvgBasket.textContent = avgBasket.toLocaleString(undefined, { maximumFractionDigits: 2 });

  metricTotalCost.textContent = costSum.toLocaleString(undefined, { maximumFractionDigits: 2 });

  var uniqueDays = dti >= 0 ? new Set(rows.map(function (r) { return r[dti]; }).filter(Boolean)).size : 1;
  var avgDaily = uniqueDays ? revenue / uniqueDays : 0;
  metricAvgDaily.textContent = avgDaily.toLocaleString(undefined, { maximumFractionDigits: 2 });

  var regions  = rgi >= 0 ? new Set(rows.map(function (r) { return r[rgi]; }).filter(Boolean)).size : 0;
  metricRegions.textContent = regions.toLocaleString();

  var channels = chi >= 0 ? new Set(rows.map(function (r) { return r[chi]; }).filter(Boolean)).size : 0;
  metricChannels.textContent = channels.toLocaleString();

  var segments = sgi >= 0 ? new Set(rows.map(function (r) { return r[sgi]; }).filter(Boolean)).size : 0;
  metricSegments.textContent = segments.toLocaleString();

  var avgQty = rows.length ? quantity / rows.length : 0;
  metricAvgQty.textContent = avgQty.toLocaleString(undefined, { maximumFractionDigits: 2 });

  var amounts = ri >= 0 ? rows.map(function (r) { return parseNumber(r[ri] || 0); }) : [];
  var maxTx = amounts.length ? Math.max.apply(null, amounts) : 0;
  var minTx = amounts.length ? Math.min.apply(null, amounts) : 0;
  metricMaxTx.textContent = maxTx.toLocaleString(undefined, { maximumFractionDigits: 2 });
  metricMinTx.textContent = minTx.toLocaleString(undefined, { maximumFractionDigits: 2 });

  var sorted = amounts.slice().sort(function (a, b) { return a - b; });
  var mid = Math.floor(sorted.length / 2);
  var median = sorted.length ? (sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2) : 0;
  metricMedian.textContent = median.toLocaleString(undefined, { maximumFractionDigits: 2 });

  var revPerClient = clients > 0 ? revenue / clients : 0;
  metricRevenuePerClient.textContent = revPerClient.toLocaleString(undefined, { maximumFractionDigits: 2 });

  renderRankList(regionList,   topEntries(rows, rgi, ri, 5));
  renderRankList(categoryList, topEntries(rows, cti, ri, 5));

  regionPieChart   = renderChart(regionPieChart,   regionPieCanvas,   'pie',      toPieSeries(aggregateTotals(rows, rgi, ri), 7));
  categoryPieChart = renderChart(categoryPieChart, categoryPieCanvas, 'pie',      toPieSeries(aggregateTotals(rows, cti, ri), 7));
  channelBarChart  = renderChart(channelBarChart,  channelBarCanvas,  'bar',      toPieSeries(aggregateTotals(rows, chi, ri), 10));
  segmentBarChart  = renderChart(segmentBarChart,  segmentBarCanvas,  'bar',      toPieSeries(aggregateTotals(rows, sgi, ri), 10));

  var monthly = aggregateMonthly(rows, dti, ri);
  revenueLineChart = renderLineChart(revenueLineChart, revenueLineCanvas, monthly);

  var stockData = aggregateStockMovement(rows, mvi);
  stockDoughnutChart = renderChart(stockDoughnutChart, stockDoughnutCanvas, 'doughnut', stockData);

  var topProds = toPieSeries(aggregateTotals(rows, pni, ri), 10);
  topProductsBarChart = renderChart(topProductsBarChart, topProductsBarCanvas, 'bar', topProds);
}

/* ============================================================
   GRAPHIQUES
   ============================================================ */
function renderChart(chartRef, canvas, type, series) {
  if (!canvas || typeof Chart === 'undefined') return chartRef;
  if (!series.labels.length) { if (chartRef) chartRef.destroy(); return undefined; }

  if (chartRef) {
    chartRef.data.labels = series.labels;
    chartRef.data.datasets[0].data = series.values;
    chartRef.data.datasets[0].borderColor = (type === 'pie' || type === 'doughnut') ? getPieBorder() : series.values.map(function (_, i) { return CHART_COLORS[i % CHART_COLORS.length]; });
    if (chartRef.options.scales) {
      if (chartRef.options.scales.x) { chartRef.options.scales.x.ticks.color = getTickColor(); }
      if (chartRef.options.scales.y) { chartRef.options.scales.y.ticks.color = getTickColor(); chartRef.options.scales.y.grid.color = getGridColor(); }
    }
    if (chartRef.options.plugins.legend) { chartRef.options.plugins.legend.labels.color = getTickColor(); }
    chartRef.update();
    return chartRef;
  }

  var isPie = (type === 'pie' || type === 'doughnut');

  return new Chart(canvas, {
    type: type,
    data: {
      labels: series.labels,
      datasets: [{
        data: series.values,
        backgroundColor: series.values.map(function (_, i) { return CHART_COLORS[i % CHART_COLORS.length]; }),
        borderColor: isPie ? getPieBorder() : series.values.map(function (_, i) { return CHART_COLORS[i % CHART_COLORS.length]; }),
        borderWidth: isPie ? 2 : 0,
        borderRadius: isPie ? 0 : 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: type === 'bar' ? 'y' : undefined,
      cutout: type === 'doughnut' ? '55%' : undefined,
      plugins: {
        legend: {
          display: isPie,
          position: 'bottom',
          labels: { boxWidth: 10, padding: 12, color: getTickColor(), font: { size: 11, family: 'Inter' } }
        }
      },
      scales: type === 'bar' ? {
        x: { ticks: { color: getTickColor(), font: { size: 11, family: 'Inter' } }, grid: { display: false } },
        y: { ticks: { color: getTickColor(), font: { size: 11, family: 'Inter' } }, grid: { color: getGridColor() } }
      } : undefined
    }
  });
}

function renderLineChart(chartRef, canvas, series) {
  if (!canvas || typeof Chart === 'undefined') return chartRef;
  if (!series.labels.length) { if (chartRef) chartRef.destroy(); return undefined; }

  if (chartRef) {
    chartRef.data.labels = series.labels;
    chartRef.data.datasets[0].data = series.values;
    chartRef.data.datasets[0].borderColor = getLineColor();
    chartRef.data.datasets[0].backgroundColor = getLineFill();
    chartRef.data.datasets[0].pointBackgroundColor = getLineColor();
    chartRef.options.scales.x.ticks.color = getTickColor();
    chartRef.options.scales.y.ticks.color = getTickColor();
    chartRef.options.scales.y.grid.color = getGridColor();
    chartRef.update();
    return chartRef;
  }

  return new Chart(canvas, {
    type: 'line',
    data: {
      labels: series.labels,
      datasets: [{
        label: 'CA',
        data: series.values,
        borderColor: getLineColor(),
        backgroundColor: getLineFill(),
        borderWidth: 2.5,
        pointRadius: 3,
        pointBackgroundColor: getLineColor(),
        pointBorderColor: getPieBorder(),
        pointBorderWidth: 2,
        fill: true,
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: getTickColor(), font: { size: 11, family: 'Inter' }, maxRotation: 45 }, grid: { display: false } },
        y: { ticks: { color: getTickColor(), font: { size: 11, family: 'Inter' } }, grid: { color: getGridColor() } }
      }
    }
  });
}

/* Re-render all existing charts when theme changes */
function updateChartColors() {
  if (!allRows.length) return;
  /* Destroy all chart instances so they get rebuilt with new colors */
  [regionPieChart, categoryPieChart, channelBarChart, segmentBarChart,
   revenueLineChart, stockDoughnutChart, topProductsBarChart].forEach(function (c) {
    if (c) c.destroy();
  });
  regionPieChart = categoryPieChart = channelBarChart = segmentBarChart = undefined;
  revenueLineChart = stockDoughnutChart = topProductsBarChart = undefined;
  updateDashboard(getCurrentRows());
}

function getCurrentRows() {
  var q = searchInput.value.trim().toLowerCase();
  if (!q) return allRows;
  return allRows.filter(function (r) { return r.join(' ').toLowerCase().indexOf(q) !== -1; });
}

/* ============================================================
   CLASSEMENTS
   ============================================================ */
function renderRankList(el, items) {
  el.innerHTML = '';
  if (!items.length) { el.innerHTML = '<li>Aucune donnee.</li>'; return; }
  var frag = document.createDocumentFragment();
  items.forEach(function (entry, i) {
    var li  = document.createElement('li');
    var key = document.createElement('span');
    key.className = 'rank-key';
    key.innerHTML = '<span class="rank-num">' + (i + 1) + '</span>' + entry[0];
    var val = document.createElement('span');
    val.className = 'rank-value';
    val.textContent = entry[1].toLocaleString(undefined, { maximumFractionDigits: 2 });
    li.appendChild(key);
    li.appendChild(val);
    frag.appendChild(li);
  });
  el.appendChild(frag);
}

/* ============================================================
   TABLEAU
   ============================================================ */
function renderHeader(cols) {
  tableHead.innerHTML = '';
  var tr = document.createElement('tr');
  cols.forEach(function (c) {
    var th = document.createElement('th');
    th.setAttribute('scope', 'col');
    th.textContent = c;
    tr.appendChild(th);
  });
  tableHead.appendChild(tr);
}

function renderRows(rows) {
  tableBody.innerHTML = '';
  var frag = document.createDocumentFragment();
  rows.forEach(function (rd) {
    var tr = document.createElement('tr');
    headers.forEach(function (_, j) {
      var td = document.createElement('td');
      td.textContent = rd[j] || '';
      tr.appendChild(td);
    });
    frag.appendChild(tr);
  });
  tableBody.appendChild(frag);
}

/* ============================================================
   RECHERCHE / FILTRE
   ============================================================ */
function filterRows(query) {
  var q = query.trim().toLowerCase();
  if (!q) {
    renderRows(allRows);
    updateDashboard(allRows);
    statusEl.textContent = allRows.length.toLocaleString() + ' lignes chargees.';
    return;
  }
  var filtered = allRows.filter(function (r) { return r.join(' ').toLowerCase().indexOf(q) !== -1; });
  renderRows(filtered);
  updateDashboard(filtered);
  statusEl.textContent = filtered.length.toLocaleString() + ' sur ' + allRows.length.toLocaleString() + ' lignes.';
}

var filterTimer;
searchInput.addEventListener('input', function (e) {
  clearTimeout(filterTimer);
  filterTimer = setTimeout(function () { filterRows(e.target.value); }, 150);
});

/* ============================================================
   NAVBAR -- suivi du lien actif + menu mobile
   ============================================================ */
(function () {
  var links = document.querySelectorAll('.topbar-link');
  var sections = [];

  links.forEach(function (link) {
    var id = link.getAttribute('href');
    if (id && id.startsWith('#')) {
      var el = document.querySelector(id);
      if (el) sections.push({ el: el, link: link });
    }
  });

  function updateActive() {
    var scrollY = window.scrollY + 80;
    var current = sections[0];
    sections.forEach(function (s) {
      if (s.el.offsetTop <= scrollY) current = s;
    });
    links.forEach(function (l) { l.classList.remove('active'); });
    if (current) current.link.classList.add('active');
  }

  window.addEventListener('scroll', updateActive, { passive: true });
  updateActive();

  var toggle = document.getElementById('navToggle');
  var nav    = document.getElementById('topbarNav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () { nav.classList.toggle('open'); });
    nav.addEventListener('click', function (e) {
      if (e.target.closest('.topbar-link')) nav.classList.remove('open');
    });
  }
})();

/* ---- DEMARRAGE ---- */
init();

