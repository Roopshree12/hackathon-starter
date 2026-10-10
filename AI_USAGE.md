# AI Usage Disclosure — SurplusLink

## Overview

AI assistance was used during the development of SurplusLink to support implementation, debugging, documentation, and understanding of the application architecture.

AI was used as a development aid. The project code was run and tested locally, and suggestions were reviewed and adapted to the application's requirements.

## Areas Where AI Assistance Was Used

### 1. Project Planning and Architecture

AI helped break down the problem statement into frontend, backend, persistence, scheduling, validation, and dashboard requirements.

**Accepted:** Using a React frontend with an Express API and persistent application state.

**Adapted:** The implementation was aligned with the existing Vite project structure and the application's actual API and data model.

### 2. Backend Development

AI assistance was used to understand and implement Express routes, state persistence, reservation validation, simulated-clock behavior, collection and cancellation rules, and dashboard calculations.

**Accepted:** Separating API operations into clear routes and validating reservation rules before accepting claims.

**Adapted:** Error handling, state initialization, and persistence were adjusted to work with the project's MongoDB/Mongoose configuration.

### 3. Frontend Development

AI assistance helped with React component structure, form handling, API requests, status displays, dashboard presentation, and the Reset Demo interaction.

**Accepted:** Providing user feedback for successful actions and validation errors.

**Adapted:** The UI and interactions were integrated into the existing React application and CSS.

### 4. Debugging and Testing

AI was used to investigate development and runtime issues, interpret terminal output, and plan manual tests.

Testing included running the production build and checking important application workflows, including reservations, scheduling validation, simulated time, missed claims, and demo reset.

### 5. Documentation and Deployment

AI assistance was used to draft the README, explain local setup, review Git commands, and prepare deployment configuration guidance.

The documentation should be checked against the final implementation before submission.

## Human Review and Verification

AI-generated suggestions were reviewed and adapted before use. The application was run locally, and the production build completed successfully.

The final submission should be evaluated against the actual source code and tested workflows. Not every possible edge case or deployment environment has necessarily been verified.

## Limitations

- The application is a hackathon demonstration rather than a production-ready food logistics platform.
- Authentication and role-based access control are not implemented.
- The simulated clock is intended for demonstrating scheduling and expiry behavior.
- Cloud deployment and database connectivity must be tested in the target hosting environment.

## Transparency

AI assistance supported development, but the final implementation, testing, and submission remain the responsibility of the project author.
