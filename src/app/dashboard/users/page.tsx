"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Role } from "@prisma/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Users,
  UserPlus,
  AlertCircle,
  Crown,
  Shield,
  User,
  Mail,
  Calendar,
  Trash2,
  Loader2,
  Eye,
  EyeOff,
} from "lucide-react";

interface User {
  id: string;
  email: string;
  name?: string;
  role: Role;
  createdAt: string;
  updatedAt: string;
  companyId?: string;
}

interface CreateUserForm {
  email: string;
  name: string;
  role: Role;
  password: string;
  confirmPassword: string;
}

export default function UsersPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const { toast } = useToast();

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [createForm, setCreateForm] = useState<CreateUserForm>({
    email: "",
    name: "",
    role: Role.AGENT,
    password: "",
    confirmPassword: "",
  });

  // Check if user has permission to access this page
  useEffect(() => {
    if (
      session?.user?.role &&
      !["OWNER", "ADMIN"].includes(session.user.role)
    ) {
      router.push("/dashboard");
    }
  }, [session, router]);

  // Fetch users from API
  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/users");

      if (!response.ok) {
        throw new Error("Failed to fetch users");
      }

      const data = await response.json();
      setUsers(data.users || []);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast({
        title: "Error",
        description: "Failed to fetch users",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session?.user?.role && ["OWNER", "ADMIN"].includes(session.user.role)) {
      fetchUsers();
    }
  }, [session]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();

    if (createForm.password !== createForm.confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match",
        variant: "destructive",
      });
      return;
    }

    if (createForm.password.length < 8) {
      toast({
        title: "Error",
        description: "Password must be at least 8 characters long",
        variant: "destructive",
      });
      return;
    }

    try {
      setCreateLoading(true);
      const response = await fetch("/api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: createForm.email,
          name: createForm.name,
          role: createForm.role,
          password: createForm.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create user");
      }

      toast({
        title: "Success",
        description: "User created successfully",
      });

      // Reset form and close dialog
      setCreateForm({
        email: "",
        name: "",
        role: Role.AGENT,
        password: "",
        confirmPassword: "",
      });
      setCreateDialogOpen(false);

      // Refresh users list
      fetchUsers();
    } catch (error) {
      console.error("Error creating user:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to create user",
        variant: "destructive",
      });
    } finally {
      setCreateLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    try {
      setDeleteLoading(userId);
      const response = await fetch(`/api/users/${userId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete user");
      }

      toast({
        title: "Success",
        description: `User ${userName} deleted successfully`,
      });

      // Refresh users list
      fetchUsers();
    } catch (error) {
      console.error("Error deleting user:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to delete user",
        variant: "destructive",
      });
    } finally {
      setDeleteLoading(null);
    }
  };

  const getRoleIcon = (role: Role) => {
    switch (role) {
      case Role.OWNER:
        return <Crown className="h-4 w-4 text-yellow-500" />;
      case Role.ADMIN:
        return <Shield className="h-4 w-4 text-blue-500" />;
      case Role.AGENT:
        return <User className="h-4 w-4 text-green-500" />;
      default:
        return <User className="h-4 w-4 text-gray-500" />;
    }
  };

  const getRoleBadgeColor = (role: Role) => {
    switch (role) {
      case Role.OWNER:
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case Role.ADMIN:
        return "bg-blue-100 text-blue-800 border-blue-200";
      case Role.AGENT:
        return "bg-green-100 text-green-800 border-green-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Don't render if user doesn't have permission
  if (session?.user?.role && !["OWNER", "ADMIN"].includes(session.user.role)) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Access Denied
          </h2>
          <p className="text-gray-600">
            You don't have permission to access this page.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <Users className="h-8 w-8 text-gray-700" />
            <h1 className="text-3xl font-bold text-gray-900">Users</h1>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }, (_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="space-y-3">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  <div className="h-6 bg-gray-200 rounded w-1/3"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const roleStats = users.reduce((acc, user) => {
    acc[user.role] = (acc[user.role] || 0) + 1;
    return acc;
  }, {} as Record<Role, number>);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <Users className="h-8 w-8 text-gray-700" />
          <h1 className="text-3xl font-bold text-gray-900">Users</h1>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="h-4 w-4 mr-2" />
              Create User
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <form onSubmit={handleCreateUser}>
              <DialogHeader>
                <DialogTitle>Create New User</DialogTitle>
                <DialogDescription>
                  Add a new user to your company. They will be able to log in
                  immediately.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="user@company.com"
                    value={createForm.email}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, email: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="John Doe"
                    value={createForm.name}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, name: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="role">Role</Label>
                  <Select
                    value={createForm.role}
                    onValueChange={(value: Role) =>
                      setCreateForm({ ...createForm, role: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={Role.AGENT}>
                        <div className="flex items-center">
                          <User className="h-4 w-4 text-green-500 mr-2" />
                          Agent
                        </div>
                      </SelectItem>
                      {session?.user?.role === Role.OWNER && (
                        <SelectItem value={Role.ADMIN}>
                          <div className="flex items-center">
                            <Shield className="h-4 w-4 text-blue-500 mr-2" />
                            Admin
                          </div>
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Minimum 8 characters"
                      value={createForm.password}
                      onChange={(e) =>
                        setCreateForm({
                          ...createForm,
                          password: e.target.value,
                        })
                      }
                      required
                      minLength={8}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-gray-400" />
                      ) : (
                        <Eye className="h-4 w-4 text-gray-400" />
                      )}
                    </Button>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Confirm password"
                      value={createForm.confirmPassword}
                      onChange={(e) =>
                        setCreateForm({
                          ...createForm,
                          confirmPassword: e.target.value,
                        })
                      }
                      required
                      minLength={8}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() =>
                        setShowConfirmPassword(!showConfirmPassword)
                      }
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4 text-gray-400" />
                      ) : (
                        <Eye className="h-4 w-4 text-gray-400" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateDialogOpen(false)}
                  disabled={createLoading}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createLoading}>
                  {createLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create User"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Users className="h-5 w-5 text-gray-500" />
              <div>
                <p className="text-2xl font-bold">{users.length}</p>
                <p className="text-sm text-gray-600">Total Users</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Crown className="h-5 w-5 text-yellow-500" />
              <div>
                <p className="text-2xl font-bold">
                  {roleStats[Role.OWNER] || 0}
                </p>
                <p className="text-sm text-gray-600">Owners</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Shield className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">
                  {roleStats[Role.ADMIN] || 0}
                </p>
                <p className="text-sm text-gray-600">Admins</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <User className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-2xl font-bold">
                  {roleStats[Role.AGENT] || 0}
                </p>
                <p className="text-sm text-gray-600">Agents</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Users Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {users.map((user) => (
          <Card key={user.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-2">
                  {getRoleIcon(user.role)}
                  <div>
                    <CardTitle className="text-base">{user.name}</CardTitle>
                    <CardDescription className="flex items-center text-sm">
                      <Mail className="h-3 w-3 mr-1" />
                      {user.email}
                    </CardDescription>
                  </div>
                </div>
                {user.role !== Role.OWNER && user.id !== session?.user?.id && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                        disabled={deleteLoading === user.id}
                      >
                        {deleteLoading === user.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete User</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete {user.name}? This
                          action cannot be undone and will immediately revoke
                          their access to the system.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-red-600 hover:bg-red-700"
                          onClick={() =>
                            handleDeleteUser(user.id, user.name || user.email)
                          }
                        >
                          Delete User
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Role:</span>
                  <span
                    className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getRoleBadgeColor(
                      user.role
                    )}`}
                  >
                    {getRoleIcon(user.role)}
                    <span className="ml-1">{user.role}</span>
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Joined:</span>
                  <span className="text-sm flex items-center">
                    <Calendar className="h-3 w-3 mr-1" />
                    {formatDate(user.createdAt)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {users.length === 0 && !loading && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No users found
            </h3>
            <p className="text-gray-600 text-center mb-4">
              Get started by creating your first user.
            </p>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Create User
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
