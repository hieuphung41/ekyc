import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from './store';
import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { checkAuth } from './features/auth/authSlice';
import Login from './features/auth/Login';
import Register from './features/auth/Register';
import KYCVerification from './features/kyc/KYCVerification';
import Dashboard from './features/dashboard/Dashboard';
import ProfilePage from './features/profile/ProfilePage';
import PrivateRoute from './components/PrivateRoute';
import Navbar from './components/NavBar';
import FaceVerificationPage from './features/profile/FaceVerificationPage';
import DocumentVerificationPage from './features/profile/DocumentVerificationPage';
import VideoVerificationPage from './features/profile/VideoVerificationPage';

function AppContent() {
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(checkAuth());
  }, [dispatch]);

  return (
    <Router>
      <div>
        <Navbar />
        <main className="container mx-auto px-4 py-8">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/kyc" element={<PrivateRoute><KYCVerification /></PrivateRoute>} />
            <Route path="/profile" element={<PrivateRoute><ProfilePage /></PrivateRoute>} />
            <Route path="/profile/face-verification" element={<PrivateRoute><FaceVerificationPage /></PrivateRoute>} />
            <Route path="/profile/document-verification" element={<PrivateRoute><DocumentVerificationPage /></PrivateRoute>} />
            <Route path="/profile/video-verification" element={<PrivateRoute><VideoVerificationPage /></PrivateRoute>} />
            <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

function App() {
  return (
    <Provider store={store}>
      <AppContent />
    </Provider>
  );
}

export default App;
