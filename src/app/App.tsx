import { RouterProvider } from "react-router";
import { router } from "./routes";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "./auth/AuthContext";
import { LegacyUiTranslationBridge } from "./components/LegacyUiTranslationBridge";

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="light">
      <AuthProvider>
        <LegacyUiTranslationBridge />
        <RouterProvider router={router} />
      </AuthProvider>
    </ThemeProvider>
  );
}
