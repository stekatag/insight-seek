/** @type {import('next-sitemap').IConfig} */
export default {
  siteUrl: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:8888",
  generateRobotsTxt: true,
  sitemapSize: 7000,
  exclude: ["/api/*"],
  additionalPaths: async (config) => [
    await config.transform(config, "/sign-in"),
    await config.transform(config, "/sign-up"),
    await config.transform(config, "/privacy"),
  ],
  robotsTxtOptions: {
    policies: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/*"],
      },
    ],
  },
};
