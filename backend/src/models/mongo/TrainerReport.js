import mongoose from 'mongoose';

const trainerReportSchema = new mongoose.Schema({
    student_id: {
        type: String,
        required: true
    },
    student_name: {
        type: String,
        required: true
    },
    registration_number: {
        type: String,
        required: true
    },
    course_unit: {
        type: String,
        required: true
    },
    trainer_name: {
        type: String,
        required: true
    },
    trainer_email: {
        type: String,
        required: true
    },
    reporting_period: {
        type: String,
        required: true
    },
    total_lessons: {
        type: Number,
        default: 0
    },
    attended_lessons: {
        type: Number,
        default: 0
    },
    attendance_percentage: {
        type: Number,
        default: 0.0
    },
    theory_topics: String,
    theory_score: Number,
    theory_remarks: String,
    practical_tasks: String,
    equipment_used: String,
    skill_level: {
        type: String,
        enum: ['Excellent', 'Good', 'Fair', 'Poor']
    },
    safety_compliance: {
        type: String,
        enum: ['Yes', 'No']
    },
    discipline_issues: String,
    trainer_observations: String,
    progress_summary: String,
    recommendation: {
        type: String,
        enum: ['Proceed', 'Improve', 'Review']
    }
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

const TrainerReport = mongoose.model('TrainerReport', trainerReportSchema);
export default TrainerReport;
