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

const formSchema = z.object({
  name: z.string().min(1, "Category name is required"),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, "Please select a valid color"),
  icon: z.string().min(1, "Please select an icon"),
});

type FormData = z.infer<typeof formSchema>;

const iconOptions = [
  { value: "fas fa-utensils", label: "Food & Dining", icon: "fas fa-utensils" },
  { value: "fas fa-car", label: "Transportation", icon: "fas fa-car" },
  { value: "fas fa-film", label: "Entertainment", icon: "fas fa-film" },
  { value: "fas fa-shopping-bag", label: "Shopping", icon: "fas fa-shopping-bag" },
  { value: "fas fa-bolt", label: "Utilities", icon: "fas fa-bolt" },
  { value: "fas fa-dollar-sign", label: "Income", icon: "fas fa-dollar-sign" },
  { value: "fas fa-heartbeat", label: "Healthcare", icon: "fas fa-heartbeat" },
  { value: "fas fa-graduation-cap", label: "Education", icon: "fas fa-graduation-cap" },
  { value: "fas fa-home", label: "Housing", icon: "fas fa-home" },
  { value: "fas fa-gamepad", label: "Gaming", icon: "fas fa-gamepad" },
  { value: "fas fa-plane", label: "Travel", icon: "fas fa-plane" },
  { value: "fas fa-gift", label: "Gifts", icon: "fas fa-gift" },
];

const colorOptions = [
  "#3B82F6", "#10B981", "#F59E0B", "#8B5CF6", "#EF4444", "#059669",
  "#EC4899", "#6366F1", "#F97316", "#84CC16", "#06B6D4", "#8B5A2B",
];

interface AddCategoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddCategoryModal({ open, onOpenChange }: AddCategoryModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

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
      const response = await apiRequest("POST", "/api/categories", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      toast({
        title: "Success",
        description: "Category added successfully",
        variant: "success",
      });
      form.reset();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add category",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    createMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New Category</DialogTitle>
          <DialogDescription>
            Create a new category for organizing your transactions.
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
                      {iconOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          <div className="flex items-center">
                            <i className={`${option.icon} mr-2`} />
                            {option.label}
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
              name="color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Color</FormLabel>
                  <FormControl>
                    <div className="flex flex-wrap gap-2">
                      {colorOptions.map((color) => (
                        <button
                          key={color}
                          type="button"
                          className={`w-8 h-8 rounded-full border-2 ${
                            field.value === color ? "border-foreground" : "border-border"
                          }`}
                          style={{ backgroundColor: color }}
                          onClick={() => field.onChange(color)}
                        />
                      ))}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={createMutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Adding..." : "Add Category"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
