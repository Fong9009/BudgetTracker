import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { optimisticUpdates } from "@/lib/optimisticUpdates";

const formSchema = z.object({
  name: z.string().min(1, "Category name is required"),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, "Please select a valid color"),
  icon: z.string().min(1, "Please select an icon"),
});

type FormData = z.infer<typeof formSchema>;

interface AddCategoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const iconOptions = [
  { value: "fas fa-tag", label: "Tag" },
  { value: "fas fa-utensils", label: "Food" },
  { value: "fas fa-car", label: "Transport" },
  { value: "fas fa-home", label: "Home" },
  { value: "fas fa-shopping-cart", label: "Shopping" },
  { value: "fas fa-gamepad", label: "Entertainment" },
  { value: "fas fa-heartbeat", label: "Health" },
  { value: "fas fa-graduation-cap", label: "Education" },
  { value: "fas fa-plane", label: "Travel" },
  { value: "fas fa-gift", label: "Gifts" },
  { value: "fas fa-dollar-sign", label: "Income" },
  { value: "fas fa-piggy-bank", label: "Savings" },
];

const colorOptions = [
  "#3B82F6", "#EF4444", "#10B981", "#F59E0B", "#8B5CF6",
  "#EC4899", "#06B6D4", "#84CC16", "#F97316", "#6366F1",
];

export function AddCategoryModal({ open, onOpenChange }: AddCategoryModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      color: "#3B82F6",
      icon: "fas fa-tag",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      console.log("Creating category with data:", data);
      setIsSubmitting(true);
      
      // Add optimistic update for instant feedback
      const categoryData = {
        ...data,
        isArchived: false,
      };
      
      const optimisticCategory = optimisticUpdates.addCategory(categoryData);
      
      try {
        const response = await apiRequest("POST", "/api/categories", data);
        console.log("Category creation response:", response);
        
        // Replace optimistic data with real data
        queryClient.setQueryData(['/api/categories'], (old: any[] = []) => {
          return old.map(item => 
            item._id === optimisticCategory._id ? response : item
          );
        });
        
        return response;
      } catch (error) {
        // Remove optimistic update on error
        optimisticUpdates.removeOptimistic('category', optimisticCategory._id);
        throw error;
      }
    },
    onSuccess: () => {
      console.log("Category creation successful");
      toast({
        title: "Success",
        description: "Category added successfully",
        variant: "success",
      });
      form.reset();
      setIsSubmitting(false);
      onOpenChange(false);
    },
    onError: (error: any) => {
      console.error("Category creation error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to add category",
        variant: "destructive",
      });
      setIsSubmitting(false);
    },
  });

  const onSubmit = (data: FormData) => {
    console.log("onSubmit called with data:", data, "isPending:", createMutation.isPending, "isSubmitting:", isSubmitting);
    if (createMutation.isPending || isSubmitting) {
      console.log("Mutation is pending or already submitting, skipping submission");
      return; // Prevent multiple submissions
    }
    console.log("Calling createMutation.mutate");
    createMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New Category</DialogTitle>
          <DialogDescription>
            Create a new category to organize your transactions.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Groceries" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Color</FormLabel>
                  <div className="grid grid-cols-5 gap-2">
                    {colorOptions.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className={`w-8 h-8 rounded-full border-2 ${
                          field.value === color
                            ? "border-gray-800"
                            : "border-gray-300"
                        }`}
                        style={{ backgroundColor: color }}
                        onClick={() => field.onChange(color)}
                      />
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="icon"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Icon</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an icon" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {iconOptions.map((icon) => (
                        <SelectItem key={icon.value} value={icon.value}>
                          <div className="flex items-center gap-2">
                            <i className={icon.value}></i>
                            {icon.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={createMutation.isPending || isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending || isSubmitting}>
                {createMutation.isPending || isSubmitting ? "Adding..." : "Add Category"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
