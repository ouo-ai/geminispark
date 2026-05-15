export type SeoPage = {
  slug: string
  title: string
  description: string
  primaryKeyword: string
  secondaryKeywords: string[]
  hero: {
    eyebrow: string
    headline: string
    intro: string
  }
  sections: Array<{
    heading: string
    body: string
    points: string[]
  }>
  faqs: Array<{
    question: string
    answer: string
  }>
  relatedSlugs: string[]
  cta: {
    label: string
    href: string
  }
  priority: number
}

export const seoPages: SeoPage[] = [
  {
    slug: "ai-agent",
    title: "AI Agent Workspace for Structured Tasks | Gemini Spark",
    description:
      "Use Gemini Spark as an AI agent workspace for turning goals into structured plans, roles, checks, and next actions.",
    primaryKeyword: "AI agent",
    secondaryKeywords: ["AI agent workspace", "AI task agent", "Gemini Spark agent"],
    hero: {
      eyebrow: "AI agent",
      headline: "AI agent workspace for structured task execution",
      intro:
        "Gemini Spark helps teams turn a rough goal into an agent-ready brief with role, steps, context, checks, and a clear next action.",
    },
    sections: [
      {
        heading: "What an AI agent does",
        body:
          "An AI agent is useful when a task needs more than one response. It needs a goal, constraints, source context, a plan, and a way to verify the result.",
        points: [
          "Turn broad goals into focused agent briefs.",
          "Break work into steps that can be reviewed and repeated.",
          "Keep assumptions and completion checks visible before execution.",
        ],
      },
      {
        heading: "Where Gemini Spark fits",
        body:
          "Gemini Spark focuses on the planning layer of agent work. It helps you shape what the agent should do before a task moves into execution.",
        points: [
          "Define the role and expected output for each task.",
          "Capture inputs, constraints, and quality checks in one workspace.",
          "Use the same brief structure across research, marketing, product, and operations work.",
        ],
      },
      {
        heading: "How to write better agent tasks",
        body:
          "Agent outcomes improve when the task has a narrow goal and clear stopping conditions. A good brief tells the agent what to optimize for and what not to do.",
        points: [
          "Start with the target outcome, not only the topic.",
          "Add constraints such as audience, tone, deadline, and forbidden claims.",
          "Define acceptance checks so the result can be judged objectively.",
        ],
      },
    ],
    faqs: [
      {
        question: "What is an AI agent?",
        answer:
          "An AI agent is a workflow-oriented AI setup that can plan, reason through steps, use context, and produce a task-specific result.",
      },
      {
        question: "How is Gemini Spark different from a chatbot?",
        answer:
          "Gemini Spark focuses on structuring a task brief before execution, while a chatbot often starts with a single open-ended message.",
      },
      {
        question: "What should I include in an AI agent brief?",
        answer:
          "Include the goal, role, context, constraints, steps, expected output, and acceptance checks.",
      },
    ],
    relatedSlugs: ["ai-agent-builder", "ai-agent-workflow", "ai-agent-prompt-guide"],
    cta: {
      label: "Open Gemini Spark Chat",
      href: "/gemini-spark",
    },
    priority: 0.85,
  },
  {
    slug: "ai-agent-builder",
    title: "AI Agent Builder for Task Briefs | Gemini Spark",
    description:
      "Build AI agent briefs with Gemini Spark by defining the objective, role, workflow steps, constraints, and acceptance checks.",
    primaryKeyword: "AI agent builder",
    secondaryKeywords: ["build AI agents", "AI agent brief", "task agent builder"],
    hero: {
      eyebrow: "AI agent builder",
      headline: "AI agent builder for clear task briefs",
      intro:
        "Gemini Spark helps you build reusable agent briefs that describe what the agent should do, what inputs matter, and how success should be checked.",
    },
    sections: [
      {
        heading: "Start with the job to be done",
        body:
          "An AI agent builder should begin with a concrete outcome. The more specific the job, the easier it is to choose a useful role, workflow, and output format.",
        points: [
          "Describe the target result in one sentence.",
          "Name the audience or stakeholder who will use the result.",
          "Choose the deliverable format before the task begins.",
        ],
      },
      {
        heading: "Add role and constraints",
        body:
          "Agent briefs are stronger when the role and boundaries are explicit. This prevents the agent from optimizing for the wrong audience or making unsupported claims.",
        points: [
          "Use roles such as research analyst, launch strategist, product operator, or content planner.",
          "Add constraints around tone, evidence, claims, source use, and depth.",
          "Define what the agent should avoid when completing the task.",
        ],
      },
      {
        heading: "Turn the brief into a repeatable pattern",
        body:
          "A good builder makes agent work repeatable. Save the structure, then adjust the objective and context when a similar task appears again.",
        points: [
          "Reuse the same steps for recurring work.",
          "Change only the goal, context, and acceptance checks when possible.",
          "Compare outputs against the same quality bar each time.",
        ],
      },
    ],
    faqs: [
      {
        question: "Can Gemini Spark build a complete AI agent?",
        answer:
          "Gemini Spark builds an agent-ready task brief and workflow outline. Execution depends on the agent runtime or AI tool you connect it to.",
      },
      {
        question: "What makes an agent brief reusable?",
        answer:
          "A reusable brief separates stable process steps from task-specific context, so the same structure can support similar work.",
      },
      {
        question: "Should every task become an AI agent?",
        answer:
          "No. Simple one-off questions may not need an agent. Agent briefs are more useful for multi-step work with quality checks.",
      },
    ],
    relatedSlugs: ["ai-agent", "ai-agent-workflow", "ai-agent-prompt-examples"],
    cta: {
      label: "Open Gemini Spark Chat",
      href: "/gemini-spark",
    },
    priority: 0.85,
  },
  {
    slug: "ai-agent-workflow",
    title: "AI Agent Workflow Planning Guide | Gemini Spark",
    description:
      "Plan AI agent workflows with clear inputs, steps, checks, and handoffs for research, marketing, product, and operations tasks.",
    primaryKeyword: "AI agent workflow",
    secondaryKeywords: ["agent workflow", "AI workflow planner", "agent task workflow"],
    hero: {
      eyebrow: "AI agent workflow",
      headline: "AI agent workflow planning for repeatable work",
      intro:
        "Gemini Spark helps you map a goal into a repeatable agent workflow with steps, checkpoints, and a practical completion standard.",
    },
    sections: [
      {
        heading: "Map inputs before actions",
        body:
          "An agent workflow should start by listing the inputs the task needs. Missing context creates weak outputs even when the step list looks complete.",
        points: [
          "Capture source material, business context, and constraints.",
          "Separate required inputs from optional references.",
          "State what the agent should do when context is missing.",
        ],
      },
      {
        heading: "Use checkpoints between steps",
        body:
          "Checkpoints make a workflow easier to trust. They tell the agent where to verify assumptions, reconcile evidence, and decide whether the next step is ready.",
        points: [
          "Check that the task matches the original goal.",
          "Review claims before writing final output.",
          "Confirm the final deliverable matches the requested format.",
        ],
      },
      {
        heading: "Design for handoff",
        body:
          "A useful workflow ends with a result another person can use. The output should include decisions, unresolved questions, and the next action.",
        points: [
          "Summarize what changed and why it matters.",
          "List blockers separately from completed work.",
          "Give the next operator a clear starting point.",
        ],
      },
    ],
    faqs: [
      {
        question: "What is an AI agent workflow?",
        answer:
          "An AI agent workflow is a structured sequence of steps, checks, and outputs that guides an agent through a multi-step task.",
      },
      {
        question: "How many steps should an agent workflow include?",
        answer:
          "Use enough steps to make the work clear, but avoid unnecessary detail. Three to seven steps is often enough for a focused task.",
      },
      {
        question: "Can one workflow support multiple teams?",
        answer:
          "Yes, if the workflow keeps shared steps stable and lets each team change context, tone, and acceptance checks.",
      },
    ],
    relatedSlugs: ["ai-agent-builder", "ai-agent-prompt-guide", "ai-agent-for-product-teams"],
    cta: {
      label: "Open Gemini Spark Chat",
      href: "/gemini-spark",
    },
    priority: 0.85,
  },
  {
    slug: "ai-agent-for-marketing",
    title: "AI Agent for Marketing Planning | Gemini Spark",
    description:
      "Use Gemini Spark to structure AI agent briefs for campaign planning, audience research, launch copy, and marketing operations.",
    primaryKeyword: "AI agent for marketing",
    secondaryKeywords: ["marketing AI agent", "campaign planning agent", "AI agent for marketers"],
    hero: {
      eyebrow: "Marketing agent",
      headline: "AI agent for marketing planning and campaign work",
      intro:
        "Gemini Spark helps marketers turn campaign goals into agent-ready tasks for audience research, positioning, briefs, and launch planning.",
    },
    sections: [
      {
        heading: "Turn campaign goals into agent tasks",
        body:
          "Marketing work often mixes audience, offer, channel, and messaging decisions. An agent brief helps keep those decisions structured.",
        points: [
          "Define the target audience and campaign objective.",
          "List product facts and claims that are approved for use.",
          "Ask for output in a useful format such as a brief, matrix, or checklist.",
        ],
      },
      {
        heading: "Use agents for research and synthesis",
        body:
          "Marketing agents are useful for organizing research inputs, comparing angles, and turning scattered notes into a usable campaign direction.",
        points: [
          "Cluster customer pain points into messaging themes.",
          "Summarize competitor positioning without copying it.",
          "Turn launch notes into channel-specific next steps.",
        ],
      },
      {
        heading: "Keep review gates visible",
        body:
          "Marketing output often needs claim review. The brief should tell the agent to mark assumptions and separate evidence-backed points from suggestions.",
        points: [
          "Separate facts, assumptions, and recommendations.",
          "Avoid unsupported performance claims.",
          "Keep final copy review with the human owner.",
        ],
      },
    ],
    faqs: [
      {
        question: "How can marketers use an AI agent?",
        answer:
          "Marketers can use an AI agent to structure research, campaign briefs, positioning options, content plans, and launch checklists.",
      },
      {
        question: "Should an AI agent write final marketing claims?",
        answer:
          "It can draft options, but final claims should be reviewed against approved product facts and legal requirements.",
      },
      {
        question: "What should a marketing agent brief include?",
        answer:
          "Include audience, offer, product facts, channel, tone, constraints, and the expected deliverable.",
      },
    ],
    relatedSlugs: ["ai-agent-prompt-guide", "ai-agent-prompt-examples", "ai-agent-workflow"],
    cta: {
      label: "Open Gemini Spark Chat",
      href: "/gemini-spark",
    },
    priority: 0.75,
  },
  {
    slug: "ai-agent-for-product-teams",
    title: "AI Agent for Product Teams | Gemini Spark",
    description:
      "Plan AI agent tasks for product research, feature briefs, release planning, feedback synthesis, and product operations.",
    primaryKeyword: "AI agent for product teams",
    secondaryKeywords: ["product AI agent", "AI agent for product managers", "product operations agent"],
    hero: {
      eyebrow: "Product agent",
      headline: "AI agent for product teams and operating work",
      intro:
        "Gemini Spark helps product teams structure agent tasks for research synthesis, feature framing, release planning, and decision support.",
    },
    sections: [
      {
        heading: "Clarify the product decision",
        body:
          "Product agent tasks should start with the decision or deliverable the team needs. This keeps the agent from producing broad notes without a clear use.",
        points: [
          "State the product question being answered.",
          "Name the stakeholder who will use the result.",
          "Ask for tradeoffs, risks, and recommended next actions.",
        ],
      },
      {
        heading: "Structure feedback synthesis",
        body:
          "Agents can help organize customer notes, tickets, and research summaries when the brief defines categories and quality checks.",
        points: [
          "Group feedback by theme, impact, and frequency.",
          "Separate direct evidence from interpretation.",
          "Surface unanswered questions for follow-up.",
        ],
      },
      {
        heading: "Support release planning",
        body:
          "Product teams can use agent briefs to prepare launch checklists, release notes, risk reviews, and handoff documents.",
        points: [
          "Turn feature notes into launch tasks.",
          "Create stakeholder-specific summaries.",
          "Check that the output matches the release stage.",
        ],
      },
    ],
    faqs: [
      {
        question: "Can product teams use Gemini Spark for research synthesis?",
        answer:
          "Yes. Gemini Spark can structure the brief for an agent that synthesizes notes, feedback, and product context.",
      },
      {
        question: "What product tasks are a good fit for AI agents?",
        answer:
          "Research summaries, feature briefs, release planning, feedback clustering, and decision support are common fits.",
      },
      {
        question: "How do I keep product agent output useful?",
        answer:
          "Define the product question, input sources, expected format, and acceptance checks before the agent starts.",
      },
    ],
    relatedSlugs: ["ai-agent-workflow", "ai-agent-for-research", "ai-agent-prompt-guide"],
    cta: {
      label: "Open Gemini Spark Chat",
      href: "/gemini-spark",
    },
    priority: 0.75,
  },
  {
    slug: "ai-agent-for-research",
    title: "AI Agent for Research Tasks | Gemini Spark",
    description:
      "Use Gemini Spark to plan AI agent research tasks with questions, sources, synthesis steps, caveats, and final output checks.",
    primaryKeyword: "AI agent for research",
    secondaryKeywords: ["research AI agent", "AI research workflow", "research task agent"],
    hero: {
      eyebrow: "Research agent",
      headline: "AI agent for research tasks and synthesis",
      intro:
        "Gemini Spark helps turn a research question into an agent-ready plan with source needs, synthesis steps, caveats, and output checks.",
    },
    sections: [
      {
        heading: "Start with the research question",
        body:
          "Research agents need a precise question. A broad topic can create shallow summaries, while a focused question gives the workflow a clear direction.",
        points: [
          "Write the decision the research should support.",
          "List the types of sources or notes available.",
          "Ask the agent to separate findings from assumptions.",
        ],
      },
      {
        heading: "Use synthesis checkpoints",
        body:
          "A research workflow should include checkpoints for evidence quality, contradictory findings, and missing context.",
        points: [
          "Mark source strength and uncertainty.",
          "Group findings into themes before writing the conclusion.",
          "List open questions that need more evidence.",
        ],
      },
      {
        heading: "Make the final output usable",
        body:
          "The research result should not just summarize. It should explain implications, risks, and recommended next steps for the audience.",
        points: [
          "Use tables for comparisons and evidence maps.",
          "End with decisions, caveats, and next actions.",
          "Keep citations or source references attached when available.",
        ],
      },
    ],
    faqs: [
      {
        question: "What makes a good research agent task?",
        answer:
          "A good task includes a focused question, source expectations, synthesis steps, caveats, and a clear final output format.",
      },
      {
        question: "Can an AI agent replace human research judgment?",
        answer:
          "No. It can organize and synthesize information, but humans should review evidence quality and final decisions.",
      },
      {
        question: "How should an agent handle missing sources?",
        answer:
          "The brief should tell the agent to flag missing context and avoid filling gaps with unsupported claims.",
      },
    ],
    relatedSlugs: ["ai-agent-workflow", "ai-agent-for-product-teams", "ai-agent-prompt-examples"],
    cta: {
      label: "Open Gemini Spark Chat",
      href: "/gemini-spark",
    },
    priority: 0.75,
  },
  {
    slug: "ai-agent-prompt-guide",
    title: "AI Agent Prompt Guide for Better Task Briefs | Gemini Spark",
    description:
      "Use this AI agent prompt guide to write better briefs with goals, roles, context, steps, constraints, outputs, and checks.",
    primaryKeyword: "AI agent prompt guide",
    secondaryKeywords: ["AI agent prompt", "agent prompt framework", "AI task prompt guide"],
    hero: {
      eyebrow: "Prompt guide",
      headline: "AI agent prompt guide for better task briefs",
      intro:
        "Gemini Spark helps you write agent prompts that define the goal, role, context, steps, constraints, output, and success checks.",
    },
    sections: [
      {
        heading: "Use a complete agent prompt structure",
        body:
          "A strong AI agent prompt tells the agent what success looks like and what process to follow. It should be more specific than a general chat request.",
        points: [
          "Goal: what the task should accomplish.",
          "Role: what perspective the agent should use.",
          "Output: what format the final result should take.",
        ],
      },
      {
        heading: "Add context and constraints",
        body:
          "Context keeps the agent grounded. Constraints keep it from producing work that is too broad, too risky, or hard to use.",
        points: [
          "Add audience, source material, tone, deadline, and non-goals.",
          "Call out facts that must be preserved.",
          "Tell the agent how to handle missing information.",
        ],
      },
      {
        heading: "Define checks before execution",
        body:
          "Acceptance checks make the final output easier to judge. They also help the agent self-review before handing back the result.",
        points: [
          "Check whether the result answers the original goal.",
          "Check whether assumptions are labeled clearly.",
          "Check whether the final format matches the request.",
        ],
      },
    ],
    faqs: [
      {
        question: "What should an AI agent prompt include?",
        answer:
          "Include goal, role, context, constraints, steps, expected output, and acceptance checks.",
      },
      {
        question: "How is an agent prompt different from a normal prompt?",
        answer:
          "An agent prompt usually defines a workflow and quality checks, not just a single answer request.",
      },
      {
        question: "Can Gemini Spark help draft agent prompts?",
        answer:
          "Yes. Gemini Spark can turn a rough objective into a structured agent brief that you can adapt for your AI tool.",
      },
    ],
    relatedSlugs: ["ai-agent-prompt-examples", "ai-agent-builder", "ai-agent-workflow"],
    cta: {
      label: "Open Gemini Spark Chat",
      href: "/gemini-spark",
    },
    priority: 0.75,
  },
  {
    slug: "ai-agent-prompt-examples",
    title: "AI Agent Prompt Examples for Teams | Gemini Spark",
    description:
      "Use these AI agent prompt examples for marketing, research, product planning, operations, and reusable task workflows.",
    primaryKeyword: "AI agent prompt examples",
    secondaryKeywords: ["agent prompt examples", "AI task prompt examples", "AI workflow prompts"],
    hero: {
      eyebrow: "Prompt examples",
      headline: "AI agent prompt examples for practical team tasks",
      intro:
        "Use these examples as starting points for Gemini Spark. Each prompt defines a goal, role, workflow, output, and review criteria.",
    },
    sections: [
      {
        heading: "Marketing agent prompt",
        body:
          "Use this structure when the task needs audience thinking, messaging options, and a campaign-ready output.",
        points: [
          "Act as a launch strategist. Turn the product notes into three campaign angles for [audience]. Include target pain point, promise, proof needed, channel fit, and risks.",
          "Act as a content planner. Build a two-week content plan from this offer. Include audience intent, post goal, angle, CTA, and review notes.",
          "Act as a positioning analyst. Compare these customer pain points and recommend a messaging hierarchy with assumptions labeled clearly.",
        ],
      },
      {
        heading: "Research agent prompt",
        body:
          "Use this structure when the agent needs to organize evidence, synthesize findings, and call out uncertainty.",
        points: [
          "Act as a research analyst. Synthesize these notes into findings, caveats, open questions, and recommended next steps for [decision].",
          "Act as a market researcher. Group these competitor observations into themes and identify what evidence is strong, weak, or missing.",
          "Act as an evidence reviewer. Check this draft for unsupported claims, missing context, and places where the conclusion is too broad.",
        ],
      },
      {
        heading: "Product agent prompt",
        body:
          "Use this structure when the task needs decisions, tradeoffs, and implementation-ready output for a product team.",
        points: [
          "Act as a product operator. Turn this feature idea into a brief with user problem, scope, risks, launch tasks, and acceptance checks.",
          "Act as a feedback analyst. Cluster these customer notes by theme, impact, frequency, and suggested next action.",
          "Act as a release planner. Create a launch checklist for this feature with owner roles, dependencies, risks, and review gates.",
        ],
      },
    ],
    faqs: [
      {
        question: "Can I copy these AI agent prompt examples directly?",
        answer:
          "Yes. Treat them as starting points, then replace the audience, context, output format, and checks with your task details.",
      },
      {
        question: "Why do these examples include roles?",
        answer:
          "Roles help the agent use the right perspective and produce output that fits the task.",
      },
      {
        question: "Should every prompt include acceptance checks?",
        answer:
          "For multi-step work, yes. Acceptance checks make the result easier to review and improve.",
      },
    ],
    relatedSlugs: ["ai-agent-prompt-guide", "ai-agent-for-marketing", "ai-agent-for-research"],
    cta: {
      label: "Open Gemini Spark Chat",
      href: "/gemini-spark",
    },
    priority: 0.75,
  },
]

export const seoPageSlugs = seoPages.map((page) => page.slug)

export function getSeoPage(slug: string) {
  return seoPages.find((page) => page.slug === slug)
}

export function getRelatedSeoPages(page: SeoPage) {
  return page.relatedSlugs
    .map((slug) => getSeoPage(slug))
    .filter((relatedPage): relatedPage is SeoPage => Boolean(relatedPage))
}

export function getCoreSeoPages() {
  return seoPages.filter((page) =>
    ["ai-agent", "ai-agent-builder", "ai-agent-workflow", "ai-agent-prompt-guide"].includes(page.slug),
  )
}
