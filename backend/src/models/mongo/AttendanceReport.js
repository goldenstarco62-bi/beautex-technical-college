import mongoose from 'mongoose';

const attendanceReportSchema = new mongoose.Schema({
    department: {
        type: String,
        required: true
    },
    report_date: {
        type: String,
        required: true
    },
    filename: {
        type: String,
        required: true
    },
    file_size: {
        type: Number,
        default: 0
    },
    // Base64 PDF bytes — never select this in list queries.
    content: {
        type: String,
        required: true
    }
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

attendanceReportSchema.index({ department: 1, report_date: 1 }, { unique: true });
attendanceReportSchema.index({ filename: 1 });

const AttendanceReport = mongoose.model('AttendanceReport', attendanceReportSchema);
export default AttendanceReport;
