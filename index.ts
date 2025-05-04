import fs from "fs";
import path from "path";
import { generateText } from "ai";
import type { CoreMessage } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { fileTypeFromBuffer } from "file-type";

if (!process.env.GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY is required");
}

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const renamedFolder = path.resolve("renamed");
if (!fs.existsSync(renamedFolder)) {
  fs.mkdirSync(renamedFolder);
}

const videosFolder = path.resolve("fans");
const files = fs.readdirSync(videosFolder);

for (const file of files) {
  try {
    const filePath = path.join(videosFolder, file);
    const fileStats = fs.statSync(filePath);

    if (!fileStats.isFile()) continue;

    console.log(`Processing ${file}...`);

    const fileBuffer = fs.readFileSync(filePath);
    const fileType = await fileTypeFromBuffer(fileBuffer);

    if (!fileType?.mime) {
      console.error(`Could not determine file type for ${file}, skipping`);
      continue;
    }

    const chat: CoreMessage[] = [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: 'return the just the caption at the top of this video. nothing else. make sure to include the text from any logo in the caption to the best of your ability! if the video doesnt have a clear caption, return "unknown".',
          },
          {
            type: "file",
            data: fileBuffer,
            mimeType: fileType.mime,
          },
        ],
      },
    ];

    const { text } = await generateText({
      model: google("models/gemini-2.0-flash"),
      temperature: 1.5,
      messages: chat,
    });

    if (text === "unknown") {
      console.log(`No caption found for ${file}, moving to unknown folder`);
      const unknownFolder = path.resolve("unknown");
      if (!fs.existsSync(unknownFolder)) {
        fs.mkdirSync(unknownFolder);
      }
      const unknownPath = path.join(unknownFolder, file);
      fs.copyFileSync(filePath, unknownPath);
      continue;
    }

    const cleanCaption = text
      .trim()
      .replaceAll("\n", " ")
      .replace(/[\/\\:*?"<>|]/g, "")

      .substring(0, 100);

    const fileExtension = path.extname(file);
    const originalName = path.basename(file, fileExtension);
    // const id = originalName.split("_")[1];
    const id = originalName.split("(")[1]?.split(")")[0];

    const newFilename = `${cleanCaption} (${id})${fileExtension}`;
    const newPath = path.join(renamedFolder, newFilename);

    fs.copyFileSync(filePath, newPath);

    console.log(`Renamed: ${file} -> ${newFilename}`);

    // await new Promise((resolve) => setTimeout(resolve, 500));
  } catch (error) {
    console.error(`Error processing ${file}:`, error);
  }
}

console.log("All videos processed");
