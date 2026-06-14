# Branded sign-up emails (SES + Cognito)

Status: **TODO**, not yet implemented. This doc captures the plan so we can pick
it up later.

## Problem

When a user signs up at `chat.echium.ai`, Cognito sends the verification code
from `no-reply@verificationemail.com`. Two issues:

- It almost always lands in spam (generic sender domain, no DKIM/SPF aligned
  with anything you control)
- It looks unbranded and untrustworthy
- Cognito's built-in mailer is also capped at ~50 emails/day per account

The fix is to route Cognito email through **Amazon SES** with `echium.ai` as
the verified sender domain, plus a custom HTML template.

## End state we want

- From address: `noreply@echium.ai` (or `verify@echium.ai` — TBD)
- Reply-to: `support@echium.ai` (TBD if you want one)
- HTML body with the EchiumAI logo, brand purple, plain-text fallback
- DKIM + SPF aligned with `echium.ai`
- Inbox placement instead of spam
- Higher daily quota than Cognito's default

## Two parallel tracks

### Track 1 — AWS / DNS work (manual, ~10 min clicking + ~24–72h waiting)

These have to happen in order. Steps 1–2 unlock domain-based sending. Step 3
unlocks sending to non-verified recipients (production access).

1. **Verify the domain in SES**
   - AWS Console → **SES** (eu-west-1) → **Verify identity** → Domain → `echium.ai`
   - Enable **Easy DKIM** with RSA 2048
   - Optional but recommended: enable **Custom MAIL FROM domain**
     (e.g. `mail.echium.ai`) for stronger SPF alignment
   - SES will give you 3 DKIM CNAME records (and 1 MX + 1 SPF TXT if you set
     the MAIL FROM domain)

2. **Add the records in Cloudflare**
   - DNS tab on `echium.ai` → add each as `CNAME` (or `MX`/`TXT`) exactly as
     SES provides
   - **Proxy status: DNS only** (gray cloud). Proxied breaks SES verification.
   - SES typically flips to **Verified** within ~30 min once the records propagate

3. **Request SES production access**
   - SES dashboard → **Account dashboard** → "Request production access" button
   - Fill the form. Suggested wording:
     - Mail type: Transactional
     - Use case: "User account verification and password reset emails for our
       SaaS application Echium AI Chat. Estimated volume: a few hundred
       emails/month, spike-bound to user sign-ups."
     - Recipient handling: "We only send to users who explicitly create an
       account on our platform; bounce/complaint handling via SES events."
   - Approval is usually within 24–48h. Until approved you stay in **sandbox**:
     SES will only deliver to verified email addresses, so sign-ups by random
     users will silently fail.

### Track 2 — CDK change (do this last, after SES is verified AND production access is granted)

`cdk/lib/constructs/auth.ts` — switch the `UserPool` to use SES, set custom
verification email content. Sketch:

```ts
import * as cognito from "aws-cdk-lib/aws-cognito";

const userPool = new UserPool(this, "UserPool", {
  // ...existing options...

  email: cognito.UserPoolEmail.withSES({
    sesRegion: "eu-west-1",
    fromEmail: "noreply@echium.ai",
    fromName: "Echium AI",
    replyTo: "support@echium.ai",
    sesVerifiedDomain: "echium.ai",
  }),

  userVerification: {
    emailSubject: "Verify your Echium AI account",
    emailBody: `
      <!doctype html>
      <html>
        <body style="margin:0;padding:0;background:#0b0b0f;
                     font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
                     color:#e5e7eb;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                 style="padding:40px 20px;">
            <tr><td align="center">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                     style="max-width:480px;background:#151517;border:1px solid rgba(255,255,255,0.08);
                            border-radius:16px;padding:40px;">
                <tr><td align="center" style="padding-bottom:24px;">
                  <img src="https://chat.echium.ai/images/echium_icon_192.png"
                       alt="Echium AI" width="56" height="56"
                       style="border-radius:14px;display:block;" />
                </td></tr>
                <tr><td align="center" style="padding-bottom:8px;
                          font-size:22px;font-weight:600;color:#ffffff;">
                  Verify your account
                </td></tr>
                <tr><td align="center" style="padding-bottom:24px;
                          font-size:14px;line-height:1.6;color:rgba(255,255,255,0.7);">
                  Welcome to Echium AI. Use this code to finish setting up your account:
                </td></tr>
                <tr><td align="center" style="padding-bottom:24px;">
                  <div style="display:inline-block;padding:14px 24px;
                              background:rgba(124,58,237,0.18);
                              border:1px solid rgba(124,58,237,0.45);
                              border-radius:12px;font-size:28px;letter-spacing:6px;
                              font-weight:600;color:#ffffff;">
                    {####}
                  </div>
                </td></tr>
                <tr><td align="center" style="font-size:12px;line-height:1.6;
                          color:rgba(255,255,255,0.45);">
                  This code expires in 24 hours. If you didn't sign up,
                  you can ignore this email.
                </td></tr>
              </table>
            </td></tr>
          </table>
        </body>
      </html>
    `,
    emailStyle: cognito.VerificationEmailStyle.CODE,
  },
});
```

Notes:

- `{####}` is the placeholder Cognito substitutes with the verification code.
- The `sesVerifiedDomain` makes CDK assume the SES identity already exists
  (Track 1 must be complete first).
- HTML-only emails can hurt deliverability; consider also setting a plain-text
  body. AWS CDK's Cognito construct currently only takes a single body, so we
  send HTML; SES will auto-generate a text/plain alternative.

### Track 2 deploy procedure

Once SES is verified AND production access is approved:

1. Apply the CDK change above on a feature branch
2. `git push origin <branch>` → CI runs to confirm synth + tests pass
3. Merge to `main`, push tag `vX.Y.Z` → deploy
4. Sign up with a real email at `chat.echium.ai`
5. Confirm:
   - Email arrives from `noreply@echium.ai`
   - Inbox, not spam
   - Logo + brand styling render
   - Code works to confirm sign-up
   - DMARC report (optional) shows `pass`

## Validation checklist

- [ ] SES identity for `echium.ai` shows **Verified** with DKIM enabled
- [ ] Custom MAIL FROM domain configured (optional but recommended)
- [ ] SPF TXT record in Cloudflare:
      `v=spf1 include:amazonses.com -all` (or include the SES MAIL FROM domain)
- [ ] DMARC TXT record in Cloudflare:
      `_dmarc.echium.ai TXT "v=DMARC1; p=quarantine; rua=mailto:dmarc@echium.ai"`
      (start with `p=none` if you want to monitor before quarantining)
- [ ] SES production access granted (no longer sandbox)
- [ ] CDK change merged + deployed
- [ ] Test sign-up: email lands in inbox, code works
- [ ] Send a test from `mail-tester.com` to score deliverability (target: 9+/10)

## Cost expectations

- SES: $0.10 per 1,000 emails. Sign-up + password reset for a startup is
  basically free.
- No new Lambda / infra cost; reuses Cognito + SES + the same IAM role.

## Common gotchas

- **Proxied DNS records.** Cloudflare proxied (orange cloud) breaks SES
  verification. Always DNS-only.
- **Sandbox mode.** Until production access is granted, SES will only deliver
  to email addresses you've explicitly verified in SES. Sign-up flows for
  random users will appear broken without any obvious error.
- **DKIM mismatch.** Make sure the DKIM CNAMEs are added in the same zone you
  registered with SES (`echium.ai`, not `www.echium.ai` or anything else).
- **Cached DNS.** If verification stays "Pending" for hours, check from a
  fresh resolver: `dig +short CNAME _xxxx._domainkey.echium.ai`.
- **Reply-to.** If you set a reply-to address, make sure that mailbox actually
  exists, otherwise replies bounce.
- **Cognito email rate.** Cognito itself caps SES calls at ~10/sec per user
  pool. Fine for human sign-ups, will throttle if a bot does mass sign-ups.

## Open questions to settle before doing Track 2

- [ ] Final From address: `noreply@echium.ai`? `verify@echium.ai`? `hello@`?
- [ ] Reply-to address (or skip Reply-to entirely)
- [ ] Email copy / final HTML — keep the sketch above or a different design?
- [ ] Do we want password-reset emails to use the same template style?
      (Different Cognito setting: `userPool.userInvitation`,
      `userPool.passwordPolicy` etc.)
