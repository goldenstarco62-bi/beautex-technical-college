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
    department: String,
    
    // Attendance Summary
    total_students_expected: Number,
    total_students_present: Number,
    total_students_absent: Number,
    absent_students_list: String,  // Names of absent students
    staff_present: Number,
    staff_absent: Number,
    late_arrivals: Number,

    // Academic Activities
    classes_conducted: String, // Changed to String to list subjects
    topics_covered: String,
    practical_sessions: String,
    assessments_conducted: Number,
    total_attendance_percentage: Number,

    // Administrative Activities
    meetings_held: String,
    admissions_registrations: String,
    new_enrollments: Number,
    fees_collection_summary: String,

    // Student Affairs
    disciplinary_cases: Number,
    discipline_issues: String,
    student_feedback: String,
    counseling_support: String,

    // Facilities & Operations
    facilities_issues: String,
    equipment_maintenance: String,
    cleaning_maintenance: String,
    internet_ict_status: String,

    // Marketing & Outreach
    inquiries_received: Number,
    walk_ins: Number,
    social_media_activities: String,

    // Operational Intelligence
    challenges_faced: String,
    actions_taken: String,
    plans_for_next_day: String,
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
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

const ActivityReport = mongoose.model('ActivityReport', activityReportSchema);
export default ActivityReport;
