import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

// Extend dayjs with relativeTime plugin to support fromNow()
dayjs.extend(relativeTime);

export default dayjs;
