import { useState } from "react";
import { Link } from "react-router";
import { ArrowLeft } from "lucide-react";
import { notify } from "../lib/notify";

import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { apiRequest } from "../lib/http";
import { useMutationState } from "../hooks/useMutationState";

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const mutation = useMutationState();

  const handleSubmit = async () => {
    if (!email.trim()) {
      notify.error("Email is required.");
      return;
    }

    try {
      const response = await mutation.run(() =>
        apiRequest<{ detail: string }>("/api/v1/auth/forgot-password/", {
          method: "POST",
          auth: false,
          body: { email: email.trim() },
        }),
      );
      setSuccessMessage(response.detail);
      notify.success("Reset request accepted.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to request password reset.";
      notify.error(message);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center pb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-3xl">E</span>
          </div>
          <CardTitle className="text-2xl font-bold">Reset Password</CardTitle>
          <p className="text-gray-600 mt-2">
            Submit your email and the backend will accept the reset request.
          </p>
        </CardHeader>
        <CardContent>
          {successMessage ? (
            <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              {successMessage}
            </div>
          ) : null}
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void handleSubmit();
            }}
          >
            <div>
              <Label htmlFor="forgot-password-email">Email Address</Label>
              <Input
                id="forgot-password-email"
                type="email"
                placeholder="you@example.com"
                className="mt-2"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <Button className="w-full" size="lg" disabled={mutation.isSubmitting}>
              {mutation.isSubmitting ? "Sending..." : "Send Reset Link"}
            </Button>
          </form>
          <div className="mt-6 text-center">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Login
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
