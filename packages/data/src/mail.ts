/**
 * Mail templates (GDD §8). Senders have personalities; phish templates must
 * include the tells the player can spot (mismatched domain, urgency, link).
 * `isPhish` marks traps — content writing stays in data, engine logic in sim.
 */
export interface MailTemplate {
  id: string;
  from: string;
  subject: string;
  body: string;
  kind: 'mentor' | 'vendor' | 'client' | 'invoice' | 'spam' | 'phish' | 'regulator';
  /** Mail the player can act on: each action becomes a sim Command. */
  actions?: { label: string; command: string }[];
}

export const STARTER_MAIL: MailTemplate[] = [
  {
    id: 'mentor-welcome',
    from: 'Dr. Paula Reboot (mentor)',
    subject: 'Welcome to the trade',
    body:
      'Every outage has two causes: something you did, and something you didn\'t do.\n\n' +
      'Start small: give every machine an address, keep one subnet, and write down what you changed. ' +
      'The tickets will tell you WHAT hurts — never WHY. That part is your job.\n\n' +
      '— Paula',
    kind: 'mentor',
  },
  {
    id: 'vendor-novabit-update',
    from: 'Novabit Updates',
    subject: 'RouterOS-like 7.15 released — fixes CVE-2026-3312 (DNS cache poisoning)',
    body:
      'Novabit 7.15 fixes a critical DNS cache poisoning flaw (CVE-2026-3312).\n\n' +
      'Known issue: DHCP relay is broken under 7.15.1; fixed in 7.15.2.\n' +
      'Recommendation: read the release notes before rolling out.',
    kind: 'vendor',
    actions: [{ label: 'Open release notes', command: 'openReleaseNotes:7.15' }],
  },
  {
    id: 'phish-invoice-01',
    from: 'Vandor Billing Dept <billing@vand0r-updates.example>',
    subject: 'URGENT: unpaid invoice — service suspends in 24h',
    body:
      'Dear customer,\n\nYour payment has FAILED. Click below or your network services will be SUSPENDED in 24 HOURS.\n\n' +
      'Pay now: http://vand0r-updates.example/pay?id=8841\n\n' +
      'Vandor Billing Dept. (this footer was copied from a real vendor)',
    kind: 'phish',
    actions: [{ label: 'Pay now', command: 'phish-pay:8841' }, { label: 'Report as phish', command: 'reportPhish' }],
  },
  {
    id: 'spam-01',
    from: 'CloudScale Deals <noreply@cloudscale-deals.example>',
    subject: '50% off enterprise switches this week only!!',
    body: 'Huge savings! Click here! Unsubscribe?',
    kind: 'spam',
  },
  {
    id: 'client-01-first-ticket',
    from: 'Café Kopi Dua (client)',
    subject: 'Card machine can\'t reach the payment server',
    body:
      'Hi — the card terminal at the register stopped working this morning. Everything else seems fine?\n\n' +
      'Please help quickly, lunch rush is coming.',
    kind: 'client',
  },
];
