import mongoose from 'mongoose';

const activityReportSchema = new mongoose.Schema({
    report_type: {
        type: String,
        enum: ['daily', 'weekly', 'monthly'],
        required: true
    },
    reported_by: {
        type: String,
        required: true
    },
    // DAILY
    report_date: Date,
    classes_conducted: Number,
    total_attendance_percentage: Number,
    assessments_conducted: Number,
    total_students_present: Number,
    total_students_absent: Number,
    late_arrivals: Number,
    new_enrollments: Number,
    staff_present: Number,
    staff_absent: Number,
    facilities_issues: String,
    equipment_maintenance: String,
    notable_events: String,
    incidents: String,
    achievements: String,
    additional_notes: String,

    // WEEKLY
    week_start_date: Date,
    week_end_date: Date,
    total_classes_conducted: Number,
    average_attendance: Number,
    total_assessments: Number,
    active_students: Number,
    avg_student_attendance: Number,
    disciplinary_cases: Number,
    courses_completed: Number,
    key_achievements: String,
    challenges_faced: String,
    action_items: String,
    revenue_collected: Number,
    notes: String,

    // MONTHLY
    month: String,
    month_start_date: Date,
    month_end_date: Date,
    total_students: Number,
    graduations: Number,
    dropouts: Number,
    total_classes: Number,
    average_pass_rate: Number,
    total_faculty: Number,
    new_hires: Number,
    faculty_departures: Number,
    revenue: Number,
    expenses: Number,
    major_achievements: String,
    challenges: String,
    strategic_initiatives: String,
    goals_next_month: String
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

const ActivityReport = mongoose.model('ActivityReport', activityReportSchema);
export default ActivityReport;
