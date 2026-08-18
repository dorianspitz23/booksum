# Security Policy

## Reporting a vulnerability

Please report security issues privately rather than opening a public issue.

Use GitHub's [private vulnerability reporting](https://github.com/dorianspitz23/booksum/security/advisories/new)
on this repository. If that is unavailable to you, open a regular issue that says only that you have
a security report and asks for a contact route — no details in it.

Please include what you would want to receive yourself: what an attacker can do, the steps to
reproduce it, and which version or commit you saw it on.

This is a single-maintainer hobby project, not a funded programme. There is no bounty, and a
realistic expectation is a first reply within a week. Reports are welcome regardless.

## What the threat model actually is

BookSum has **no server, no accounts and no backend**. Nothing you store is transmitted anywhere
except the API calls you trigger yourself, and those go directly from your browser to Google. That
removes most of the usual attack surface and leaves a small, specific set of things that matter:

**In scope**

- **Anything that could leak the Gemini API key** — into a build artifact, a log, an error message,
  a URL, a third-party request, or storage another origin can read.
- **Anything that causes a request to a third party** that the user did not initiate. Opening the
  app should contact nobody at all.
- **Cross-site scripting**, particularly through content the app does not author: AI responses,
  imported Goodreads CSV fields, book titles, PDF filenames, and restored backup files.
- **Stored file handling.** Uploaded PDFs and generated audio come back out on `blob:` URLs that
  inherit the page's origin, so the recorded MIME type decides how the browser treats those bytes.
- **Prompt injection with a real consequence** — for example content that redirects the model in a
  way that spends your quota or persists misleading data into your library.
- **Supply chain** — a dependency shipping something the lockfile did not describe.

**Out of scope**

- **Profiles are not a security boundary.** They have no passwords and never have. They exist so
  people sharing a browser can keep separate shelves. Anyone with access to the browser profile can
  open any BookSum profile and read its data — this is documented, intended, and not a vulnerability.
- **Local data is not encrypted.** IndexedDB contents are readable by anyone with access to the
  machine and browser profile, and by browser extensions the user has installed. An earlier version
  of the app displayed a "local storage encryption" toggle that was wired to nothing; it was removed
  precisely because claiming otherwise was worse than being plain about it.
- **Your own key in your own browser.** `localStorage` is the intended home for it. Reading it
  requires access you already have.
- Vulnerabilities in Google's Gemini API, OpenLibrary, or Google Books.
- Anything requiring physical access to an unlocked machine.

## If you think your key has leaked

Revoke it in [Google AI Studio](https://aistudio.google.com/apikey) and issue a new one. Nothing in
BookSum can revoke it for you. Removing the key from **My Profile** clears it from this browser
only.

## Supported versions

The latest commit on `main` is what receives fixes. There are no maintained release branches.
