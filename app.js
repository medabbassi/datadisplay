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
   INIT
   ============================================================ */
async function init() {
  try {
    var response = await fetch(CSV_FILE);
    if (!response.ok) throw new Error('Failed to load CSV (' + response.status + ')');

    var csvText = await response.text();
    var parsed  = parseCsv(csvText);
    if (parsed.length < 2) throw new Error('CSV appears to be empty or invalid.');

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
    statusEl.textContent = 'Loaded ' + allRows.length.toLocaleString() + ' rows.';
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
    var key = r[gi] || 'Unknown', amt = parseNumber(r[vi] || 0);
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
  if (rest > 0) top.push(['Other', rest]);
  return { labels: top.map(function (e) { return e[0]; }), values: top.map(function (e) { return e[1]; }) };
}

/* ============================================================
   MONTHLY REVENUE AGGREGATION
   ============================================================ */
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

/* ============================================================
   STOCK MOVEMENT AGGREGATION
   ============================================================ */
function aggregateStockMovement(rows, movIdx) {
  if (movIdx < 0) return { labels: [], values: [] };
  var m = new Map();
  rows.forEach(function (r) {
    var key = (r[movIdx] || 'Unknown').trim();
    m.set(key, (m.get(key) || 0) + 1);
  });
  var entries = Array.from(m.entries()).sort(function (a, b) { return b[1] - a[1]; });
  return { labels: entries.map(function (e) { return e[0]; }), values: entries.map(function (e) { return e[1]; }) };
}

/* ============================================================
   BLOCK 1 -- SUMMARY CARD
   ============================================================ */
function renderSummary(cols, rows) {
  summaryRows.textContent = rows.length.toLocaleString();
  summaryCols.textContent = cols.length;

  var dateIdx   = findColumn(['Date']);
  var regionIdx = findColumn(['Rgion', 'Region']);
  var catIdx    = findColumn(['Catgorie', 'Categorie', 'Category']);

  if (dateIdx >= 0) {
    var dates = rows.map(function (r) { return r[dateIdx]; }).filter(Boolean).sort();
    if (dates.length) summaryDates.textContent = dates[0] + ' to ' + dates[dates.length - 1];
  }
  if (regionIdx >= 0) {
    summaryRegions.textContent = new Set(rows.map(function (r) { return r[regionIdx]; }).filter(Boolean)).size;
  }
  if (catIdx >= 0) {
    summaryCategories.textContent = new Set(rows.map(function (r) { return r[catIdx]; }).filter(Boolean)).size;
  }
}

/* ============================================================
   BLOCK 2 -- SCHEMA TABLE
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
  if (isDate)      { typeName = 'Date';     typeClass = 'type-date'; }
  else if (isID)   { typeName = 'ID';       typeClass = 'type-id'; }
  else if (isNum)  { typeName = 'Number';   typeClass = 'type-number'; }
  else if (uniques < rows.length * 0.05) { typeName = 'Category'; typeClass = 'type-category'; }
  else             { typeName = 'Text';     typeClass = 'type-text'; }

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
   BLOCK 3 -- KPI DASHBOARD
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

  /* rank lists */
  renderRankList(regionList,   topEntries(rows, rgi, ri, 5));
  renderRankList(categoryList, topEntries(rows, cti, ri, 5));

  /* pie charts */
  regionPieChart   = renderChart(regionPieChart,   regionPieCanvas,   'pie',      toPieSeries(aggregateTotals(rows, rgi, ri), 7));
  categoryPieChart = renderChart(categoryPieChart, categoryPieCanvas, 'pie',      toPieSeries(aggregateTotals(rows, cti, ri), 7));

  /* bar charts */
  channelBarChart = renderChart(channelBarChart, channelBarCanvas, 'bar', toPieSeries(aggregateTotals(rows, chi, ri), 10));
  segmentBarChart = renderChart(segmentBarChart, segmentBarCanvas, 'bar', toPieSeries(aggregateTotals(rows, sgi, ri), 10));

  /* monthly revenue line chart */
  var monthly = aggregateMonthly(rows, dti, ri);
  revenueLineChart = renderLineChart(revenueLineChart, revenueLineCanvas, monthly);

  /* stock movement doughnut */
  var stockData = aggregateStockMovement(rows, mvi);
  stockDoughnutChart = renderChart(stockDoughnutChart, stockDoughnutCanvas, 'doughnut', stockData);

  /* top 10 products bar */
  var topProds = toPieSeries(aggregateTotals(rows, pni, ri), 10);
  topProductsBarChart = renderChart(topProductsBarChart, topProductsBarCanvas, 'bar', topProds);
}

/* ============================================================
   CHARTS
   ============================================================ */
function renderChart(chartRef, canvas, type, series) {
  if (!canvas || typeof Chart === 'undefined') return chartRef;
  if (!series.labels.length) { if (chartRef) chartRef.destroy(); return undefined; }

  if (chartRef) {
    chartRef.data.labels = series.labels;
    chartRef.data.datasets[0].data = series.values;
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
        borderColor: isPie ? '#fff' : series.values.map(function (_, i) { return CHART_COLORS[i % CHART_COLORS.length]; }),
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
          labels: { boxWidth: 10, padding: 12, font: { size: 11, family: 'Inter' } }
        }
      },
      scales: type === 'bar' ? {
        x: { ticks: { font: { size: 11, family: 'Inter' } }, grid: { display: false } },
        y: { ticks: { font: { size: 11, family: 'Inter' } }, grid: { color: '#f3f4f6' } }
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
    chartRef.update();
    return chartRef;
  }

  return new Chart(canvas, {
    type: 'line',
    data: {
      labels: series.labels,
      datasets: [{
        label: 'Revenue',
        data: series.values,
        borderColor: '#6366f1',
        backgroundColor: 'rgba(99,102,241,.08)',
        borderWidth: 2.5,
        pointRadius: 3,
        pointBackgroundColor: '#6366f1',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        fill: true,
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: { ticks: { font: { size: 11, family: 'Inter' }, maxRotation: 45 }, grid: { display: false } },
        y: { ticks: { font: { size: 11, family: 'Inter' } }, grid: { color: '#f3f4f6' } }
      }
    }
  });
}

/* ============================================================
   RANK LISTS
   ============================================================ */
function renderRankList(el, items) {
  el.innerHTML = '';
  if (!items.length) { el.innerHTML = '<li>No data.</li>'; return; }
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
   DATA TABLE
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
   SEARCH / FILTER
   ============================================================ */
function filterRows(query) {
  var q = query.trim().toLowerCase();
  if (!q) {
    renderRows(allRows);
    updateDashboard(allRows);
    statusEl.textContent = 'Loaded ' + allRows.length.toLocaleString() + ' rows.';
    return;
  }
  var filtered = allRows.filter(function (r) { return r.join(' ').toLowerCase().indexOf(q) !== -1; });
  renderRows(filtered);
  updateDashboard(filtered);
  statusEl.textContent = 'Showing ' + filtered.length.toLocaleString() + ' of ' + allRows.length.toLocaleString() + ' rows.';
}

var filterTimer;
searchInput.addEventListener('input', function (e) {
  clearTimeout(filterTimer);
  filterTimer = setTimeout(function () { filterRows(e.target.value); }, 150);
});

/* ============================================================
   NAVBAR -- active link tracking + mobile toggle
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
    toggle.addEventListener('click', function () {
      nav.classList.toggle('open');
    });
    nav.addEventListener('click', function (e) {
      if (e.target.closest('.topbar-link')) nav.classList.remove('open');
    });
  }
})();

/* ---- GO ---- */
init();

