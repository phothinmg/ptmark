#!/usr/bin/env node
/** @import {BuildOptions} from "lwe8-build" */
import { build } from "lwe8-build";

await (async () => {
  /**
   * @type {BuildOptions}
   */
  const options = {
    format: ["esm", "cjs"],
    indexFile: {
      path: "./src/index.ts",
      lines: 1,
    },
    outputDirs: {
      esm: "./dist",
      cjs: "./dist/commonjs",
    },
    otherFiles: [
      {
        path: "./src/emoji.ts",
        removeExport: true,
      },
    ],
  };
  await build(options);
})();
