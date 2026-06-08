// App Controller & Firebase Database Layer - RPM Bikes Dubai
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    getDocs, 
    onSnapshot, 
    query, 
    orderBy,
    deleteDoc,
    updateDoc,
    doc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import {
    getAuth,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { validatePhoneNumber, validateAppointmentTime, validateOperationalHours, checkCollision } from "./utils.js";

// Global App State
let db = null;
let useFirebase = false;
let appointments = [];
let dbUnsubscribe = null;
let editingAppointmentId = null;
let auth = null;
let authUnsubscribe = null;
let isAuthenticated = false;
const processingReminderIds = new Set();

// DOM Elements
const sections = {
    book: document.getElementById("section-book"),
    dashboard: document.getElementById("section-dashboard"),
    settings: document.getElementById("section-settings")
};

const navButtons = {
    book: document.getElementById("btn-book"),
    dashboard: document.getElementById("btn-dashboard"),
    settings: document.getElementById("btn-settings")
};

const pageTitle = document.getElementById("page-title");
const pageSubtitle = document.getElementById("page-subtitle");
const dbStatusBadge = document.getElementById("db-status");

// Auth DOM Elements
const loginOverlay = document.getElementById("login-overlay");
const loginForm = document.getElementById("login-form");
const loginEmailInput = document.getElementById("login-email");
const loginPasswordInput = document.getElementById("login-password");
const logoutBtn = document.getElementById("btn-logout");

// Stats Elements
const statTotal = document.getElementById("stat-total");
const statToday = document.getElementById("stat-today");
const statNotifications = document.getElementById("stat-notifications");

// Form Elements
const appointmentForm = document.getElementById("appointment-form");
const customerNameInput = document.getElementById("customer-name");
const phoneNumberInput = document.getElementById("phone-number");
const appointmentTimeInput = document.getElementById("appointment-time");
const submitBtn = document.getElementById("submit-btn");

// Dashboard Elements
const searchInput = document.getElementById("dashboard-search");
const tbody = document.getElementById("appointments-tbody");

// Firebase Configuration Inputs
const configForm = document.getElementById("firebase-config-form");
const resetDbBtn = document.getElementById("btn-reset-db");
const configFields = {
    apiKey: document.getElementById("fb-apiKey"),
    authDomain: document.getElementById("fb-authDomain"),
    projectId: document.getElementById("fb-projectId"),
    storageBucket: document.getElementById("fb-storageBucket"),
    messagingSenderId: document.getElementById("fb-messagingSenderId"),
    appId: document.getElementById("fb-appId"),
    notificationApiUrl: document.getElementById("notification-api-url")
};

const cancelEditBtn = document.getElementById("cancel-edit-btn");

// WhatsApp Modal simulation
const waOverlay = document.getElementById("whatsapp-overlay");
const waCloseBtn = document.getElementById("wa-close");
const waMsgBody = document.getElementById("wa-msg-body");
const waMsgTime = document.getElementById("wa-msg-time");
const waMsgDate = document.getElementById("wa-msg-date");

// Calendar View State & DOM elements
let currentCalDate = new Date();
let selectedCalDateStr = null;

const viewModeListBtn = document.getElementById("view-mode-list");
const viewModeCalBtn = document.getElementById("view-mode-calendar");
const listViewContainer = document.getElementById("list-view-container");
const calViewContainer = document.getElementById("calendar-view-container");
const calMonthYearText = document.getElementById("cal-month-year");
const calPrevMonthBtn = document.getElementById("cal-prev-month");
const calNextMonthBtn = document.getElementById("cal-next-month");
const calDaysGrid = document.getElementById("calendar-days-grid");
const detailsSelectedDateText = document.getElementById("details-selected-date");
const detailsAppointmentsList = document.getElementById("details-appointments-list");
const dashboardSearchWrapper = document.getElementById("dashboard-search-wrapper");
const dashboardViewTitle = document.getElementById("dashboard-view-title");
const dashboardViewDesc = document.getElementById("dashboard-view-desc");

// Toast Notifications Helper
function showToast(message, type = "info") {
    const container = document.getElementById("toast-container");
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    
    let iconClass = "fa-circle-info";
    if (type === "success") iconClass = "fa-circle-check";
    if (type === "error") iconClass = "fa-circle-exclamation";

    toast.innerHTML = `
        <i class="fa-solid ${iconClass}"></i>
        <span>${message}</span>
    `;
    
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-10px)';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// ----------------------------------------------------
// Tab Navigation Handling
// ----------------------------------------------------
function switchSection(sectionKey) {
    // Hide all sections and remove active class from all buttons
    Object.keys(sections).forEach(key => {
        sections[key].classList.remove("active");
        navButtons[key].classList.remove("active");
    });

    // Show selected section
    sections[sectionKey].classList.add("active");
    navButtons[sectionKey].classList.add("active");

    // Dynamic header titles
    if (sectionKey === "book") {
        pageTitle.textContent = "Book an Appointment";
        pageSubtitle.textContent = "Schedule a new customer slot instantly";
    } else if (sectionKey === "dashboard") {
        pageTitle.textContent = "Live Bookings Dashboard";
        pageSubtitle.textContent = "View and manage scheduled slots in real-time";
        renderDashboard(); // Re-render dashboard when entering tab
    } else if (sectionKey === "settings") {
        pageTitle.textContent = "Database Integrations";
        pageSubtitle.textContent = "Manage backend connections and configurations";
    }
}

// Attach nav handlers
navButtons.book.addEventListener("click", () => switchSection("book"));
navButtons.dashboard.addEventListener("click", () => switchSection("dashboard"));
navButtons.settings.addEventListener("click", () => switchSection("settings"));

// ----------------------------------------------------
// DB Storage layer (LocalStorage fallback & Firestore)
// ----------------------------------------------------
function getSavedConfig() {
    if (sessionStorage.getItem("use_local_db") === "true") {
        return null;
    }
    const saved = localStorage.getItem("aura_firebase_config");
    if (saved) {
        try {
            return JSON.parse(saved);
        } catch (e) {
            console.error("Error parsing saved config:", e);
        }
    }
    // Default Firebase configuration fallback so the app starts in Firebase mode automatically
    return {
        apiKey: "AIzaSyAPeA4swbusrQpTwgWh5giTh55ngetI520",
        authDomain: "web-application-1e344.firebaseapp.com",
        projectId: "web-application-1e344",
        storageBucket: "web-application-1e344.firebasestorage.app",
        messagingSenderId: "831540669237",
        appId: "1:831540669237:web:6d3e6879712b8d5965fa7c"
    };
}

function updateAuthUI() {
    if (isAuthenticated) {
        loginOverlay.classList.remove("active");
    } else {
        loginOverlay.classList.add("active");
    }
}

function initDatabase() {
    // Unsubscribe from previous listener if any
    if (dbUnsubscribe) {
        dbUnsubscribe();
        dbUnsubscribe = null;
    }
    if (authUnsubscribe) {
        authUnsubscribe();
        authUnsubscribe = null;
    }

    // Load notification API URL independently
    const savedApiUrl = localStorage.getItem("aura_notification_api_url") || "http://localhost:5000/api/notify";
    configFields.notificationApiUrl.value = savedApiUrl;

    const config = getSavedConfig();
    if (config && config.apiKey && config.projectId) {
        try {
            // Load input values in the settings panel UI
            Object.keys(configFields).forEach(key => {
                if (key !== "notificationApiUrl") {
                    configFields[key].value = config[key] || "";
                }
            });

            // Initialize Firebase App
            const app = initializeApp(config);
            db = getFirestore(app);
            auth = getAuth(app);
            useFirebase = true;
            
            dbStatusBadge.className = "db-status-badge online";
            dbStatusBadge.querySelector(".status-text").textContent = "Cloud Firestore DB";
            showToast("Connected securely to Firebase Firestore!", "success");

            // Setup Firebase Auth observer
            authUnsubscribe = onAuthStateChanged(auth, (user) => {
                if (user) {
                    isAuthenticated = true;
                    updateAuthUI();
                    
                    // Setup real-time listener from firestore
                    const appointmentsCol = collection(db, "appointments");
                    const q = query(appointmentsCol, orderBy("timestamp", "desc"));
                    
                    dbUnsubscribe = onSnapshot(q, (snapshot) => {
                        appointments = [];
                        snapshot.forEach((doc) => {
                            appointments.push({ id: doc.id, ...doc.data() });
                        });
                        renderDashboard();
                        updateStats();
                        checkForUpcomingReminders();
                    }, (error) => {
                        console.error("Firestore listen error: ", error);
                        showToast("Real-time listener failed. Check Firestore rules.", "error");
                    });
                } else {
                    isAuthenticated = false;
                    updateAuthUI();
                    appointments = [];
                    renderDashboard();
                    updateStats();
                    if (dbUnsubscribe) {
                        dbUnsubscribe();
                        dbUnsubscribe = null;
                    }
                }
            });

        } catch (err) {
            console.error("Firebase init failed: ", err);
            showToast("Firebase initialization error. Falling back to local DB.", "error");
            setupLocalDb();
        }
    } else {
        // Pre-populate input values with the default Firebase config
        const defaultConfig = {
            apiKey: "AIzaSyAPeA4swbusrQpTwgWh5giTh55ngetI520",
            authDomain: "web-application-1e344.firebaseapp.com",
            projectId: "web-application-1e344",
            storageBucket: "web-application-1e344.firebasestorage.app",
            messagingSenderId: "831540669237",
            appId: "1:831540669237:web:6d3e6879712b8d5965fa7c"
        };
        Object.keys(configFields).forEach(key => {
            if (key !== "notificationApiUrl") {
                configFields[key].value = defaultConfig[key] || "";
            }
        });
        setupLocalDb();
    }
}

function setupLocalDb() {
    useFirebase = false;
    db = null;
    auth = null;
    dbStatusBadge.className = "db-status-badge offline";
    dbStatusBadge.querySelector(".status-text").textContent = "Local Storage DB";
    
    // Check if session storage has authenticated flag
    const localAuth = sessionStorage.getItem("rpm_local_authenticated");
    if (localAuth === "true") {
        isAuthenticated = true;
    } else {
        isAuthenticated = false;
    }
    updateAuthUI();
    
    // Ensure notification API URL is loaded in Local mode too
    const savedApiUrl = localStorage.getItem("aura_notification_api_url") || "http://localhost:5000/api/notify";
    configFields.notificationApiUrl.value = savedApiUrl;

    // Load local appointments
    const localData = localStorage.getItem("aura_appointments");
    appointments = localData ? JSON.parse(localData) : [];
    
    renderDashboard();
    updateStats();
    checkForUpcomingReminders();
}

// Save appointment logic
async function saveAppointment(appointment) {
    const status = appointment.status || "Confirmed";
    if (useFirebase && db) {
        try {
            const docRef = await addDoc(collection(db, "appointments"), {
                ...appointment,
                status,
                reminderSent: false,
                timestamp: new Date().toISOString()
            });
            return docRef.id;
        } catch (error) {
            console.error("Error saving to Firebase: ", error);
            showToast("Failed to write to Firebase. Saving locally instead.", "error");
        }
    }
    
    // Local persistence
    const localData = localStorage.getItem("aura_appointments");
    const localList = localData ? JSON.parse(localData) : [];
    const newId = "local_" + Date.now();
    
    const newAppointment = {
        id: newId,
        ...appointment,
        status,
        reminderSent: false,
        timestamp: new Date().toISOString()
    };
    
    localList.unshift(newAppointment);
    localStorage.setItem("aura_appointments", JSON.stringify(localList));
    
    // Refresh local app state
    setupLocalDb();
    return newId;
}

async function updateAppointment(id, appointment) {
    if (useFirebase && db && !id.startsWith("local_")) {
        try {
            await updateDoc(doc(db, "appointments", id), {
                ...appointment,
                reminderSent: false,
                timestamp: new Date().toISOString()
            });
            return id;
        } catch (error) {
            console.error("Error updating Firebase appointment: ", error);
            showToast("Failed to update appointment in Firebase. Saving locally instead.", "error");
        }
    }

    const localData = localStorage.getItem("aura_appointments");
    let localList = localData ? JSON.parse(localData) : [];
    let found = false;

    localList = localList.map(item => {
        if (item.id === id) {
            found = true;
            return {
                ...item,
                ...appointment,
                reminderSent: false,
                timestamp: new Date().toISOString()
            };
        }
        return item;
    });

    if (!found) {
        localList.unshift({
            id,
            ...appointment,
            reminderSent: false,
            timestamp: new Date().toISOString()
        });
    }

    localStorage.setItem("aura_appointments", JSON.stringify(localList));
    setupLocalDb();
    return id;
}

// Delete appointment logic
async function deleteAppointment(id) {
    if (useFirebase && db && !id.startsWith("local_")) {
        try {
            await deleteDoc(doc(db, "appointments", id));
            showToast("Appointment deleted successfully from Firestore.", "success");
            return;
        } catch (error) {
            console.error("Error deleting from Firebase: ", error);
            showToast("Failed to delete from Firebase.", "error");
        }
    }
    
    // Local delete
    const localData = localStorage.getItem("aura_appointments");
    if (localData) {
        let localList = JSON.parse(localData);
        localList = localList.filter(item => item.id !== id);
        localStorage.setItem("aura_appointments", JSON.stringify(localList));
    }
    setupLocalDb();
    showToast("Appointment deleted from Local Storage.", "success");
}

// ----------------------------------------------------
// UI Logic & Render Operations
// ----------------------------------------------------
function updateStats() {
    statTotal.textContent = appointments.length;
    
    // Count today's appointments
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    
    const todayCount = appointments.filter(app => {
        const appDate = new Date(app.time);
        return appDate >= startOfToday;
    }).length;
    
    statToday.textContent = todayCount;
    
    // Get notifications sent stat
    const notificationCount = localStorage.getItem("aura_notifications_count") || 0;
    statNotifications.textContent = notificationCount;
}

function incrementNotificationStat() {
    let count = parseInt(localStorage.getItem("aura_notifications_count") || 0);
    count++;
    localStorage.setItem("aura_notifications_count", count);
    statNotifications.textContent = count;
}

// Check for upcoming appointments to automatically send WhatsApp reminders (within 30 minutes)
async function checkForUpcomingReminders() {
    const now = new Date();
    // Check for appointments scheduled between now and 35 minutes from now (30 min target + 5 min scheduler interval buffer)
    const thirtyFiveMinutesFromNow = new Date(now.getTime() + 35 * 60 * 1000);
    
    for (const app of appointments) {
        if (app.status === "Cancelled" || app.reminderSent === true || processingReminderIds.has(app.id)) {
            continue;
        }
        
        const appDate = new Date(app.time);
        // If appointment is in the future and scheduled within the next 35 minutes
        if (appDate > now && appDate <= thirtyFiveMinutesFromNow) {
            // Track processing state immediately to block concurrent calls
            processingReminderIds.add(app.id);
            
            const formattedTime = formatTime(app.time);
            const message = `Reminder: Hello ${app.name}, your appointment is scheduled for ${formattedTime}. We look forward to seeing you.`;
            
            // Mark as sent locally in memory
            app.reminderSent = true;
            
            console.log(`[Reminder] Triggering automatic WhatsApp reminder for ${app.name} at ${formattedTime}`);
            const sent = await sendRemoteNotification(app.name, app.phone, message);
            if (!sent) {
                simulateWhatsAppMessage(app.name, app.phone, message);
            }
            
            try {
                // Persist the reminderSent status to database
                await updateAppointment(app.id, { reminderSent: true });
            } catch (err) {
                console.error("Failed to update reminderSent status:", err);
                processingReminderIds.delete(app.id); // clean up on error to allow retry
            }
        }
    }
}

function formatTime(dateTimeStr) {
    try {
        const dt = new Date(dateTimeStr);
        return dt.toLocaleString('en-US', { 
            weekday: 'short', 
            month: 'short', 
            day: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: true 
        });
    } catch (e) {
        return dateTimeStr;
    }
}

function renderDashboard() {
    const searchVal = searchInput.value.toLowerCase().trim();
    
    // Filter records
    const filtered = appointments.filter(app => {
        return (
            app.name.toLowerCase().includes(searchVal) ||
            app.phone.includes(searchVal)
        );
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr class="empty-row">
                <td colspan="5">
                    <div class="empty-state">
                        <i class="fa-regular fa-folder-open"></i>
                        <p>${searchVal ? "No matching appointments found." : "No appointments scheduled yet."}</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = filtered.map(app => {
        const status = app.status || "Confirmed";
        const statusLower = status.toLowerCase();
        let dotColor = "var(--green)";
        if (statusLower === "pending") dotColor = "#f59e0b";
        if (statusLower === "completed") dotColor = "var(--purple)";
        if (statusLower === "cancelled") dotColor = "var(--red)";

        return `
            <tr class="appointment-row">
                <td>
                    <div style="font-weight: 600; color: var(--text-main);">${escapeHtml(app.name)}</div>
                </td>
                <td>
                    <span class="phone-col">${escapeHtml(app.phone)}</span>
                </td>
                <td>
                    <div>${formatTime(app.time)}</div>
                </td>
                <td>
                    <span class="status-badge ${statusLower}">
                        <span class="status-dot" style="background-color: ${dotColor};"></span>
                        <select class="status-select" data-id="${app.id}">
                            <option value="Pending" ${status === "Pending" ? "selected" : ""}>Pending</option>
                            <option value="Confirmed" ${status === "Confirmed" ? "selected" : ""}>Confirmed</option>
                            <option value="Completed" ${status === "Completed" ? "selected" : ""}>Completed</option>
                            <option value="Cancelled" ${status === "Cancelled" ? "selected" : ""}>Cancelled</option>
                        </select>
                    </span>
                </td>
                <td style="text-align: right; display: flex; justify-content:flex-end; gap: 0.5rem;">
                    <button class="btn-icon-edit" data-id="${app.id}" title="Edit booking">
                        <i class="fa-regular fa-pen-to-square"></i>
                    </button>
                    <button class="btn-icon-delete" data-id="${app.id}" title="Cancel booking">
                        <i class="fa-regular fa-trash-can"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    // Attach status change handlers
    document.querySelectorAll(".status-select").forEach(select => {
        select.addEventListener("change", async (e) => {
            const id = select.getAttribute("data-id");
            const newStatus = e.target.value;
            const app = appointments.find(a => a.id === id);
            try {
                await updateAppointment(id, { status: newStatus });
                showToast(`Status updated to ${newStatus}`, "success");
                if (app) {
                    const message = `Hello ${app.name}, your appointment status has been updated to "${newStatus}". Thank you.`;
                    const remoteSent = await sendRemoteNotification(app.name, app.phone, message);
                    if (!remoteSent) {
                        simulateWhatsAppMessage(app.name, app.phone, message);
                    }
                }
            } catch (err) {
                console.error(err);
                showToast("Failed to update status", "error");
            }
        });
    });

    // Attach edit handlers
    document.querySelectorAll(".btn-icon-edit").forEach(btn => {
        btn.addEventListener("click", () => {
            const id = btn.getAttribute("data-id");
            const appointment = appointments.find(app => app.id === id);
            if (appointment) {
                populateFormForEdit(appointment);
            }
        });
    });

    // Attach deletion handlers
    document.querySelectorAll(".btn-icon-delete").forEach(btn => {
        btn.addEventListener("click", async (e) => {
            const id = btn.getAttribute("data-id");
            const app = appointments.find(a => a.id === id);
            if (confirm("Are you sure you want to cancel this appointment slot?")) {
                await deleteAppointment(id);
                if (app) {
                    const formattedTime = formatTime(app.time);
                    const message = `Hello ${app.name}, your appointment scheduled for ${formattedTime} has been cancelled.`;
                    const remoteSent = await sendRemoteNotification(app.name, app.phone, message);
                    if (!remoteSent) {
                        simulateWhatsAppMessage(app.name, app.phone, message);
                    }
                }
            }
        });
    });

    // Refresh calendar view indicators
    renderCalendar();
}

function renderCalendar() {
    const year = currentCalDate.getFullYear();
    const month = currentCalDate.getMonth();

    // Month names
    const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];
    calMonthYearText.textContent = `${monthNames[month]} ${year}`;

    // Clear grid
    calDaysGrid.innerHTML = "";

    // Days in current month
    const firstDayIndex = new Date(year, month, 1).getDay();
    const lastDay = new Date(year, month + 1, 0).getDate();

    // Fill blank placeholders for previous month alignment
    for (let i = 0; i < firstDayIndex; i++) {
        const emptyDiv = document.createElement("div");
        emptyDiv.className = "cal-day empty";
        calDaysGrid.appendChild(emptyDiv);
    }

    // Today's date reference
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    if (!selectedCalDateStr) {
        selectedCalDateStr = todayStr;
    }

    // Render calendar days
    for (let day = 1; day <= lastDay; day++) {
        const dayButton = document.createElement("button");
        dayButton.type = "button";
        dayButton.className = "cal-day";
        dayButton.textContent = day;

        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        dayButton.setAttribute("data-date", dateStr);

        // Highlight today
        if (dateStr === todayStr) {
            dayButton.classList.add("today");
        }

        // Highlight selected
        if (dateStr === selectedCalDateStr) {
            dayButton.classList.add("selected");
        }

        // Filter appointments for this date
        const dayApps = appointments.filter(app => {
            if (!app.time) return false;
            const appDate = new Date(app.time);
            const appDateStr = `${appDate.getFullYear()}-${String(appDate.getMonth() + 1).padStart(2, '0')}-${String(appDate.getDate()).padStart(2, '0')}`;
            return appDateStr === dateStr && app.status !== "Cancelled";
        });

        // Add dots if there are appointments
        if (dayApps.length > 0) {
            const dotsContainer = document.createElement("div");
            dotsContainer.className = "cal-day-dots";

            // Limit to max 3 dots to prevent UI clutter
            dayApps.slice(0, 3).forEach(app => {
                const dot = document.createElement("span");
                const statusLower = (app.status || "Confirmed").toLowerCase();
                dot.className = `cal-dot ${statusLower}`;
                dotsContainer.appendChild(dot);
            });
            dayButton.appendChild(dotsContainer);
        }

        // Add click listener
        dayButton.addEventListener("click", () => {
            document.querySelectorAll(".cal-day").forEach(btn => btn.classList.remove("selected"));
            dayButton.classList.add("selected");
            selectedCalDateStr = dateStr;
            renderCalendarDetails();
        });

        calDaysGrid.appendChild(dayButton);
    }

    renderCalendarDetails();
}

function renderCalendarDetails() {
    if (!selectedCalDateStr) {
        detailsSelectedDateText.textContent = "Select a day";
        detailsAppointmentsList.innerHTML = `
            <div class="empty-state-small">
                <p>No appointments selected.</p>
            </div>
        `;
        return;
    }

    const [year, month, day] = selectedCalDateStr.split('-').map(Number);
    const parsedDate = new Date(year, month - 1, day);
    
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    detailsSelectedDateText.textContent = parsedDate.toLocaleDateString('en-US', options);

    const dayApps = appointments.filter(app => {
        if (!app.time) return false;
        const appDate = new Date(app.time);
        const appDateStr = `${appDate.getFullYear()}-${String(appDate.getMonth() + 1).padStart(2, '0')}-${String(appDate.getDate()).padStart(2, '0')}`;
        return appDateStr === selectedCalDateStr;
    });

    if (dayApps.length === 0) {
        detailsAppointmentsList.innerHTML = `
            <div class="empty-state-small">
                <p>No appointments scheduled for this day.</p>
            </div>
        `;
        return;
    }

    // Sort by time
    dayApps.sort((a, b) => new Date(a.time) - new Date(b.time));

    detailsAppointmentsList.innerHTML = dayApps.map(app => {
        const appTime = new Date(app.time);
        const timeFormatted = appTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const status = app.status || "Confirmed";
        const statusLower = status.toLowerCase();
        
        let dotColor = "var(--green)";
        if (statusLower === "pending") dotColor = "#f59e0b";
        if (statusLower === "completed") dotColor = "var(--purple)";
        if (statusLower === "cancelled") dotColor = "var(--red)";

        return `
            <div class="cal-app-card">
                <div class="cal-app-header">
                    <span class="cal-app-time">${timeFormatted}</span>
                    <span class="status-badge ${statusLower}">
                        <span class="status-dot" style="background-color: ${dotColor};"></span>
                        ${status}
                    </span>
                </div>
                <div class="cal-app-name">${escapeHtml(app.name)}</div>
                <div class="cal-app-phone"><i class="fa-solid fa-phone" style="font-size:0.75rem; margin-right:4px;"></i> ${escapeHtml(app.phone)}</div>
            </div>
        `;
    }).join('');
}



function setFormState(isEditing) {
    if (isEditing) {
        submitBtn.querySelector(".btn-text").textContent = "Update Booking";
        cancelEditBtn.classList.remove("hidden");
    } else {
        submitBtn.querySelector(".btn-text").textContent = "Confirm Booking";
        cancelEditBtn.classList.add("hidden");
        editingAppointmentId = null;
    }
}

function populateFormForEdit(appointment) {
    customerNameInput.value = appointment.name || "";
    phoneNumberInput.value = appointment.phone || "";
    appointmentTimeInput.value = appointment.time || "";
    editingAppointmentId = appointment.id;
    setFormState(true);
    switchSection("book");
    pageTitle.textContent = "Edit Appointment";
    pageSubtitle.textContent = "Update the appointment details before saving.";
}

function resetFormAndState() {
    appointmentForm.reset();
    setFormState(false);
    switchSection("book");
}

function escapeHtml(str) {
    if (!str) return "";
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// ----------------------------------------------------
// Simulated WhatsApp Sender Gateway
// ----------------------------------------------------
function simulateWhatsAppMessage(name, phone, message) {
    // 1. Log to developers console
    console.log("================= WHATSAPP GATEWAY SANDBOX =================");
    console.log(`To: ${phone}`);
    console.log(`Message:\n${message}`);
    console.log("============================================================");

    // 2. Increment alerts counter
    incrementNotificationStat();

    // 3. Update simulation modal views
    const now = new Date();
    const shortTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    waMsgBody.textContent = message;
    waMsgTime.innerHTML = `${shortTime} <i class="fa-solid fa-check-double text-blue"></i>`;
    waMsgDate.textContent = now.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
    
    // Display popup simulator overlay
    setTimeout(() => {
        waOverlay.classList.add("active");
        showToast("WhatsApp notification sent via sandbox!", "info");
    }, 800);
}

async function sendRemoteNotification(name, phone, message) {
    const apiUrl = configFields.notificationApiUrl.value.trim();
    if (!apiUrl) {
        return false;
    }

    try {
        const response = await fetch(apiUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                name,
                phone,
                message,
                type: "whatsapp"
            })
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error("Remote notification failed:", errorBody);
            return false;
        }

        showToast("Notification API called successfully.", "success");
        incrementNotificationStat();
        return true;
    } catch (error) {
        console.error("Remote notification error:", error);
        return false;
    }
}

// Close WhatsApp simulator
waCloseBtn.addEventListener("click", () => {
    waOverlay.classList.remove("active");
});

waOverlay.addEventListener("click", (e) => {
    if (e.target === waOverlay) {
        waOverlay.classList.remove("active");
    }
});

// ----------------------------------------------------
// Interactive Handlers (Form Submission, Configs)
// ----------------------------------------------------

// Handle Search input
searchInput.addEventListener("input", renderDashboard);

// Calendar Navigation Buttons Listeners
calPrevMonthBtn.addEventListener("click", () => {
    currentCalDate.setMonth(currentCalDate.getMonth() - 1);
    renderCalendar();
});

calNextMonthBtn.addEventListener("click", () => {
    currentCalDate.setMonth(currentCalDate.getMonth() + 1);
    renderCalendar();
});

// View mode switcher action handlers
viewModeListBtn.addEventListener("click", () => {
    viewModeListBtn.classList.add("active");
    viewModeCalBtn.classList.remove("active");
    listViewContainer.classList.add("active");
    listViewContainer.classList.remove("hidden");
    calViewContainer.classList.add("hidden");
    calViewContainer.classList.remove("active");
    dashboardSearchWrapper.style.display = "block";
    
    dashboardViewTitle.textContent = "All Appointments";
    dashboardViewDesc.textContent = "Manage, search, and monitor bookings from Firestore.";
});

viewModeCalBtn.addEventListener("click", () => {
    viewModeCalBtn.classList.add("active");
    viewModeListBtn.classList.remove("active");
    calViewContainer.classList.add("active");
    calViewContainer.classList.remove("hidden");
    listViewContainer.classList.add("hidden");
    listViewContainer.classList.remove("active");
    dashboardSearchWrapper.style.display = "none";
    
    dashboardViewTitle.textContent = "Interactive Booking Calendar";
    dashboardViewDesc.textContent = "Select a day to view daily slots and scheduling status.";
    renderCalendar();
});

// Booking Form Submit
appointmentForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    const name = customerNameInput.value.trim();
    const phone = phoneNumberInput.value.trim();
    const time = appointmentTimeInput.value;

    if (!name || !phone || !time) {
        showToast("Please fill in all requested appointment fields.", "error");
        return;
    }

    if (!validatePhoneNumber(phone)) {
        showToast("Enter a valid phone number in international format, e.g. +9719876543210.", "error");
        return;
    }

    if (!validateAppointmentTime(time)) {
        showToast("Choose a valid future appointment date and time.", "error");
        return;
    }

    const opHours = validateOperationalHours(time);
    if (!opHours.valid) {
        showToast(opHours.error, "error");
        return;
    }

    const conflict = checkCollision(time, appointments, editingAppointmentId);
    if (conflict) {
        showToast(`Scheduling conflict! ${conflict.name} has already booked a slot within 30 minutes.`, "error");
        return;
    }

    submitBtn.disabled = true;
    submitBtn.querySelector(".btn-text").textContent = editingAppointmentId ? "Updating..." : "Saving slot...";

    try {
        const appointmentData = { name, phone, time };

        if (editingAppointmentId) {
            await updateAppointment(editingAppointmentId, appointmentData);
            showToast("Appointment updated successfully!", "success");

            const message = `Hello ${name}, your appointment has been rescheduled to ${formatTime(time)}. Thank you.`;
            const remoteSent = await sendRemoteNotification(name, phone, message);
            if (!remoteSent) {
                simulateWhatsAppMessage(name, phone, message);
            }
        } else {
            await saveAppointment(appointmentData);
            showToast("Appointment saved securely!", "success");

            const message = `Hello ${name}, your appointment has been confirmed for ${formatTime(time)}. Thank you.`;
            const remoteSent = await sendRemoteNotification(name, phone, message);
            if (!remoteSent) {
                simulateWhatsAppMessage(name, phone, message);
            }
        }

        resetFormAndState();
        setTimeout(() => {
            switchSection("dashboard");
        }, 800);

    } catch (err) {
        console.error(err);
        showToast("An error occurred while saving the appointment.", "error");
    } finally {
        submitBtn.disabled = false;
        setFormState(false);
    }
});

cancelEditBtn.addEventListener("click", () => {
    resetFormAndState();
    showToast("Edit cancelled. Ready for a new booking.", "info");
});

// Settings Firebase Config Save
configForm.addEventListener("submit", (e) => {
    e.preventDefault();
    
    const apiKey = configFields.apiKey.value.trim();
    const projectId = configFields.projectId.value.trim();
    const notificationApiUrlVal = configFields.notificationApiUrl.value.trim();

    localStorage.setItem("aura_notification_api_url", notificationApiUrlVal);

    if (apiKey || projectId) {
        if (!apiKey || !projectId) {
            showToast("Both API Key and Project ID are required for Firebase connectivity.", "error");
            return;
        }
        
        const config = {
            apiKey,
            authDomain: configFields.authDomain.value.trim(),
            projectId,
            storageBucket: configFields.storageBucket.value.trim(),
            messagingSenderId: configFields.messagingSenderId.value.trim(),
            appId: configFields.appId.value.trim()
        };
        localStorage.setItem("aura_firebase_config", JSON.stringify(config));
        sessionStorage.removeItem("use_local_db");
        showToast("Firebase configuration saved. Connecting database...", "info");
    } else {
        localStorage.removeItem("aura_firebase_config");
        sessionStorage.removeItem("use_local_db");
        showToast("Notification API settings saved.", "success");
    }
    
    initDatabase();
    switchSection("book");
});

// Reset configurations
resetDbBtn.addEventListener("click", () => {
    localStorage.removeItem("aura_firebase_config");
    localStorage.removeItem("aura_notification_api_url");
    localStorage.removeItem("aura_notifications_count");
    sessionStorage.setItem("use_local_db", "true");
    // Clear field values
    Object.keys(configFields).forEach(key => configFields[key].value = "");
    
    showToast("Reset database connections and alert counter.", "info");
    initDatabase();
    switchSection("book");
});

// Login Form submit handling
loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = loginEmailInput.value.trim();
    const password = loginPasswordInput.value.trim();

    if (useFirebase && auth) {
        try {
            await signInWithEmailAndPassword(auth, email, password);
            showToast("Logged in successfully!", "success");
        } catch (error) {
            console.error("Firebase Auth Error:", error);
            showToast(error.message || "Invalid credentials.", "error");
        }
    } else {
        // Local Fallback Credentials
        if (email === "admin@rpm.com" && password === "admin123") {
            sessionStorage.setItem("rpm_local_authenticated", "true");
            isAuthenticated = true;
            updateAuthUI();
            setupLocalDb();
            showToast("Logged in successfully (Local mode)!", "success");
        } else {
            showToast("Invalid credentials. For local storage mode use admin@rpm.com and admin123", "error");
        }
    }
});

// Logout action
logoutBtn.addEventListener("click", async () => {
    if (useFirebase && auth) {
        try {
            await signOut(auth);
            showToast("Logged out successfully.", "info");
        } catch (error) {
            console.error("Sign out error:", error);
            showToast("Logout failed.", "error");
        }
    } else {
        sessionStorage.removeItem("rpm_local_authenticated");
        isAuthenticated = false;
        updateAuthUI();
        setupLocalDb();
        showToast("Logged out from local storage session.", "info");
    }
});

// Initialize on load
document.addEventListener("DOMContentLoaded", () => {
    // Force reset counter to zero on load
    localStorage.setItem("aura_notifications_count", "0");
    initDatabase();
    // Run reminder check every 5 minutes
    setInterval(checkForUpcomingReminders, 5 * 60 * 1000);
});
// Execute immediate init for modules environment
localStorage.setItem("aura_notifications_count", "0");
initDatabase();
setInterval(checkForUpcomingReminders, 5 * 60 * 1000);
