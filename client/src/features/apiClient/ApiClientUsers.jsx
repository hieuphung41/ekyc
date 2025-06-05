import { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { getClientUsers, updateUserStatus } from "./apiClientSlice";
import { getUserKYCStatus } from "../kyc/kycSlice";
import { toast } from "react-toastify";
import ApiClientLayout from "./ApiClientLayout";

const ApiClientUsers = () => {
  const dispatch = useDispatch();
  const { clientUsers, clientUsersLoading, clientUsersError } = useSelector(
    (state) => state.apiClient
  );
  const { kycStatus } = useSelector((state) => state.kyc); // KYC status được lấy từ Redux store
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  useEffect(() => {
    dispatch(
      getClientUsers({
        page: currentPage,
        limit: itemsPerPage,
        search: searchTerm,
        status: statusFilter,
      })
    );
  }, [dispatch, currentPage, itemsPerPage, searchTerm, statusFilter]);

  // Fetch KYC status for each user when the clientUsers change
  useEffect(() => {
    if (clientUsers?.users) {
      clientUsers.users.forEach((user) => {
        // Lấy thông tin KYC của từng người dùng
        dispatch(getUserKYCStatus(user._id));
      });
    }
  }, [dispatch, clientUsers?.users]);

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  const handleStatusFilter = (e) => {
    setStatusFilter(e.target.value);
    setCurrentPage(1);
  };

  const handleStatusChange = async (userId, newStatus) => {
    try {
      await dispatch(updateUserStatus({ userId, status: newStatus })).unwrap();
      toast.success("User status updated successfully");
    } catch (error) {
      toast.error(error.message || "Failed to update user status");
    }
  };

  const getKycStatusBadge = (userId) => {
    const userKycStatus = kycStatus[userId]; // Lấy trạng thái KYC từ Redux store
    if (!userKycStatus) return null;

    const getStatusColor = (status) => {
      switch (status) {
        case true:
          return "bg-green-100 text-green-800"; // Nếu trạng thái là hoàn thành
        case false:
          return "bg-red-100 text-red-800"; // Nếu trạng thái là chưa hoàn thành
        default:
          return "bg-gray-100 text-gray-800"; // Trạng thái mặc định
      }
    };

    return (
      <div className="flex flex-col space-y-1">
        <span
          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(
            userKycStatus.completedSteps.faceVerification.completed
          )}`}
        >
          Face:{" "}
          {userKycStatus.completedSteps.faceVerification.completed
            ? "Completed"
            : "Pending"}
        </span>
        <span
          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(
            userKycStatus.completedSteps.voiceVerification.completed
          )}`}
        >
          Voice:{" "}
          {userKycStatus.completedSteps.voiceVerification.completed
            ? "Completed"
            : "Pending"}
        </span>
        <span
          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(
            userKycStatus.completedSteps.documentVerification.completed
          )}`}
        >
          Document:{" "}
          {userKycStatus.completedSteps.documentVerification.completed
            ? "Completed"
            : "Pending"}
        </span>
        <span
          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(
            userKycStatus.completedSteps.videoVerification.completed
          )}`}
        >
          Video:{" "}
          {userKycStatus.completedSteps.videoVerification.completed
            ? "Completed"
            : "Pending"}
        </span>
      </div>
    );
  };

  // Calculate pagination
  const totalPages = clientUsers?.total
    ? Math.ceil(clientUsers.total / itemsPerPage)
    : 0;
  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1);

  if (clientUsersLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (clientUsersError) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-500">{clientUsersError}</div>
      </div>
    );
  }

  return (
    <ApiClientLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="mt-2 text-sm text-gray-600">
            Manage users registered with your organization
          </p>
        </div>

        {/* Search and Filter Section */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={handleSearch}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="w-full sm:w-48">
            <select
              value={statusFilter}
              onChange={handleStatusFilter}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Phone
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  KYC Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Registered Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {clientUsers?.users?.map((user) => (
                <tr key={user._id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {user.firstName} {user.lastName}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{user.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {user.phoneNumber}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        user.status === "active"
                          ? "bg-green-100 text-green-800"
                          : user.status === "pending"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {user.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getKycStatusBadge(user._id)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(
                      user.clientMetadata?.registrationDate
                    ).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <select
                      value={user.status}
                      onChange={(e) =>
                        handleStatusChange(user._id, e.target.value)
                      }
                      className="text-sm border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="active">Active</option>
                      <option value="pending">Pending</option>
                      <option value="suspended">Suspended</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-6 flex justify-center">
            <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
              >
                Previous
              </button>
              {pageNumbers.map((number) => (
                <button
                  key={number}
                  onClick={() => setCurrentPage(number)}
                  className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                    currentPage === number
                      ? "z-10 bg-blue-50 border-blue-500 text-blue-600"
                      : "bg-white border-gray-300 text-gray-500 hover:bg-gray-50"
                  }`}
                >
                  {number}
                </button>
              ))}
              <button
                onClick={() =>
                  setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                }
                disabled={currentPage === totalPages}
                className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
              >
                Next
              </button>
            </nav>
          </div>
        )}
      </div>
    </ApiClientLayout>
  );
};

export default ApiClientUsers;
