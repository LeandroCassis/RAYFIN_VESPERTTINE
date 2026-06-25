//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import type { ColumnDef, DataTable } from "@microsoft/fabric-visuals-core";
import type { CachedQueryResult, QueryTable } from "@microsoft/fabric-app-data";

/**
 * Dictionary keyed by the original column name from the DAX query result.
 * Each value holds the `ColumnDef` metadata for that column.
 */
export type ColumnMetadataMap = Record<string, ColumnDef>;

function resolveTable(input: CachedQueryResult | QueryTable | undefined): QueryTable | undefined {
    if (!input) return undefined;
    // QueryTable has columns+rows; CachedQueryResult has a status discriminant.
    if ("rows" in input && "columns" in input) return input as QueryTable;
    return input.status === "success" ? input.table : undefined;
}

/**
 * Merges a raw SDK query table with static column metadata to produce
 * a `DataTable` that the Fabric `DataGrid` (and the kit's `DataTableCard`)
 * accept directly.
 *
 * @param input - The `CachedQueryResult` or `table` value from the SDK output.
 * @param columnMetadata - Column metadata, either a dictionary keyed by the
 *                         original column name (as exported from the generated
 *                         query barrel) or a positional `ColumnDef[]` where
 *                         entry `i` describes the `i`-th result column (handy
 *                         when hand-authoring).
 * @returns A `DataTable` with enriched `ColumnDef` entries and the original rows.
 *
 * @example
 * ```tsx
 * import { columnMetadata, query } from "@/queries/sales/revenue-by-region";
 * import { toDataTable } from "@/lib/to-data-table";
 *
 * const { data } = useSemanticModelQuery({ connection: "myModel", query });
 *
 * const dataTable = toDataTable(data, columnMetadata);
 * return <DataTableCard title="Revenue by region" data={dataTable} />;
 * ```
 */
export function toDataTable(
    input: CachedQueryResult | QueryTable | undefined,
    columnMetadata: ColumnMetadataMap | ColumnDef[],
): DataTable {
    const table = resolveTable(input);
    if (!table) return { columns: [], rows: [] };

    // Metadata may be a map keyed by the source column name (the generated
    // query barrel exports this) or a positional array when hand-authoring —
    // column i then takes the i-th entry.
    const columns: ColumnDef[] = table.columns.map((col, index) => {
        const meta = Array.isArray(columnMetadata)
            ? columnMetadata[index]
            : columnMetadata[col.name];
        return meta ?? { name: col.name };
    });

    return { columns, rows: table.rows };
}
