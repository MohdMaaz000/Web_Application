# RPM Bikes Dubai Appointment Scheduler

A lightweight frontend scheduler for managing customer bookings with optional Firebase Firestore integration and localStorage fallback.

## What this project includes

- Booking form with customer name, phone, and appointment time
- Dashboard view with live search, stats, and appointment actions
- Local browser storage fallback when Firebase config is not provided
- Firebase Firestore integration option via settings panel
- Appointment edit/update feature
- Delete appointment support
- Simulated WhatsApp notification preview
- Improved form validation for phone and future appointment time
- Responsive layout for smaller screens

## Completed improvements

- Added appointment editing support
- Added cancel-edit flow in the booking form
- Added stronger phone and date validation
- Added UI polish for responsive screens and form states
- Added `package.json` for local development and `README.md`

## Remaining work

- Add a real WhatsApp/SMS API integration if live notifications are required
- Add test coverage and further accessibility improvements
- Add backend authentication and user account support
- Add booking status updates beyond the static "Confirmed" label

## Backend notification API

A simple Express backend is included in `server.js` to relay notifications through Twilio. Create a `.env` file using `.env.example`, then run:

```bash
npm run api
```

For WhatsApp sandbox delivery, the customer must first join the Twilio sandbox by sending the Twilio-provided join code from their WhatsApp number to the sandbox number. Once they have joined, booking, update, and cancellation messages can be delivered automatically.

The frontend can post to a notification endpoint from the settings panel. If the notification API URL is configured, the app will attempt real delivery before falling back to the sandbox preview.

## Getting started

1. Install dependencies:

```bash
npm install
```

2. Start the local development server:

```bash
npm start
```

3. Open the URL shown in the terminal or access `http://127.0.0.1:5500`.

## Firebase setup

1. Open the `Firebase Config` panel inside the app.
2. Paste your Firebase Web App configuration values.
3. Save and allow the scheduler to connect to Firestore.

If no Firebase config is provided, the app runs automatically using browser `localStorage`.
