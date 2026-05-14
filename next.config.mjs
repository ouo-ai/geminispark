/** @type {import('next').NextConfig} */
import { dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))

const nextConfig = {
  images: {
    unoptimized: true,
  },
  turbopack: {
    root: __dirname,
  },
  async redirects() {
    return [
      {
        source: "/ai-video-generator",
        destination: "/ai-agent",
        permanent: true,
      },
      {
        source: "/text-to-video-ai",
        destination: "/ai-agent-builder",
        permanent: true,
      },
      {
        source: "/image-to-video-ai",
        destination: "/ai-agent-workflow",
        permanent: true,
      },
      {
        source: "/ai-video-generator-for-marketing",
        destination: "/ai-agent-for-marketing",
        permanent: true,
      },
      {
        source: "/ai-product-video-generator",
        destination: "/ai-agent-for-product-teams",
        permanent: true,
      },
      {
        source: "/ai-video-generator-for-social-media",
        destination: "/ai-agent-for-marketing",
        permanent: true,
      },
      {
        source: "/ai-video-prompt-guide",
        destination: "/ai-agent-prompt-guide",
        permanent: true,
      },
      {
        source: "/ai-video-prompt-examples",
        destination: "/ai-agent-prompt-examples",
        permanent: true,
      },
    ]
  },
}

export default nextConfig
