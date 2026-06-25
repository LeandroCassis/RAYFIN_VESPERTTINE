//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import {
    PolarAngleAxis,
    RadialBar,
    RadialBarChart,
    ResponsiveContainer,
} from "recharts";

import { resolveColor } from "@/lib/chartTokens";
import { resolveFormat, type ValueFormat } from "@/lib/format";
import { cn } from "@/lib/utils";

import { ChartCard } from "./ChartCard";
import { MAX_CHART_HEIGHT, MIN_CHART_HEIGHT } from "./ChartFrame";
import { type ChartCardCommonProps } from "./cartesian";
import { TileBody } from "./states";

export interface GaugeCardProps extends ChartCardCommonProps {
    /** Current metric value. */
    value?: number;
    /** Target value; when set, progress is `value / target * 100`. */
    target?: number;
    /** Gauge ceiling when `target` is not set (default 100). */
    max?: number;
    /** Format applied to the centered metric value (default `"number"`). */
    valueFormat?: ValueFormat;
    /** Threshold color stops keyed by percent; greatest `at <= pct` wins. */
    thresholds?: ReadonlyArray<{ at: number; color: string }>;
    /** Small caption below the value (default derives from target/max). */
    label?: string;
    /** Fixed plot height in px; omit for responsive aspect sizing. */
    height?: number;
    /** Width/height ratio used when `height` is unset (default 1.9). */
    aspect?: number;
    /** Gauge arc start angle in degrees (default 210). */
    startAngle?: number;
    /** Gauge arc end angle in degrees (default -30). */
    endAngle?: number;
}

/**
 * Single-metric radial gauge for progress toward a target or fixed maximum.
 * The value is rendered as a KPI-sized center label over a themed Recharts
 * `RadialBarChart`, while loading / empty / error states are handled by the
 * standard chart card shell.
 *
 * @example
 * ```tsx
 * <GaugeCard
 *   title="Quota attainment"
 *   value={72}
 *   target={100}
 *   valueFormat="percent"
 * />
 * ```
 */
export function GaugeCard({
    title,
    subtitle,
    action,
    className,
    loading,
    error,
    emptyMessage,
    onRetry,
    value,
    target,
    max,
    valueFormat,
    thresholds,
    label,
    height,
    aspect,
    startAngle = 210,
    endAngle = -30,
}: GaugeCardProps) {
    const format = resolveFormat(valueFormat);
    const numericValue = Number(value);
    const safeValue = Number.isFinite(numericValue) ? numericValue : Number.NaN;
    const numericTarget = Number(target);
    const safeTarget =
        target != null && Number.isFinite(numericTarget) && numericTarget !== 0
            ? numericTarget
            : undefined;
    const numericMax = Number(max);
    const safeMax =
        max != null && Number.isFinite(numericMax) && numericMax !== 0
            ? numericMax
            : 100;
    const denominator = safeTarget ?? safeMax;
    const ratio =
        Number.isFinite(safeValue) && Number.isFinite(denominator)
            ? safeValue / denominator
            : 0;
    const rawPct = ratio * 100;
    const pct = Number.isFinite(rawPct) ? Math.min(Math.max(rawPct, 0), 100) : 0;
    const threshold = thresholds?.reduce<
        { at: number; color: string } | undefined
    >((best, entry) => {
        const at = Number(entry.at);
        if (!Number.isFinite(at) || at > pct) return best;
        if (!best || at >= best.at) return { at, color: entry.color };
        return best;
    }, undefined);
    const color = resolveColor(
        threshold?.color ?? thresholds?.[0]?.color ?? "brand",
        0,
    );
    const caption =
        safeTarget != null
            ? `${Math.round(Number.isFinite(rawPct) ? rawPct : 0)}% of target`
            : (label ?? `of ${safeMax}`);
    const data = [{ value: pct }];

    return (
        <ChartCard
            title={title}
            subtitle={subtitle}
            action={action}
            className={cn(className)}
        >
            <TileBody
                loading={loading}
                error={error}
                isEmpty={value == null}
                height={height}
                emptyMessage={emptyMessage}
                onRetry={onRetry}
            >
                <div
                    className="relative mx-auto w-full"
                    style={
                        height != null
                            ? { height, maxWidth: height }
                            : {
                                  aspectRatio: String(aspect ?? 1.9),
                                  minHeight: MIN_CHART_HEIGHT,
                                  maxHeight: MAX_CHART_HEIGHT,
                              }
                    }
                >
                    <ResponsiveContainer width="100%" height="100%">
                        <RadialBarChart
                            data={data}
                            innerRadius="70%"
                            outerRadius="100%"
                            startAngle={startAngle}
                            endAngle={endAngle}
                            barSize={14}
                        >
                            <PolarAngleAxis
                                type="number"
                                domain={[0, 100]}
                                angleAxisId={0}
                                tick={false}
                            />
                            <RadialBar
                                background={{ fill: "var(--color-chart-track)" }}
                                dataKey="value"
                                cornerRadius={8}
                                fill={color}
                                isAnimationActive={false}
                            />
                        </RadialBarChart>
                    </ResponsiveContainer>
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                        <span className="block max-w-full truncate font-numeric text-[28px] font-semibold leading-none tracking-tight text-foreground tabular-nums">
                            {format(safeValue)}
                        </span>
                        <span className="mt-1 block max-w-full truncate font-numeric text-sm text-muted-foreground tabular-nums">
                            {caption}
                        </span>
                    </div>
                </div>
            </TileBody>
        </ChartCard>
    );
}
