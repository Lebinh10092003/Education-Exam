import { useState } from "react";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { RadioGroup, RadioGroupItem } from "../components/ui/radio-group";
import { Label } from "../components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import {
  Clock,
  ChevronLeft,
  ChevronRight,
  Flag,
  CheckCircle2,
  AlertTriangle,
  Wifi,
} from "lucide-react";
import { Badge } from "../components/ui/badge";

const questions = [
  {
    id: 1,
    question: "What is the derivative of x²?",
    options: ["2x", "x²", "x", "2x²"],
    answered: true,
    selectedAnswer: 0,
    marked: false,
  },
  {
    id: 2,
    question: "What is the value of π (pi) to two decimal places?",
    options: ["3.12", "3.14", "3.16", "3.18"],
    answered: true,
    selectedAnswer: 1,
    marked: false,
  },
  {
    id: 3,
    question: "Which of the following is a prime number?",
    options: ["15", "21", "23", "27"],
    answered: false,
    selectedAnswer: null,
    marked: true,
  },
  {
    id: 4,
    question: "What is the square root of 144?",
    options: ["10", "11", "12", "13"],
    answered: false,
    selectedAnswer: null,
    marked: false,
  },
  {
    id: 5,
    question: "What is 25% of 200?",
    options: ["25", "50", "75", "100"],
    answered: false,
    selectedAnswer: null,
    marked: false,
  },
];

export function TakeExam() {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(7200); // 2 hours in seconds

  const currentQuestion = questions[currentQuestionIndex];
  const answeredCount = questions.filter((q) => q.answered).length;
  const markedCount = questions.filter((q) => q.marked).length;

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  const nextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const prevQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Minimal Top Bar */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div>
            <h1 className="font-bold text-lg text-gray-900">
              Mathematics Final Exam
            </h1>
            <p className="text-sm text-gray-600">Question {currentQuestionIndex + 1} of {questions.length}</p>
          </div>

          <div className="flex items-center gap-6">
            {/* Connection Status */}
            <div className="flex items-center gap-2">
              <Wifi className="w-4 h-4 text-green-600" />
              <span className="text-sm text-gray-600">Connected</span>
            </div>

            {/* Auto-save Status */}
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              <span className="text-sm text-gray-600">Auto-saved</span>
            </div>

            {/* Time Remaining */}
            <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-lg border border-blue-200">
              <Clock className="w-5 h-5 text-blue-600" />
              <span className="font-mono font-semibold text-blue-900">
                {formatTime(timeRemaining)}
              </span>
            </div>

            {/* Submit Button */}
            <Button onClick={() => setShowSubmitDialog(true)}>
              Submit Exam
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 p-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Question Panel */}
          <div className="lg:col-span-3">
            <Card>
              <CardContent className="p-8">
                {/* Question */}
                <div className="mb-6">
                  <div className="flex items-start justify-between mb-4">
                    <h2 className="text-xl font-semibold text-gray-900">
                      Question {currentQuestionIndex + 1}
                    </h2>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-2"
                    >
                      <Flag className="w-4 h-4" />
                      {currentQuestion.marked ? "Unmark" : "Mark for Review"}
                    </Button>
                  </div>
                  <p className="text-lg text-gray-800 leading-relaxed">
                    {currentQuestion.question}
                  </p>
                </div>

                {/* Answer Options */}
                <div className="space-y-3">
                  <RadioGroup
                    value={
                      currentQuestion.selectedAnswer !== null
                        ? currentQuestion.selectedAnswer.toString()
                        : undefined
                    }
                  >
                    {currentQuestion.options.map((option, idx) => (
                      <label
                        key={idx}
                        className={`flex items-center gap-4 p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                          currentQuestion.selectedAnswer === idx
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        <RadioGroupItem value={idx.toString()} id={`option-${idx}`} />
                        <Label
                          htmlFor={`option-${idx}`}
                          className="flex-1 cursor-pointer text-base"
                        >
                          <span className="font-medium text-gray-700 mr-2">
                            {String.fromCharCode(65 + idx)}.
                          </span>
                          {option}
                        </Label>
                      </label>
                    ))}
                  </RadioGroup>
                </div>

                {/* Navigation */}
                <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-200">
                  <Button
                    variant="outline"
                    onClick={prevQuestion}
                    disabled={currentQuestionIndex === 0}
                  >
                    <ChevronLeft className="w-4 h-4 mr-2" />
                    Previous
                  </Button>
                  <Button
                    onClick={nextQuestion}
                    disabled={currentQuestionIndex === questions.length - 1}
                  >
                    Next
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Question Navigation Panel */}
          <div className="lg:col-span-1">
            <Card className="sticky top-24">
              <CardContent className="p-6">
                <h3 className="font-semibold text-gray-900 mb-4">
                  Question Navigator
                </h3>

                {/* Progress Stats */}
                <div className="space-y-2 mb-4 pb-4 border-b border-gray-200">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Answered:</span>
                    <span className="font-semibold text-green-600">
                      {answeredCount}/{questions.length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Marked:</span>
                    <span className="font-semibold text-orange-600">
                      {markedCount}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Unanswered:</span>
                    <span className="font-semibold text-red-600">
                      {questions.length - answeredCount}
                    </span>
                  </div>
                </div>

                {/* Question Grid */}
                <div className="grid grid-cols-5 gap-2">
                  {questions.map((q, idx) => (
                    <button
                      key={q.id}
                      onClick={() => setCurrentQuestionIndex(idx)}
                      className={`aspect-square rounded-lg flex items-center justify-center text-sm font-semibold transition-all relative ${
                        currentQuestionIndex === idx
                          ? "bg-blue-600 text-white ring-2 ring-blue-400 ring-offset-2"
                          : q.answered
                          ? "bg-green-100 text-green-800 hover:bg-green-200"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {idx + 1}
                      {q.marked && (
                        <Flag className="w-3 h-3 absolute -top-1 -right-1 text-orange-500 fill-orange-500" />
                      )}
                    </button>
                  ))}
                </div>

                {/* Legend */}
                <div className="mt-4 pt-4 border-t border-gray-200 space-y-2">
                  <div className="flex items-center gap-2 text-xs">
                    <div className="w-4 h-4 bg-green-100 rounded"></div>
                    <span className="text-gray-600">Answered</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <div className="w-4 h-4 bg-gray-100 rounded"></div>
                    <span className="text-gray-600">Not Answered</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <div className="w-4 h-4 bg-blue-600 rounded"></div>
                    <span className="text-gray-600">Current</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <Flag className="w-4 h-4 text-orange-500 fill-orange-500" />
                    <span className="text-gray-600">Marked</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Submit Confirmation Dialog */}
      <Dialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit Exam?</DialogTitle>
            <DialogDescription>
              Are you sure you want to submit your exam? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-700">Total Questions:</span>
              <span className="font-semibold">{questions.length}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <span className="text-sm text-gray-700">Answered:</span>
              <span className="font-semibold text-green-600">
                {answeredCount}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
              <span className="text-sm text-gray-700">Unanswered:</span>
              <span className="font-semibold text-red-600">
                {questions.length - answeredCount}
              </span>
            </div>
            {markedCount > 0 && (
              <div className="flex items-center gap-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-orange-600" />
                <span className="text-sm text-orange-900">
                  You have {markedCount} question(s) marked for review
                </span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSubmitDialog(false)}>
              Go Back
            </Button>
            <Button>Confirm Submit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
