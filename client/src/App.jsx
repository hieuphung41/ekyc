import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
} from "react-router-dom";
import { Provider } from "react-redux";
import { store } from "./store/index";
import { useEffect } from "react";
import { useDispatch } from "react-redux";
import { checkAuth } from "./features/auth/authSlice";
import { checkClientAuth } from "./features/apiClient/apiClientSlice";
import Login from "./features/auth/Login";
import Register from "./features/auth/Register";
import KYCVerification from "./features/kyc/KYCVerification";
import ProfilePage from "./features/profile/ProfilePage";
import PrivateRoute from "./components/PrivateRoute";
import ClientRoute from "./components/ClientRoute";
import Navbar from "./components/NavBar";
import Dashboard from "./features/dashboard/Dashboard";
import FaceVerificationPage from "./features/profile/FaceVerificationPage";
import DocumentVerificationPage from "./features/profile/DocumentVerificationPage";
import VideoVerificationPage from "./features/profile/VideoVerificationPage";
import ApiClientLogin from "./features/apiClient/ApiClientLogin";
import ApiClientRegister from "./features/apiClient/ApiClientRegister";
import ApiClientDashboard from "./features/apiClient/ApiClientDashboard";
import ApiClientApis from "./features/apiClient/ApiClientApis";
import ApiClientApiKeys from "./features/apiClient/ApiClientApiKeys";
import ApiClientApiReport from "./features/apiClient/ApiClientApiReport";
import ApiClientUsers from "./features/apiClient/ApiClientUsers";
import AdminDashboard from "./features/admin/AdminDashboard";
import AdminUsers from "./features/admin/AdminUsers";
import AdminUserEdit from "./features/admin/AdminUserEdit";
import AdminApiClients from "./features/admin/AdminApiClients";
import AdminApiClientEdit from "./features/admin/AdminApiClientEdit";
import AdminUserCreate from './features/admin/AdminUserCreate';
import AdminApiClientCreate from './features/admin/AdminApiClientCreate';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import TransactionConfirmation from "./features/transaction/TransactionConfirmation";

// Component to conditionally render navbar
const AppContent = () => {
  const dispatch = useDispatch();
  const location = useLocation();
  const isApiClientRoute = location.pathname.startsWith("/api-client");
  const isAdminRoute = location.pathname.startsWith("/admin");
  const isAuthRoute = location.pathname === "/login" || location.pathname === "/register";

  useEffect(() => {
    // Only check auth if not on auth routes
    if (!isAuthRoute) {
      if (isApiClientRoute) {
        dispatch(checkClientAuth());
      } else {
        dispatch(checkAuth());
      }
    }
  }, [dispatch, location.pathname, isApiClientRoute, isAuthRoute]);

  return (
    <>
      {!isApiClientRoute && !isAdminRoute && <Navbar />}
      {/* <main className="container mx-auto px-4 py-8"> */}
      <main>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/"
            element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            }
          />
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

          {/* Admin Routes */}
          <Route
            path="/admin"
            element={
              <PrivateRoute>
                <AdminDashboard />
              </PrivateRoute>
            }
          />
          <Route
            path="/admin/users"
            element={
              <PrivateRoute>
                <AdminUsers />
              </PrivateRoute>
            }
          />
          <Route
            path="/admin/users/create"
            element={
              <PrivateRoute>
                <AdminUserCreate />
              </PrivateRoute>
            }
          />
          <Route
            path="/admin/users/:id"
            element={
              <PrivateRoute>
                <AdminUserEdit />
              </PrivateRoute>
            }
          />
          <Route
            path="/admin/clients"
            element={
              <PrivateRoute>
                <AdminApiClients />
              </PrivateRoute>
            }
          />
          <Route
            path="/admin/clients/create"
            element={
              <PrivateRoute>
                <AdminApiClientCreate />
              </PrivateRoute>
            }
          />
          <Route
            path="/admin/clients/:id"
            element={
              <PrivateRoute>
                <AdminApiClientEdit />
              </PrivateRoute>
            }
          />

          {/* API Client Routes */}
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
          <Route
            path="/api-client/users"
            element={
              <ClientRoute>
                <ApiClientUsers />
              </ClientRoute>
            }
          />
          <Route
            path="/transaction/:id"
            element={
              <PrivateRoute>
                <TransactionConfirmation />
              </PrivateRoute>
            }
          />
        </Routes>
      </main>
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
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