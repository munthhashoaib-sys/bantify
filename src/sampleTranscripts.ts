/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface SampleTranscript {
  id: string;
  title: string;
  description: string;
  expectedStatus: 'Strongly Qualified' | 'Partially Qualified' | 'Not Yet Qualified';
  text: string;
}

export const SAMPLE_TRANSCRIPTS: SampleTranscript[] = [
  {
    id: 'strongly-qualified',
    title: 'Acme Corp - Enterprise ERP Integration Call',
    description: 'A call with a VP of Finance who outlines a clear budget ($250k), explicit buying authority, immediate migration need due to an expiring legacy server, and a 60-day deadline.',
    expectedStatus: 'Strongly Qualified',
    text: `SDR (Marcus): Hi Sarah, thanks for hopping on. As discussed, I wanted to learn more about Acme Corp's plan to modernize your accounting flow. What's driving the initiative?

Client (Sarah Jenkins): Thanks Marcus. Honestly, it's urgent. We are currently playing spreadsheet gymnastics between our billing software and our legacy ERP, which is hosting on-prem. It's slow and prone to errors. But the real trigger is that our service contract with our legacy vendor ends on August 31st — exactly three months from now. We are absolutely not renewing. We need a new cloud ERP integrated and live before then to avoid a costly $40,000 month-to-month fee.

SDR (Marcus): That makes complete sense. We can definitely help prevent that rollover fee. Who else on your team will be involved in evaluating our software and pulling the trigger?

Client (Sarah Jenkins): I'm the VP of Finance here, so the ultimate budgetary sign-off lands on my desk. However, Dave, our CTO, needs to vet the API integrations and security standards. He and I will be the ones making the decision together, and our CEO practically rubber-stamps whatever we co-sign for operational tools.

SDR (Marcus): Excellent. It sounds like you are the prime sponsor alongside Dave. Have you set aside a budget range for this migration and first-year licensing?

Client (Sarah Jenkins): Yes, we mapped this out in our Q2 planning. We have a set, board-approved capital expenditure budget of up to $250,000 for this transition. That must cover implementation, custom field mapping, and the first 12 months of seat license fees for 150 users. If your quote lands in that ballpark, we are in a safe spot to expedite vendor onboarding.

SDR (Marcus): Excellent, Sarah. That budget is fully aligned with our Enterprise tier. I would love to set a dedicated deep-dive demo session with your AE, Elena, and Dave from your team, to map out the implementation timeline. How does next Tuesday at 2 PM sound?

Client (Sarah Jenkins): That works perfectly. I will forward Elena the current data schema so Dave can review it beforehand. Looking forward to it!`
  },
  {
    id: 'partially-qualified',
    title: 'Zenith Tech - CRM Automation Inquiry',
    description: 'A call with a Product Lead who has strong business need and timeline (3-4 months), but doesn\'t have immediate budget signoff and must route buying through the CFO.',
    expectedStatus: 'Partially Qualified',
    text: `SDR (Marcus): Hi David, great to connect today. I saw you requested a demo of our CRM automation suite. Could you share what challenges you are currently facing with your pipeline management?

Client (David Cho): Absolutely. I am a Product Lead for our Sales Enablement division at Zenith Tech. Right now, our SDRs are spending almost 15 hours a week manually copying and pasting interactions from our dialer into our client records. We are losing leads because of double-data entry delays. We absolutely need to automate this workflow. We'd love to see a live demo of your automated sync triggers.

SDR (Marcus): That's a huge burden on your field agents. Integrating this will save them hundreds of hours. Regarding decision-making, who would oversee the ultimate procurement and contract agreements?

Client (David Cho): Well, that's the tricky part. Our department can recommend products, and I am the primary champion investigating options. Ultimately, though, any vendor contract over $10,000 must be reviewed by our Procurement Officer, Linda, and final approval rests with our CFO. In fact, our sales operations lead is also strongly advocating for HubSpot's automation hooks since we have some legacy marketing there, so we are evaluating you both. I can build the business case, but they make the call.

SDR (Marcus): Understood, David. Building that business case is exactly what we do. Do you have a sense of what budget has been allocated for these automated modules?

Client (David Cho): Honestly, we do not have a dedicated budget carved out for this yet. We're hoping to pull funds from our general 'sales operations' budget, but we'll need to see the pricing tiers first to ask for a formal allocation. We're hoping it's reasonable, but I can't give you a dollar amount today.

SDR (Marcus): No problem, we can share our modular pricing models. When are you looking to have these automation syncs set up?

Client (David Cho): We wants to make it happen around late Q3, so realistically we are looking at a 3 to 4 month window. We'd love to get the ball rolling with a demo next week if possible, so we can determine if your SDK supports our dialer.

SDR (Marcus): That works well. Let's get that demo set up with your AE, Elena, so she can show you the modular costs and custom integrations. I will send over the calendar invite shortly.`
  },
  {
    id: 'not-qualified',
    title: 'Solopreneur / Boutique Cafe - Simple Web Scheduling',
    description: 'A caller who is a Cafe Manager looking for a cheap booking calendar. They have no dedicated budget (hope it\'s free), and no immediate buy authority or timeline.',
    expectedStatus: 'Not Yet Qualified',
    text: `SDR (Marcus): Hello Clara, thanks for calling our Enterprise Suite line. How can I help you today?

Client (Clara): Hi Marcus! I run a small local cafe called 'The Warm Mug'. We have about five tables, and I'm looking to add a little calendar to our website so folks can book our back room for small birthday parties or local book clubs. I saw your enterprise automation suites and thought they looked fancy!

SDR (Marcus): That's wonderful! Book clubs and birthday parties are highly engaging events. Just to make sure we set correct expectations, our suite is designed for large-scale, enterprise CRM syncs, with full-time workspace licenses starting at $2,000 per month. Are you looking for an enterprise-level automation database, or is this primarily a consumer-facing calendar?

Client (Clara): Oh wow, $2,000 a month! No, no, no, that's way out of our league. We was hoping for something that's under $15 a month, or ideally free, since we only host maybe 2 or 3 events a month. I'm just the cafe manager here, and our owner told me to see if there was any tool handy online. 

SDR (Marcus): Got it, Clara. Yes, we are definitely styled for complex integrations. It looks like a standard free plug-in would fit your needs perfectly. Do you have any deadline when you absolutely need this launch to go live?

Client (Clara): No real date. Just whenever I get some free time to figure out our website builder. No rush at all, it's just an extra idea we had last week. 

SDR (Marcus): Fully understood. I will email you a couple of links to free booking calendar tools that work great with self-serve website builders, which will save you that budget!

Client (Clara): Thank you so much, Marcus! You have been extremely helpful. Have a great day!`
  }
];
