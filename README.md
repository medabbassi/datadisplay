# CSV Data Display

Static portfolio-style web page that reads `ventes_unified_20k.csv` and represents data in:

- KPI cards (records, revenue, quantity, average unit price, unique clients, unique products, estimated gross profit, gross margin)
- Top lists (regions and categories by revenue)
- Pie charts (revenue share by region and by category)
- Searchable detailed table

## Files

- `index.html`: dashboard layout, Bootswatch Lux + Bootstrap Icons integration, pie-chart canvases
- `styles.css`: flat, solid-color portfolio styling (no gradients)
- `app.js`: CSV loading, parsing, table rendering, metrics, rank lists, pie chart updates
- `index.js`: tiny static server

## Run

```bash
npm start
```

Then open `http://localhost:3000`.

