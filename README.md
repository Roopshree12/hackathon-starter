# SurplusLink — Food Rescue Platform

SurplusLink is a web application that connects restaurants with surplus food to volunteers who can collect and deliver it before it goes to waste.

The platform helps restaurants list available food, allows volunteers to reserve suitable quantities, and provides a dashboard to track food collection, missed pickups, waste, and remaining availability.

## Features

- **Restaurant/Donor:** Post surplus food with quantity, zone, and pickup window.
- **Volunteer:** Browse donations and reserve food based on availability and eligibility rules.
- **Pickup management:** Collect or cancel reservations when permitted by the business rules.
- **Zone validation:** Match volunteers with donations in eligible zones.
- **Capacity validation:** Prevent reservations from exceeding volunteer capacity or available food.
- **Pickup scheduling:** Validate pickup windows and prevent conflicting reservations for the same volunteer.
- **Simulated clock:** Advance demo time to test pickup deadlines, expiration, and missed collections.
- **Dashboard:** Track listed, collected, missed, wasted, in-progress, and still-open quantities.
- **Persistent storage:** Store application state in MongoDB so changes survive server restarts.
- **Reset Demo:** Restore the original seed data for repeatable demonstrations.

## Technology Stack

- React
- Vite
- JavaScript
- CSS
- Node.js
- Express.js
- MongoDB
- Mongoose
- Git and GitHub

## Project Structure

```text
hackathon-starter/
├── backend/
│   ├── data/
│   ├── db.js
│   ├── seed.json
│   └── server.js
├── src/
│   ├── App.jsx
│   ├── App.css
│   └── ...
├── index.html
├── package.json
├── package-lock.json
├── vite.config.js
├── README.md
└── AI_USAGE.md
```

## Prerequisites

- Node.js and npm
- MongoDB running locally, or a MongoDB Atlas database
- Git (optional, for cloning the repository)

## Installation and Setup

### 1. Clone the repository

```bash
git clone https://github.com/Roopshree12/hackathon-starter.git
cd hackathon-starter
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure MongoDB

The backend uses MongoDB with Mongoose. By default, it connects to:

```text
mongodb://127.0.0.1:27017/surpluslink
```

Ensure your local MongoDB server is running before starting the application.

For MongoDB Atlas or another database, configure the `MONGODB_URI` environment variable with your connection string. Never commit database credentials to GitHub.

### 4. Start the application

Run both the backend and frontend in development mode:

```bash
npm run dev
```

Open the frontend at:

http://localhost:5173

The backend API runs at:

http://localhost:3000

### 5. Create a production build

```bash
npm run build
```

The production frontend is generated in the `dist/` directory. The Express server serves this build when running in production.

## Business Rules and Assumptions

- The application uses a simulated clock rather than the real system clock for pickup-related rules.
- Demo time can advance but cannot move backwards through the clock-advance operation.
- Reset Demo is a separate operation that restores the original seed state.
- Reservations must satisfy zone, volunteer capacity, food availability, pickup-window, and scheduling-conflict rules.
- Reservations must be scheduled at least 60 minutes apart for the same volunteer when the conflicting reservations are active or collected.
- An active reservation becomes missed when the simulated clock moves beyond the donation's pickup deadline.
- Collection and cancellation are allowed only when their respective business rules are satisfied.
- The dashboard reconciles listed food into collected, missed, wasted, in-progress, and still-open quantities.
- The application is a hackathon demonstration and does not implement user authentication or role-based access control.

## Deployment

The application can be deployed as a single Node.js web service that serves the React production build and Express API.

Suggested deployment configuration:

- Build command: `npm install && npm run build`
- Start command: `npm start`
- Environment variable: `MONGODB_URI`

Configure the environment variable securely in the hosting provider. The deployed application requires a reachable MongoDB database.

## Future Improvements

- User authentication and role-based permissions
- Food safety and expiry tracking
- Notifications for volunteers and restaurants
- Delivery confirmation and collection history
- Automated tests and improved error monitoring

## Author

SurplusLink was developed as a hackathon project focused on reducing food waste by coordinating restaurants and volunteer food collection.
