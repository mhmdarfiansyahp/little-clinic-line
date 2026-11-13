# Little Clinic Line

Build a web app called "ClinicQueue" for a small clinic to manage patient queues.

Patients:

- Patients can register with their name, phone number and the doctor they want to see

- After registering they get a queue number (A001, A002, ...) that resets every day

- Patients can see their number and how many people are ahead of them

Clinic staff:

- Staff log in with email and password

- There are two roles: admin and staff

- Staff can call the next patient, mark a patient as done, or skip a patient

- Admin can add doctors and manage staff accounts

Queue display:

- A public page for a TV in the waiting room that shows the number currently being called, large and easy to read, and updates automatically

Use Supabase for the database and login. Make it clean and modern, and it should work well on mobile.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/6b12298f-80d1-5c76-a184-29eef51e7fa0).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
