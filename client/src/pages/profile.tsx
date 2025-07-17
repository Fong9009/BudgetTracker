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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  
  // Modal states
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  
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
    setShowUsernameModal(false);
    setShowUsernameConfirmation(true);
  };

  const onEmailSubmit = (data: EmailFormData) => {
    setPendingEmailData(data);
    setShowEmailModal(false);
    setShowEmailConfirmation(true);
  };

  const onPasswordSubmit = (data: PasswordFormData) => {
    setPendingPasswordData(data);
    setShowPasswordModal(false);
    setShowPasswordConfirmation(true);
  };

  // Password strength checker
  const checkPasswordStrength = (password: string) => {
    let strength = 0;
    let feedback = [];
    
    if (password.length >= 8) strength += 1;
    else feedback.push("At least 8 characters");
    
    if (/[A-Z]/.test(password)) strength += 1;
    else feedback.push("One uppercase letter");
    
    if (/[a-z]/.test(password)) strength += 1;
    else feedback.push("One lowercase letter");
    
    if (/[0-9]/.test(password)) strength += 1;
    else feedback.push("One number");
    
    if (/[^A-Za-z0-9]/.test(password)) strength += 1;
    else feedback.push("One special character");
    
    const levels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'];
    const colors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-blue-500', 'bg-green-500'];
    
    return {
      strength,
      level: levels[strength] || 'Very Weak',
      color: colors[strength] || 'bg-red-500',
      feedback
    };
  };

  const passwordStrength = checkPasswordStrength(passwordForm.watch('newPassword') || '');

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
            {/* Username Display */}
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Username:</Label>
                <p className="text-base font-medium mt-1">{user?.username || "Not set"}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowUsernameModal(true)}
                className="flex items-center gap-1"
              >
                <Edit className="h-3 w-3" />
                Edit
              </Button>
            </div>

            {/* Email Display */}
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Email:</Label>
                <p className="text-base font-medium mt-1">{user?.email || "Not set"}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowEmailModal(true)}
                className="flex items-center gap-1"
              >
                <Edit className="h-3 w-3" />
                Edit
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Password Change Card */}
        <Card>
          <CardHeader>
            <CardTitle>Password</CardTitle>
            <CardDescription>
              Keep your account secure with a strong password
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Password:</Label>
                <p className="text-base font-medium mt-1">••••••••••••</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPasswordModal(true)}
                className="flex items-center gap-1"
              >
                <Edit className="h-3 w-3" />
                Change
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Username Edit Modal */}
      <Dialog open={showUsernameModal} onOpenChange={setShowUsernameModal}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Username</DialogTitle>
            <DialogDescription>
              Update your username. This will change your display name.
            </DialogDescription>
          </DialogHeader>
          <Form {...usernameForm}>
            <form onSubmit={usernameForm.handleSubmit(onUsernameSubmit)} className="space-y-4">
              <FormField
                control={usernameForm.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Enter new username" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowUsernameModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">
                  Update Username
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Email Edit Modal */}
      <Dialog open={showEmailModal} onOpenChange={setShowEmailModal}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Email</DialogTitle>
            <DialogDescription>
              Update your email address. This will change your login email.
            </DialogDescription>
          </DialogHeader>
          <Form {...emailForm}>
            <form onSubmit={emailForm.handleSubmit(onEmailSubmit)} className="space-y-4">
              <FormField
                control={emailForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Enter new email" 
                        type="email"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowEmailModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">
                  Update Email
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Password Change Modal */}
      <Dialog open={showPasswordModal} onOpenChange={setShowPasswordModal}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>
              Update your password to keep your account secure.
            </DialogDescription>
          </DialogHeader>
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
                    {field.value && (
                      <div className="mt-2 space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-200 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full transition-all duration-300 ${passwordStrength.color}`}
                              style={{ width: `${(passwordStrength.strength / 5) * 100}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium">{passwordStrength.level}</span>
                        </div>
                        {passwordStrength.feedback.length > 0 && (
                          <div className="text-sm text-muted-foreground">
                            <p className="font-medium mb-1">Requirements:</p>
                            <ul className="list-disc list-inside space-y-1">
                              {passwordStrength.feedback.map((item, index) => (
                                <li key={index}>{item}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
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

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowPasswordModal(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  disabled={passwordStrength.strength < 3}
                >
                  Change Password
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
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