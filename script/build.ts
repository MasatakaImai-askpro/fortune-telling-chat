import { build as esbuild, type Plugin } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, readFile } from "fs/promises";

const importMetaUrlPlugin: Plugin = {
  name: "import-meta-url-fix",
  setup(build) {
    build.onLoad({ filter: /vite\.ts$/ }, async (args) => {
      let contents = await readFile(args.path, "utf-8");
      if (contents.includes("import.meta.url")) {
        contents = contents.replace(
          /import\.meta\.url/g,
          `require("url").pathToFileURL(__filename).href`
        );
        return { contents, loader: "ts" };
      }
      return undefined;
    });
  },
};

const allowlist = [
  "@google/generative-ai",
  "axios",
  "connect-pg-simple",
  "cors",
  "date-fns",
  "drizzle-orm",
  "drizzle-zod",
  "express",
  "express-rate-limit",
  "express-session",
  "jsonwebtoken",
  "memorystore",
  "multer",
  "nanoid",
  "nodemailer",
  "openai",
  "passport",
  "passport-local",
  "pg",
  "stripe",
  "uuid",
  "ws",
  "xlsx",
  "zod",
  "zod-validation-error",
];

async function buildAll() {
  await rm("dist", { recursive: true, force: true });

  console.log("building client...");
  await viteBuild();

  console.log("building server...");
  const pkg = JSON.parse(await readFile("package.json", "utf-8"));
  const allDeps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ];
  const externals = allDeps.filter((dep) => !allowlist.includes(dep));

  await esbuild({
    entryPoints: ["server/index.ts"],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: "dist/index.cjs",
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    minify: true,
    external: externals,
    logLevel: "info",
    plugins: [importMetaUrlPlugin],
  });
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
