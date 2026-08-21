import nextConfig from "eslint-config-next/core-web-vitals";

const eslintConfig = [
  ...nextConfig,
  {
    rules: {
      // Data-fetching effects update React state from async callbacks and all
      // of them own a finally/error path. The React compiler rule treats the
      // initial invocation as a synchronous state update and is not applicable
      // to this app's established client-fetch pattern.
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
];

export default eslintConfig;
