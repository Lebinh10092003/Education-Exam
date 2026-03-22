import { useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Checkbox } from "../components/ui/checkbox";
import { ChevronRight, ChevronLeft, Check } from "lucide-react";
import { useNavigate } from "react-router";

const steps = [
  { id: 1, name: "Basic Info", description: "Exam details" },
  { id: 2, name: "Questions", description: "Select questions" },
  { id: 3, name: "Assignment", description: "Schedule & assign" },
];

export function ExamCreationWizard() {
  const [currentStep, setCurrentStep] = useState(1);
  const navigate = useNavigate();

  const nextStep = () => {
    if (currentStep < 3) setCurrentStep(currentStep + 1);
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const handleFinish = () => {
    // Navigate to exam management
    navigate("/exams");
  };

  return (
    <div>
      <PageHeader
        title="Create New Exam"
        description="Follow the steps to create a new examination"
      />

      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between max-w-3xl mx-auto">
          {steps.map((step, idx) => (
            <div key={step.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center border-2 ${
                    currentStep > step.id
                      ? "bg-green-600 border-green-600"
                      : currentStep === step.id
                      ? "bg-blue-600 border-blue-600"
                      : "bg-white border-gray-300"
                  }`}
                >
                  {currentStep > step.id ? (
                    <Check className="w-6 h-6 text-white" />
                  ) : (
                    <span
                      className={`text-lg font-semibold ${
                        currentStep === step.id
                          ? "text-white"
                          : "text-gray-400"
                      }`}
                    >
                      {step.id}
                    </span>
                  )}
                </div>
                <div className="mt-2 text-center">
                  <p
                    className={`text-sm font-medium ${
                      currentStep >= step.id
                        ? "text-gray-900"
                        : "text-gray-500"
                    }`}
                  >
                    {step.name}
                  </p>
                  <p className="text-xs text-gray-500">{step.description}</p>
                </div>
              </div>
              {idx < steps.length - 1 && (
                <div
                  className={`h-0.5 flex-1 mx-4 ${
                    currentStep > step.id ? "bg-green-600" : "bg-gray-300"
                  }`}
                ></div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <Card className="max-w-4xl mx-auto">
        <CardContent className="p-8">
          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-4">
                  Basic Exam Information
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <Label htmlFor="examName">Exam Name</Label>
                  <Input
                    id="examName"
                    placeholder="e.g., Mathematics Final Exam"
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="subject">Subject</Label>
                  <Select>
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Select subject" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="math">Mathematics</SelectItem>
                      <SelectItem value="physics">Physics</SelectItem>
                      <SelectItem value="chemistry">Chemistry</SelectItem>
                      <SelectItem value="biology">Biology</SelectItem>
                      <SelectItem value="cs">Computer Science</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="duration">Duration (minutes)</Label>
                  <Input
                    id="duration"
                    type="number"
                    placeholder="120"
                    className="mt-2"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Brief description of the exam"
                    className="mt-2"
                    rows={3}
                  />
                </div>
                <div>
                  <Label htmlFor="passingScore">Passing Score (%)</Label>
                  <Input
                    id="passingScore"
                    type="number"
                    placeholder="60"
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="maxAttempts">Max Attempts</Label>
                  <Input
                    id="maxAttempts"
                    type="number"
                    placeholder="1"
                    className="mt-2"
                  />
                </div>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-4">
                  Select Questions
                </h3>
                <p className="text-sm text-gray-600">
                  Choose questions from the question bank or generate randomly
                </p>
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="font-medium text-blue-900">
                        Random Selection
                      </h4>
                      <p className="text-sm text-blue-700 mt-1">
                        Automatically select questions based on criteria
                      </p>
                    </div>
                    <Checkbox />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label className="text-sm">Easy Questions</Label>
                      <Input type="number" placeholder="10" className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-sm">Medium Questions</Label>
                      <Input type="number" placeholder="15" className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-sm">Hard Questions</Label>
                      <Input type="number" placeholder="5" className="mt-1" />
                    </div>
                  </div>
                </div>

                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-4">Manual Selection</h4>
                  <Input placeholder="Search questions..." className="mb-4" />
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {[
                      "What is the derivative of x²?",
                      "Explain Newton's First Law",
                      "What is the molecular formula of water?",
                      "Describe photosynthesis",
                      "Time complexity of binary search?",
                    ].map((question, idx) => (
                      <label
                        key={idx}
                        className="flex items-start gap-3 p-3 hover:bg-gray-50 rounded-lg cursor-pointer"
                      >
                        <Checkbox className="mt-0.5" />
                        <div>
                          <p className="text-sm text-gray-900">{question}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {idx % 2 === 0 ? "Easy" : "Medium"} • Multiple Choice
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-4">
                  Schedule & Assignment
                </h3>
                <p className="text-sm text-gray-600">
                  Set exam schedule and assign to candidate groups
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="openingDate">Opening Date & Time</Label>
                  <Input
                    id="openingDate"
                    type="datetime-local"
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="closingDate">Closing Date & Time</Label>
                  <Input
                    id="closingDate"
                    type="datetime-local"
                    className="mt-2"
                  />
                </div>
              </div>

              <div>
                <Label>Assign to Groups</Label>
                <div className="mt-2 space-y-2 border rounded-lg p-4 max-h-64 overflow-y-auto">
                  {[
                    "Computer Science - Year 1",
                    "Mathematics Advanced",
                    "Physics Department",
                    "Chemistry Batch 2024",
                  ].map((group, idx) => (
                    <label
                      key={idx}
                      className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg cursor-pointer"
                    >
                      <Checkbox />
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {group}
                        </p>
                        <p className="text-xs text-gray-500">
                          {Math.floor(Math.random() * 50) + 20} members
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="p-4 bg-gray-50 rounded-lg border">
                <h4 className="font-medium mb-3">Additional Settings</h4>
                <div className="space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <Checkbox />
                    <div>
                      <p className="text-sm font-medium">Shuffle Questions</p>
                      <p className="text-xs text-gray-500">
                        Randomize question order for each candidate
                      </p>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <Checkbox />
                    <div>
                      <p className="text-sm font-medium">Show Results</p>
                      <p className="text-xs text-gray-500">
                        Display results immediately after completion
                      </p>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <Checkbox defaultChecked />
                    <div>
                      <p className="text-sm font-medium">Enable Proctoring</p>
                      <p className="text-xs text-gray-500">
                        Monitor candidate activity during exam
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between max-w-4xl mx-auto mt-6">
        <Button
          variant="outline"
          onClick={prevStep}
          disabled={currentStep === 1}
        >
          <ChevronLeft className="w-4 h-4 mr-2" />
          Previous
        </Button>
        <div className="text-sm text-gray-600">
          Step {currentStep} of {steps.length}
        </div>
        {currentStep < 3 ? (
          <Button onClick={nextStep}>
            Next
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        ) : (
          <Button onClick={handleFinish}>
            <Check className="w-4 h-4 mr-2" />
            Create Exam
          </Button>
        )}
      </div>
    </div>
  );
}
