import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from './store';
import Login from './features/auth/Login';
import Register from './features/auth/Register';
import KYCVerification from './features/kyc/KYCVerification';
import Dashboard from './features/dashboard/Dashboard';
import PrivateRoute from './components/PrivateRoute';

function App() {
  return (
    <Provider store={store}>
      <Router>
        <div>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/kyc" element={<PrivateRoute><KYCVerification /></PrivateRoute>} />
            <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          </Routes>
        </div>
      </Router>
    </Provider>
  );
}

export default App;
