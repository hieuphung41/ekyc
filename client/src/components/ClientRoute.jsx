import { Navigate, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { useEffect } from 'react';
import { checkClientAuth } from '../features/apiClient/apiClientSlice'; // Import the new thunk

const ClientRoute = ({ children }) => {
  // Select auth state from apiClientSlice
  const { isAuthenticated, loading } = useSelector((state) => state.apiClient);
  const dispatch = useDispatch();
  const location = useLocation();

  // Define public routes for API client that don't require auth check by this component
  const publicPaths = ['/api-client/login', '/api-client/register'];

  useEffect(() => {
    // Only dispatch checkClientAuth if the current path is not a public auth path
    if (!publicPaths.includes(location.pathname)) {
      dispatch(checkClientAuth());
    }
  }, [dispatch, location.pathname]); // Depend on dispatch and location.pathname

  // If on a public path, don't show loading or redirect based on auth state managed by this component
  if (publicPaths.includes(location.pathname)) {
    return children;
  }

  // For protected paths:
  if (loading) {
    // You might want a more sophisticated loading indicator or delay for a better UX
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Redirect to API client login with the return url if not authenticated on a protected route
    return <Navigate to="/api-client/login" state={{ from: location }} replace />;
  }

  // If authenticated and on a protected path, render the children
  return children;
};

export default ClientRoute; 