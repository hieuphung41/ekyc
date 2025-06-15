import { useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import Layout from "../../layouts/Layout";
import { getTransactions, createTransaction, deleteTransaction } from "../transaction/transactionSlice";
import { toast } from "react-toastify";

const Dashboard = () => {
  const { user } = useSelector((state) => state.auth);
  const { transactions, status } = useSelector((state) => state.transaction);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    type: "payment",
    amount: "",
    currency: "USD",
    verificationMethod: "face",
  });

  useEffect(() => {
    dispatch(getTransactions());
  }, [dispatch]);

  const handleStartKYC = () => {
    navigate("/kyc");
  };

  const handleTransactionClick = (transactionId) => {
    navigate(`/transaction/${transactionId}`);
  };

  const handleCreateTransaction = async (e) => {
    e.preventDefault();
    if (!user?.isVerified) {
      toast.error("Please complete eKYC verification first");
      navigate("/kyc");
      return;
    }
    try {
      const response = await dispatch(createTransaction(formData)).unwrap();
      setIsModalOpen(false);
      setFormData({
        type: "payment",
        amount: "",
        currency: "USD",
        verificationMethod: "face",
      });
      toast.success("Transaction created successfully");
      navigate(`/transaction/${response.data.transactionId}`);
    } catch (error) {
      toast.error(error.message || "Failed to create transaction");
    }
  };

  const handleDeleteTransaction = async (e, transactionId) => {
    e.stopPropagation();
    if (window.confirm("Are you sure you want to delete this transaction?")) {
      try {
        await dispatch(deleteTransaction(transactionId)).unwrap();
        toast.success("Transaction deleted successfully");
      } catch (error) {
        toast.error(error.message || "Failed to delete transaction");
      }
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "approved":
        return "bg-green-100 text-green-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const renderTransactionActions = (transaction) => {
    return (
      <div className="flex space-x-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleTransactionClick(transaction.transactionId);
          }}
          className="text-indigo-600 hover:text-indigo-900"
        >
          View Details
        </button>
        {(transaction.status === "expired" || transaction.status === "approved") && (
          <button
            onClick={(e) => handleDeleteTransaction(e, transaction.transactionId)}
            className="text-red-600 hover:text-red-900"
          >
            Delete
          </button>
        )}
      </div>
    );
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

        <div className="bg-white shadow sm:rounded-lg mb-6">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-900">
                Recent Transactions
              </h2>
              <button
                onClick={() => setIsModalOpen(true)}
                disabled={!user?.isVerified}
                className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white ${
                  user?.isVerified
                    ? "bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    : "bg-gray-400 cursor-not-allowed"
                }`}
                title={!user?.isVerified ? "Complete eKYC verification to create transactions" : ""}
              >
                Create Transaction
              </button>
            </div>
            {status === "loading" ? (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
              </div>
            ) : transactions.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Transaction ID
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Type
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Amount
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Verification Method
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Status
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Date
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {transactions.map((transaction) => (
                      <tr
                        key={transaction.transactionId}
                        className={`hover:bg-gray-50 cursor-pointer ${
                          transaction.status === "expired" || transaction.status === "approved"
                            ? "opacity-75"
                            : ""
                        }`}
                        onClick={() => handleTransactionClick(transaction.transactionId)}
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {transaction.transactionId.slice(0, 8)}...
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {transaction.type}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {transaction.amount} {transaction.currency}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {transaction.verificationMethod || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(
                              transaction.status
                            )}`}
                          >
                            {transaction.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(transaction.createdAt)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {renderTransactionActions(transaction)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-4 text-gray-500">
                No transactions found
              </div>
            )}
          </div>
        </div>

        {/* Create Transaction Modal */}
        {isModalOpen && (
          <div className="fixed z-10 inset-0 overflow-y-auto">
            <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
              <div
                className="fixed inset-0 transition-opacity"
                aria-hidden="true"
              >
                <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
              </div>

              <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                <form onSubmit={handleCreateTransaction}>
                  <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                    <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                      <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                        Create New Transaction
                      </h3>
                      {!user?.isVerified && (
                        <div className="mb-4 bg-yellow-50 border-l-4 border-yellow-400 p-4">
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
                                You need to complete eKYC verification before creating transactions.
                              </p>
                              <div className="mt-4">
                                <button
                                  type="button"
                                  onClick={handleStartKYC}
                                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-yellow-700 bg-yellow-100 hover:bg-yellow-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
                                >
                                  Complete eKYC Verification
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                      <div className="space-y-4">
                        <div>
                          <label
                            htmlFor="type"
                            className="block text-sm font-medium text-gray-700"
                          >
                            Transaction Type
                          </label>
                          <select
                            id="type"
                            name="type"
                            value={formData.type}
                            onChange={(e) =>
                              setFormData({ ...formData, type: e.target.value })
                            }
                            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                          >
                            <option value="payment">Payment</option>
                            <option value="transfer">Transfer</option>
                            <option value="withdrawal">Withdrawal</option>
                            <option value="deposit">Deposit</option>
                          </select>
                        </div>

                        <div>
                          <label
                            htmlFor="amount"
                            className="block text-sm font-medium text-gray-700"
                          >
                            Amount
                          </label>
                          <input
                            type="number"
                            name="amount"
                            id="amount"
                            value={formData.amount}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                amount: e.target.value,
                              })
                            }
                            required
                            className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                          />
                        </div>

                        <div>
                          <label
                            htmlFor="currency"
                            className="block text-sm font-medium text-gray-700"
                          >
                            Currency
                          </label>
                          <select
                            id="currency"
                            name="currency"
                            value={formData.currency}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                currency: e.target.value,
                              })
                            }
                            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                          >
                            <option value="USD">USD</option>
                            <option value="EUR">EUR</option>
                            <option value="GBP">GBP</option>
                          </select>
                        </div>

                        <div>
                          <label
                            htmlFor="verificationMethod"
                            className="block text-sm font-medium text-gray-700"
                          >
                            Verification Method
                          </label>
                          <select
                            id="verificationMethod"
                            name="verificationMethod"
                            value={formData.verificationMethod}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                verificationMethod: e.target.value,
                              })
                            }
                            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                          >
                            <option value="face">Face Only</option>
                            <option value="voice">Voice Only</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                    <button
                      type="submit"
                      disabled={!user?.isVerified}
                      className={`w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 ${
                        user?.isVerified
                          ? "bg-indigo-600 text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                          : "bg-gray-400 text-white cursor-not-allowed"
                      } sm:ml-3 sm:w-auto sm:text-sm`}
                    >
                      Create
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Dashboard;