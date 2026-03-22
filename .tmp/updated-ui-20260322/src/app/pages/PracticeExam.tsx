import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Clock, BookOpen, PlayCircle } from "lucide-react";
import { Link } from "react-router";

const practiceExams = [
  {
    id: 1,
    title: "Mathematics Practice Set 1",
    subject: "Mathematics",
    questions: 20,
    duration: 45,
    difficulty: "Easy",
    attempts: 2,
  },
  {
    id: 2,
    title: "Physics Mock Test",
    subject: "Physics",
    questions: 30,
    duration: 60,
    difficulty: "Medium",
    attempts: 0,
  },
  {
    id: 3,
    title: "Chemistry Advanced",
    subject: "Chemistry",
    questions: 25,
    duration: 50,
    difficulty: "Hard",
    attempts: 1,
  },
];

export function PracticeExam() {
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Practice Exams</h1>
          <p className="text-gray-600 mt-2">
            Prepare for your exams with unlimited practice tests
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {practiceExams.map((exam) => (
            <Card key={exam.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between mb-2">
                  <Badge variant="outline">{exam.subject}</Badge>
                  <Badge
                    className={
                      exam.difficulty === "Easy"
                        ? "bg-green-100 text-green-800 hover:bg-green-100"
                        : exam.difficulty === "Medium"
                        ? "bg-yellow-100 text-yellow-800 hover:bg-yellow-100"
                        : "bg-red-100 text-red-800 hover:bg-red-100"
                    }
                  >
                    {exam.difficulty}
                  </Badge>
                </div>
                <CardTitle className="text-lg">{exam.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 mb-4">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <BookOpen className="w-4 h-4" />
                    <span>{exam.questions} questions</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Clock className="w-4 h-4" />
                    <span>{exam.duration} minutes</span>
                  </div>
                  <div className="text-sm text-gray-600">
                    Attempts: <span className="font-medium">{exam.attempts}</span>
                  </div>
                </div>
                <Link to={`/candidate/exam/${exam.id}`}>
                  <Button className="w-full">
                    <PlayCircle className="w-4 h-4 mr-2" />
                    Start Practice
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
