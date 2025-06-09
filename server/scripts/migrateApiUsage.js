import mongoose from 'mongoose';
import APIClient from '../models/APIClient.js';
import ApiUsage from '../models/ApiUsage.js';
import dotenv from 'dotenv';

dotenv.config();

const migrateApiUsage = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB');

    // Get all API clients
    const clients = await APIClient.find({});
    console.log(`Found ${clients.length} API clients to process`);

    let totalMigrated = 0;
    let totalSkipped = 0;

    for (const client of clients) {
      console.log(`Processing client: ${client.name} (${client._id})`);

      // Skip if no API usage data
      if (!client.apiUsage || client.apiUsage.length === 0) {
        console.log('No API usage data to migrate');
        totalSkipped++;
        continue;
      }

      // Create new API usage records
      const apiUsageRecords = client.apiUsage.map(usage => ({
        clientId: client._id,
        endpoint: usage.endpoint,
        method: 'GET', // Default to GET since old data doesn't have method
        statusCode: usage.status === 'success' ? 200 : 500,
        responseTime: usage.responseTime || 0,
        requestSize: 0, // Default to 0 since old data doesn't have this
        responseSize: 0, // Default to 0 since old data doesn't have this
        ipAddress: 'unknown', // Default since old data doesn't have this
        userAgent: 'unknown', // Default since old data doesn't have this
        timestamp: usage.timestamp,
        errorType: usage.errorType || null,
        requestData: usage.requestData || null
      }));

      // Insert new records
      await ApiUsage.insertMany(apiUsageRecords);
      totalMigrated += apiUsageRecords.length;

      // Update client's usage statistics
      const totalRequests = apiUsageRecords.length;
      const successCount = apiUsageRecords.filter(r => r.statusCode === 200).length;
      const avgResponseTime = apiUsageRecords.reduce((sum, r) => sum + r.responseTime, 0) / totalRequests;

      client.usage = {
        totalRequests,
        lastRequestAt: apiUsageRecords[apiUsageRecords.length - 1].timestamp,
        storageUsed: 0, // Default to 0 since old data doesn't have this
        activeUsers: 1 // Default to 1 since old data doesn't have this
      };

      // Remove old apiUsage array
      client.apiUsage = undefined;
      await client.save();

      console.log(`Migrated ${apiUsageRecords.length} records for client ${client.name}`);
    }

    console.log('\nMigration Summary:');
    console.log(`Total clients processed: ${clients.length}`);
    console.log(`Total records migrated: ${totalMigrated}`);
    console.log(`Clients skipped: ${totalSkipped}`);

    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');

  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  }
};

// Run migration
migrateApiUsage(); 