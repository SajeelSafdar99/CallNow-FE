/**
 * Format a date to a relative time string (e.g., "5 minutes ago", "2 hours ago")
 * @param {Date|string|number} date - The date to format
 * @param {Object} options - Formatting options
 * @param {boolean} options.addSuffix - Whether to add a suffix (ago/from now)
 * @param {boolean} options.includeSeconds - Whether to include seconds for recent times
 * @returns {string} Formatted relative time string
 */
export const formatDistanceToNow = (date, options = {}) => {
  const { addSuffix = true, includeSeconds = false } = options;

  if (!date) return 'unknown';

  try {
    // Convert to Date object if it's not already
    const dateObj = date instanceof Date ? date : new Date(date);

    // Check if date is valid
    if (isNaN(dateObj.getTime())) {
      return 'invalid date';
    }

    const now = new Date();
    const diffInSeconds = Math.floor((now - dateObj) / 1000);
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);
    const diffInMonths = Math.floor(diffInDays / 30);
    const diffInYears = Math.floor(diffInDays / 365);

    let result;

    if (diffInSeconds < 5) {
      result = 'just now';
    } else if (diffInSeconds < 60) {
      if (includeSeconds) {
        result = `${diffInSeconds} second${diffInSeconds === 1 ? '' : 's'}`;
      } else {
        result = 'less than a minute';
      }
    } else if (diffInMinutes < 60) {
      result = `${diffInMinutes} minute${diffInMinutes === 1 ? '' : 's'}`;
    } else if (diffInHours < 24) {
      result = `${diffInHours} hour${diffInHours === 1 ? '' : 's'}`;
    } else if (diffInDays < 30) {
      result = `${diffInDays} day${diffInDays === 1 ? '' : 's'}`;
    } else if (diffInMonths < 12) {
      result = `${diffInMonths} month${diffInMonths === 1 ? '' : 's'}`;
    } else {
      result = `${diffInYears} year${diffInYears === 1 ? '' : 's'}`;
    }

    if (addSuffix) {
      return `${result}${result === 'just now' ? '' : ' ago'}`;
    }

    return result;
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'unknown';
  }
};

/**
 * Format a date to a specific format
 * @param {Date|string|number} date - The date to format
 * @param {string} format - The format to use (default: 'MMM D, YYYY h:mm A')
 * @returns {string} Formatted date string
 */
export const formatDate = (date, format = 'MMM D, YYYY h:mm A') => {
  if (!date) return '';

  try {
    // Convert to Date object if it's not already
    const dateObj = date instanceof Date ? date : new Date(date);

    // Check if date is valid
    if (isNaN(dateObj.getTime())) {
      return 'Invalid date';
    }

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const year = dateObj.getFullYear();
    const month = months[dateObj.getMonth()];
    const day = dateObj.getDate();
    const hours = dateObj.getHours();
    const minutes = dateObj.getMinutes();
    const seconds = dateObj.getSeconds();

    // Format hours for 12-hour clock
    const hour12 = hours % 12 || 12;
    const ampm = hours >= 12 ? 'PM' : 'AM';

    // Pad minutes and seconds with leading zeros
    const paddedMinutes = minutes < 10 ? `0${minutes}` : minutes;
    const paddedSeconds = seconds < 10 ? `0${seconds}` : seconds;

    // Replace tokens in the format string
    return format
      .replace('YYYY', year)
      .replace('MM', (dateObj.getMonth() + 1).toString().padStart(2, '0'))
      .replace('MMM', month)
      .replace('DD', day.toString().padStart(2, '0'))
      .replace('D', day)
      .replace('hh', hour12.toString().padStart(2, '0'))
      .replace('h', hour12)
      .replace('HH', hours.toString().padStart(2, '0'))
      .replace('H', hours)
      .replace('mm', paddedMinutes)
      .replace('m', minutes)
      .replace('ss', paddedSeconds)
      .replace('s', seconds)
      .replace('A', ampm);
  } catch (error) {
    console.error('Error formatting date:', error);
    return '';
  }
};

export const formatTimestamp = (timestamp) => {
  if (!timestamp) return '';

  const messageDate = new Date(timestamp);
  const now = new Date();

  // Check if invalid date
  if (isNaN(messageDate.getTime())) return '';

  // Today's date at midnight for comparison
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  // Yesterday's date at midnight for comparison
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  // Start of this week (Sunday or Monday depending on locale)
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());

  // Start of this year
  const startOfYear = new Date(now.getFullYear(), 0, 1);

  // Format time as HH:MM (24-hour format) or hh:mm AM/PM (12-hour format)
  const formatTime = (date) => {
    const hours = date.getHours();
    const minutes = date.getMinutes();

    // 12-hour format with AM/PM
    const period = hours >= 12 ? 'PM' : 'AM';
    const hours12 = hours % 12 || 12; // Convert 0 to 12 for 12 AM
    return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;

    // Uncomment for 24-hour format
    // return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };

  // If message is from today
  if (messageDate >= today) {
    return formatTime(messageDate);
  }

  // If message is from yesterday
  if (messageDate >= yesterday) {
    return `Yesterday, ${formatTime(messageDate)}`;
  }

  // If message is from this week
  if (messageDate >= startOfWeek) {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return `${days[messageDate.getDay()]}, ${formatTime(messageDate)}`;
  }

  // If message is from this year
  if (messageDate >= startOfYear) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[messageDate.getMonth()]} ${messageDate.getDate()}, ${formatTime(messageDate)}`;
  }

  // If message is older than this year
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[messageDate.getMonth()]} ${messageDate.getDate()}, ${messageDate.getFullYear()}`;
};

// Format file size in a human-readable way
export const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';

  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));

  return `${parseFloat((bytes / Math.pow(1024, i)).toFixed(2))} ${sizes[i]}`;
};

// Format duration in seconds to MM:SS format
export const formatDuration = (seconds) => {
  if (!seconds) return '00:00';

  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);

  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};
