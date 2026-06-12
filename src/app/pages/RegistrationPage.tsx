import { useState } from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { ArrowLeft, CheckCircle, Sparkles } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Checkbox } from "../components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";

const EXAMS = [
  { id: "imo", label: "IMO" },
  { id: "ico", label: "ICO" },
  { id: "sco-ieio", label: "SCO IEIO" },
  { id: "sco-ifko", label: "SCO IFKO" },
  { id: "sco-ieo", label: "SCO IEO" },
  { id: "iso", label: "ISO" },
];

export function RegistrationPage() {
  const { t } = useTranslation();
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [selectedExams, setSelectedExams] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    fullName: "",
    dob: "",
    grade: "",
    school: "",
    className: "",
    cccd: "",
    address: "",
    ward: "",
    city: "",
    email: "",
    guardianPhone: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleExamToggle = (examId: string) => {
    setSelectedExams((prev) =>
      prev.includes(examId) ? prev.filter((id) => id !== examId) : [...prev, examId]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Simulate API call
    setTimeout(() => {
      console.log("Form Data Submitted:", { ...formData, exams: selectedExams });
      setIsSubmitting(false);
      setIsSubmitted(true);
    }, 1500);
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-3xl p-8 sm:p-12 shadow-2xl text-center border border-slate-200 dark:border-slate-800">
          <div className="mx-auto w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mb-6">
            <CheckCircle className="w-10 h-10" />
          </div>
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">Đăng ký thành công!</h2>
          <p className="text-slate-600 dark:text-slate-400 mb-8 leading-relaxed">
            Cảm ơn bạn đã đăng ký dự thi. Thông tin của bạn đã được ghi nhận trên hệ thống. Chúng tôi sẽ sớm liên hệ hoặc gửi email xác nhận.
          </p>
          <Button asChild className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white rounded-xl h-12 font-bold transition-all shadow-md">
            <Link to="/">Quay về Trang chủ</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 relative overflow-hidden py-12 px-4 sm:px-6 lg:px-8">
      {/* Bright Tech Background Elements */}
      <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-blue-50/50 to-transparent dark:from-blue-900/10 pointer-events-none"></div>
      <div className="absolute top-[-10%] right-[-5%] w-[600px] h-[600px] bg-blue-400/10 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] left-[-5%] w-[600px] h-[600px] bg-cyan-400/10 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="max-w-3xl mx-auto relative z-10">
        <div className="mb-8">
          <Button asChild variant="ghost" className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white pl-0">
            <Link to="/" className="inline-flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" />
              Quay lại Trang chủ
            </Link>
          </Button>
        </div>

        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl border border-white/60 dark:border-slate-800/80 shadow-2xl shadow-blue-900/5 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-cyan-500 p-8 sm:p-12 text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none"></div>
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200/30 bg-white/10 backdrop-blur-md px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-white shadow-sm mb-4">
              <Sparkles className="h-3.5 w-3.5" />
              Form Đăng Ký
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white">Đăng Ký Dự Thi</h1>
            <p className="mt-3 text-blue-100 max-w-lg mx-auto">
              Vui lòng điền đầy đủ và chính xác các thông tin dưới đây để hoàn tất hồ sơ dự thi của bạn.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="p-8 sm:p-12 space-y-8">
            <div className="space-y-6">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3">
                1. Thông tin cá nhân
              </h3>
              
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="fullName" className="text-slate-700 dark:text-slate-300 font-semibold">Họ và tên thí sinh <span className="text-red-500">*</span></Label>
                  <Input id="fullName" name="fullName" value={formData.fullName} onChange={handleChange} required className="h-11 rounded-lg bg-slate-50 dark:bg-slate-900" placeholder="VD: Nguyễn Văn A" />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="dob" className="text-slate-700 dark:text-slate-300 font-semibold">Ngày/tháng/năm sinh <span className="text-red-500">*</span></Label>
                  <Input id="dob" name="dob" type="text" value={formData.dob} onChange={handleChange} required className="h-11 rounded-lg bg-slate-50 dark:bg-slate-900" placeholder="VD: 02/11/2018" />
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="cccd" className="text-slate-700 dark:text-slate-300 font-semibold">Số CCCD <span className="text-red-500">*</span></Label>
                  <Input id="cccd" name="cccd" value={formData.cccd} onChange={handleChange} required className="h-11 rounded-lg bg-slate-50 dark:bg-slate-900" placeholder="Gồm 12 chữ số..." />
                  <p className="text-xs text-slate-500 mt-1 italic">
                    Thông tin CCCD chỉ được sử dụng cho mục đích xác minh nhân thân và cam kết bảo mật theo quy định.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3">
                2. Thông tin học tập
              </h3>
              
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="school" className="text-slate-700 dark:text-slate-300 font-semibold">Trường <span className="text-red-500">*</span></Label>
                  <Input id="school" name="school" value={formData.school} onChange={handleChange} required className="h-11 rounded-lg bg-slate-50 dark:bg-slate-900" placeholder="VD: Trường THPT Chuyên..." />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="grade" className="text-slate-700 dark:text-slate-300 font-semibold">Khối thi <span className="text-red-500">*</span></Label>
                    <Select onValueChange={(value) => setFormData(prev => ({ ...prev, grade: value }))} required>
                      <SelectTrigger className="h-11 rounded-lg bg-slate-50 dark:bg-slate-900">
                        <SelectValue placeholder="Chọn khối" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({length: 12}).map((_, i) => (
                          <SelectItem key={i} value={`Khoi ${i + 1}`}>Khối {i + 1}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="className" className="text-slate-700 dark:text-slate-300 font-semibold">Lớp <span className="text-red-500">*</span></Label>
                    <Input id="className" name="className" value={formData.className} onChange={handleChange} required className="h-11 rounded-lg bg-slate-50 dark:bg-slate-900" placeholder="VD: 10A1" />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3">
                3. Kỳ thi đăng ký
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                Nếu đăng ký 2/3 kỳ thi, vui lòng chọn các môn thi phù hợp.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {EXAMS.map((exam) => (
                  <div key={exam.id} className="flex items-center space-x-3 bg-slate-50 dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-cyan-700 transition-colors cursor-pointer" onClick={() => handleExamToggle(exam.id)}>
                    <Checkbox id={exam.id} checked={selectedExams.includes(exam.id)} onCheckedChange={() => handleExamToggle(exam.id)} />
                    <Label htmlFor={exam.id} className="cursor-pointer font-medium select-none">{exam.label}</Label>
                  </div>
                ))}
              </div>
              {selectedExams.length === 0 && <p className="text-sm text-red-500">Vui lòng chọn ít nhất một kỳ thi.</p>}
            </div>

            <div className="space-y-6">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3">
                4. Thông tin liên hệ
              </h3>
              
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="address" className="text-slate-700 dark:text-slate-300 font-semibold">Địa chỉ nhà riêng <span className="text-red-500">*</span></Label>
                  <Input id="address" name="address" value={formData.address} onChange={handleChange} required className="h-11 rounded-lg bg-slate-50 dark:bg-slate-900" placeholder="Số nhà, đường/phố..." />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="ward" className="text-slate-700 dark:text-slate-300 font-semibold">Xã/Phường <span className="text-red-500">*</span></Label>
                  <Input id="ward" name="ward" value={formData.ward} onChange={handleChange} required className="h-11 rounded-lg bg-slate-50 dark:bg-slate-900" placeholder="VD: Phường ABC" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="city" className="text-slate-700 dark:text-slate-300 font-semibold">Tỉnh/ Thành phố <span className="text-red-500">*</span></Label>
                  <Input id="city" name="city" value={formData.city} onChange={handleChange} required className="h-11 rounded-lg bg-slate-50 dark:bg-slate-900" placeholder="VD: Hà Nội" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-700 dark:text-slate-300 font-semibold">Email thí sinh/phụ huynh <span className="text-red-500">*</span></Label>
                  <Input id="email" name="email" type="email" value={formData.email} onChange={handleChange} required className="h-11 rounded-lg bg-slate-50 dark:bg-slate-900" placeholder="Dùng để nhận xác nhận" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="guardianPhone" className="text-slate-700 dark:text-slate-300 font-semibold">Số điện thoại người giám hộ <span className="text-red-500">*</span></Label>
                  <Input id="guardianPhone" name="guardianPhone" type="tel" value={formData.guardianPhone} onChange={handleChange} required className="h-11 rounded-lg bg-slate-50 dark:bg-slate-900" placeholder="SĐT Bố/Mẹ" />
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
              <Button 
                type="submit" 
                disabled={isSubmitting || selectedExams.length === 0}
                className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white rounded-xl h-14 text-lg font-bold uppercase tracking-widest transition-all shadow-xl shadow-blue-500/20 border-0"
              >
                {isSubmitting ? "Đang Gửi Đăng Ký..." : "Gửi Hồ Sơ Đăng Ký"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
