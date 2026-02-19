import { frameNumbers } from "@/config";

const lines = [];

for (const frame of frameNumbers) {
  lines.push(
    `export { default as f${frame} } from "../../assets/frames_compressed/${frame}.avif";`,
  );
}

const code = lines.join("\n");

Bun.write("src/frames.ts", `${code}\n`);
