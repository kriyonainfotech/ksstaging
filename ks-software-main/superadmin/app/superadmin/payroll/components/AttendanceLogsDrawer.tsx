"use client";

import { useEffect, useMemo } from "react";
import { 
    Sheet, 
    SheetContent, 
    SheetHeader, 
    SheetTitle 
} from "@/components/ui/sheet";
import { useAppDispatch, useAppSelector } from "@/src/redux/hooks";
import { fetchAttendanceLogs } from "@/src/redux/slices/salarySlice";
import { RootState } from "@/src/redux/store";
import { format } from "date-fns";
import { 
    Clock, 
    CheckCircle2, 
    AlertCircle, 
    Loader2,
    CalendarDays
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
// import { ScrollArea } from "@/components/ui/scroll-area";

interface AttendanceLogsDrawerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    user: any;
    month: number;
    year: number;
}

export function AttendanceLogsDrawer({ open, onOpenChange, user, month, year }: AttendanceLogsDrawerProps) {
    const dispatch = useAppDispatch();
    const { attendanceLogs, isLoading } = useAppSelector((state: RootState) => state.salary);

    useEffect(() => {
        if (open && user) {
            dispatch(fetchAttendanceLogs({ 
                userId: user._id, 
                params: { month, year } 
            }));
        }
    }, [open, user, month, year, dispatch]);

    const fullMonthLogs = useMemo(() => {
        if (!user) return [];
        
        // Generate all dates for the given month and year
        const daysInMonth = new Date(year, month, 0).getDate();
        const logsMap = new Map<string, any>();
        
        attendanceLogs.forEach((log: any) => {
            const dateStr = format(new Date(log.date), "yyyy-MM-dd");
            logsMap.set(dateStr, log);
        });

        const list = [];
        for (let d = 1; d <= daysInMonth; d++) {
            const date = new Date(year, month - 1, d);
            const dateStr = format(date, "yyyy-MM-dd");
            
            const existingLog = logsMap.get(dateStr);
            if (existingLog) {
                list.push({
                    ...existingLog,
                    formattedDate: date,
                });
            } else {
                const isSunday = date.getDay() === 0;
                list.push({
                    _id: `fallback-${d}`,
                    date: date.toISOString(),
                    status: isSunday ? "Sunday" : "Absent",
                    isFallback: true,
                    formattedDate: date,
                });
            }
        }
        return list;
    }, [attendanceLogs, month, year, user]);

    const getStatusIcon = (status: string) => {
        switch (status) {
            case "Full Day":
                return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
            case "Half Day":
                return <Clock className="h-4 w-4 text-amber-500" />;
            case "Sunday":
                return <CalendarDays className="h-4 w-4 text-blue-500" />;
            case "Leave":
                return <AlertCircle className="h-4 w-4 text-rose-500" />;
            default:
                return <AlertCircle className="h-4 w-4 text-muted-foreground/50" />;
        }
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="sm:max-w-md p-0 flex flex-col border-l shadow-2xl">
                <div className="bg-card border-b p-6">
                    <SheetHeader>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="bg-primary/10 p-2.5 rounded-md">
                                <CalendarDays className="h-5 w-5 text-primary" />
                            </div>
                            <SheetTitle className="text-xl font-bold text-foreground">
                                Attendance Logs
                            </SheetTitle>
                        </div>
                    </SheetHeader>
                    {user && (
                        <div className="flex items-center gap-3 bg-muted/30 p-3 rounded-md border border-border">
                            <div className="flex flex-col">
                                <span className="text-base font-bold text-foreground">{user.name}</span>
                                <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
                                    {format(new Date(year, month - 1), "MMMM yyyy")}
                                </span>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent hover:scrollbar-thumb-primary/40 transition-colors">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center h-64 gap-3">
                            <Loader2 className="h-6 w-6 text-primary animate-spin" />
                            <p className="text-muted-foreground text-sm font-medium">Fetching logs...</p>
                        </div>
                    ) : fullMonthLogs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-center">
                            <AlertCircle className="h-12 w-12 text-slate-200 mb-4" />
                            <p className="text-slate-400 font-medium">No attendance records found for this period.</p>
                        </div>
                    ) : (
                        <div className="space-y-4 pb-10">
                            {fullMonthLogs.map((log: any) => {
                                const isSunday = log.status === "Sunday";
                                const isAbsent = log.status === "Absent";
                                const isLeave = log.status === "Leave";
                                const isFullDay = log.status === "Full Day";
                                const isHalfDay = log.status === "Half Day";

                                let bgClass = "hover:bg-muted/30";
                                let borderClass = "border-border";
                                if (isFullDay) { borderClass = "border-emerald-100/50 dark:border-emerald-950/50"; bgClass = "bg-emerald-50/10 dark:bg-emerald-950/5 hover:bg-emerald-50/20"; }
                                else if (isHalfDay) { borderClass = "border-amber-100/50 dark:border-amber-950/50"; bgClass = "bg-amber-50/10 dark:bg-amber-950/5 hover:bg-amber-50/20"; }
                                else if (isLeave) { borderClass = "border-rose-100/50 dark:border-rose-950/50"; bgClass = "bg-rose-50/10 dark:bg-rose-950/5 hover:bg-rose-50/20"; }
                                else if (isSunday) { borderClass = "border-blue-100/50 dark:border-blue-950/50"; bgClass = "bg-blue-50/10 dark:bg-blue-950/5 hover:bg-blue-50/20 opacity-80"; }
                                else if (isAbsent) { borderClass = "border-border/50"; bgClass = "bg-muted/10 opacity-70 hover:opacity-100"; }

                                return (
                                    <div 
                                        key={log._id} 
                                        className={`flex items-center justify-between p-3 rounded-md border ${borderClass} ${bgClass} transition-all group`}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="text-center w-10 flex flex-col items-center">
                                                <span className="text-[10px] font-bold text-muted-foreground uppercase leading-none mb-1">
                                                    {format(new Date(log.date), "EEE")}
                                                </span>
                                                <span className="text-lg font-bold text-foreground leading-none">
                                                    {format(new Date(log.date), "dd")}
                                                </span>
                                            </div>
                                            <div className="w-[1px] h-8 bg-border" />
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-2">
                                                    {getStatusIcon(log.status)}
                                                    <span className="font-bold text-foreground text-sm">
                                                        {log.status === "Sunday" ? "Weekly Off" : log.status}
                                                    </span>
                                                </div>
                                                <div className="text-[10px] text-muted-foreground font-semibold mt-0.5 ml-6">
                                                    {log.startTime ? (
                                                        <span>
                                                            {log.startTime} - {log.endTime || "In Progress"}
                                                            {log.breakHours > 0 && <span className="text-muted-foreground/60 ml-2">({log.breakHours}h Break)</span>}
                                                        </span>
                                                    ) : (
                                                        <span className="text-muted-foreground/60">
                                                            {isSunday ? "Sunday Holiday" : isLeave ? "Leave Marked" : "No clock-in recorded"}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <Badge 
                                            variant="secondary" 
                                            className={`font-bold transition-colors ${
                                                isFullDay ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" :
                                                isHalfDay ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" :
                                                isLeave ? "bg-rose-500/10 text-rose-600 dark:text-rose-400" :
                                                isSunday ? "bg-blue-500/10 text-blue-600 dark:text-blue-400" :
                                                "bg-muted text-muted-foreground"
                                            }`}
                                        >
                                            {log.totalHours ? `${log.totalHours} hrs` : "-"}
                                        </Badge>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
}
