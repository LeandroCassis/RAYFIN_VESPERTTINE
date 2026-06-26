//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { useCallback, useMemo } from "react";

import type { FilterField } from "@/components/dashboard/filters/filter-state";
import { useFilterState } from "@/components/dashboard/filters/filter-state";
import { fieldShortName } from "@/lib/filter-field";

/**
 * One drilldown level: a model field and optional row x-key override.
 *
 * @example
 * ```ts
 * const levels: DrilldownLevel[] = [
 *   { field: "Date[Year]" },
 *   { field: "Date[Month]", xKey: "MonthName" },
 * ];
 * ```
 */
export interface DrilldownLevel {
    /** Model field filtered when this level is drilled into. */
    field: FilterField;
    /** Optional row key when it differs from `fieldShortName(field)`. */
    xKey?: string;
}

/**
 * API for coordinating drilldown state with the shared filter model.
 *
 * @example
 * ```tsx
 * const drilldown = useDrilldown("sales-time", [
 *   { field: "Date[Year]" },
 *   { field: "Date[Month]" },
 * ]);
 *
 * <BarChartCard xKey={drilldown.xKey} onSelect={drilldown.drillInto} />
 * ```
 */
export interface DrilldownApi {
    /** Zero-based current level index. */
    level: number;
    /** Current drilldown level metadata. */
    current: DrilldownLevel;
    /** Current model field. */
    field: FilterField;
    /** Current row x-key, defaulting to `fieldShortName(current.field)`. */
    xKey: string;
    /** Drilled-into values, one per completed level. */
    path: Array<string | number>;
    /** True when `drillUp` can move back at least one level. */
    canDrillUp: boolean;
    /** Set an `"in"` filter for the current field and advance one level. */
    drillInto: (value: string | number) => void;
    /** Clear the last completed level's filter and move back one level. */
    drillUp: () => void;
    /** Jump to an absolute level and clear deeper filters. */
    drillTo: (level: number) => void;
}

const EMPTY_LEVEL: DrilldownLevel = { field: "" };

function clampLevel(level: number, maxLevel: number): number {
    return Math.max(0, Math.min(level, maxLevel));
}

/**
 * Coordinate a multi-level chart drilldown with shared filter state.
 *
 * @example
 * ```tsx
 * const drill = useDrilldown("geo", [
 *   { field: "Geography[Country]" },
 *   { field: "Geography[City]" },
 * ]);
 *
 * <BarChartCard xKey={drill.xKey} onSelect={drill.drillInto} />
 * {drill.canDrillUp && <button onClick={drill.drillUp}>Back</button>}
 * ```
 */
export function useDrilldown(
    id: string,
    levels: ReadonlyArray<DrilldownLevel>,
): DrilldownApi {
    const { clearFilter, drillPath, setDrillPath, setFilter } = useFilterState();
    const path = drillPath(id);
    const maxLevel = Math.max(0, levels.length - 1);
    const level = clampLevel(path.length, maxLevel);
    const current = levels[level] ?? EMPTY_LEVEL;
    const xKey = current.xKey ?? fieldShortName(current.field);

    const drillInto = useCallback(
        (value: string | number) => {
            if (levels.length === 0) return;
            const activeLevel = clampLevel(path.length, maxLevel);
            const activeField = levels[activeLevel]?.field;
            if (!activeField) return;

            setFilter({ kind: "in", field: activeField, values: [value] });
            setDrillPath(id, [...path.slice(0, activeLevel), value]);
        },
        [id, levels, maxLevel, path, setDrillPath, setFilter],
    );

    const drillUp = useCallback(() => {
        if (path.length === 0) return;
        const levelToClear = path.length - 1;
        const fieldToClear = levels[levelToClear]?.field;
        if (fieldToClear) clearFilter(fieldToClear);
        setDrillPath(id, path.slice(0, levelToClear));
    }, [clearFilter, id, levels, path, setDrillPath]);

    const drillTo = useCallback(
        (targetLevel: number) => {
            const nextLevel = clampLevel(targetLevel, maxLevel);
            levels.slice(nextLevel).forEach((drillLevel) => {
                clearFilter(drillLevel.field);
            });
            setDrillPath(id, path.slice(0, nextLevel));
        },
        [clearFilter, id, levels, maxLevel, path, setDrillPath],
    );

    return useMemo(
        () => ({
            level,
            current,
            field: current.field,
            xKey,
            path,
            canDrillUp: path.length > 0,
            drillInto,
            drillUp,
            drillTo,
        }),
        [current, drillInto, drillTo, drillUp, level, path, xKey],
    );
}
