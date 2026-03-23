import { AlertTriangle, CheckCircle2, Headphones, LaptopMinimal, Shield } from "lucide-react";

import { PageHeader } from "../components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";

export function StudentHelp() {
  return (
    <div>
      <PageHeader
        title="Help Center"
        description="Everything a student needs before launch day: readiness checks, browser guidance, and support paths."
      />

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              Readiness Checklist
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-600">
            <p>Charge your device and connect to a reliable power source for long exams.</p>
            <p>Close extra browser tabs and background apps that may trigger proctoring alerts.</p>
            <p>Log in at least 10 minutes early to verify that your account, exam window, and browser are working.</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LaptopMinimal className="h-5 w-5 text-blue-600" />
              Device Guidance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-600">
            <p>Use the latest Chrome or Edge for the most stable fullscreen and camera permissions.</p>
            <p>Allow microphone and camera access if the exam is marked as proctored.</p>
            <p>Avoid using mobile devices unless your school has explicitly approved them.</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Headphones className="h-5 w-5 text-orange-600" />
              Support
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-600">
            <p>Contact your school administrator first for account, schedule, or assignment issues.</p>
            <p>If an exam session freezes, keep the page open and report the incident with the exact time and exam name.</p>
            <p>For accessibility accommodations, request support before the exam window opens.</p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-blue-600" />
              Proctoring Notes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-600">
            <p>Do not switch tabs, leave fullscreen, or disconnect your camera during a protected exam.</p>
            <p>Keep your face visible and remain in frame if remote proctoring is enabled.</p>
            <p>Unexpected interruptions should be reported immediately after the session ends.</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              Common Problems
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-600">
            <p>If you cannot see an exam, confirm that the schedule window is open and you are logged into the correct account.</p>
            <p>If uploads or media fail, refresh only after checking whether your current exam policy allows it.</p>
            <p>If results are missing, they may still be unpublished even if the submission is complete.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
