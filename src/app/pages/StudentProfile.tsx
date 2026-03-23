import { useEffect, useMemo, useState } from "react";
import { Lock, Phone, School, User } from "lucide-react";

import { useAuth } from "../auth/useAuth";
import { PageHeader } from "../components/PageHeader";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { apiRequest } from "../lib/http";
import { notify } from "../lib/notify";
import { useMutationState } from "../hooks/useMutationState";

export function StudentProfile() {
  const { profile, refreshProfile } = useAuth();
  const profileMutation = useMutationState();
  const passwordMutation = useMutationState();

  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [phoneNumber, setPhoneNumber] = useState(profile?.phone_number ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  useEffect(() => {
    setFullName(profile?.full_name ?? "");
    setPhoneNumber(profile?.phone_number ?? "");
  }, [profile?.full_name, profile?.phone_number]);

  const initials = useMemo(() => {
    const name = profile?.full_name || profile?.email || "ST";
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

  return (
    <div>
      <PageHeader
        title="Student Profile"
        description="Review account details, update your contact information, and keep your login secure."
      />

      {(profileMutation.error || passwordMutation.error) ? (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {profileMutation.error ?? passwordMutation.error}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[320px,minmax(0,1fr)]">
        <Card className="border-slate-200">
          <CardContent className="space-y-5 p-6">
            <div className="flex flex-col items-center text-center">
              <Avatar className="h-24 w-24">
                <AvatarImage src={profile?.avatar_url || undefined} />
                <AvatarFallback>{initials || "ST"}</AvatarFallback>
              </Avatar>
              <h2 className="mt-4 text-xl font-semibold text-slate-950">{profile?.full_name || "Student"}</h2>
              <p className="text-sm text-slate-500">{profile?.email}</p>
            </div>

            <div className="space-y-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
              <div className="flex items-start gap-3">
                <User className="mt-0.5 h-4 w-4 text-blue-600" />
                <div>
                  <p className="font-medium text-slate-900">Roles</p>
                  <p>{(profile?.roles ?? []).join(", ") || "candidate"}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <School className="mt-0.5 h-4 w-4 text-blue-600" />
                <div>
                  <p className="font-medium text-slate-900">School</p>
                  <p>{profile?.school?.name ?? "Not assigned"}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Phone className="mt-0.5 h-4 w-4 text-blue-600" />
                <div>
                  <p className="font-medium text-slate-900">Phone</p>
                  <p>{profile?.phone_number || "Not set"}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle>Account Details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-5 p-6 md:grid-cols-2">
              <div className="md:col-span-2">
                <Label htmlFor="student-profile-full-name">Full Name</Label>
                <Input
                  id="student-profile-full-name"
                  className="mt-2"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="student-profile-email">Email</Label>
                <Input id="student-profile-email" className="mt-2" value={profile?.email ?? ""} disabled />
              </div>
              <div>
                <Label htmlFor="student-profile-phone">Phone Number</Label>
                <Input
                  id="student-profile-phone"
                  className="mt-2"
                  value={phoneNumber}
                  onChange={(event) => setPhoneNumber(event.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="student-profile-status">Account Status</Label>
                <Input id="student-profile-status" className="mt-2" value={profile?.status ?? ""} disabled />
              </div>
              <div>
                <Label htmlFor="student-profile-school">School</Label>
                <Input
                  id="student-profile-school"
                  className="mt-2"
                  value={profile?.school?.name ?? "Not assigned"}
                  disabled
                />
              </div>
              <div className="md:col-span-2 flex justify-end">
                <Button onClick={() => void saveProfile()} disabled={profileMutation.isSubmitting}>
                  {profileMutation.isSubmitting ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-blue-600" />
                Security
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-5 p-6 md:grid-cols-2">
              <div>
                <Label htmlFor="student-profile-current-password">Current Password</Label>
                <Input
                  id="student-profile-current-password"
                  type="password"
                  className="mt-2"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="student-profile-new-password">New Password</Label>
                <Input
                  id="student-profile-new-password"
                  type="password"
                  className="mt-2"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                />
              </div>
              <div className="md:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                Use a password you do not reuse elsewhere and change it before high-stakes exam windows if your account is shared on school devices.
              </div>
              <div className="md:col-span-2 flex justify-end">
                <Button onClick={() => void changePassword()} disabled={passwordMutation.isSubmitting}>
                  {passwordMutation.isSubmitting ? "Updating..." : "Update Password"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
