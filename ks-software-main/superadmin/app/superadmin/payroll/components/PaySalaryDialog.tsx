"use client";

import { useForm } from "react-hook-form";
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from "@/components/ui/select";
import { useAppDispatch, useAppSelector } from "@/src/redux/hooks";
import { RootState } from "@/src/redux/store";
import { recordSalaryPayment } from "@/src/redux/slices/salarySlice";
import { toast } from "sonner";
import { useEffect, useMemo, useState } from "react";
import { Coins, Building2, UserCircle } from "lucide-react";
import { paymentService } from "@/src/services/paymentService";
import type { PayrollMember } from "./TeamList";

const ownerMap: Record<string, string> = {
    "nayanbhisara@kriyonastudio.com": "Kriyona Studio",
    "prarthanavaghani@kriyonastudio.com": "PrimeAdwork",
    "kirtannarola@kriyonastudio.com": "Kriyona Infotech",
};

const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

interface SalaryPaymentForm {
    amount: number;
    paymentSource: string;
    company: string;
    notes: string;
    salaryMonth: number;
    salaryYear: number;
}

interface PaySalaryDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    user: PayrollMember | null;
    month: number;
    year: number;
    activeTab?: string;
}

export function PaySalaryDialog({ open, onOpenChange, user, month, year, activeTab }: PaySalaryDialogProps) {
    const dispatch = useAppDispatch();
    const currentUser = useAppSelector((state: RootState) => state.auth.user);

    const [balances, setBalances] = useState<{ company: number; personal: number; cash: number } | null>(null);
    const [isFetchingBalances, setIsFetchingBalances] = useState(false);
    const userCompany = useMemo(() => {
        return ownerMap[currentUser?.email || ""] || null;
    }, [currentUser]);

    const isGlobalAdmin = useMemo(() => {
        return currentUser?.role === "Superadmin";
    }, [currentUser]);

    const { register, handleSubmit, setValue, watch, reset } = useForm<SalaryPaymentForm>({
        defaultValues: {
            amount: 0,
            paymentSource: "Company Bank",
            company: "Kriyona Studio",
            notes: "",
            salaryMonth: month,
            salaryYear: year
        }
    });

    useEffect(() => {
        if (user) {
            const balance = user.earnedBalance - user.paidAmount;
            setValue("amount", Math.max(0, balance));
            setValue("notes", `Salary for ${monthNames[month - 1]} ${year}`);
            
            // Set company based on permissions
            if (isGlobalAdmin) {
                // Global admin uses the user's assigned company or fallback
                setValue("company", user.company || "Kriyona Studio");
            } else if (userCompany) {
                // If standard admin, use their mapped company
                setValue("company", userCompany);
            } else {
                // Fallback for others
                setValue("company", currentUser?.businessName || "Kriyona Studio");
            }

            setValue("salaryMonth", month);
            setValue("salaryYear", year);
        }
    }, [user, month, year, setValue, isGlobalAdmin, userCompany, currentUser]);

    const onSubmit = async (data: SalaryPaymentForm) => {
        if (!user) return;

        try {
            // Check balance limit
            const currentBalance = getSelectedBalance();
            const payAmount = Number(data.amount) || 0;
            if (payAmount > currentBalance) {
                toast.error(`Insufficient funds in ${data.paymentSource}. Available balance is ₹${currentBalance.toLocaleString()}. Negative values not allowed.`);
                return;
            }

            const payload = {
                ...data,
                userId: user._id,
                userName: user.name,
                date: new Date(data.salaryYear, data.salaryMonth - 1, new Date().getDate()),
                salaryMonth: data.salaryMonth,
                salaryYear: data.salaryYear,
                payrollLineId: user.payrollLineId,
                tab: activeTab
            };
            
            await dispatch(recordSalaryPayment(payload)).unwrap();
            toast.success(`Salary payment of ₹${data.amount} recorded for ${user.name}`);
            onOpenChange(false);
            reset();
        } catch (error: unknown) {
            toast.error(typeof error === "string" ? error : "Failed to record payment");
        }
    };

    const companyValue = watch("company");
    const paymentSourceValue = watch("paymentSource");
    const amountValue = watch("amount");
    const selectedSalaryMonth = watch("salaryMonth");
    const selectedSalaryYear = watch("salaryYear");

    const getSelectedBalance = () => {
        if (!balances) return 0;
        if (paymentSourceValue === "Company Bank") return balances.company;
        if (paymentSourceValue === "Personal Bank") return balances.personal;
        if (paymentSourceValue === "Cash") return balances.cash;
        return 0;
    };

    const pendingSalary = user ? Math.max((user.earnedBalance || 0) - (user.paidAmount || 0), 0) : 0;
    const hasInsufficientBalance = Number(amountValue || 0) > getSelectedBalance();

    useEffect(() => {
        if (open && companyValue) {
            setIsFetchingBalances(true);
            paymentService.getStats(companyValue)
                .then((stats) => {
                    if (stats && stats.byAccount) {
                        setBalances({
                            company: stats.byAccount.company || 0,
                            personal: stats.byAccount.personal || 0,
                            cash: stats.byAccount.cash || 0
                        });
                    }
                })
                .catch((err) => {
                    console.error("Failed to fetch company balances:", err);
                    setBalances(null);
                })
                .finally(() => {
                    setIsFetchingBalances(false);
                });
        }
    }, [open, companyValue]);

    if (!user) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[420px] rounded-lg p-6">
                <DialogHeader className="mb-4">
                    <DialogTitle className="text-xl font-bold text-foreground flex items-center gap-3">
                        <div className="bg-primary/10 p-2 rounded-md">
                            <Coins className="h-5 w-5 text-primary" />
                        </div>
                        Process Salary
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                    <div className="bg-muted/30 p-3 rounded-md flex items-center gap-3 border border-border mb-1">
                        <UserCircle className="h-9 w-9 text-muted-foreground/50" />
                        <div>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider leading-none mb-1">Paying To</p>
                            <p className="text-base font-bold text-foreground tracking-tight leading-none">{user.name}</p>
                        </div>
                    </div>

                    <div className="grid gap-4">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider ml-0.5">Payment Amount (INR)</Label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-muted-foreground text-sm">₹</span>
                                <Input 
                                    type="number" 
                                    {...register("amount", { required: true, min: 1 })}
                                    className={`pl-7 h-10 rounded-md font-bold text-base ${hasInsufficientBalance ? "border-red-500 focus:ring-red-500 focus:border-red-500" : "border-input focus:ring-primary focus:border-primary"}`}
                                />
                            </div>
                            {hasInsufficientBalance ? (
                                <p className="text-[10px] font-bold text-red-500 mt-1">
                                    Insufficient balance in selected account.
                                </p>
                            ) : (
                                <p className="text-[10px] font-semibold text-muted-foreground mt-1">
                                    Calculated balance: ₹{pendingSalary.toLocaleString()}. Paid amount can be different.
                                </p>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between w-full ml-0.5 pr-0.5">
                                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Source Account</Label>
                                    <div className="text-[10px] font-bold">
                                        {isFetchingBalances ? (
                                            <span className="text-muted-foreground animate-pulse">Loading...</span>
                                        ) : balances ? (
                                            <span className="text-muted-foreground font-semibold">
                                                Bal: <span className={getSelectedBalance() <= 0 ? "text-red-500 font-extrabold" : "text-emerald-600 font-extrabold"}>
                                                    ₹{getSelectedBalance().toLocaleString()}
                                                </span>
                                            </span>
                                        ) : (
                                            <span className="text-red-500 font-bold">Unavailable</span>
                                        )}
                                    </div>
                                </div>
                                <Select 
                                    defaultValue="Company Bank" 
                                    onValueChange={(val) => setValue("paymentSource", val)}
                                >
                                    <SelectTrigger className="w-full h-10 rounded-md border-input font-medium text-sm">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Company Bank">Company Bank</SelectItem>
                                        <SelectItem value="Personal Bank">Personal Bank</SelectItem>
                                        <SelectItem value="Cash">Cash</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider ml-0.5">Company</Label>
                                <Select 
                                    value={companyValue}
                                    onValueChange={(val) => !(!isGlobalAdmin) && setValue("company", val)}
                                    disabled={!isGlobalAdmin}
                                >
                                    <SelectTrigger className={`w-full h-10 rounded-md border-input font-medium text-sm ${!isGlobalAdmin ? 'bg-muted opacity-80 cursor-not-allowed' : ''}`}>
                                        <div className="flex items-center gap-2">
                                            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                                            <SelectValue placeholder="Select Company" />
                                        </div>
                                    </SelectTrigger>
                                    <SelectContent>
                                        {isGlobalAdmin ? (
                                            <>
                                                <SelectItem value="Kriyona Studio">Kriyona Studio</SelectItem>
                                                <SelectItem value="PrimeAdwork">PrimeAdwork</SelectItem>
                                                <SelectItem value="Kriyona Infotech">Kriyona Infotech</SelectItem>
                                            </>
                                        ) : (
                                            <SelectItem value={companyValue}>{companyValue}</SelectItem>
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider ml-0.5">Salary For Month</Label>
                                <Select 
                                    value={selectedSalaryMonth?.toString()} 
                                    onValueChange={(val) => {
                                        setValue("salaryMonth", parseInt(val));
                                        setValue("notes", `Salary for ${monthNames[parseInt(val) - 1]} ${selectedSalaryYear}`);
                                    }}
                                >
                                    <SelectTrigger className="w-full h-10 rounded-md border-input font-medium text-sm">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {monthNames.map((m, i) => (
                                            <SelectItem key={m} value={(i + 1).toString()}>{m}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider ml-0.5">Salary For Year</Label>
                                <Select 
                                    value={selectedSalaryYear?.toString()} 
                                    onValueChange={(val) => {
                                        setValue("salaryYear", parseInt(val));
                                        setValue("notes", `Salary for ${monthNames[selectedSalaryMonth - 1]} ${val}`);
                                    }}
                                >
                                    <SelectTrigger className="w-full h-10 rounded-md border-input font-medium text-sm">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {[year - 1, year, year + 1].map(y => (
                                            <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider ml-0.5">Notes / Description</Label>
                            <Input 
                                {...register("notes")}
                                placeholder="Add a note..."
                                className="h-10 rounded-md border-input text-sm"
                            />
                        </div>
                    </div>

                    <div className="pt-4 flex items-center justify-between gap-3 w-full">
                        <Button 
                            type="button" 
                            variant="outline" 
                            onClick={() => onOpenChange(false)}
                            className="w-1/2 rounded-md font-semibold text-muted-foreground h-10"
                        >
                            Cancel
                        </Button>
                        <Button 
                            type="submit" 
                            disabled={!balances || isFetchingBalances || Number(amountValue || 0) <= 0 || hasInsufficientBalance}
                            className="w-1/2 bg-primary hover:bg-primary/90 rounded-md px-6 font-bold uppercase tracking-wider text-[10px] h-10 disabled:opacity-50 disabled:pointer-events-none"
                        >
                            Confirm Payment
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
