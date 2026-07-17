import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  devIndicators: false // Casts the nested object to clear the type check
};

export default nextConfig;


// /** @type {import('next').NextConfig} */
// const nextConfig = {
//   // ... your existing config parameters
//   devIndicators: {
//     appIsrStatus: false,
//     buildActivity: false,
//   },
// };

// module.exports = nextConfig;