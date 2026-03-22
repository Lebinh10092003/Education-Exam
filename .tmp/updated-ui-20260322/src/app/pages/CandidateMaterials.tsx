import { useState } from "react";
import { Link } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import {
  Search,
  BookOpen,
  FileText,
  Video,
  Download,
  ChevronLeft,
  File,
  Eye,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";

const materials = [
  {
    id: 1,
    title: "Calculus Fundamentals - Lecture Notes",
    subject: "Mathematics",
    type: "document",
    format: "PDF",
    size: "2.4 MB",
    uploadedAt: "2024-03-20",
    downloads: 245,
    description: "Comprehensive lecture notes covering limits, derivatives, and integrals",
  },
  {
    id: 2,
    title: "Physics Lab Manual",
    subject: "Physics",
    type: "document",
    format: "PDF",
    size: "5.8 MB",
    uploadedAt: "2024-03-18",
    downloads: 187,
    description: "Complete lab manual for all physics experiments",
  },
  {
    id: 3,
    title: "Introduction to Quantum Mechanics - Video Lecture",
    subject: "Physics",
    type: "video",
    format: "MP4",
    size: "125 MB",
    uploadedAt: "2024-03-15",
    downloads: 156,
    description: "Comprehensive video lecture series on quantum mechanics",
  },
  {
    id: 4,
    title: "Organic Chemistry Study Guide",
    subject: "Chemistry",
    type: "document",
    format: "PDF",
    size: "3.2 MB",
    uploadedAt: "2024-03-12",
    downloads: 298,
    description: "Quick reference guide for organic chemistry reactions",
  },
  {
    id: 5,
    title: "Biology Cell Structure Diagrams",
    subject: "Biology",
    type: "image",
    format: "PNG",
    size: "1.2 MB",
    uploadedAt: "2024-03-10",
    downloads: 201,
    description: "Detailed diagrams of cellular structures",
  },
];

const recentlyViewed = [
  {
    id: 1,
    title: "Calculus Fundamentals",
    subject: "Mathematics",
    viewedAt: "2 hours ago",
  },
  {
    id: 2,
    title: "Physics Lab Manual",
    subject: "Physics",
    viewedAt: "Yesterday",
  },
];

const typeIcons: Record<string, any> = {
  document: FileText,
  video: Video,
  image: File,
};

export function CandidateMaterials() {
  const [searchQuery, setSearchQuery] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link to="/candidate/dashboard">
                <Button variant="ghost" size="sm">
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Back to Dashboard
                </Button>
              </Link>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">E</span>
              </div>
              <div>
                <h1 className="font-bold text-xl text-gray-900">EduExam</h1>
                <p className="text-xs text-gray-600">Student Portal</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Learning Materials</h1>
          <p className="text-gray-600 mt-1">
            Access study materials, lecture notes, and resources
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recently Viewed</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {recentlyViewed.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                  >
                    <p className="font-medium text-sm text-gray-900 truncate">
                      {item.title}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">{item.subject}</p>
                    <p className="text-xs text-gray-400 mt-1">{item.viewedAt}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="text-base">Browse by Subject</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <button className="w-full text-left px-3 py-2 rounded-lg hover:bg-blue-50 text-sm text-gray-700 hover:text-blue-700">
                  Mathematics
                </button>
                <button className="w-full text-left px-3 py-2 rounded-lg hover:bg-blue-50 text-sm text-gray-700 hover:text-blue-700">
                  Physics
                </button>
                <button className="w-full text-left px-3 py-2 rounded-lg hover:bg-blue-50 text-sm text-gray-700 hover:text-blue-700">
                  Chemistry
                </button>
                <button className="w-full text-left px-3 py-2 rounded-lg hover:bg-blue-50 text-sm text-gray-700 hover:text-blue-700">
                  Biology
                </button>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            <Card>
              <CardContent className="p-6">
                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-4 mb-6">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      placeholder="Search materials..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select value={subjectFilter} onValueChange={setSubjectFilter}>
                    <SelectTrigger className="w-full sm:w-[160px]">
                      <SelectValue placeholder="Subject" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Subjects</SelectItem>
                      <SelectItem value="mathematics">Mathematics</SelectItem>
                      <SelectItem value="physics">Physics</SelectItem>
                      <SelectItem value="chemistry">Chemistry</SelectItem>
                      <SelectItem value="biology">Biology</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="w-full sm:w-[160px]">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="document">Documents</SelectItem>
                      <SelectItem value="video">Videos</SelectItem>
                      <SelectItem value="image">Images</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Tabs defaultValue="grid" className="space-y-6">
                  <TabsList>
                    <TabsTrigger value="grid">Grid View</TabsTrigger>
                    <TabsTrigger value="list">List View</TabsTrigger>
                  </TabsList>

                  <TabsContent value="grid" className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {materials.map((material) => {
                        const TypeIcon = typeIcons[material.type] || FileText;
                        return (
                          <Card
                            key={material.id}
                            className="hover:shadow-md transition-shadow"
                          >
                            <CardContent className="p-6">
                              <div className="flex items-start gap-4 mb-4">
                                <div className="p-3 bg-blue-100 rounded-lg">
                                  <TypeIcon className="w-6 h-6 text-blue-600" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h3 className="font-semibold text-gray-900 mb-1">
                                    {material.title}
                                  </h3>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <Badge variant="outline" className="text-xs">
                                      {material.subject}
                                    </Badge>
                                    <Badge variant="outline" className="text-xs">
                                      {material.format}
                                    </Badge>
                                  </div>
                                </div>
                              </div>
                              <p className="text-sm text-gray-600 mb-4">
                                {material.description}
                              </p>
                              <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
                                <span>{material.size}</span>
                                <span>{material.downloads} downloads</span>
                              </div>
                              <div className="flex gap-2">
                                <Button size="sm" className="flex-1">
                                  <Eye className="w-4 h-4 mr-2" />
                                  View
                                </Button>
                                <Button size="sm" variant="outline">
                                  <Download className="w-4 h-4" />
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </TabsContent>

                  <TabsContent value="list">
                    <div className="space-y-2">
                      {materials.map((material) => {
                        const TypeIcon = typeIcons[material.type] || FileText;
                        return (
                          <div
                            key={material.id}
                            className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                          >
                            <div className="p-2 bg-blue-100 rounded-lg">
                              <TypeIcon className="w-5 h-5 text-blue-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-medium text-gray-900">
                                {material.title}
                              </h3>
                              <div className="flex items-center gap-3 mt-1">
                                <Badge variant="outline" className="text-xs">
                                  {material.subject}
                                </Badge>
                                <span className="text-xs text-gray-500">
                                  {material.size}
                                </span>
                                <span className="text-xs text-gray-500">
                                  {material.downloads} downloads
                                </span>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline">
                                <Eye className="w-4 h-4 mr-2" />
                                View
                              </Button>
                              <Button size="sm" variant="outline">
                                <Download className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </TabsContent>
                </Tabs>

                {/* Pagination */}
                <div className="mt-6 flex items-center justify-between pt-4 border-t">
                  <p className="text-sm text-gray-600">
                    Showing <strong>1-5</strong> of <strong>5</strong> materials
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled>
                      Previous
                    </Button>
                    <Button variant="outline" size="sm">
                      1
                    </Button>
                    <Button variant="outline" size="sm">
                      Next
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
