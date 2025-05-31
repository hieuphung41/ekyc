import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { registerClient, clearApiClientError } from './apiClientSlice';

// Define the available permissions and document types based on your model
const availablePermissions = [
  "register",
  "verify",
  "query",
  "ekyc_register",
  "ekyc_verify",
  "ekyc_query",
  "ekyc_face_verify",
  "ekyc_voice_verify",
  "ekyc_document_verify",
];

const availableDocumentTypes = ["id_card", "passport", "driver_license"];

const ApiClientRegister = () => {
  const [formData, setFormData] = useState({
    name: '',
    organization: {
      name: '',
      address: '',
      registrationNumber: '',
      website: '',
    },
    contactPerson: {
      name: '',
      email: '',
      phone: '',
    },
    representative: {
      email: '',
      password: '',
      firstName: '',
      lastName: '',
      phoneNumber: '',
    },
    permissions: [],
    ipWhitelist: [],
    rateLimits: {
      requestsPerMinute: 60,
      requestsPerHour: 1000,
      requestsPerDay: 10000,
    },
    webhookUrl: '',
    ekycConfig: {
      allowedVerificationMethods: {
        face: false,
        voice: false,
        document: false
      },
      maxVerificationAttempts: 3,
      verificationTimeout: 300,
      allowedDocumentTypes: []
    }
  });

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { loading, error } = useSelector((state) => state.apiClient);

  useEffect(() => {
    return () => {
      dispatch(clearApiClientError());
    };
  }, [dispatch]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    const [parent, child] = name.split('.');

    if (child) {
      setFormData(prevState => ({
        ...prevState,
        [parent]: {
          ...prevState[parent],
          [child]: value
        }
      }));
    } else if (name === 'ipWhitelist') {
         // Simple comma-separated string for now, adjust based on desired input type
        setFormData(prevState => ({
            ...prevState,
            [name]: value.split(',').map(ip => ip.trim()).filter(ip => ip !== '') // Filter out empty strings
        }));
    } else {
      setFormData(prevState => ({
        ...prevState,
        [name]: value
      }));
    }
  };

  const handlePermissionChange = (e) => {
      const { value, checked } = e.target;
      setFormData(prevState => {
          const newPermissions = checked
              ? [...prevState.permissions, value]
              : prevState.permissions.filter(permission => permission !== value);
          return {
              ...prevState,
              permissions: newPermissions
          };
      });
  };

  const handleEkycConfigChange = (e) => {
    const { name, value, type, checked } = e.target;
    const [parent, child, grandChild] = name.split('.');

    if (parent === 'ekycConfig') {
        if (child === 'allowedVerificationMethods') {
            setFormData(prevState => ({
                ...prevState,
                ekycConfig: {
                    ...prevState.ekycConfig,
                    allowedVerificationMethods: {
                        ...prevState.ekycConfig.allowedVerificationMethods,
                        [grandChild]: type === 'checkbox' ? checked : value
                    }
                }
            }));
        } else if (child === 'allowedDocumentTypes') {
             const documentType = value;
             setFormData(prevState => {
                 const newAllowedDocumentTypes = checked
                     ? [...prevState.ekycConfig.allowedDocumentTypes, documentType]
                     : prevState.ekycConfig.allowedDocumentTypes.filter(dt => dt !== documentType);
                 return {
                     ...prevState,
                     ekycConfig: {
                         ...prevState.ekycConfig,
                         allowedDocumentTypes: newAllowedDocumentTypes
                     }
                 };
             });
        } else {
            setFormData(prevState => ({
                ...prevState,
                ekycConfig: {
                    ...prevState.ekycConfig,
                    [child]: value
                }
            }));
        }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Basic validation (can be enhanced)
     if (formData.permissions.includes('ekyc_face_verify') && !formData.ekycConfig.allowedVerificationMethods.face) {
         alert('Face verification permission requires face verification to be enabled in ekycConfig.');
         return;
     }
     if (formData.permissions.includes('ekyc_voice_verify') && !formData.ekycConfig.allowedVerificationMethods.voice) {
        alert('Voice verification permission requires voice verification to be enabled in ekycConfig.');
        return;
    }
    if (formData.permissions.includes('ekyc_document_verify') && !formData.ekycConfig.allowedVerificationMethods.document) {
        alert('Document verification permission requires document verification to be enabled in ekycConfig.');
        return;
    }

     // Optional: Add client-side validation for webhookUrl format if needed
     if (formData.webhookUrl && !/^https?:\/\/.+/.test(formData.webhookUrl)) {
         alert('Please enter a valid webhook URL starting with http:// or https://');
         return;
     }

    const resultAction = await dispatch(registerClient(formData));
    if (registerClient.fulfilled.match(resultAction)) {
      // Redirect to login page on successful registration
      navigate('/api-client/login');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Register API Client Account
          </h2>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}
          <div className="rounded-md shadow-sm -space-y-px">
             <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">API Client Name</label>
              <input
                id="name"
                name="name"
                type="text"
                required
                className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="API Client Name"
                value={formData.name}
                onChange={handleChange}
              />
            </div>

            {/* Representative Information */}
            <div>
              <h3 className="text-lg font-medium text-gray-900">Representative Information</h3>
            </div>
            <div>
              <label htmlFor="representative.email" className="block text-sm font-medium text-gray-700">Email address</label>
              <input
                id="representative.email"
                name="representative.email"
                type="email"
                required
                className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Representative Email address"
                value={formData.representative.email}
                onChange={handleChange}
              />
            </div>
             <div>
              <label htmlFor="representative.password" className="block text-sm font-medium text-gray-700">Password</label>
              <input
                id="representative.password"
                name="representative.password"
                type="password"
                required
                className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Representative Password"
                value={formData.representative.password}
                onChange={handleChange}
              />
            </div>
             <div>
              <label htmlFor="representative.firstName" className="block text-sm font-medium text-gray-700">First Name</label>
              <input
                id="representative.firstName"
                name="representative.firstName"
                type="text"
                required
                className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Representative First Name"
                value={formData.representative.firstName}
                onChange={handleChange}
              />
            </div>
             <div>
              <label htmlFor="representative.lastName" className="block text-sm font-medium text-gray-700">Last Name</label>
              <input
                id="representative.lastName"
                name="representative.lastName"
                type="text"
                required
                className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Representative Last Name"
                value={formData.representative.lastName}
                onChange={handleChange}
              />
            </div>
             <div>
              <label htmlFor="representative.phoneNumber" className="block text-sm font-medium text-gray-700">Phone Number</label>
              <input
                id="representative.phoneNumber"
                name="representative.phoneNumber"
                type="text"
                className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Representative Phone Number"
                value={formData.representative.phoneNumber}
                onChange={handleChange}
              />
            </div>

            {/* Add other API client fields here based on your backend model */}
             <div>
              <h3 className="text-lg font-medium text-gray-900">Organization Information (Optional)</h3>
            </div>
            <div>
              <label htmlFor="organization.name" className="block text-sm font-medium text-gray-700">Organization Name</label>
              <input
                id="organization.name"
                name="organization.name"
                type="text"
                className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Organization Name"
                value={formData.organization.name}
                onChange={handleChange}
              />
            </div>
             {/* Add other organization fields */}

             {/* Permissions Checkboxes */}
             <div>
              <h3 className="text-lg font-medium text-gray-900">Permissions</h3>
              <div className="mt-2 space-y-2">
                {availablePermissions.map(permission => (
                  <div key={permission} className="flex items-center">
                    <input
                      id={`permission-${permission}`}
                      name="permissions"
                      type="checkbox"
                      value={permission}
                      checked={formData.permissions.includes(permission)}
                      onChange={handlePermissionChange}
                      className="h-4 w-4 text-indigo-600 border-gray-300 rounded"
                    />
                    <label htmlFor={`permission-${permission}`} className="ml-2 block text-sm text-gray-900">
                      {permission}
                    </label>
                  </div>
                ))}
              </div>
            </div>

             {/* eKYC Configuration */}
            <div>
              <h3 className="text-lg font-medium text-gray-900">eKYC Configuration</h3>
            </div>
             <div>
              <span className="block text-sm font-medium text-gray-700">Allowed Verification Methods</span>
              <div className="mt-2 space-y-2">
                <div className="flex items-center">
                  <input
                    id="ekycConfig.allowedVerificationMethods.face"
                    name="ekycConfig.allowedVerificationMethods.face"
                    type="checkbox"
                    checked={formData.ekycConfig.allowedVerificationMethods.face}
                    onChange={handleEkycConfigChange}
                    className="h-4 w-4 text-indigo-600 border-gray-300 rounded"
                  />
                  <label htmlFor="ekycConfig.allowedVerificationMethods.face" className="ml-2 block text-sm text-gray-900">Face Verification</label>
                </div>
                 <div className="flex items-center">
                  <input
                    id="ekycConfig.allowedVerificationMethods.voice"
                    name="ekycConfig.allowedVerificationMethods.voice"
                    type="checkbox"
                    checked={formData.ekycConfig.allowedVerificationMethods.voice}
                    onChange={handleEkycConfigChange}
                    className="h-4 w-4 text-indigo-600 border-gray-300 rounded"
                  />
                  <label htmlFor="ekycConfig.allowedVerificationMethods.voice" className="ml-2 block text-sm text-gray-900">Voice Verification</label>
                </div>
                 <div className="flex items-center">
                  <input
                    id="ekycConfig.allowedVerificationMethods.document"
                    name="ekycConfig.allowedVerificationMethods.document"
                    type="checkbox"
                    checked={formData.ekycConfig.allowedVerificationMethods.document}
                    onChange={handleEkycConfigChange}
                    className="h-4 w-4 text-indigo-600 border-gray-300 rounded"
                  />
                  <label htmlFor="ekycConfig.allowedVerificationMethods.document" className="ml-2 block text-sm text-gray-900">Document Verification</label>
                </div>
              </div>
            </div>
             <div>
              <label htmlFor="ekycConfig.maxVerificationAttempts" className="block text-sm font-medium text-gray-700">Max Verification Attempts</label>
              <input
                id="ekycConfig.maxVerificationAttempts"
                name="ekycConfig.maxVerificationAttempts"
                type="number"
                 className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Max attempts"
                value={formData.ekycConfig.maxVerificationAttempts}
                onChange={handleEkycConfigChange}
              />
            </div>
             {/* Allowed Document Types Checkboxes */}
             <div>
              <span className="block text-sm font-medium text-gray-700">Allowed Document Types</span>
              <div className="mt-2 space-y-2">
                {availableDocumentTypes.map(docType => (
                   <div key={docType} className="flex items-center">
                    <input
                      id={`docType-${docType}`}
                      name="ekycConfig.allowedDocumentTypes"
                      type="checkbox"
                      value={docType}
                      checked={formData.ekycConfig.allowedDocumentTypes.includes(docType)}
                      onChange={handleEkycConfigChange}
                      className="h-4 w-4 text-indigo-600 border-gray-300 rounded"
                    />
                    <label htmlFor={`docType-${docType}`} className="ml-2 block text-sm text-gray-900">
                      {docType}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Add other fields like ipWhitelist, rateLimits, webhookUrl */} 
             <div>
              <label htmlFor="webhookUrl" className="block text-sm font-medium text-gray-700">Webhook URL (Optional)</label>
              <input
                id="webhookUrl"
                name="webhookUrl"
                type="url"
                className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="https://your-webhook-url.com"
                value={formData.webhookUrl}
                onChange={handleChange}
              />
            </div>

          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Registering...' : 'Register'}
            </button>
          </div>

          <div className="text-sm text-center">
            <Link to="/api-client/login" className="font-medium text-indigo-600 hover:text-indigo-500">
              Already have an API client account? Login
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ApiClientRegister; 