import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
} from "react-router-dom";
import { Provider } from "react-redux";
import { store } from "./store";
import { useEffect } from "react";
import { useDispatch } from "react-redux";
import { checkAuth } from "./features/auth/authSlice";
import { checkClientAuth } from "./features/apiClient/apiClientSlice";
import Login from "./features/auth/Login";
import Register from "./features/auth/Register";
import KYCVerification from "./features/kyc/KYCVerification";
import Dashboard from "./features/dashboard/Dashboard";
import ProfilePage from "./features/profile/ProfilePage";
import PrivateRoute from "./components/PrivateRoute";
import ClientRoute from "./components/ClientRoute";
import Navbar from "./components/NavBar";
import FaceVerificationPage from "./features/profile/FaceVerificationPage";
import DocumentVerificationPage from "./features/profile/DocumentVerificationPage";
import VideoVerificationPage from "./features/profile/VideoVerificationPage";
import ApiClientLogin from "./features/apiClient/ApiClientLogin";
import ApiClientRegister from "./features/apiClient/ApiClientRegister";
import ApiClientDashboard from "./features/apiClient/ApiClientDashboard";
import ApiClientApis from "./features/apiClient/ApiClientApis";
import ApiClientApiKeys from "./features/apiClient/ApiClientApiKeys";
import ApiClientApiReport from "./features/apiClient/ApiClientApiReport";

// Component to conditionally render navbar
const AppContent = () => {
  const dispatch = useDispatch();
  const location = useLocation();
  const isApiClientRoute = location.pathname.startsWith("/api-client");

  useEffect(() => {
    if (location.pathname.startsWith("/api-client")) {
      dispatch(checkClientAuth());
    } else {
      dispatch(checkAuth());
    }
  }, [dispatch, location.pathname]);

  return (
    <>
      {!isApiClientRoute && <Navbar />}
      {/* <main className="container mx-auto px-4 py-8"> */}
      <main>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/kyc"
            element={
              <PrivateRoute>
                <KYCVerification />
              </PrivateRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <PrivateRoute>
                <ProfilePage />
              </PrivateRoute>
            }
          />
          <Route
            path="/profile/face-verification"
            element={
              <PrivateRoute>
                <FaceVerificationPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/profile/document-verification"
            element={
              <PrivateRoute>
                <DocumentVerificationPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/profile/video-verification"
            element={
              <PrivateRoute>
                <VideoVerificationPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/"
            element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            }
          />
          <Route path="/api-client/login" element={<ApiClientLogin />} />
          <Route path="/api-client/register" element={<ApiClientRegister />} />
          <Route
            path="/api-client/dashboard"
            element={
              <ClientRoute>
                <ApiClientDashboard />
              </ClientRoute>
            }
          />
          <Route
            path="/api-client/apis"
            element={
              <ClientRoute>
                <ApiClientApis />
              </ClientRoute>
            }
          />
          <Route
            path="/api-client/keys"
            element={
              <ClientRoute>
                <ApiClientApiKeys />
              </ClientRoute>
            }
          />
          <Route
            path="/api-client/report"
            element={
              <ClientRoute>
                <ApiClientApiReport />
              </ClientRoute>
            }
          />
        </Routes>
      </main>
    </>
  );
};

function App() {
  return (
    <Provider store={store}>
      <Router>
        <AppContent />
      </Router>
    </Provider>
  );
}

export default App;
