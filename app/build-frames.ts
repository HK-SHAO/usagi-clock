import { frames } from "@/config";

const lines = [];

for (const frame of frames) {
  lines.push(
    `export { default as f${frame} } from "../../assets/frames/${frame}.png";`,
  );
}

const code = lines.join("\n");

Bun.write("src/frames.ts", `${code}\n`);
