import { createBrowserRouter } from "react-router";
import { ProtectedRoute } from "./components/ProtectedRoute";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import OnboardingPage from "./pages/OnboardingPage";
import DashboardPage from "./pages/DashboardPage";
import ProblemsPage from "./pages/ProblemsPage";
import ProblemSolvePage from "./pages/ProblemSolvePage";
import ProfilePage from "./pages/ProfilePage";
import ProgressPage from "./pages/ProgressPage";
import SettingsPage from "./pages/SettingsPage";
import TopicDetailPage from "./pages/TopicDetailPage";
import NotFoundPage from "./pages/NotFoundPage";
import ErrorPage from "./pages/ErrorPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";

export const router = createBrowserRouter([
  // Public routes
  { path: "/",        element: <LandingPage /> },
  { path: "/login",   element: <LoginPage /> },
  { path: "/signup",  element: <SignupPage /> },
  { path: "/error",          element: <ErrorPage /> },
  { path: "/forgot-password", element: <ForgotPasswordPage /> },
  { path: "/reset-password",  element: <ResetPasswordPage /> },

  // Requires login but NOT onboarding (onboarding itself)
  {
    path: "/onboarding",
    element: (
      <ProtectedRoute requireOnboarding={false}>
        <OnboardingPage />
      </ProtectedRoute>
    ),
  },

  // Requires login + completed onboarding
  {
    path: "/dashboard",
    element: <ProtectedRoute><DashboardPage /></ProtectedRoute>,
  },
  {
    path: "/problems",
    element: <ProtectedRoute><ProblemsPage /></ProtectedRoute>,
  },
  {
    path: "/problems/:slug",
    element: <ProtectedRoute><ProblemSolvePage /></ProtectedRoute>,
  },
  {
    path: "/profile",
    element: <ProtectedRoute><ProfilePage /></ProtectedRoute>,
  },
  {
    path: "/progress",
    element: <ProtectedRoute><ProgressPage /></ProtectedRoute>,
  },
  {
    path: "/topic/:topic",
    element: <ProtectedRoute><TopicDetailPage /></ProtectedRoute>,
  },
  {
    path: "/settings",
    element: <ProtectedRoute><SettingsPage /></ProtectedRoute>,
  },

  { path: "*", element: <NotFoundPage /> },
]);
