#! /usr/bin/env node

import { Command } from "commander";
import figlet from "figlet";
import fs from "fs";
import chalk from "chalk";
import { runChain } from "./langchain/chain";
import {
  defaultOption,
  multiOption,
  readFile,
  writeFile,
} from "./utils/system";
import { join, resolve } from "path";
import * as prompts from "./langchain/prompts";
import { executeFile } from "./utils/code";
// import dotenv from "dotenv";

// dotenv.config();

const main = async () => {
  const program = new Command();

  program
    .version("1.0.0", "-v, --version", "output the current version")
    .description("Brings the power of GPT-4 to your terminal")
    .option("-r, --review  <filePath>", "code review for a file")
    .option("-i, --improve  <filePath>", "refactor the code")
    .option("-b, --best  <filePath>", "convert the code to the best practices")
    .option("-f, --fix [filePath interpreter...]", "fix the code recursively")
    .option(
      "-l, --lang [filePath targetLanguage...]",
      "convert the code to a different language"
    )
    .option("-e, --eli5 <filePath>", "explain the code in simple terms")
    .option(
      "-t, --test [filePath framework...]",
      "generate unit tests for the code"
    )
    .option("-d, --document <filePath>", "generate documentation for the code")
    .option(
      "-x, --arbitraryFile [filePath prompt...]",
      "accepts any instruction (prompt needs to be in quotes)"
    )
    .option("-z, --arbitrary <prompt>", "accepts any instruction")
    .option("-o, --output [filePath]", "the output file path")
    .option("-s, --silent", "prevents logging the stream to the console")
    .option("-g3, --gpt3", "only uses GPT-3.5")
    .option(
      "-ak, --addkey [apiKey]",
      "add your OpenAI API key to the the environment"
    )
    .option(
      "-dk, --deletekey",
      "delete your OpenAI API key from the environment"
    )
    .option("-pk, --printkey", "print your OpenAI API key")
    .parse(process.argv);

  const options = program.opts();

  // default, when no options are passed
  if (!process.argv.slice(2).length) {
    console.log(figlet.textSync("Magic GPT"));
    program.outputHelp();
  }

  // default output = output.txt
  // or you can specify a specifc output file
  let filePath = join(process.cwd(), "output.txt");
  let silent = false;
  let model = "gpt-4";
  let apiKey = "";

  let envVars;
  try {
    envVars = fs.readFileSync(join(__dirname, ".env"), { encoding: "utf8" });
  } catch (error) {}

  if (envVars) {
    apiKey = envVars.split("=")[1];
  } else {
  }

  if (options.output) {
    filePath = typeof options.output === "string" ? options.output : filePath;
  }

  if (options.silent) {
    silent = true;
  }

  if (options.gpt3) {
    model = "gpt-3.5-turbo";
  }

  // Options for API Key
  if (options.addkey) {
    const key = typeof options.addkey === "string" ? options.addkey : "";

    if (key) {
      fs.writeFileSync(join(__dirname, ".env"), `OPENAI_API_KEY=${key}`);
      console.log(chalk.green("You have successfully added your API key"));
    } else {
      console.log(chalk.red("Please enter a valid API key"));
    }
  } else if (options.deletekey) {
    fs.writeFileSync(join(__dirname, ".env"), "");
    console.log(chalk.green("You have successfully deleted your API key"));
  } else if (options.printkey) {
    let data;
    try {
      data = fs.readFileSync(join(__dirname, ".env"), { encoding: "utf8" });
    } catch (error) {
      console.log(chalk.red("You have not added your API key"));
    }

    if (data) {
      console.log(chalk.blue(data));
    } else {
      console.log(chalk.red("You have not added your API key"));
    }
  } else if (options.review) {
    defaultOption(
      options,
      "review",
      prompts.codeReviewInstruction,
      model,
      apiKey
    );
  } else if (options.improve) {
    defaultOption(
      options,
      "improve",
      prompts.refactorInstruction,
      model,
      apiKey
    );
  } else if (options.best) {
    defaultOption(
      options,
      "best",
      prompts.bestPracticesInstruction,
      model,
      apiKey
    );
  } else if (options.fix) {
    if (options.fix.length < 2) {
      console.log(
        chalk.red(
          "Error parsing arguments please provide them in this format: -f src/test.py python3"
        )
      );
      return;
    }
    filePath = typeof options.fix[0] === "string" ? options.fix[0] : "";
    const interpreter =
      typeof options.fix[1] === "string" ? options.fix[1] : "";

    const defaultLimit = 3;
    const limit = options.limit ? options.limit : defaultLimit;

    for (let i = 0; i < limit; i++) {
      // run the file
      // if the file throws an error, continue
      // if the file works, run it and break afterwards
      const result = await executeFile(filePath, interpreter);

      if (result.type === "stdout") {
        console.log(result.output);
        break;
      }

      let file;
      try {
        file = readFile(filePath);
      } catch (error) {
        if (!filePath) {
          console.log(chalk.red("Please provide a file path."));
        } else {
          console.log(
            chalk.red("Could not read file: " + '"' + filePath + '"')
          );
        }
        return;
      }

      const llmOutput = await runChain(
        file,
        prompts.fixInstruction.replace("{replace}", result.output), // add the error to the instruction
        "Running script in regenerative mode...",
        silent,
        model,
        apiKey
      );

      writeFile(filePath, llmOutput.text);
    }
  } else if (options.lang) {
    await multiOption(
      options,
      "lang",
      prompts.convertLanguageInstruction,
      model,
      apiKey
    );
  } else if (options.eli5) {
    await defaultOption(
      options,
      "eli5",
      prompts.eli5Instruction,
      model,
      apiKey
    );
  } else if (options.test) {
    await multiOption(options, "test", prompts.testsInstruction, model, apiKey);
  } else if (options.document) {
    await defaultOption(
      options,
      "document",
      prompts.documentationInstruction,
      model,
      apiKey
    );
  } else if (options.arbitrary) {
    const prompt =
      typeof options.arbitrary === "string" ? options.arbitrary : "";
    const data = await runChain(
      prompt,
      prompts.arbitraryInstruction,
      "Running arbitrary instruction...",
      silent,
      model,
      apiKey
    );

    if (data && options.output) {
      writeFile(filePath, data.text);
    }
  } else if (options.arbitraryFile) {
    multiOption(
      options,
      "arbitraryFile",
      prompts.arbitraryInstruction,
      model,
      apiKey
    );
  }
};

main();
