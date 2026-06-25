//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { ChartCard } from "./ChartCard";
import {
    CartesianChart,
    type CartesianChartProps,
    type ChartCardCommonProps,
} from "./cartesian";
import { TileBody } from "./states";

export type LineChartCardProps = ChartCardCommonProps &
    Omit<CartesianChartProps, "type">;

/**
 * Time-series line chart in a titled card. Map your DAX rows into an array,
 * point `xKey` at the category/time field, and list `series`. Pass raw query
 * state via `loading` / `error` — the card renders skeleton / error / empty.
 *
 * @example
 * ```tsx
 * <LineChartCard
 *   title="Revenue"
 *   subtitle="Last 12 months"
 *   loading={isLoading}
 *   error={error}
 *   data={rows}
 *   xKey="month"
 *   xFormat={(m) => formatDate(m, "short")}
 *   series={[{ key: "revenue", label: "Revenue", color: "chart-1" }]}
 *   valueFormat="currency"
 * />
 * ```
 */
export function LineChartCard({
    title,
    subtitle,
    action,
    className,
    loading,
    error,
    emptyMessage,
    onRetry,
    ...chart
}: LineChartCardProps) {
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
                isEmpty={!chart.data?.length}
                height={chart.height}
                emptyMessage={emptyMessage}
                onRetry={onRetry}
            >
                <CartesianChart type="line" {...chart} />
            </TileBody>
        </ChartCard>
    );
}
