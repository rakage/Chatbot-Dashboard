"use client";

import { useSession } from "next-auth/react";
import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Settings,
  User,
  Bell,
  Shield,
  Palette,
  Save,
  Eye,
  EyeOff,
} from "lucide-react";

export default function SettingsPage() {
  const { data: session } = useSession();
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const [profileSettings, setProfileSettings] = useState({
    name: session?.user?.name || "",
    email: session?.user?.email || "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: true,
    pushNotifications: true,
    conversationUpdates: true,
    systemAlerts: true,
  });

  const handleProfileSave = async () => {
    setLoading(true);
    // TODO: Implement profile update API call
    setTimeout(() => {
      setLoading(false);
    }, 1000);
  };

  const handleNotificationSave = async () => {
    setLoading(true);
    // TODO: Implement notification settings API call
    setTimeout(() => {
      setLoading(false);
    }, 1000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2">
        <Settings className="h-8 w-8 text-gray-700" />
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Profile Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <User className="h-5 w-5 text-blue-600" />
              <span>Profile Settings</span>
            </CardTitle>
            <CardDescription>
              Update your personal information and password
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700">
                Full Name
              </label>
              <Input
                type="text"
                value={profileSettings.name}
                onChange={(e) =>
                  setProfileSettings((prev) => ({
                    ...prev,
                    name: e.target.value,
                  }))
                }
                placeholder="Enter your full name"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">Email</label>
              <Input
                type="email"
                value={profileSettings.email}
                disabled
                className="bg-gray-50"
              />
              <p className="text-xs text-gray-500 mt-1">
                Email cannot be changed. Contact an administrator if needed.
              </p>
            </div>

            <div className="border-t pt-4">
              <h4 className="text-sm font-medium text-gray-900 mb-3">
                Change Password
              </h4>

              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Current Password
                  </label>
                  <div className="relative">
                    <Input
                      type={showCurrentPassword ? "text" : "password"}
                      value={profileSettings.currentPassword}
                      onChange={(e) =>
                        setProfileSettings((prev) => ({
                          ...prev,
                          currentPassword: e.target.value,
                        }))
                      }
                      placeholder="Enter current password"
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      onClick={() =>
                        setShowCurrentPassword(!showCurrentPassword)
                      }
                    >
                      {showCurrentPassword ? (
                        <EyeOff className="h-4 w-4 text-gray-400" />
                      ) : (
                        <Eye className="h-4 w-4 text-gray-400" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">
                    New Password
                  </label>
                  <div className="relative">
                    <Input
                      type={showNewPassword ? "text" : "password"}
                      value={profileSettings.newPassword}
                      onChange={(e) =>
                        setProfileSettings((prev) => ({
                          ...prev,
                          newPassword: e.target.value,
                        }))
                      }
                      placeholder="Enter new password"
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                    >
                      {showNewPassword ? (
                        <EyeOff className="h-4 w-4 text-gray-400" />
                      ) : (
                        <Eye className="h-4 w-4 text-gray-400" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Confirm New Password
                  </label>
                  <Input
                    type="password"
                    value={profileSettings.confirmPassword}
                    onChange={(e) =>
                      setProfileSettings((prev) => ({
                        ...prev,
                        confirmPassword: e.target.value,
                      }))
                    }
                    placeholder="Confirm new password"
                  />
                </div>
              </div>
            </div>

            <Button
              onClick={handleProfileSave}
              disabled={loading}
              className="w-full"
            >
              <Save className="h-4 w-4 mr-2" />
              {loading ? "Saving..." : "Save Profile"}
            </Button>
          </CardContent>
        </Card>

        {/* Notification Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Bell className="h-5 w-5 text-yellow-600" />
              <span>Notification Settings</span>
            </CardTitle>
            <CardDescription>
              Configure how you receive notifications
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">
                    Email Notifications
                  </h4>
                  <p className="text-xs text-gray-500">
                    Receive notifications via email
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={notificationSettings.emailNotifications}
                  onChange={(e) =>
                    setNotificationSettings((prev) => ({
                      ...prev,
                      emailNotifications: e.target.checked,
                    }))
                  }
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">
                    Push Notifications
                  </h4>
                  <p className="text-xs text-gray-500">
                    Receive browser push notifications
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={notificationSettings.pushNotifications}
                  onChange={(e) =>
                    setNotificationSettings((prev) => ({
                      ...prev,
                      pushNotifications: e.target.checked,
                    }))
                  }
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">
                    Conversation Updates
                  </h4>
                  <p className="text-xs text-gray-500">
                    New messages and conversation changes
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={notificationSettings.conversationUpdates}
                  onChange={(e) =>
                    setNotificationSettings((prev) => ({
                      ...prev,
                      conversationUpdates: e.target.checked,
                    }))
                  }
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">
                    System Alerts
                  </h4>
                  <p className="text-xs text-gray-500">
                    Important system notifications
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={notificationSettings.systemAlerts}
                  onChange={(e) =>
                    setNotificationSettings((prev) => ({
                      ...prev,
                      systemAlerts: e.target.checked,
                    }))
                  }
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
              </div>
            </div>

            <Button
              onClick={handleNotificationSave}
              disabled={loading}
              className="w-full"
            >
              <Save className="h-4 w-4 mr-2" />
              {loading ? "Saving..." : "Save Notifications"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Role Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Shield className="h-5 w-5 text-purple-600" />
            <span>Account Information</span>
          </CardTitle>
          <CardDescription>Your current role and permissions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <h4 className="text-sm font-medium text-gray-900">Role</h4>
              <p className="text-lg font-semibold text-blue-600">
                {session?.user?.role}
              </p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-900">Company</h4>
              <p className="text-lg text-gray-700">
                {session?.user?.companyName || "No Company"}
              </p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-900">
                Member Since
              </h4>
              <p className="text-lg text-gray-700">
                {new Date().toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                })}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
