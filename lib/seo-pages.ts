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
    slug: "ai-video-generator",
    title: "AI Video Generator for Short Creative Clips | Gemini Spark",
    description:
      "Use Gemini Spark as an AI video generator for short prompt-based clips, product ideas, social concepts, and reference-image video tasks.",
    primaryKeyword: "AI video generator",
    secondaryKeywords: ["prompt to video", "AI video creation", "short AI video generator"],
    hero: {
      eyebrow: "AI video generator",
      headline: "AI video generator for short creative clips",
      intro:
        "Gemini Spark helps creators turn a clear prompt, and optionally one public reference image, into a trackable AI video generation task.",
    },
    sections: [
      {
        heading: "What an AI video generator does",
        body:
          "An AI video generator turns written direction into a short motion result. A useful prompt usually names the subject, camera movement, setting, lighting, mood, and output format before the task starts.",
        points: [
          "Use text prompts for new scenes, concepts, and campaign ideas.",
          "Use a public reference image when framing or visual direction matters.",
          "Track generation status so the workflow does not disappear after submission.",
        ],
      },
      {
        heading: "Where Gemini Spark fits",
        body:
          "Gemini Spark is built for focused short-form generation workflows rather than long timeline editing. It keeps the prompt, aspect ratio, duration, task ID, and result preview in one place.",
        points: [
          "Create landscape concepts for product pages and demos.",
          "Create portrait concepts for shorts, reels, and ad tests.",
          "Keep supplier credentials server-side while the browser uses Gemini Spark routes.",
        ],
      },
      {
        heading: "How to get cleaner results",
        body:
          "AI video quality depends heavily on prompt clarity. Treat each clip like a compact shot brief and avoid asking one short generation to cover too many story beats.",
        points: [
          "Start with one scene and one main subject.",
          "Add camera language such as dolly, close-up, wide shot, or slow pan.",
          "Specify motion only when it matters to the viewer.",
        ],
      },
    ],
    faqs: [
      {
        question: "Can an AI video generator create a complete long video?",
        answer:
          "Gemini Spark focuses on short generation tasks. Longer videos usually need several generated clips edited together after generation.",
      },
      {
        question: "Does Gemini Spark support image-to-video?",
        answer:
          "Yes. You can paste a public image URL to guide an image-to-video task, or leave it blank for text-to-video.",
      },
      {
        question: "What should I include in an AI video prompt?",
        answer:
          "Include subject, action, setting, camera movement, visual style, mood, and the aspect ratio you need.",
      },
    ],
    relatedSlugs: ["text-to-video-ai", "image-to-video-ai", "ai-video-prompt-guide"],
    cta: {
      label: "Start an AI video task",
      href: "/#generator",
    },
    priority: 0.85,
  },
  {
    slug: "text-to-video-ai",
    title: "Text to Video AI Generator Workflow | Gemini Spark",
    description:
      "Learn how to write text to video AI prompts that produce clearer short clips with subject, motion, camera, and style direction.",
    primaryKeyword: "text to video AI",
    secondaryKeywords: ["text to video generator", "prompt to video AI", "AI video prompt"],
    hero: {
      eyebrow: "Text to video AI",
      headline: "Text to video AI starts with a strong shot brief",
      intro:
        "Gemini Spark turns a written prompt into a video task, so the prompt needs enough visual direction to guide the generated clip.",
    },
    sections: [
      {
        heading: "Write the prompt like a shot",
        body:
          "The strongest text to video AI prompts describe one scene at a time. Instead of writing a broad story, define what the viewer should see during the clip.",
        points: [
          "Name the main subject and what it is doing.",
          "Describe the environment and lighting.",
          "Choose a camera movement that supports the moment.",
        ],
      },
      {
        heading: "Choose the right format",
        body:
          "Landscape and portrait prompts can use the same idea, but the composition should change. Portrait clips need a centered subject and less horizontal action.",
        points: [
          "Use 16:9 for landing pages, demos, and presentation visuals.",
          "Use 9:16 for social clips and mobile-first concepts.",
          "Keep important action inside the safe center area.",
        ],
      },
      {
        heading: "Avoid overloading a short clip",
        body:
          "Short AI video generations work better when each task has a single job. If the idea has multiple beats, split it into several prompts and edit the clips together later.",
        points: [
          "One prompt should usually describe one scene.",
          "Avoid asking for dense text inside the video.",
          "Use repeatable prompt structure for multiple variations.",
        ],
      },
    ],
    faqs: [
      {
        question: "What is text to video AI?",
        answer:
          "Text to video AI creates a video task from a written prompt that describes the scene, movement, and style.",
      },
      {
        question: "How long should a text to video prompt be?",
        answer:
          "A useful prompt is often one compact paragraph with subject, action, setting, camera, and style details.",
      },
      {
        question: "Can Gemini Spark generate text-to-video without an image?",
        answer:
          "Yes. Leave the reference image field blank and submit a text prompt to start a text-to-video task.",
      },
    ],
    relatedSlugs: ["ai-video-generator", "ai-video-prompt-guide", "ai-video-prompt-examples"],
    cta: {
      label: "Write a text-to-video prompt",
      href: "/#generator",
    },
    priority: 0.85,
  },
  {
    slug: "image-to-video-ai",
    title: "Image to Video AI Generator Workflow | Gemini Spark",
    description:
      "Use image to video AI with Gemini Spark by pairing a public reference image URL with a clear motion and camera prompt.",
    primaryKeyword: "image to video AI",
    secondaryKeywords: ["image to video generator", "animate image with AI", "reference image video"],
    hero: {
      eyebrow: "Image to video AI",
      headline: "Image to video AI for guided motion concepts",
      intro:
        "Gemini Spark can use a public reference image URL to guide a video task while your prompt controls motion, camera, and mood.",
    },
    sections: [
      {
        heading: "Use the image for visual direction",
        body:
          "A reference image gives the generation task a visual starting point. The prompt should still explain what should move and how the camera should behave.",
        points: [
          "Use public image URLs that can be fetched by the server.",
          "Describe the motion you want the still image to imply.",
          "Keep the image and prompt aligned around one subject.",
        ],
      },
      {
        heading: "Prompt motion carefully",
        body:
          "Image-to-video is clearer when motion is specific. Instead of asking for everything to animate, name the subject movement, camera movement, and background behavior.",
        points: [
          "Use phrases like slow push-in, gentle rotation, or subtle product reveal.",
          "Avoid complex multi-character action in a short clip.",
          "State whether the look should be cinematic, clean, playful, or realistic.",
        ],
      },
      {
        heading: "Use it for concept testing",
        body:
          "A reference image is helpful when you already have product art, a mockup, an illustration, or a scene frame and want to test motion before production.",
        points: [
          "Turn product mockups into launch teaser concepts.",
          "Animate campaign visuals for social tests.",
          "Explore camera movement around one still composition.",
        ],
      },
    ],
    faqs: [
      {
        question: "What image URLs work with Gemini Spark?",
        answer:
          "Use a public HTTP or HTTPS image URL. Private files, local files, and gated URLs may not be reachable by the server.",
      },
      {
        question: "Is image-to-video better than text-to-video?",
        answer:
          "It depends on the goal. Image-to-video is useful when visual direction matters; text-to-video is better for open-ended scene creation.",
      },
      {
        question: "Can I use image-to-video for product concepts?",
        answer:
          "Yes. Product mockups and campaign images are good candidates when paired with a clear motion prompt.",
      },
    ],
    relatedSlugs: ["ai-video-generator", "ai-product-video-generator", "ai-video-prompt-examples"],
    cta: {
      label: "Try image-to-video",
      href: "/#generator",
    },
    priority: 0.85,
  },
  {
    slug: "ai-video-generator-for-marketing",
    title: "AI Video Generator for Marketing Concepts | Gemini Spark",
    description:
      "Plan short marketing video concepts with Gemini Spark for campaign tests, offer visuals, product launches, and social creative.",
    primaryKeyword: "AI video generator for marketing",
    secondaryKeywords: ["AI marketing video generator", "AI video ads", "campaign video ideas"],
    hero: {
      eyebrow: "Marketing videos",
      headline: "AI video generator for marketing concept tests",
      intro:
        "Gemini Spark helps marketing teams turn campaign ideas into short video tasks for launches, offers, and creative exploration.",
    },
    sections: [
      {
        heading: "Use AI video for fast creative exploration",
        body:
          "Marketing teams often need to test angles before production. Short AI video tasks can help visualize positioning, mood, and creative direction quickly.",
        points: [
          "Draft product reveals for landing pages.",
          "Explore offer visuals for social campaigns.",
          "Create concept clips before committing to production.",
        ],
      },
      {
        heading: "Match the clip to the campaign job",
        body:
          "A marketing video prompt should match a specific job: explain the product, dramatize a pain point, show a transformation, or create a teaser.",
        points: [
          "Use product reveal prompts for launch pages.",
          "Use before-and-after prompts for transformation stories.",
          "Use vertical concepts for mobile social channels.",
        ],
      },
      {
        heading: "Keep claims out of the generated clip",
        body:
          "For early concepts, focus on visual storytelling and avoid hard performance claims in the prompt. Add regulated claims and exact copy in editing after review.",
        points: [
          "Avoid asking the model to render detailed ad text.",
          "Use visuals to set the mood and story.",
          "Review all final marketing assets before publishing.",
        ],
      },
    ],
    faqs: [
      {
        question: "Can AI video help with marketing before a campaign is final?",
        answer:
          "Yes. Short video tasks are useful for testing creative direction, scene ideas, and visual style before production.",
      },
      {
        question: "Should I include ad copy in the video prompt?",
        answer:
          "Keep exact ad copy outside the generated clip when possible. Add text overlays in editing for better control.",
      },
      {
        question: "What format works for marketing clips?",
        answer:
          "Use 16:9 for websites and decks, and 9:16 for mobile-first social concepts.",
      },
    ],
    relatedSlugs: ["ai-product-video-generator", "ai-video-generator-for-social-media", "ai-video-prompt-guide"],
    cta: {
      label: "Create a marketing clip",
      href: "/#generator",
    },
    priority: 0.75,
  },
  {
    slug: "ai-product-video-generator",
    title: "AI Product Video Generator for Launch Concepts | Gemini Spark",
    description:
      "Create short AI product video concepts for launches, demos, feature reveals, and SaaS storytelling with Gemini Spark.",
    primaryKeyword: "AI product video generator",
    secondaryKeywords: ["product video AI", "AI product reveal", "SaaS product video generator"],
    hero: {
      eyebrow: "Product videos",
      headline: "AI product video generator for launch concepts",
      intro:
        "Gemini Spark helps product teams turn feature ideas, mockups, and launch scenes into short video generation tasks.",
    },
    sections: [
      {
        heading: "Start with one product moment",
        body:
          "Product video prompts are clearer when they focus on one moment: a reveal, a workflow, a transformation, or a feature highlight.",
        points: [
          "Show the product appearing in context.",
          "Use clean motion around a dashboard, device, or object.",
          "Keep the scene simple enough for a short clip.",
        ],
      },
      {
        heading: "Use reference images for product direction",
        body:
          "If you have a mockup, product image, or launch visual, use a public image URL to guide the generation task and describe the movement you want.",
        points: [
          "A mockup can guide composition and palette.",
          "The prompt controls camera and motion.",
          "Generated clips can support product storyboarding.",
        ],
      },
      {
        heading: "Plan for editing after generation",
        body:
          "Generated product clips are most useful as source material. Final product names, interface details, and legal claims should be added in a controlled editing step.",
        points: [
          "Use AI video for mood, motion, and concept speed.",
          "Add exact UI text later when precision matters.",
          "Save task IDs for tracking iterations.",
        ],
      },
    ],
    faqs: [
      {
        question: "Can Gemini Spark create SaaS product video concepts?",
        answer:
          "Yes. It can generate short product concept tasks from prompts or public reference images.",
      },
      {
        question: "Should I ask for exact UI text in the video?",
        answer:
          "No. Exact UI text is better added after generation so it stays accurate and readable.",
      },
      {
        question: "What product video prompt works well?",
        answer:
          "Describe the product, the reveal moment, camera movement, lighting, and the intended format.",
      },
    ],
    relatedSlugs: ["ai-video-generator-for-marketing", "image-to-video-ai", "ai-video-prompt-examples"],
    cta: {
      label: "Generate a product concept",
      href: "/#generator",
    },
    priority: 0.75,
  },
  {
    slug: "ai-video-generator-for-social-media",
    title: "AI Video Generator for Social Media Clips | Gemini Spark",
    description:
      "Use Gemini Spark to create short AI video concepts for social media formats, launch teasers, reels, shorts, and campaign tests.",
    primaryKeyword: "AI video generator for social media",
    secondaryKeywords: ["AI video for reels", "AI video for shorts", "social media video generator"],
    hero: {
      eyebrow: "Social media videos",
      headline: "AI video generator for social media concepts",
      intro:
        "Gemini Spark supports short portrait and landscape video tasks for social creative, campaign tests, and quick visual exploration.",
    },
    sections: [
      {
        heading: "Design for mobile attention",
        body:
          "Social media clips need a clear subject, immediate visual movement, and simple composition. A short prompt should make the first scene obvious.",
        points: [
          "Use 9:16 for mobile-first creative concepts.",
          "Keep one main subject in the center of the frame.",
          "Use motion that reads quickly without sound.",
        ],
      },
      {
        heading: "Create variations from one idea",
        body:
          "The same campaign idea can become several AI video prompts by changing camera movement, mood, or setting while keeping the core message consistent.",
        points: [
          "Test product reveal, transformation, and teaser angles.",
          "Change lighting or setting between variations.",
          "Track task IDs so you can compare results.",
        ],
      },
      {
        heading: "Keep platform-specific finishing separate",
        body:
          "Generate the core motion first, then add captions, subtitles, safe-area text, audio, and platform-specific overlays in an editor.",
        points: [
          "Avoid relying on generated text for final captions.",
          "Use generated clips as visual source material.",
          "Edit final exports for each channel requirement.",
        ],
      },
    ],
    faqs: [
      {
        question: "Can Gemini Spark create vertical social media video concepts?",
        answer:
          "Yes. Choose 9:16 when you want a portrait-oriented video task for mobile-first creative.",
      },
      {
        question: "Should generated social videos include captions?",
        answer:
          "Captions are usually better added after generation so they remain readable and editable.",
      },
      {
        question: "What social media prompts work well?",
        answer:
          "Use one strong scene, a clear subject, fast visual context, and a simple camera movement.",
      },
    ],
    relatedSlugs: ["ai-video-generator-for-marketing", "text-to-video-ai", "ai-video-prompt-examples"],
    cta: {
      label: "Create a social clip",
      href: "/#generator",
    },
    priority: 0.75,
  },
  {
    slug: "ai-video-prompt-guide",
    title: "AI Video Prompt Guide for Better Short Clips | Gemini Spark",
    description:
      "A practical AI video prompt guide for writing clearer short-form video prompts with subject, motion, camera, style, and format.",
    primaryKeyword: "AI video prompt guide",
    secondaryKeywords: ["AI video prompting", "video generation prompt guide", "prompt to video guide"],
    hero: {
      eyebrow: "Prompt guide",
      headline: "AI video prompt guide for better short clips",
      intro:
        "Better AI video prompts read like concise shot briefs. Use this guide to structure subject, motion, camera, and style before submitting a task.",
    },
    sections: [
      {
        heading: "Use a repeatable prompt structure",
        body:
          "A repeatable structure makes prompt quality easier to improve. Start with the subject, add action, then define setting, camera, and style.",
        points: [
          "Subject: what the viewer sees first.",
          "Action: what changes during the clip.",
          "Camera and style: how the scene should feel.",
        ],
      },
      {
        heading: "Make motion explicit",
        body:
          "AI video prompts need motion direction. If the prompt only describes a still image, the generated motion may feel random or weak.",
        points: [
          "Describe subject movement and camera movement separately.",
          "Use subtle motion for product and interface concepts.",
          "Use stronger action only when it supports the scene.",
        ],
      },
      {
        heading: "Control complexity",
        body:
          "Short clips should not carry a full script. If you need a multi-scene story, break it into several prompts and keep each task focused.",
        points: [
          "Use one scene per generation task.",
          "Avoid many characters, locations, or camera changes.",
          "Iterate by changing one variable at a time.",
        ],
      },
    ],
    faqs: [
      {
        question: "What is a good AI video prompt structure?",
        answer:
          "Use subject, action, setting, camera movement, lighting, style, and output format in one concise paragraph.",
      },
      {
        question: "How do I improve weak AI video results?",
        answer:
          "Make the motion clearer, reduce scene complexity, and specify the camera behavior more directly.",
      },
      {
        question: "Can I reuse the same prompt format?",
        answer:
          "Yes. A repeatable prompt format helps compare variations and improve results over time.",
      },
    ],
    relatedSlugs: ["ai-video-prompt-examples", "text-to-video-ai", "ai-video-generator"],
    cta: {
      label: "Use the prompt guide",
      href: "/#generator",
    },
    priority: 0.75,
  },
  {
    slug: "ai-video-prompt-examples",
    title: "AI Video Prompt Examples for Product and Social Clips | Gemini Spark",
    description:
      "Use these AI video prompt examples to create product reveals, social clips, image-to-video concepts, and short cinematic generation tasks.",
    primaryKeyword: "AI video prompt examples",
    secondaryKeywords: ["text to video prompt examples", "image to video prompt examples", "AI video prompts"],
    hero: {
      eyebrow: "Prompt examples",
      headline: "AI video prompt examples for short creative tasks",
      intro:
        "Use these examples as starting points for Gemini Spark. Each prompt keeps one scene, one main subject, and one clear motion idea.",
    },
    sections: [
      {
        heading: "Product reveal prompt",
        body:
          "A strong product reveal prompt focuses on one visual transformation and gives the camera a clear path.",
        points: [
          "A matte black device on a clean studio surface lights up as a warm AI spark circles it, slow push-in camera, soft reflections, premium product launch mood, 16:9.",
          "A SaaS dashboard appears from a rough wireframe sketch, clean UI panels forming with golden light trails, smooth dolly movement, dark studio background, polished launch video style.",
          "A small product box opens and releases cyan and gold particles that become a short demo scene, close-up camera, cinematic lighting, minimal background.",
        ],
      },
      {
        heading: "Social clip prompt",
        body:
          "Social video prompts should be simple, vertical, and easy to understand without audio.",
        points: [
          "A creator holds a phone as a rough idea transforms into a polished video preview on screen, fast clean motion, bright studio, vertical 9:16 framing.",
          "A messy campaign board reorganizes itself into three glowing video concepts, quick cuts, energetic motion, warm and cyan accents, portrait social teaser.",
          "A product mockup floats above a desk while light trails sketch camera movement around it, concise mobile ad style, centered subject, 9:16.",
        ],
      },
      {
        heading: "Image-to-video prompt",
        body:
          "When using a reference image, the prompt should explain what motion should happen to the still frame.",
        points: [
          "Animate this product image with a subtle slow push-in, soft studio light sweep, and tiny spark particles around the edges, premium launch mood.",
          "Turn this static campaign visual into a gentle reveal with parallax depth, moving background glow, and a clean cinematic camera drift.",
          "Use this mockup as the main frame and add smooth motion that makes the interface feel alive without changing the core layout.",
        ],
      },
    ],
    faqs: [
      {
        question: "Can I copy these AI video prompt examples directly?",
        answer:
          "Yes. Treat them as starting points, then replace the subject, style, and format with your own project details.",
      },
      {
        question: "Why do these prompts avoid complex stories?",
        answer:
          "Short generation tasks usually work better with one scene and one clear visual idea.",
      },
      {
        question: "Should I include aspect ratio in prompt examples?",
        answer:
          "It helps to mention the intended format and also select the matching aspect ratio in the interface.",
      },
    ],
    relatedSlugs: ["ai-video-prompt-guide", "text-to-video-ai", "image-to-video-ai"],
    cta: {
      label: "Try an example prompt",
      href: "/#generator",
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
    ["ai-video-generator", "text-to-video-ai", "image-to-video-ai", "ai-video-prompt-guide"].includes(page.slug),
  )
}
