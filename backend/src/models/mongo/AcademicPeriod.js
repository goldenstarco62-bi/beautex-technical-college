import mongoose from 'mongoose';

const AcademicPeriodSchema = new mongoose.Schema({
    name: { type: String, required: true },
    start_date: { type: Date, required: true },
    end_date: { type: Date, required: true },
    is_active: { type: Boolean, default: false },
    status: { type: String, enum: ['Upcoming', 'Ongoing', 'Completed'], default: 'Upcoming' }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

export default mongoose.models.AcademicPeriod || mongoose.model('AcademicPeriod', AcademicPeriodSchema);
