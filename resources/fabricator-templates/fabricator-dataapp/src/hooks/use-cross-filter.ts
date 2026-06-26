//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { useCallback, useMemo } from "react";

import type { FilterField } from "@/components/dashboard/filters/filter-state";
import { useFilterState } from "@/components/dashboard/filters/filter-state";

/**
 * Props for wiring a chart card into the shared cross-filter state.
 *
 * @example
 * ```tsx
 * const crossFilter = useCrossFilter("Product[Category]");
 *
 * <BarChartCard {...crossFilter} data={rows} xKey="Category" series={[{ key: "Sales" }]} />
 * ```
 */
export interface CrossFilterProps {
    /** Currently selected categorical values for the field. */
    selectedKeys: Array<string | number>;
    /** Toggle one value when a chart mark is clicked. */
    onSelect: (value: string | number) => void;
    /** True when unselected marks should be visually dimmed. */
    dimUnselected: boolean;
}

/**
 * Return props to spread onto an interactive chart card.
 *
 * @example
 * ```tsx
 * const categoryFilter = useCrossFilter("Product[Category]");
 *
 * <BarChartCard
 *   {...categoryFilter}
 *   data={rows}
 *   xKey="Category"
 *   series={[{ key: "Revenue" }]}
 * />
 * ```
 */
export function useCrossFilter(field: FilterField): CrossFilterProps {
    const { getSelection, toggleValue } = useFilterState();
    const selection = getSelection(field);
    const selectedKeys = useMemo(
        () => (selection?.kind === "in" ? selection.values : []),
        [selection],
    );
    const onSelect = useCallback(
        (value: string | number) => {
            toggleValue(field, value);
        },
        [field, toggleValue],
    );

    return {
        selectedKeys,
        onSelect,
        dimUnselected: selectedKeys.length > 0,
    };
}
