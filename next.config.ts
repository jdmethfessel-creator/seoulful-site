import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // URL-prefix dupe lookup: if a user pastes a full URL after the
      // domain (e.g. kdupe.co/https://www.sephora.com/product/foo), the
      // path arrives at the server with "https:" as its own segment.
      // Strip the leading scheme so the catch-all sees the host as
      // segment 0 ([www.sephora.com, product, foo]).
      {
        source: "/:protocol(https?:)/:rest*",
        destination: "/:rest*",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
