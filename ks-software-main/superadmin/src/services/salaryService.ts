import { axiosInstance } from "./apiConnector";

export interface SalaryProfilePayload {
    salary?: {
        amount?: number;
        type?: "Monthly" | "Hourly" | "Weekly";
        currency?: string;
    };
    bankInfo?: {
        bankName?: string;
        accountNumber?: string;
        ifscCode?: string;
        accountHolderName?: string;
        upiId?: string;
    };
    paymentPreferences?: {
        preferredSourceAccount?: "Company Bank" | "Personal Bank" | "Cash";
        notes?: string;
    };
    effectiveFrom?: string;
    effectiveTo?: string | null;
    isActive?: boolean;
}

export const salaryService = {
    getMyWalletStats: async (params?: { month: number; year: number }) => {
        const response = await axiosInstance.get("/api/salary/wallet", { params });
        return response.data;
    },
    getPayrollStats: async (params: { month: number; year: number }) => {
        const response = await axiosInstance.get("/api/salary/stats", { params });
        return response.data;
    },
    getPayrollList: async (params: { month: number; year: number; tab: string }) => {
        const response = await axiosInstance.get("/api/salary/list", { params });
        return response.data;
    },
    generatePayrollRun: async (data: { month: number; year: number; force?: boolean; notes?: string }) => {
        const response = await axiosInstance.post("/api/salary/runs/generate", data);
        return response.data;
    },
    getPayrollRun: async (params: { month: number; year: number }) => {
        const response = await axiosInstance.get("/api/salary/runs", { params });
        return response.data;
    },
    listPayrollRuns: async (params?: { status?: string; search?: string }) => {
        const response = await axiosInstance.get("/api/salary/runs/history/list", { params });
        return response.data;
    },
    getPayrollRunById: async (runId: string) => {
        const response = await axiosInstance.get(`/api/salary/runs/${runId}`);
        return response.data;
    },
    finalizePayrollRun: async (runId: string) => {
        const response = await axiosInstance.patch(`/api/salary/runs/${runId}/finalize`);
        return response.data;
    },
    recordSalaryPayment: async (data: unknown) => {
        const response = await axiosInstance.post("/api/salary/pay", data);
        return response.data;
    },
    getSalaryProfile: async (userId: string) => {
        const response = await axiosInstance.get(`/api/salary/profile/${userId}`);
        return response.data;
    },
    upsertSalaryProfile: async (userId: string, data: SalaryProfilePayload) => {
        const response = await axiosInstance.put(`/api/salary/profile/${userId}`, data);
        return response.data;
    },
    getAttendanceLogs: async (userId: string, params: { month: number; year: number }) => {
        const response = await axiosInstance.get(`/api/salary/logs/${userId}`, { params });
        return response.data;
    }
};
