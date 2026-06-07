"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Team } from "@/lib/teamdata";
import { Loader2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { SalaryProfilePayload } from "@/src/services/salaryService";

export interface TeamFormSubmitData extends Record<string, unknown> {
    salaryProfile: SalaryProfilePayload;
}

interface TeamDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (data: TeamFormSubmitData) => void;
    initialData?: Team | null;
    isLoading?: boolean;
}

export function TeamDialog({ open, onOpenChange, onSubmit, initialData, isLoading }: TeamDialogProps) {
    const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm();

    const toTimeInputValue = (value?: string) => {
        if (!value) return "";
        if (/^\d{2}:\d{2}$/.test(value)) return value;

        const match = value.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
        if (!match) return value;

        let hours = Number(match[1]);
        const minutes = match[2];
        const period = match[3].toUpperCase();

        if (period === "PM" && hours !== 12) hours += 12;
        if (period === "AM" && hours === 12) hours = 0;

        return `${hours.toString().padStart(2, "0")}:${minutes}`;
    };

    useEffect(() => {
        register("role");
        register("status");
        register("specialization");

        if (open) {
            if (initialData) {
                reset({
                    name: initialData.name,
                    email: initialData.email,
                    phone: initialData.phone || "",
                    status: initialData.status,
                    role: initialData.role || "Team",
                    specialization: initialData.profile?.specialization || "design",
                    skills: initialData.profile?.skills?.join(", ") || "",
                    salary: initialData.salaryProfile?.salary?.amount || initialData.profile?.salary?.amount || "",
                    experience: initialData.profile?.experience || "",

                    street: initialData.profile?.address?.street || "",
                    city: initialData.profile?.address?.city || "",
                    state: initialData.profile?.address?.state || "",
                    country: initialData.profile?.address?.country || "",

                    emergency1Name: initialData.profile?.emergencyContact1?.name || "",
                    emergency1Phone: initialData.profile?.emergencyContact1?.phone || "",
                    emergency2Name: initialData.profile?.emergencyContact2?.name || "",
                    emergency2Phone: initialData.profile?.emergencyContact2?.phone || "",

                    notes: initialData.profile?.notes || "",
                    timingStart: toTimeInputValue(initialData.profile?.timing?.start || "09:00"),
                    timingEnd: toTimeInputValue(initialData.profile?.timing?.end || "19:00"),
                    bankName: initialData.salaryProfile?.bankInfo?.bankName || initialData.profile?.bankInfo?.bankName || "",
                    accountNumber: initialData.salaryProfile?.bankInfo?.accountNumber || initialData.profile?.bankInfo?.accountNumber || "",
                    ifscCode: initialData.salaryProfile?.bankInfo?.ifscCode || initialData.profile?.bankInfo?.ifscCode || "",
                    accountHolderName: initialData.salaryProfile?.bankInfo?.accountHolderName || "",
                    upiId: initialData.salaryProfile?.bankInfo?.upiId || ""
                });
            } else {
                reset({
                    name: "",
                    email: "",
                    phone: "",
                    password: "",
                    status: "Active",
                    role: "Team",
                    specialization: "design",
                    skills: "",
                    salary: "",
                    experience: "",
                    street: "",
                    city: "",
                    state: "",
                    country: "",
                    emergency1Name: "",
                    emergency1Phone: "",
                    emergency2Name: "",
                    emergency2Phone: "",
                    notes: "",
                    timingStart: "09:00",
                    timingEnd: "19:00",
                    bankName: "",
                    accountNumber: "",
                    ifscCode: "",
                    accountHolderName: "",
                    upiId: ""
                });
            }
        }
    }, [initialData, open, register, reset]);


    const onFormSubmit = (data: Record<string, string>) => {
        const formattedData = {
            ...data,
            skills: data.skills.split(",").map((s: string) => s.trim()).filter(Boolean),
            salaryProfile: {
                salary: {
                    amount: Number(data.salary || 0),
                    type: "Monthly" as const,
                    currency: "INR"
                },
                bankInfo: {
                    bankName: data.bankName,
                    accountNumber: data.accountNumber,
                    ifscCode: data.ifscCode,
                    accountHolderName: data.accountHolderName,
                    upiId: data.upiId
                },
                isActive: true
            },
            street: data.street,
            city: data.city,
            state: data.state,
            country: data.country,
            role: data.role,
            emergency1Name: data.emergency1Name,
            emergency1Phone: data.emergency1Phone,
            emergency2Name: data.emergency2Name,
            emergency2Phone: data.emergency2Phone,

            notes: data.notes || "",
            timing: {
                start: data.timingStart,
                end: data.timingEnd
            }
        };

        onSubmit(formattedData);
    };


    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[95vw] sm:max-w-[860px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{initialData ? "Edit Team Profile" : "Onboard Team Member"}</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit(onFormSubmit)} className="grid gap-4 py-4">

                    {/* Section 1: Identity */}
                    <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label>Full Name</Label>
                            <Input {...register("name", { required: true })} placeholder="Rahul Verma" />
                        </div>
                        <div className="space-y-2">
                            <Label>Email</Label>
                            <Input type="email" {...register("email", { required: true })} placeholder="rahul@kriyona.com" />
                        </div>
                        <div className="space-y-2">
                            <Label>Phone</Label>
                            <Input
                                {...register("phone", {
                                    required: "Phone is required",
                                    pattern: {
                                        value: /^[0-9]{10}$/,
                                        message: "Please enter exactly 10 digits"
                                    }
                                })}
                                type="tel"
                                maxLength={10}
                                placeholder="9876543210"
                            />
                            {/* @ts-expect-error React Hook Form error message is not strongly typed in this untyped form */}
                            {errors.phone && <p className="text-[10px] text-red-500 font-medium">{errors.phone.message}</p>}
                        </div>
                        {!initialData && (
                            <div className="space-y-2">
                                <Label>Initial Password</Label>
                                <Input type="password" {...register("password", { required: true })} placeholder="••••••" autoComplete="new-password" />
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label>Address Line 1</Label>
                            <Input {...register("street")} placeholder="123 Main Street" />
                        </div>
                        <div className="space-y-2">
                            <Label>City</Label>
                            <Input {...register("city")} placeholder="City Name" />
                        </div>

                        <div className="space-y-2">
                            <Label>State</Label>
                            <Input {...register("state")} placeholder="State Name" />
                        </div>

                    </div>



                    <div className="border-t my-2"></div>

                    {/* Section 2: Professional Profile */}
                    <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label>Specialization</Label>
                            <Select onValueChange={(val) => setValue("specialization", val)} defaultValue={initialData?.profile?.specialization || "design"}>
                                <SelectTrigger className="w-full overflow-hidden"><SelectValue placeholder="Select Role" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="design">Designer</SelectItem>
                                    <SelectItem value="video">Video Editor</SelectItem>
                                    <SelectItem value="marketing">Marketer</SelectItem>
                                    <SelectItem value="web">Web Developer</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Experience</Label>
                            <Input {...register("experience")} placeholder="e.g. 3 Years" />
                        </div>

                        <div className="space-y-2">
                            <Label>Monthly Salary (INR)</Label>
                            <Input type="number" {...register("salary")} placeholder="25000" />
                        </div>


                    </div>

                    {/* Section 3: Additional Info */}
                    <div className="grid grid-cols-3 gap-4">

                        <div className="space-y-2">
                            <Label>Skills (Comma separated)</Label>
                            <Input {...register("skills")} placeholder="Photoshop, Figma, After Effects" />
                        </div>

                        <div className="space-y-2">
                            <Label>Emergency Contact 1 - Name</Label>
                            <Input {...register("emergency1Name")} placeholder="John Doe" />
                        </div>

                        <div className="space-y-2">
                            <Label>Emergency Contact 1 - Phone</Label>
                            <Input
                                {...register("emergency1Phone", {
                                    pattern: {
                                        value: /^[0-9]{10}$/,
                                        message: "Please enter exactly 10 digits"
                                    }
                                })}
                                type="tel"
                                maxLength={10}
                                placeholder="9876543210"
                            />
                            {/* @ts-expect-error React Hook Form error message is not strongly typed in this untyped form */}
                            {errors.emergency1Phone && <p className="text-[10px] text-red-500 font-medium">{errors.emergency1Phone.message}</p>}
                        </div>

                        <div className="space-y-2">
                            <Label>Emergency Contact 2 - Name</Label>
                            <Input {...register("emergency2Name")} placeholder="Jane Doe" />
                        </div>

                        <div className="space-y-2">
                            <Label>Emergency Contact 2 - Phone</Label>
                            <Input
                                {...register("emergency2Phone", {
                                    pattern: {
                                        value: /^[0-9]{10}$/,
                                        message: "Please enter exactly 10 digits"
                                    }
                                })}
                                type="tel"
                                maxLength={10}
                                placeholder="9123456789"
                            />
                            {/* @ts-expect-error React Hook Form error message is not strongly typed in this untyped form */}
                            {errors.emergency2Phone && <p className="text-[10px] text-red-500 font-medium">{errors.emergency2Phone.message}</p>}
                        </div>

                        <div className="space-y-2">
                            <Label>Status</Label>
                            <Select onValueChange={(val) => setValue("status", val)} defaultValue={initialData?.status || "Active"}>
                                <SelectTrigger className="w-full overflow-hidden"><SelectValue placeholder="Select Status" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Active">Active</SelectItem>
                                    <SelectItem value="On Leave">On Leave</SelectItem>
                                    <SelectItem value="Suspended">Suspended</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="col-span-3 space-y-2">
                            <Label>Notes</Label>
                            <Textarea {...register("notes")} placeholder="Any additional notes" />
                        </div>

                    </div>

                    <Separator className="my-2" />
                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold">Office Timing & Salary Bank Info</h3>
                        <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label>Office Start Time</Label>
                                <Input type="time" {...register("timingStart")} />
                            </div>
                            <div className="space-y-2">
                                <Label>Office End Time</Label>
                                <Input type="time" {...register("timingEnd")} />
                            </div>
                            <div className="space-y-2">
                                <Label>Bank Name</Label>
                                <Input {...register("bankName")} placeholder="HDFC Bank" />
                            </div>
                            <div className="space-y-2">
                                <Label>Account Number</Label>
                                <Input {...register("accountNumber")} placeholder="50100..." />
                            </div>
                            <div className="space-y-2">
                                <Label>IFSC Code</Label>
                                <Input {...register("ifscCode")} placeholder="HDFC000..." />
                            </div>
                            <div className="space-y-2">
                                <Label>Account Holder Name</Label>
                                <Input {...register("accountHolderName")} placeholder="Kundan Pandit" />
                            </div>
                            <div className="space-y-2">
                                <Label>UPI ID</Label>
                                <Input {...register("upiId")} placeholder="name@bank" />
                            </div>
                        </div>
                    </div>



                    <DialogFooter className="mt-4">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>Cancel</Button>
                        <Button type="submit" disabled={isLoading}>
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {initialData ? "Update Member" : "Create Member"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
