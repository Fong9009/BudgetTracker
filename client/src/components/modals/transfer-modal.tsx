import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { transferSchema } from "@shared/schema";
import type { Account } from "@shared/schema";
import { CalendarIcon, ArrowRightLeft } from "lucide-react";
import { format } from "date-fns";
import { cn, formatCurrency } from "@/lib/utils";
import { getValidToken } from "@/lib/queryClient";

const formSchema = z.object({
  amount: z.string().min(1, "Amount is required"),
  description: z.string().min(1, "Description is required"),
  date: z.date({ required_error: "Date is required" }),
  fromAccountId: z.string().min(1, "From account is required"),
  toAccountId: z.string().min(1, "To account is required"),
}).refine((data) => data.fromAccountId !== data.toAccountId, {
  message: "Source and destination accounts must be different",
  path: ["toAccountId"],
});

type FormData = z.infer<typeof formSchema>;

interface TransferModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TransferModal({ open, onOpenChange }: TransferModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: accounts = [], isLoading: accountsLoading } = useQuery<Account[]>({
    queryKey: ["/api/accounts"],
    enabled: open,
    queryFn: async () => {
      const token = await getValidToken();
      if (!token) return [];
      
      try {
        const response = await fetch("/api/accounts", {
          headers: { Authorization: `Bearer ${token}` },
          credentials: "include",
        });
        
        if (response.status === 401) return [];
        if (!response.ok) throw new Error("Failed to fetch accounts");
        
        return response.json();
      } catch (error) {
        console.error("Error fetching accounts:", error);
        return [];
      }
    },
  });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      amount: "",
      description: "",
      date: new Date(),
      fromAccountId: "",
      toAccountId: "",
    },
  });

  const transferMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const transferData = {
        ...data,
        date: data.date.toISOString(),
      };
      await apiRequest("POST", "/api/transfers", transferData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/categories/with-counts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics"] });
      toast({
        title: "Success",
        description: "Transfer completed successfully",
        variant: "success",
      });
      form.reset();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to process transfer",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    transferMutation.mutate(data);
  };

  const fromAccountId = form.watch("fromAccountId");
  const toAccountId = form.watch("toAccountId");
  const amount = form.watch("amount");

  const fromAccount = accounts.find(acc => acc._id === fromAccountId);
  const toAccount = accounts.find(acc => acc._id === toAccountId);
  const transferAmount = parseFloat(amount) || 0;

  // Filter available accounts for destination (exclude source account)
  const availableToAccounts = accounts.filter(acc => acc._id !== fromAccountId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" />
            Transfer Between Accounts
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Transfer Direction Visualization */}
            <div className="bg-muted/50 p-4 rounded-lg space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                {/* From Account */}
                <div className="text-center">
                  <div className="text-sm font-medium text-muted-foreground mb-1">From</div>
                  {fromAccount ? (
                    <div className="p-3 bg-background border rounded-lg">
                      <div className="font-medium">{fromAccount.name}</div>
                      <div className="text-sm text-muted-foreground">
                        Balance: {formatCurrency(fromAccount.balance)}
                      </div>
                      {transferAmount > 0 && (
                        <div className="text-xs text-red-600 mt-1">
                          After: {formatCurrency(fromAccount.balance - transferAmount)}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-3 bg-background border border-dashed rounded-lg text-sm text-muted-foreground">
                      Select source account
                    </div>
                  )}
                </div>

                {/* Arrow */}
                <div className="text-center">
                  <ArrowRightLeft className="h-6 w-6 mx-auto text-primary" />
                  {transferAmount > 0 && (
                    <div className="text-lg font-semibold text-primary mt-1">
                      {formatCurrency(transferAmount)}
                    </div>
                  )}
                </div>

                {/* To Account */}
                <div className="text-center">
                  <div className="text-sm font-medium text-muted-foreground mb-1">To</div>
                  {toAccount ? (
                    <div className="p-3 bg-background border rounded-lg">
                      <div className="font-medium">{toAccount.name}</div>
                      <div className="text-sm text-muted-foreground">
                        Balance: {formatCurrency(toAccount.balance)}
                      </div>
                      {transferAmount > 0 && (
                        <div className="text-xs text-green-600 mt-1">
                          After: {formatCurrency(toAccount.balance + transferAmount)}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-3 bg-background border border-dashed rounded-lg text-sm text-muted-foreground">
                      Select destination account
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Form Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="fromAccountId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>From Account</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select source account" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {accounts.map((account) => (
                          <SelectItem key={account._id} value={account._id}>
                            <div className="flex justify-between items-center w-full">
                              <span>{account.name}</span>
                              <span className="text-sm text-muted-foreground ml-4">
                                {formatCurrency(account.balance)}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="toAccountId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>To Account</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select destination account" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {availableToAccounts.map((account) => (
                          <SelectItem key={account._id} value={account._id}>
                            <div className="flex justify-between items-center w-full">
                              <span>{account.name}</span>
                              <span className="text-sm text-muted-foreground ml-4">
                                {formatCurrency(account.balance)}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        min="0.01"
                      />
                    </FormControl>
                    <FormMessage />
                    {fromAccount && transferAmount > fromAccount.balance && (
                      <p className="text-sm text-red-600">
                        Insufficient balance. Available: {formatCurrency(fromAccount.balance)}
                      </p>
                    )}
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "PPP")
                            ) : (
                              <span>Pick a date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date: Date) =>
                            date > new Date() || date < new Date("1900-01-01")
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Transfer description" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={transferMutation.isPending}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={transferMutation.isPending || accountsLoading}
              >
                {transferMutation.isPending ? "Processing..." : "Transfer Funds"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}