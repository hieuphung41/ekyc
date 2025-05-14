import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import Layout from "../../components/Layout";

const Dashboard = () => {
  const { user } = useSelector((state) => state.auth);
  const navigate = useNavigate();

  const handleStartKYC = () => {
    navigate("/kyc");
  };

  return (
    <Layout>
      <div className="px-4 py-6 sm:px-0">
        {!user?.isVerified && (
          <div className="mb-6 bg-yellow-50 border-l-4 border-yellow-400 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-yellow-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  Your account is not verified. Please complete the eKYC
                  process to access all features.
                </p>
                <div className="mt-4">
                  <button
                    onClick={handleStartKYC}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-yellow-700 bg-yellow-100 hover:bg-yellow-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
                  >
                    Start eKYC Verification
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        <div className="border-4 border-dashed border-gray-200 rounded-lg h-96 p-4">
          <h2 className="text-2xl font-bold mb-4">Dashboard</h2>
          <p className="text-gray-600">
            Welcome to your dashboard. This is a simple interface to
            demonstrate the authentication and KYC verification flow.
          </p>
        </div>
      </div>
    </Layout>
  );
};

export default Dashboard;
