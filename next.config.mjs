import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';

// Capture git info at build time
function getGitInfo() {
  // Prefer build-provided metadata to avoid requiring git in containers.
  try {
    if (existsSync('./git-info.json')) {
      try {
        return JSON.parse(readFileSync('./git-info.json', 'utf8'));
      } catch (e2) { /* ignore */ }
    }

    if (process.env.SOURCE_COMMIT || process.env.GIT_COMMIT_SHA || process.env.GIT_COMMIT_MESSAGE || process.env.GIT_COMMIT_DATE) {
      return {
        sha: process.env.SOURCE_COMMIT || process.env.GIT_COMMIT_SHA || 'unknown',
        message: process.env.GIT_COMMIT_MESSAGE || 'unknown',
        date: process.env.GIT_COMMIT_DATE || new Date().toISOString(),
      };
    }

    const sha = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
    const message = execSync('git log -1 --pretty=%B', { encoding: 'utf8' }).trim();
    const date = execSync('git log -1 --pretty=%ci', { encoding: 'utf8' }).trim();
    return { sha, message, date };
  } catch (e) {
    return {
      sha: 'unknown',
      message: 'unknown',
      date: new Date().toISOString(),
    };
  }
}

const gitInfo = getGitInfo();

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Proposals moved to /proposals/:id so that one day they can be about
  // something other than events. Links already shared keep working.
  async redirects() {
    return [
      { source: '/events/proposals', destination: '/proposals', permanent: true },
      { source: '/events/proposals/:slug', destination: '/proposals/:slug', permanent: true },
      {
        source: '/events/proposals/:slug/photos',
        destination: '/events/:slug/photos',
        permanent: true,
      },
    ]
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    loader: 'custom',
    loaderFile: './src/lib/image-loader.mjs',
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: '**',
      }
    ],
    formats: ['image/avif', 'image/webp'],
    unoptimized: false,
  },
  // Expose git info as build-time environment variables
  env: {
    NEXT_PUBLIC_GIT_SHA: gitInfo.sha,
    NEXT_PUBLIC_GIT_MESSAGE: gitInfo.message,
    NEXT_PUBLIC_GIT_DATE: gitInfo.date,
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
  },
}

export default nextConfig
