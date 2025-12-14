# Project Features Documentation

This document provides a detailed explanation of all features within the current Vanilla JS application to facilitate its migration to React or Next.js.

## 1. Introduction
The application is a "Smart Evaluate" system designed for educational institutions to manage students, groups, tasks, and evaluations. It features a comprehensive dashboard, detailed analytics, and a robust evaluation system with role-based access control.

## 2. Core Features

### 2.1 Dashboard (`dashboard.js`)
The dashboard serves as the central hub, providing a high-level overview of the system's status.
-   **Hero Section**: Displays a welcome message and a summary card.
-   **Statistics Grid**: Shows key metrics like Total Groups, Total Students, Total Tasks, and Total Evaluations.
-   **Elite Groups**: Highlights the top 3 performing groups based on their average scores.
-   **Academic Group Performance**: A bar chart visualizing the performance of different academic groups (Science, Business, Humanities, etc.).
-   **Top Groups Ranking**: A list of groups ranked by their efficiency (average score).
-   **Visibility Control**: Admin users can toggle the visibility of these sections via the Settings page.

### 2.2 Authentication (`authService.js`)
-   **Firebase Integration**: Uses Firebase Authentication for user management.
-   **Login/Register**: Supports email/password login and Google Sign-In.
-   **Role-Based Access Control (RBAC)**:
    -   **Super Admin**: Full access to all features.
    -   **Admin**: Can read and write data but cannot delete critical records.
    -   **User**: Read-only access to public features.
-   **Session Management**: Persists user sessions and handles auto-login.

### 2.3 Student Management (`members.js`)
-   **CRUD Operations**: Add, Edit, and Delete student profiles.
-   **CSV Import**: Bulk import students from CSV files.
-   **Filtering**: Filter students by Group and Academic Group.
-   **Search**: Real-time search by name or roll number.
-   **Print List**: Generate a printable PDF list of filtered students.
-   **Student Card**: Displays student details (Name, Roll, Group, Photo) and provides quick access to edit/delete actions.

### 2.4 Group Management (`groups.js`)
-   **CRUD Operations**: Create, Edit, and Delete student groups.
-   **Group Details**: Assign a mentor and leader to each group.
-   **Selection Dropdowns**: Provides utility functions to populate group selection dropdowns across the app.

### 2.5 Task Management (`tasks.js`)
-   **Task Creation**: Create new assignments with specific details:
    -   **Name & Description**: Title and details of the task.
    -   **Date & Time**: Deadline or event time.
    -   **Score Breakdown**: Define max scores for Task, Team, Additional, and MCQ components.
-   **Status Management**: Tasks have statuses like "Upcoming", "Ongoing", and "Completed", which can be manually updated or derived from the date.
-   **Validation**: Ensures total max score matches the sum of its components.

### 2.6 Evaluation System (`evaluation.js`)
The core feature for grading students based on tasks.
-   **Dynamic Form**: Generates a scoring form for a selected Group and Task.
-   **Scoring Components**:
    -   **Task Score**: Individual performance.
    -   **Team Score**: Group contribution.
    -   **MCQ Score**: Multiple-choice question performance.
    -   **Additional Criteria**: Bonus/Penalty points for "Topic Understanding" (e.g., "Learned Well", "Understood", "None") and "Options" (Homework, Attendance).
-   **Problem Recovered**: A checkbox to indicate if a student recovered from a "Problematic" status (e.g., initially didn't understand the topic).
-   **Role Badges**: Visual indicators for student roles (Team Leader, Time Keeper, etc.) within the evaluation form.
-   **Real-time Calculation**: Automatically calculates total scores and group averages as data is entered.

### 2.7 Ranking System (`ranking.js`)
-   **Student Ranking**: Ranks students based on their "Efficiency" (Total Score / Max Possible Score * 100).
    -   **Filters**: Search by Name or Roll.
    -   **Visuals**: Uses a "soft 3D" card design with circular progress meters.
-   **Group Ranking**: Ranks groups based on their average efficiency.
    -   **Metrics**: Shows Member count, Participation count, and Average %.

### 2.8 Analysis & Reports (`analysis.js`)
-   **Summary View**:
    -   **Group Metrics**: Detailed stats for a specific group (Participation Rate, Average Score, etc.).
    -   **Member Performance**: A table showing each member's average scores across all evaluations.
    -   **Evaluation History**: A list or chart of all past evaluations for the group.
-   **Graph Analysis**: Visualizes performance trends using Chart.js.
-   **PDF Export**: Generates comprehensive PDF reports:
    -   **Group Analysis**: Summary of group performance.
    -   **Student Report**: Individual student performance report.
    -   **Full Details**: A deep-dive report including all scores and comments.

### 2.9 Result Details Modals
-   **Student Details (`student-result-details.js`)**:
    -   Displays a student's profile, total average, and rank.
    -   Shows a breakdown of scores (Task, Team, etc.) using progress bars.
    -   Lists all past evaluation results with status indicators (e.g., "Problem Resolved").
    -   Generates a downloadable PDF report for the student.
-   **Group Details (`group-result-details.js`)**:
    -   Displays group aggregate stats.
    -   **Members Tab**: Lists all members with their scores for a selected assignment.
    -   **Evaluations Tab**: Lists all evaluations for the group.

### 2.10 Settings (`settings.js`)
-   **Theme Configuration**:
    -   **Pre-defined Themes**: Blue, Emerald, Violet, Amber.
    -   **Global Theme**: Admins can set a default theme for all users.
    -   **Local Override**: Users can set their own theme preference.
-   **Sidebar Management**:
    -   **Visibility**: Toggle visibility of sidebar items.
    -   **Access Type**: Switch items between "Public" (visible to all) and "Private" (admin only).
-   **Dashboard Configuration**: Toggle visibility of specific dashboard sections (Hero, Stats, Ranking, etc.).

## 3. Technical Architecture

### 3.1 State Management (`stateManager.js`)
-   **Centralized Store**: Holds the application state (students, groups, tasks, evaluations, currentUser).
-   **Reactivity**: Components subscribe to state changes and re-render automatically.
-   **Filters**: Manages filter states for various views (e.g., Analysis filters).

### 3.2 Data Service (`dataService.js`)
-   **Firebase Abstraction**: Handles all Firestore interactions (get, add, update, delete).
-   **Batch Operations**: Supports batch deletions (e.g., deleting a task and its evaluations).
-   **Caching**: Implements basic caching to reduce network requests.

### 3.3 UI Manager (`uiManager.js`)
-   **DOM Manipulation**: Helper functions for creating elements, clearing containers, and handling modals.
-   **Toast Notifications**: Displays success/error messages.
-   **Loading States**: Manages loading spinners and overlays.

### 3.4 Theme Manager (`themeManager.js`)
-   **CSS Variables**: Manages CSS variables for colors to support dynamic theming.
-   **Dark Mode**: Toggles the `.dark` class on the `html` element.

## 4. Data Models

### 4.1 Student
```json
{
  "id": "string",
  "name": "string",
  "roll": "string",
  "groupId": "string",
  "academicGroup": "string", // Science, Business, etc.
  "role": "string", // team-leader, time-keeper, etc.
  "photoURL": "string"
}
```

### 4.2 Group
```json
{
  "id": "string",
  "name": "string",
  "mentor": "string",
  "leaderId": "string"
}
```

### 4.3 Task
```json
{
  "id": "string",
  "name": "string",
  "description": "string",
  "date": "timestamp",
  "status": "string", // upcoming, ongoing, completed
  "maxScore": number,
  "maxScoreBreakdown": {
    "task": number,
    "team": number,
    "additional": number,
    "mcq": number
  }
}
```

### 4.4 Evaluation
```json
{
  "id": "string",
  "taskId": "string",
  "groupId": "string",
  "scores": {
    "studentId": {
      "taskScore": number,
      "teamScore": number,
      "mcqScore": number,
      "additionalScore": number,
      "totalScore": number,
      "comments": "string",
      "problemRecovered": boolean,
      "additionalCriteria": {
        "topic": "string", // topic_learned_well, etc.
        "homework": boolean,
        "attendance": boolean
      }
    }
  },
  "groupAverageScore": number
}
```
