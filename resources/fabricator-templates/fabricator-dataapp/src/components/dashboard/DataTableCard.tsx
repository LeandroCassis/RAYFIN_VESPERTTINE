//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { DataGrid } from "@microsoft/fabric-datagrid";
import type { DataTable } from "@microsoft/fabric-visuals-core";

import { useCssTheme } from "@/lib/use-css-theme";

import { ChartCard, type ChartCardCommonProps } from "./ChartCard";
import { TileBody } from "./states";

export interface DataTableCardProps extends ChartCardCommonProps {
    /** Build with `toDataTable(queryTable, columnMetadata)`. */
    data?: DataTable;
    /** Fixed body height in px (default 360). */
    height?: number;
    /** Row height in px. */
    rowHeight?: number;
    /** Rows per page (enables the pager). */
    pageSize?: number;
}

/**
 * Fabric `DataGrid` inside the kit's card shell — sortable, filterable,
 * resizable, and themed from the CSS tokens (light/dark aware). Feed it a
 * `DataTable` from `toDataTable(data.table, columnMetadata)`.
 *
 * @example
 * ```tsx
 * const table = data?.status === "success"
 *   ? toDataTable(data.table, columnMetadata)
 *   : undefined;
 *
 * <DataTableCard
 *   title="Top accounts"
 *   loading={isLoading}
 *   error={error}
 *   data={table}
 *   pageSize={10}
 * />
 * ```
 */
export function DataTableCard({
    title,
    subtitle,
    action,
    className,
    loading,
    error,
    emptyMessage,
    onRetry,
    data,
    height = 360,
    rowHeight,
    pageSize,
}: DataTableCardProps) {
    const theme = useCssTheme();
    const isEmpty = !data || data.rows.length === 0;

    return (
        <ChartCard
            title={title}
            subtitle={subtitle}
            action={action}
            className={className}
        >
            <TileBody
                loading={loading}
                error={error}
                isEmpty={isEmpty}
                height={height}
                emptyMessage={emptyMessage}
                onRetry={onRetry}
            >
                <div
                    className="overflow-auto rounded-xl border border-border"
                    style={{ height }}
                >
                    <DataGrid
                        data={data}
                        theme={theme}
                        rowHeight={rowHeight}
                        pageSize={pageSize}
                    />
                </div>
            </TileBody>
        </ChartCard>
    );
}
