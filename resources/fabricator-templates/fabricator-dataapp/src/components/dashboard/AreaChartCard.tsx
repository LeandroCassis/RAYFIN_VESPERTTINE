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

export type AreaChartCardProps = ChartCardCommonProps &
    Omit<CartesianChartProps, "type">;

/**
 * Filled time-series area chart (single or stacked) in a titled card.
 * Same declarative API as `LineChartCard`; set `stacked` to stack series.
 *
 * @example
 * ```tsx
 * <AreaChartCard
 *   title="Traffic"
 *   data={rows}
 *   xKey="day"
 *   stacked
 *   series={[
 *     { key: "organic", label: "Organic", color: "chart-1" },
 *     { key: "paid", label: "Paid", color: "chart-4" },
 *   ]}
 *   valueFormat="compact"
 * />
 * ```
 */
export function AreaChartCard({
    title,
    subtitle,
    action,
    className,
    loading,
    error,
    emptyMessage,
    onRetry,
    ...chart
}: AreaChartCardProps) {
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
                <CartesianChart type="area" {...chart} />
            </TileBody>
        </ChartCard>
    );
}
