"use client";

import { useMemo } from "react";
import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { isBefore, isSameDay, startOfDay, parseISO } from "date-fns";
import { DateRange } from "react-day-picker";
import { OptionItem } from "@/src/services/optionSetService";
import { getStatusColor, isAtOrAfterStatus, isStatus, OVERDUE_COLOR, paletteStyle } from "./statusPalette";

interface TaskStatsProps {
    tasks: any[];
    statusOptions?: OptionItem[];
    roleLabel?: string;
    dateRange?: DateRange;
    tabs?: { statuses: string[]; filterMode?: 'POSTING_ONLY' | 'EXCLUDE_POSTING' | 'DEFAULT' }[];
}

interface StatCard {
    label: string;
    value: number;
    percent: number;
    className?: string;
    style?: CSSProperties;
}

export function TaskStats({ tasks, statusOptions = [], roleLabel = "Team Member", dateRange, tabs = [] }: TaskStatsProps) {
    const stats = useMemo(() => {
        const today = startOfDay(new Date()); // 00:00:00 today
        const isVideoEditor = roleLabel.toLowerCase().includes("video");
        const isDesigner = roleLabel.toLowerCase().includes("design");
        const completedLabel = "Done";
        const progressStatus = isVideoEditor ? "Edit" : isDesigner ? "Design" : null;
        const progressLabel = isVideoEditor ? "Edited" : isDesigner ? "Designed" : null;
        const selectedDate = dateRange?.from ? startOfDay(dateRange.from) : null;
        const unitTabs = tabs.length > 0 ? tabs : [{ statuses: ["Approved"], filterMode: "DEFAULT" as const }];

        const units = tasks.flatMap((task) => unitTabs.flatMap((tab) => {
            const mode = tab.filterMode || "DEFAULT";
            const relevantDate = mode === "POSTING_ONLY" ? task.postingDate : task.dueDate;
            const finalStatus = tab.statuses[tab.statuses.length - 1];

            if (!relevantDate || !finalStatus) return [];

            const unitDate = startOfDay(parseISO(relevantDate));
            if (selectedDate && !isSameDay(unitDate, selectedDate)) return [];

            return [{ task, status: task.status, date: unitDate, finalStatus, tab }];
        }));

        const total = units.length || 0;

        const completedUnits = units.filter(unit =>
            isAtOrAfterStatus(unit.status, unit.finalStatus, statusOptions)
        );
        const progressUnits = progressStatus
            ? units.filter(unit =>
                unit.tab.statuses.some(status => isStatus(status, progressStatus)) &&
                isAtOrAfterStatus(unit.status, progressStatus, statusOptions)
            )
            : [];
        const activeUnits = units.filter(unit =>
            !isAtOrAfterStatus(unit.status, unit.finalStatus, statusOptions)
        );

        const overdueTasks = activeUnits.filter(unit => isBefore(unit.date, today));

        const pendingTasks = activeUnits.filter(unit => !isBefore(unit.date, today));

        // 4. Return Cards
        const cards: StatCard[] = [
            {
                label: "Total Tasks",
                value: total,
                percent: 100,
                className: "bg-slate-50 text-slate-700 border-slate-200"
            },
        ];

        if (progressStatus && progressLabel) {
            cards.push({
                label: progressLabel,
                value: progressUnits.length,
                percent: total ? Math.round((progressUnits.length / total) * 100) : 0,
                style: paletteStyle(getStatusColor(progressStatus, statusOptions, isVideoEditor ? "#8b5cf6" : "#6366f1"))
            });
        }

        cards.push(
            {
                label: completedLabel,
                value: completedUnits.length,
                percent: total ? Math.round((completedUnits.length / total) * 100) : 0,
                style: paletteStyle(getStatusColor(completedLabel, statusOptions, "#3b82f6"))
            },
            {
                label: "Pending", // Includes Today + Future
                value: pendingTasks.length,
                percent: total ? Math.round((pendingTasks.length / total) * 100) : 0,
                style: paletteStyle(getStatusColor("Pending", statusOptions, "#f59e0b"))
            },
            // {
            //     label: "Today", // Just a highlight, part of Pending
            //     value: todayTasks.length, // Should be 1
            //     percent: total ? Math.round((todayTasks.length / total) * 100) : 0,
            //     color: "bg-orange-50 text-orange-700 border-orange-200"
            // },

            {
                label: "Overdue",
                value: overdueTasks.length, // Should be 1
                percent: total ? Math.round((overdueTasks.length / total) * 100) : 0,
                style: paletteStyle(OVERDUE_COLOR)
            },

        );

        return cards;
    }, [tasks, roleLabel, statusOptions, dateRange, tabs]);

    const gridLayoutClass = useMemo(() => {
        switch (stats.length) {
            case 1:
                return "grid-cols-1";
            case 2:
                return "grid-cols-2";
            case 3:
                return "grid-cols-2 md:grid-cols-3 xl:grid-cols-3";
            case 4:
                return "grid-cols-2 md:grid-cols-4 xl:grid-cols-4";
            case 5:
                return "grid-cols-2 md:grid-cols-3 xl:grid-cols-5";
            case 6:
                return "grid-cols-2 md:grid-cols-3 xl:grid-cols-6";
            default:
                return "grid-cols-2 md:grid-cols-4 xl:grid-cols-4";
        }
    }, [stats.length]);

    return (
        <div className={cn(
            "grid gap-3 w-full",
            gridLayoutClass
        )}>
            {stats.map((stat, i) => (
                <div
                    key={i}
                    className={cn("p-3 rounded-xl border flex justify-between h-20 shadow-sm", stat.className)}
                    style={stat.style}
                >
                    <div className="flex flex-col justify-between items-start">
                        <span className="text-[10px] uppercase font-bold tracking-wider opacity-80">{stat.label}</span>
                        <span className="text-3xl font-black leading-none mt-1">{stat.value}</span>
                    </div>
                    <div className="flex flex-col justify-end items-end">
                        <span className="text-3xl font-medium leading-none mt-1 opacity-60">{stat.percent}%</span>
                    </div>
                </div>
            ))}
        </div>
    );
}
