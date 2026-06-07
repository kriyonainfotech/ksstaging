"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Search, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { salaryService } from "@/src/services/salaryService";
import { toast } from "sonner";

interface PayrollRunDetail {
    _id: string;
    month: number;
    year: number;
    status: "Draft" | "Finalized" | "Paid" | "Cancelled";
    totals?: {
        employees?: number;
        baseSalary?: number;
        earned?: number;
        paid?: number;
        pending?: number;
        present?: number;
        half?: number;
        leave?: number;
        sundays?: number;
        workingDays?: number;
        monthDays?: number;
    };
    finalizedAt?: string;
}

interface PayrollLineDetail {
    _id: string;
    status: "Pending" | "Partially Paid" | "Paid" | "Cancelled";
    employeeSnapshot?: {
        name?: string;
        email?: string;
        role?: string;
        department?: string;
        timing?: {
            start?: string;
            end?: string;
        };
    };
    salarySnapshot?: {
        baseSalary?: number;
        salaryType?: string;
        currency?: string;
    };
    attendanceSnapshot?: {
        present?: number;
        half?: number;
        leave?: number;
        sundays?: number;
        totalWorking?: number;
        monthDays?: number;
        paidDays?: number;
    };
    amounts?: {
        earned?: number;
        paid?: number;
        pending?: number;
    };
}

const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

const formatCurrency = (value = 0) => new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
}).format(value);

const formatShiftTime = (value?: string) => {
    if (!value) return "";
    const [hours, minutes] = value.split(":").map(Number);

    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
        return value;
    }

    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true
    });
};

const runStatusStyle: Record<PayrollRunDetail["status"], string> = {
    Draft: "bg-amber-50 text-amber-700 border-amber-200",
    Finalized: "bg-red-50 text-red-700 border-red-200",
    Paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
    Cancelled: "bg-slate-100 text-slate-600 border-slate-200"
};

const lineStatusStyle: Record<PayrollLineDetail["status"], string> = {
    Pending: "bg-amber-50 text-amber-700 border-amber-200",
    "Partially Paid": "bg-blue-50 text-blue-700 border-blue-200",
    Paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
    Cancelled: "bg-slate-100 text-slate-600 border-slate-200"
};

export default function PayrollRunDetailPage() {
    const params = useParams<{ runId: string }>();
    const router = useRouter();
    const [run, setRun] = useState<PayrollRunDetail | null>(null);
    const [lines, setLines] = useState<PayrollLineDetail[]>([]);
    const [search, setSearch] = useState("");
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!params.runId) return;

        salaryService.getPayrollRunById(params.runId)
            .then((res) => {
                setRun(res.data?.payrollRun || null);
                setLines(res.data?.lines || []);
            })
            .catch((error) => {
                toast.error(error?.response?.data?.message || "Failed to fetch payroll snapshot");
            })
            .finally(() => {
                setIsLoading(false);
            });
    }, [params.runId]);

    const filteredLines = useMemo(() => {
        const normalizedSearch = search.trim().toLowerCase();
        if (!normalizedSearch) return lines;

        return lines.filter((line) => {
            const employee = line.employeeSnapshot || {};
            const label = [
                employee.name,
                employee.email,
                employee.role,
                employee.department,
                line.status
            ].filter(Boolean).join(" ").toLowerCase();

            return label.includes(normalizedSearch);
        });
    }, [lines, search]);

    const openMonthInPayroll = () => {
        if (!run) return;
        router.push(`/superadmin/payroll?month=${run.month}&year=${run.year}`);
    };

    return (
        <div className="flex h-[calc(100vh-2rem)] flex-col gap-5">
            <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-sm md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-3">
                    <Button variant="outline" size="icon" className="h-9 w-9 rounded-md" asChild>
                        <Link href="/superadmin/payroll/history">
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                    </Button>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-xl font-bold text-foreground">
                                {run ? `${monthNames[run.month - 1]} ${run.year}` : "Payroll Snapshot"}
                            </h1>
                            {run && (
                                <Badge variant="outline" className={`rounded-md font-bold ${runStatusStyle[run.status]}`}>
                                    {run.status}
                                </Badge>
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground">Employee-wise salary, attendance and payment snapshot.</p>
                    </div>
                </div>
                <Button variant="outline" onClick={openMonthInPayroll} disabled={!run} className="rounded-md font-semibold">
                    Open In Payroll
                </Button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <Card className="rounded-lg py-0">
                    <CardContent className="p-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Calculated</p>
                        <p className="mt-1 text-2xl font-black text-amber-600">{formatCurrency(run?.totals?.earned || 0)}</p>
                    </CardContent>
                </Card>
                <Card className="rounded-lg py-0">
                    <CardContent className="p-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Paid</p>
                        <p className="mt-1 text-2xl font-black text-emerald-600">{formatCurrency(run?.totals?.paid || 0)}</p>
                    </CardContent>
                </Card>
                <Card className="rounded-lg py-0">
                    <CardContent className="p-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Pending</p>
                        <p className="mt-1 text-2xl font-black text-red-600">{formatCurrency(run?.totals?.pending || 0)}</p>
                    </CardContent>
                </Card>
                <Card className="rounded-lg py-0">
                    <CardContent className="p-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Working Days</p>
                        <p className="mt-1 text-2xl font-black text-blue-600">{run?.totals?.workingDays || 0}</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
                <div className="rounded-lg border bg-card p-3">
                    <p className="text-[10px] font-bold uppercase text-muted-foreground">Working Days</p>
                    <p className="text-lg font-black text-foreground">{run?.totals?.workingDays || 0}</p>
                </div>
                <div className="rounded-lg border bg-card p-3">
                    <p className="text-[10px] font-bold uppercase text-muted-foreground">Present</p>
                    <p className="text-lg font-black text-emerald-600">{run?.totals?.present || 0}</p>
                </div>
                <div className="rounded-lg border bg-card p-3">
                    <p className="text-[10px] font-bold uppercase text-muted-foreground">Half Day</p>
                    <p className="text-lg font-black text-amber-600">{run?.totals?.half || 0}</p>
                </div>
                <div className="rounded-lg border bg-card p-3">
                    <p className="text-[10px] font-bold uppercase text-muted-foreground">Leaves</p>
                    <p className="text-lg font-black text-red-600">{run?.totals?.leave || 0}</p>
                </div>
                <div className="rounded-lg border bg-card p-3">
                    <p className="text-[10px] font-bold uppercase text-muted-foreground">Sundays</p>
                    <p className="text-lg font-black text-blue-600">{run?.totals?.sundays || 0}</p>
                </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border bg-card shadow-sm">
                <div className="flex flex-col gap-3 border-b p-4 md:flex-row md:items-center md:justify-between">
                    <div className="relative w-full md:max-w-sm">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search employee..."
                            className="h-10 rounded-md pl-9"
                        />
                    </div>
                    <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                        <Wallet className="h-4 w-4" />
                        {filteredLines.length} salary lines
                    </div>
                </div>

                <div className="min-h-0 flex-1 overflow-auto">
                    <Table>
                        <TableHeader className="sticky top-0 bg-muted/50">
                            <TableRow>
                                <TableHead className="pl-5">Employee</TableHead>
                                <TableHead>Shift</TableHead>
                                <TableHead className="text-center">Attendance</TableHead>
                                <TableHead className="text-right">Calculated</TableHead>
                                <TableHead className="text-right">Paid</TableHead>
                                <TableHead className="text-right">Pending</TableHead>
                                <TableHead className="text-right pr-5">Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">Loading payroll snapshot...</TableCell>
                                </TableRow>
                            ) : filteredLines.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">No salary lines found.</TableCell>
                                </TableRow>
                            ) : filteredLines.map((line) => {
                                const employee = line.employeeSnapshot || {};
                                const attendance = line.attendanceSnapshot || {};
                                const amounts = line.amounts || {};

                                return (
                                    <TableRow key={line._id}>
                                        <TableCell className="pl-5">
                                            <div>
                                                <p className="font-bold text-foreground">{employee.name || "Unnamed Employee"}</p>
                                                <p className="text-[10px] font-medium text-muted-foreground">{employee.email || "No email"}</p>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="text-xs font-semibold text-muted-foreground">
                                                {formatShiftTime(employee.timing?.start) || "09:00 AM"} - {formatShiftTime(employee.timing?.end) || "07:00 PM"}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center justify-center gap-3 text-center">
                                                <div>
                                                    <p className="text-[9px] font-bold uppercase text-muted-foreground">W</p>
                                                    <p className="text-xs font-black text-foreground">{attendance.totalWorking || 0}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[9px] font-bold uppercase text-muted-foreground">P</p>
                                                    <p className="text-xs font-black text-emerald-600">{attendance.present || 0}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[9px] font-bold uppercase text-muted-foreground">H</p>
                                                    <p className="text-xs font-black text-amber-600">{attendance.half || 0}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[9px] font-bold uppercase text-muted-foreground">L</p>
                                                    <p className="text-xs font-black text-red-600">{attendance.leave || 0}</p>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right font-bold text-amber-600">{formatCurrency(amounts.earned || 0)}</TableCell>
                                        <TableCell className="text-right font-bold text-emerald-600">{formatCurrency(amounts.paid || 0)}</TableCell>
                                        <TableCell className="text-right font-bold text-red-600">{formatCurrency(amounts.pending || 0)}</TableCell>
                                        <TableCell className="text-right pr-5">
                                            <Badge variant="outline" className={`rounded-md font-bold ${lineStatusStyle[line.status]}`}>
                                                {line.status}
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>
    );
}
