import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const testConnection = async () => {
    try {
        console.log('Testing connection to:', process.env.MONGODB_URI.replace(/:.+@/, ':****@'));
        await mongoose.connect(process.env.MONGODB_URI, {
            serverSelectionTimeoutMS: 5000
        });
        console.log('✅ Connection Successful!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Connection Failed!');
        console.error(err);
        process.exit(1);
    }
};

testConnection();
