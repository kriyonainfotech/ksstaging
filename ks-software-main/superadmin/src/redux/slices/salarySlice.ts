import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { salaryService } from "../../services/salaryService";
import type { RootState } from "../store";

interface PayrollRunSummary {
    _id: string;
    status: string;
    generatedAt?: string;
    finalizedAt?: string;
}

interface PayrollListItem {
    _id: string;
    payrollRunId?: string;
    payrollLineId?: string;
    lineStatus?: "Pending" | "Partially Paid" | "Paid" | "Cancelled";
    name: string;
    email: string;
    role?: string;
    profilePic?: string | null;
    company?: string;
    timing: {
        start: string;
        end: string;
    };
    department?: string;
    earnedBalance: number;
    paidAmount: number;
    attendance: {
        present: number;
        half: number;
        leave?: number;
        sundays?: number;
        monthDays?: number;
        paidDays?: number;
        totalWorking: number;
    };
    todayStatus: string;
}

interface AttendanceLog {
    _id: string;
    date: string;
    status: string;
    startTime?: string;
    endTime?: string;
    totalHours?: number;
}

interface SalaryPaymentPayload {
    userId: string;
    userName: string;
    amount: number;
    company: string;
    paymentSource: string;
    notes?: string;
    date?: Date;
    salaryMonth: number;
    salaryYear: number;
    payrollLineId?: string;
    tab?: string;
}

const getErrorMessage = (err: unknown, fallback: string) => {
    const error = err as { response?: { data?: { message?: string } } };
    return error.response?.data?.message || fallback;
};

interface SalaryState {
    wallet: {
        earnedSalary: number;
        baseSalary: number;
        dailyRate: number;
        totalWorkingDaysCount: number;
        attendanceSummary: {
            present: number;
            halfDay: number;
            leave: number;
            sundays?: number;
            totalWorking?: number;
            monthDays?: number;
            paidDays?: number;
        };
    } | null;
    stats: {
        totalPayroll: number;
        accruedTillDate: number;
        disbursed: number;
        workingDaysCount: number;
        sundaysCount?: number;
        payrollRun?: PayrollRunSummary | null;
    } | null;
    payrollRun: PayrollRunSummary | null;
    payrollList: PayrollListItem[];
    attendanceLogs: AttendanceLog[];
    isLoading: boolean;
    error: string | null;
    selectedMonth: number;
    selectedYear: number;
}

const now = new Date();

const initialState: SalaryState = {
    wallet: null,
    stats: null,
    payrollRun: null,
    payrollList: [],
    attendanceLogs: [],
    isLoading: false,
    error: null,
    selectedMonth: now.getMonth() + 1,
    selectedYear: now.getFullYear(),
};

export const fetchWalletStats = createAsyncThunk(
    "salary/fetchWallet",
    async (params: { month: number; year: number } | undefined, { rejectWithValue }) => {
        try {
            const res = await salaryService.getMyWalletStats(params);
            return res.data;
        } catch (err: unknown) {
            return rejectWithValue(getErrorMessage(err, "Failed to fetch wallet stats"));
        }
    }
);

export const fetchPayrollStats = createAsyncThunk(
    "salary/fetchStats",
    async (params: { month: number; year: number }, { rejectWithValue }) => {
        try {
            const res = await salaryService.getPayrollStats(params);
            return res.data;
        } catch (err: unknown) {
            return rejectWithValue(getErrorMessage(err, "Failed to fetch payroll stats"));
        }
    }
);

export const fetchPayrollList = createAsyncThunk(
    "salary/fetchList",
    async (params: { month: number; year: number; tab: string }, { rejectWithValue }) => {
        try {
            const res = await salaryService.getPayrollList(params);
            return res.data;
        } catch (err: unknown) {
            return rejectWithValue(getErrorMessage(err, "Failed to fetch payroll list"));
        }
    }
);

export const generatePayrollRun = createAsyncThunk(
    "salary/generatePayrollRun",
    async (params: { month: number; year: number; force?: boolean; notes?: string; tab?: string }, { rejectWithValue, dispatch }) => {
        try {
            const res = await salaryService.generatePayrollRun(params);
            dispatch(fetchPayrollStats({ month: params.month, year: params.year }));
            dispatch(fetchPayrollList({ month: params.month, year: params.year, tab: params.tab || "All" }));
            return res.data;
        } catch (err: unknown) {
            return rejectWithValue(getErrorMessage(err, "Failed to generate payroll run"));
        }
    }
);

export const finalizePayrollRun = createAsyncThunk(
    "salary/finalizePayrollRun",
    async (params: { runId: string; month: number; year: number; tab?: string }, { rejectWithValue, dispatch }) => {
        try {
            const res = await salaryService.finalizePayrollRun(params.runId);
            dispatch(fetchPayrollStats({ month: params.month, year: params.year }));
            dispatch(fetchPayrollList({ month: params.month, year: params.year, tab: params.tab || "All" }));
            return res.data;
        } catch (err: unknown) {
            return rejectWithValue(getErrorMessage(err, "Failed to finalize payroll run"));
        }
    }
);

export const recordSalaryPayment = createAsyncThunk(
    "salary/recordPayment",
    async (data: SalaryPaymentPayload, { rejectWithValue, dispatch, getState }) => {
        try {
            const res = await salaryService.recordSalaryPayment(data);
            // Refresh stats and list after payment
            const state = getState() as RootState;
            const { selectedMonth, selectedYear } = state.salary;
            dispatch(fetchPayrollStats({ month: selectedMonth, year: selectedYear }));
            dispatch(fetchPayrollList({ month: selectedMonth, year: selectedYear, tab: data.tab || "All" }));
            return res.data;
        } catch (err: unknown) {
            return rejectWithValue(getErrorMessage(err, "Failed to record payment"));
        }
    }
);

export const fetchAttendanceLogs = createAsyncThunk(
    "salary/fetchLogs",
    async ({ userId, params }: { userId: string; params: { month: number; year: number } }, { rejectWithValue }) => {
        try {
            const res = await salaryService.getAttendanceLogs(userId, params);
            return res.data;
        } catch (err: unknown) {
            return rejectWithValue(getErrorMessage(err, "Failed to fetch attendance logs"));
        }
    }
);

const salarySlice = createSlice({
    name: "salary",
    initialState,
    reducers: {
        setSelectedDate: (state, action) => {
            state.selectedMonth = action.payload.month;
            state.selectedYear = action.payload.year;
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchWalletStats.pending, (state) => {
                state.isLoading = true;
                state.error = null;
            })
            .addCase(fetchWalletStats.fulfilled, (state, action) => {
                state.isLoading = false;
                state.wallet = action.payload;
            })
            .addCase(fetchWalletStats.rejected, (state, action) => {
                state.isLoading = false;
                state.error = action.payload as string;
            })
            // Payroll Stats
            .addCase(fetchPayrollStats.pending, (state) => {
                state.isLoading = true;
            })
            .addCase(fetchPayrollStats.fulfilled, (state, action) => {
                state.isLoading = false;
                state.stats = action.payload;
                state.payrollRun = action.payload?.payrollRun || null;
            })
            .addCase(fetchPayrollStats.rejected, (state, action) => {
                state.isLoading = false;
                state.error = action.payload as string;
            })
            // Payroll List
            .addCase(fetchPayrollList.pending, (state) => {
                state.isLoading = true;
            })
            .addCase(fetchPayrollList.fulfilled, (state, action) => {
                state.isLoading = false;
                state.payrollList = action.payload;
            })
            .addCase(fetchPayrollList.rejected, (state, action) => {
                state.isLoading = false;
                state.error = action.payload as string;
            })
            // Attendance Logs
            .addCase(fetchAttendanceLogs.fulfilled, (state, action) => {
                state.attendanceLogs = action.payload;
            })
            .addCase(generatePayrollRun.pending, (state) => {
                state.isLoading = true;
                state.error = null;
            })
            .addCase(generatePayrollRun.fulfilled, (state, action) => {
                state.isLoading = false;
                state.payrollRun = action.payload?.payrollRun || null;
            })
            .addCase(generatePayrollRun.rejected, (state, action) => {
                state.isLoading = false;
                state.error = action.payload as string;
            })
            .addCase(finalizePayrollRun.pending, (state) => {
                state.isLoading = true;
                state.error = null;
            })
            .addCase(finalizePayrollRun.fulfilled, (state, action) => {
                state.isLoading = false;
                state.payrollRun = action.payload || null;
            })
            .addCase(finalizePayrollRun.rejected, (state, action) => {
                state.isLoading = false;
                state.error = action.payload as string;
            });
    },
});

export const { setSelectedDate } = salarySlice.actions;
export default salarySlice.reducer;
