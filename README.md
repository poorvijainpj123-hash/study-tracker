# Study tracker

React + Node/Express + MongoDB. Single user, no login.

## Run it

You need Node 18+ and MongoDB running locally (or a MongoDB Atlas URI).

    # terminal 1
    cd server
    cp .env.example .env     # edit MONGO_URI if needed
    npm install
    npm run dev

    # terminal 2
    cd client
    npm install
    npm run dev

Open the URL Vite prints (usually http://localhost:5173).

## API

| Method | Route | What it does |
| --- | --- | --- |
| GET | /api/items | All items with milestones, newest touched first |
| POST | /api/items | Create an item (title, kind) |
| PATCH | /api/items/:id | Update title, kind, status, leftOffAt, links |
| DELETE | /api/items/:id | Delete an item and its milestones |
| POST | /api/items/:id/milestones | Add a milestone |
| PATCH | /api/milestones/:id | Update title, done, note |
| DELETE | /api/milestones/:id | Remove a milestone |

Any change to an item or its milestones updates "last touched".
