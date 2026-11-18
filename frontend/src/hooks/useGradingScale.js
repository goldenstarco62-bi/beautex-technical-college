import { useEffect, useState } from 'react';
import { academicAPI } from '../services/api';

export const DEFAULT_GRADE_POINTS = { Distinction: 4, Credit: 3, Pass: 2, Fail: 0 };
export const DEFAULT_GRADE_SCALE = {
    distinction: 70,
    credit: 60,
    pass: 50,
    fail: 0,
    points: { ...DEFAULT_GRADE_POINTS },
};

export function gradeFor(percentage, scale = DEFAULT_GRADE_SCALE) {
    const p = parseFloat(percentage);
    if (!Number.isFinite(p)) return 'Fail';
    if (p >= scale.distinction) return 'Distinction';
    if (p >= scale.credit) return 'Credit';
    if (p >= scale.pass) return 'Pass';
    return 'Fail';
}

export function gradePointsFor(grade, scale = DEFAULT_GRADE_SCALE) {
    const points = scale.points || DEFAULT_GRADE_POINTS;
    const value = parseFloat(points[grade]);
    return Number.isFinite(value) ? value : 0;
}

// Mirrors backend/src/utils/grading.js so every client screen grades with the
// same boundaries the server stores on each result.
export default function useGradingScale() {
    const [scale, setScale] = useState(DEFAULT_GRADE_SCALE);
    useEffect(() => {
        let alive = true;
        academicAPI.getGradingScale()
            .then(({ data }) => {
                if (!alive || !data) return;
                setScale({
                    distinction: parseFloat(data.distinction) || DEFAULT_GRADE_SCALE.distinction,
                    credit: parseFloat(data.credit) || DEFAULT_GRADE_SCALE.credit,
                    pass: parseFloat(data.pass) || DEFAULT_GRADE_SCALE.pass,
                    fail: parseFloat(data.fail) || DEFAULT_GRADE_SCALE.fail,
                    points: {
                        Distinction: parseFloat(data.points?.Distinction ?? data.points?.distinction) || DEFAULT_GRADE_POINTS.Distinction,
                        Credit: parseFloat(data.points?.Credit ?? data.points?.credit) || DEFAULT_GRADE_POINTS.Credit,
                        Pass: parseFloat(data.points?.Pass ?? data.points?.pass) || DEFAULT_GRADE_POINTS.Pass,
                        Fail: parseFloat(data.points?.Fail ?? data.points?.fail) || DEFAULT_GRADE_POINTS.Fail,
                    },
                });
            })
            .catch(() => {});
        return () => { alive = false; };
    }, []);
    return scale;
}
