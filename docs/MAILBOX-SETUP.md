# Support mailbox — `hello@peeporunclub.co.uk`

Set up **Zoho Mail** on your domain for the first time. Harmonix already shows this address on the privacy page, terms, and Play Store listing pack — you only need a real inbox that receives mail and can reply.

| | |
|---|---|
| **Address** | `hello@peeporunclub.co.uk` |
| **Domain DNS** | GoDaddy (`peeporunclub.co.uk`) |
| **Mail provider** | Zoho Mail |
| **Harmonix code** | `client/src/lib/contact.ts` — no change if you keep `hello@` |
| **Phase checklist** | [17-CHECKLIST section A0](../.planning/phases/17-play-store-listing/17-CHECKLIST.md) |

Harmonix does **not** send email from the API. This is inbox-only for support, Play Console contact, and account-deletion requests.

---

## What you are building

```text
User / Play Console  →  hello@peeporunclub.co.uk  →  Zoho Mail (you read & reply)
Website footer       →  mailto:hello@…             →  same inbox
```

---

## GoDaddy DNS — read this first

Your domain DNS lives at **GoDaddy**. Before Zoho can receive mail, GoDaddy must point `@` to Zoho’s servers.

GoDaddy sometimes ships **default mail records** you did not create (for example an MX to Microsoft or an SPF for GoDaddy webmail). Treat those as clutter: **delete them** when you add Zoho’s records. You never need Microsoft for this project.

After a correct setup, a DNS check should show **Zoho MX** only, for example:

```bash
dig +short MX peeporunclub.co.uk
# mx.zoho.com.
# mx2.zoho.com.
# mx3.zoho.com.
```

---

## Recommended path: Zoho + GoDaddy connect

Fastest if Zoho offers it during domain setup.

1. Sign up at [zoho.com/mail](https://www.zoho.com/mail/) → pick a plan that includes **custom domain** email (Mail Lite or the free domain tier if offered).
2. Zoho Mail Admin → **Domains** → **Add** → `peeporunclub.co.uk`.
3. When Zoho asks how DNS is hosted, choose **GoDaddy** and use **Connect / Authorize** (one-click). Zoho logs into GoDaddy and adds verification, MX, SPF, and often DKIM for you.
4. Skip to [Create the mailbox](#create-the-mailbox) once the domain shows **Verified** in Zoho.

If one-click is unavailable or fails, use the manual path below. Zoho’s GoDaddy walkthrough: [zoho.com/mail/help/adminconsole/godaddy.html](https://www.zoho.com/mail/help/adminconsole/godaddy.html).

---

## Manual path — step by step

### Step 1 — Zoho account and domain

1. [zoho.com/mail](https://www.zoho.com/mail/) → create account.
2. Admin Console → **Domains** → **Add domain** → `peeporunclub.co.uk`.
3. Zoho shows a **domain verification** record (TXT or CNAME). Leave that tab open.

### Step 2 — GoDaddy: verify you own the domain

1. [account.godaddy.com](https://account.godaddy.com) → **My Products** → `peeporunclub.co.uk` → **DNS** (or **Manage DNS**).
2. **Add** the verification record Zoho gave you (usually TXT, Host `@`, Value copied from Zoho).
3. Save. In Zoho Admin, click **Verify**. Propagation can take a few minutes up to an hour.

Do **not** add MX yet until verification succeeds (Zoho’s wizard order may vary).

### Step 3 — GoDaddy: clean old mail records

In the same DNS page, **delete** any existing records that conflict with Zoho:

| If you see… | Action |
|-------------|--------|
| MX → `mail.protection.outlook.com` or anything not Zoho | **Delete** (GoDaddy default — you are not using Microsoft) |
| TXT `@` starting with `v=spf1` | **Delete** (you will add one Zoho SPF) |
| TXT `@` with `NETORG…onmicrosoft.com` | **Delete** (Microsoft tenant hint — not needed) |
| Extra MX records you do not recognise | **Delete** — only Zoho MX should remain |

Keep **A**, **CNAME** for `harmonix`, and **NS** records that serve the website — do not remove those.

### Step 4 — GoDaddy: add Zoho mail records

Open Zoho Admin → your domain → **Email Configuration** (MX / SPF / DKIM). **Copy values from Zoho** — do not guess. If your account is in the EU data centre, hostnames may be `mx.zoho.eu` instead of `mx.zoho.com`.

**MX** — add three records:

| Type | Name / Host | Points to / Mail server | Priority |
|------|-------------|-------------------------|----------|
| MX | `@` | `mx.zoho.com` * | 10 |
| MX | `@` | `mx2.zoho.com` * | 20 |
| MX | `@` | `mx3.zoho.com` * | 50 |

\*Use the exact hostnames shown in **your** Zoho Admin panel.

**SPF** — add **one** TXT record:

| Type | Name / Host | Value |
|------|-------------|--------|
| TXT | `@` | `v=spf1 include:zohomail.com -all` |

Only one SPF TXT at `@`. A second SPF record causes “permerror” and spam folder delivery.

**DKIM** — in Zoho Admin → **DKIM** → Generate → copy Host and Value:

| Type | Name / Host | Value |
|------|-------------|--------|
| TXT | `zoho._domainkey` | `v=DKIM1; k=rsa; p=…` (full long string from Zoho) |

Paste the entire DKIM value; GoDaddy accepts long TXT on one line.

Set TTL to the **shortest** option (600 s / 1 hour) while setting up; raise later if you want.

### Step 5 — Confirm in Zoho

Zoho Admin → domain → **Verify all records** (or MX / SPF / DKIM tabs each show a green tick).

| Record | Typical wait |
|--------|----------------|
| Domain verification | Minutes |
| MX (receive mail) | 1–2 hours |
| SPF + DKIM (send reputation) | Up to 24–48 hours |

---

## Create the mailbox

Pick **one** approach.

### Option A — Dedicated support user (simplest for Play Console)

1. Zoho Admin → **Users** → **Add user**
2. Name: Harmonix Support · Email: **`hello@peeporunclub.co.uk`**
3. Set password → save in password manager
4. Sign in at [mail.zoho.com](https://mail.zoho.com) (EU accounts: [mail.zoho.eu](https://mail.zoho.eu))

### Option B — Alias on your personal Zoho address

1. Create **`you@peeporunclub.co.uk`** (your main login)
2. User settings → **Email aliases** → add **`hello`**
3. Mail to `hello@…` arrives in your main inbox; when replying, choose **Send as hello@…**

Play Console and the privacy page still list `hello@` — aliases are fine.

---

## Test checklist

Complete before Play Console section B:

- [ ] `dig +short MX peeporunclub.co.uk` lists Zoho servers (not Microsoft / GoDaddy mail)
- [ ] Zoho Admin: domain verified, MX verified
- [ ] Send from **Gmail** → `hello@peeporunclub.co.uk` → appears in Zoho inbox
- [ ] Reply **from** `hello@` in Zoho → Gmail receives it (check spam once)
- [ ] [harmonix.peeporunclub.co.uk/privacy](https://harmonix.peeporunclub.co.uk/privacy) — footer mailto is `hello@peeporunclub.co.uk`

Optional: install **Zoho Mail** on your phone for Play review notifications.

---

## Play Console

Use the same address everywhere:

- **Contact email:** `hello@peeporunclub.co.uk`
- **Data safety — users can request deletion:** email this address from their account email
- Watch this inbox during Internal testing and Google review

Continue: [17-CHECKLIST section B](../.planning/phases/17-play-store-listing/17-CHECKLIST.md).

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Zoho says domain not verified | Wait 15–30 min; confirm TXT/CNAME in GoDaddy matches Zoho exactly (no extra quotes) |
| Mail to `hello@` never arrives | MX still wrong — re-check GoDaddy; remove non-Zoho MX; wait for TTL |
| Zoho verify OK but no inbound mail | MX priority/host typo — compare character-for-character with Zoho Admin |
| Replies land in Gmail spam | Enable DKIM in Zoho; ensure single SPF with `include:zohomail.com`; send a few normal replies |
| SPF permerror in mail headers | Two SPF TXT records at `@` — merge or delete duplicates |
| Wrong Zoho login URL | EU signup uses [mail.zoho.eu](https://mail.zoho.eu); US/global uses [mail.zoho.com](https://mail.zoho.com) |

---

## Using a different address

1. Edit `client/src/lib/contact.ts` → `SUPPORT_EMAIL`
2. Search the repo for `hello@peeporunclub.co.uk` and update listing copy
3. Push to `main` to redeploy web

Prefer a `@peeporunclub.co.uk` address in Play Console over personal Gmail.
