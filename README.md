# Where you left off

A personal study tracker that remembers what you started and where you stopped. Each course, subject or project gets a "left off at" note and a list of milestones, so picking things back up takes seconds instead of minutes.

## Why I built it

Studying across several courses and projects made it easy to lose track of where I had stopped. Most study trackers are built around timers, streaks and charts. This one does a single job: it shows what is in progress, what has gone quiet, and exactly where to restart.

## Features

- **Items:** add courses, subjects and projects, each with a status (not started, in progress, paused, done)
- **Left off at:** one short note per item, like "Unit 3, problem 12"
- **Milestones:** break an item into steps, tick them off, and leave a short note on any of them
- **Last touched:** every change updates it, so forgotten items stand out
- **Continue list:** in-progress items sorted by last touched, always at the top of the sidebar
- **Dashboard:** counts by status, overall milestone progress, items untouched for 7 days or more, and recently touched items
- **Links:** attach resource links to any item
- **Password protected:** one password guards all the data
- **Installable:** works as an app on phone and desktop (add to home screen)

## Tech stack

- **Frontend:** React 18, Vite, plain CSS
- **Backend:** Node.js, Express
- **Database:** MongoDB with Mongoose
- **Hosting:** Docker, Render (app) and MongoDB Atlas (database)

## Run it locally with Docker

You need Docker Desktop.

1. Create the volume that keeps the database between restarts:

   ```
   docker volume create study-mongo-data
   ```

2. Build and start everything:

   ```
   docker compose up -d --build
   ```

3. Open http://localhost:5000.

The containers restart automatically whenever Docker starts. Stop them with `docker compose down`; your data stays in the volume. Sign-in is optional locally and is switched on by setting a password through the app's environment variables.

## Run it without Docker (development)

You need Node 18 or newer and a local MongoDB instance.

```
# terminal 1
cd server
npm install
npm run dev

# terminal 2
cd client
npm install
npm run dev
```

Open the address Vite prints, usually http://localhost:5173. The server connects to a local MongoDB by default.

## How the login works

There is one user and one password, set through the app's environment variables. After signing in, the server sets an HttpOnly cookie signed with an HMAC, valid for 30 days. Every `/api` route except login and session checks it. After 10 wrong attempts from one address, further tries are blocked for 15 minutes.

## API

| Method | Route | What it does |
| --- | --- | --- |
| GET | `/api/session` | Whether a password is required and whether you are signed in |
| POST | `/api/login` | Sign in with `{ password }` |
| POST | `/api/logout` | Sign out |
| GET | `/api/items` | All items with their milestones, most recently touched first |
| POST | `/api/items` | Create an item (`title`, `kind`) |
| PATCH | `/api/items/:id` | Update title, kind, status, leftOffAt or links |
| DELETE | `/api/items/:id` | Delete an item and its milestones |
| POST | `/api/items/:id/milestones` | Add a milestone |
| PATCH | `/api/milestones/:id` | Update title, done or note |
| DELETE | `/api/milestones/:id` | Remove a milestone |

Any change to an item or one of its milestones updates the item's last-touched date.

## Project structure

```
client/               React app (Vite)
  src/App.jsx         Login, sidebar, dashboard and item screens
  src/api.js          Small fetch wrapper
  src/styles.css      All styling
  public/             Web app manifest and icons
server/               Express API
  index.js            Routes, login, and serving the built client
  models.js           Item and Milestone schemas
Dockerfile            Builds the client, then runs the server with it
docker-compose.yml    App and MongoDB for local use
render.yaml           Render deployment settings
```

## Deploy for free (Render and MongoDB Atlas)

1. Push the repo to GitHub.
2. In MongoDB Atlas, create a free M0 cluster and a database user, and allow network access so Render can connect.
3. In Render, create a Web Service from the repo with the **Docker** language and the **Free** instance type. Set the health check path to `/api/session`.
4. Add your database connection string and a password as environment variables in Render's settings.
5. Deploy, open the Render URL, sign in, and use "Install" or "Add to Home Screen" on each device.

The free Render service sleeps after 15 minutes without traffic, so the first visit after a break can take up to a minute to load.

## Limitations and ideas

- Single user only, by design
- The free Atlas tier has no automatic backups, so an "export my data" button is a good next addition
- Possible later: search across items, and a weekly review of what moved and what stalled
