import { validatePhoneNumber, validateAppointmentTime, validateOperationalHours, checkCollision } from "./utils.js";

describe("Validation Utilities", () => {
    describe("validatePhoneNumber", () => {
        test("should return true for valid phone numbers", () => {
            expect(validatePhoneNumber("+971501234567")).toBe(true);
            expect(validatePhoneNumber("9876543210")).toBe(true);
            expect(validatePhoneNumber("+1 415 523 8886")).toBe(true); // contains spaces which are cleaned
        });

        test("should return false for too short or too long phone numbers", () => {
            expect(validatePhoneNumber("123456")).toBe(false); // too short
            expect(validatePhoneNumber("12345678901234567")).toBe(false); // too long
        });

        test("should return false for alphabetic characters or empty input", () => {
            expect(validatePhoneNumber("abc12345")).toBe(false);
            expect(validatePhoneNumber("")).toBe(false);
            expect(validatePhoneNumber(null)).toBe(false);
        });
    });

    describe("validateAppointmentTime", () => {
        const refDate = new Date("2026-06-05T12:00:00"); // Mock reference date

        test("should return true for a future date/time", () => {
            const futureTime = "2026-06-05T13:00:00";
            expect(validateAppointmentTime(futureTime, refDate)).toBe(true);
        });

        test("should return false for a past date/time", () => {
            const pastTime = "2026-06-05T11:00:00";
            expect(validateAppointmentTime(pastTime, refDate)).toBe(false);
        });

        test("should return false for invalid date strings or empty input", () => {
            expect(validateAppointmentTime("invalid-date-string", refDate)).toBe(false);
            expect(validateAppointmentTime("", refDate)).toBe(false);
            expect(validateAppointmentTime(null, refDate)).toBe(false);
        });
    });

    describe("validateOperationalHours", () => {
        test("should return true for working day and hours", () => {
            // Monday 10:00 AM
            const result = validateOperationalHours("2026-06-08T10:00:00");
            expect(result.valid).toBe(true);
        });

        test("should return false for Sundays", () => {
            // Sunday 12:00 PM
            const result = validateOperationalHours("2026-06-07T12:00:00");
            expect(result.valid).toBe(false);
            expect(result.error).toContain("closed on Sundays");
        });

        test("should return false for outside working hours", () => {
            // Monday 8:00 AM
            const result1 = validateOperationalHours("2026-06-08T08:00:00");
            expect(result1.valid).toBe(false);
            expect(result1.error).toContain("9:00 AM to 7:00 PM");

            // Monday 8:00 PM (20:00)
            const result2 = validateOperationalHours("2026-06-08T20:00:00");
            expect(result2.valid).toBe(false);
            expect(result2.error).toContain("9:00 AM to 7:00 PM");
        });
    });

    describe("checkCollision", () => {
        const existingApps = [
            { id: "1", name: "Alice", phone: "1234567890", time: "2026-06-08T10:00:00", status: "Confirmed" },
            { id: "2", name: "Bob", phone: "9876543210", time: "2026-06-08T14:30:00", status: "Cancelled" }
        ];

        test("should return conflicting app if within 30 minutes window", () => {
            const conflict = checkCollision("2026-06-08T10:15:00", existingApps);
            expect(conflict).not.toBeNull();
            expect(conflict.name).toBe("Alice");
        });

        test("should ignore conflict with cancelled appointments", () => {
            const conflict = checkCollision("2026-06-08T14:40:00", existingApps);
            expect(conflict).toBeNull();
        });

        test("should ignore conflict with itself when editing", () => {
            const conflict = checkCollision("2026-06-08T10:00:00", existingApps, "1");
            expect(conflict).toBeNull();
        });

        test("should return null if slot is free", () => {
            const conflict = checkCollision("2026-06-08T11:00:00", existingApps);
            expect(conflict).toBeNull();
        });
    });
});
