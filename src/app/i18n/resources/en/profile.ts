const profile = {
  emailUnavailable: "No email available",
  student: {
    title: "Student Profile",
    description: "Review imported account details, manage your password, and keep device preferences aligned with your exam workspace.",
    userFallback: "Student",
    sections: {
      accountDetails: "Account Details",
      security: "Security",
      systemSettings: "System Settings",
    },
    labels: {
      roles: "Roles",
      school: "School",
      phone: "Phone",
      fullName: "Full Name",
      email: "Email",
      phoneNumber: "Phone Number",
      accountStatus: "Account Status",
      currentPassword: "Current Password",
      newPassword: "New Password",
      appearanceTheme: "Appearance Theme",
      defaultLanguage: "Default Language",
    },
    values: {
      notAssigned: "Not assigned",
      notSet: "Not set",
    },
    buttons: {
      saveChanges: "Save Changes",
      saving: "Saving...",
      updatePassword: "Update Password",
      updatingPassword: "Updating...",
    },
    messages: {
      profileUpdated: "Profile updated.",
      profileUpdateFailed: "Unable to update profile.",
      passwordUpdated: "Password updated.",
      passwordUpdateFailed: "Unable to change password.",
      passwordRequired: "Current and new password are required.",
      settingsSaved: "Preferences are saved automatically on this device and apply immediately to the student workspace.",
      registrationLocked: "These registration details come from the imported roster and cannot be changed by the student account.",
    },
    securityNote:
      "Use a password you do not reuse elsewhere and change it before high-stakes exam windows if your account is shared on school devices.",
    themes: {
      light: "Light",
      dark: "Dark",
      system: "System",
    },
    status: {
      active: "Active",
      pending: "Pending",
      locked: "Locked",
      inactive: "Inactive",
    },
  },
};

export default profile;
