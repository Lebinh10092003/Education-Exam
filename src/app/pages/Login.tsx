import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { notify } from "../lib/notify";

import { getDefaultRouteForProfile } from "../auth/AuthContext";
import { useAuth } from "../auth/useAuth";
import { useMutationState } from "../hooks/useMutationState";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Checkbox } from "../components/ui/checkbox";

export function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { isSubmitting, error, run } = useMutationState();

  const [identifier, setIdentifier] = useState("admin@example.com");
  const [password, setPassword] = useState("admin123456");
  const [rememberMe, setRememberMe] = useState(true);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      const profile = await run(() => login(identifier.trim(), password));
      notify.success("Signed in successfully.");
      navigate(getDefaultRouteForProfile(profile), { replace: true });
    } catch {
      notify.error("Unable to sign in with the provided credentials.");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-100 flex items-center justify-center p-6">
      <Card className="w-full max-w-md shadow-xl border-blue-100">
        <CardHeader className="text-center pb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-200">
            <span className="text-white font-bold text-3xl">E</span>
          </div>
          <CardTitle className="text-3xl font-bold">EduExam</CardTitle>
          <p className="text-gray-600 mt-2">Sign in to your account</p>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <Label htmlFor="identifier">Email or Username</Label>
              <Input
                id="identifier"
                type="text"
                placeholder="you@example.com or your.username"
                className="mt-2"
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                autoComplete="username"
                required
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                className="mt-2"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked === true)}
                />
                <span className="text-sm text-gray-600">Remember me</span>
              </label>
              <Link
                to="/forgot-password"
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                Forgot password?
              </Link>
            </div>
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}
            <Button className="w-full" size="lg" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Signing In..." : "Sign In"}
            </Button>
          </form>
          <div className="mt-6 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
            <p className="font-medium">Local demo credentials</p>
            <p className="mt-1">admin@example.com / admin123456</p>
          </div>
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Don&apos;t have an account?{" "}
              <span className="text-blue-600 font-medium">Contact Administrator</span>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
