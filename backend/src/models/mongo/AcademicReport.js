import mongoose from 'mongoose';

const academicReportSchema = new mongoose.Schema({
    student_id: { type: String, required: true },
    student_name: { type: String, required: true },
    registration_number: { type: String, required: true },
    course_unit: { type: String, required: true },
    trainer_name: { type: String, required: true },
    trainer_email: { type: String, required: true },
    reporting_period: { type: String, required: true },
    total_lessons: { type: Number, default: 0 },
    attended_lessons: { type: Number, default: 0 },
    attendance_percentage: { type: Number, default: 0 },
    theory_topics: { type: String },
    theory_score: { type: Number },
    theory_remarks: { type: String },
    practical_tasks: { type: String },
    equipment_used: { type: String },
    skill_level: { type: String },
    safety_compliance: { type: String },
    discipline_issues: { type: String },
    trainer_observations: { type: String },
    progress_summary: { type: String },
    recommendation: { type: String },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now }
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

const AcademicReport = mongoose.model('AcademicReport', academicReportSchema);
export default AcademicReport;
