import { useState, useEffect } from "react";
import { toast } from "sonner";
import { SegmentType } from "@/components/reports/types";

export interface SelectedReportItem {
    id: string; // Unique ID (e.g., "energy-flow-chart")
    segmentType: SegmentType; // Maps to report segments (e.g., "energy_flow")
    label: string;
    timestamp: number;
}

const STORAGE_KEY = "greencalc_report_selection";

// Simple event bus for cross-component updates without context provider wrapping
const listeners = new Set<() => void>();

function notifyListeners() {
    listeners.forEach((listener) => listener());
}

export function useReportSelection() {
    const [selectedItems, setSelectedItems] = useState<SelectedReportItem[]>([]);

    // Load from local storage on mount
    useEffect(() => {
        const loadItems = () => {
            try {
                const stored = localStorage.getItem(STORAGE_KEY);
                if (stored) {
                    setSelectedItems(JSON.parse(stored));
                }
            } catch (e) {
                console.error("Failed to load report selection", e);
            }
        };

        loadItems();
        listeners.add(loadItems);
        return () => {
            listeners.delete(loadItems);
        };
    }, []);

    const toggleItem = (id: string, segmentType: SegmentType, label: string) => {
        let newItems: SelectedReportItem[];
        const exists = selectedItems.some((item) => item.id === id);

        if (exists) {
            newItems = selectedItems.filter((item) => item.id !== id);
            toast.info(`Removed "${label}" from report`);
        } else {
            newItems = [
                ...selectedItems,
                { id, segmentType, label, timestamp: Date.now() },
            ];
            toast.success(`Added "${label}" to report`);
        }

        setSelectedItems(newItems);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newItems));
        notifyListeners();
    };

    const isSelected = (id: string) => {
        return selectedItems.some((item) => item.id === id);
    };

    const clearSelection = () => {
        setSelectedItems([]);
        localStorage.removeItem(STORAGE_KEY);
        notifyListeners();
    };

    return {
        selectedItems,
        toggleItem,
        isSelected,
        clearSelection,
    };
}
