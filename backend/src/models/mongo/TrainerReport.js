import mongoose from 'mongoose';

const trainerReportSchema = new mongoose.Schema({
    trainer_id: { type: String, required: true },
    trainer_name: { type: String, required: true },
    week_number: { type: String, required: true },
    report_date: { type: Date, required: true },
    daily_report: { type: String, required: true },
    record_of_work: { type: String, required: true },
    course_id: { type: String },
    status: { type: String, default: 'Submitted' },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now }
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

const TrainerReport = mongoose.model('TrainerReport', trainerReportSchema);
export default TrainerReport;
