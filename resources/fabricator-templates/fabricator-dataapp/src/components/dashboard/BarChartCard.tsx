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

export type BarChartCardProps = ChartCardCommonProps &
    Omit<CartesianChartProps, "type" | "curve"> & {
        /** Convenience alias for `layout="horizontal"` ranked bars. */
        horizontal?: boolean;
    };

/**
 * Grouped, stacked, or ranked bar chart in a titled card. Same declarative API
 * as the other chart cards; set `stacked` to stack the series.
 *
 * @example
 * ```tsx
 * <BarChartCard
 *   title="Top regions"
 *   horizontal
 *   data={rows}
 *   xKey="region"
 *   series={[{ key: "revenue", label: "Revenue" }]}
 *   valueFormat="currency"
 * />
 * ```
 */
export function BarChartCard({
    title,
    subtitle,
    action,
    className,
    loading,
    error,
    emptyMessage,
    onRetry,
    horizontal,
    ...chart
}: BarChartCardProps) {
    const layout = chart.layout ?? (horizontal ? "horizontal" : undefined);

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
                <CartesianChart type="bar" {...chart} layout={layout} />
            </TileBody>
        </ChartCard>
    );
}
