import mongoose from 'mongoose';

const studentDailyReportSchema = new mongoose.Schema({
    student_id: {
        type: String,
        required: true,
        ref: 'Student'
    },
    student_name: {
        type: String,
        required: true
    },
    course: {
        type: String,
        required: true
    },
    report_date: {
        type: Date,
        required: true,
        default: Date.now
    },
    topics_covered: {
        type: String,
        required: true
    },
    trainer_remarks: {
        type: String
    },
    trainer_name: {
        type: String,
        required: true
    },
    trainer_email: {
        type: String,
        required: true
    }
}, {
    timestamps: {
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    }
});

// Ensure a trainer only submits one report per student per day
studentDailyReportSchema.index({ student_id: 1, report_date: 1 }, { unique: true });

const StudentDailyReport = mongoose.model('StudentDailyReport', studentDailyReportSchema);

export default StudentDailyReport;
