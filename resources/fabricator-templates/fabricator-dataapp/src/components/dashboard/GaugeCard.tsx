//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { motion, useReducedMotion } from "framer-motion";

import { resolveColor } from "@/lib/chartTokens";
import { resolveFormat, type ValueFormat } from "@/lib/format";
import { cn } from "@/lib/utils";

import { ChartCard } from "./ChartCard";
import { MAX_CHART_HEIGHT, MIN_CHART_HEIGHT } from "./ChartFrame";
import { AnimatedNumber } from "./AnimatedNumber";
import { type ChartCardCommonProps } from "./cartesian";
import { arcPath, compassToRadians } from "./charts/arc";
import { useChartSize } from "./charts/useChartSize";
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

/** Measured custom-SVG radial gauge: a background track + a value arc. */
function GaugeArc({
    pct,
    color,
    startAngle,
    endAngle,
}: {
    pct: number;
    color: string;
    startAngle: number;
    endAngle: number;
}) {
    const { ref, size } = useChartSize();
    const reduce = useReducedMotion();
    const width = size.width;
    const height = size.height;
    const a0 = compassToRadians(startAngle);
    const a1 = compassToRadians(endAngle);
    const aValue = a0 + (Math.min(Math.max(pct, 0), 100) / 100) * (a1 - a0);
    const radius = Math.max(0, Math.min(width / 1.85, height / 1.5));
    const band = Math.min(Math.max(radius * 0.16, 10), 22);
    const inner = Math.max(0, radius - band);
    const cx = width / 2;
    const cy = height / 2 + radius * 0.22;

    return (
        <div ref={ref} className="absolute inset-0">
            {width > 0 && height > 0 && radius > 0 && (
                <svg width={width} height={height} role="img">
                    <g transform={`translate(${cx},${cy})`}>
                        <path
                            d={arcPath({
                                innerRadius: inner,
                                outerRadius: radius,
                                startAngle: a0,
                                endAngle: a1,
                                cornerRadius: band / 2,
                            })}
                            fill="var(--color-chart-track)"
                        />
                        {pct > 0 && (
                            <motion.path
                                d={arcPath({
                                    innerRadius: inner,
                                    outerRadius: radius,
                                    startAngle: a0,
                                    endAngle: aValue,
                                    cornerRadius: band / 2,
                                })}
                                fill={color}
                                initial={reduce ? false : { opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ duration: 0.5 }}
                            />
                        )}
                    </g>
                </svg>
            )}
        </div>
    );
}

/**
 * Single-metric radial gauge for progress toward a target or fixed maximum.
 * The value is rendered as a KPI-sized center label over a fully custom SVG arc
 * (no charting library), while loading / empty / error states are handled by
 * the standard chart card shell.
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
                    <GaugeArc
                        pct={pct}
                        color={color}
                        startAngle={startAngle}
                        endAngle={endAngle}
                    />
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                        <span className="block max-w-full truncate font-numeric text-[28px] font-semibold leading-none tracking-tight text-foreground tabular-nums">
                            {Number.isFinite(safeValue) ? (
                                <AnimatedNumber value={safeValue} format={format} />
                            ) : (
                                format(safeValue)
                            )}
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
