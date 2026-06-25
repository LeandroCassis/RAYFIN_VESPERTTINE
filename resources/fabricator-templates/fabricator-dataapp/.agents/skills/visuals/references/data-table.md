# DataTable — the `DataGrid` data shape

The Fabric `DataGrid` (and the kit's `DataTableCard`, which wraps it) takes a
`data` prop of type `DataTable` — a row-major tabular JSON format. Build one from
a DAX result with the kit helper `toDataTable(table, columnMetadata)`; only hand-
author a `DataTable` for static/derived rows.

```tsx
import { DataTableCard, toDataTable } from "@/components/dashboard";

// From a query result (preferred):
const data = toDataTable(result, [
  { name: "month", displayName: "Month" },
  { name: "revenue", displayName: "Revenue", format: "$#,0.00" },
]);

// …or a literal DataTable:
const literal = {
  columns: [
    { name: "month", displayName: "Month" },
    { name: "revenue", displayName: "Revenue", format: "$#,0.00" },
  ],
  rows: [
    ["January", 12500],
    ["February", 18300],
    ["March", 15700],
  ],
};

<DataTableCard title="Revenue by month" data={data} />
```

> Charts do **not** use `DataTable` — they take a plain array of row objects from
> `toChartData(table)`. `DataTable` is the table/grid shape only.

## Props

Refer to the package README.md for detailed information about the component api including exported types, functions, and properties.

## Schema

```json
{
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "data-table.schema.json",
    "$comment": "JSON Schema for the DataTable interface defined in types.ts. Enforces the row-major tabular format consumed by DataGrid / DataTableCard.",
    "title": "DataTable",
    "description": "Structured tabular data input consumed by DataGrid / DataTableCard. This is a JSON format, not an Arrow format. If Arrow format is used, it is the consumer's responsibility to convert it to this format.",
    "type": "object",
    "required": [
        "columns",
        "rows"
    ],
    "additionalProperties": false,
    "properties": {
        "$schema": {
            "description": "Optional reference to this JSON Schema for editor validation and intellisense.",
            "type": "string"
        },
        "columns": {
            "description": "Column definitions describing each field.",
            "type": "array",
            "items": {
                "$ref": "#/$defs/ColumnDef"
            }
        },
        "rows": {
            "$comment": "Row-major data. Each inner array corresponds to one row; values align positionally with `columns`. For example, 3 items in `columns` means each row can have up to 3 items.",
            "description": "Row-major data. Column values are provided in the order of the column definitions. null values for columns are allowed.",
            "type": "array",
            "items": {
                "type": "array",
                "$comment": "Each cell value can be any JSON-representable type (string, number, boolean, null, object, array). The schema does not constrain cell types because the TypeScript source uses `unknown`.",
                "items": {}
            }
        }
    },
    "$defs": {
        "ColumnDef": {
            "title": "ColumnDef",
            "description": "Column definition describing a single data field.",
            "type": "object",
            "required": [
                "name"
            ],
            "additionalProperties": false,
            "properties": {
                "name": {
                    "description": "Slug identifier for the column, used to reference the field (e.g. as a DataGrid column id).",
                    "type": "string"
                },
                "displayName": {
                    "description": "Display name to represent field's data in output visualization/table, e.g., in axis titles, legend titles, column headers.",
                    "type": "string"
                },
                "format": {
                    "$comment": "A VBA/ECMA-376 format string (e.g., `#,##0.00`, `0.00%`, and `mm/dd/yyyy`).  May be converted to another representation (e.g., D3.js format string) by leaf components as needed.",
                    "description": "A VBA/ECMA-376 format string for formatting data for output, e.g., in tooltips, data labels, DataGrid table cells.",
                    "type": "string"
                }
            }
        }
    }
}
```