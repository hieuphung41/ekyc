import { BlobServiceClient } from "@azure/storage-blob";
import dotenv from "dotenv";

dotenv.config();

if (!process.env.AZURE_STORAGE_CONNECTION_STRING) {
  throw new Error("Azure Storage connection string is not configured");
}

// Create the BlobServiceClient
const blobServiceClient = BlobServiceClient.fromConnectionString(
  process.env.AZURE_STORAGE_CONNECTION_STRING
);

// Define container names and their allowed content types
export const CONTAINERS = {
  FACE: "face-verification",
  DOCUMENT: "document-verification",
  VOICE: "voice-verification",
  VIDEO: "video-verification"
};

// Define allowed content types for each container
const ALLOWED_CONTENT_TYPES = {
  [CONTAINERS.FACE]: ["image/jpeg", "image/png", "image/jpg"],
  [CONTAINERS.DOCUMENT]: ["image/jpeg", "image/png", "image/jpg", "application/pdf"],
  [CONTAINERS.VOICE]: ["audio/wav", "audio/webm", "audio/mp4"],
  [CONTAINERS.VIDEO]: ["video/webm", "video/mp4"]
};

// Initialize containers
export const initializeContainers = async () => {
  try {
    for (const containerName of Object.values(CONTAINERS)) {
      const containerClient = blobServiceClient.getContainerClient(containerName);
      await containerClient.createIfNotExists({
        access: "blob", // This makes blobs publicly accessible
      });
      console.log(`Container ${containerName} initialized successfully`);
    }
  } catch (error) {
    console.error("Error initializing containers:", error);
    throw new Error(`Failed to initialize Azure Storage containers: ${error.message}`);
  }
};

// Validate content type for container
const validateContentType = (containerName, contentType) => {
  const allowedTypes = ALLOWED_CONTENT_TYPES[containerName];
  if (!allowedTypes) {
    throw new Error(`Invalid container name: ${containerName}`);
  }
  if (!allowedTypes.includes(contentType)) {
    throw new Error(`Invalid content type ${contentType} for container ${containerName}`);
  }
  return true;
};

// Upload a file to Azure Blob Storage
export const uploadToBlobStorage = async (file, containerName, blobName, contentType) => {
  try {
    // Validate container name and content type
    validateContentType(containerName, contentType);

    const containerClient = blobServiceClient.getContainerClient(containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    // Handle different file input types
    let fileData;
    if (Buffer.isBuffer(file)) {
      fileData = file;
    } else if (file && file.buffer) {
      fileData = file.buffer;
    } else if (file && file.data) {
      fileData = file.data;
    } else if (typeof file === 'string') {
      fileData = Buffer.from(file);
    } else {
      console.error('Invalid file input:', {
        isBuffer: Buffer.isBuffer(file),
        hasBuffer: file && file.buffer ? true : false,
        hasData: file && file.data ? true : false,
        isString: typeof file === 'string',
        fileType: typeof file
      });
      throw new Error('Invalid file input: file must be a Buffer, have a buffer property, or be a string');
    }

    if (!fileData) {
      throw new Error('No file data available for upload');
    }

    // Upload the file with metadata
    await blockBlobClient.uploadData(fileData, {
      blobHTTPHeaders: {
        blobContentType: contentType,
      },
      metadata: {
        uploadedAt: new Date().toISOString(),
        container: containerName,
      },
    });

    return blockBlobClient.url;
  } catch (error) {
    console.error("Error uploading to Azure Blob Storage:", error);
    throw new Error(`Failed to upload file to Azure Storage: ${error.message}`);
  }
};

// Delete a blob from Azure Blob Storage
export const deleteFromBlobStorage = async (containerName, blobName) => {
  try {
    const containerClient = blobServiceClient.getContainerClient(containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    
    // Check if blob exists before deleting
    const exists = await blockBlobClient.exists();
    if (!exists) {
      console.warn(`Blob ${blobName} does not exist in container ${containerName}`);
      return;
    }

    await blockBlobClient.delete();
    console.log(`Successfully deleted blob ${blobName} from container ${containerName}`);
  } catch (error) {
    console.error("Error deleting from Azure Blob Storage:", error);
    throw new Error(`Failed to delete file from Azure Storage: ${error.message}`);
  }
};

// Generate SAS token for temporary access
export const generateSasToken = async (containerName, blobName) => {
  try {
    const containerClient = blobServiceClient.getContainerClient(containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    
    // Check if blob exists
    const exists = await blockBlobClient.exists();
    if (!exists) {
      throw new Error(`Blob ${blobName} not found in container ${containerName}`);
    }

    // Generate SAS token that expires in 1 hour
    const sasToken = await blockBlobClient.generateSasUrl({
      permissions: "r", // Read only
      expiresOn: new Date(new Date().valueOf() + 3600 * 1000), // 1 hour
    });

    return sasToken;
  } catch (error) {
    console.error("Error generating SAS token:", error);
    throw new Error(`Failed to generate SAS token: ${error.message}`);
  }
};

// List all blobs in a container
export const listBlobsInContainer = async (containerName) => {
  try {
    const containerClient = blobServiceClient.getContainerClient(containerName);
    const blobs = [];
    
    for await (const blob of containerClient.listBlobsFlat()) {
      blobs.push({
        name: blob.name,
        size: blob.properties.contentLength,
        lastModified: blob.properties.lastModified,
        contentType: blob.properties.contentType,
        url: containerClient.getBlockBlobClient(blob.name).url,
        metadata: blob.metadata,
      });
    }
    
    return blobs;
  } catch (error) {
    console.error("Error listing blobs:", error);
    throw new Error(`Failed to list blobs in container ${containerName}: ${error.message}`);
  }
};

// Get blob metadata
export const getBlobMetadata = async (containerName, blobName) => {
  try {
    const containerClient = blobServiceClient.getContainerClient(containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    
    const properties = await blockBlobClient.getProperties();
    return {
      name: blobName,
      size: properties.contentLength,
      contentType: properties.contentType,
      lastModified: properties.lastModified,
      metadata: properties.metadata,
      url: blockBlobClient.url,
    };
  } catch (error) {
    console.error("Error getting blob metadata:", error);
    throw new Error(`Failed to get blob metadata: ${error.message}`);
  }
}; 