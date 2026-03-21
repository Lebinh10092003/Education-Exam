import { useEffect, useMemo, useState } from "react";
import { notify } from "../lib/notify";
import { Bell, Lock, User } from "lucide-react";

import { PageHeader } from "../components/PageHeader";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Switch } from "../components/ui/switch";
import { apiRequest } from "../lib/http";
import { useMutationState } from "../hooks/useMutationState";
import { useAuth } from "../auth/useAuth";

interface NotificationPreferences {
  emailNotifications: boolean;
  examAlerts: boolean;
  candidateActivity: boolean;
  weeklyReports: boolean;
}

const NOTIFICATION_STORAGE_KEY = "eduexam.profile.notifications";

const defaultPreferences: NotificationPreferences = {
  emailNotifications: true,
  examAlerts: true,
  candidateActivity: true,
  weeklyReports: false,
};

export function Profile() {
  const { profile, refreshProfile } = useAuth();
  const profileMutation = useMutationState();
  const passwordMutation = useMutationState();
  const notificationMutation = useMutationState();

  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [phoneNumber, setPhoneNumber] = useState(profile?.phone_number ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [notificationPreferences, setNotificationPreferences] =
    useState<NotificationPreferences>(defaultPreferences);

  useEffect(() => {
    setFullName(profile?.full_name ?? "");
    setPhoneNumber(profile?.phone_number ?? "");
  }, [profile?.full_name, profile?.phone_number]);

  useEffect(() => {
    const rawValue = window.localStorage.getItem(NOTIFICATION_STORAGE_KEY);
    if (!rawValue) {
      return;
    }
    try {
      setNotificationPreferences({
        ...defaultPreferences,
        ...(JSON.parse(rawValue) as Partial<NotificationPreferences>),
      });
    } catch {
      setNotificationPreferences(defaultPreferences);
    }
  }, []);

  const initials = useMemo(() => {
    const name = profile?.full_name || profile?.email || "EU";
    return name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("");
  }, [profile?.email, profile?.full_name]);

  const saveProfile = async () => {
    try {
      await profileMutation.run(() =>
        apiRequest("/api/v1/profile/", {
          method: "PATCH",
          body: {
            full_name: fullName.trim(),
            phone_number: phoneNumber.trim(),
          },
        }),
      );
      await refreshProfile();
      notify.success("Profile updated.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update profile.";
      notify.error(message);
    }
  };

  const changePassword = async () => {
    if (!currentPassword || !newPassword) {
      notify.error("Current and new password are required.");
      return;
    }
    try {
      await passwordMutation.run(() =>
        apiRequest("/api/v1/profile/change-password/", {
          method: "POST",
          body: {
            current_password: currentPassword,
            new_password: newPassword,
          },
        }),
      );
      setCurrentPassword("");
      setNewPassword("");
      notify.success("Password updated.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to change password.";
      notify.error(message);
    }
  };

  const saveNotificationPreferences = async () => {
    try {
      await notificationMutation.run(async () => {
        window.localStorage.setItem(
          NOTIFICATION_STORAGE_KEY,
          JSON.stringify(notificationPreferences),
        );
      });
      notify.success("Notification preferences saved locally.");
    } catch {
      notify.error("Unable to save notification preferences.");
    }
  };

  return (
    <div>
      <PageHeader title="Profile Settings" description="Manage account details, password, and local preferences." />

      {(profileMutation.error || passwordMutation.error || notificationMutation.error) ? (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {profileMutation.error ?? passwordMutation.error ?? notificationMutation.error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Card className="lg:col-span-1">
          <CardContent className="p-6">
            <div className="flex flex-col items-center text-center">
              <Avatar className="w-24 h-24 mb-4">
                <AvatarImage src={profile?.avatar_url || undefined} />
                <AvatarFallback>{initials || "EU"}</AvatarFallback>
              </Avatar>
              <h3 className="font-semibold text-lg text-gray-900">{profile?.full_name || "EduExam User"}</h3>
              <p className="text-sm text-gray-600 mb-2">{profile?.email}</p>
              <p className="text-xs text-gray-500 rounded-full bg-blue-100 px-3 py-1">
                {(profile?.roles ?? []).join(", ") || "user"}
              </p>
              {profile?.school ? (
                <p className="mt-3 text-xs text-gray-500">School: {profile.school.name}</p>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardContent className="p-6">
            <Tabs defaultValue="profile">
              <TabsList className="mb-6">
                <TabsTrigger value="profile" className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Profile
                </TabsTrigger>
                <TabsTrigger value="security" className="flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  Security
                </TabsTrigger>
                <TabsTrigger value="notifications" className="flex items-center gap-2">
                  <Bell className="w-4 h-4" />
                  Notifications
                </TabsTrigger>
              </TabsList>

              <TabsContent value="profile" className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <Label htmlFor="profile-full-name">Full Name</Label>
                    <Input
                      id="profile-full-name"
                      className="mt-2"
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="profile-email">Email Address</Label>
                    <Input id="profile-email" className="mt-2" value={profile?.email ?? ""} disabled />
                  </div>
                  <div>
                    <Label htmlFor="profile-phone">Phone Number</Label>
                    <Input
                      id="profile-phone"
                      type="tel"
                      className="mt-2"
                      value={phoneNumber}
                      onChange={(event) => setPhoneNumber(event.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="profile-status">Account Status</Label>
                    <Input id="profile-status" className="mt-2" value={profile?.status ?? ""} disabled />
                  </div>
                  <div>
                    <Label htmlFor="profile-school">School</Label>
                    <Input
                      id="profile-school"
                      className="mt-2"
                      value={profile?.school?.name ?? "Not assigned"}
                      disabled
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button onClick={() => void saveProfile()} disabled={profileMutation.isSubmitting}>
                    {profileMutation.isSubmitting ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="security" className="space-y-6">
                <div>
                  <h3 className="font-semibold text-lg mb-4">Change Password</h3>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="current-password">Current Password</Label>
                      <Input
                        id="current-password"
                        type="password"
                        className="mt-2"
                        value={currentPassword}
                        onChange={(event) => setCurrentPassword(event.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="new-password">New Password</Label>
                      <Input
                        id="new-password"
                        type="password"
                        className="mt-2"
                        value={newPassword}
                        onChange={(event) => setNewPassword(event.target.value)}
                      />
                    </div>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button onClick={() => void changePassword()} disabled={passwordMutation.isSubmitting}>
                    {passwordMutation.isSubmitting ? "Updating..." : "Update Password"}
                  </Button>
                </div>

                <div className="pt-6 border-t">
                  <h3 className="font-semibold text-lg mb-2">Security Note</h3>
                  <p className="text-sm text-gray-600">
                    Two-factor authentication is not wired yet in this backend slice. Password change is live.
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="notifications" className="space-y-4">
                {(
                  [
                    ["emailNotifications", "Email Notifications", "Receive email updates about exam activities"],
                    ["examAlerts", "Exam Alerts", "Get notified when exams start or end"],
                    ["candidateActivity", "Candidate Activity", "Alerts for suspicious candidate behavior"],
                    ["weeklyReports", "Weekly Reports", "Receive a weekly summary of platform activity"],
                  ] as const
                ).map(([key, title, description]) => (
                  <div key={key} className="flex items-center justify-between rounded-lg bg-gray-50 p-4">
                    <div>
                      <p className="font-medium text-gray-900">{title}</p>
                      <p className="text-sm text-gray-600">{description}</p>
                    </div>
                    <Switch
                      checked={notificationPreferences[key]}
                      onCheckedChange={(checked) =>
                        setNotificationPreferences((current) => ({ ...current, [key]: checked === true }))
                      }
                    />
                  </div>
                ))}
                <div className="flex justify-end pt-4">
                  <Button
                    onClick={() => void saveNotificationPreferences()}
                    disabled={notificationMutation.isSubmitting}
                  >
                    {notificationMutation.isSubmitting ? "Saving..." : "Save Preferences"}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
