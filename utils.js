/**
 * Validates phone numbers to ensure they contain 7 to 15 digits.
 * @param {string} phone
 * @returns {boolean}
 */
export function validatePhoneNumber(phone) {
    if (!phone) return false;
    const cleaned = phone.replace(/[^\d+]/g, "");
    return /^\+?\d{7,15}$/.test(cleaned);
}

/**
 * Validates that an appointment time is in the future.
 * @param {string} time
 * @param {Date} referenceDate
 * @returns {boolean}
 */
export function validateAppointmentTime(time, referenceDate = new Date()) {
    if (!time) return false;
    const appointmentDate = new Date(time);
    if (Number.isNaN(appointmentDate.getTime())) {
        return false;
    }
    return appointmentDate > referenceDate;
}

/**
 * Validates that the selected time falls within operational business hours:
 * Monday to Saturday, 9:00 AM to 7:00 PM.
 * @param {string} timeStr
 * @returns {{valid: boolean, error?: string}}
 */
export function validateOperationalHours(timeStr) {
    if (!timeStr) return { valid: false, error: "Time is required" };
    const date = new Date(timeStr);
    if (Number.isNaN(date.getTime())) {
        return { valid: false, error: "Invalid date format" };
    }
    
    // Day of week: 0 is Sunday, 1-6 are Mon-Sat
    const day = date.getDay();
    if (day === 0) {
        return { valid: false, error: "RPM Bikes Dubai is closed on Sundays." };
    }
    
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const timeInMinutes = hours * 60 + minutes;
    
    const startLimit = 9 * 60; // 9:00 AM
    const endLimit = 19 * 60; // 7:00 PM
    
    if (timeInMinutes < startLimit || timeInMinutes > endLimit) {
        return { valid: false, error: "Operational hours are 9:00 AM to 7:00 PM." };
    }
    
    return { valid: true };
}

/**
 * Checks if a new appointment clashes with an existing appointment slot within 30 minutes.
 * @param {string} newTime
 * @param {Array} existingAppointments
 * @param {string|null} editingId
 * @returns {Object|null} Conflicting appointment, or null if clear.
 */
export function checkCollision(newTime, existingAppointments, editingId = null) {
    if (!newTime || !Array.isArray(existingAppointments)) return null;
    const newDate = new Date(newTime).getTime();
    
    for (const app of existingAppointments) {
        if (editingId && app.id === editingId) continue;
        if (app.status === "Cancelled") continue;
        
        const appDate = new Date(app.time).getTime();
        const diffMinutes = Math.abs(newDate - appDate) / (1000 * 60);
        if (diffMinutes < 30) {
            return app;
        }
    }
    return null;
}
