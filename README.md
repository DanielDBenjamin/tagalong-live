# Tagalong live class demo

A live prototype of Tagalong for presenting in class. Everyone scans a QR code, joins one shared campus on their phone, and posts and joins plans. The projector shows the university console: live numbers, the alcohol policy settings and the review queue.

- `index.html`: the student app (what the QR code opens)
- `console.html`: the university console for the projector (presenter sign-in)
- `js/policy.js`: alcohol policy presets and the auto-check
- `js/backend.js`: the data layer (Firebase, or local test mode)
- `firestore.rules`: database security rules

Plain HTML and JavaScript, with no build step.

## Try it locally

```
python3 -m http.server 8765
```

With no Firebase config, the app runs in **local test mode**: data syncs between tabs in one browser only.

- Console: http://127.0.0.1:8765/console.html (any email and password works locally)
- Students: open http://127.0.0.1:8765/ in several tabs. Each tab is a different student.
- Example data: open http://127.0.0.1:8765/test/seed.html, then `/?as=alex` and `/console.html?admin=1`
- Tests: http://127.0.0.1:8765/test/run.html

## Connect Firebase (one-time, about 15 minutes)

1. Go to https://console.firebase.google.com, choose **Create a project**, and name it e.g. `tagalong-demo`. Google Analytics isn't needed.
2. **Build → Authentication → Get started.** Under **Sign-in method**, enable **Anonymous** and **Email/Password**.
3. In **Authentication → Users → Add user**, create the presenter account (an email and a password). This is the console login.
4. In **Authentication → Settings → User actions**, untick **Enable create (sign-up)** so nobody else can make accounts.
5. **Build → Firestore Database → Create database.** Pick a European location (e.g. `eur3`) and start in **production mode**.
6. In **Firestore → Rules**, paste the contents of `firestore.rules`, replace `PRESENTER_EMAIL` with the presenter email, and **Publish**.
7. In **Project settings** (the gear icon) **→ Your apps**, add a **Web app** (`</>`). Copy the `firebaseConfig` object into `js/config.js`, and set `ADMIN_EMAIL` to the presenter email.
8. Once the site is online, go to **Authentication → Settings → Authorized domains** and add its domain (e.g. `yourname.github.io`).

The Firebase web config isn't a secret: it identifies the project, and the rules in step 6 decide who can do what.

## Running a class

1. Open `console.html` on the projector and sign in. The first sign-in creates the campus.
2. Optional: **Settings → Add starter plans**, so the feed isn't empty when people scan in.
3. Show the QR code. Students enter a first name and year.
4. To show the auto-check, switch presets in **Alcohol policy** and ask someone to post one of the example plans.
5. Afterwards: **Settings → Reset campus** deletes all names, plans and chats.

## Known limits (fine for a demo, not for production)

- The auto-check runs on the student's phone, so someone with developer tools could get around it. In the real product it would run on a server, using an AI model rather than a keyword list.
- Anyone can post "as a club" in the demo. In the real product, only verified club admins can.
- Free Firebase limits (50,000 reads a day) cover a class of 40 comfortably. Leaving the console open for days isn't a problem either.
