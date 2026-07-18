/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  // This dev machine is chronically low on free RAM; multiple parallel
  // static-generation workers intermittently fail to spawn (ENOMEM).
  // Single worker is slower but reliable. Safe to raise on a machine
  // with more headroom.
  experimental: {
    cpus: 1
  },
  // pdf-parse (via pdfjs-dist) dynamically imports a worker file at runtime
  // by relative path — webpack's bundling for API routes doesn't carry that
  // file along, so the worker import 404s at request time even though the
  // build itself succeeds. Marking it external skips bundling entirely and
  // lets Node resolve it straight from node_modules, where the worker file
  // actually exists.
  serverExternalPackages: ["pdf-parse"]
};

export default nextConfig;
