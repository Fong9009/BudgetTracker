import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Camera, Eye, EyeOff, Save, User, Mail, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const usernameFormSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
});

const emailFormSchema = z.object({
  email: z.string().email("Please enter a valid email"),
});

const passwordFormSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type UsernameFormData = z.infer<typeof usernameFormSchema>;
type EmailFormData = z.infer<typeof emailFormSchema>;
type PasswordFormData = z.infer<typeof passwordFormSchema>;

export default function Profile() {
  const { user, login } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // Confirmation dialog states
  const [showUsernameConfirmation, setShowUsernameConfirmation] = useState(false);
  const [showEmailConfirmation, setShowEmailConfirmation] = useState(false);
  const [showPasswordConfirmation, setShowPasswordConfirmation] = useState(false);
  const [pendingUsernameData, setPendingUsernameData] = useState<UsernameFormData | null>(null);
  const [pendingEmailData, setPendingEmailData] = useState<EmailFormData | null>(null);
  const [pendingPasswordData, setPendingPasswordData] = useState<PasswordFormData | null>(null);

  const usernameForm = useForm<UsernameFormData>({
    resolver: zodResolver(usernameFormSchema),
    defaultValues: {
      username: user?.username || "",
    },
  });

  const emailForm = useForm<EmailFormData>({
    resolver: zodResolver(emailFormSchema),
    defaultValues: {
      email: user?.email || "",
    },
  });

  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const updateUsernameMutation = useMutation({
    mutationFn: async (data: UsernameFormData) => {
      return await apiRequest("PUT", "/api/auth/profile", data);
    },
    onSuccess: (response) => {
      toast({
        title: "Username Updated",
        description: "Your username has been updated successfully.",
      });
      if (response.user) {
        login(response.token || localStorage.getItem("token") || "", response.user);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update username",
        variant: "destructive",
      });
    },
  });

  const updateEmailMutation = useMutation({
    mutationFn: async (data: EmailFormData) => {
      return await apiRequest("PUT", "/api/auth/profile", data);
    },
    onSuccess: (response) => {
      toast({
        title: "Email Updated",
        description: "Your email has been updated successfully.",
      });
      if (response.user) {
        login(response.token || localStorage.getItem("token") || "", response.user);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update email",
        variant: "destructive",
      });
    },
  });

  const updatePasswordMutation = useMutation({
    mutationFn: async (data: PasswordFormData) => {
      return await apiRequest("PUT", "/api/auth/change-password", data);
    },
    onSuccess: () => {
      toast({
        title: "Password Updated",
        description: "Your password has been changed successfully.",
      });
      passwordForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error", 
        description: error.message || "Failed to update password",
        variant: "destructive",
      });
    },
  });

  const onUsernameSubmit = (data: UsernameFormData) => {
    setPendingUsernameData(data);
    setShowUsernameConfirmation(true);
  };

  const onEmailSubmit = (data: EmailFormData) => {
    setPendingEmailData(data);
    setShowEmailConfirmation(true);
  };

  const onPasswordSubmit = (data: PasswordFormData) => {
    setPendingPasswordData(data);
    setShowPasswordConfirmation(true);
  };

  const handleConfirmUsernameUpdate = () => {
    if (pendingUsernameData) {
      updateUsernameMutation.mutate(pendingUsernameData);
      setShowUsernameConfirmation(false);
      setPendingUsernameData(null);
    }
  };

  const handleConfirmEmailUpdate = () => {
    if (pendingEmailData) {
      updateEmailMutation.mutate(pendingEmailData);
      setShowEmailConfirmation(false);
      setPendingEmailData(null);
    }
  };

  const handleConfirmPasswordUpdate = () => {
    if (pendingPasswordData) {
      updatePasswordMutation.mutate(pendingPasswordData);
      setShowPasswordConfirmation(false);
      setPendingPasswordData(null);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Profile Settings</h1>
        <p className="text-muted-foreground">Manage your account settings and preferences</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Profile Information Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Profile Information
            </CardTitle>
            <CardDescription>
              Update your name and email address
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Username Form */}
            <Form {...usernameForm}>
              <form onSubmit={usernameForm.handleSubmit(onUsernameSubmit)} className="space-y-2">
                <FormField
                  control={usernameForm.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <div className="flex gap-2">
                        <FormControl>
                          <Input 
                            placeholder={`Current: ${user?.username || "Enter username"}`} 
                            {...field} 
                          />
                        </FormControl>
                        <Button 
                          type="submit" 
                          size="sm"
                          disabled={updateUsernameMutation.isPending}
                          className="flex items-center gap-1"
                        >
                          <Save className="h-3 w-3" />
                          {updateUsernameMutation.isPending ? "..." : "Save"}
                        </Button>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </form>
            </Form>

            {/* Email Form */}
            <Form {...emailForm}>
              <form onSubmit={emailForm.handleSubmit(onEmailSubmit)} className="space-y-2">
                <FormField
                  control={emailForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address</FormLabel>
                      <div className="flex gap-2">
                        <FormControl>
                          <Input 
                            placeholder={`Current: ${user?.email || "Enter email"}`} 
                            type="email" 
                            {...field} 
                          />
                        </FormControl>
                        <Button 
                          type="submit" 
                          size="sm"
                          disabled={updateEmailMutation.isPending}
                          className="flex items-center gap-1"
                        >
                          <Save className="h-3 w-3" />
                          {updateEmailMutation.isPending ? "..." : "Save"}
                        </Button>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Password Change Card */}
        <Card>
          <CardHeader>
            <CardTitle>Change Password</CardTitle>
            <CardDescription>
              Update your password to keep your account secure
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...passwordForm}>
              <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
                <FormField
                  control={passwordForm.control}
                  name="currentPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showCurrentPassword ? "text" : "password"}
                            placeholder="Enter current password"
                            {...field}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                            onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                          >
                            {showCurrentPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={passwordForm.control}
                  name="newPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showNewPassword ? "text" : "password"}
                            placeholder="Enter new password"
                            {...field}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                            onClick={() => setShowNewPassword(!showNewPassword)}
                          >
                            {showNewPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={passwordForm.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm New Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showConfirmPassword ? "text" : "password"}
                            placeholder="Confirm new password"
                            {...field}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          >
                            {showConfirmPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full"
                  disabled={updatePasswordMutation.isPending}
                >
                  {updatePasswordMutation.isPending ? "Updating..." : "Change Password"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
      
      {/* Username Update Confirmation */}
      <AlertDialog open={showUsernameConfirmation} onOpenChange={setShowUsernameConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Username Update</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to update your username? This action will change your display name.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowUsernameConfirmation(false);
              setPendingUsernameData(null);
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmUsernameUpdate}>
              {updateUsernameMutation.isPending ? "Updating..." : "Update Username"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Email Update Confirmation */}
      <AlertDialog open={showEmailConfirmation} onOpenChange={setShowEmailConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Email Update</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to update your email address? This action will change your login email.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowEmailConfirmation(false);
              setPendingEmailData(null);
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmEmailUpdate}>
              {updateEmailMutation.isPending ? "Updating..." : "Update Email"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Password Update Confirmation */}
      <AlertDialog open={showPasswordConfirmation} onOpenChange={setShowPasswordConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Password Change</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to change your password? This action will update your account security.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowPasswordConfirmation(false);
              setPendingPasswordData(null);
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmPasswordUpdate}>
              {updatePasswordMutation.isPending ? "Updating..." : "Change Password"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}