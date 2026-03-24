const profile = {
  emailUnavailable: "Chưa có email",
  student: {
    title: "Hồ sơ học sinh",
    description: "Xem thông tin tài khoản đã import, quản lý mật khẩu và giữ các tùy chọn thiết bị phù hợp với không gian dự thi.",
    userFallback: "Học sinh",
    sections: {
      accountDetails: "Thông tin tài khoản",
      security: "Bảo mật",
      systemSettings: "Cài đặt hệ thống",
    },
    labels: {
      roles: "Vai trò",
      school: "Trường",
      phone: "Điện thoại",
      fullName: "Họ và tên",
      email: "Email",
      phoneNumber: "Số điện thoại",
      accountStatus: "Trạng thái tài khoản",
      currentPassword: "Mật khẩu hiện tại",
      newPassword: "Mật khẩu mới",
      appearanceTheme: "Giao diện",
      defaultLanguage: "Ngôn ngữ mặc định",
    },
    values: {
      notAssigned: "Chưa được gán",
      notSet: "Chưa thiết lập",
    },
    buttons: {
      saveChanges: "Lưu thay đổi",
      saving: "Đang lưu...",
      updatePassword: "Cập nhật mật khẩu",
      updatingPassword: "Đang cập nhật...",
    },
    messages: {
      profileUpdated: "Đã cập nhật hồ sơ.",
      profileUpdateFailed: "Không thể cập nhật hồ sơ.",
      passwordUpdated: "Đã cập nhật mật khẩu.",
      passwordUpdateFailed: "Không thể đổi mật khẩu.",
      passwordRequired: "Cần nhập mật khẩu hiện tại và mật khẩu mới.",
      settingsSaved: "Các tùy chọn này được lưu trên thiết bị hiện tại và áp dụng ngay cho giao diện học sinh.",
      registrationLocked: "Thông tin đăng ký này được khóa theo danh sách đã import và học sinh không thể tự chỉnh sửa.",
    },
    securityNote:
      "Hãy dùng mật khẩu không trùng với nơi khác và đổi mật khẩu trước các kỳ thi quan trọng nếu tài khoản được dùng chung trên thiết bị của trường.",
    themes: {
      light: "Sáng",
      dark: "Tối",
      system: "Theo hệ thống",
    },
    status: {
      active: "Hoạt động",
      pending: "Chờ xử lý",
      locked: "Bị khóa",
      inactive: "Không hoạt động",
    },
  },
};

export default profile;
