import React from 'react';
import LegalLayout from '../../components/LegalLayout';

const H2: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h2 className="pt-2 text-lg font-medium text-white/90">{children}</h2>
);

/**
 * Public Refund & Cancellation policy. Template content — must be reviewed by
 * a lawyer before launch. Reflects Paddle as merchant of record and EU
 * consumer rights.
 */
const RefundPolicyPage: React.FC = () => (
  <LegalLayout title="Refund & Cancellation Policy" lastUpdated="2026-06-23">
    <p>
      This policy explains how cancellations and refunds work for Echium AI
      subscriptions and prepaid usage credits. Payments are processed by our
      merchant of record, Paddle, and refunds are issued through Paddle.
    </p>

    <H2>Cancelling a subscription</H2>
    <p>
      You can cancel a paid subscription at any time from your account settings.
      Cancellation stops future renewals; your plan remains active until the end
      of the current billing period, after which your account reverts to the
      free tier.
    </p>

    <H2>Subscription refunds</H2>
    <p>
      If you are an EU consumer, you have a statutory right of withdrawal within
      14 days of purchase. Because the Service is digital content supplied
      immediately, by starting to use a paid plan you acknowledge that the
      withdrawal period may not apply once the service has been used. Outside of
      statutory rights, subscription fees already charged are generally
      non-refundable, but we review reasonable requests case by case.
    </p>

    <H2>Prepaid usage credits</H2>
    <p>
      Prepaid credits are consumed as you use the Service. Unused credit
      balances may be refundable on request, less any amount already consumed,
      subject to applicable law. Credits that have been consumed are not
      refundable.
    </p>

    <H2>How to request a refund</H2>
    <p>
      Contact us at support@echium.ai with your account email and the purchase
      in question. Approved refunds are returned to your original payment method
      via Paddle. Processing times depend on your payment provider.
    </p>

    <H2>Failed or disputed payments</H2>
    <p>
      If a payment fails, access to paid features may be paused until payment is
      resolved. Please contact us before opening a payment dispute so we can
      help resolve the issue directly.
    </p>

    <H2>Contact</H2>
    <p>
      For any billing question, email support@echium.ai.
    </p>
  </LegalLayout>
);

export default RefundPolicyPage;
