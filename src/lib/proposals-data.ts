// Dummy data for proposals — will be replaced by API/database later

export interface ProposalContribution {
  id: string
  author: {
    name: string
    avatar: string
    discordId: string
  }
  amount: number
  token: string
  txHash: string
  date: string
}

export interface ProposalImage {
  url: string
  caption?: string
  author: {
    name: string
    avatar: string
    discordId: string
  }
  date: string
  commentId?: string // links to the comment that shared it
}

export interface ProposalComment {
  id: string
  author: {
    name: string
    avatar: string
    discordId: string
  }
  content: string
  date: string
  images?: string[] // image URLs attached to this comment
  tokenContribution?: {
    amount: number
    token: string
    txHash: string
  }
  encrypted?: {
    for: string[] // names of recipients
  }
  nostrEventId?: string
}

export interface Proposal {
  id: number
  title: string
  description: string
  type: string
  status: string
  author: {
    name: string
    avatar: string
    discordId: string
  }
  organisers: {
    name: string
    avatar: string
    discordId: string
  }[]
  createdAt: string
  updatedAt: string
  // Room/event fields
  room?: string
  date?: string
  startTime?: string
  duration?: number
  // Funding
  walletAddress: string
  priceTotal: number
  pricePaid: number
  token: string
  contributions: ProposalContribution[]
  // Activity
  comments: ProposalComment[]
  // Metadata
  metadata: Record<string, unknown>
  // Expense
  expenseUrl?: string
}

const AVATARS = {
  xavier: "https://cdn.discordapp.com/avatars/849888126/abc.png",
  alice: "https://i.pravatar.cc/150?u=alice",
  bob: "https://i.pravatar.cc/150?u=bob",
  carol: "https://i.pravatar.cc/150?u=carol",
  david: "https://i.pravatar.cc/150?u=david",
  elena: "https://i.pravatar.cc/150?u=elena",
  frank: "https://i.pravatar.cc/150?u=frank",
}

export const DUMMY_PROPOSALS: Proposal[] = [
  // #1 — Past event, funded by one community member, completed
  {
    id: 1,
    title: "Commons Game — February Edition",
    description: `Monthly Commons Game session where we play Elinor Ostrom's 8 principles in action.

This month's theme: **Water Commons** — how do communities manage shared water resources?

We'll play 2 rounds of the game followed by a debrief discussion connecting the game mechanics to real-world commons governance.`,
    type: "event",
    status: "completed",
    author: { name: "Xavier", avatar: AVATARS.xavier, discordId: "849888126" },
    organisers: [
      { name: "Xavier", avatar: AVATARS.xavier, discordId: "849888126" },
    ],
    createdAt: "2026-02-01T10:00:00Z",
    updatedAt: "2026-02-15T18:00:00Z",
    room: "ostrom",
    date: "2026-02-15",
    startTime: "14:00",
    duration: 180,
    walletAddress: "0x1234567890abcdef1234567890abcdef12345678",
    priceTotal: 9,
    pricePaid: 9,
    token: "CHT",
    contributions: [
      {
        id: "c1",
        author: { name: "Alice", avatar: AVATARS.alice, discordId: "111111111" },
        amount: 9,
        token: "CHT",
        txHash: "0xaaa111222333444555666777888999000aaabbbcccdddeeefff000111222333",
        date: "2026-02-03T14:30:00Z",
      },
    ],
    comments: [
      {
        id: "m1",
        author: { name: "Alice", avatar: AVATARS.alice, discordId: "111111111" },
        content: "I'll fund this one! The Commons Game is such a great way to onboard new members. Happy to cover the full room cost.",
        date: "2026-02-03T14:25:00Z",
      },
      {
        id: "m2",
        author: { name: "Xavier", avatar: AVATARS.xavier, discordId: "849888126" },
        content: "Thanks Alice! 🙌 Room is now confirmed. I'll prepare the game materials.",
        date: "2026-02-03T15:00:00Z",
      },
      {
        id: "m3",
        author: { name: "Bob", avatar: AVATARS.bob, discordId: "222222222" },
        content: "Can't wait! Will there be snacks?",
        date: "2026-02-10T09:00:00Z",
      },
      {
        id: "m4",
        author: { name: "Xavier", avatar: AVATARS.xavier, discordId: "849888126" },
        content: "We had 18 participants! Great session. Submitting expense for the snacks.",
        date: "2026-02-15T18:00:00Z",
        images: [
          "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800",
          "https://images.unsplash.com/photo-1523580494863-6f3031224c94?w=800",
        ],
      },
      {
        id: "m4b",
        author: { name: "Bob", avatar: AVATARS.bob, discordId: "222222222" },
        content: "What a great evening! Here's the group photo. Thanks for organising Xavier!",
        date: "2026-02-15T19:30:00Z",
        images: [
          "https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=800",
        ],
      },
    ],
    metadata: {
      attendees: 25,
      equipment: ["Projector", "Whiteboard"],
      publicEvent: true,
    },
    expenseUrl: "https://opencollective.com/commonshub-brussels/expenses/new",
  },

  // #2 — Past workshop, funded by 3 different members
  {
    id: 2,
    title: "Intro to Decentralized Governance",
    description: `A 3-hour hands-on workshop exploring different models of decentralized governance.

**Agenda:**
1. What is governance? (30 min)
2. Token-based voting systems (45 min)
3. Conviction voting & quadratic voting (45 min)
4. Break (15 min)
5. Hands-on: Design governance for a fictional commons (45 min)

Facilitated by David from DAO.brussels.`,
    type: "workshop",
    status: "completed",
    author: { name: "David", avatar: AVATARS.david, discordId: "444444444" },
    organisers: [
      { name: "David", avatar: AVATARS.david, discordId: "444444444" },
      { name: "Elena", avatar: AVATARS.elena, discordId: "555555555" },
    ],
    createdAt: "2026-01-20T09:00:00Z",
    updatedAt: "2026-02-08T17:00:00Z",
    room: "satoshi",
    date: "2026-02-08",
    startTime: "10:00",
    duration: 180,
    walletAddress: "0x2345678901abcdef2345678901abcdef23456789",
    priceTotal: 6,
    pricePaid: 6,
    token: "CHT",
    contributions: [
      {
        id: "c2a",
        author: { name: "Bob", avatar: AVATARS.bob, discordId: "222222222" },
        amount: 2,
        token: "CHT",
        txHash: "0xbbb111222333444555666777888999000aaabbbcccdddeeefff000111222333",
        date: "2026-01-22T10:00:00Z",
      },
      {
        id: "c2b",
        author: { name: "Carol", avatar: AVATARS.carol, discordId: "333333333" },
        amount: 2,
        token: "CHT",
        txHash: "0xccc111222333444555666777888999000aaabbbcccdddeeefff000111222333",
        date: "2026-01-25T16:00:00Z",
      },
      {
        id: "c2c",
        author: { name: "Frank", avatar: AVATARS.frank, discordId: "666666666" },
        amount: 2,
        token: "CHT",
        txHash: "0xddd111222333444555666777888999000aaabbbcccdddeeefff000111222333",
        date: "2026-01-28T11:00:00Z",
      },
    ],
    comments: [
      {
        id: "m5",
        author: { name: "David", avatar: AVATARS.david, discordId: "444444444" },
        content: "Elena and I would love to facilitate this workshop. We've been running similar sessions at DAO.brussels and want to bring it to the hub.",
        date: "2026-01-20T09:00:00Z",
      },
      {
        id: "m6",
        author: { name: "Bob", avatar: AVATARS.bob, discordId: "222222222" },
        content: "Great idea! I'll chip in 2 CHT to get this started.",
        date: "2026-01-22T10:05:00Z",
      },
      {
        id: "m7",
        author: { name: "Carol", avatar: AVATARS.carol, discordId: "333333333" },
        content: "Count me in for 2 CHT as well. This is exactly what we need.",
        date: "2026-01-25T16:05:00Z",
      },
      {
        id: "m8",
        author: { name: "Frank", avatar: AVATARS.frank, discordId: "666666666" },
        content: "And I'll cover the last 2 CHT. Let's make it happen! 🎉",
        date: "2026-01-28T11:05:00Z",
      },
      {
        id: "m9",
        author: { name: "David", avatar: AVATARS.david, discordId: "444444444" },
        content: "Fully funded! Thank you everyone. Room confirmed for Feb 8th. I'll share the slides a few days before.",
        date: "2026-01-28T12:00:00Z",
      },
      {
        id: "m10",
        author: { name: "Elena", avatar: AVATARS.elena, discordId: "555555555" },
        content: "Workshop went great! 12 participants, really engaging discussion during the hands-on part. Will post a write-up soon.",
        date: "2026-02-08T17:00:00Z",
        images: [
          "https://images.unsplash.com/photo-1552664730-d307ca884978?w=800",
          "https://images.unsplash.com/photo-1531545514256-b1400bc00f31?w=800",
          "https://images.unsplash.com/photo-1517048676732-d65bc937f952?w=800",
        ],
      },
    ],
    metadata: {
      attendees: 15,
      maxParticipants: 15,
      equipment: ["Projector", "Whiteboard", "Flip chart"],
      publicEvent: true,
    },
    expenseUrl: "https://opencollective.com/commonshub-brussels/expenses/new",
  },

  // #3 — Past event funded by external person using EURb
  {
    id: 3,
    title: "Brussels Impact Networking Evening",
    description: `Networking evening for the Brussels impact ecosystem.

An evening of connection and conversation for anyone working on social impact in Brussels. Light food and drinks provided.

Organised by BeImpact in partnership with Commons Hub Brussels.`,
    type: "event",
    status: "completed",
    author: { name: "Elena", avatar: AVATARS.elena, discordId: "555555555" },
    organisers: [
      { name: "Elena", avatar: AVATARS.elena, discordId: "555555555" },
    ],
    createdAt: "2026-02-10T08:00:00Z",
    updatedAt: "2026-02-25T22:00:00Z",
    room: "ostrom",
    date: "2026-02-25",
    startTime: "18:00",
    duration: 180,
    walletAddress: "0x3456789012abcdef3456789012abcdef34567890",
    priceTotal: 150,
    pricePaid: 150,
    token: "EURb",
    contributions: [
      {
        id: "c3",
        author: { name: "Elena", avatar: AVATARS.elena, discordId: "555555555" },
        amount: 150,
        token: "EURb",
        txHash: "0xeee111222333444555666777888999000aaabbbcccdddeeefff000111222333",
        date: "2026-02-12T10:00:00Z",
      },
    ],
    comments: [
      {
        id: "m11",
        author: { name: "Elena", avatar: AVATARS.elena, discordId: "555555555" },
        content: "BeImpact would like to host our quarterly networking evening at the hub. We'll pay in EURb from our organisation wallet. We need the big room with projector and microphone.",
        date: "2026-02-10T08:00:00Z",
      },
      {
        id: "m12",
        author: { name: "Xavier", avatar: AVATARS.xavier, discordId: "849888126" },
        content: "Welcome! The Ostrom Room is perfect for this. 80 capacity, has everything you need. Looking forward to it!",
        date: "2026-02-10T09:30:00Z",
      },
      {
        id: "m13",
        author: { name: "Elena", avatar: AVATARS.elena, discordId: "555555555" },
        content: "Payment sent! 150 EURb for 3 hours.",
        date: "2026-02-12T10:05:00Z",
      },
      {
        id: "m14",
        author: { name: "Elena", avatar: AVATARS.elena, discordId: "555555555" },
        content: "Amazing evening! 45 people showed up. Thank you Commons Hub for hosting us. We'll definitely be back.",
        date: "2026-02-25T22:00:00Z",
      },
      {
        id: "m15",
        author: { name: "Xavier", avatar: AVATARS.xavier, discordId: "849888126" },
        content: "Great event Elena! Loved the energy. Expense for drinks submitted to Open Collective.",
        date: "2026-02-25T22:30:00Z",
        encrypted: {
          for: ["Elena", "Xavier"],
        },
      },
    ],
    metadata: {
      attendees: 50,
      equipment: ["Projector", "Microphone"],
      catering: "Drinks",
      publicEvent: true,
    },
    expenseUrl: "https://opencollective.com/commonshub-brussels/expenses/12345",
  },

  // #4 — Future event with community discussion, pending funding
  {
    id: 4,
    title: "Regenerative Economics Reading Group — March",
    description: `Monthly reading group discussing regenerative economics.

This month we'll read and discuss **Chapter 4 of "Doughnut Economics"** by Kate Raworth: *"Get Savvy with Systems"*.

Everyone is welcome — you don't need to have read the book to participate, but it helps! We'll have a summary and key discussion questions prepared.

☕ Coffee and tea provided.`,
    type: "event",
    status: "funded",
    author: { name: "Carol", avatar: AVATARS.carol, discordId: "333333333" },
    organisers: [
      { name: "Carol", avatar: AVATARS.carol, discordId: "333333333" },
      { name: "Bob", avatar: AVATARS.bob, discordId: "222222222" },
    ],
    createdAt: "2026-02-28T14:00:00Z",
    updatedAt: "2026-03-03T09:00:00Z",
    room: "mushroom",
    date: "2026-03-20",
    startTime: "19:00",
    duration: 120,
    walletAddress: "0x4567890123abcdef4567890123abcdef45678901",
    priceTotal: 2,
    pricePaid: 2,
    token: "CHT",
    contributions: [
      {
        id: "c4",
        author: { name: "Alice", avatar: AVATARS.alice, discordId: "111111111" },
        amount: 2,
        token: "CHT",
        txHash: "0xggg111222333444555666777888999000aaabbbcccdddeeefff000111222333",
        date: "2026-03-03T09:00:00Z",
      },
    ],
    comments: [
      {
        id: "m16",
        author: { name: "Carol", avatar: AVATARS.carol, discordId: "333333333" },
        content: "Proposing the March edition of our reading group! This month we tackle systems thinking. The Mush Room is perfect — cozy and intimate.\n\nWho wants to fund this one?",
        date: "2026-02-28T14:00:00Z",
      },
      {
        id: "m17",
        author: { name: "Alice", avatar: AVATARS.alice, discordId: "111111111" },
        content: "Love this series! Can we also discuss how it connects to the token economy we're building here at the hub?",
        date: "2026-02-28T16:00:00Z",
      },
      {
        id: "m18",
        author: { name: "Bob", avatar: AVATARS.bob, discordId: "222222222" },
        content: "Happy to co-organise again. I'll prepare the discussion questions. @Carol should we do a round of the Commons Game at the end?",
        date: "2026-03-01T09:00:00Z",
      },
      {
        id: "m19",
        author: { name: "Carol", avatar: AVATARS.carol, discordId: "333333333" },
        content: "Great idea Bob! Let's plan for an extra 30 min for that. We might need to adjust the duration.",
        date: "2026-03-01T10:00:00Z",
      },
      {
        id: "m20",
        author: { name: "David", avatar: AVATARS.david, discordId: "444444444" },
        content: "I'd like to attend but I have a conflict at 19:00. Any chance of starting at 18:30?",
        date: "2026-03-02T11:00:00Z",
      },
      {
        id: "m20b",
        author: { name: "Alice", avatar: AVATARS.alice, discordId: "111111111" },
        content: "I'll fund the full room cost. Let's make this happen! 🙌",
        date: "2026-03-03T09:00:00Z",
        tokenContribution: {
          amount: 2,
          token: "CHT",
          txHash: "0xggg111222333444555666777888999000aaabbbcccdddeeefff000111222333",
        },
      },
    ],
    metadata: {
      attendees: 10,
      equipment: ["Whiteboard"],
      publicEvent: true,
    },
  },

  // #5 — Finance proposal
  {
    id: 5,
    title: "Buy a new espresso machine for the kitchen",
    description: `The current espresso machine is on its last legs. Proposing we buy a proper one.

**Options considered:**
1. **DeLonghi Magnifica** — €350, automatic, easy maintenance
2. **Sage Barista Express** — €500, semi-automatic, better coffee
3. **Jura E6** — €800, fully automatic, premium

I'd suggest option 2 — good balance of quality and price. We can submit the expense to Open Collective.

The current machine breaks down about once a week and it's costing us in repairs.`,
    type: "finance",
    status: "pending",
    author: { name: "Frank", avatar: AVATARS.frank, discordId: "666666666" },
    organisers: [
      { name: "Frank", avatar: AVATARS.frank, discordId: "666666666" },
    ],
    createdAt: "2026-03-01T11:00:00Z",
    updatedAt: "2026-03-03T09:00:00Z",
    walletAddress: "0x5678901234abcdef5678901234abcdef56789012",
    priceTotal: 0,
    pricePaid: 0,
    token: "CHT",
    contributions: [],
    comments: [
      {
        id: "m21",
        author: { name: "Alice", avatar: AVATARS.alice, discordId: "111111111" },
        content: "+1 for option 2. Good coffee is essential infrastructure 😄",
        date: "2026-03-01T12:00:00Z",
      },
      {
        id: "m22",
        author: { name: "Xavier", avatar: AVATARS.xavier, discordId: "849888126" },
        content: "Agree we need a new one. Can someone check if we can get a refurbished one? Might save some money.",
        date: "2026-03-02T10:00:00Z",
      },
      {
        id: "m23",
        author: { name: "Frank", avatar: AVATARS.frank, discordId: "666666666" },
        content: "Good idea. I found a certified refurbished Sage Barista Express for €380 on Back Market. 1-year warranty included.",
        date: "2026-03-03T09:00:00Z",
        encrypted: {
          for: ["Frank", "Xavier"],
        },
      },
    ],
    metadata: {
      amount: 380,
      category: "Equipment",
      recurring: false,
    },
  },

  // #6 — Space proposal
  {
    id: 6,
    title: "Garden renovation — spring planting",
    description: `Spring is coming! Let's get the garden ready.

**Plan:**
- Clean up winter debris
- Build 2 new raised beds (materials ~€80)
- Plant herbs and vegetables (seeds ~€30)
- Install a small compost bin (€50)

We can organise a community planting day — many hands make light work.`,
    type: "space",
    status: "confirmed",
    author: { name: "Bob", avatar: AVATARS.bob, discordId: "222222222" },
    organisers: [
      { name: "Bob", avatar: AVATARS.bob, discordId: "222222222" },
      { name: "Alice", avatar: AVATARS.alice, discordId: "111111111" },
    ],
    createdAt: "2026-02-20T10:00:00Z",
    updatedAt: "2026-03-01T14:00:00Z",
    date: "2026-03-15",
    walletAddress: "0x6789012345abcdef6789012345abcdef67890123",
    priceTotal: 0,
    pricePaid: 0,
    token: "CHT",
    contributions: [],
    comments: [
      {
        id: "m24",
        author: { name: "Alice", avatar: AVATARS.alice, discordId: "111111111" },
        content: "I can bring seeds from my garden — we have way too much basil and tomato seeds!",
        date: "2026-02-21T09:00:00Z",
      },
      {
        id: "m25",
        author: { name: "Xavier", avatar: AVATARS.xavier, discordId: "849888126" },
        content: "Love it. Let's plan the community planting day for Saturday March 15th. I'll bring tools from home.",
        date: "2026-02-22T11:00:00Z",
      },
      {
        id: "m26",
        author: { name: "Bob", avatar: AVATARS.bob, discordId: "222222222" },
        content: "Perfect. I'll submit the expense for materials to Open Collective once we buy them.",
        date: "2026-03-01T14:00:00Z",
      },
    ],
    metadata: {
      area: "Garden",
      budget: 160,
      timeline: "This month",
    },
  },

  // #7 — Booking, simple, funded
  {
    id: 7,
    title: "Team retrospective — Q1 2026",
    description: "Quarterly retro for the hub stewards team. Need the room with whiteboard and sticky notes.",
    type: "booking",
    status: "confirmed",
    author: { name: "Xavier", avatar: AVATARS.xavier, discordId: "849888126" },
    organisers: [
      { name: "Xavier", avatar: AVATARS.xavier, discordId: "849888126" },
    ],
    createdAt: "2026-03-02T08:00:00Z",
    updatedAt: "2026-03-02T08:30:00Z",
    room: "angel",
    date: "2026-03-10",
    startTime: "10:00",
    duration: 120,
    walletAddress: "0x7890123456abcdef7890123456abcdef78901234",
    priceTotal: 2,
    pricePaid: 2,
    token: "CHT",
    contributions: [
      {
        id: "c7",
        author: { name: "Xavier", avatar: AVATARS.xavier, discordId: "849888126" },
        amount: 2,
        token: "CHT",
        txHash: "0xfff111222333444555666777888999000aaabbbcccdddeeefff000111222333",
        date: "2026-03-02T08:10:00Z",
      },
    ],
    comments: [],
    metadata: {
      attendees: 6,
    },
  },

  // #8 — Other type, discussion
  {
    id: 8,
    title: "Should we open on Sundays?",
    description: `Several members have asked about Sunday access. Currently we're open Mon-Sat.

**Pros:**
- More flexibility for members
- Could attract weekend workshops
- Some members can only come on weekends

**Cons:**
- Need someone to be responsible
- Extra costs (cleaning, energy)
- Neighbors might not appreciate it

Let's discuss and find consensus.`,
    type: "other",
    status: "pending",
    author: { name: "Alice", avatar: AVATARS.alice, discordId: "111111111" },
    organisers: [
      { name: "Alice", avatar: AVATARS.alice, discordId: "111111111" },
    ],
    createdAt: "2026-03-03T10:00:00Z",
    updatedAt: "2026-03-03T14:00:00Z",
    walletAddress: "0x8901234567abcdef8901234567abcdef89012345",
    priceTotal: 0,
    pricePaid: 0,
    token: "CHT",
    contributions: [],
    comments: [
      {
        id: "m27",
        author: { name: "Frank", avatar: AVATARS.frank, discordId: "666666666" },
        content: "I'd be interested in a Sunday pilot — maybe just 2 Sundays per month to test demand?",
        date: "2026-03-03T11:00:00Z",
      },
      {
        id: "m28",
        author: { name: "David", avatar: AVATARS.david, discordId: "444444444" },
        content: "I could volunteer as Sunday steward once a month if we do this.",
        date: "2026-03-03T14:00:00Z",
      },
    ],
    metadata: {},
  },
]

export function getProposals(): Proposal[] {
  return DUMMY_PROPOSALS
}

export function getProposal(id: number): Proposal | undefined {
  return DUMMY_PROPOSALS.find((p) => p.id === id)
}
