# Actual idiots — public conversations

A complete **static** website with a ChatGPT-like conversation sidebar, public searchable questions, and **admin-only replies**. Built with plain HTML/CSS/JS, Firebase Authentication, and Cloud Firestore. No Node build step or custom server required.

## Features
- Anyone can read questions and admin replies, without signing in.
- Visitors can create a public question with a title and an initial message, using Firebase Anonymous Authentication invisibly.
- Only registered administrators can send replies, as enforced by Firestore Security Rules.
- Live updates to lists, questions, and replies.
- Search within the newest 100 conversation titles and initial messages. **Not** full-text search of all historical replies.
- Responsive, minimalist ChatGPT-inspired desktop and mobile design; shareable `?chat=...` links.
- Admin login via Firebase email/password; admin allowlist stored in Firestore.

## Get started (10 steps)

1. Create a project on https://console.firebase.google.com/ using the **Spark** plan.
2. Click **Add app > Web** (the `</>` icon), register a web app, and copy its Firebase config object.
3. Open `firebase-config.js` and replace the placeholder values. This configuration is meant to be public. **Never** put an admin password, private key, service-account JSON, or secret in source code.
4. In **Build > Authentication > Sign-in method**, enable **Anonymous** and **Email/Password** providers.
5. In **Build > Firestore Database**, create a Cloud Firestore database. Choose your region deliberately (consider an EU location if appropriate). Do not use open development rules permanently.
6. Open **Firestore Database > Rules**, replace the rules with everything in `firestore.rules`, then click **Publish**.
7. In **Authentication > Users**, add an admin account using **Add user** and its email/password. Copy its **User UID**.
8. In **Firestore Database > Data**, manually create a collection named `admins` with a document ID that is exactly the admin's UID. Add a **Boolean** field named `enabled` set to `true`. Do not create this via the public website; rules prohibit clients from changing admin membership.
9. In **Authentication > Settings > Authorized domains**, add your real deployed domain (such as `yourproject.vercel.app`) if it isn't already present. Add local development domains as needed.
10. Upload `index.html`, `styles.css`, `app.js`, `firebase-config.js`, and optionally `firestore.rules`, `README.md` to a GitHub repo. Import the repository into Vercel. Select **Other** (static site), leave build command empty, and publish the repository root as the output directory.

Once deployed, visit the site, ask a question, and click **Admin sign in** to sign in as the admin. The `admins/<uid>` document is what grants permissions—not the email address or a button in HTML.

## Local preview

Use a local HTTP server (ES modules won't reliably load from a `file://` URL):

```sh
python3 -m http.server 8080
```

Open http://localhost:8080 . Configure Firebase and add `localhost` as an authorized domain if needed.

## How the database is organized

```
admins/{adminUid}                        { enabled: true }
conversations/{conversationId}          { title, initialMessage, createdBy, status, createdAt, updatedAt }
conversations/{conversationId}/replies/{replyId} { text, senderUid, createdAt }
```

A conversation's **initial message is stored in its parent document**, not as a reply. This makes it possible to guarantee that visitors can publish one initial question but **cannot reply later**. Only authenticated admins can create entries under `/replies`.

## Important caveats before public launch

- **No backend rate limiting or CAPTCHA is included.** Anonymous identities can be generated repeatedly. Firebase rules limit what each write can contain, but they are **not** robust anti-spam controls or per-IP rate limiting. For a larger public deployment, add App Check, abuse prevention, moderation, and a reliable rate-limited submission backend.
- All messages are intentionally public. Provide a privacy policy, privacy/contact process, deletion/retention policy, and moderation approach; warn users against sharing personal information.
- Search only filters the newest 100 questions by **title and initial question**, not reply text. To search a large archive, add a search service or indexed server-side search.
- The app displays up to the first 100 admin replies per conversation. Add pagination for very long threads.
- Firestore use is metered. The Spark plan has free quotas; exceeding quotas may disable operations until reset. Real-time listeners can incur reads even for unchanged interfaces.
- Vercel Hobby is for eligible personal/non-commercial uses. Choose compliant hosting for a business site.
- Public deletion through the admin dashboard is **not** implemented. Delete a conversation and any replies in the Firebase Console; Firestore deleting a parent document does not automatically delete subcollections.
- Admin reply write and marking the conversation answered are separate operations. If the status update fails, the reply may be visible while the status remains open; retry or correct the status in the console.

## Customize

The site name is **Actual idiots**. Change colors, typography, and layout in `styles.css`. This is a self-contained starter, not a hosted account or preconfigured Firebase project.
