"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAppDispatch, useAppSelector } from "@/src/redux/hooks";
import {
    fetchPayrollStats,
    fetchPayrollList,
    finalizePayrollRun,
    generatePayrollRun,
    setSelectedDate
} from "@/src/redux/slices/salarySlice";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { RootState } from "@/src/redux/store";
import { PayrollHeader } from "./components/PayrollHeader";
import { SummaryCards } from "./components/SummaryCards";
import { PayrollMember, TeamList } from "./components/TeamList";
import { PaySalaryDialog } from "./components/PaySalaryDialog";
import { AttendanceLogsDrawer } from "./components/AttendanceLogsDrawer";
import { toast } from "sonner";

export default function PayrollPage() {
    const dispatch = useAppDispatch();
    const searchParams = useSearchParams();
    const {
        stats,
        payrollList,
        isLoading,
        error,
        selectedMonth,
        selectedYear,
        payrollRun
    } = useAppSelector((state: RootState) => state.salary);

    const [activeTab, setActiveTab] = useState("All");
    const [selectedUser, setSelectedUser] = useState<PayrollMember | null>(null);
    const [isPayDialogOpen, setIsPayDialogOpen] = useState(false);
    const [isLogsOpen, setIsLogsOpen] = useState(false);

    useEffect(() => {
        const month = Number(searchParams.get("month"));
        const year = Number(searchParams.get("year"));

        if (
            month >= 1 &&
            month <= 12 &&
            year > 2000 &&
            (month !== selectedMonth || year !== selectedYear)
        ) {
            dispatch(setSelectedDate({ month, year }));
        }
    }, [dispatch, searchParams, selectedMonth, selectedYear]);

    useEffect(() => {
        const params = { month: selectedMonth, year: selectedYear };
        dispatch(fetchPayrollStats(params));
        dispatch(fetchPayrollList({ ...params, tab: activeTab }));
    }, [dispatch, selectedMonth, selectedYear, activeTab]);

    useEffect(() => {
        if (error) {
            toast.error(error);
        }
    }, [error]);

    const handlePaySalary = (user: PayrollMember) => {
        setSelectedUser(user);
        setIsPayDialogOpen(true);
    };

    const handleViewLogs = (user: PayrollMember) => {
        setSelectedUser(user);
        setIsLogsOpen(true);
    };

    const handleGenerateRun = async (force = false) => {
        try {
            await dispatch(generatePayrollRun({
                month: selectedMonth,
                year: selectedYear,
                tab: activeTab,
                force
            })).unwrap();
            toast.success(force ? "Payroll run refreshed" : "Payroll run generated");
        } catch (err) {
            toast.error(typeof err === "string" ? err : "Failed to generate payroll run");
        }
    };

    const handleFinalizeRun = async () => {
        const runId = payrollRun?._id || stats?.payrollRun?._id;
        if (!runId) return;

        try {
            await dispatch(finalizePayrollRun({
                runId,
                month: selectedMonth,
                year: selectedYear,
                tab: activeTab
            })).unwrap();
            toast.success("Payroll run finalized");
        } catch (err) {
            toast.error(typeof err === "string" ? err : "Failed to finalize payroll run");
        }
    };

    const currentRun = payrollRun || stats?.payrollRun;
    const isRunFinalized = currentRun?.status === "Finalized" || currentRun?.status === "Paid";

    return (
        <div className="flex flex-col gap-6 h-[calc(100vh-2rem)]">
            <PayrollHeader
                month={selectedMonth}
                year={selectedYear}
                onDateChange={(m, y) => dispatch(setSelectedDate({ month: m, year: y }))}
            />

            <div className="flex-1 flex flex-col gap-6 overflow-hidden pr-1">
                <SummaryCards stats={stats} isLoading={isLoading} />

                <div className="flex flex-col gap-3 rounded-lg border bg-card p-3 shadow-sm md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-3">
                        <div>
                            <p className="text-sm font-bold text-foreground">Payroll Run</p>
                            <p className="text-xs text-muted-foreground">
                                {currentRun ? "Saved salary snapshot for this month" : "Generate once attendance is ready"}
                            </p>
                        </div>
                        <Badge variant={currentRun ? "default" : "secondary"} className="rounded-md">
                            {currentRun?.status || "Live Calculation"}
                        </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            className="rounded-md font-semibold"
                            asChild
                        >
                            <Link href="/superadmin/payroll/history">History</Link>
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleGenerateRun(Boolean(currentRun))}
                            disabled={isLoading}
                            className="rounded-md font-semibold"
                        >
                            {currentRun ? "Refresh Run" : "Generate Run"}
                        </Button>
                        <Button
                            size="sm"
                            onClick={handleFinalizeRun}
                            disabled={isLoading || !currentRun || isRunFinalized}
                            className="rounded-md font-semibold"
                        >
                            Finalize
                        </Button>
                    </div>
                </div>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
                    <TabsList className="grid w-full max-w-[500px] grid-cols-4 mb-4 shrink-0">
                        <TabsTrigger value="All">All</TabsTrigger>
                        <TabsTrigger value="Superadmins">Superadmins</TabsTrigger>
                        <TabsTrigger value="Admins">Admins</TabsTrigger>
                        <TabsTrigger value="Team">Team</TabsTrigger>
                    </TabsList>

                    <div className="flex-1 overflow-y-auto min-h-0">
                        <TabsContent value="All" className="mt-0 outline-none">
                            <TeamList
                                data={payrollList}
                                isLoading={isLoading}
                                onPay={handlePaySalary}
                                onViewLogs={handleViewLogs}
                            />
                        </TabsContent>
                        <TabsContent value="Team" className="mt-0 outline-none">
                            <TeamList
                                data={payrollList}
                                isLoading={isLoading}
                                onPay={handlePaySalary}
                                onViewLogs={handleViewLogs}
                            />
                        </TabsContent>
                        <TabsContent value="Admins" className="mt-0 outline-none">
                            <TeamList
                                data={payrollList}
                                isLoading={isLoading}
                                onPay={handlePaySalary}
                                onViewLogs={handleViewLogs}
                            />
                        </TabsContent>
                        <TabsContent value="Superadmins" className="mt-0 outline-none">
                            <TeamList
                                data={payrollList}
                                isLoading={isLoading}
                                onPay={handlePaySalary}
                                onViewLogs={handleViewLogs}
                            />
                        </TabsContent>
                    </div>
                </Tabs>
            </div>

            <PaySalaryDialog
                open={isPayDialogOpen}
                onOpenChange={setIsPayDialogOpen}
                user={selectedUser}
                month={selectedMonth}
                year={selectedYear}
                activeTab={activeTab}
            />

            <AttendanceLogsDrawer
                open={isLogsOpen}
                onOpenChange={setIsLogsOpen}
                user={selectedUser}
                month={selectedMonth}
                year={selectedYear}
            />
        </div>
    );
}
